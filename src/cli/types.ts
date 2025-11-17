/**
 * CLI command option types
 */

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
  format?: string;
}

export interface QuoteOptions {
  code: string;
  market?: string;
  format?: string;
}

export interface SyncOptions {
  timeframe?: string;
  start?: string;
  end?: string;
  force?: boolean;
}

