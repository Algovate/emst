import { describe, it, expect } from 'vitest';
import {
  parseKlineRecord,
  parseJSONPResponse,
  buildSecid,
  detectMarketFromSymbol,
  validateStockSymbol,
  getMarketName,
  parseMarket,
  validateMarketAndSymbol,
  formatDate,
  parseDate,
  convertPriceFromCents,
  calculatePriceChange,
  buildRefererUrl,
  isUSMarket,
  validateTimeframe,
  validateDateFormat,
  getAdjustmentTypeName,
} from './utils.js';
import { Market } from '../infra/types.js';

describe('parseKlineRecord', () => {
  it('should parse a valid K-line record with all fields', () => {
    const record = '2024-01-01,10.50,10.80,10.90,10.40,1000000,10500000,4.76,2.86,0.30,1.5';
    const result = parseKlineRecord(record);

    expect(result).toEqual({
      date: '2024-01-01',
      open: 10.50,
      close: 10.80,
      high: 10.90,
      low: 10.40,
      volume: 1000000,
      amount: 10500000,
      amplitude: 4.76,
      changePercent: 2.86,
      changeAmount: 0.30,
      turnoverRate: 1.5,
    });
  });

  it('should parse a K-line record with minimal fields', () => {
    const record = '2024-01-01,10.50,10.80,10.90,10.40,1000000,10500000';
    const result = parseKlineRecord(record);

    expect(result).toEqual({
      date: '2024-01-01',
      open: 10.50,
      close: 10.80,
      high: 10.90,
      low: 10.40,
      volume: 1000000,
      amount: 10500000,
      amplitude: undefined,
      changePercent: undefined,
      changeAmount: undefined,
      turnoverRate: undefined,
    });
  });

  it('should throw error for invalid format', () => {
    const record = '2024-01-01,10.50,10.80';
    expect(() => parseKlineRecord(record)).toThrow('Invalid K-line record format');
  });
});

describe('parseJSONPResponse', () => {
  it('should parse JSONP response with callback', () => {
    const jsonp = 'jQuery1234567890_1234567890({"rc":0,"data":{}})';
    const result = parseJSONPResponse(jsonp);

    expect(result).toEqual({ rc: 0, data: {} });
  });

  it('should parse JSONP response with semicolon', () => {
    const jsonp = 'callback({"rc":0,"data":{}});';
    const result = parseJSONPResponse(jsonp);

    expect(result).toEqual({ rc: 0, data: {} });
  });

  it('should parse plain JSON response', () => {
    const jsonp = '{"rc":0,"data":{"code":"688005"}}';
    const result = parseJSONPResponse(jsonp);

    expect(result).toEqual({ rc: 0, data: { code: '688005' } });
  });

  it('should throw error for invalid format', () => {
    const jsonp = 'invalid response';
    expect(() => parseJSONPResponse(jsonp)).toThrow('Invalid JSONP/JSON response format');
  });
});

describe('buildSecid', () => {
  it('should build secid correctly', () => {
    expect(buildSecid(Market.Shanghai, '688005')).toBe('1.688005');
    expect(buildSecid(Market.Shenzhen, '000001')).toBe('0.000001');
    expect(buildSecid(Market.US, 'AAPL')).toBe('105.AAPL');
  });
});

describe('detectMarketFromSymbol', () => {
  it('should detect Shenzhen market for 300xxx codes', () => {
    expect(detectMarketFromSymbol('300001')).toBe(Market.Shenzhen);
    expect(detectMarketFromSymbol('301001')).toBe(Market.Shenzhen);
  });

  it('should detect Shenzhen market for 000xxx, 001xxx, 002xxx, 003xxx codes', () => {
    expect(detectMarketFromSymbol('000001')).toBe(Market.Shenzhen);
    expect(detectMarketFromSymbol('001001')).toBe(Market.Shenzhen);
    expect(detectMarketFromSymbol('002001')).toBe(Market.Shenzhen);
    expect(detectMarketFromSymbol('003001')).toBe(Market.Shenzhen);
  });

  it('should detect Shanghai market for 688xxx codes', () => {
    expect(detectMarketFromSymbol('688005')).toBe(Market.Shanghai);
  });

  it('should detect Shanghai market for 600xxx, 601xxx, 603xxx, 605xxx codes', () => {
    expect(detectMarketFromSymbol('600000')).toBe(Market.Shanghai);
    expect(detectMarketFromSymbol('601000')).toBe(Market.Shanghai);
    expect(detectMarketFromSymbol('603000')).toBe(Market.Shanghai);
    expect(detectMarketFromSymbol('605000')).toBe(Market.Shanghai);
  });

  it('should return null for non-A-share symbols', () => {
    expect(detectMarketFromSymbol('AAPL')).toBeNull();
    expect(detectMarketFromSymbol('00700')).toBeNull();
    expect(detectMarketFromSymbol('12345')).toBeNull();
    expect(detectMarketFromSymbol('1234567')).toBeNull();
  });
});

describe('validateStockSymbol', () => {
  it('should validate A-share symbols correctly', () => {
    expect(validateStockSymbol('688005', Market.Shanghai)).toBe(true);
    expect(validateStockSymbol('000001', Market.Shenzhen)).toBe(true);
    expect(validateStockSymbol('123456', Market.Shanghai)).toBe(true);
    expect(validateStockSymbol('AAPL', Market.Shanghai)).toBe(false);
    expect(validateStockSymbol('12345', Market.Shanghai)).toBe(false);
  });

  it('should validate Hong Kong symbols correctly', () => {
    expect(validateStockSymbol('00700', Market.HongKong)).toBe(true);
    expect(validateStockSymbol('01234', Market.HongKong)).toBe(true);
    expect(validateStockSymbol('12345', Market.HongKong)).toBe(false);
    expect(validateStockSymbol('700', Market.HongKong)).toBe(false);
  });

  it('should validate US symbols correctly', () => {
    expect(validateStockSymbol('AAPL', Market.US)).toBe(true);
    expect(validateStockSymbol('SPY', Market.US_ETF)).toBe(true);
    expect(validateStockSymbol('TSLA', Market.US)).toBe(true);
    expect(validateStockSymbol('aapl', Market.US)).toBe(false);
    expect(validateStockSymbol('AAPL123', Market.US)).toBe(false);
    expect(validateStockSymbol('A', Market.US)).toBe(true);
  });
});

describe('getMarketName', () => {
  it('should return correct market names', () => {
    expect(getMarketName(Market.Shenzhen)).toBe('Shenzhen');
    expect(getMarketName(Market.Shanghai)).toBe('Shanghai');
    expect(getMarketName(Market.HongKong)).toBe('Hong Kong');
    expect(getMarketName(Market.US)).toBe('US');
    expect(getMarketName(Market.US_ETF)).toBe('US ETF');
  });
});

describe('parseMarket', () => {
  it('should parse valid market codes', () => {
    expect(parseMarket('0')).toBe(Market.Shenzhen);
    expect(parseMarket('1')).toBe(Market.Shanghai);
    expect(parseMarket('105')).toBe(Market.US);
    expect(parseMarket('107')).toBe(Market.US_ETF);
    expect(parseMarket('116')).toBe(Market.HongKong);
  });

  it('should return null for invalid market codes', () => {
    expect(parseMarket('999')).toBeNull();
    expect(parseMarket('abc')).toBeNull();
    expect(parseMarket('')).toBeNull();
  });
});

  describe('validateMarketAndSymbol', () => {
    it('should validate with provided market', () => {
      expect(validateMarketAndSymbol('688005', '1')).toBe(Market.Shanghai);
      expect(validateMarketAndSymbol('000001', '0')).toBe(Market.Shenzhen);
    });

    it('should auto-detect market when not provided', () => {
      expect(validateMarketAndSymbol('688005')).toBe(Market.Shanghai);
      // 000001 can be auto-detected as Shenzhen
      expect(validateMarketAndSymbol('000001')).toBe(Market.Shenzhen);
    });

  it('should throw error for invalid symbol', () => {
    expect(() => validateMarketAndSymbol('INVALID', '1')).toThrow('Invalid stock symbol format');
  });

  it('should throw error when market cannot be detected', () => {
    expect(() => validateMarketAndSymbol('AAPL')).toThrow('Invalid market code');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date(2024, 0, 15); // January 15, 2024
    expect(formatDate(date)).toBe('20240115');
  });

  it('should pad month and day with zeros', () => {
    const date = new Date(2024, 0, 5); // January 5, 2024
    expect(formatDate(date)).toBe('20240105');
  });
});

describe('parseDate', () => {
  it('should parse date correctly', () => {
    const date = parseDate('20240115');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  it('should throw error for invalid format', () => {
    expect(() => parseDate('2024-01-15')).toThrow('Invalid date format');
    expect(() => parseDate('2024015')).toThrow('Invalid date format');
  });
});

describe('convertPriceFromCents', () => {
  it('should convert cents to yuan', () => {
    expect(convertPriceFromCents(1050)).toBe(10.50);
    expect(convertPriceFromCents(0)).toBe(0);
    expect(convertPriceFromCents(100)).toBe(1.00);
  });

  it('should handle undefined and null', () => {
    expect(convertPriceFromCents(undefined)).toBe(0);
    expect(convertPriceFromCents(null as any)).toBe(0);
  });
});

describe('calculatePriceChange', () => {
  it('should calculate price change correctly', () => {
    const result = calculatePriceChange(10.80, 10.50);
    expect(result.changeAmount).toBeCloseTo(0.30, 2);
    expect(result.changePercent).toBeCloseTo(2.857, 2);
  });

  it('should handle negative change', () => {
    const result = calculatePriceChange(10.20, 10.50);
    expect(result.changeAmount).toBeCloseTo(-0.30, 2);
    expect(result.changePercent).toBeCloseTo(-2.857, 2);
  });

  it('should return undefined when previousClose is 0', () => {
    const result = calculatePriceChange(10.80, 0);
    expect(result.changeAmount).toBeUndefined();
    expect(result.changePercent).toBeUndefined();
  });
});

describe('buildRefererUrl', () => {
  it('should build URL for US stocks', () => {
    expect(buildRefererUrl('AAPL', Market.US)).toBe('https://quote.eastmoney.com/us/AAPL.html');
    expect(buildRefererUrl('SPY', Market.US_ETF)).toBe('https://quote.eastmoney.com/us/SPY.html');
  });

  it('should build URL for Hong Kong stocks', () => {
    expect(buildRefererUrl('00700', Market.HongKong)).toBe('https://quote.eastmoney.com/hk/00700.html');
  });

  it('should build URL for Shanghai KCB stocks', () => {
    expect(buildRefererUrl('688005', Market.Shanghai)).toBe('https://quote.eastmoney.com/kcb/688005.html');
  });

  it('should build URL for Shenzhen stocks', () => {
    expect(buildRefererUrl('000001', Market.Shenzhen)).toBe('https://quote.eastmoney.com/sz000001.html');
  });

  it('should build URL for other Shanghai stocks', () => {
    expect(buildRefererUrl('600000', Market.Shanghai)).toBe('https://quote.eastmoney.com/sh600000.html');
  });
});

describe('isUSMarket', () => {
  it('should identify US markets correctly', () => {
    expect(isUSMarket(Market.US)).toBe(true);
    expect(isUSMarket(Market.US_ETF)).toBe(true);
    expect(isUSMarket(105)).toBe(true);
    expect(isUSMarket(107)).toBe(true);
    expect(isUSMarket(Market.Shanghai)).toBe(false);
    expect(isUSMarket(Market.Shenzhen)).toBe(false);
  });
});

describe('validateTimeframe', () => {
  it('should validate valid timeframes', () => {
    expect(validateTimeframe('daily')).toBe('daily');
    expect(validateTimeframe('weekly')).toBe('weekly');
    expect(validateTimeframe('5min')).toBe('5min');
  });

  it('should throw error for invalid timeframe', () => {
    expect(() => validateTimeframe('invalid')).toThrow('Invalid timeframe');
  });
});

describe('validateDateFormat', () => {
  it('should not throw for valid date format', () => {
    expect(() => validateDateFormat('20240115', 'startDate')).not.toThrow();
  });

  it('should throw error for invalid date format', () => {
    expect(() => validateDateFormat('2024-01-15', 'startDate')).toThrow('startDate must be in YYYYMMDD format');
    expect(() => validateDateFormat('2024015', 'endDate')).toThrow('endDate must be in YYYYMMDD format');
  });

  it('should not throw for empty string', () => {
    expect(() => validateDateFormat('', 'startDate')).not.toThrow();
  });
});

describe('getAdjustmentTypeName', () => {
  it('should return correct adjustment type names', () => {
    expect(getAdjustmentTypeName(0)).toBe('none (不复权)');
    expect(getAdjustmentTypeName(1)).toBe('forward (前复权)');
    expect(getAdjustmentTypeName(2)).toBe('backward (后复权)');
    expect(getAdjustmentTypeName(99)).toBe('unknown (99)');
  });
});

