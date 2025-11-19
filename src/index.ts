/**
 * emst API Entry Point
 * 
 * This file exports all public APIs for programmatic use.
 * Import from this file to use emst as a library without triggering CLI code.
 */

// Core classes
export { EastMoneyCrawler } from './core/crawler.js';
export { FastNewsClient, type FastNewsOptions } from './core/fast-news-client.js';

// Watchlist functions
export {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  getWatchlistEntry,
  updateWatchlistEntry,
  checkWatchlistMarkets,
  type MarketValidationResult,
} from './storage/watchlist.js';

// Cache functions
export {
  getCachedData,
  setCachedData,
  isCacheValid,
  getCacheEntry,
  getCacheDateRange,
  clearCache,
  getCachePath,
} from './storage/cache.js';

// Sync functions
export {
  syncWatchlist,
  autoSyncIfStale,
} from './storage/sync.js';

// Type definitions
export type {
  KlineData,
  KlineResponse,
  Timeframe,
  AdjustmentType,
  CrawlerOptions,
  WatchlistEntry,
  CacheEntry,
  DateRange,
  SyncOptions,
  SyncResult,
  RealtimeQuote,
  RealtimeQuoteResponse,
  SSEConnectionType,
  SSEQuoteData,
  SSETrendData,
  SSEDetailData,
  SSENewsData,
  SSEStreamOptions,
  SSEStreamCallback,
  SSEErrorCallback,
  SSERawResponse,
  FastNewsCategory,
  FastNewsItem,
  FastNewsListResponse,
} from './infra/types.js';

export {
  Market,
  TIMEFRAME_MAP,
  SSEConnectionType as SSEConnectionTypeEnum,
  FastNewsCategory as FastNewsCategoryEnum,
} from './infra/types.js';

