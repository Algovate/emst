import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CacheEntry, KlineData, Market, Timeframe, DateRange, AdjustmentType } from '../infra/types.js';
import { getConfig } from '../infra/config.js';

function getCacheDir(): string {
  const config = getConfig();
  return config.cache?.dir || join(process.cwd(), '.emst', 'cache');
}

function getDefaultMaxAge(): number {
  const config = getConfig();
  return config.cache?.maxAge || 24 * 60 * 60 * 1000; // 24 hours in milliseconds
}

/**
 * Ensure the cache directory exists
 */
function ensureCacheDir(): void {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Get cache file path for a symbol, market, timeframe, and adjustment type
 */
function getCacheFilePath(symbol: string, market: Market, timeframe: Timeframe, fqt: AdjustmentType = 1): string {
  return join(getCacheDir(), `${symbol}_${market}_${timeframe}_fqt${fqt}.json`);
}

/**
 * Get cached data for a symbol, market, timeframe, and adjustment type
 */
export function getCachedData(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  startDate?: string,
  endDate?: string,
  fqt: AdjustmentType = 1
): KlineData[] | null {
  const filePath = getCacheFilePath(symbol, market, timeframe, fqt);
  
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const cacheEntry = JSON.parse(content) as CacheEntry;
    
    let data = cacheEntry.data || [];
    
    // Filter by date range if provided
    if (startDate || endDate) {
      data = data.filter(record => {
        const recordDate = record.date.replace(/-/g, ''); // Convert YYYY-MM-DD to YYYYMMDD
        if (startDate && recordDate < startDate) {
          return false;
        }
        if (endDate && recordDate > endDate) {
          return false;
        }
        return true;
      });
    }
    
    // Sort by date (ascending)
    data.sort((a, b) => a.date.localeCompare(b.date));
    
    return data;
  } catch (error) {
    // If cache file is corrupted, return null
    return null;
  }
}

/**
 * Get cache entry (includes metadata)
 */
export function getCacheEntry(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  fqt: AdjustmentType = 1
): CacheEntry | null {
  const filePath = getCacheFilePath(symbol, market, timeframe, fqt);
  
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as CacheEntry;
  } catch (error) {
    return null;
  }
}

/**
 * Set cached data for a symbol, market, timeframe, and adjustment type
 * Merges with existing cache if present, avoiding duplicates
 */
export function setCachedData(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  newData: KlineData[],
  merge: boolean = true,
  fqt: AdjustmentType = 1
): void {
  ensureCacheDir();
  const filePath = getCacheFilePath(symbol, market, timeframe, fqt);
  
  let data: KlineData[] = [];
  let existingEntry: CacheEntry | null = null;
  
  if (merge && existsSync(filePath)) {
    existingEntry = getCacheEntry(symbol, market, timeframe, fqt);
    if (existingEntry) {
      data = existingEntry.data || [];
    }
  }
  
  if (merge && data.length > 0) {
    // Merge new data with existing, avoiding duplicates by date
    const dateMap = new Map<string, KlineData>();
    
    // Add existing data
    data.forEach(record => {
      dateMap.set(record.date, record);
    });
    
    // Add/update with new data (new data takes precedence)
    newData.forEach(record => {
      dateMap.set(record.date, record);
    });
    
    data = Array.from(dateMap.values());
  } else {
    data = newData;
  }
  
  // Sort by date (ascending)
  data.sort((a, b) => a.date.localeCompare(b.date));
  
  const cacheEntry: CacheEntry = {
    data,
    lastSync: Date.now(),
    metadata: {
      symbol,
      market,
      timeframe,
      fqt,
    },
  };
  
  try {
    writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to save cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if cache is valid (exists and not expired)
 */
export function isCacheValid(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  maxAge?: number,
  fqt: AdjustmentType = 1
): boolean {
  const defaultMaxAge = maxAge ?? getDefaultMaxAge();
  const cacheEntry = getCacheEntry(symbol, market, timeframe, fqt);
  
  if (!cacheEntry || !cacheEntry.data || cacheEntry.data.length === 0) {
    return false;
  }
  
  const age = Date.now() - cacheEntry.lastSync;
  return age < defaultMaxAge;
}

/**
 * Get date range of cached data
 */
export function getCacheDateRange(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  fqt: AdjustmentType = 1
): DateRange | null {
  const data = getCachedData(symbol, market, timeframe, undefined, undefined, fqt);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  // Data is already sorted by date
  return {
    min: data[0].date,
    max: data[data.length - 1].date,
  };
}

/**
 * Clear cache for a specific symbol, market, timeframe, and adjustment type
 * If no parameters provided, clears all cache
 */
export function clearCache(
  symbol?: string,
  market?: Market,
  timeframe?: Timeframe,
  fqt?: AdjustmentType
): number {
  ensureCacheDir();
  
  if (!symbol || market === undefined || !timeframe || fqt === undefined) {
    // Clear all cache
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) {
      return 0;
    }
    
    try {
      const files = readdirSync(cacheDir);
      let count = 0;
      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            unlinkSync(join(cacheDir, file));
            count++;
          } catch (error) {
            // Ignore individual file errors
          }
        }
      });
      return count;
    } catch (error) {
      throw new Error(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    // Clear specific cache
    const filePath = getCacheFilePath(symbol, market, timeframe, fqt);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        return 1;
      } catch (error) {
        throw new Error(
          `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return 0;
  }
}

/**
 * Get cache file path (for external use if needed)
 */
export function getCachePath(symbol: string, market: Market, timeframe: Timeframe, fqt: AdjustmentType = 1): string {
  return getCacheFilePath(symbol, market, timeframe, fqt);
}

