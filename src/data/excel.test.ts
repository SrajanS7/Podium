/**
 * Excel import: a good file is accepted, a bad one is rejected with a clear list of problems
 * (and the Data manager then changes nothing).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Dataset } from '../domain/types';
import { datasetToWorkbook, ImportError, parseWorkbook } from './excel';

const original = () => XLSX.read(readFileSync('data/Olympic_Games_Dataset.xlsx'));
/** Runs the import and returns the problems it reports ([] when the file is accepted). */
const problemsOf = (wb: XLSX.WorkBook) => {
  try { parseWorkbook(wb); return []; } catch (e) { if (e instanceof ImportError) return e.problems; throw e; }
};
const setCell = (wb: XLSX.WorkBook, sheet: string, cell: string, v: string | number) => {
  wb.Sheets[sheet][cell] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v };
};

describe('Excel import checks', () => {
  it('accepts the original workbook (9,107 records)', () => {
    expect(parseWorkbook(original()).records).toHaveLength(9107);
  });

  it('accepts its own export (export -> import round trip)', () => {
    const d: Dataset = JSON.parse(readFileSync('public/data/dataset.json', 'utf8'));
    const back = XLSX.read(XLSX.write(datasetToWorkbook(d), { type: 'buffer' }));
    expect(problemsOf(back)).toEqual([]);
  });

  it('rejects a file that is not the Olympic workbook (e.g. a CSV)', () => {
    expect(problemsOf(XLSX.read('a,b\n1,2', { type: 'string' }))[0]).toMatch(/missing these sheets: Medal Victories/);
  });

  it('rejects a renamed column', () => {
    const wb = original();
    setCell(wb, 'Medal Victories', 'H1', 'Medals');
    expect(problemsOf(wb)).toEqual(['Medal Victories is missing the column "Number of Medals won"']);
  });

  it('rejects text in a number column, with the Excel row', () => {
    const wb = original();
    setCell(wb, 'Medal Victories', 'C2', 'Germany');
    expect(problemsOf(wb)).toEqual(['Medal Victories row 2: COUNTRY_ID is missing or not a number']);
  });

  it('rejects an ID that points to nothing, an impossible medal count and a duplicate ID', () => {
    const wb = original();
    setCell(wb, 'Medal Victories', 'C2', 999);   // no nation 999
    setCell(wb, 'Medal Victories', 'H3', 0);     // 0 medals
    setCell(wb, 'Medal Victories', 'A4', 1);     // same ID as another row
    const p = problemsOf(wb);
    expect(p).toContain('Medal Victories row 2: COUNTRY_ID 999 is not in Country Data');
    expect(p).toContain('Medal Victories row 3: Number of Medals won: At least 1');
    expect(p.some((x) => /ID 1 is used twice/.test(x))).toBe(true);
  });

  it('accepts a new athlete added on the Athletes sheet with a medal row pointing to them', () => {
    const wb = original();
    XLSX.utils.sheet_add_aoa(wb.Sheets['Athletes'], [[7051, 'Srajan', 'India', 'Athletics', 2001]], { origin: -1 });
    XLSX.utils.sheet_add_aoa(wb.Sheets['Medal Victories'], [[9108, 7051, 95, 7, 12, 1, 11, 1]], { origin: -1 });
    const d = parseWorkbook(wb);
    expect(d.athletes.find((a) => a.id === 7051)?.name).toBe('Srajan');
    expect(d.records).toHaveLength(9108);
  });

  it('rejects a workbook whose sheets have headers but no data rows (it would wipe the data)', () => {
    const wb = original();
    for (const name of wb.SheetNames) wb.Sheets[name]['!ref'] = wb.Sheets[name]['!ref']!.replace(/\d+$/, '1');
    expect(problemsOf(wb)).toEqual(['These sheets have no data rows (only a header): Medal Victories, Country Data, Olympic Events, Sport Types']);
  });

  it('rejects a workbook with no medal rows', () => {
    const wb = original();
    wb.Sheets['Medal Victories']['!ref'] = 'A1:H1';
    expect(problemsOf(wb)).toEqual(['These sheets have no data rows (only a header): Medal Victories']);
  });

  it('rejects text in GDP, Literacy, Area, Year of birth and the Games year (would show as NaN)', () => {
    const wb = original();
    setCell(wb, 'Country Data', 'I3', 'n/a');            // GDP, Albania
    setCell(wb, 'Country Data', 'J3', 'high');           // Literacy
    setCell(wb, 'Country Data', 'E4', 'big');            // Area, Algeria
    setCell(wb, 'Athletes', 'E3', 'unknown');            // Year of birth
    setCell(wb, 'Olympic Events', 'B3', 'two thousand'); // Year
    const p = problemsOf(wb);
    expect(p).toContain('Country Data row 3 (Albania): GDP is not a number (leave the cell empty if unknown)');
    expect(p).toContain('Country Data row 3 (Albania): Literacy is not a number (leave the cell empty if unknown)');
    expect(p.some((x) => /Country Data row 4 \(.+\): Area is missing or not a positive number/.test(x))).toBe(true);
    expect(p.some((x) => /Athletes row 3 \(.+\): Year of birth is missing or not a year/.test(x))).toBe(true);
    expect(p).toContain('Olympic Events row 3: Year is missing or not a year');
  });

  it('still accepts empty optional cells (unknown GDP or literacy)', () => {
    const wb = original();
    delete wb.Sheets['Country Data']['I3'];
    delete wb.Sheets['Country Data']['J3'];
    expect(problemsOf(wb)).toEqual([]);
  });

  it('rejects a medal for an athlete who is not on the Athletes sheet', () => {
    const wb = original();
    XLSX.utils.sheet_add_aoa(wb.Sheets['Medal Victories'], [[9108, 7051, 95, 7, 12, 1, 24, 1]], { origin: -1 });
    expect(problemsOf(wb)).toEqual(['Medal Victories row 9109: ATHLETE_ID 7051 is not in Athletes (add the athlete there, or leave ATHLETE_ID empty)']);
  });
});
