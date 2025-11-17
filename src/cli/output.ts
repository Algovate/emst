import { KlineData, RealtimeQuote } from '../infra/types.js';
import { formatQuoteTable } from '../utils/utils.js';
import { logger } from '../infra/logger.js';

export type OutputFormat = 'json' | 'table' | 'text';

export interface OutputOptions {
  quiet?: boolean;
  format?: OutputFormat;
  marketName?: string; // For quote formatting
}

/**
 * Output data to stdout (separated from progress logs)
 * This function outputs actual data, not progress information
 */
export function outputData(data: any, format: OutputFormat = 'json', options: OutputOptions = {}): void {
  // In quiet mode, don't output data
  if (options.quiet) {
    return;
  }

  let output: string;

  switch (format) {
    case 'json':
      output = JSON.stringify(data, null, 2);
      break;
    case 'table':
      // For table format, try to format based on data type
      if (Array.isArray(data) && data.length > 0) {
        output = formatKlineTable(data);
      } else if (data && typeof data === 'object' && 'code' in data && 'latestPrice' in data) {
        // Realtime quote
        output = formatQuoteTable(data as RealtimeQuote, options.marketName || '');
      } else {
        // Fallback to JSON
        output = JSON.stringify(data, null, 2);
      }
      break;
    case 'text':
      // Simple text format
      if (Array.isArray(data)) {
        output = formatKlineText(data);
      } else if (data && typeof data === 'object') {
        output = formatObjectText(data);
      } else {
        output = String(data);
      }
      break;
    default:
      output = JSON.stringify(data, null, 2);
  }

  // Output to stdout (not stderr)
  process.stdout.write(output + '\n');
}

/**
 * Output progress information to stderr (via logger)
 */
export function outputProgress(message: string, quiet?: boolean): void {
  if (!quiet) {
    logger.info(message);
  }
}

/**
 * Output raw string to stdout (for special cases like stream or formatted text)
 */
export function outputRaw(data: string, quiet?: boolean): void {
  if (!quiet) {
    process.stdout.write(data);
  }
}

/**
 * Format K-line data as table
 */
function formatKlineTable(data: KlineData[]): string {
  if (data.length === 0) {
    return 'No data';
  }

  const lines: string[] = [];
  lines.push('Date       | Open     | Close    | High     | Low      | Volume      | Amount');
  lines.push('─'.repeat(80));

  for (const item of data) {
    const date = item.date.padEnd(10);
    const open = item.open.toFixed(2).padStart(8);
    const close = item.close.toFixed(2).padStart(8);
    const high = item.high.toFixed(2).padStart(8);
    const low = item.low.toFixed(2).padStart(8);
    const volume = item.volume.toLocaleString().padStart(12);
    const amount = item.amount.toLocaleString().padStart(12);
    lines.push(`${date} | ${open} | ${close} | ${high} | ${low} | ${volume} | ${amount}`);
  }

  return lines.join('\n');
}

/**
 * Format K-line data as simple text
 */
function formatKlineText(data: KlineData[]): string {
  return data.map(item => 
    `${item.date} ${item.open} ${item.close} ${item.high} ${item.low} ${item.volume} ${item.amount}`
  ).join('\n');
}

/**
 * Format object as simple text
 */
function formatObjectText(obj: any): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}

