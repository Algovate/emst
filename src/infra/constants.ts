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
  INVALID_STOCK_CODE: 'Invalid stock code format',
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

