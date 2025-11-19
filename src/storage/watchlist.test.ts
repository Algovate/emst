import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlistEntry,
  updateWatchlistEntry,
  checkWatchlistMarkets,
} from './watchlist.js';
import { Market, WatchlistEntry } from '../infra/types.js';

// Mock process.cwd to use test directory
let testWatchlistDir: string;
const originalCwd = process.cwd;

beforeEach(async () => {
  // Create a temporary directory for each test
  testWatchlistDir = await mkdtemp(join(tmpdir(), 'emst-watchlist-test-'));
  
  // Mock process.cwd to return test directory
  process.cwd = vi.fn(() => testWatchlistDir);
});

afterEach(async () => {
  // Restore original process.cwd
  process.cwd = originalCwd;
  
  // Clean up test directory
  try {
    await rm(testWatchlistDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('watchlist', () => {
  describe('getWatchlist', () => {
    it('should return empty array when watchlist does not exist', () => {
      const watchlist = getWatchlist();
      expect(watchlist).toEqual([]);
    });

    it('should return watchlist entries', () => {
      addToWatchlist('688005', Market.Shanghai, 'Test Stock');
      const watchlist = getWatchlist();
      
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].symbol).toBe('688005');
      expect(watchlist[0].market).toBe(Market.Shanghai);
      expect(watchlist[0].name).toBe('Test Stock');
    });
  });

  describe('addToWatchlist', () => {
    it('should add A-share stock to watchlist', () => {
      addToWatchlist('688005', Market.Shanghai, 'Test Stock');
      
      const entry = getWatchlistEntry('688005');
      expect(entry).not.toBeUndefined();
      expect(entry?.symbol).toBe('688005');
      expect(entry?.market).toBe(Market.Shanghai);
      expect(entry?.name).toBe('Test Stock');
      expect(entry?.addedDate).toBeDefined();
    });

    it('should add Hong Kong stock to watchlist', () => {
      addToWatchlist('00700', Market.HongKong, 'Tencent');
      
      const entry = getWatchlistEntry('00700');
      expect(entry?.symbol).toBe('00700');
      expect(entry?.market).toBe(Market.HongKong);
    });

    it('should add US stock to watchlist', () => {
      addToWatchlist('AAPL', Market.US, 'Apple Inc.');
      
      const entry = getWatchlistEntry('AAPL');
      expect(entry?.symbol).toBe('AAPL');
      expect(entry?.market).toBe(Market.US);
    });

    it('should throw error for invalid A-share symbol', () => {
      expect(() => addToWatchlist('INVALID', Market.Shanghai)).toThrow('Invalid stock symbol format');
    });

    it('should throw error for invalid Hong Kong symbol', () => {
      expect(() => addToWatchlist('12345', Market.HongKong)).toThrow('Invalid stock symbol format');
    });

    it('should throw error for invalid US symbol', () => {
      expect(() => addToWatchlist('aapl', Market.US)).toThrow('Invalid stock symbol format');
    });

    it('should throw error when adding duplicate symbol', () => {
      addToWatchlist('688005', Market.Shanghai);
      expect(() => addToWatchlist('688005', Market.Shanghai)).toThrow('Symbol 688005 is already in the watchlist');
    });

    it('should add entry without name', () => {
      addToWatchlist('688005', Market.Shanghai);
      const entry = getWatchlistEntry('688005');
      expect(entry?.name).toBeUndefined();
    });
  });

  describe('removeFromWatchlist', () => {
    it('should remove symbol from watchlist', () => {
      addToWatchlist('688005', Market.Shanghai);
      addToWatchlist('000001', Market.Shenzhen);
      
      const removed = removeFromWatchlist('688005');
      expect(removed).toBe(true);
      
      const watchlist = getWatchlist();
      expect(watchlist).toHaveLength(1);
      expect(watchlist[0].symbol).toBe('000001');
    });

    it('should return false when symbol not found', () => {
      const removed = removeFromWatchlist('999999');
      expect(removed).toBe(false);
    });
  });

  describe('getWatchlistEntry', () => {
    it('should return watchlist entry by symbol', () => {
      addToWatchlist('688005', Market.Shanghai, 'Test Stock');
      
      const entry = getWatchlistEntry('688005');
      expect(entry).not.toBeUndefined();
      expect(entry?.symbol).toBe('688005');
    });

    it('should return undefined for non-existent entry', () => {
      const entry = getWatchlistEntry('999999');
      expect(entry).toBeUndefined();
    });
  });

  describe('updateWatchlistEntry', () => {
    it('should update watchlist entry name', () => {
      addToWatchlist('688005', Market.Shanghai, 'Old Name');
      
      const updated = updateWatchlistEntry('688005', { name: 'New Name' });
      expect(updated).toBe(true);
      
      const entry = getWatchlistEntry('688005');
      expect(entry?.name).toBe('New Name');
    });

    it('should update watchlist entry market', () => {
      addToWatchlist('688005', Market.Shanghai);
      
      const updated = updateWatchlistEntry('688005', { market: Market.Shenzhen });
      expect(updated).toBe(true);
      
      const entry = getWatchlistEntry('688005');
      expect(entry?.market).toBe(Market.Shenzhen);
    });

    it('should return false when symbol not found', () => {
      const updated = updateWatchlistEntry('999999', { name: 'New Name' });
      expect(updated).toBe(false);
    });

    it('should update multiple fields', () => {
      addToWatchlist('688005', Market.Shanghai, 'Old Name');
      
      const updated = updateWatchlistEntry('688005', {
        name: 'New Name',
        addedDate: '2024-01-01',
      });
      expect(updated).toBe(true);
      
      const entry = getWatchlistEntry('688005');
      expect(entry?.name).toBe('New Name');
      expect(entry?.addedDate).toBe('2024-01-01');
    });
  });

  describe('checkWatchlistMarkets', () => {
    it('should validate correct market codes', () => {
      addToWatchlist('688005', Market.Shanghai);
      addToWatchlist('000001', Market.Shenzhen);
      
      const results = checkWatchlistMarkets();
      expect(results).toHaveLength(2);
      
      const shanghaiResult = results.find(r => r.entry.symbol === '688005');
      expect(shanghaiResult?.status).toBe('correct');
      expect(shanghaiResult?.detectedMarket).toBe(Market.Shanghai);
      
      const shenzhenResult = results.find(r => r.entry.symbol === '000001');
      expect(shenzhenResult?.status).toBe('correct');
      expect(shenzhenResult?.detectedMarket).toBe(Market.Shenzhen);
    });

    it('should detect market mismatch', () => {
      // Add with wrong market code
      addToWatchlist('688005', Market.Shenzhen); // Should be Shanghai
      
      const results = checkWatchlistMarkets();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('mismatch');
      expect(results[0].detectedMarket).toBe(Market.Shanghai);
    });

    it('should handle symbols that cannot be auto-detected', () => {
      addToWatchlist('AAPL', Market.US);
      
      const results = checkWatchlistMarkets();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('cannot_detect');
      expect(results[0].detectedMarket).toBeNull();
    });

    it('should return empty array for empty watchlist', () => {
      const results = checkWatchlistMarkets();
      expect(results).toEqual([]);
    });
  });
});

