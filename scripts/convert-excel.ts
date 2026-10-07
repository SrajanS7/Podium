/**
 * Build-time data preparation: Excel workbook -> one typed JSON file.
 *
 *   npm run convert-data
 *
 * Reads data/Olympic_Games_Dataset.xlsx (never modified) and writes
 * public/data/dataset.json, which the app loads on first start.
 * The parsing rules live in src/data/excel.ts and are shared with the
 * Data manager's "Import Excel" button.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/data/excel';

const dataset = parseWorkbook(XLSX.read(readFileSync('data/Olympic_Games_Dataset.xlsx')));
writeFileSync('public/data/dataset.json', JSON.stringify(dataset));
console.log(`Wrote ${dataset.records.length} records, ${dataset.athletes.length} athletes, ` +
  `${dataset.countries.length} countries, ${dataset.sports.length} sports, ${dataset.games.length} games`);
