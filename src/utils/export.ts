import { writeFileSync } from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import { KlineData } from '../infra/types.js';

/**
 * Export data to CSV file
 */
export async function exportToCSV(data: KlineData[], filePath: string): Promise<void> {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const headers = Object.keys(data[0]).map((key) => ({
    id: key,
    title: key,
  }));

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: headers,
    encoding: 'utf8',
  });

  await csvWriter.writeRecords(data);
}

