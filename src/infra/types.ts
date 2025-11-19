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
  } | null;
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
  US_ETF = 107,  // 美股ETF (US ETFs like SPY)
  HongKong = 116, // 港股
}

/**
 * Crawler configuration options
 */
export interface CrawlerOptions {
  symbol: string; // Stock symbol (e.g., "688005")
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
  symbol: string; // Stock symbol (e.g., "688005")
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
  symbol: string; // Stock symbol
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
 * Market detection result
 */
export interface MarketDetectionResult {
  market: number;
  marketName: string;
  symbol: string;
  name: string;
  works: boolean;
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
    [key: string]: number | string | undefined; // Restrict to primitive types
  };
}

/**
 * SSE connection types
 */
export enum SSEConnectionType {
  QUOTE = 'quote',        // 实时行情
  TREND = 'trend',        // 分时走势
  DETAIL = 'detail',      // 成交明细
  NEWS = 'news'           // 新闻推送
}

/**
 * SSE real-time quote data (extends RealtimeQuote with additional SSE fields)
 */
export interface SSEQuoteData extends RealtimeQuote {
  svr?: number;           // Server ID
  rawData?: {             // Raw field data
    [key: string]: number | string | undefined;
  };
  buy1Price?: number;     // 买一价 (f51)
  sell1Price?: number;    // 卖一价 (f52)
  buy1Volume?: number;    // 买一量 (f161)
  buy2Volume?: number;    // 买二量 (f162)
  buy3Volume?: number;    // 买三量 (f163)
  buy4Volume?: number;    // 买四量 (f164)
  sell1Volume?: number;   // 卖一量 (f167)
  sell2Volume?: number;   // 卖二量 (f168)
  sell3Volume?: number;   // 卖三量 (f169)
  sell4Volume?: number;   // 卖四量 (f170)
  volumeRatio?: number;   // 量比 (f92)
  turnoverRate?: number;  // 换手率 (f107)
  peRatio?: number;       // 市盈率 (f111)
}

/**
 * SSE trend data (分时走势数据)
 */
export interface SSETrendData {
  time: string;           // 时间 "HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"
  price: number;          // 最新价
  high: number;           // 最高
  low: number;            // 最低
  open: number;           // 开盘
  volume: number;         // 成交量
  amount: number;         // 成交额
  avgPrice: number;       // 均价
}

/**
 * SSE detail data (成交明细数据)
 */
export interface SSEDetailData {
  time: string;           // 时间 "HH:MM:SS"
  price: number;          // 成交价格
  volume: number;         // 成交量
  direction: 'buy' | 'sell'; // 买卖方向
  type: number;           // 成交类型（1=普通, 3=大单, 4=特大单）
}

/**
 * SSE news data (新闻推送数据)
 */
export interface SSENewsData {
  type: string;
  seq: number;
  content: string;
  timestamp?: number;
}

/**
 * SSE stream options
 */
export interface SSEStreamOptions {
  symbol: string;
  market: Market;
  types?: SSEConnectionType[];  // 订阅的连接类型，默认只订阅quote
  reconnectInterval?: number;   // 重连间隔（毫秒），默认5000
  maxReconnectAttempts?: number; // 最大重连次数，默认10
  heartbeatTimeout?: number;     // 心跳超时（毫秒），默认30000
}

/**
 * SSE stream callback function type
 * For news type, data can be string; for others, it's SSERawResponse
 */
export type SSEStreamCallback<T = SSERawResponse | string> = (data: T, type: SSEConnectionType) => void;

/**
 * SSE error callback function type
 */
export type SSEErrorCallback = (error: Error, type: SSEConnectionType) => void;

/**
 * Raw SSE message response structure
 */
export interface SSERawResponse {
  rc: number;             // Return code (0 = success)
  rt: number;             // Response type (2=heartbeat, 4=quote, 10=trend, 12=detail)
  svr: number;            // Server ID
  lt: number;             // Data type
  full: number;           // Full data flag
  dlmkts: string;         // Delisted markets
  data: any;              // Data payload (varies by type)
}

/**
 * Fast news category types
 */
export enum FastNewsCategory {
  LIVE_724 = 'live_724',        // 7*24全球直播
  FOCUS = 'focus',              // 焦点
  STOCK_LIVE = 'stock_live',    // 股市直播
  LISTED_COMPANY = 'listed',    // 上市公司
  REGION = 'region',            // 地区
  CENTRAL_BANK = 'central_bank', // 全球央行
  ECONOMIC_DATA = 'economic',   // 经济数据
  GLOBAL_STOCK = 'global_stock', // 全球股市
  COMMODITY = 'commodity',      // 商品
  FOREX = 'forex',              // 外汇
  BOND = 'bond',                // 债券
}

/**
 * Fast news item structure
 */
export interface FastNewsItem {
  id: string;                    // News ID
  title: string;                 // News title
  content: string;               // News content
  time: string;                  // Publish time
  timestamp?: number;            // Timestamp in milliseconds
  source?: string;               // News source
  url?: string;                  // News URL
  category?: string;             // News category
  [key: string]: any;            // Additional fields
}

/**
 * Fast news list API response
 */
export interface FastNewsListResponse {
  code: number;                  // Response code
  message?: string;              // Response message
  data?: {
    list?: FastNewsItem[];       // News list
    total?: number;              // Total count
    page?: number;               // Current page
    pageSize?: number;           // Page size
    hasMore?: boolean;           // Has more pages
    sortEnd?: string;            // Sort end for pagination
  };
  [key: string]: any;            // Additional fields
}

