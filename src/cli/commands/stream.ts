import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { Market, SSEConnectionType, SSEQuoteData, SSETrendData, SSEDetailData } from '../../infra/types.js';
import { validateMarketAndCode, getMarketName, handleError, detectMarketFromCode } from '../../utils/utils.js';
import { logger } from '../../infra/logger.js';
import { getWatchlist } from '../../storage/watchlist.js';
import { formatSSEQuote, formatTrendData, formatDetailData } from '../../utils/sse-formatters.js';

interface StreamOptions {
  code?: string;
  market?: string;
  watchlist?: boolean;
  types?: string;
  format?: string;
  fields?: string;
  interval?: number;
  output?: string;
}

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
 * Create data callback handler
 */
function createDataHandler(
  format: string,
  code: string,
  market?: Market
): (data: any, type: SSEConnectionType) => void {
  return (data: any, type: SSEConnectionType) => {
    if (format === 'json') {
      const output: any = { code, type, data, timestamp: Date.now() };
      if (market !== undefined) {
        output.market = market;
      }
      logger.info(JSON.stringify(output, null, 2));
    } else {
      const formatted = formatSSEData(data, type);
      const prefix = market !== undefined ? `[${code}]` : '';
      logger.info(`\n${prefix} ${type.toUpperCase()}:\n${formatted}\n`);
    }
  };
}

/**
 * Resolve market from options
 */
function resolveMarket(code: string, marketOption?: string): Market {
  const detectedMarket = detectMarketFromCode(code);

  if (marketOption) {
    const market = validateMarketAndCode(code, marketOption);
    if (detectedMarket !== null && market !== detectedMarket) {
      logger.warn(
        `Warning: Provided market ${getMarketName(market)} doesn't match auto-detected market ${getMarketName(detectedMarket)}`
      );
    }
    return market;
  }

  if (detectedMarket !== null) {
    logger.info(`Auto-detected market: ${getMarketName(detectedMarket)}`);
    return detectedMarket;
  }

  const defaultMarket = validateMarketAndCode(code, '1');
  logger.info(`Using default market: ${getMarketName(defaultMarket)}`);
  return defaultMarket;
}

/**
 * Register stream command
 */
export function registerStreamCommand(program: Command, commonOptions: any): void {
  const streamCommand = program
    .command('stream')
    .description('Stream real-time stock data using SSE')
    .alias('s');

  streamCommand
    .option('-c, --code <code>', 'Stock code (e.g., 300427). Required if --watchlist is not used.')
    .option('-m, --market <market>', 'Market code (0=Shenzhen, 1=Shanghai, 105=US, 116=HK). Auto-detected for A-share codes if not provided.')
    .option('-w, --watchlist', 'Stream all stocks in watchlist')
    .option('-t, --types <types>', 'Connection types to subscribe (quote,trend,detail,news). Default: quote', 'quote')
    .option('-f, --format <format>', 'Output format (table/json)', 'table')
    .option('--fields <fields>', 'Fields to display (comma-separated)')
    .option('--interval <interval>', 'Update interval in milliseconds for table format', '1000')
    .option('-o, --output <path>', 'Output file path (for CSV format)')
    .action(async (options: StreamOptions) => {
      const crawler = new EastMoneyCrawler();
      let isRunning = true;

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        logger.info('\nStopping streams...');
        isRunning = false;
        crawler.stopAllSSEStreams();
        process.exit(0);
      });

      try {
        const types = parseConnectionTypes(options.types);
        const format = options.format || 'table';

        if (options.watchlist) {
          // Stream watchlist
          const watchlist = getWatchlist();
          if (watchlist.length === 0) {
            logger.error('Watchlist is empty. Add stocks first using: emst watchlist add <code>');
            return;
          }

          logger.info(`Streaming ${watchlist.length} stocks from watchlist...`);

          for (const entry of watchlist) {
            const dataHandler = createDataHandler(format, entry.code, entry.market);
            const errorHandler = (error: Error, type: SSEConnectionType) => {
              logger.error(`Error for ${entry.code} (${type}):`, error.message);
            };

            await crawler.startSSEStream(
              {
                code: entry.code,
                market: entry.market,
                types,
              },
              dataHandler,
              errorHandler
            );
          }
        } else {
          // Stream single stock
          if (!options.code) {
            logger.error('Stock code is required. Use --code <code> or --watchlist');
            return;
          }

          const market = resolveMarket(options.code, options.market);
          logger.info(`Streaming ${options.code} (${getMarketName(market)})...`);

          const dataHandler = createDataHandler(format, options.code, market);
          const errorHandler = (error: Error, type: SSEConnectionType) => {
            logger.error(`Error (${type}):`, error.message);
          };

          await crawler.startSSEStream(
            {
              code: options.code,
              market,
              types,
            },
            dataHandler,
            errorHandler
          );
        }

        // Keep running
        logger.info('Streaming started. Press Ctrl+C to stop.');
        while (isRunning) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        handleError(error);
        crawler.stopAllSSEStreams();
      }
    });
}

