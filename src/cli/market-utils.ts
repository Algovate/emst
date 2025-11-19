import { Market } from '../infra/types.js';
import { validateMarketAndSymbol, getMarketName, detectMarketFromSymbol, getMarketHelpText } from '../utils/utils.js';
import { logger } from '../infra/logger.js';
import { outputProgress } from './output.js';

export interface ResolveMarketOptions {
  symbol: string;
  marketOption?: string;
  quiet?: boolean;
  requireMarket?: boolean; // If true, throw error if cannot auto-detect
}

export interface ResolveMarketResult {
  market: Market;
  marketName: string;
}

/**
 * Resolve and validate market from symbol and options
 * Handles auto-detection, validation, and warnings
 */
export function resolveMarket(options: ResolveMarketOptions): ResolveMarketResult {
  const { symbol, marketOption, quiet, requireMarket } = options;
  const detectedMarket = detectMarketFromSymbol(symbol);

  if (marketOption) {
    // User provided market, validate it
    const market = validateMarketAndSymbol(symbol, marketOption);

    // Warn if provided market doesn't match auto-detected market (for A-share)
    if (detectedMarket !== null && market !== detectedMarket) {
      logger.warn(
        `Warning: Provided market ${getMarketName(market)} doesn't match auto-detected market ${getMarketName(detectedMarket)} for symbol ${symbol}. Using provided market.`
      );
    }

    return {
      market,
      marketName: getMarketName(market),
    };
  }

  // No market provided, try to auto-detect
  if (detectedMarket !== null) {
    // A-share symbol, auto-detect successful
    const marketName = getMarketName(detectedMarket);
    outputProgress(`Auto-detected market: ${marketName}`, quiet);
    return {
      market: detectedMarket,
      marketName,
    };
  }

  // Cannot auto-detect
  if (requireMarket) {
    throw new Error(
      `Cannot auto-detect market for symbol ${symbol}. ` +
      `Please specify market using -m option. ${getMarketHelpText()}`
    );
  }

  // Default to Shanghai if not required
  const market = validateMarketAndSymbol(symbol, '1');
  const marketName = getMarketName(market);
  outputProgress(`Using default market: ${marketName} (cannot auto-detect for symbol ${symbol})`, quiet);
  return {
    market,
    marketName,
  };
}

