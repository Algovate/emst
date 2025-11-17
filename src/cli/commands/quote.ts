import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { QuoteOptions } from '../types.js';
import { Market } from '../../infra/types.js';
import { validateMarketAndCode, getMarketName, formatQuoteTable, handleError, detectMarketFromCode } from '../../utils/utils.js';
import { logger } from '../../infra/logger.js';

/**
 * Register quote command
 */
export function registerQuoteCommand(program: Command, commonOptions: any): void {
  const quoteCommand = program
    .command('quote')
    .description('Get real-time quote for a stock')
    .alias('q');

  commonOptions.code(quoteCommand);
  // Market option is optional for quote (will auto-detect if not provided)
  quoteCommand.option('-m, --market <market>', 'Market code (0=Shenzhen, 1=Shanghai, 105=US, 116=HK). Auto-detected for A-share codes if not provided.');
  quoteCommand
    .option('-f, --format <format>', 'Output format (json/table)', 'table')
    .action(async (options: QuoteOptions) => {
      try {
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
        
        const crawler = new EastMoneyCrawler();
        const quote = await crawler.getRealtimeQuote(options.code, market);

        if (options.format === 'json') {
          logger.info(JSON.stringify(quote, null, 2));
        } else {
          logger.info(formatQuoteTable(quote, getMarketName(market)));
        }
      } catch (error) {
        handleError(error);
      }
    });
}

