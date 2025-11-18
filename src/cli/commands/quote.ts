import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { QuoteOptions, CommonOptions } from '../types.js';
import { outputData } from '../output.js';
import { resolveMarket } from '../market-utils.js';
import { validateFormat, wrapCommandAction, applyStockCommandOptions } from '../command-utils.js';

/**
 * Register quote command
 * @param parentCommand - Parent command (program or command group) to attach this command to
 */
export function registerQuoteCommand(parentCommand: Command, commonOptions: CommonOptions): void {
  const quoteCommand = parentCommand
    .command('quote')
    .description('Get real-time quote for a stock')
    .alias('q');

  // Apply common stock command options (code, market, format, logging)
  applyStockCommandOptions(quoteCommand, commonOptions, 'table');
  
  // Define action
  quoteCommand.action(wrapCommandAction(async (options: QuoteOptions) => {
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

