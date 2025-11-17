import { Command } from 'commander';
import { Market, Timeframe, SyncResult, AdjustmentType } from '../../infra/types.js';
import { SyncOptions } from '../types.js';
import {
  getMarketName,
  getMarketHelpText,
  validateTimeframe,
  validateDateFormat,
  handleError,
} from '../../utils/utils.js';
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  checkWatchlistMarkets,
} from '../../storage/watchlist.js';
import { getCacheEntry, getCacheDateRange } from '../../storage/cache.js';
import { syncWatchlist } from '../../storage/sync.js';
import { logger } from '../../infra/logger.js';
import { outputProgress, outputData, outputRaw, OutputFormat } from '../output.js';
import { resolveMarket } from '../market-utils.js';
import { validateFormat, wrapCommandAction } from '../command-utils.js';

/**
 * Register watchlist command group
 */
export function registerWatchlistCommands(program: Command, commonOptions?: any): void {
  const watchlistCommand = program
    .command('watchlist')
    .description('Manage watchlist of stock symbols')
    .alias('wl');

  // Add symbol to watchlist
  const addCommand = watchlistCommand
    .command('add')
    .description('Add a symbol to the watchlist (market will be auto-detected for A-share codes)')
    .alias('a')
    .argument('<code>', 'Stock code (e.g., 688005 for A-share, 00700 for HK, AAPL for US)')
    .option('-m, --market <market>', getMarketHelpText() + ' (optional for A-share codes)');
  
  if (commonOptions) {
    commonOptions.logging(addCommand);
  }
  
  addCommand.action(wrapCommandAction((code: string, options: { market?: string; verbose?: boolean; quiet?: boolean }) => {
      // Resolve market (auto-detect or validate provided, require market for watchlist add)
      const { market, marketName } = resolveMarket({
        code,
        marketOption: options.market,
        quiet: options.quiet,
        requireMarket: true, // Require market for watchlist add
      });
      
      addToWatchlist(code, market);
      outputProgress(`Added ${code} (${marketName}) to watchlist`, options.quiet);
    }));

  // Remove symbol from watchlist
  const removeCommand = watchlistCommand
    .command('remove')
    .description('Remove a symbol from the watchlist')
    .alias('rm')
    .argument('<code>', 'Stock code (e.g., 688005)');
  
  if (commonOptions) {
    commonOptions.logging(removeCommand);
  }
  
  removeCommand.action(wrapCommandAction((code: string, options: { verbose?: boolean; quiet?: boolean }) => {
      const removed = removeFromWatchlist(code);
      if (removed) {
        outputProgress(`Removed ${code} from watchlist`, options.quiet);
      } else {
        throw new Error(`Symbol ${code} not found in watchlist`);
      }
    }));

  // List watchlist
  const listCommand = watchlistCommand
    .command('list')
    .description('List all symbols in the watchlist')
    .alias('ls')
    .option('-i, --info', 'Show detailed information including cache statistics');
  
  if (commonOptions) {
    commonOptions.logging(listCommand);
  }
  
  // Add format option to list command
  if (commonOptions) {
    listCommand.option('-f, --format <format>', 'Output format (json/table/text)', 'text');
  }
  
  listCommand.action(wrapCommandAction((options: { info?: boolean; format?: string; verbose?: boolean; quiet?: boolean }) => {
      const entries = getWatchlist();
      if (entries.length === 0) {
        outputProgress('Watchlist is empty', options.quiet);
        return;
      }

      // Build output data for list command
      const format = validateFormat(options.format, 'text');
        
        if (format === 'json') {
          // JSON format
          const data = entries.map(entry => ({
            code: entry.code,
            market: entry.market,
            marketName: getMarketName(entry.market),
            name: entry.name,
            addedDate: entry.addedDate,
            ...(options.info ? {
              cache: getCacheInfo(entry),
            } : {}),
          }));
          outputData(data, format, { quiet: options.quiet });
        } else {
          // Table or text format - build string output
          let output = '';
          if (options.info) {
            // Show detailed information
            output += `Watchlist (${entries.length} symbols):\n\n`;
            
            const timeframes: readonly Timeframe[] = ['daily', 'weekly', 'monthly', '5min', '15min', '30min', '60min'] as const;
            
            entries.forEach((entry, index) => {
              const marketName = getMarketName(entry.market);
              output += `${index + 1}. ${entry.code} - ${marketName}\n`;
              if (entry.name) {
                output += `   Name: ${entry.name}\n`;
              }
              if (entry.addedDate) {
                output += `   Added: ${entry.addedDate}\n`;
              }
              
              // Show cache information for all fqt types
              output += `   Cache:\n`;
              let hasCache = false;
              const fqtTypes: AdjustmentType[] = [0, 1, 2];
              const fqtNames = ['none', 'forward', 'backward'];
              
              for (const tf of timeframes) {
                let timeframeHasCache = false;
                for (let i = 0; i < fqtTypes.length; i++) {
                  const fqt = fqtTypes[i];
                  const cacheEntry = getCacheEntry(entry.code, entry.market, tf, fqt);
                  if (cacheEntry && cacheEntry.data && cacheEntry.data.length > 0) {
                    if (!timeframeHasCache) {
                      timeframeHasCache = true;
                      hasCache = true;
                    }
                    const dateRange = getCacheDateRange(entry.code, entry.market, tf, fqt);
                    const lastSync = new Date(cacheEntry.lastSync).toLocaleString();
                    const rangeStr = dateRange ? ` (${dateRange.min} to ${dateRange.max})` : '';
                    const fqtLabel = fqt === 1 ? '' : ` [${fqtNames[i]}]`;
                    output += `     ${tf.padEnd(8)}: ${cacheEntry.data.length.toString().padStart(6)} records${fqtLabel}${rangeStr}\n`;
                    output += `              Last sync: ${lastSync}\n`;
                  }
                }
              }
              
              if (!hasCache) {
                output += `     No cached data\n`;
              }
              
              output += '\n';
            });
          } else {
            // Show basic information
            output += `Watchlist (${entries.length} symbols):\n\n`;
            entries.forEach((entry, index) => {
              const marketName = getMarketName(entry.market);
              const name = entry.name ? ` (${entry.name})` : '';
              const addedDate = entry.addedDate ? ` - Added: ${entry.addedDate}` : '';
              output += `${index + 1}. ${entry.code} - ${marketName}${name}${addedDate}\n`;
            });
          }
          
          // Output to stdout (data output)
          outputRaw(output, options.quiet);
        }
    }));

  // Check market codes
  const checkCommand = watchlistCommand
    .command('check')
    .description('Check and validate market codes for all symbols in the watchlist')
    .alias('c');
  
  if (commonOptions) {
    commonOptions.logging(checkCommand);
  }
  
  // Add format option to check command
  if (commonOptions) {
    checkCommand.option('-f, --format <format>', 'Output format (json/table/text)', 'text');
  }
  
  checkCommand.action(wrapCommandAction((options: { format?: string; verbose?: boolean; quiet?: boolean }) => {
      const results = checkWatchlistMarkets();
      
      if (results.length === 0) {
        outputProgress('Watchlist is empty', options.quiet);
        return;
      }

      outputProgress('Checking watchlist markets...\n', options.quiet);

      let correctCount = 0;
      let mismatchCount = 0;
      let cannotDetectCount = 0;

      let checkOutput = '';
      results.forEach((result) => {
        const { entry, detectedMarket, status } = result;
        const currentMarketName = getMarketName(entry.market);
        const codeDisplay = entry.code.padEnd(8);

        if (status === 'correct') {
          checkOutput += `${codeDisplay}: ✓ ${currentMarketName} (correct)\n`;
          correctCount++;
        } else if (status === 'mismatch' && detectedMarket !== null) {
          const expectedMarketName = getMarketName(detectedMarket);
          checkOutput += `${codeDisplay}: ✗ ${currentMarketName} → ${expectedMarketName} (mismatch)\n`;
          mismatchCount++;
        } else {
          // cannot_detect
          checkOutput += `${codeDisplay}: ? ${currentMarketName} (cannot auto-detect)\n`;
          cannotDetectCount++;
        }
      });

      checkOutput += '\n';
      const parts: string[] = [];
      parts.push(`${results.length} checked`);
      if (mismatchCount > 0) {
        parts.push(`${mismatchCount} mismatch${mismatchCount > 1 ? 'es' : ''}`);
      }
      if (cannotDetectCount > 0) {
        parts.push(`${cannotDetectCount} cannot detect`);
      }
      if (mismatchCount === 0 && cannotDetectCount === 0) {
        checkOutput += `Summary: ${parts.join(', ')} - all correct!\n`;
      } else {
        checkOutput += `Summary: ${parts.join(', ')}\n`;
      }
      
      // Output to stdout (data output) using unified function
      const format = validateFormat(options.format, 'text');
        if (format === 'json') {
          const data = results.map(result => ({
            code: result.entry.code,
            market: result.entry.market,
            marketName: getMarketName(result.entry.market),
            status: result.status,
            detectedMarket: result.detectedMarket,
            detectedMarketName: result.detectedMarket ? getMarketName(result.detectedMarket) : null,
          }));
          outputData(data, format, { quiet: options.quiet });
        } else {
          // Table or text format
          outputRaw(checkOutput, options.quiet);
        }
    }));

  // Sync watchlist
  const syncCommand = watchlistCommand
    .command('sync')
    .description('Sync all symbols in the watchlist (syncs all timeframes by default)')
    .alias('s')
    .option(
      '-t, --timeframe <timeframe>',
      'K-line timeframe to sync (daily/weekly/monthly/5min/15min/30min/60min). If not specified, syncs all timeframes.'
    )
    .option('-s, --start <date>', 'Start date (YYYYMMDD)')
    .option('-e, --end <date>', 'End date (YYYYMMDD)')
    .option('--force', 'Force refresh even if cache is valid');
  
  if (commonOptions) {
    commonOptions.logging(syncCommand);
  }
  
  syncCommand.action(wrapCommandAction(async (options: SyncOptions) => {
      // Validate timeframe if provided
      if (options.timeframe) {
        validateTimeframe(options.timeframe);
      }

      // Validate date format if provided
      if (options.start) {
        validateDateFormat(options.start, 'Start date');
      }
      if (options.end) {
        validateDateFormat(options.end, 'End date');
      }

      outputProgress('Syncing watchlist...', options.quiet);
      if (options.timeframe) {
        outputProgress(`Timeframe: ${options.timeframe}`, options.quiet);
      } else {
        outputProgress('Timeframe: all (daily, weekly, monthly, 5min, 15min, 30min, 60min)', options.quiet);
      }
      if (options.start) outputProgress(`Start date: ${options.start}`, options.quiet);
      if (options.end) outputProgress(`End date: ${options.end}`, options.quiet);
      if (options.force) outputProgress('Force refresh: enabled', options.quiet);
      if (!options.quiet) outputProgress('', options.quiet);

      const results = await syncWatchlist({
        timeframe: options.timeframe ? (options.timeframe as Timeframe) : undefined,
        startDate: options.start,
        endDate: options.end,
        force: options.force,
      });

      if (results.length === 0) {
        outputProgress('Watchlist is empty', options.quiet);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Group results by symbol for better display
      const resultsBySymbol = new Map<string, SyncResult[]>();
      for (const result of results) {
        const key = `${result.symbol}_${result.market}`;
        if (!resultsBySymbol.has(key)) {
          resultsBySymbol.set(key, []);
        }
        resultsBySymbol.get(key)!.push(result);
      }

      for (const [key, symbolResults] of resultsBySymbol) {
        const firstResult = symbolResults[0];
        const marketName = getMarketName(firstResult.market);
        
        outputProgress(`${firstResult.symbol} (${marketName}):`, options.quiet);
        
        for (const result of symbolResults) {
          if (result.success) {
            const tf = result.timeframe || 'unknown';
            outputProgress(`  ✓ ${tf}: ${result.recordsFetched || 0} records`, options.quiet);
            successCount++;
          } else {
            const tf = result.timeframe || 'unknown';
            logger.error(`  ✗ ${tf}: ${result.error || 'Unknown error'}`);
            failCount++;
          }
        }
        if (!options.quiet) {
          outputProgress('', options.quiet);
        }
      }

      outputProgress(`Sync complete: ${successCount} succeeded, ${failCount} failed`, options.quiet);
    }));
}

/**
 * Get cache information for a watchlist entry
 */
function getCacheInfo(entry: { code: string; market: Market }): Record<string, any> {
  const timeframes: readonly Timeframe[] = ['daily', 'weekly', 'monthly', '5min', '15min', '30min', '60min'] as const;
  const fqtTypes: AdjustmentType[] = [0, 1, 2];
  const fqtNames = ['none', 'forward', 'backward'];
  const cache: Record<string, any> = {};

  for (const tf of timeframes) {
    const tfCache: any[] = [];
    for (let i = 0; i < fqtTypes.length; i++) {
      const fqt = fqtTypes[i];
      const cacheEntry = getCacheEntry(entry.code, entry.market, tf, fqt);
      if (cacheEntry && cacheEntry.data && cacheEntry.data.length > 0) {
        const dateRange = getCacheDateRange(entry.code, entry.market, tf, fqt);
        tfCache.push({
          fqt: fqtNames[i],
          records: cacheEntry.data.length,
          dateRange: dateRange ? { min: dateRange.min, max: dateRange.max } : null,
          lastSync: cacheEntry.lastSync,
        });
      }
    }
    if (tfCache.length > 0) {
      cache[tf] = tfCache;
    }
  }

  return cache;
}

