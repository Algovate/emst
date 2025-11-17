#!/usr/bin/env node

import { Command } from 'commander';
import { getMarketHelpText } from '../utils/utils.js';
import { registerQuoteCommand } from './commands/quote.js';
import { registerFetchCommand } from './commands/fetch.js';
import { registerWatchlistCommands } from './commands/watchlist.js';
import { registerStreamCommand } from './commands/stream.js';

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
    cmd.option('-f, --format <format>', 'Output format (json/csv for fetch, json/table for quote)', 'json');
    return cmd;
  },
};

// Register all commands
registerQuoteCommand(program, commonOptions);
registerFetchCommand(program, commonOptions);
registerWatchlistCommands(program);
registerStreamCommand(program, commonOptions);

// Parse command line arguments
program.parse();
