/**
 * Application constants
 */

export const SAMPLE_LIMIT = '460';
export const DEFAULT_END_DATE = '20500101';

export const KLINE_FIELDS = {
  REQUEST: 'f1,f2,f3,f4,f5,f6',
  RESPONSE: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
} as const;

export const REALTIME_FIELDS = 'f57,f58,f107,f137,f46,f44,f45,f47,f48,f60,f170,f301,f43';

/**
 * API response codes
 */
export const API_RESPONSE_CODES = {
  SUCCESS: 0,
  NO_DATA: 100,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  INVALID_MARKET: 'Invalid market code',
  INVALID_STOCK_CODE: 'Invalid stock symbol format',
  INVALID_TIMEFRAME: 'Invalid timeframe',
  INVALID_DATE_FORMAT: 'Invalid date format',
  INVALID_FQT: 'FQT must be 0 (none), 1 (forward), or 2 (backward)',
  INVALID_FORMAT: 'Format must be "json" or "csv"',
  BROWSER_NOT_INITIALIZED: 'Browser manager not initialized. Set USE_BROWSER=true to enable browser mode.',
  BROWSER_MODE_NOT_ENABLED: 'Browser mode not enabled. Set USE_BROWSER=true to enable browser mode.',
  FAILED_TO_PARSE_JSONP: 'Failed to parse JSONP response',
  INVALID_RESPONSE_DATA: 'Invalid response data',
  FAILED_TO_GET_RESPONSE: 'Failed to get response from API',
} as const;

/**
 * Fast news category to fastColumn ID mapping
 * Based on analysis of https://kuaixun.eastmoney.com/
 */
export const FAST_NEWS_CATEGORY_MAP: Record<string, number> = {
  live_724: 108,        // 7*24全球直播 (default on zq.html)
  focus: 101,           // 焦点 (yw.html)
  stock_live: 102,      // 股市直播 (zhibo.html) - estimated
  listed: 103,          // 上市公司 (ssgs.html) - estimated
  region: 104,          // 地区 (dq.html) - estimated
  central_bank: 105,    // 全球央行 (qqyh.html) - estimated
  economic: 106,        // 经济数据 (jjsj.html) - estimated
  global_stock: 107,    // 全球股市 (qqgs.html) - estimated
  commodity: 109,       // 商品 (sp.html) - estimated
  forex: 110,           // 外汇 (wh.html) - estimated
  bond: 108,            // 债券 (zq.html)
} as const;

/**
 * Fast news API constants
 */
export const FAST_NEWS_API = {
  BASE_URL: 'https://np-weblist.eastmoney.com/comm/web/getFastNewsList',
  DEFAULT_PAGE_SIZE: 50,
  DEFAULT_BIZ: 'web_724',
  DEFAULT_CLIENT: 'web',
} as const;

