import {
  SSERawResponse,
  SSEQuoteData,
  SSETrendData,
  SSEDetailData,
  SSENewsData,
  SSEConnectionType,
  Market,
  RealtimeQuote,
} from '../infra/types.js';
import { logger } from '../infra/logger.js';

/**
 * Parse SSE raw response and route to appropriate parser based on rt (response type)
 */
export function parseSSEResponse(rawData: string): SSERawResponse | null {
  try {
    const data = JSON.parse(rawData);
    return data as SSERawResponse;
  } catch (error) {
    logger.warn('Failed to parse SSE response as JSON:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Parse quote data from SSE response (rt=4)
 */
export function parseSSEQuoteData(
  rawResponse: SSERawResponse,
  code: string,
  market: Market
): SSEQuoteData | null {
  if (rawResponse.rt !== 4) {
    return null; // Not a quote update
  }

  if (rawResponse.rc !== 0 || !rawResponse.data) {
    logger.warn('Invalid SSE quote response:', rawResponse);
    return null;
  }

  const data = rawResponse.data;
  
  // Convert price from "分" (cents) to "元" (yuan)
  const latestPrice = (data.f43 ?? data.f60 ?? data.f301 ?? 0) / 100;
  const open = (data.f44 ?? 0) / 100;
  const previousClose = (data.f45 ?? 0) / 100;
  const high = (data.f46 ?? 0) / 100;
  const buy1Price = (data.f51 ?? 0) / 100;
  const sell1Price = (data.f52 ?? 0) / 100;

  const changeAmount = latestPrice - previousClose;
  const changePercent = previousClose !== 0 ? (changeAmount / previousClose) * 100 : 0;

  const quote: SSEQuoteData = {
    code: data.f57 ?? code,
    name: data.f58 ?? '',
    market: data.f107 ?? market,
    latestPrice,
    open,
    previousClose,
    high,
    low: high, // API doesn't provide separate low in real-time quote
    volume: data.f47 ?? 0,
    amount: data.f48 ?? 0,
    changeAmount: previousClose !== 0 ? changeAmount : undefined,
    changePercent: previousClose !== 0 ? changePercent : undefined,
    totalMarketValue: data.f84 ?? data.f116,
    circulatingMarketValue: data.f85 ?? data.f117,
    timestamp: data.f86 ? data.f86 * 1000 : Date.now(), // Convert Unix timestamp to milliseconds
    svr: rawResponse.svr,
    rawData: data,
    buy1Price,
    sell1Price,
    buy1Volume: data.f161,
    buy2Volume: data.f162,
    buy3Volume: data.f163,
    buy4Volume: data.f164,
    sell1Volume: data.f167,
    sell2Volume: data.f168,
    sell3Volume: data.f169,
    sell4Volume: data.f170,
    volumeRatio: data.f92,
    turnoverRate: data.f107,
    peRatio: data.f111,
  };

  return quote;
}

/**
 * Parse trend data from SSE response (rt=10)
 */
export function parseSSETrendData(rawResponse: SSERawResponse): SSETrendData[] | null {
  if (rawResponse.rt !== 10) {
    return null; // Not a trend update
  }

  if (rawResponse.rc !== 0 || !rawResponse.data || !rawResponse.data.trends) {
    return null;
  }

  const trends: SSETrendData[] = [];
  const trendsArray = rawResponse.data.trends;

  for (const trendStr of trendsArray) {
    // Format: "2025-11-17 09:30,7.91,7.91,7.91,7.91,22772,18012652.00,7.910"
    // Or: "09:30,7.91,7.91,7.91,7.91,22772,18012652.00,7.910"
    const parts = trendStr.split(',');
    if (parts.length >= 8) {
      trends.push({
        time: parts[0],
        price: parseFloat(parts[1]) || 0,
        high: parseFloat(parts[2]) || 0,
        low: parseFloat(parts[3]) || 0,
        open: parseFloat(parts[4]) || 0,
        volume: parseInt(parts[5]) || 0,
        amount: parseFloat(parts[6]) || 0,
        avgPrice: parseFloat(parts[7]) || 0,
      });
    }
  }

  return trends.length > 0 ? trends : null;
}

/**
 * Parse detail data from SSE response (rt=12)
 */
export function parseSSEDetailData(rawResponse: SSERawResponse): SSEDetailData[] | null {
  if (rawResponse.rt !== 12) {
    return null; // Not a detail update
  }

  if (rawResponse.rc !== 0 || !rawResponse.data || !rawResponse.data.details) {
    return null;
  }

  const details: SSEDetailData[] = [];
  const detailsArray = rawResponse.data.details;

  for (const detailStr of detailsArray) {
    // Format: "14:56:15,8.69,5,1,1"
    // time,price,volume,direction,type
    const parts = detailStr.split(',');
    if (parts.length >= 5) {
      const direction = parseInt(parts[3]) === 1 ? 'buy' : 'sell';
      details.push({
        time: parts[0],
        price: parseFloat(parts[1]) || 0,
        volume: parseInt(parts[2]) || 0,
        direction,
        type: parseInt(parts[4]) || 1,
      });
    }
  }

  return details.length > 0 ? details : null;
}

/**
 * Parse news data from SSE response
 */
export function parseSSENewsData(rawData: string): SSENewsData | null {
  try {
    const data = JSON.parse(rawData);
    if (data.type && typeof data.seq === 'number') {
      return {
        type: data.type,
        seq: data.seq,
        content: data.content || '',
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    logger.warn('Failed to parse SSE news data:', error instanceof Error ? error.message : String(error));
  }
  return null;
}

/**
 * Check if SSE response is a heartbeat (rt=2)
 */
export function isHeartbeat(rawResponse: SSERawResponse): boolean {
  return rawResponse.rt === 2;
}

