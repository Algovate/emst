import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseKlineResponseData, parseKlineResponseObject } from './response-parser.js';
import { KlineResponse } from '../infra/types.js';
import * as loggerModule from '../infra/logger.js';

// Mock logger
vi.mock('../infra/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('response-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseKlineResponseData', () => {
    it('should parse valid K-line response data', () => {
      const responseText = JSON.stringify({
        rc: 0,
        rt: 1234567890,
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          klines: [
            '2024-01-01,10.0,10.5,10.8,9.8,1000000,10500000',
            '2024-01-02,10.5,11.0,11.2,10.3,1200000,13200000',
          ],
        },
      });

      const result = parseKlineResponseData(responseText, '688005');
      
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].close).toBe(10.5);
      expect(result[1].date).toBe('2024-01-02');
      expect(result[1].close).toBe(11.0);
    });

    it('should parse JSONP response', () => {
      const responseText = `jQuery1234567890_1234567890(${JSON.stringify({
        rc: 0,
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          klines: ['2024-01-01,10.0,10.5,10.8,9.8,1000000,10500000'],
        },
      })})`;

      const result = parseKlineResponseData(responseText, '688005');
      
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2024-01-01');
    });

    it('should return empty array for rc:100 (no data)', () => {
      const responseText = JSON.stringify({
        rc: 100,
        data: null,
      });

      const result = parseKlineResponseData(responseText, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No K-line data available for 688005')
      );
    });

    it('should return empty array when data is null', () => {
      const responseText = JSON.stringify({
        rc: 0,
        data: null,
      });

      const result = parseKlineResponseData(responseText, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalled();
    });

    it('should return empty array when klines is empty', () => {
      const responseText = JSON.stringify({
        rc: 0,
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          klines: [],
        },
      });

      const result = parseKlineResponseData(responseText, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No K-line data found for 688005')
      );
    });

    it('should throw error for invalid JSONP format', () => {
      const responseText = 'invalid response';

      expect(() => parseKlineResponseData(responseText, '688005')).toThrow(
        'Failed to parse JSONP response'
      );
    });

    it('should handle invalid response structure gracefully', () => {
      const responseText = JSON.stringify({
        invalid: 'structure',
      });

      // The function will parse JSON successfully but data.klines will be undefined
      // This should return empty array or throw when accessing klines
      const result = parseKlineResponseData(responseText, '688005');
      // The function may return empty array or throw, depending on implementation
      // Let's check if it returns empty array (which is the actual behavior)
      expect(result).toEqual([]);
    });
  });

  describe('parseKlineResponseObject', () => {
    it('should parse valid KlineResponse object', () => {
      const response: KlineResponse = {
        rc: 0,
        rt: 1234567890,
        svr: 1,
        lt: 1,
        full: 1,
        dlmkts: '',
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          decimal: 2,
          dktotal: 2,
          preKPrice: 10.0,
          klines: [
            '2024-01-01,10.0,10.5,10.8,9.8,1000000,10500000',
            '2024-01-02,10.5,11.0,11.2,10.3,1200000,13200000',
          ],
        },
      };

      const result = parseKlineResponseObject(response, '688005');
      
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
    });

    it('should return empty array for rc:100 (no data)', () => {
      const response: KlineResponse = {
        rc: 100,
        rt: 1234567890,
        svr: 1,
        lt: 1,
        full: 1,
        dlmkts: '',
        data: null,
      };

      const result = parseKlineResponseObject(response, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No K-line data available for 688005')
      );
    });

    it('should return empty array when data is null', () => {
      const response: KlineResponse = {
        rc: 0,
        rt: 1234567890,
        svr: 1,
        lt: 1,
        full: 1,
        dlmkts: '',
        data: null,
      };

      const result = parseKlineResponseObject(response, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalled();
    });

    it('should return empty array when klines is empty', () => {
      const response: KlineResponse = {
        rc: 0,
        rt: 1234567890,
        svr: 1,
        lt: 1,
        full: 1,
        dlmkts: '',
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          decimal: 2,
          dktotal: 0,
          preKPrice: 10.0,
          klines: [],
        },
      };

      const result = parseKlineResponseObject(response, '688005');
      
      expect(result).toEqual([]);
      expect(loggerModule.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No K-line data found for 688005')
      );
    });

    it('should handle klines with optional fields', () => {
      const response: KlineResponse = {
        rc: 0,
        rt: 1234567890,
        svr: 1,
        lt: 1,
        full: 1,
        dlmkts: '',
        data: {
          code: '688005',
          market: 1,
          name: 'Test Stock',
          decimal: 2,
          dktotal: 1,
          preKPrice: 10.0,
          klines: [
            '2024-01-01,10.0,10.5,10.8,9.8,1000000,10500000,4.76,2.86,0.30,1.5',
          ],
        },
      };

      const result = parseKlineResponseObject(response, '688005');
      
      expect(result).toHaveLength(1);
      expect(result[0].amplitude).toBe(4.76);
      expect(result[0].changePercent).toBe(2.86);
      expect(result[0].changeAmount).toBe(0.30);
      expect(result[0].turnoverRate).toBe(1.5);
    });
  });
});

