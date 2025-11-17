/**
 * CLI command option types
 */

export type OutputFormat = 'json' | 'table' | 'text';

export interface FetchOptions {
  code: string;
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
  code: string;
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
  code?: string;
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

