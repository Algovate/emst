import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { FastNewsCategory, SSEConnectionType, SSENewsData, SSEStreamOptions, SSEStreamCallback, SSEErrorCallback } from '../../infra/types.js';
import { logger } from '../../infra/logger.js';
import { formatFastNewsListText, formatFastNewsListTable, formatSSENewsText } from '../../utils/news-formatters.js';
import { outputProgress, outputRaw, formatAndOutputData, OutputFormat } from '../output.js';
import { validateFormat, wrapCommandAction, applyFormatAndLoggingOptions } from '../command-utils.js';
import { NewsListOptions, NewsStreamOptions, CommonOptions } from '../types.js';

/**
 * Constants for news filtering
 */
const HEARTBEAT_MESSAGE_TYPES: readonly string[] = ['next_seq', 'noop', 'heartbeat', 'ping'];

/**
 * Parse category string to FastNewsCategory
 */
function parseCategory(categoryStr?: string): FastNewsCategory | string | undefined {
  if (!categoryStr) {
    return undefined;
  }

  // Check if it's a valid enum value
  const categoryKeys = Object.values(FastNewsCategory);
  if (categoryKeys.includes(categoryStr as FastNewsCategory)) {
    return categoryStr as FastNewsCategory;
  }

  // Check if it's a number (direct fastColumn ID)
  if (/^\d+$/.test(categoryStr)) {
    return categoryStr; // Return as string, will be handled as fastColumn
  }

  // Try to match common aliases
  const categoryMap: Record<string, FastNewsCategory> = {
    'live': FastNewsCategory.LIVE_724,
    'focus': FastNewsCategory.FOCUS,
    'stock': FastNewsCategory.STOCK_LIVE,
    'listed': FastNewsCategory.LISTED_COMPANY,
    'region': FastNewsCategory.REGION,
    'bank': FastNewsCategory.CENTRAL_BANK,
    'economic': FastNewsCategory.ECONOMIC_DATA,
    'global': FastNewsCategory.GLOBAL_STOCK,
    'commodity': FastNewsCategory.COMMODITY,
    'forex': FastNewsCategory.FOREX,
    'bond': FastNewsCategory.BOND,
  };

  const normalized = categoryStr.toLowerCase();
  if (categoryMap[normalized]) {
    return categoryMap[normalized];
  }

  // Return as-is, will be handled by the client
  return categoryStr;
}

/**
 * Handle news list action
 */
async function handleNewsListAction(options: NewsListOptions): Promise<void> {
  const format = validateFormat(options.format, 'text');
  const category = parseCategory(options.category);
  const pageSize = options.pageSize ? parseInt(options.pageSize, 10) : undefined;

  if (pageSize && (pageSize < 1 || pageSize > 200)) {
    throw new Error('Page size must be between 1 and 200');
  }

  outputProgress('Fetching fast news list...', options.quiet);
  if (category) {
    outputProgress(`Category: ${category}`, options.quiet);
  }
  if (pageSize) {
    outputProgress(`Page size: ${pageSize}`, options.quiet);
  }

  const crawler = new EastMoneyCrawler();
  
  try {
    const response = await crawler.fetchFastNews({
      category,
      pageSize,
    });

    if (options.quiet) {
      return;
    }

    // Format and output data
    formatAndOutputData(
      response,
      format,
      {
        json: (data) => JSON.stringify(data, null, 2),
        table: formatFastNewsListTable,
        text: formatFastNewsListText,
      },
      options.quiet
    );
  } catch (error) {
    logger.error('Failed to fetch fast news:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Parse news data from SSE message
 */
function parseNewsData(data: any): SSENewsData | null {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return {
        type: parsed.type || 'news',
        seq: parsed.seq || 0,
        content: parsed.content || data,
        timestamp: Date.now(),
      };
    } catch {
      // If it's not JSON, treat as plain text news
      return {
        type: 'news',
        seq: 0,
        content: data,
        timestamp: Date.now(),
      };
    }
  } else if (data && typeof data === 'object') {
    return {
      type: data.type || 'news',
      seq: data.seq || 0,
      content: data.content || JSON.stringify(data),
      timestamp: Date.now(),
    };
  }
  return null;
}

/**
 * Check if SSE news message should be filtered (heartbeat/control messages)
 */
function shouldFilterNewsMessage(data: any): boolean {
  const parsed = parseNewsData(data);
  if (!parsed) {
    return false; // Don't filter if we can't parse
  }

  // Filter out heartbeat/control messages
  const messageType = parsed.type?.toLowerCase() || '';
  if (messageType && HEARTBEAT_MESSAGE_TYPES.includes(messageType)) {
    return true;
  }

  // Filter out messages without content
  if (!parsed.content || parsed.content.trim() === '') {
    return true;
  }

  return false;
}

/**
 * Create SSE news data handler
 */
function createNewsStreamHandler(
  format: OutputFormat,
  quiet: boolean,
  verbose?: boolean
): SSEStreamCallback {
  return (data: any, type: SSEConnectionType) => {
    if (quiet || type !== SSEConnectionType.NEWS) {
      return;
    }

    // Debug: log all messages in verbose mode
    if (verbose) {
      logger.debug('SSE news message received:', typeof data === 'string' ? data : JSON.stringify(data));
    }

    // Filter out heartbeat and control messages
    if (shouldFilterNewsMessage(data)) {
      if (verbose) {
        logger.debug('Message filtered (heartbeat/control)');
      }
      return;
    }

    let output: string;

    if (format === 'json') {
      const jsonOutput: any = {
        type: 'news',
        data,
        timestamp: Date.now(),
      };
      output = JSON.stringify(jsonOutput, null, 2) + '\n';
    } else {
      // Parse and format news data
      const newsData = parseNewsData(data);
      if (!newsData) {
        return; // Skip if parsing failed
      }

      if (format === 'table') {
        output = `\n${formatSSENewsText(newsData)}\n\n`;
      } else {
        output = `${formatSSENewsText(newsData)}\n`;
      }
    }

    outputRaw(output, quiet);
  };
}

/**
 * Create SSE error handler
 */
function createNewsStreamErrorHandler(quiet: boolean): SSEErrorCallback {
  return (error: Error, type: SSEConnectionType) => {
    if (quiet) {
      return;
    }
    if (type === SSEConnectionType.NEWS) {
      logger.error('SSE news stream error:', error.message);
    }
  };
}

/**
 * Handle news stream action
 */
async function handleNewsStreamAction(options: NewsStreamOptions): Promise<void> {
  const format = validateFormat(options.format, 'text');

  outputProgress('Starting SSE news stream...', options.quiet);
  outputProgress('Connected! Waiting for news updates...', options.quiet);
  outputProgress('Press Ctrl+C to stop', options.quiet);

  const crawler = new EastMoneyCrawler();
  
  // Create stream options for news
  // Note: News SSE is global (not stock-specific), but SSEStreamOptions requires symbol/market
  // These values are ignored by the news URL builder - news stream doesn't need them
  const streamOptions: SSEStreamOptions = {
    symbol: '', // Empty for news (not used)
    market: 0, // Dummy value (not used)
    types: [SSEConnectionType.NEWS],
  };

  const onData = createNewsStreamHandler(format, options.quiet || false, options.verbose || false);
  const onError = createNewsStreamErrorHandler(options.quiet || false);

  try {
    await crawler.startSSEStream(streamOptions, onData, onError);
    
    // Keep the process alive
    // The stream will continue until interrupted
    return new Promise(() => {
      // Process will be terminated by user (Ctrl+C) or error
    });
  } catch (error) {
    logger.error('Failed to start news stream:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Register news command
 */
export function registerNewsCommand(program: Command, commonOptions: CommonOptions): void {
  const newsCommand = program
    .command('news')
    .description('Fetch and stream financial news from East Money');

  // List subcommand
  const listCommand = newsCommand
    .command('list')
    .description('Fetch fast news list (REST API)')
    .alias('l')
    .option('-c, --category <category>', 'News category (live_724, focus, bond, etc.) or fastColumn ID')
    .option('-p, --page-size <size>', 'Number of items per page (1-200, default: 50)', '50');
  
  // Apply format and logging options
  applyFormatAndLoggingOptions(listCommand, commonOptions, 'text');
  
  listCommand.action(wrapCommandAction(async (options: NewsListOptions) => {
    await handleNewsListAction(options);
  }));

  // Stream subcommand
  const streamCommand = newsCommand
    .command('stream')
    .description('Stream real-time news (SSE)')
    .alias('s');
  
  // Apply format and logging options
  applyFormatAndLoggingOptions(streamCommand, commonOptions, 'text');
  
  streamCommand.action(wrapCommandAction(async (options: NewsStreamOptions) => {
    await handleNewsStreamAction(options);
  }));
}

