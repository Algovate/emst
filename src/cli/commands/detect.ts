import { Command } from 'commander';
import { EastMoneyCrawler } from '../../core/crawler.js';
import { DetectOptions, CommonOptions } from '../types.js';
import { outputData, outputProgress } from '../output.js';
import { Market, MarketDetectionResult } from '../../infra/types.js';
import { getMarketName, formatDetectionTable, formatDetectionText } from '../../utils/utils.js';
import { validateFormat, wrapCommandAction, applyStockCommandOptions } from '../command-utils.js';
import { logger } from '../../infra/logger.js';

/**
 * Markets to try for detection (all supported markets)
 */
const MARKETS_TO_TRY: readonly Market[] = [
  Market.Shenzhen,
  Market.Shanghai,
  Market.US,
  Market.US_ETF,
  Market.HongKong,
] as const;

/**
 * Detect market code for a stock symbol by trying different markets
 */
async function detectMarketCode(
  crawler: EastMoneyCrawler,
  symbol: string
): Promise<MarketDetectionResult[]> {
  // Try all markets in parallel for better performance
  const detectionPromises = MARKETS_TO_TRY.map(async (market): Promise<MarketDetectionResult | null> => {
    try {
      const quote = await crawler.getRealtimeQuote(symbol, market);
      
      // If we get a quote with symbol and name, this market works
      if (quote?.symbol && quote?.name) {
        // API may return a different market code in the response
        const detectedMarket = quote.market ?? market;
        const marketName = getMarketName(detectedMarket as Market);
        
        const result: MarketDetectionResult = {
          market: detectedMarket,
          marketName,
          symbol: quote.symbol,
          name: quote.name,
          works: true,
        };
        
        logger.debug(
          `Market code ${market} (${getMarketName(market)}) works for ${symbol}. ` +
          `API returned market ${detectedMarket} (${marketName})`
        );
        
        return result;
      }
      
      return null;
    } catch (error) {
      // This market code doesn't work, continue
      logger.debug(
        `Market code ${market} (${getMarketName(market)}) failed for ${symbol}: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  });

  // Wait for all detections to complete
  const results = await Promise.allSettled(detectionPromises);
  
  // Extract successful results and filter out nulls
  const validResults: MarketDetectionResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      validResults.push(result.value);
    }
  }
  
  // Sort by market code
  validResults.sort((a, b) => a.market - b.market);
  
  return validResults;
}

/**
 * Handle detect action
 */
async function handleDetectAction(options: DetectOptions): Promise<void> {
  const { symbol } = options;
  const format = validateFormat(options.format, 'json');

  outputProgress(`Detecting market code for ${symbol}...`, options.quiet);

  const crawler = new EastMoneyCrawler();
  const results = await detectMarketCode(crawler, symbol);

  if (results.length === 0) {
    outputProgress(
      `No market code found for ${symbol}. The symbol may not exist or is not supported.`,
      options.quiet
    );
    process.exit(1);
  }

  // Output results based on format
  if (format === 'table') {
    outputData(formatDetectionTable(results), 'text', { quiet: options.quiet });
  } else if (format === 'text') {
    outputData(formatDetectionText(results), 'text', { quiet: options.quiet });
  } else {
    outputData(results, 'json', { quiet: options.quiet });
  }

  // Show summary message
  if (results.length === 1) {
    const result = results[0];
    outputProgress(`✓ Market code ${result.market} (${result.marketName}) works for ${symbol}`, options.quiet);
    outputProgress(`  Stock: ${result.name} (${result.symbol})`, options.quiet);
  } else {
    outputProgress(`Found ${results.length} working market code(s) for ${symbol}`, options.quiet);
  }
}

/**
 * Register detect command
 * @param parentCommand - Parent command (program or command group) to attach this command to
 */
export function registerDetectCommand(parentCommand: Command, commonOptions: CommonOptions): void {
  const detectCommand = parentCommand
    .command('detect')
    .description('Detect the correct market code for a stock symbol')
    .alias('d');

  // Apply common stock command options (symbol, format, logging)
  applyStockCommandOptions(detectCommand, commonOptions, 'json');
  
  // Define action
  detectCommand.action(wrapCommandAction(async (options: DetectOptions) => {
    await handleDetectAction(options);
  }));
}
