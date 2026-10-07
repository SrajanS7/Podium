/**
 * Validation for the Data manager forms. One Zod schema per editable entity,
 * plus cross-field checks that need the rest of the dataset (season match,
 * age vs birth year, duplicates). Errors block saving; warnings only inform.
 */
import { z } from 'zod';
import type { Dataset, MedalRecord } from './types';

export const medalRecordSchema = z.object({
  id: z.number().int().positive(),
  athleteId: z.number().int().positive().nullable(),
  countryId: z.number({ error: 'Choose a nation' }).int().positive('Choose a nation'),
  gamesId: z.number({ error: 'Choose the Games' }).int().positive('Choose the Games'),
  sportId: z.number({ error: 'Choose a sport' }).int().positive('Choose a sport'),
  medal: z.enum(['gold', 'silver', 'bronze'], { error: 'Choose a medal' }),
  medalCount: z.number({ error: 'Enter a number' }).int('Whole numbers only').min(1, 'At least 1').max(10, 'At most 10'),
  age: z.number().int('Whole numbers only').min(10, 'Age must be 10 or more').max(80, 'Age must be 80 or less').nullable(),
});

export const countrySchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  region: z.string().trim().min(2, 'Enter a region'),
  population: z.number({ error: 'Enter a number' }).int().positive('Must be more than 0'),
  gdpPerCapita: z.number().positive('Must be more than 0').nullable(),
  coastlineKm: z.number({ error: 'Enter a number' }).min(0, 'Cannot be negative (0 = landlocked)').nullable(),
  netMigration: z.number({ error: 'Enter a number' }).min(-100, 'Between −100 and 100 per 1,000').max(100, 'Between −100 and 100 per 1,000').nullable(),
});

export interface ValidationResult {
  errors: Record<string, string>;   // block saving
  warnings: string[];               // shown, user may still save
}

export function validateMedalRecord(rec: MedalRecord, d: Dataset): ValidationResult {
  const errors: Record<string, string> = {};
  const parsed = medalRecordSchema.safeParse(rec);
  if (!parsed.success) for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;

  const warnings: string[] = [];
  const games = d.games.find((g) => g.id === rec.gamesId);
  const sport = d.sports.find((s) => s.id === rec.sportId);
  if (games && sport && games.season !== sport.season)
    errors.sportId = `${sport.name} is a ${sport.season} sport; ${games.city} ${games.year} is a ${games.season} Games`;

  const athlete = rec.athleteId === null ? undefined : d.athletes.find((a) => a.id === rec.athleteId);
  if (athlete && games && rec.age !== null) {
    const expected = games.year - athlete.birthYear;
    if (Math.abs(expected - rec.age) > 1)
      warnings.push(`Age ${rec.age} does not match birth year ${athlete.birthYear} (expected about ${expected}).`);
  }
  const dup = d.records.find((r) => r.id !== rec.id && r.athleteId !== null && r.athleteId === rec.athleteId &&
    r.gamesId === rec.gamesId && r.sportId === rec.sportId && r.medal === rec.medal);
  if (dup) warnings.push(`This medal already exists as record #${dup.id}.`);
  if (rec.athleteId === null) warnings.push('No athlete selected: the medal counts for the nation but not on the Athletes screen.');
  return { errors, warnings };
}

// ------------------------------------------------------------------ Excel import
/** Excel column for each MedalRecord field, so import errors use the names the user sees in the file. */
const RECORD_COLUMN: Record<string, string> = {
  id: 'ID', athleteId: 'ATHLETE_ID', countryId: 'COUNTRY_ID', gamesId: 'OLYMPIC_EVENT_ID', sportId: 'SPORTS_ID',
  medal: 'MEDAL_TYPE_ID', medalCount: 'Number of Medals won', age: 'Age of Athlete',
};

/**
 * Checks an imported data set before it replaces the current one. Returns a list of problems
 * (empty = OK). Uses the same rules as the "Add medal record" form (medalRecordSchema) plus
 * checks that every ID points to something that exists. Row numbers are Excel rows (header = row 1).
 */
export function validateImport(d: Dataset): string[] {
  const problems: string[] = [];
  const duplicates = (sheet: string, ids: number[]) => {
    const seen = new Set<number>();
    ids.forEach((id, i) => {
      if (!Number.isInteger(id) || id <= 0) problems.push(`${sheet} row ${i + 2}: ID is missing or not a whole number`);
      else if (seen.has(id)) problems.push(`${sheet} row ${i + 2}: ID ${id} is used twice`);
      seen.add(id);
    });
  };
  duplicates('Country Data', d.countries.map((c) => c.id));
  duplicates('Olympic Events', d.games.map((g) => g.id));
  duplicates('Sport Types', d.sports.map((s) => s.id));
  duplicates('Medal Victories', d.records.map((r) => r.id));
  duplicates('Athletes', d.athletes.map((a) => a.id));

  d.countries.forEach((c, i) => {
    if (!c.name) problems.push(`Country Data row ${i + 2}: Country is empty`);
    if (!(c.population > 0)) problems.push(`Country Data row ${i + 2} (${c.name || 'no name'}): Population is missing or not a positive number`);
  });
  d.games.forEach((g, i) => {
    if (g.season !== 'Summer' && g.season !== 'Winter') problems.push(`Olympic Events row ${i + 2}: Type of Games must be Summer or Winter`);
  });

  const countryIds = new Set(d.countries.map((c) => c.id));
  const athleteIds = new Set(d.athletes.map((a) => a.id));
  const gamesById = new Map(d.games.map((g) => [g.id, g]));
  const sportById = new Map(d.sports.map((s) => [s.id, s]));
  d.records.forEach((rec, i) => {
    const where = `Medal Victories row ${i + 2}`;
    const parsed = medalRecordSchema.safeParse(rec);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        const value = rec[field as keyof MedalRecord];
        const column = RECORD_COLUMN[field] ?? field;
        const notANumber = value === undefined || (typeof value === 'number' && Number.isNaN(value));
        problems.push(notANumber ? `${where}: ${column} is missing or not a number` : `${where}: ${column}: ${issue.message}`);
      }
      return;
    }
    if (!countryIds.has(rec.countryId)) problems.push(`${where}: COUNTRY_ID ${rec.countryId} is not in Country Data`);
    if (rec.athleteId !== null && !athleteIds.has(rec.athleteId))
      problems.push(`${where}: ATHLETE_ID ${rec.athleteId} is not in Athletes (add the athlete there, or leave ATHLETE_ID empty)`);
    const games = gamesById.get(rec.gamesId), sport = sportById.get(rec.sportId);
    if (!games) problems.push(`${where}: OLYMPIC_EVENT_ID ${rec.gamesId} is not in Olympic Events`);
    if (!sport) problems.push(`${where}: SPORTS_ID ${rec.sportId} is not in Sport Types`);
    if (games && sport && games.season !== sport.season)
      problems.push(`${where}: ${sport.name} is a ${sport.season} sport but ${games.city} ${games.year} is a ${games.season} Games`);
  });
  return problems;
}
