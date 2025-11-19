import { EastMoneyCrawler } from '../core/crawler.js';
import { Market, Timeframe, CrawlerOptions, KlineData, AdjustmentType } from '../infra/types.js';
import { getCachedData, setCachedData } from '../storage/cache.js';
import { logger } from '../infra/logger.js';

/**
 * Fetch and cache helper
 */
export async function fetchWithCache(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  crawlerOptions: CrawlerOptions,
  useCache: boolean,
  startDate?: string,
  endDate?: string,
  fqt: AdjustmentType = 1
): Promise<KlineData[]> {
  if (useCache) {
    try {
      // Check cache directly
      const cachedData = getCachedData(symbol, market, timeframe, startDate, endDate, fqt);
      if (cachedData && cachedData.length > 0) {
        logger.info(`Using cached data (${cachedData.length} records)`);
        return cachedData;
      }
    } catch (error) {
      logger.warn('Cache operation failed, fetching fresh data...');
    }
  }

  // Fetch fresh data
  const logMessage = useCache ? 'Cache miss, fetching fresh data...' : 'Cache disabled, fetching fresh data...';
  logger.info(logMessage);

  const crawler = new EastMoneyCrawler();
  const data = await crawler.fetchKlineData(crawlerOptions);

  // Save to cache
  if (data.length > 0) {
    setCachedData(symbol, market, timeframe, data, true, fqt);
  }

  return data;
}

