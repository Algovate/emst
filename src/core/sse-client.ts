import EventSource from 'eventsource';
import {
  SSEConnectionType,
  SSEStreamOptions,
  SSEStreamCallback,
  SSEErrorCallback,
} from '../infra/types.js';
import { getUtToken } from '../utils/sse-utils.js';
import { logger } from '../infra/logger.js';
import { parseSSEResponse, isHeartbeat } from './sse-parser.js';
import { SSEUrlBuilder } from './sse-url-builder.js';
import { SSE_CONSTANTS } from '../infra/sse-constants.js';

/**
 * SSE Client for East Money stock data streaming
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private isClosing = false;
  private lastHeartbeat = Date.now();

  constructor(
    private options: SSEStreamOptions,
    private onMessage: SSEStreamCallback,
    private onError?: SSEErrorCallback
  ) {}


  /**
   * Connect to SSE stream
   */
  async connect(type: SSEConnectionType): Promise<void> {
    if (this.isConnected || this.isClosing) {
      return;
    }

    try {
      // Get UT token
      const utToken = await getUtToken(this.options.code, this.options.market);
      
      // Build URL
      const url = SSEUrlBuilder.buildUrl(type, this.options.code, this.options.market, utToken);
      
      logger.debug(`Connecting to SSE: ${type} for ${this.options.code}`);

      // Create EventSource
      this.eventSource = new EventSource(url, {
        headers: {
          'User-Agent': SSE_CONSTANTS.USER_AGENT,
          'Accept': SSE_CONSTANTS.ACCEPT_HEADER,
          'Cache-Control': SSE_CONSTANTS.CACHE_CONTROL,
        },
      });

      // Handle messages
      this.eventSource.onmessage = (event) => {
        this.lastHeartbeat = Date.now();
        try {
          // News SSE has different format, handle separately
          if (type === SSEConnectionType.NEWS) {
            // For news, pass raw string data
            this.onMessage(event.data as any, type);
          } else {
            const rawResponse = parseSSEResponse(event.data);
            if (rawResponse) {
              // Skip heartbeat messages
              if (isHeartbeat(rawResponse)) {
                return;
              }
              // Call callback with raw response data
              this.onMessage(rawResponse, type);
            }
          }
        } catch (error) {
          logger.warn('Error processing SSE message:', error instanceof Error ? error.message : String(error));
        }
      };

      // Handle connection open
      this.eventSource.onopen = () => {
        logger.info(`SSE connection opened: ${type} for ${this.options.code}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastHeartbeat = Date.now();
      };

      // Handle errors
      this.eventSource.onerror = (error) => {
        logger.warn(`SSE connection error: ${type} for ${this.options.code}`, error);
        this.isConnected = false;

        if (!this.isClosing) {
          this.scheduleReconnect(type);
        }

        if (this.onError) {
          this.onError(
            new Error(`SSE connection error: ${error}`),
            type
          );
        }
      };

    } catch (error) {
      logger.error(`Failed to connect SSE: ${type}`, error instanceof Error ? error.message : String(error));
      if (this.onError) {
        this.onError(
          error instanceof Error ? error : new Error(String(error)),
          type
        );
      }
      throw error;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(type: SSEConnectionType): void {
    if (this.isClosing || this.reconnectTimer) {
      return;
    }

    const maxAttempts = this.options.maxReconnectAttempts || SSE_CONSTANTS.DEFAULT_MAX_RECONNECT_ATTEMPTS;
    if (this.reconnectAttempts >= maxAttempts) {
      logger.error(`Max reconnection attempts reached for ${type}`);
      return;
    }

    const baseInterval = this.options.reconnectInterval || SSE_CONSTANTS.DEFAULT_RECONNECT_INTERVAL;
    const backoffInterval = baseInterval * Math.pow(2, this.reconnectAttempts);
    const interval = Math.min(backoffInterval, SSE_CONSTANTS.MAX_BACKOFF_INTERVAL);

    this.reconnectAttempts++;
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${maxAttempts} in ${interval}ms for ${type}`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isClosing) {
        this.connect(type).catch((error) => {
          logger.error(`Reconnection failed for ${type}:`, error);
        });
      }
    }, interval);
  }

  /**
   * Check heartbeat timeout
   */
  checkHeartbeat(): boolean {
    const timeout = this.options.heartbeatTimeout || SSE_CONSTANTS.DEFAULT_HEARTBEAT_TIMEOUT;
    const elapsed = Date.now() - this.lastHeartbeat;
    
    if (elapsed > timeout && this.isConnected) {
      logger.warn(`Heartbeat timeout for ${this.options.code}, reconnecting...`);
      this.isConnected = false;
      return false;
    }
    return true;
  }

  /**
   * Close SSE connection
   */
  close(): void {
    this.isClosing = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    logger.debug(`SSE connection closed for ${this.options.code}`);
  }

  /**
   * Check if connection is active
   */
  isActive(): boolean {
    return this.isConnected && !this.isClosing;
  }
}

