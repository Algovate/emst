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
import { SSEMessageHandler } from './sse-message-handler.js';
import { logger } from '../infra/logger.js';
import { SSE_CONSTANTS } from '../infra/sse-constants.js';
import { hasField, calculatePriceChange } from '../utils/utils.js';

/**
 * Stream manager for managing multiple SSE connections
 */
export class SSEStreamManager {
  private clients: Map<string, SSEClient> = new Map();
  private latestData: Map<string, Map<SSEConnectionType, any>> = new Map();
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
  getLatestData(symbol: string, market: Market, type: SSEConnectionType): any {
    const key = this.getStreamKey(symbol, market);
    const stockData = this.latestData.get(key);
    if (!stockData) {
      return null;
    }
    return stockData.get(type) || null;
  }

  /**
   * Get all latest data for a stock
   */
  getAllLatestData(symbol: string, market: Market): Map<SSEConnectionType, any> {
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
    
    // Only update fields that exist in the new data's rawData
    if (hasField('f57', newRawData) || hasField('f43', newRawData) || hasField('f60', newRawData) || hasField('f301', newRawData)) {
      merged.symbol = newData.symbol;
      merged.latestPrice = newData.latestPrice;
    }
    
    if (hasField('f58', newRawData)) {
      merged.name = newData.name;
    }
    
    if (hasField('f107', newRawData)) {
      merged.market = newData.market;
    }
    
    if (hasField('f44', newRawData)) {
      merged.open = newData.open;
    }
    
    if (hasField('f45', newRawData)) {
      merged.previousClose = newData.previousClose;
    }
    
    if (hasField('f46', newRawData)) {
      merged.high = newData.high;
      merged.low = newData.low;
    }
    
    if (hasField('f47', newRawData)) {
      merged.volume = newData.volume;
    }
    
    if (hasField('f48', newRawData)) {
      merged.amount = newData.amount;
    }
    
    if (hasField('f51', newRawData)) {
      merged.buy1Price = newData.buy1Price;
    }
    
    if (hasField('f52', newRawData)) {
      merged.sell1Price = newData.sell1Price;
    }
    
    if (hasField('f161', newRawData)) {
      merged.buy1Volume = newData.buy1Volume;
    }
    
    if (hasField('f162', newRawData)) {
      merged.buy2Volume = newData.buy2Volume;
    }
    
    if (hasField('f163', newRawData)) {
      merged.buy3Volume = newData.buy3Volume;
    }
    
    if (hasField('f164', newRawData)) {
      merged.buy4Volume = newData.buy4Volume;
    }
    
    if (hasField('f167', newRawData)) {
      merged.sell1Volume = newData.sell1Volume;
    }
    
    if (hasField('f168', newRawData)) {
      merged.sell2Volume = newData.sell2Volume;
    }
    
    if (hasField('f169', newRawData)) {
      merged.sell3Volume = newData.sell3Volume;
    }
    
    if (hasField('f170', newRawData)) {
      merged.sell4Volume = newData.sell4Volume;
    }
    
    if (hasField('f84', newRawData) || hasField('f116', newRawData)) {
      merged.totalMarketValue = newData.totalMarketValue;
    }
    
    if (hasField('f85', newRawData) || hasField('f117', newRawData)) {
      merged.circulatingMarketValue = newData.circulatingMarketValue;
    }
    
    if (hasField('f92', newRawData)) {
      merged.volumeRatio = newData.volumeRatio;
    }
    
    if (hasField('f107', newRawData)) {
      merged.turnoverRate = newData.turnoverRate;
    }
    
    if (hasField('f111', newRawData)) {
      merged.peRatio = newData.peRatio;
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
  private cacheData(key: string, type: SSEConnectionType, data: any): void {
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

