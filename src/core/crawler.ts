import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { Page, HTTPResponse } from 'puppeteer';
import BrowserManager from './browser-manager.js';
import {
  CrawlerOptions,
  KlineData,
  KlineResponse,
  Market,
  Timeframe,
  TIMEFRAME_MAP,
  RealtimeQuote,
  RealtimeQuoteResponse,
  SSEStreamOptions,
  SSEStreamCallback,
  SSEErrorCallback,
  SSEConnectionType,
} from '../infra/types.js';
import { buildSecid, parseJSONPResponse, parseKlineRecord, buildRefererUrl, isUSMarket, convertPriceFromCents, calculatePriceChange } from '../utils/utils.js';
import { getConfig } from '../infra/config.js';
import { logger } from '../infra/logger.js';
import { parseKlineResponseData, parseKlineResponseObject } from './response-parser.js';
import { SAMPLE_LIMIT, DEFAULT_END_DATE, KLINE_FIELDS, REALTIME_FIELDS, ERROR_MESSAGES, USER_AGENT } from '../infra/constants.js';
import { SSEStreamManager } from './sse-stream-manager.js';
import { FastNewsClient, FastNewsOptions } from './fast-news-client.js';
import { FastNewsCategory, FastNewsListResponse } from '../infra/types.js';

/**
 * East Money K-line data crawler
 */
export class EastMoneyCrawler {
  private readonly apiBaseUrl: string;
  private readonly realtimeApiUrl: string;
  private readonly httpClient: AxiosInstance;
  private readonly cookieJar: CookieJar;
  private cookiesInitialized = false;
  private useBrowser: boolean;
  private browserManager: BrowserManager | null = null;
  private readonly config = getConfig();
  private sseStreamManager: SSEStreamManager | null = null;
  private fastNewsClient: FastNewsClient | null = null;

  constructor() {
    this.apiBaseUrl = this.config.api?.baseUrl || 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
    this.realtimeApiUrl = this.config.api?.realtimeUrl || 'https://push2.eastmoney.com/api/qt/stock/get';

    this.cookieJar = new CookieJar();
    const timeout = this.config.api?.timeout || 60000;
    const client = wrapper(axios.create({
      timeout,
      proxy: false, // Disable proxy detection to avoid url.parse() deprecation warning from proxy-from-env
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://quote.eastmoney.com/',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      },
      decompress: true,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      jar: this.cookieJar,
      withCredentials: true,
    }));
    this.httpClient = client;

    this.useBrowser = this.config.browser?.enabled || false;
    if (this.useBrowser) {
      logger.info('Browser mode enabled - will use Puppeteer for requests');
      this.browserManager = BrowserManager.getInstance();
    }
  }

  /**
   * Initialize cookies by setting essential tracking cookies
   */
  private async initializeCookies(symbol?: string, market?: Market): Promise<void> {
    if (this.cookiesInitialized) {
      return;
    }

    try {
      // Generate essential tracking cookies that the API expects
      const timestamp = Date.now();
      const randomId = this.generateRandomId();

      // Set essential cookies manually
      const domain = '.eastmoney.com';
      const cookies = [
        `qgqp_b_id=${randomId}`,
        `st_si=${timestamp}`,
        `st_pvi=${timestamp}${Math.floor(Math.random() * 1000000)}`,
        `st_sp=${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`,
        `st_inirUrl=https://quote.eastmoney.com/`,
        `st_sn=1`,
      ];

      // Set cookies in the jar
      for (const cookie of cookies) {
        await this.cookieJar.setCookie(
          `${cookie}; Domain=${domain}; Path=/`,
          'https://push2his.eastmoney.com'
        );
      }

      // Check if cookies were set
      const cookieString = await this.cookieJar.getCookieString('https://push2his.eastmoney.com');
      logger.debug('Cookies initialized:', cookieString ? 'Yes' : 'No');

      this.cookiesInitialized = true;
    } catch (error) {
      // Log but don't fail - we'll try the API request anyway
      logger.warn('Warning: Failed to initialize cookies, but will attempt API request');
      logger.warn('Error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Generate a random ID for tracking cookies
   */
  private generateRandomId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }


  /**
   * Initialize a browser page for a symbol (navigate to referer to get cookies)
   * Returns the page which can be reused for multiple API calls
   */
  private async initializeBrowserPageForSymbol(
    symbol: string,
    market: Market
  ): Promise<Page> {
    if (!this.browserManager) {
      throw new Error(ERROR_MESSAGES.BROWSER_NOT_INITIALIZED);
    }

    const refererUrl = buildRefererUrl(symbol, market);
    const page = await this.browserManager.newPage();

    // Visit referer page to initialize cookies
    logger.debug(`Navigating to ${refererUrl} to initialize cookies...`);
    const refererTimeout = this.config.browser?.refererTimeoutMs || 60000;
    await page.goto(refererUrl, {
      waitUntil: 'domcontentloaded',
      timeout: refererTimeout,
    });

    // Wait for tracking scripts to run
    const refererWait = this.config.browser?.refererWaitMs || 2000;
    await new Promise(resolve => setTimeout(resolve, refererWait));

    return page;
  }

  /**
   * Fetch API URL using an existing page (reuses cookies from page)
   */
  private async browserFetchUrlWithPage(
    page: Page,
    apiUrl: string,
    operation: string
  ): Promise<string> {
    // Navigate to API URL
    logger.debug(`Fetching ${operation}...`);
    const apiTimeout = this.config.browser?.apiTimeoutMs || 30000;
    const response: HTTPResponse | null = await page.goto(apiUrl, {
      waitUntil: 'domcontentloaded',
      timeout: apiTimeout,
    });

    if (!response) {
      throw new Error(`Failed to get response from API for ${operation}`);
    }

    return await response.text();
  }

  /**
   * Common browser fetch pattern: visit referer page then fetch API URL
   * Creates and closes a new page (use initializeBrowserPageForSymbol + browserFetchUrlWithPage for batch operations)
   */
  private async browserFetchUrl(
    apiUrl: string,
    refererUrl: string,
    operation: string
  ): Promise<string> {
    if (!this.browserManager) {
      throw new Error(ERROR_MESSAGES.BROWSER_NOT_INITIALIZED);
    }

    let page: Page | null = null;
    try {
      page = await this.browserManager.newPage();

      // Visit referer page to initialize cookies
      logger.debug(`Navigating to ${refererUrl} to initialize cookies...`);
      const refererTimeout = this.config.browser?.refererTimeoutMs || 60000;
      await page.goto(refererUrl, {
        waitUntil: 'domcontentloaded',
        timeout: refererTimeout,
      });

      // Wait for tracking scripts to run
      const refererWait = this.config.browser?.refererWaitMs || 2000;
      await new Promise(resolve => setTimeout(resolve, refererWait));

      // Navigate to API URL
      logger.debug(`Fetching ${operation}...`);
      const apiTimeout = this.config.browser?.apiTimeoutMs || 30000;
      const response: HTTPResponse | null = await page.goto(apiUrl, {
        waitUntil: 'domcontentloaded',
        timeout: apiTimeout,
      });

      if (!response) {
        throw new Error(`${ERROR_MESSAGES.FAILED_TO_GET_RESPONSE} for ${operation}`);
      }

      return await response.text();
    } catch (error) {
      logger.error(`Browser fetch error for ${operation}:`, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Build K-line API parameters
   */
  private buildKlineParams(options: CrawlerOptions): URLSearchParams {
    const {
      symbol,
      market = this.config.defaults?.market || Market.Shanghai,
      timeframe = this.config.defaults?.timeframe as Timeframe || 'daily',
      startDate,
      endDate = DEFAULT_END_DATE,
      limit = this.config.defaults?.limit || 1000000,
      fqt = this.config.defaults?.fqt || 1,
    } = options;

    const secid = buildSecid(market, symbol);
    const klt = TIMEFRAME_MAP[timeframe];
    const beg = startDate || '0';
    const callback = `jQuery${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const params = new URLSearchParams({
      cb: callback,
      secid,
      fields1: KLINE_FIELDS.REQUEST,
      fields2: KLINE_FIELDS.RESPONSE,
      klt: klt.toString(),
      fqt: fqt.toString(),
      beg,
      end: endDate,
      smplmt: SAMPLE_LIMIT,
      lmt: limit.toString(),
      _: Date.now().toString(),
    });

    // Only add token if configured (it's optional)
    if (this.config.api?.token) {
      params.set('ut', this.config.api.token);
    }

    return params;
  }

  /**
   * Parse quote data from API response
   */
  private parseQuoteData(quoteData: RealtimeQuoteResponse['data'], symbol: string, market: Market): RealtimeQuote {
    const latestPrice = convertPriceFromCents(quoteData.f43 ?? quoteData.f60 ?? quoteData.f301);
    const open = convertPriceFromCents(quoteData.f44);
    const previousClose = convertPriceFromCents(quoteData.f45);
    const high = convertPriceFromCents(quoteData.f46);
    const volume = quoteData.f47 ?? 0;
    const amount = quoteData.f48 ?? 0;
    const totalMarketValue = quoteData.f137;
    const circulatingMarketValue = quoteData.f170;

    const { changeAmount, changePercent } = calculatePriceChange(latestPrice, previousClose);

    return {
      symbol: quoteData.f57 ?? symbol,
      name: quoteData.f58 ?? '',
      market: quoteData.f107 ?? market,
      latestPrice,
      open,
      previousClose,
      high,
      low: high, // API doesn't provide separate low in real-time quote
      volume,
      amount,
      changeAmount,
      changePercent,
      totalMarketValue,
      circulatingMarketValue,
      timestamp: Date.now(),
    };
  }

  /**
   * Fetch K-line data using browser (Puppeteer) to bypass TLS fingerprinting
   */
  private async browserFetchKlineData(options: CrawlerOptions): Promise<KlineData[]> {
    const { symbol, market = Market.Shanghai } = options;

    // Use user-provided market code directly - no detection, no fallback
    return await this.browserFetchKlineDataWithMarket(symbol, market, options);
  }

  /**
   * Fetch K-line data using browser with a specific market code
   */
  private async browserFetchKlineDataWithMarket(
    symbol: string,
    market: Market | number,
    options: CrawlerOptions
  ): Promise<KlineData[]> {
    const params = this.buildKlineParams({ ...options, market: market as Market });
    const url = `${this.apiBaseUrl}?${params.toString()}`;
    const refererUrl = buildRefererUrl(symbol, market as Market);

    logger.debug(`Fetching data using browser for ${symbol} (${market})...`);

    const responseText = await this.browserFetchUrl(url, refererUrl, `K-line data for ${symbol}`);

    // Parse and validate response using unified parser
    return parseKlineResponseData(responseText, symbol);
  }

  /**
   * Batch fetch K-line data for multiple timeframes using a single browser page
   * More efficient for sync operations
   */
  async browserFetchKlineDataBatch(
    symbol: string,
    market: Market,
    timeframes: Timeframe[],
    options: Partial<CrawlerOptions> = {}
  ): Promise<Map<Timeframe, KlineData[]>> {
    if (!this.useBrowser || !this.browserManager) {
      throw new Error(ERROR_MESSAGES.BROWSER_MODE_NOT_ENABLED);
    }

    logger.info(`Fetching data using browser for ${symbol} (${market}) - ${timeframes.length} timeframes...`);

    const results = new Map<Timeframe, KlineData[]>();
    let page: Page | null = null;

    try {
      // Initialize page once for the symbol
      page = await this.initializeBrowserPageForSymbol(symbol, market);

      // Fetch each timeframe using the same page
      for (const timeframe of timeframes) {
        try {
          const params = this.buildKlineParams({
            symbol,
            market,
            timeframe,
            ...options,
          });
          const url = `${this.apiBaseUrl}?${params.toString()}`;

          const responseText = await this.browserFetchUrlWithPage(
            page,
            url,
            `${timeframe} K-line data for ${symbol}`
          );

          // Parse and validate response using unified parser
          const data = parseKlineResponseData(responseText, symbol);
          results.set(timeframe, data);
        } catch (error) {
          logger.error(`Error fetching ${timeframe} for ${symbol}:`, error instanceof Error ? error.message : String(error));
          results.set(timeframe, []);
        }
      }
    } finally {
      if (page) {
        await page.close();
      }
    }

    return results;
  }

  /**
   * Fetch K-line data from East Money API
   */
  async fetchKlineData(options: CrawlerOptions): Promise<KlineData[]> {
    // Try browser mode first if enabled
    if (this.useBrowser) {
      try {
        return await this.browserFetchKlineData(options);
      } catch (error) {
        logger.warn('Browser fetch failed, falling back to axios:', error instanceof Error ? error.message : String(error));
        // Fall through to axios method
      }
    }

    const { symbol, market = Market.Shanghai } = options;

    // Use user-provided market code directly - no detection, no fallback
    return await this.fetchKlineDataWithMarket(options);
  }

  /**
   * Fetch K-line data with a specific market code using axios
   */
  private async fetchKlineDataWithMarket(options: CrawlerOptions): Promise<KlineData[]> {
    const { symbol, market = Market.Shanghai } = options;

    // Initialize cookies first with the specific stock info
    await this.initializeCookies(symbol, market);

    const params = this.buildKlineParams(options);

    try {
      const response = await this.httpClient.get<string>(this.apiBaseUrl, {
        params,
        responseType: 'text',
        headers: {
          'Referer': buildRefererUrl(symbol, market),
        },
      });

      const klineResponse = this.parseKlineResponse(response.data);

      // Use unified parser to handle response validation
      return parseKlineResponseObject(klineResponse, symbol);
    } catch (error) {
      // Auto-fallback to browser mode if TLS fingerprinting detected
      if (axios.isAxiosError(error)) {
        const isTLSFingerprintingError = error.code === 'ECONNRESET' ||
          error.message.includes('socket hang up') ||
          error.code === 'ETIMEDOUT';

        if (isTLSFingerprintingError && !this.useBrowser) {
          logger.info('⚠️  Detected TLS fingerprinting protection. Automatically switching to browser mode...');

          // Enable browser mode for this instance
          this.useBrowser = true;

          // Initialize browser manager if not already done
          if (!this.browserManager) {
            this.browserManager = BrowserManager.getInstance();
          }

          try {
            return await this.browserFetchKlineData(options);
          } catch (browserError) {
            // If browser mode also fails, throw the original error with helpful message
            const errorDetails: string[] = [];
            errorDetails.push(`Message: ${error.message}`);
            if (error.code) errorDetails.push(`Code: ${error.code}`);
            if (error.request) {
              errorDetails.push(`Request made but no response received`);
            }
            errorDetails.push(
              '\n\n⚠️  Both direct HTTP and browser mode failed.',
              'This may indicate network issues or API changes.',
              'Browser mode error:', browserError instanceof Error ? browserError.message : String(browserError)
            );
            throw new Error(`Failed to fetch K-line data: ${errorDetails.join(', ')}`);
          }
        }

        // Original error handling for non-TLS errors
        const errorDetails: string[] = [];
        errorDetails.push(`Message: ${error.message}`);
        if (error.code) errorDetails.push(`Code: ${error.code}`);
        if (error.response) {
          errorDetails.push(`Status: ${error.response.status}`);
          errorDetails.push(`Status Text: ${error.response.statusText}`);
        }
        if (error.request) {
          errorDetails.push(`Request made but no response received`);
        }

        throw new Error(
          `Failed to fetch K-line data: ${errorDetails.join(', ')}`
        );
      }
      throw error;
    }
  }

  /**
   * Parse JSONP response and extract KlineResponse
   */
  private parseKlineResponse(jsonpResponse: string): KlineResponse {
    try {
      const data = parseJSONPResponse(jsonpResponse);
      return data as KlineResponse;
    } catch (error) {
      throw new Error(`Failed to parse API response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse array of K-line record strings into KlineData array
   */
  private parseKlinesArray(klines: string[]): KlineData[] {
    return klines.map((record, index) => {
      try {
        return parseKlineRecord(record);
      } catch (error) {
        throw new Error(
          `Failed to parse K-line record at index ${index}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * Get stock information (name, market, etc.) from the API response
   */
  async getStockInfo(symbol: string, market: Market = Market.Shanghai): Promise<{
    symbol: string;
    name: string;
    market: number;
  }> {
    const params = this.buildKlineParams({
      symbol,
      market,
      timeframe: 'daily',
      limit: 1,
    });

    const response = await this.httpClient.get<string>(this.apiBaseUrl, {
      params,
      responseType: 'text',
    });

    const apiResponse = this.parseKlineResponse(response.data);

    if (!apiResponse.data) {
      throw new Error('No data returned from API');
    }

    return {
      symbol: apiResponse.data.code,
      name: apiResponse.data.name,
      market: apiResponse.data.market,
    };
  }

  /**
   * Fetch real-time quote using browser (Puppeteer)
   */
  private async browserFetchRealtimeQuote(symbol: string, market: Market): Promise<RealtimeQuote> {
    const secid = buildSecid(market, symbol);
    const params = new URLSearchParams({
      secid,
      fields: REALTIME_FIELDS,
      _: Date.now().toString(),
    });

    const url = `${this.realtimeApiUrl}?${params.toString()}`;
    const refererUrl = buildRefererUrl(symbol, market);

    logger.info(`Fetching realtime quote using browser for ${symbol} (${market})...`);

    const responseText = await this.browserFetchUrl(url, refererUrl, `realtime quote for ${symbol}`);

    const data = this.parseRealtimeResponse(responseText);

    if (!data || !data.data) {
      throw new Error('No data returned from API');
    }

    return this.parseQuoteData(data.data, symbol, market);
  }

  /**
   * Get real-time quote for a stock
   */
  async getRealtimeQuote(symbol: string, market: Market = Market.Shanghai): Promise<RealtimeQuote> {
    // Try browser mode first if enabled
    if (this.useBrowser) {
      try {
        return await this.browserFetchRealtimeQuote(symbol, market);
      } catch (error) {
        logger.warn('Browser fetch failed, falling back to axios:', error instanceof Error ? error.message : String(error));
        // Fall through to axios method
      }
    }

    // Initialize cookies first
    await this.initializeCookies(symbol, market);

    const secid = buildSecid(market, symbol);
    const params = new URLSearchParams({
      secid,
      fields: REALTIME_FIELDS,
      _: Date.now().toString(),
    });

    try {
      const response = await this.httpClient.get<string>(this.realtimeApiUrl, {
        params,
        responseType: 'text',
      });

      const data = this.parseRealtimeResponse(response.data);

      if (!data || !data.data) {
        throw new Error('No data returned from API');
      }

      return this.parseQuoteData(data.data, symbol, market);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to fetch real-time quote: ${error.message}${error.response ? ` (Status: ${error.response.status})` : ''}`
        );
      }
      throw error;
    }
  }

  /**
   * Parse real-time quote API response
   */
  private parseRealtimeResponse(response: string): RealtimeQuoteResponse {
    try {
      // Real-time API returns JSON directly (not JSONP)
      const data = JSON.parse(response);
      return data as RealtimeQuoteResponse;
    } catch (error) {
      // Try parsing as JSONP if JSON parsing fails
      try {
        const data = parseJSONPResponse(response);
        return data as RealtimeQuoteResponse;
      } catch (e) {
        throw new Error(
          `Failed to parse real-time quote response: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Get SSE stream manager instance
   */
  private getSSEStreamManager(): SSEStreamManager {
    if (!this.sseStreamManager) {
      this.sseStreamManager = new SSEStreamManager();
    }
    return this.sseStreamManager;
  }

  /**
   * Start SSE stream for real-time data
   */
  async startSSEStream(
    options: SSEStreamOptions,
    onData: SSEStreamCallback,
    onError?: SSEErrorCallback
  ): Promise<void> {
    const manager = this.getSSEStreamManager();
    await manager.startStream(options, onData, onError);
  }

  /**
   * Stop SSE stream for a stock
   */
  stopSSEStream(symbol: string, market: Market): void {
    if (this.sseStreamManager) {
      this.sseStreamManager.stopStream(symbol, market);
    }
  }

  /**
   * Stop all SSE streams
   */
  stopAllSSEStreams(): void {
    if (this.sseStreamManager) {
      this.sseStreamManager.stopAll();
    }
  }

  /**
   * Get latest SSE data for a stock
   */
  getLatestSSEData(symbol: string, market: Market, type: SSEConnectionType): any {
    if (this.sseStreamManager) {
      return this.sseStreamManager.getLatestData(symbol, market, type);
    }
    return null;
  }

  /**
   * Get fast news client instance
   */
  private getFastNewsClient(): FastNewsClient {
    if (!this.fastNewsClient) {
      this.fastNewsClient = new FastNewsClient();
    }
    return this.fastNewsClient;
  }

  /**
   * Fetch fast news list
   */
  async fetchFastNews(options: FastNewsOptions = {}): Promise<FastNewsListResponse> {
    const client = this.getFastNewsClient();
    return await client.fetchFastNewsList(options);
  }
}

