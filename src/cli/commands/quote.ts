import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { QuoteOptions } from '../types.js';
import { outputData, OutputFormat } from '../output.js';
import { resolveMarket } from '../market-utils.js';
import { validateFormat, wrapCommandAction } from '../command-utils.js';

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
  commonOptions.logging(quoteCommand);
  quoteCommand
    .option('-f, --format <format>', 'Output format (json/table/text)', 'table')
    .action(wrapCommandAction(async (options: QuoteOptions) => {
      // Resolve market (auto-detect or validate provided)
      const { market, marketName } = resolveMarket({
        code: options.code,
        marketOption: options.market,
        quiet: options.quiet,
      });

      const crawler = new EastMoneyCrawler();
      const quote = await crawler.getRealtimeQuote(options.code, market);

      // Output data to stdout using unified output function
      const format = validateFormat(options.format, 'table');
      outputData(quote, format, { quiet: options.quiet, marketName });
    }));
}

