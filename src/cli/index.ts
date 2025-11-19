#!/usr/bin/env node

// Initialize process-level setup (must be done before other imports)
import { suppressKnownDeprecationWarnings } from '../utils/process-setup.js';
import { fileURLToPath } from 'url';
import path from 'path';
suppressKnownDeprecationWarnings();

import { Command } from 'commander';
import { getMarketHelpText } from '../utils/utils.js';
import { registerStockCommands } from './commands/stock.js';
import { registerNewsCommand } from './commands/news.js';
import { logger } from '../infra/logger.js';
import { CommonOptions } from './types.js';

const program = new Command();

program
  .name('emst')
  .description('A TypeScript crawler for fetching stock data from East Money')
  .version('1.0.0');

// Common option definitions
export const commonOptions: CommonOptions = {
  market: (cmd: Command) => cmd.option('-m, --market <market>', getMarketHelpText(), '1'),
  marketOptional: (cmd: Command) => cmd.option(
    '-m, --market <market>',
    'Market code (0=Shenzhen, 1=Shanghai, 105=US, 107=US ETF, 116=HK). Auto-detected for A-share codes if not provided.'
  ),
  symbol: (cmd: Command) => cmd.requiredOption('-s, --symbol <symbol>', 'Stock symbol (e.g., 688005 for A-share, 00700 for HK, AAPL for US)'),
  timeframe: (cmd: Command) => cmd.option(
    '-t, --timeframe <timeframe>',
    'K-line timeframe (daily/weekly/monthly/5min/15min/30min/60min)',
    'daily'
  ),
  dateRange: (cmd: Command) => {
    cmd.option('--start <date>', 'Start date in YYYYMMDD format');
    cmd.option('-e, --end <date>', 'End date in YYYYMMDD format');
    return cmd;
  },
  output: (cmd: Command) => {
    cmd.option('-o, --output <path>', 'Output file path');
    // Format option is handled separately in each command with getFormatOptionHelp
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
registerStockCommands(program, commonOptions);
registerNewsCommand(program, commonOptions);

// Only parse command line arguments if this file is being executed directly
// This prevents CLI code from running when the module is imported as a library
function isMainModule(): boolean {
  // Check if this file is being executed directly (not imported)
  if (typeof process !== 'undefined' && process.argv && process.argv.length > 1) {
    const scriptFile = process.argv[1];
    const currentFile = fileURLToPath(import.meta.url);
    
    // Check if the script file matches the current file (for direct execution)
    // or if it ends with cli.js (for webpack bundled CLI)
    if (scriptFile) {
      // Normalize paths for comparison
      const normalizedScript = path.resolve(scriptFile);
      const normalizedCurrent = path.resolve(currentFile);
      
      if (normalizedScript === normalizedCurrent || scriptFile.endsWith('cli.js')) {
        return true;
      }
    }
  }
  return false;
}

if (isMainModule()) {
  program.parse();
}
