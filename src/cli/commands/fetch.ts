import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Market, Timeframe, CrawlerOptions, AdjustmentType } from '../../infra/types.js';
import { FetchOptions } from '../types.js';
import {
  getAdjustmentTypeName,
  validateTimeframe,
  validateDateFormat,
  handleError,
} from '../../utils/utils.js';
import { fetchWithCache } from '../../utils/fetch-helper.js';
import { exportToCSV } from '../../utils/export.js';
import { outputData, outputProgress, OutputFormat } from '../output.js';
import { resolveMarket } from '../market-utils.js';
import { validateFormat, wrapCommandAction } from '../command-utils.js';

/**
 * Handle fetch action
 */
export async function handleFetchAction(options: FetchOptions): Promise<void> {
  // Resolve market (auto-detect or validate provided)
  const { market, marketName } = resolveMarket({
    code: options.code,
    marketOption: options.market,
    quiet: options.quiet,
  });

  // Validate timeframe
  const timeframe = validateTimeframe(options.timeframe || 'daily');

  // Validate date format if provided
  if (options.start) {
    validateDateFormat(options.start, 'Start date');
  }
  if (options.end) {
    validateDateFormat(options.end, 'End date');
  }

  // Validate format
  const format = validateFormat(options.format, 'json');

  // Validate and parse fqt parameter
  let fqt: AdjustmentType = 1; // Default to forward adjustment
  if (options.fqt) {
    const fqtValue = parseInt(options.fqt, 10);
    if (fqtValue !== 0 && fqtValue !== 1 && fqtValue !== 2) {
      throw new Error('FQT must be 0 (none), 1 (forward), or 2 (backward)');
    }
    fqt = fqtValue as AdjustmentType;
  }

  // Build crawler options
  const crawlerOptions: CrawlerOptions = {
    code: options.code,
    market,
    timeframe,
    startDate: options.start,
    endDate: options.end,
    limit: parseInt(options.limit || '1000000', 10),
    fqt,
  };

  const useCache = options.cache !== false; // Default to true, false if --no-cache is used

  // Output progress information to stderr
  outputProgress('Fetching K-line data...', options.quiet);
  outputProgress(`Stock Code: ${options.code}`, options.quiet);
  outputProgress(`Market: ${marketName}`, options.quiet);
  outputProgress(`Timeframe: ${timeframe}`, options.quiet);
  outputProgress(`Adjustment: ${getAdjustmentTypeName(fqt)}`, options.quiet);
  outputProgress(`Cache: ${useCache ? 'enabled' : 'disabled'}`, options.quiet);

  // Fetch data with cache handling
  const data = await fetchWithCache(
    options.code,
    market,
    timeframe,
    crawlerOptions,
    useCache,
    options.start,
    options.end,
    fqt
  );

  if (data.length === 0) {
    outputProgress('No data found for the specified criteria.', options.quiet);
    process.exit(0);
  }

  outputProgress(`Fetched ${data.length} records`, options.quiet);

  // Output data
  if (options.output) {
    const outputPath = options.output;
    // For file output, support CSV format
    if (outputPath.endsWith('.csv')) {
      await exportToCSV(data, outputPath);
      outputProgress(`Data saved to ${outputPath}`, options.quiet);
    } else {
      // For other file formats, use the specified format
      const fileContent = format === 'json' 
        ? JSON.stringify(data, null, 2)
        : format === 'table'
        ? formatKlineTableForFile(data)
        : formatKlineTextForFile(data);
      writeFileSync(outputPath, fileContent, 'utf-8');
      outputProgress(`Data saved to ${outputPath}`, options.quiet);
    }
  } else {
    // Print to stdout using unified output function
    outputData(data, format, { quiet: options.quiet });
  }
}

/**
 * Format K-line data as table for file output
 */
function formatKlineTableForFile(data: any[]): string {
  // Reuse the same formatting logic from output.ts
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
 * Format K-line data as text for file output
 */
function formatKlineTextForFile(data: any[]): string {
  return data.map(item => 
    `${item.date} ${item.open} ${item.close} ${item.high} ${item.low} ${item.volume} ${item.amount}`
  ).join('\n');
}

/**
 * Register fetch command
 */
export function registerFetchCommand(program: Command, commonOptions: any): void {
  const fetchCommand = program
    .command('fetch')
    .description('Fetch K-line data for a stock')
    .alias('f');

  // Apply common options to fetch command
  commonOptions.code(fetchCommand);
  // Market option is optional for fetch (will auto-detect if not provided)
  fetchCommand.option('-m, --market <market>', 'Market code (0=Shenzhen, 1=Shanghai, 105=US, 116=HK). Auto-detected for A-share codes if not provided.');
  commonOptions.timeframe(fetchCommand);
  commonOptions.dateRange(fetchCommand);
  commonOptions.output(fetchCommand);
  commonOptions.logging(fetchCommand);

  fetchCommand
    .option('-l, --limit <number>', 'Maximum records to fetch', '1000000')
    .option('--fqt <0|1|2>', 'Price adjustment type: 0=none, 1=forward, 2=backward (default: 1)')
    .option('--no-cache', 'Bypass cache and fetch fresh data')
    .action(wrapCommandAction(handleFetchAction));
}

