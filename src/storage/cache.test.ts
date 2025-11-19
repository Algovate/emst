import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getCachedData,
  setCachedData,
  getCacheEntry,
  isCacheValid,
  getCacheDateRange,
  clearCache,
  getCachePath,
} from './cache.js';
import { Market, KlineData, CacheEntry } from '../infra/types.js';
import * as configModule from '../infra/config.js';

// Mock config to use test directory
const originalGetConfig = configModule.getConfig;
let testCacheDir: string;

beforeEach(async () => {
  // Create a temporary directory for each test
  testCacheDir = await mkdtemp(join(tmpdir(), 'emst-cache-test-'));
  
  // Mock getConfig to return test cache directory
  vi.spyOn(configModule, 'getConfig').mockReturnValue({
    cache: {
      dir: testCacheDir,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  } as any);
});

afterEach(async () => {
  // Restore original getConfig
  vi.restoreAllMocks();
  
  // Clean up test directory
  try {
    await rm(testCacheDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('cache', () => {
  const sampleData: KlineData[] = [
    {
      date: '2024-01-01',
      open: 10.0,
      close: 10.5,
      high: 10.8,
      low: 9.8,
      volume: 1000000,
      amount: 10500000,
    },
    {
      date: '2024-01-02',
      open: 10.5,
      close: 11.0,
      high: 11.2,
      low: 10.3,
      volume: 1200000,
      amount: 13200000,
    },
    {
      date: '2024-01-03',
      open: 11.0,
      close: 10.8,
      high: 11.5,
      low: 10.5,
      volume: 1100000,
      amount: 11880000,
    },
  ];

  describe('setCachedData', () => {
    it('should save cache data', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual(sampleData);
      expect(entry?.metadata?.symbol).toBe('688005');
      expect(entry?.metadata?.market).toBe(Market.Shanghai);
      expect(entry?.metadata?.timeframe).toBe('daily');
    });

    it('should merge with existing cache data', () => {
      // Set initial data
      setCachedData('688005', Market.Shanghai, 'daily', [sampleData[0]]);
      
      // Add more data
      const newData: KlineData[] = [sampleData[1], sampleData[2]];
      setCachedData('688005', Market.Shanghai, 'daily', newData, true);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry?.data).toHaveLength(3);
      expect(entry?.data?.map(d => d.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    it('should replace existing cache when merge is false', () => {
      // Set initial data
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      // Replace with new data
      const newData: KlineData[] = [sampleData[0]];
      setCachedData('688005', Market.Shanghai, 'daily', newData, false);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry?.data).toHaveLength(1);
    });

    it('should handle duplicate dates (new data takes precedence)', () => {
      // Set initial data
      setCachedData('688005', Market.Shanghai, 'daily', [sampleData[0]]);
      
      // Add data with same date but different values
      const updatedData: KlineData[] = [{
        ...sampleData[0],
        close: 20.0, // Different close price
      }];
      setCachedData('688005', Market.Shanghai, 'daily', updatedData, true);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry?.data).toHaveLength(1);
      expect(entry?.data?.[0].close).toBe(20.0);
    });

    it('should sort data by date', () => {
      const unsortedData: KlineData[] = [
        sampleData[2],
        sampleData[0],
        sampleData[1],
      ];
      setCachedData('688005', Market.Shanghai, 'daily', unsortedData);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry?.data?.map(d => d.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });

    it('should handle different fqt values', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData, false, 0);
      setCachedData('688005', Market.Shanghai, 'daily', sampleData, false, 1);
      setCachedData('688005', Market.Shanghai, 'daily', sampleData, false, 2);
      
      expect(getCacheEntry('688005', Market.Shanghai, 'daily', 0)).not.toBeNull();
      expect(getCacheEntry('688005', Market.Shanghai, 'daily', 1)).not.toBeNull();
      expect(getCacheEntry('688005', Market.Shanghai, 'daily', 2)).not.toBeNull();
    });
  });

  describe('getCachedData', () => {
    beforeEach(() => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
    });

    it('should retrieve cached data', () => {
      const data = getCachedData('688005', Market.Shanghai, 'daily');
      expect(data).toEqual(sampleData);
    });

    it('should return null for non-existent cache', () => {
      const data = getCachedData('999999', Market.Shanghai, 'daily');
      expect(data).toBeNull();
    });

    it('should filter by start date', () => {
      const data = getCachedData('688005', Market.Shanghai, 'daily', '20240102');
      expect(data).toHaveLength(2);
      expect(data?.[0].date).toBe('2024-01-02');
    });

    it('should filter by end date', () => {
      const data = getCachedData('688005', Market.Shanghai, 'daily', undefined, '20240102');
      expect(data).toHaveLength(2);
      expect(data?.[1].date).toBe('2024-01-02');
    });

    it('should filter by date range', () => {
      const data = getCachedData('688005', Market.Shanghai, 'daily', '20240102', '20240102');
      expect(data).toHaveLength(1);
      expect(data?.[0].date).toBe('2024-01-02');
    });

    it('should return sorted data', () => {
      // Create unsorted cache
      const unsortedData: KlineData[] = [
        sampleData[2],
        sampleData[0],
        sampleData[1],
      ];
      setCachedData('688005', Market.Shanghai, 'daily', unsortedData, false);
      
      const data = getCachedData('688005', Market.Shanghai, 'daily');
      expect(data?.map(d => d.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });
  });

  describe('getCacheEntry', () => {
    it('should return cache entry with metadata', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      expect(entry).not.toBeNull();
      expect(entry?.metadata?.symbol).toBe('688005');
      expect(entry?.metadata?.market).toBe(Market.Shanghai);
      expect(entry?.metadata?.timeframe).toBe('daily');
      expect(entry?.lastSync).toBeGreaterThan(0);
    });

    it('should return null for non-existent cache', () => {
      const entry = getCacheEntry('999999', Market.Shanghai, 'daily');
      expect(entry).toBeNull();
    });
  });

  describe('isCacheValid', () => {
    it('should return true for valid cache', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      expect(isCacheValid('688005', Market.Shanghai, 'daily')).toBe(true);
    });

    it('should return false for non-existent cache', () => {
      expect(isCacheValid('999999', Market.Shanghai, 'daily')).toBe(false);
    });

    it('should return false for expired cache', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      // Mock an old cache entry
      const entry = getCacheEntry('688005', Market.Shanghai, 'daily');
      if (entry) {
        entry.lastSync = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
        writeFileSync(
          getCachePath('688005', Market.Shanghai, 'daily'),
          JSON.stringify(entry),
          'utf-8'
        );
      }
      
      expect(isCacheValid('688005', Market.Shanghai, 'daily')).toBe(false);
    });

    it('should use custom maxAge', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      // Should be valid with 48 hour maxAge
      expect(isCacheValid('688005', Market.Shanghai, 'daily', 48 * 60 * 60 * 1000)).toBe(true);
    });

    it('should return false for empty cache', () => {
      setCachedData('688005', Market.Shanghai, 'daily', []);
      expect(isCacheValid('688005', Market.Shanghai, 'daily')).toBe(false);
    });
  });

  describe('getCacheDateRange', () => {
    it('should return date range for cached data', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      
      const range = getCacheDateRange('688005', Market.Shanghai, 'daily');
      expect(range).toEqual({
        min: '2024-01-01',
        max: '2024-01-03',
      });
    });

    it('should return null for non-existent cache', () => {
      const range = getCacheDateRange('999999', Market.Shanghai, 'daily');
      expect(range).toBeNull();
    });

    it('should return null for empty cache', () => {
      setCachedData('688005', Market.Shanghai, 'daily', []);
      const range = getCacheDateRange('688005', Market.Shanghai, 'daily');
      expect(range).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear specific cache', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      setCachedData('000001', Market.Shenzhen, 'daily', sampleData);
      
      const count = clearCache('688005', Market.Shanghai, 'daily', 1);
      expect(count).toBe(1);
      
      expect(getCachedData('688005', Market.Shanghai, 'daily')).toBeNull();
      expect(getCachedData('000001', Market.Shenzhen, 'daily')).not.toBeNull();
    });

    it('should return 0 when clearing non-existent cache', () => {
      const count = clearCache('999999', Market.Shanghai, 'daily', 1);
      expect(count).toBe(0);
    });

    it('should clear all cache when no parameters provided', () => {
      setCachedData('688005', Market.Shanghai, 'daily', sampleData);
      setCachedData('000001', Market.Shenzhen, 'daily', sampleData);
      setCachedData('688005', Market.Shanghai, 'weekly', sampleData);
      
      const count = clearCache();
      expect(count).toBeGreaterThanOrEqual(3);
      
      expect(getCachedData('688005', Market.Shanghai, 'daily')).toBeNull();
      expect(getCachedData('000001', Market.Shenzhen, 'daily')).toBeNull();
      expect(getCachedData('688005', Market.Shanghai, 'weekly')).toBeNull();
    });
  });

  describe('getCachePath', () => {
    it('should return cache file path', () => {
      const path = getCachePath('688005', Market.Shanghai, 'daily', 1);
      expect(path).toContain('688005');
      expect(path).toContain('1');
      expect(path).toContain('daily');
      expect(path).toContain('fqt1');
      expect(path).toMatch(/\.json$/);
    });
  });
});

