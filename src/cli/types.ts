import { Command } from 'commander';

/**
 * CLI command option types
 */

export type OutputFormat = 'json' | 'table' | 'text';

export interface FetchOptions {
  symbol: string;
  market?: string;
  timeframe?: string;
  start?: string;
  end?: string;
  limit?: string;
  fqt?: string;
  cache?: boolean;
  output?: string;
  format?: OutputFormat;
  verbose?: boolean;
  quiet?: boolean;
}

export interface QuoteOptions {
  symbol: string;
  market?: string;
  format?: OutputFormat;
  verbose?: boolean;
  quiet?: boolean;
}

export interface SyncOptions {
  timeframe?: string;
  start?: string;
  end?: string;
  force?: boolean;
  format?: OutputFormat;
  verbose?: boolean;
  quiet?: boolean;
}

export interface StreamOptions {
  symbol?: string;
  market?: string;
  watchlist?: boolean;
  types?: string;
  format?: OutputFormat;
  fields?: string;
  interval?: number;
  output?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export interface NewsListOptions {
  category?: string;
  pageSize?: string;
  format?: OutputFormat;
  quiet?: boolean;
  verbose?: boolean;
}

export interface NewsStreamOptions {
  format?: OutputFormat;
  quiet?: boolean;
  verbose?: boolean;
}

export interface DetectOptions {
  symbol: string;
  format?: OutputFormat;
  verbose?: boolean;
  quiet?: boolean;
}

/**
 * Common options builder type
 */
export interface CommonOptions {
  market: (cmd: Command) => Command;
  marketOptional?: (cmd: Command) => Command;
  symbol: (cmd: Command) => Command;
  timeframe: (cmd: Command) => Command;
  dateRange: (cmd: Command) => Command;
  output: (cmd: Command) => Command;
  logging: (cmd: Command) => Command;
}

