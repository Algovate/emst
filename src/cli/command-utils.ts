import { Command } from 'commander';
import { handleError } from '../utils/utils.js';
import { applyLoggingOptions } from './index.js';
import { OutputFormat } from './output.js';

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

