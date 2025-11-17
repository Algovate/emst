/**
 * Individual K-line data record
 */
export interface KlineData {
  date: string; // YYYY-MM-DD format
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number; // Trading volume
  amount: number; // Trading amount
  amplitude?: number; // Price amplitude
  changePercent?: number; // Change percentage
  changeAmount?: number; // Change amount
  turnoverRate?: number; // Turnover rate
}

/**
 * Raw API response structure
 */
export interface KlineResponse {
  rc: number;
  rt: number;
  svr: number;
  lt: number;
  full: number;
  dlmkts: string;
  data: {
    code: string;
    market: number;
    name: string;
    decimal: number;
    dktotal: number;
    preKPrice: number;
    klines: string[]; // Array of comma-separated values
  };
}

/**
 * K-line timeframe types
 */
export type Timeframe = 'daily' | 'weekly' | 'monthly' | '5min' | '15min' | '30min' | '60min';

/**
 * Price adjustment types
 * 0 = none (不复权)
 * 1 = forward (前复权)
 * 2 = backward (后复权)
 */
export type AdjustmentType = 0 | 1 | 2;

/**
 * Market codes
 */
export enum Market {
  Shenzhen = 0,  // 深圳 (A股)
  Shanghai = 1,  // 上海 (A股)
  US = 105,      // 美股
  HongKong = 116, // 港股
}

/**
 * Crawler configuration options
 */
export interface CrawlerOptions {
  code: string; // Stock code (e.g., "688005")
  market?: Market; // Market code (default: Shanghai)
  timeframe?: Timeframe; // K-line timeframe (default: daily)
  startDate?: string; // Start date in YYYYMMDD format
  endDate?: string; // End date in YYYYMMDD format
  limit?: number; // Maximum records to fetch
  fqt?: AdjustmentType; // Price adjustment type: 0=none, 1=forward, 2=backward (default: 1)
}

/**
 * Timeframe to API klt parameter mapping
 */
export const TIMEFRAME_MAP: Record<Timeframe, number> = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '60min': 60,
  'daily': 101,
  'weekly': 102,
  'monthly': 103,
};

/**
 * Watchlist entry
 */
export interface WatchlistEntry {
  code: string; // Stock code (e.g., "688005")
  market: Market; // Market code
  name?: string; // Stock name (optional, can be fetched)
  addedDate?: string; // Date when added to watchlist (YYYY-MM-DD)
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  data: KlineData[]; // Cached K-line data
  lastSync: number; // Timestamp of last sync (milliseconds since epoch)
  metadata?: {
    symbol: string;
    market: Market;
    timeframe: Timeframe;
    fqt?: AdjustmentType; // Price adjustment type
    [key: string]: any;
  };
}

/**
 * Date range for cache operations
 */
export interface DateRange {
  min: string; // YYYY-MM-DD
  max: string; // YYYY-MM-DD
}

/**
 * Sync options
 */
export interface SyncOptions {
  timeframe?: Timeframe; // Timeframe to sync (default: daily)
  startDate?: string; // Start date in YYYYMMDD format
  endDate?: string; // End date in YYYYMMDD format
  force?: boolean; // Force refresh even if cache is valid
  maxAge?: number; // Maximum cache age in milliseconds (default: 24 hours)
}

/**
 * Sync result for a single symbol
 */
export interface SyncResult {
  symbol: string;
  market: Market;
  timeframe?: Timeframe; // Timeframe that was synced
  success: boolean;
  recordsFetched?: number;
  error?: string;
}

/**
 * Real-time quote data
 */
export interface RealtimeQuote {
  code: string; // Stock code
  name: string; // Stock name
  market: number; // Market code
  latestPrice: number; // 最新价 (f43)
  open: number; // 今开 (f44)
  previousClose: number; // 昨收 (f45)
  high: number; // 最高 (f46)
  low: number; // 最低 (f46, same as high in some cases)
  volume: number; // 成交量 (f47)
  amount: number; // 成交额 (f48)
  changePercent?: number; // 涨跌幅 (calculated)
  changeAmount?: number; // 涨跌额 (calculated)
  totalMarketValue?: number; // 总市值 (f137)
  circulatingMarketValue?: number; // 流通市值 (f170)
  timestamp?: number; // Timestamp when data was fetched
}

/**
 * Raw real-time quote API response
 */
export interface RealtimeQuoteResponse {
  rc: number;
  rt: number;
  svr: number;
  lt: number;
  full: number;
  dlmkts: string;
  data: {
    f43?: number; // 最新价
    f44?: number; // 今开
    f45?: number; // 昨收
    f46?: number; // 最高
    f47?: number; // 成交量
    f48?: number; // 成交额
    f57?: string; // 代码
    f58?: string; // 名称
    f60?: number; // 最新价（另一种格式）
    f107?: number; // 市场代码
    f137?: number; // 总市值
    f170?: number; // 流通市值
    f301?: number; // 最新价（另一种格式）
    [key: string]: any;
  };
}

