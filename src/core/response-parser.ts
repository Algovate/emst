import { KlineResponse, KlineData } from '../infra/types.js';
import { parseJSONPResponse, parseKlineRecord } from '../utils/utils.js';
import { logger } from '../infra/logger.js';

/**
 * Parse and validate K-line API response
 * Handles rc:100 (no data) and data:null cases gracefully
 * @returns Parsed K-line data array, or empty array if no data available
 * @throws Error if response format is invalid or parsing fails
 */
export function parseKlineResponseData(
  responseText: string,
  code: string
): KlineData[] {
  // Parse the JSONP response
  let jsonData;
  try {
    jsonData = parseJSONPResponse(responseText);
  } catch (parseError) {
    throw new Error(
      `Failed to parse JSONP response for ${code}: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
      `Response preview: ${responseText.substring(0, 200)}`
    );
  }

  // Check if response is valid
  if (!jsonData) {
    throw new Error(
      `Invalid response data for ${code}. ` +
      `Response: ${responseText.substring(0, 500)}`
    );
  }

  const klineResponse = jsonData as KlineResponse;
  
  // Handle API response codes: rc:100 means no data available (not an error)
  if (klineResponse.rc === 100 || !klineResponse.data || klineResponse.data === null) {
    logger.warn(`No K-line data available for ${code} (API returned rc:${klineResponse.rc || 'unknown'})`);
    return [];
  }

  const records = klineResponse.data.klines;

  if (!records || records.length === 0) {
    logger.warn(`No K-line data found for ${code}`);
    return [];
  }

  // Parse each record
  return records.map((record) => parseKlineRecord(record));
}

/**
 * Parse KlineResponse from parsed JSON data
 * @returns Parsed K-line data array, or empty array if no data available
 */
export function parseKlineResponseObject(
  response: KlineResponse,
  code: string
): KlineData[] {
  // Handle API response codes: rc:100 means no data available (not an error)
  if (response.rc === 100 || !response.data || response.data === null) {
    logger.warn(`No K-line data available for ${code} (API returned rc:${response.rc || 'unknown'})`);
    return [];
  }

  const records = response.data.klines;

  if (!records || records.length === 0) {
    logger.warn(`No K-line data found for ${code}`);
    return [];
  }

  // Parse each record
  return records.map((record) => parseKlineRecord(record));
}

