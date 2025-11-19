import {
  SSEConnectionType,
  SSEStreamOptions,
  SSEStreamCallback,
  SSEErrorCallback,
  SSERawResponse,
  Market,
  SSEQuoteData,
} from '../infra/types.js';
import { SSEClient } from './sse-client.js';
import { SSEMessageHandler, ParsedSSEData } from './sse-message-handler.js';
import { logger } from '../infra/logger.js';
import { SSE_CONSTANTS } from '../infra/sse-constants.js';
import { hasField, calculatePriceChange } from '../utils/utils.js';

/**
 * Stream manager for managing multiple SSE connections
 */
export class SSEStreamManager {
  private clients: Map<string, SSEClient> = new Map();
  private latestData: Map<string, Map<SSEConnectionType, ParsedSSEData>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start streaming for a stock
   */
  async startStream(
    options: SSEStreamOptions,
    onData: SSEStreamCallback<any>,
    onError?: SSEErrorCallback
  ): Promise<void> {
    const key = this.getStreamKey(options.symbol, options.market);
    const types = options.types || [SSEConnectionType.QUOTE];

    // Create message handler that parses and caches data
    const messageHandler: SSEStreamCallback<SSERawResponse | string> = (rawData: SSERawResponse | string, type: SSEConnectionType) => {
      try {
        if (!SSEMessageHandler.isValidDataType(rawData, type)) {
          return;
        }

        const parsedData = SSEMessageHandler.parseMessage(rawData, type, options);

        if (parsedData) {
          // For quote data, merge with cached data if available
          if (type === SSEConnectionType.QUOTE) {
            const cachedData = this.getLatestData(options.symbol, options.market, type);
            if (cachedData) {
              // Merge partial update with cached data
              const mergedData = this.mergeQuoteData(cachedData as SSEQuoteData, parsedData as SSEQuoteData);
              this.cacheData(key, type, mergedData);
              // Call onData with merged data
              (onData as any)(mergedData, type);
            } else {
              // First message, no merge needed
              this.cacheData(key, type, parsedData);
              (onData as any)(parsedData, type);
            }
          } else {
            // For other types, just cache and forward
            this.cacheData(key, type, parsedData);
            (onData as any)(parsedData, type);
          }
        }
      } catch (error) {
        logger.error('Error processing SSE data:', error);
        if (onError) {
          onError(
            error instanceof Error ? error : new Error(String(error)),
            type
          );
        }
      }
    };

    // Create error handler
    const errorHandler: SSEErrorCallback = (error, type) => {
      logger.error(`SSE error for ${options.symbol} (${type}):`, error);
      if (onError) {
        onError(error, type);
      }
    };

    // Create and connect clients for each type
    for (const type of types) {
      const clientKey = `${key}:${type}`;

      if (this.clients.has(clientKey)) {
        logger.warn(`Client already exists for ${clientKey}, skipping`);
        continue;
      }

      const client = new SSEClient(options, messageHandler, errorHandler);
      this.clients.set(clientKey, client);

      try {
        await client.connect(type);
      } catch (error) {
        logger.error(`Failed to connect ${type} for ${options.symbol}:`, error);
        this.clients.delete(clientKey);
        throw error;
      }
    }

    // Start heartbeat monitoring if not already running
    if (!this.isRunning) {
      this.startHeartbeatMonitoring();
    }
  }

  /**
   * Stop streaming for a stock
   */
  stopStream(symbol: string, market: Market): void {
    const key = this.getStreamKey(symbol, market);
    const keysToRemove: string[] = [];

    for (const [clientKey, client] of this.clients.entries()) {
      if (clientKey.startsWith(`${key}:`)) {
        client.close();
        keysToRemove.push(clientKey);
      }
    }

    for (const clientKey of keysToRemove) {
      this.clients.delete(clientKey);
    }

    this.latestData.delete(key);

    // Stop heartbeat if no clients left
    if (this.clients.size === 0) {
      this.stopHeartbeatMonitoring();
    }
  }

  /**
   * Stop all streams
   */
  stopAll(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
    this.latestData.clear();
    this.stopHeartbeatMonitoring();
  }

  /**
   * Get latest cached data for a stock
   */
  getLatestData(symbol: string, market: Market, type: SSEConnectionType): ParsedSSEData | undefined {
    const key = this.getStreamKey(symbol, market);
    const stockData = this.latestData.get(key);
    if (!stockData) {
      return undefined;
    }
    return stockData.get(type);
  }

  /**
   * Get all latest data for a stock
   */
  getAllLatestData(symbol: string, market: Market): Map<SSEConnectionType, ParsedSSEData> {
    const key = this.getStreamKey(symbol, market);
    return this.latestData.get(key) || new Map();
  }

  /**
   * Check if stream is active for a stock
   */
  isStreamActive(symbol: string, market: Market, type?: SSEConnectionType): boolean {
    const key = this.getStreamKey(symbol, market);

    if (type) {
      const clientKey = `${key}:${type}`;
      const client = this.clients.get(clientKey);
      return client ? client.isActive() : false;
    }

    // Check if any type is active
    for (const [clientKey, client] of this.clients.entries()) {
      if (clientKey.startsWith(`${key}:`)) {
        if (client.isActive()) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get stream key
   */
  private getStreamKey(symbol: string, market: Market): string {
    return `${market}:${symbol}`;
  }

  /**
   * Merge partial quote update with cached data
   * Only updates fields that are present in the new data's rawData
   */
  private mergeQuoteData(cached: SSEQuoteData, newData: SSEQuoteData): SSEQuoteData {
    const newRawData = newData.rawData || {};
    const cachedRawData = cached.rawData || {};

    // Start with cached data as base
    const merged: SSEQuoteData = { ...cached };

    // Merge rawData objects
    merged.rawData = { ...cachedRawData, ...newRawData };

    // Field mapping configuration
    const FIELD_MAPPINGS: Record<string, keyof SSEQuoteData | (keyof SSEQuoteData)[]> = {
      f57: 'symbol',
      f43: 'latestPrice',
      f60: 'latestPrice',
      f301: 'latestPrice',
      f58: 'name',
      f107: ['market', 'turnoverRate'],
      f44: 'open',
      f45: 'previousClose',
      f46: ['high', 'low'],
      f47: 'volume',
      f48: 'amount',
      f51: 'buy1Price',
      f52: 'sell1Price',
      f161: 'buy1Volume',
      f162: 'buy2Volume',
      f163: 'buy3Volume',
      f164: 'buy4Volume',
      f167: 'sell1Volume',
      f168: 'sell2Volume',
      f169: 'sell3Volume',
      f170: 'sell4Volume',
      f84: 'totalMarketValue',
      f116: 'totalMarketValue',
      f85: 'circulatingMarketValue',
      f117: 'circulatingMarketValue',
      f92: 'volumeRatio',
      f111: 'peRatio',
    };

    // Update fields based on mapping
    for (const [field, target] of Object.entries(FIELD_MAPPINGS)) {
      if (hasField(field, newRawData)) {
        const targets = Array.isArray(target) ? target : [target];
        for (const t of targets) {
          // @ts-ignore - dynamic assignment
          merged[t] = newData[t];
        }
      }
    }

    // Always update timestamp and svr
    merged.timestamp = newData.timestamp;
    merged.svr = newData.svr;

    // Recalculate changeAmount and changePercent if we have both latestPrice and previousClose
    if (merged.latestPrice !== undefined && merged.previousClose !== undefined) {
      const { changeAmount, changePercent } = calculatePriceChange(merged.latestPrice, merged.previousClose);
      merged.changeAmount = changeAmount;
      merged.changePercent = changePercent;
    }

    return merged;
  }

  /**
   * Cache data
   */
  private cacheData(key: string, type: SSEConnectionType, data: ParsedSSEData): void {
    if (!this.latestData.has(key)) {
      this.latestData.set(key, new Map());
    }
    const stockData = this.latestData.get(key)!;
    stockData.set(type, data);
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.isRunning = true;
    this.heartbeatInterval = setInterval(() => {
      for (const [clientKey, client] of this.clients.entries()) {
        if (!client.checkHeartbeat()) {
          // Heartbeat timeout, will trigger reconnection
          logger.warn(`Heartbeat check failed for ${clientKey}`);
        }
      }
    }, SSE_CONSTANTS.HEARTBEAT_CHECK_INTERVAL);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.isRunning = false;
  }
}

