import { KlineData, RealtimeQuote, Timeframe } from '../infra/types.js';
import { Market } from '../infra/types.js';

/**
 * Parse a comma-separated K-line record string into KlineData object
 * Format: date,open,close,high,low,volume,amount,amplitude,changePercent,changeAmount,turnoverRate
 */
export function parseKlineRecord(record: string): KlineData {
  const parts = record.split(',');
  
  if (parts.length < 7) {
    throw new Error(`Invalid K-line record format: ${record}`);
  }

  return {
    date: parts[0],
    open: parseFloat(parts[1]),
    close: parseFloat(parts[2]),
    high: parseFloat(parts[3]),
    low: parseFloat(parts[4]),
    volume: parseFloat(parts[5]),
    amount: parseFloat(parts[6]),
    amplitude: parts[7] ? parseFloat(parts[7]) : undefined,
    changePercent: parts[8] ? parseFloat(parts[8]) : undefined,
    changeAmount: parts[9] ? parseFloat(parts[9]) : undefined,
    turnoverRate: parts[10] ? parseFloat(parts[10]) : undefined,
  };
}

/**
 * Parse JSONP response and extract the JSON data
 */
export function parseJSONPResponse(jsonp: string): any {
  // JSONP format: callbackName({...json...}) or callbackName({...json...}); or just {...json...}
  // Try to find the JSON object by looking for the first { and last }
  
  // First, try to find if it's wrapped in a callback
  const parenStart = jsonp.indexOf('(');
  const parenEnd = jsonp.lastIndexOf(')');
  
  if (parenStart !== -1 && parenEnd !== -1 && parenStart < parenEnd) {
    // It's a JSONP response with callback
    const jsonStr = jsonp.substring(parenStart + 1, parenEnd);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // If parsing fails, try to find JSON object directly
    }
  }
  
  // Try to find JSON object directly (might be plain JSON)
  const braceStart = jsonp.indexOf('{');
  const braceEnd = jsonp.lastIndexOf('}');
  
  if (braceStart !== -1 && braceEnd !== -1 && braceStart < braceEnd) {
    const jsonStr = jsonp.substring(braceStart, braceEnd + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}. Response preview: ${jsonp.substring(0, 200)}`);
    }
  }
  
  throw new Error(`Invalid JSONP/JSON response format. Response preview: ${jsonp.substring(0, 200)}`);
}

/**
 * Build secid from market and stock code
 * Format: {market}.{code}
 */
export function buildSecid(market: number, code: string): string {
  return `${market}.${code}`;
}

/**
 * Auto-detect market code from A-share stock code
 * Rules:
 * - 300xxx, 301xxx: 创业板 (Shenzhen)
 * - 000xxx, 001xxx, 002xxx, 003xxx: 深圳主板/中小板 (Shenzhen)
 * - 688xxx: 科创板 (Shanghai)
 * - 600xxx, 601xxx, 603xxx, 605xxx: 上海主板 (Shanghai)
 * @returns Market code or null if cannot determine
 */
export function detectMarketFromCode(code: string): Market | null {
  if (!/^\d{6}$/.test(code)) {
    return null; // Not a 6-digit A-share code
  }

  const prefix = code.substring(0, 3);
  
  // Shenzhen markets
  if (prefix === '300' || prefix === '301') {
    return Market.Shenzhen; // 创业板
  }
  if (prefix === '000' || prefix === '001' || prefix === '002' || prefix === '003') {
    return Market.Shenzhen; // 深圳主板/中小板
  }
  
  // Shanghai markets
  if (prefix === '688') {
    return Market.Shanghai; // 科创板
  }
  if (prefix === '600' || prefix === '601' || prefix === '603' || prefix === '605') {
    return Market.Shanghai; // 上海主板
  }
  
  return null; // Cannot determine
}

/**
 * Validate stock code format based on market
 */
export function validateStockCode(code: string, market: Market): boolean {
  switch (market) {
    case Market.Shenzhen:
    case Market.Shanghai:
      // A股: 6 digits
      return /^\d{6}$/.test(code);
    case Market.HongKong:
      // 港股: 5 digits, usually starts with 0
      return /^0\d{4}$/.test(code);
    case Market.US:
      // 美股: 1-5 uppercase letters (ticker symbol)
      return /^[A-Z]{1,5}$/.test(code);
    default:
      return false;
  }
}

/**
 * Get market name from market code
 */
export function getMarketName(market: Market): string {
  switch (market) {
    case Market.Shenzhen:
      return 'Shenzhen';
    case Market.Shanghai:
      return 'Shanghai';
    case Market.HongKong:
      return 'Hong Kong';
    case Market.US:
      return 'US';
    default:
      return 'Unknown';
  }
}

/**
 * Get market code description for CLI help
 */
export function getMarketHelpText(): string {
  return 'Market code: 0=Shenzhen, 1=Shanghai, 105=US, 116=Hong Kong (default: 1)';
}

/**
 * Valid market codes
 */
export const VALID_MARKETS = [Market.Shenzhen, Market.Shanghai, Market.US, Market.HongKong] as const;

/**
 * Validate and parse market code
 * @returns Market enum value or null if invalid
 */
export function parseMarket(marketStr: string): Market | null {
  const market = parseInt(marketStr, 10);
  if (isNaN(market)) {
    return null;
  }
  return VALID_MARKETS.includes(market as Market) ? (market as Market) : null;
}

/**
 * Get stock code validation error message
 */
export function getStockCodeValidationError(code: string, market: Market): string {
  let errorMsg = 'Invalid stock code format. ';
  switch (market) {
    case Market.Shenzhen:
    case Market.Shanghai:
      errorMsg += 'A-share codes must be 6 digits (e.g., 688005)';
      break;
    case Market.HongKong:
      errorMsg += 'Hong Kong codes must be 5 digits starting with 0 (e.g., 00700)';
      break;
    case Market.US:
      errorMsg += 'US codes must be 1-5 uppercase letters (e.g., AAPL)';
      break;
    default:
      errorMsg += 'Invalid market';
  }
  return errorMsg;
}

/**
 * Validate market and stock code, throw error if invalid
 * If market is not provided or invalid, try to auto-detect from code
 */
export function validateMarketAndCode(code: string, marketStr?: string): Market {
  let market: Market | null = null;
  
  // Try to parse provided market
  if (marketStr) {
    market = parseMarket(marketStr);
  }
  
  // If market not provided or invalid, try to auto-detect from code
  if (!market) {
    market = detectMarketFromCode(code);
    if (market) {
      // Auto-detected market, validate code format
      if (!validateStockCode(code, market)) {
        throw new Error(getStockCodeValidationError(code, market));
      }
      return market;
    }
  }
  
  // Market was provided and is valid, or auto-detection failed
  if (!market) {
    throw new Error(`Invalid market code. ${getMarketHelpText()}. Cannot auto-detect market from code ${code}.`);
  }
  
  if (!validateStockCode(code, market)) {
    throw new Error(getStockCodeValidationError(code, market));
  }

  return market;
}

/**
 * Format date to YYYYMMDD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parse YYYYMMDD date string
 */
export function parseDate(dateStr: string): Date {
  if (dateStr.length !== 8) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYYMMDD`);
  }
  
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  return new Date(year, month, day);
}

/**
 * Format real-time quote as table
 */
export function formatQuoteTable(quote: RealtimeQuote, marketName: string): string {
  const lines: string[] = [];
  lines.push(`\n${quote.name} (${quote.code}) - ${marketName}`);
  lines.push('─'.repeat(50));
  lines.push(`最新价:     ${quote.latestPrice.toFixed(2)}`);
  lines.push(`今开:       ${quote.open.toFixed(2)}`);
  lines.push(`昨收:       ${quote.previousClose.toFixed(2)}`);
  lines.push(`最高:       ${quote.high.toFixed(2)}`);
  lines.push(`最低:       ${quote.low.toFixed(2)}`);
  
  if (quote.changeAmount !== undefined && quote.changePercent !== undefined) {
    const changeSign = quote.changeAmount >= 0 ? '+' : '';
    const changeColor = quote.changeAmount >= 0 ? '↑' : '↓';
    lines.push(`涨跌:       ${changeSign}${quote.changeAmount.toFixed(2)} (${changeSign}${quote.changePercent.toFixed(2)}%) ${changeColor}`);
  }
  
  lines.push(`成交量:     ${quote.volume.toLocaleString()}`);
  lines.push(`成交额:     ${quote.amount.toLocaleString()}`);
  
  if (quote.totalMarketValue) {
    lines.push(`总市值:     ${(quote.totalMarketValue / 100000000).toFixed(2)} 亿`);
  }
  
  if (quote.circulatingMarketValue) {
    lines.push(`流通市值:   ${(quote.circulatingMarketValue / 100000000).toFixed(2)} 亿`);
  }
  
  lines.push('');
  return lines.join('\n');
}

/**
 * Get adjustment type name
 */
export function getAdjustmentTypeName(fqt: number): string {
  switch (fqt) {
    case 0:
      return 'none (不复权)';
    case 1:
      return 'forward (前复权)';
    case 2:
      return 'backward (后复权)';
    default:
      return `unknown (${fqt})`;
  }
}

/**
 * Error handling helper for CLI
 */
export function handleError(error: unknown, exitCode: number = 1): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error:', message);
  process.exit(exitCode);
}

/**
 * Validation helpers
 */
export const VALID_TIMEFRAMES: readonly Timeframe[] = ['daily', 'weekly', 'monthly', '5min', '15min', '30min', '60min'] as const;

export function validateTimeframe(timeframe: string): Timeframe {
  if (!VALID_TIMEFRAMES.includes(timeframe as Timeframe)) {
    throw new Error(`Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(', ')}`);
  }
  return timeframe as Timeframe;
}

export function validateDateFormat(date: string, fieldName: string): void {
  if (date && !/^\d{8}$/.test(date)) {
    throw new Error(`${fieldName} must be in YYYYMMDD format`);
  }
}
