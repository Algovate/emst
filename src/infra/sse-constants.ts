import { USER_AGENT } from './constants.js';

/**
 * SSE-related constants
 */
export const SSE_CONSTANTS = {
  // Reconnection settings
  DEFAULT_RECONNECT_INTERVAL: 5000, // 5 seconds
  DEFAULT_MAX_RECONNECT_ATTEMPTS: 10,
  DEFAULT_HEARTBEAT_TIMEOUT: 30000, // 30 seconds
  MAX_BACKOFF_INTERVAL: 60000, // 60 seconds

  // Heartbeat monitoring
  HEARTBEAT_CHECK_INTERVAL: 10000, // 10 seconds

  // EventSource headers
  USER_AGENT: USER_AGENT,
  ACCEPT_HEADER: 'text/event-stream',
  CACHE_CONTROL: 'no-cache',

  // Default UT token (fallback)
  DEFAULT_UT_TOKEN: 'fa5fd1943c7b386f172d6893dbfba10b',
} as const;

