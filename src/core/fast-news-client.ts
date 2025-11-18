import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { FastNewsCategory, FastNewsItem, FastNewsListResponse } from '../infra/types.js';
import { FAST_NEWS_API, FAST_NEWS_CATEGORY_MAP } from '../infra/constants.js';
import { parseJSONPResponse } from '../utils/utils.js';
import { logger } from '../infra/logger.js';
import { getConfig } from '../infra/config.js';

/**
 * Options for fetching fast news list
 */
export interface FastNewsOptions {
  category?: FastNewsCategory | string;  // News category
  pageSize?: number;                     // Number of items per page
  sortEnd?: string;                      // Sort end for pagination
  fastColumn?: number;                   // Direct fastColumn ID (overrides category)
}

/**
 * Fast News API Client
 */
export class FastNewsClient {
  private readonly httpClient: AxiosInstance;
  private readonly cookieJar: CookieJar;
  private cookiesInitialized = false;

  constructor() {
    this.cookieJar = new CookieJar();
    const config = getConfig();
    const timeout = config.api?.timeout || 60000;
    
    const client = wrapper(axios.create({
      timeout,
      proxy: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Referer': 'https://kuaixun.eastmoney.com/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
      },
      decompress: true,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      jar: this.cookieJar,
      withCredentials: true,
    }));
    
    this.httpClient = client;
  }

  /**
   * Initialize cookies
   */
  private async initializeCookies(): Promise<void> {
    if (this.cookiesInitialized) {
      return;
    }

    try {
      const timestamp = Date.now();
      const randomId = this.generateRandomId();
      const domain = '.eastmoney.com';
      
      const cookies = [
        `qgqp_b_id=${randomId}`,
        `st_si=${timestamp}`,
        `st_pvi=${timestamp}${Math.floor(Math.random() * 1000000)}`,
        `st_sp=${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}`,
        `st_inirUrl=https://kuaixun.eastmoney.com/`,
        `st_sn=1`,
      ];

      for (const cookie of cookies) {
        await this.cookieJar.setCookie(
          `${cookie}; Domain=${domain}; Path=/`,
          'https://np-weblist.eastmoney.com'
        );
      }

      this.cookiesInitialized = true;
      logger.debug('Fast news cookies initialized');
    } catch (error) {
      logger.warn('Warning: Failed to initialize cookies for fast news API');
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
   * Get fastColumn ID from category
   */
  private getFastColumnId(category?: FastNewsCategory | string): number {
    if (!category) {
      return FAST_NEWS_CATEGORY_MAP.live_724; // Default
    }

    // If category is already a number string, parse it
    if (typeof category === 'string' && /^\d+$/.test(category)) {
      return parseInt(category, 10);
    }

    // Look up in category map
    const categoryKey = typeof category === 'string' ? category : category;
    const fastColumn = FAST_NEWS_CATEGORY_MAP[categoryKey];
    
    if (fastColumn !== undefined) {
      return fastColumn;
    }

    // Default fallback
    logger.warn(`Unknown category: ${category}, using default`);
    return FAST_NEWS_CATEGORY_MAP.live_724;
  }

  /**
   * Parse fast news list response
   */
  private parseFastNewsResponse(responseText: string): FastNewsListResponse {
    try {
      // Try parsing as JSONP first
      const data = parseJSONPResponse(responseText);
      
      logger.debug('Raw API response:', JSON.stringify(data, null, 2));
      
      // Transform the response to match our interface
      if (data && typeof data === 'object') {
        // Structure 1: { code, message, data: { fastNewsList: [...] } } - East Money API format
        if (data.data && data.data.fastNewsList && Array.isArray(data.data.fastNewsList)) {
          return {
            code: parseInt(String(data.code || '0'), 10),
            message: data.message || data.msg,
            data: {
              list: this.normalizeNewsItems(data.data.fastNewsList),
              total: data.data.total,
              page: data.data.index,
              pageSize: data.data.size,
              sortEnd: data.data.sortEnd,
              hasMore: data.data.sortEnd ? true : false,
            },
          };
        }
        
        // Structure 2: { code, message, data: { list: [...] } }
        if (data.data && (data.data.list || Array.isArray(data.data))) {
          return this.normalizeResponse(data);
        }
        
        // Structure 3: { code, message, result: [...] } or { code, message, news: [...] }
        if (data.result && Array.isArray(data.result)) {
          return {
            code: parseInt(String(data.code || '0'), 10),
            message: data.message,
            data: {
              list: this.normalizeNewsItems(data.result),
            },
          };
        }
        
        if (data.news && Array.isArray(data.news)) {
          return {
            code: parseInt(String(data.code || '0'), 10),
            message: data.message,
            data: {
              list: this.normalizeNewsItems(data.news),
            },
          };
        }
        
        // Structure 4: { code, message, ... } with list at root level
        if (data.list && Array.isArray(data.list)) {
          return this.normalizeResponse(data);
        }
        
        // Structure 5: Direct array
        if (Array.isArray(data)) {
          return {
            code: 0,
            data: {
              list: this.normalizeNewsItems(data),
            },
          };
        }
        
        // Structure 6: Check if data exists but might be empty or in different format
        if (data.code !== undefined) {
          // Return the response even if no data, so caller can see the code/message
          return {
            code: parseInt(String(data.code || '0'), 10),
            message: data.message || data.msg,
            data: {
              list: [],
            },
          };
        }
      }
      
      throw new Error('Unexpected response format');
    } catch (error) {
      logger.error('Failed to parse fast news response:', error instanceof Error ? error.message : String(error));
      logger.error('Response text:', responseText.substring(0, 500));
      throw new Error(`Failed to parse fast news response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Normalize API response to FastNewsListResponse format
   */
  private normalizeResponse(data: any): FastNewsListResponse {
    const response: FastNewsListResponse = {
      code: data.code || data.rc || 0,
      message: data.message || data.msg,
    };

    // Handle different response structures
    if (data.data) {
      if (Array.isArray(data.data)) {
        response.data = {
          list: this.normalizeNewsItems(data.data),
        };
      } else if (data.data.list || Array.isArray(data.data.list)) {
        response.data = {
          list: this.normalizeNewsItems(data.data.list || []),
          total: data.data.total,
          page: data.data.page,
          pageSize: data.data.pageSize || data.data.page_size,
          hasMore: data.data.hasMore || data.data.has_more,
          sortEnd: data.data.sortEnd || data.data.sort_end,
        };
      }
    } else if (Array.isArray(data.list)) {
      response.data = {
        list: this.normalizeNewsItems(data.list),
        total: data.total,
        page: data.page,
        pageSize: data.pageSize || data.page_size,
        hasMore: data.hasMore || data.has_more,
        sortEnd: data.sortEnd || data.sort_end,
      };
    }

    return response;
  }

  /**
   * Build news URL from news code
   * Format: https://finance.eastmoney.com/a/{code}.html
   */
  private buildNewsUrl(code: string): string {
    if (!code) {
      return '';
    }
    return `https://finance.eastmoney.com/a/${code}.html`;
  }

  /**
   * Normalize news items to FastNewsItem format
   */
  private normalizeNewsItems(items: any[]): FastNewsItem[] {
    return items.map((item, index) => {
      // Handle different item formats
      // East Money API format: { code, title, summary, showTime, stockList, ... }
      const newsCode = item.code || item.id || item.newsId || item.news_id || String(index);
      
      const normalized: FastNewsItem = {
        id: newsCode,
        title: item.title || item.newsTitle || item.news_title || '',
        content: item.summary || item.content || item.newsContent || item.news_content || item.digest || '',
        time: item.showTime || item.time || item.publishTime || item.publish_time || item.showtime || '',
        source: item.source || item.newsSource || item.news_source,
        url: item.url || item.link || item.newsUrl || item.news_url || this.buildNewsUrl(newsCode),
        category: item.category || item.newsCategory || item.news_category,
      };

      // Parse timestamp if time is available
      if (normalized.time) {
        try {
          // Try to parse various time formats
          const timeStr = normalized.time;
          // Format: "2025-11-18 12:09:22" (East Money format)
          if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
            normalized.timestamp = new Date(timeStr.replace(' ', 'T')).getTime();
          } else if (timeStr.includes('T') || (timeStr.includes('-') && timeStr.includes(':'))) {
            normalized.timestamp = new Date(timeStr).getTime();
          } else if (/^\d{10}$/.test(timeStr)) {
            // Unix timestamp in seconds
            normalized.timestamp = parseInt(timeStr, 10) * 1000;
          } else if (/^\d{13}$/.test(timeStr)) {
            // Unix timestamp in milliseconds
            normalized.timestamp = parseInt(timeStr, 10);
          }
        } catch (e) {
          // Ignore timestamp parsing errors
        }
      }

      // Preserve all original fields
      Object.keys(item).forEach(key => {
        if (!(key in normalized)) {
          normalized[key] = item[key];
        }
      });

      return normalized;
    });
  }

  /**
   * Fetch fast news list
   */
  async fetchFastNewsList(options: FastNewsOptions = {}): Promise<FastNewsListResponse> {
    await this.initializeCookies();

    const {
      category,
      pageSize = FAST_NEWS_API.DEFAULT_PAGE_SIZE,
      sortEnd = '',
      fastColumn,
    } = options;

    // Determine fastColumn ID
    const fastColumnId = fastColumn !== undefined 
      ? fastColumn 
      : this.getFastColumnId(category);

    // Build URL with parameters
    const callback = `jQuery${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const params = new URLSearchParams({
      client: FAST_NEWS_API.DEFAULT_CLIENT,
      biz: FAST_NEWS_API.DEFAULT_BIZ,
      fastColumn: fastColumnId.toString(),
      sortEnd,
      pageSize: pageSize.toString(),
      req_trace: Date.now().toString(),
      _: Date.now().toString(),
      callback,
    });

    const url = `${FAST_NEWS_API.BASE_URL}?${params.toString()}`;

    try {
      logger.debug(`Fetching fast news list: category=${category}, fastColumn=${fastColumnId}, pageSize=${pageSize}`);

      const response = await this.httpClient.get<string>(url, {
        responseType: 'text',
        headers: {
          'Referer': 'https://kuaixun.eastmoney.com/',
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = this.parseFastNewsResponse(response.data);
      
      logger.debug(`Fetched ${result.data?.list?.length || 0} news items`);
      
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorDetails: string[] = [];
        errorDetails.push(`Message: ${error.message}`);
        if (error.code) errorDetails.push(`Code: ${error.code}`);
        if (error.response) {
          errorDetails.push(`Status: ${error.response.status}`);
          errorDetails.push(`Status Text: ${error.response.statusText}`);
        }
        throw new Error(`Failed to fetch fast news list: ${errorDetails.join(', ')}`);
      }
      throw error;
    }
  }
}

