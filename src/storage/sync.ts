import { EastMoneyCrawler } from '../core/crawler.js';
import BrowserManager from '../core/browser-manager.js';
import {
  getWatchlist,
  updateWatchlistEntry,
} from './watchlist.js';
import {
  getCachedData,
  setCachedData,
  isCacheValid,
  getCacheDateRange,
} from './cache.js';
import {
  SyncOptions,
  SyncResult,
  WatchlistEntry,
  Market,
  Timeframe,
  KlineData,
  CrawlerOptions,
  AdjustmentType,
} from '../infra/types.js';
import { logger } from '../infra/logger.js';

/**
 * All available timeframes
 */
const ALL_TIMEFRAMES: Timeframe[] = [
  'daily',
  'weekly',
  'monthly',
  '5min',
  '15min',
  '30min',
  '60min',
];

import { getConfig } from '../infra/config.js';

const DEFAULT_END_DATE = '20500101';

function getDefaultMaxAge(): number {
  const config = getConfig();
  return config.cache?.maxAge || 24 * 60 * 60 * 1000; // 24 hours
}

function getDefaultFqt(): AdjustmentType {
  const config = getConfig();
  return config.defaults?.fqt || 1; // Default to forward adjustment
}

/**
 * Calculate the date one day after the given date string (YYYY-MM-DD format)
 */
function getNextDay(dateStr: string): string {
  const dateObj = new Date(dateStr);
  dateObj.setDate(dateObj.getDate() + 1);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Convert date string from YYYY-MM-DD to YYYYMMDD format
 */
function dateToCompact(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Calculate incremental start date (day after last cached date)
 */
function calculateIncrementalStartDate(cacheDateRange: { min: string; max: string }): string {
  return getNextDay(cacheDateRange.max);
}

/**
 * Check if cache covers the requested date range
 */
function cacheCoversDateRange(
  cacheDateRange: { min: string; max: string },
  startDate?: string,
  endDate?: string
): boolean {
  const cacheStart = dateToCompact(cacheDateRange.min);
  const cacheEnd = dateToCompact(cacheDateRange.max);
  
  const coversStart = !startDate || cacheStart <= startDate;
  const coversEnd = !endDate || cacheEnd >= endDate;
  
  return coversStart && coversEnd;
}

/**
 * Manage browser mode environment variable and cleanup
 */
class BrowserModeManager {
  private originalValue: string | undefined;

  enable(): void {
    this.originalValue = process.env.USE_BROWSER;
    if (!process.env.USE_BROWSER) {
      process.env.USE_BROWSER = 'true';
    }
  }

  async cleanup(): Promise<void> {
    const useBrowser = process.env.USE_BROWSER === 'true';
    if (useBrowser) {
      const browserManager = BrowserManager.getInstance();
      if (browserManager.isRunning()) {
        await browserManager.close();
      }
    }

    // Restore original value
    if (this.originalValue === undefined) {
      delete process.env.USE_BROWSER;
    } else {
      process.env.USE_BROWSER = this.originalValue;
    }
  }
}

/**
 * Update stock name in watchlist if not already set
 */
async function updateStockNameIfNeeded(
  entry: WatchlistEntry,
  hasData: boolean,
  crawler: EastMoneyCrawler
): Promise<void> {
  if (!entry.name && hasData) {
    try {
      const stockInfo = await crawler.getStockInfo(entry.symbol, entry.market);
      if (stockInfo.name) {
        updateWatchlistEntry(entry.symbol, { name: stockInfo.name });
      }
    } catch (error) {
      // Ignore errors when fetching stock info
    }
  }
}

/**
 * Process and save batch fetch results for a symbol
 */
async function processBatchResults(
  entry: WatchlistEntry,
  batchResults: Map<Timeframe, KlineData[]>,
  timeframes: Timeframe[],
  options: SyncOptions,
  crawler: EastMoneyCrawler
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const maxAge = options.maxAge || getDefaultMaxAge();
  let hasAnyData = false;

  for (const timeframe of timeframes) {
    const data = batchResults.get(timeframe) || [];

    // Check if we need to fetch (cache validation)
    const defaultFqt = getDefaultFqt();
    if (!options.force && isCacheValid(entry.symbol, entry.market, timeframe, maxAge, defaultFqt)) {
      const cacheDateRange = getCacheDateRange(entry.symbol, entry.market, timeframe, defaultFqt);
      if (cacheDateRange && cacheCoversDateRange(cacheDateRange, options.startDate, options.endDate || DEFAULT_END_DATE)) {
        // Cache already has all requested data
        results.push({
          symbol: entry.symbol,
          market: entry.market,
          timeframe,
          success: true,
          recordsFetched: 0,
        });
        continue;
      }
    }

    // Save fetched data to cache
    if (data.length > 0) {
      setCachedData(entry.symbol, entry.market, timeframe, data, true, defaultFqt);
      hasAnyData = true;
    }

    results.push({
      symbol: entry.symbol,
      market: entry.market,
      timeframe,
      success: true,
      recordsFetched: data.length,
    });
  }

  // Update stock name once if we have any data
  await updateStockNameIfNeeded(entry, hasAnyData, crawler);

  return results;
}

/**
 * Calculate fetch date range considering cache and options
 */
function calculateFetchDateRange(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  options: SyncOptions
): { startDate?: string; endDate: string } | null {
  const { startDate, endDate, force, maxAge = getDefaultMaxAge() } = options;
  const fetchEndDate = endDate || DEFAULT_END_DATE;

  // Check if cache is valid and not forcing refresh
  const defaultFqt = getDefaultFqt();
  if (!force && isCacheValid(symbol, market, timeframe, maxAge, defaultFqt)) {
    const cacheDateRange = getCacheDateRange(symbol, market, timeframe, defaultFqt);
    
    if (cacheDateRange) {
      // If no startDate specified, check if cache already covers everything
      if (!startDate) {
        const cacheEnd = dateToCompact(cacheDateRange.max);
        if (cacheEnd >= fetchEndDate) {
          // Already have all requested data
          return null;
        }
      } else {
        // Check if cache covers the requested range
        if (cacheCoversDateRange(cacheDateRange, startDate, fetchEndDate)) {
          return null;
        }
      }
    }
  }

  // Determine fetch start date
  let fetchStartDate = startDate;
  
  // If not forcing and cache exists, do incremental sync
  if (!force) {
    const defaultFqt = getDefaultFqt();
    const cacheDateRange = getCacheDateRange(symbol, market, timeframe, defaultFqt);
    if (cacheDateRange) {
      const incrementalStart = calculateIncrementalStartDate(cacheDateRange);
      
      // Only fetch if incremental start is before or equal to requested end
      if (!fetchStartDate || incrementalStart <= fetchEndDate) {
        fetchStartDate = incrementalStart;
      }
    }
  }

  return { startDate: fetchStartDate, endDate: fetchEndDate };
}

/**
 * Sync a single symbol
 */
async function syncSymbol(
  entry: WatchlistEntry,
  options: SyncOptions,
  crawler: EastMoneyCrawler
): Promise<SyncResult> {
  const {
    timeframe = 'daily',
    startDate,
    endDate,
  } = options;

  try {
    const defaultFqt = getDefaultFqt();
    
    // Calculate fetch date range
    const dateRange = calculateFetchDateRange(entry.symbol, entry.market, timeframe, options);
    
    if (!dateRange) {
      // Cache already has all requested data
      const cached = getCachedData(entry.symbol, entry.market, timeframe, startDate, endDate, defaultFqt);
      return {
        symbol: entry.symbol,
        market: entry.market,
        timeframe,
        success: true,
        recordsFetched: cached?.length || 0,
      };
    }

    // Fetch data
    const crawlerOptions: CrawlerOptions = {
      symbol: entry.symbol,
      market: entry.market,
      timeframe,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit: 1000000,
      fqt: defaultFqt,
    };

    const fetchedData = await crawler.fetchKlineData(crawlerOptions);
    
    if (fetchedData.length > 0) {
      // Merge with existing cache
      setCachedData(entry.symbol, entry.market, timeframe, fetchedData, true, defaultFqt);
    }

    // Update stock name if not set and we have data
    await updateStockNameIfNeeded(entry, fetchedData.length > 0, crawler);
    
    // Success even if no data was fetched (API might not have data for this timeframe)
    return {
      symbol: entry.symbol,
      market: entry.market,
      timeframe,
      success: true,
      recordsFetched: fetchedData.length,
    };
  } catch (error) {
    return {
      symbol: entry.symbol,
      market: entry.market,
      timeframe,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sync all symbols in the watchlist
 * If no timeframe is specified, syncs all timeframes by default
 * Browser mode is automatically enabled for sync operations
 */
export async function syncWatchlist(options: SyncOptions = {}): Promise<SyncResult[]> {
  const entries = getWatchlist();
  
  if (entries.length === 0) {
    return [];
  }

  const browserManager = new BrowserModeManager();
  browserManager.enable();

  // Ensure config is reloaded after setting environment variable
  // Force reload by clearing any cache if needed
  const crawler = new EastMoneyCrawler();
  
  // Manually enable browser mode on crawler if environment variable is set
  // This ensures browser mode is enabled even if config was cached
  if (process.env.USE_BROWSER === 'true') {
    (crawler as any).useBrowser = true;
    if (!(crawler as any).browserManager) {
      (crawler as any).browserManager = BrowserManager.getInstance();
    }
  }
  
  const results: SyncResult[] = [];
  const defaultFqt = getDefaultFqt();

  // If timeframe is specified, sync only that timeframe
  // Otherwise, sync all timeframes
  const timeframesToSync = options.timeframe 
    ? [options.timeframe] 
    : ALL_TIMEFRAMES;

  const useBrowser = process.env.USE_BROWSER === 'true';

  try {
    if (useBrowser && timeframesToSync.length > 1) {
      // Batch fetch all timeframes for each symbol using a single page
      for (const entry of entries) {
        try {
          const batchResults = await crawler.browserFetchKlineDataBatch(
            entry.symbol,
            entry.market,
            timeframesToSync,
            {
              startDate: options.startDate,
              endDate: options.endDate,
              limit: 1000000,
              fqt: defaultFqt,
            }
          );

          const entryResults = await processBatchResults(
            entry,
            batchResults,
            timeframesToSync,
            options,
            crawler
          );
          results.push(...entryResults);
        } catch (error) {
          // If batch fetch fails, fall back to individual fetches
          logger.warn(`Batch fetch failed for ${entry.symbol}, falling back to individual fetches:`, error instanceof Error ? error.message : String(error));
          for (const timeframe of timeframesToSync) {
            const result = await syncSymbol(entry, { ...options, timeframe }, crawler);
            results.push(result);
          }
        }
      }
    } else {
      // Use individual fetches (either browser mode disabled or single timeframe)
      for (const entry of entries) {
        for (const timeframe of timeframesToSync) {
          const result = await syncSymbol(entry, { ...options, timeframe }, crawler);
          results.push(result);
        }
      }
    }
  } finally {
    await browserManager.cleanup();
  }

  return results;
}

/**
 * Auto-sync if cache is stale (for use in fetch operations)
 */
export async function autoSyncIfStale(
  symbol: string,
  market: Market,
  timeframe: Timeframe = 'daily',
  options: SyncOptions = {}
): Promise<KlineData[] | null> {
  const {
    startDate,
    endDate,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
  } = options;
  const maxAgeValue = maxAge || getDefaultMaxAge();

  // Check if cache is valid
  const defaultFqt = getDefaultFqt();
  if (isCacheValid(symbol, market, timeframe, maxAgeValue, defaultFqt)) {
    const cacheDateRange = getCacheDateRange(symbol, market, timeframe, defaultFqt);
    if (cacheDateRange && cacheCoversDateRange(cacheDateRange, startDate, endDate)) {
      // Cache has all requested data
      return getCachedData(symbol, market, timeframe, startDate, endDate, defaultFqt);
    }
  }

  // Cache is stale or missing data, sync it
  const entry: WatchlistEntry = {
    symbol,
    market,
  };

  const browserManager = new BrowserModeManager();
  browserManager.enable();

  let crawler: EastMoneyCrawler;
  let result: SyncResult;
  
  try {
    crawler = new EastMoneyCrawler();
    result = await syncSymbol(entry, { ...options, timeframe }, crawler);
  } finally {
    await browserManager.cleanup();
  }

  if (result.success) {
      const defaultFqt = getDefaultFqt();
      return getCachedData(symbol, market, timeframe, startDate, endDate, defaultFqt);
  }

  return null;
}

