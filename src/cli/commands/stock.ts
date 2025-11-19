import { Command } from 'commander';
import { registerQuoteCommand } from './quote.js';
import { registerFetchCommand } from './fetch.js';
import { registerStreamCommand } from './stream.js';
import { registerWatchlistCommands } from './watchlist.js';
import { registerDetectCommand } from './detect.js';
import { CommonOptions } from '../types.js';

/**
 * Register stock command group
 */
export function registerStockCommands(program: Command, commonOptions: CommonOptions): void {
  const stockCommand = program
    .command('stock')
    .description('Stock-related commands (quote, fetch, stream, detect, watchlist)');

  // Register all stock subcommands
  registerQuoteCommand(stockCommand, commonOptions);
  registerFetchCommand(stockCommand, commonOptions);
  registerStreamCommand(stockCommand, commonOptions);
  registerDetectCommand(stockCommand, commonOptions);
  registerWatchlistCommands(stockCommand, commonOptions);
}

