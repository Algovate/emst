import { Market } from '../infra/types.js';
import { validateMarketAndCode, getMarketName, detectMarketFromCode, getMarketHelpText } from '../utils/utils.js';
import { logger } from '../infra/logger.js';
import { outputProgress } from './output.js';

export interface ResolveMarketOptions {
  code: string;
  marketOption?: string;
  quiet?: boolean;
  requireMarket?: boolean; // If true, throw error if cannot auto-detect
}

export interface ResolveMarketResult {
  market: Market;
  marketName: string;
}

/**
 * Resolve and validate market from code and options
 * Handles auto-detection, validation, and warnings
 */
export function resolveMarket(options: ResolveMarketOptions): ResolveMarketResult {
  const { code, marketOption, quiet, requireMarket } = options;
  const detectedMarket = detectMarketFromCode(code);

  if (marketOption) {
    // User provided market, validate it
    const market = validateMarketAndCode(code, marketOption);

    // Warn if provided market doesn't match auto-detected market (for A-share)
    if (detectedMarket !== null && market !== detectedMarket) {
      logger.warn(
        `Warning: Provided market ${getMarketName(market)} doesn't match auto-detected market ${getMarketName(detectedMarket)} for code ${code}. Using provided market.`
      );
    }

    return {
      market,
      marketName: getMarketName(market),
    };
  }

  // No market provided, try to auto-detect
  if (detectedMarket !== null) {
    // A-share code, auto-detect successful
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
      `Cannot auto-detect market for code ${code}. ` +
      `Please specify market using -m option. ${getMarketHelpText()}`
    );
  }

  // Default to Shanghai if not required
  const market = validateMarketAndCode(code, '1');
  const marketName = getMarketName(market);
  outputProgress(`Using default market: ${marketName} (cannot auto-detect for code ${code})`, quiet);
  return {
    market,
    marketName,
  };
}

