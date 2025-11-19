import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Market, AdjustmentType } from './types.js';
import { logger } from './logger.js';

/**
 * Configuration interface
 */
export interface Config {
  api?: {
    token?: string;
    timeout?: number;
    baseUrl?: string;
    realtimeUrl?: string;
  };
  browser?: {
    enabled?: boolean;
    headless?: boolean;
    refererWaitMs?: number;
    refererTimeoutMs?: number;
    apiTimeoutMs?: number;
  };
  cache?: {
    maxAge?: number; // milliseconds
    dir?: string;
  };
  defaults?: {
    market?: Market;
    timeframe?: string;
    fqt?: AdjustmentType;
    limit?: number;
  };
  sync?: {
    maxConcurrency?: number;
    retryAttempts?: number;
    retryDelay?: number; // milliseconds
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console?: boolean;
  };
}

const CONFIG_DIR = join(process.cwd(), '.emst');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  api: {
    // token is optional - API works without it
    // token: undefined,
    timeout: 60000,
    baseUrl: 'https://push2his.eastmoney.com/api/qt/stock/kline/get',
    realtimeUrl: 'https://push2.eastmoney.com/api/qt/stock/get',
  },
  browser: {
    enabled: process.env.USE_BROWSER === 'true',
    headless: true,
    refererWaitMs: 2000,
    refererTimeoutMs: 60000,
    apiTimeoutMs: 30000,
  },
  cache: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    dir: join(process.cwd(), '.emst', 'cache'),
  },
  defaults: {
    market: Market.Shanghai,
    timeframe: 'daily',
    fqt: 1, // forward adjustment
    limit: 1000000,
  },
  sync: {
    maxConcurrency: 3,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  logging: {
    level: 'info',
    file: undefined,
    console: true,
  },
};

/**
 * Load configuration from file
 */
function loadConfigFile(): Partial<Config> {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Partial<Config>;
  } catch (error) {
    logger.warn(`Failed to load config file: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): Partial<Config> {
  const envConfig: Partial<Config> = {};

  // API config
  if (process.env.EMST_API_TOKEN) {
    envConfig.api = { ...envConfig.api, token: process.env.EMST_API_TOKEN };
  }
  if (process.env.EMST_API_TIMEOUT) {
    envConfig.api = { ...envConfig.api, timeout: parseInt(process.env.EMST_API_TIMEOUT, 10) };
  }

  // Browser config
  if (process.env.USE_BROWSER !== undefined) {
    envConfig.browser = { ...envConfig.browser, enabled: process.env.USE_BROWSER === 'true' };
  }

  // Cache config
  if (process.env.EMST_CACHE_MAX_AGE) {
    envConfig.cache = { ...envConfig.cache, maxAge: parseInt(process.env.EMST_CACHE_MAX_AGE, 10) };
  }

  // Defaults
  if (process.env.EMST_DEFAULT_MARKET) {
    const market = parseInt(process.env.EMST_DEFAULT_MARKET, 10);
    if ([Market.Shenzhen, Market.Shanghai, Market.US, Market.US_ETF, Market.HongKong].includes(market as Market)) {
      envConfig.defaults = { ...envConfig.defaults, market: market as Market };
    }
  }
  if (process.env.EMST_DEFAULT_FQT) {
    const fqt = parseInt(process.env.EMST_DEFAULT_FQT, 10);
    if ([0, 1, 2].includes(fqt)) {
      envConfig.defaults = { ...envConfig.defaults, fqt: fqt as AdjustmentType };
    }
  }

  // Logging
  if (process.env.EMST_LOG_LEVEL) {
    const level = process.env.EMST_LOG_LEVEL.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      envConfig.logging = { 
        ...envConfig.logging, 
        level: level as 'debug' | 'info' | 'warn' | 'error'
      };
    }
  }
  if (process.env.EMST_LOG_FILE) {
    envConfig.logging = { ...envConfig.logging, file: process.env.EMST_LOG_FILE };
  }

  return envConfig;
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || ({} as T[Extract<keyof T, string>]), source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key] as T[Extract<keyof T, string>];
    }
  }
  return result;
}

/**
 * Get merged configuration
 */
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const fileConfig = loadConfigFile();
  const envConfig = loadConfigFromEnv();
  
  // Merge: default < file < env (env has highest priority)
  cachedConfig = deepMerge(DEFAULT_CONFIG, deepMerge(fileConfig, envConfig));
  
  return cachedConfig;
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<Config>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const currentConfig = loadConfigFile();
  const mergedConfig = deepMerge(currentConfig, config);

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2), 'utf-8');
    cachedConfig = null; // Invalidate cache
  } catch (error) {
    throw new Error(
      `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    try {
      writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2), 'utf-8');
      cachedConfig = null;
    } catch (error) {
      throw new Error(
        `Failed to reset config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

