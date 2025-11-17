import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WatchlistEntry, Market } from '../infra/types.js';
import { validateStockCode, getMarketName, detectMarketFromCode } from '../utils/utils.js';

const WATCHLIST_DIR = '.emst';
const WATCHLIST_FILE = 'watchlist.json';

/**
 * Get the watchlist file path
 */
function getWatchlistPath(): string {
  return join(process.cwd(), WATCHLIST_DIR, WATCHLIST_FILE);
}

/**
 * Ensure the watchlist directory exists
 */
function ensureWatchlistDir(): void {
  const dirPath = join(process.cwd(), WATCHLIST_DIR);
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Load watchlist from file
 */
export function loadWatchlist(): WatchlistEntry[] {
  const filePath = getWatchlistPath();

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const entries = JSON.parse(content) as WatchlistEntry[];

    // Validate entries
    const validMarkets = [Market.Shenzhen, Market.Shanghai, Market.US, Market.HongKong];
    return entries.filter(entry =>
      entry.code &&
      typeof entry.code === 'string' &&
      validMarkets.includes(entry.market)
    );
  } catch (error) {
    throw new Error(
      `Failed to load watchlist: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Save watchlist to file
 */
export function saveWatchlist(entries: WatchlistEntry[]): void {
  ensureWatchlistDir();
  const filePath = getWatchlistPath();

  try {
    writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to save watchlist: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all watchlist entries
 */
export function getWatchlist(): WatchlistEntry[] {
  return loadWatchlist();
}

/**
 * Get a specific watchlist entry by code
 */
export function getWatchlistEntry(code: string): WatchlistEntry | undefined {
  const entries = loadWatchlist();
  return entries.find(entry => entry.code === code);
}

/**
 * Add a symbol to the watchlist
 */
export function addToWatchlist(
  code: string,
  market: Market,
  name?: string
): void {
  if (!validateStockCode(code, market)) {
    let errorMsg = 'Invalid stock code format. ';
    switch (market) {
      case Market.Shenzhen:
      case Market.Shanghai:
        errorMsg += 'A-share codes must be 6 digits (e.g., 688005)';
        break;
      case Market.HongKong:
        errorMsg += 'Hong Kong codes must be 5 digits starting with 0 (e.g., 00700)';
        break;
      case Market.US:
        errorMsg += 'US codes must be 1-5 uppercase letters (e.g., AAPL)';
        break;
      default:
        errorMsg += 'Invalid market';
    }
    throw new Error(errorMsg);
  }

  const entries = loadWatchlist();

  // Check if already exists
  const existing = entries.find(entry => entry.code === code);
  if (existing) {
    throw new Error(`Symbol ${code} is already in the watchlist`);
  }

  const newEntry: WatchlistEntry = {
    code,
    market,
    name,
    addedDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };

  entries.push(newEntry);
  saveWatchlist(entries);
}

/**
 * Remove a symbol from the watchlist
 */
export function removeFromWatchlist(code: string): boolean {
  const entries = loadWatchlist();
  const initialLength = entries.length;
  const filtered = entries.filter(entry => entry.code !== code);

  if (filtered.length === initialLength) {
    return false; // Symbol not found
  }

  saveWatchlist(filtered);
  return true;
}

/**
 * Update a watchlist entry (e.g., update name)
 */
export function updateWatchlistEntry(
  code: string,
  updates: Partial<Omit<WatchlistEntry, 'code'>>
): boolean {
  const entries = loadWatchlist();
  const index = entries.findIndex(entry => entry.code === code);

  if (index === -1) {
    return false; // Symbol not found
  }

  entries[index] = { ...entries[index], ...updates };
  saveWatchlist(entries);
  return true;
}

/**
 * Market validation result for a watchlist entry
 */
export interface MarketValidationResult {
  entry: WatchlistEntry;
  detectedMarket: Market | null;
  status: 'correct' | 'mismatch' | 'cannot_detect';
}

/**
 * Check market codes for all entries in the watchlist
 * Compares stored market codes with auto-detected values
 * @returns Array of validation results
 */
export function checkWatchlistMarkets(): MarketValidationResult[] {
  const entries = loadWatchlist();
  const results: MarketValidationResult[] = [];

  for (const entry of entries) {
    const detectedMarket = detectMarketFromCode(entry.code);
    
    let status: 'correct' | 'mismatch' | 'cannot_detect';
    if (detectedMarket === null) {
      status = 'cannot_detect';
    } else if (detectedMarket === entry.market) {
      status = 'correct';
    } else {
      status = 'mismatch';
    }

    results.push({
      entry,
      detectedMarket,
      status,
    });
  }

  return results;
}

