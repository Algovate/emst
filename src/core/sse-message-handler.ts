import {
  SSEConnectionType,
  SSEStreamOptions,
  SSERawResponse,
  SSEQuoteData,
  SSETrendData,
  SSEDetailData,
  SSENewsData,
} from '../infra/types.js';
import {
  parseSSEQuoteData,
  parseSSETrendData,
  parseSSEDetailData,
  parseSSENewsData,
} from './sse-parser.js';

/**
 * Type for parsed SSE data
 */
export type ParsedSSEData = SSEQuoteData | SSETrendData[] | SSEDetailData[] | SSENewsData | null;

/**
 * Message handler for processing SSE messages
 */
export class SSEMessageHandler {
  /**
   * Parse SSE message based on connection type
   */
  static parseMessage(
    rawData: SSERawResponse | string,
    type: SSEConnectionType,
    options: SSEStreamOptions
  ): ParsedSSEData {
    switch (type) {
      case SSEConnectionType.QUOTE:
        if (typeof rawData !== 'string') {
          return parseSSEQuoteData(rawData, options.symbol, options.market);
        }
        return null;

      case SSEConnectionType.TREND:
        if (typeof rawData !== 'string') {
          return parseSSETrendData(rawData);
        }
        return null;

      case SSEConnectionType.DETAIL:
        if (typeof rawData !== 'string') {
          return parseSSEDetailData(rawData);
        }
        return null;

      case SSEConnectionType.NEWS:
        if (typeof rawData === 'string') {
          return parseSSENewsData(rawData);
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Check if raw data is valid for the given connection type
   */
  static isValidDataType(rawData: SSERawResponse | string, type: SSEConnectionType): boolean {
    if (type === SSEConnectionType.NEWS) {
      return typeof rawData === 'string';
    }
    return typeof rawData !== 'string';
  }
}

