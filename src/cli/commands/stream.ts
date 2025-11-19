import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { Market, SSEConnectionType, SSEQuoteData, SSETrendData, SSEDetailData } from '../../infra/types.js';
import { getMarketName } from '../../utils/utils.js';
import { logger } from '../../infra/logger.js';
import { getWatchlist } from '../../storage/watchlist.js';
import { formatSSEQuote, formatTrendData, formatDetailData } from '../../utils/sse-formatters.js';
import { StreamOptions, CommonOptions } from '../types.js';
import { outputProgress, outputRaw, OutputFormat } from '../output.js';
import { resolveMarket } from '../market-utils.js';
import { validateFormat, wrapCommandAction, getFormatOptionHelp, applyFormatAndLoggingOptions } from '../command-utils.js';

/**
 * Parse connection types from string
 */
function parseConnectionTypes(typesStr?: string): SSEConnectionType[] {
  if (!typesStr) {
    return [SSEConnectionType.QUOTE];
  }

  const typeMap: Record<string, SSEConnectionType> = {
    quote: SSEConnectionType.QUOTE,
    trend: SSEConnectionType.TREND,
    detail: SSEConnectionType.DETAIL,
    news: SSEConnectionType.NEWS,
  };

  const types = typesStr.split(',').map(t => t.trim().toLowerCase());
  const result: SSEConnectionType[] = [];

  for (const type of types) {
    if (typeMap[type]) {
      result.push(typeMap[type]);
    } else {
      logger.warn(`Unknown connection type: ${type}, skipping`);
    }
  }

  return result.length > 0 ? result : [SSEConnectionType.QUOTE];
}

/**
 * Format SSE data based on type
 */
function formatSSEData(data: any, type: SSEConnectionType): string {
  switch (type) {
    case SSEConnectionType.QUOTE:
      return formatSSEQuote(data as SSEQuoteData);
    case SSEConnectionType.TREND:
      return formatTrendData(data as SSETrendData[]);
    case SSEConnectionType.DETAIL:
      return formatDetailData(data as SSEDetailData[]);
    default:
      return JSON.stringify(data);
  }
}

/**
 * Create data callback handler for stream command
 * Uses raw output for real-time streaming
 */
function createDataHandler(
  format: OutputFormat,
  symbol: string,
  quiet: boolean,
  market?: Market
): (data: any, type: SSEConnectionType) => void {
  return (data: any, type: SSEConnectionType) => {
    if (quiet) {
      return; // Don't output data in quiet mode
    }

    let output: string;

    if (format === 'json') {
      const jsonOutput: any = { symbol, type, data, timestamp: Date.now() };
      if (market !== undefined) {
        jsonOutput.market = market;
      }
      output = JSON.stringify(jsonOutput, null, 2) + '\n';
    } else if (format === 'table') {
      const formatted = formatSSEData(data, type);
      const prefix = market !== undefined ? `[${symbol}]` : '';
      output = `\n${prefix} ${type.toUpperCase()}:\n${formatted}\n\n`;
    } else {
      // text format - simplified output
      const formatted = formatSSEData(data, type);
      const prefix = market !== undefined ? `[${symbol}]` : '';
      output = `${prefix} ${type.toUpperCase()}: ${formatted}\n`;
    }

    outputRaw(output, quiet);
  };
}


/**
 * Register stream command
 * @param parentCommand - Parent command (program or command group) to attach this command to
 */
export function registerStreamCommand(parentCommand: Command, commonOptions: CommonOptions): void {
  const streamCommand = parentCommand
    .command('stream')
    .description('Stream real-time stock data using SSE')
    .alias('s');

  // Apply common options (symbol and market are handled as specific options for stream)
  // Note: stream uses optional symbol, not required symbol
  
  // Command-specific options
  streamCommand
    .option('-s, --symbol <symbol>', 'Stock symbol (e.g., 300427). Required if --watchlist is not used.');
  
  // Market option is optional for stream (will auto-detect if not provided)
  if (commonOptions.marketOptional) {
    commonOptions.marketOptional(streamCommand);
  }
  
  streamCommand
    .option('-w, --watchlist', 'Stream all stocks in watchlist')
    .option('-t, --types <types>', 'Connection types to subscribe (quote,trend,detail,news). Default: quote', 'quote')
    .option('-f, --format <format>', getFormatOptionHelp('table'), 'table')
    .option('--fields <fields>', 'Fields to display (comma-separated)')
    .option('--interval <interval>', 'Update interval in milliseconds for table format', '1000')
    .option('-o, --output <path>', 'Output file path (for CSV format)');
  
  // Apply logging options
  commonOptions.logging(streamCommand);
  
  streamCommand.action(wrapCommandAction(async (options: StreamOptions) => {
      const crawler = new EastMoneyCrawler();
      let isRunning = true;

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        if (!options.quiet) {
          logger.info('\nStopping streams...');
        }
        isRunning = false;
        crawler.stopAllSSEStreams();
        process.exit(0);
      });

      const types = parseConnectionTypes(options.types);
      const format = validateFormat(options.format, 'table');

        if (options.watchlist) {
          // Stream watchlist
          const watchlist = getWatchlist();
          if (watchlist.length === 0) {
            logger.error('Watchlist is empty. Add stocks first using: emst watchlist add <symbol>');
            return;
          }

          outputProgress(`Streaming ${watchlist.length} stocks from watchlist...`, options.quiet);

          for (const entry of watchlist) {
            const dataHandler = createDataHandler(format, entry.symbol, options.quiet || false, entry.market);
            const errorHandler = (error: Error, type: SSEConnectionType) => {
              logger.error(`Error for ${entry.symbol} (${type}):`, error.message);
            };

            await crawler.startSSEStream(
              {
                symbol: entry.symbol,
                market: entry.market,
                types,
              },
              dataHandler,
              errorHandler
            );
          }
        } else {
          // Stream single stock
          if (!options.symbol) {
            logger.error('Stock symbol is required. Use --symbol <symbol> or --watchlist');
            return;
          }

          const { market, marketName } = resolveMarket({
            symbol: options.symbol,
            marketOption: options.market,
            quiet: options.quiet,
          });
          outputProgress(`Streaming ${options.symbol} (${marketName})...`, options.quiet);

          const dataHandler = createDataHandler(format, options.symbol, options.quiet || false, market);
          const errorHandler = (error: Error, type: SSEConnectionType) => {
            logger.error(`Error (${type}):`, error.message);
          };

          await crawler.startSSEStream(
            {
              symbol: options.symbol,
              market,
              types,
            },
            dataHandler,
            errorHandler
          );
        }

      // Keep running
      outputProgress('Streaming started. Press Ctrl+C to stop.', options.quiet);
      while (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }));
}

