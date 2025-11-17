#!/usr/bin/env node

import { Command } from 'commander';
import { getMarketHelpText } from '../utils/utils.js';
import { registerQuoteCommand } from './commands/quote.js';
import { registerFetchCommand } from './commands/fetch.js';
import { registerWatchlistCommands } from './commands/watchlist.js';
import { registerStreamCommand } from './commands/stream.js';
import { logger } from '../infra/logger.js';

const program = new Command();

program
  .name('emst')
  .description('A TypeScript crawler for fetching stock data from East Money')
  .version('1.0.0');

// Common option definitions
export const commonOptions = {
  market: (cmd: Command) => cmd.option('-m, --market <market>', getMarketHelpText(), '1'),
  code: (cmd: Command) => cmd.requiredOption('-c, --code <code>', 'Stock code (e.g., 688005 for A-share, 00700 for HK, AAPL for US)'),
  timeframe: (cmd: Command) => cmd.option(
    '-t, --timeframe <timeframe>',
    'K-line timeframe (daily/weekly/monthly/5min/15min/30min/60min)',
    'daily'
  ),
  dateRange: (cmd: Command) => {
    cmd.option('-s, --start <date>', 'Start date in YYYYMMDD format');
    cmd.option('-e, --end <date>', 'End date in YYYYMMDD format');
    return cmd;
  },
  output: (cmd: Command) => {
    cmd.option('-o, --output <path>', 'Output file path');
    cmd.option('-f, --format <format>', 'Output format (json/table/text)', 'json');
    return cmd;
  },
  logging: (cmd: Command) => {
    cmd
      .option('--verbose', 'Enable verbose logging (debug level)')
      .option('--quiet', 'Disable all output (including data), only errors are shown');
    return cmd;
  },
};

/**
 * Apply logging options from command line arguments
 * --quiet: Disable all output (including data), only errors are shown
 * --verbose: Enable verbose logging (debug level)
 */
export function applyLoggingOptions(options: { verbose?: boolean; quiet?: boolean }): void {
  // Validate that verbose and quiet are not both set
  if (options.verbose && options.quiet) {
    throw new Error('Cannot use --verbose and --quiet together');
  }

  if (options.verbose) {
    logger.setLevel('debug');
    logger.setQuiet(false);
  } else if (options.quiet) {
    logger.setQuiet(true);
    logger.setLevel('error'); // Errors are still shown
  } else {
    logger.setQuiet(false);
    // Use default from config
  }
}

// Register all commands
registerQuoteCommand(program, commonOptions);
registerFetchCommand(program, commonOptions);
registerWatchlistCommands(program, commonOptions);
registerStreamCommand(program, commonOptions);

// Parse command line arguments
program.parse();
