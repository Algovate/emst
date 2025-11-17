import { Command } from 'commander';
import { Market, Timeframe, SyncResult, AdjustmentType } from '../../infra/types.js';
import { SyncOptions } from '../types.js';
import {
  getMarketName,
  getMarketHelpText,
  validateMarketAndCode,
  detectMarketFromCode,
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

/**
 * Register watchlist command group
 */
export function registerWatchlistCommands(program: Command): void {
  const watchlistCommand = program
    .command('watchlist')
    .description('Manage watchlist of stock symbols')
    .alias('wl');

  // Add symbol to watchlist
  watchlistCommand
    .command('add')
    .description('Add a symbol to the watchlist (market will be auto-detected for A-share codes)')
    .alias('a')
    .argument('<code>', 'Stock code (e.g., 688005 for A-share, 00700 for HK, AAPL for US)')
    .option('-m, --market <market>', getMarketHelpText() + ' (optional for A-share codes)')
    .action((code: string, options: { market?: string }) => {
      try {
        // Auto-detect market for A-share codes if not provided
        let market: Market;
        const detectedMarket = detectMarketFromCode(code);
        
        if (options.market) {
          // User provided market, validate it
          market = validateMarketAndCode(code, options.market);
          
          // Warn if provided market doesn't match auto-detected market (for A-share)
          if (detectedMarket && market !== detectedMarket) {
            logger.warn(`Warning: Provided market ${getMarketName(market)} doesn't match auto-detected market ${getMarketName(detectedMarket)} for code ${code}. Using provided market.`);
          }
        } else {
          // No market provided, try to auto-detect
          if (detectedMarket !== null) {
            // A-share code, auto-detect successful
            market = detectedMarket;
            logger.info(`Auto-detected market: ${getMarketName(market)}`);
          } else {
            // Cannot auto-detect (HK or US stock), require market to be specified
            throw new Error(
              `Cannot auto-detect market for code ${code}. ` +
              `Please specify market using -m option. ${getMarketHelpText()}`
            );
          }
        }
        
        addToWatchlist(code, market);
        logger.info(`Added ${code} (${getMarketName(market)}) to watchlist`);
      } catch (error) {
        handleError(error);
      }
    });

  // Remove symbol from watchlist
  watchlistCommand
    .command('remove')
    .description('Remove a symbol from the watchlist')
    .alias('rm')
    .argument('<code>', 'Stock code (e.g., 688005)')
    .action((code: string) => {
      try {
        const removed = removeFromWatchlist(code);
        if (removed) {
          logger.info(`Removed ${code} from watchlist`);
        } else {
          handleError(new Error(`Symbol ${code} not found in watchlist`));
        }
      } catch (error) {
        handleError(error);
      }
    });

  // List watchlist
  watchlistCommand
    .command('list')
    .description('List all symbols in the watchlist')
    .alias('ls')
    .option('-i, --info', 'Show detailed information including cache statistics')
    .action((options: { info?: boolean }) => {
      try {
        const entries = getWatchlist();
        if (entries.length === 0) {
          logger.info('Watchlist is empty');
          return;
        }

        if (options.info) {
          // Show detailed information
          logger.info(`Watchlist (${entries.length} symbols):`);
          logger.info('');
          
          const timeframes: readonly Timeframe[] = ['daily', 'weekly', 'monthly', '5min', '15min', '30min', '60min'] as const;
          
          entries.forEach((entry, index) => {
            const marketName = getMarketName(entry.market);
            logger.info(`${index + 1}. ${entry.code} - ${marketName}`);
            if (entry.name) {
              logger.info(`   Name: ${entry.name}`);
            }
            if (entry.addedDate) {
              logger.info(`   Added: ${entry.addedDate}`);
            }
            
            // Show cache information for all fqt types
            logger.info(`   Cache:`);
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
                  logger.info(`     ${tf.padEnd(8)}: ${cacheEntry.data.length.toString().padStart(6)} records${fqtLabel}${rangeStr}`);
                  logger.info(`              Last sync: ${lastSync}`);
                }
              }
            }
            
            if (!hasCache) {
              logger.info(`     No cached data`);
            }
            
            logger.info('');
          });
        } else {
          // Show basic information
          logger.info(`Watchlist (${entries.length} symbols):`);
          logger.info('');
          entries.forEach((entry, index) => {
            const marketName = getMarketName(entry.market);
            const name = entry.name ? ` (${entry.name})` : '';
            const addedDate = entry.addedDate ? ` - Added: ${entry.addedDate}` : '';
            logger.info(`${index + 1}. ${entry.code} - ${marketName}${name}${addedDate}`);
          });
        }
      } catch (error) {
        handleError(error);
      }
    });

  // Check market codes
  watchlistCommand
    .command('check')
    .description('Check and validate market codes for all symbols in the watchlist')
    .alias('c')
    .action(() => {
      try {
        const results = checkWatchlistMarkets();
        
        if (results.length === 0) {
          logger.info('Watchlist is empty');
          return;
        }

        logger.info('Checking watchlist markets...\n');

        let correctCount = 0;
        let mismatchCount = 0;
        let cannotDetectCount = 0;

        results.forEach((result) => {
          const { entry, detectedMarket, status } = result;
          const currentMarketName = getMarketName(entry.market);
          const codeDisplay = entry.code.padEnd(8);

          if (status === 'correct') {
            logger.info(`${codeDisplay}: ✓ ${currentMarketName} (correct)`);
            correctCount++;
          } else if (status === 'mismatch' && detectedMarket !== null) {
            const expectedMarketName = getMarketName(detectedMarket);
            logger.info(`${codeDisplay}: ✗ ${currentMarketName} → ${expectedMarketName} (mismatch)`);
            mismatchCount++;
          } else {
            // cannot_detect
            logger.info(`${codeDisplay}: ? ${currentMarketName} (cannot auto-detect)`);
            cannotDetectCount++;
          }
        });

        logger.info('');
        const parts: string[] = [];
        parts.push(`${results.length} checked`);
        if (mismatchCount > 0) {
          parts.push(`${mismatchCount} mismatch${mismatchCount > 1 ? 'es' : ''}`);
        }
        if (cannotDetectCount > 0) {
          parts.push(`${cannotDetectCount} cannot detect`);
        }
        if (mismatchCount === 0 && cannotDetectCount === 0) {
          logger.info(`Summary: ${parts.join(', ')} - all correct!`);
        } else {
          logger.info(`Summary: ${parts.join(', ')}`);
        }
      } catch (error) {
        handleError(error);
      }
    });

  // Sync watchlist
  watchlistCommand
    .command('sync')
    .description('Sync all symbols in the watchlist (syncs all timeframes by default)')
    .alias('s')
    .option(
      '-t, --timeframe <timeframe>',
      'K-line timeframe to sync (daily/weekly/monthly/5min/15min/30min/60min). If not specified, syncs all timeframes.'
    )
    .option('-s, --start <date>', 'Start date (YYYYMMDD)')
    .option('-e, --end <date>', 'End date (YYYYMMDD)')
    .option('--force', 'Force refresh even if cache is valid')
    .action(async (options: SyncOptions) => {
      try {
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

        logger.info('Syncing watchlist...');
        if (options.timeframe) {
          logger.info(`Timeframe: ${options.timeframe}`);
        } else {
          logger.info('Timeframe: all (daily, weekly, monthly, 5min, 15min, 30min, 60min)');
        }
        if (options.start) logger.info(`Start date: ${options.start}`);
        if (options.end) logger.info(`End date: ${options.end}`);
        if (options.force) logger.info('Force refresh: enabled');
        logger.info('');

        const results = await syncWatchlist({
          timeframe: options.timeframe ? (options.timeframe as Timeframe) : undefined,
          startDate: options.start,
          endDate: options.end,
          force: options.force,
        });

        if (results.length === 0) {
          logger.info('Watchlist is empty');
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
          
          logger.info(`${firstResult.symbol} (${marketName}):`);
          
          for (const result of symbolResults) {
            if (result.success) {
              const tf = result.timeframe || 'unknown';
              logger.info(`  ✓ ${tf}: ${result.recordsFetched || 0} records`);
              successCount++;
            } else {
              const tf = result.timeframe || 'unknown';
              logger.error(`  ✗ ${tf}: ${result.error || 'Unknown error'}`);
              failCount++;
            }
          }
          logger.info('');
        }

        logger.info(`Sync complete: ${successCount} succeeded, ${failCount} failed`);
      } catch (error) {
        handleError(error);
      }
    });
}

