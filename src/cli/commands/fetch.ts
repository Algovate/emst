import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Market, Timeframe, CrawlerOptions, AdjustmentType } from '../../infra/types.js';
import { FetchOptions } from '../types.js';
import {
  validateMarketAndCode,
  getMarketName,
  getAdjustmentTypeName,
  validateTimeframe,
  validateDateFormat,
  handleError,
  detectMarketFromCode,
} from '../../utils/utils.js';
import { fetchWithCache } from '../../utils/fetch-helper.js';
import { exportToCSV } from '../../utils/export.js';
import { logger } from '../../infra/logger.js';

/**
 * Handle fetch action
 */
export async function handleFetchAction(options: FetchOptions): Promise<void> {
  // Auto-detect market for A-share codes if not provided
  let market: Market;
  const detectedMarket = detectMarketFromCode(options.code);
  
  if (options.market) {
    // User provided market, validate it
    market = validateMarketAndCode(options.code, options.market);
    
    // Warn if provided market doesn't match auto-detected market (for A-share)
    if (detectedMarket !== null && market !== detectedMarket) {
      logger.warn(`Warning: Provided market ${getMarketName(market)} doesn't match auto-detected market ${getMarketName(detectedMarket)} for code ${options.code}. Using provided market.`);
    }
  } else {
    // No market provided, try to auto-detect
    if (detectedMarket !== null) {
      // A-share code, auto-detect successful
      market = detectedMarket;
      logger.info(`Auto-detected market: ${getMarketName(market)}`);
    } else {
      // Cannot auto-detect (HK or US stock), default to Shanghai
      market = validateMarketAndCode(options.code, '1');
      logger.info(`Using default market: ${getMarketName(market)} (cannot auto-detect for code ${options.code})`);
    }
  }

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
  const format = options.format || 'json';
  if (format !== 'json' && format !== 'csv') {
    throw new Error('Format must be "json" or "csv"');
  }

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

  logger.info('Fetching K-line data...');
  logger.info(`Stock Code: ${options.code}`);
  logger.info(`Market: ${getMarketName(market)}`);
  logger.info(`Timeframe: ${timeframe}`);
  logger.info(`Adjustment: ${getAdjustmentTypeName(fqt)}`);
  logger.info(`Cache: ${useCache ? 'enabled' : 'disabled'}`);

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
    logger.info('No data found for the specified criteria.');
    process.exit(0);
  }

  logger.info(`Fetched ${data.length} records`);

  // Output data
  if (options.output) {
    const outputPath = options.output;
    if (format === 'json') {
      writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info(`Data saved to ${outputPath}`);
    } else {
      await exportToCSV(data, outputPath);
      logger.info(`Data saved to ${outputPath}`);
    }
  } else {
    // Print to stdout
    if (format === 'json') {
      logger.info(JSON.stringify(data, null, 2));
    } else {
      // For CSV, we need to write to a temp file or format manually
      const tempPath = join(process.cwd(), `emst_${options.code}_${Date.now()}.csv`);
      await exportToCSV(data, tempPath);
      logger.info(`Data saved to ${tempPath}`);
    }
  }
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

  fetchCommand
    .option('-l, --limit <number>', 'Maximum records to fetch', '1000000')
    .option('--fqt <0|1|2>', 'Price adjustment type: 0=none, 1=forward, 2=backward (default: 1)')
    .option('--no-cache', 'Bypass cache and fetch fresh data')
    .action(async (options: FetchOptions) => {
      try {
        await handleFetchAction(options);
      } catch (error) {
        handleError(error);
      }
    });
}

