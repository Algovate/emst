import { Command } from 'commander';
import { handleError } from '../utils/utils.js';
import { applyLoggingOptions } from './index.js';
import { OutputFormat } from './output.js';
import { CommonOptions } from './types.js';

/**
 * Get format option help text with default value
 */
export function getFormatOptionHelp(defaultFormat: OutputFormat = 'json'): string {
  return `Output format: json|table|text (default: "${defaultFormat}")`;
}

/**
 * Validate output format
 */

export function validateFormat(format: string | undefined, defaultFormat: OutputFormat = 'json'): OutputFormat {
  const validFormats: OutputFormat[] = ['json', 'table', 'text'];
  const finalFormat = (format || defaultFormat) as OutputFormat;
  
  if (!validFormats.includes(finalFormat)) {
    throw new Error(`Format must be one of: ${validFormats.join(', ')}`);
  }
  
  return finalFormat;
}

/**
 * Apply common stock command options (symbol, market, format, logging)
 * This helper standardizes the option application pattern
 */
export function applyStockCommandOptions(
  command: Command,
  commonOptions: CommonOptions,
  formatDefault: OutputFormat = 'table'
): void {
  // Apply common options
  commonOptions.symbol(command);
  // Market option is optional (will auto-detect if not provided)
  if (commonOptions.marketOptional) {
    commonOptions.marketOptional(command);
  }
  
  // Command-specific format option
  command.option('-f, --format <format>', getFormatOptionHelp(formatDefault), formatDefault);
  
  // Apply logging options
  commonOptions.logging(command);
}

/**
 * Apply format and logging options for commands that don't need symbol/market
 */
export function applyFormatAndLoggingOptions(
  command: Command,
  commonOptions: CommonOptions,
  formatDefault: OutputFormat = 'text'
): void {
  command.option('-f, --format <format>', getFormatOptionHelp(formatDefault), formatDefault);
  commonOptions.logging(command);
}

/**
 * Apply logging options conditionally (for commands with optional commonOptions)
 */
export function applyLoggingOptionsIfAvailable(
  command: Command,
  commonOptions?: CommonOptions
): void {
  if (commonOptions) {
    commonOptions.logging(command);
  }
}

/**
 * Wrap command action with error handling and logging setup
 * Supports both sync and async actions, with or without arguments
 */
export function wrapCommandAction<T extends { verbose?: boolean; quiet?: boolean }>(
  action: ((...args: any[]) => Promise<void> | void) | ((options: T) => Promise<void> | void)
): any {
  return async (...args: any[]) => {
    try {
      // Extract options (last argument is usually options)
      const options = args[args.length - 1] as T;
      // Apply logging options first
      if (options && (typeof options === 'object')) {
        applyLoggingOptions(options);
      }
      const result = (action as any).apply(null, args);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      handleError(error);
    }
  };
}

