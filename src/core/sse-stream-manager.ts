import {
  SSEConnectionType,
  SSEStreamOptions,
  SSEStreamCallback,
  SSEErrorCallback,
  SSERawResponse,
  Market,
} from '../infra/types.js';
import { SSEClient } from './sse-client.js';
import { SSEMessageHandler } from './sse-message-handler.js';
import { logger } from '../infra/logger.js';
import { SSE_CONSTANTS } from '../infra/sse-constants.js';

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
    const key = this.getStreamKey(options.code, options.market);
    const types = options.types || [SSEConnectionType.QUOTE];

    // Create message handler that parses and caches data
    const messageHandler: SSEStreamCallback<SSERawResponse | string> = (rawData: SSERawResponse | string, type: SSEConnectionType) => {
      try {
        if (!SSEMessageHandler.isValidDataType(rawData, type)) {
          return;
        }

        const parsedData = SSEMessageHandler.parseMessage(rawData, type, options);
        
        if (parsedData) {
          this.cacheData(key, type, parsedData);
          // Call onData with parsed data (which can be any type)
          (onData as any)(parsedData, type);
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
      logger.error(`SSE error for ${options.code} (${type}):`, error);
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
        logger.error(`Failed to connect ${type} for ${options.code}:`, error);
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
  stopStream(code: string, market: Market): void {
    const key = this.getStreamKey(code, market);
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
  getLatestData(code: string, market: Market, type: SSEConnectionType): any {
    const key = this.getStreamKey(code, market);
    const stockData = this.latestData.get(key);
    if (!stockData) {
      return null;
    }
    return stockData.get(type) || null;
  }

  /**
   * Get all latest data for a stock
   */
  getAllLatestData(code: string, market: Market): Map<SSEConnectionType, any> {
    const key = this.getStreamKey(code, market);
    return this.latestData.get(key) || new Map();
  }

  /**
   * Check if stream is active for a stock
   */
  isStreamActive(code: string, market: Market, type?: SSEConnectionType): boolean {
    const key = this.getStreamKey(code, market);
    
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
  private getStreamKey(code: string, market: Market): string {
    return `${market}:${code}`;
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

