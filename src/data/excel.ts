/**
 * Excel <-> Dataset. Shared by the build-time script (scripts/convert-excel.ts)
 * and the Data manager's Import / Export buttons, so both use identical rules.
 * Export writes the SAME six-sheet layout as the original workbook, so an
 * exported file can be re-imported.
 */
import * as XLSX from 'xlsx';
import type { Athlete, Country, Dataset, Games, MedalRecord, MedalType, Sport } from '../domain/types';
import { validateImport } from '../domain/validation';

export const TEAM_SPORTS = new Set([
  'Football', 'Hockey', 'Ice Hockey', 'Basketball', 'Handball', 'Volleyball',
  'Beach Volleyball', 'Waterpolo', 'Baseball', 'Softball', 'Curling',
]);
/** The rule a sport starts with: team sports (every event a team event) count once per team. */
export const defaultRule = (sportName: string): Sport['countingRule'] => (TEAM_SPORTS.has(sportName) ? 'team' : 'individual');

/** Sports whose counting rule differs from the default, split by their current rule. */
export function changedRules(sports: Sport[]) {
  const changed = sports.filter((s) => s.countingRule !== defaultRule(s.name)).sort((a, b) => a.name.localeCompare(b.name));
  return { toTeam: changed.filter((s) => s.countingRule === 'team').map((s) => s.name), toAthlete: changed.filter((s) => s.countingRule === 'individual').map((s) => s.name) };
}

const MEDAL_BY_ID: Record<number, MedalType> = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const ID_BY_MEDAL: Record<MedalType, number> = { gold: 1, silver: 2, bronze: 3 };
/** Every sheet the import needs, with the columns it reads from it (extra sheets and columns are ignored). */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  'Medal Victories': ['ID', 'ATHLETE_ID', 'COUNTRY_ID', 'OLYMPIC_EVENT_ID', 'SPORTS_ID', 'MEDAL_TYPE_ID', 'Age of Athlete', 'Number of Medals won'],
  'Athletes': ['ID', 'Athlete', 'Country', 'Athlete Sport', 'Year of birth'],
  'Country Data': ['ID', 'Country', 'Region', 'Population', 'Area', 'Coastline', 'Net migration', 'GDP', 'Literacy', 'Birthrate'],
  'Medal Types': ['ID', 'Medal Type'],
  'Olympic Events': ['ID', 'Year', 'Type of Games', 'Location', 'Country'],
  'Sport Types': ['ID', 'Sport'],
};
const REQUIRED_SHEETS = Object.keys(REQUIRED_COLUMNS);

/** Thrown when a file cannot be imported; `problems` lists what is wrong, for the Data manager to show. */
export class ImportError extends Error {
  constructor(public problems: string[]) {
    super(problems.length === 1 ? problems[0] : `${problems.length} problems found`);
  }
}

type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number(v));
const coastlineKmFrom = (ratio: number | null, area: number) =>
  ratio === null || !(area > 0) ? null : Math.round(ratio * area) / 100;
const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

export function parseWorkbook(wb: XLSX.WorkBook): Dataset {
  // 1. Shape: every sheet, and every column the import reads, must be there
  const missing = REQUIRED_SHEETS.filter((s) => !wb.Sheets[s]);
  if (missing.length) throw new ImportError([`The workbook is missing these sheets: ${missing.join(', ')}`]);
  const missingColumns = REQUIRED_SHEETS.flatMap((name) => {
    const header = (XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 })[0] ?? []).map((h) => String(h ?? '').trim());
    return REQUIRED_COLUMNS[name].filter((col) => !header.includes(col)).map((col) => `${name} is missing the column "${col}"`);
  });
  if (missingColumns.length) throw new ImportError(missingColumns);
  const sheet = (name: string): Row[] => XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: null });

  const countries: Country[] = sheet('Country Data').map((r) => ({
    id: Number(r['ID']), name: str(r['Country']), region: titleCase(str(r['Region'])),
    population: Number(r['Population']), areaKm2: Number(r['Area']),
    gdpPerCapita: num(r['GDP']), literacy: num(r['Literacy']), birthrate: num(r['Birthrate']),
    // 'Coastline' in the workbook is coast length ÷ area × 100 (NOT a length): Albania 1.26 × 28,748 ÷ 100 = 362 km
    coastlineKm: coastlineKmFrom(num(r['Coastline']), Number(r['Area'])),
    netMigration: num(r['Net migration']),
  }));
  const games: Games[] = sheet('Olympic Events').map((r) => ({
    id: Number(r['ID']), year: Number(r['Year']), season: str(r['Type of Games']) as Games['season'],
    city: str(r['Location']), hostCountry: str(r['Country']),
  }));
  const raw = sheet('Medal Victories');
  const seasonOfSport = new Map<number, Games['season']>();
  for (const r of raw) {
    const g = games.find((x) => x.id === Number(r['OLYMPIC_EVENT_ID']));
    if (g) seasonOfSport.set(Number(r['SPORTS_ID']), g.season);
  }
  const sports: Sport[] = sheet('Sport Types').map((r) => ({
    id: Number(r['ID']), name: str(r['Sport']),
    season: (str(r['Season']) as Sport['season']) || seasonOfSport.get(Number(r['ID'])) || 'Summer',
    countingRule: r['Counting rule'] ? (str(r['Counting rule']) as Sport['countingRule'])
      : TEAM_SPORTS.has(str(r['Sport'])) ? 'team' : 'individual',
  }));
  const athletes: Athlete[] = sheet('Athletes').map((r) => ({
    id: Number(r['ID']), name: str(r['Athlete']), country: str(r['Country']),
    sport: str(r['Athlete Sport']), birthYear: Number(r['Year of birth']),
  }));
  // Fact table: nation and sport come from HERE (source of truth), not from Athletes.
  const records: MedalRecord[] = raw.map((r) => ({
    id: Number(r['ID']), athleteId: num(r['ATHLETE_ID']), countryId: Number(r['COUNTRY_ID']),
    gamesId: Number(r['OLYMPIC_EVENT_ID']), sportId: Number(r['SPORTS_ID']),
    medal: MEDAL_BY_ID[Number(r['MEDAL_TYPE_ID'])], medalCount: Number(r['Number of Medals won']),
    age: num(r['Age of Athlete']),
  }));
  const dataset: Dataset = { version: 1, countries, games, sports, athletes, records };
  // 2. Values: same rules as the Data manager forms, and every ID must point to something that exists
  const problems = validateImport(dataset);
  if (problems.length) throw new ImportError(problems);
  return dataset;
}

export function datasetToWorkbook(d: Dataset): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Row[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths that fit each header, so long headers ("Number of Medals won") don't spill into the next column
    ws['!cols'] = Object.keys(rows[0] ?? {}).map((header) => ({ wch: Math.max(10, header.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Medal Victories', d.records.map((r) => ({ ID: r.id, ATHLETE_ID: r.athleteId, COUNTRY_ID: r.countryId,
    OLYMPIC_EVENT_ID: r.gamesId, SPORTS_ID: r.sportId, MEDAL_TYPE_ID: ID_BY_MEDAL[r.medal],
    'Age of Athlete': r.age, 'Number of Medals won': r.medalCount })));
  add('Athletes', d.athletes.map((a) => ({ ID: a.id, Athlete: a.name, Country: a.country, 'Athlete Sport': a.sport, 'Year of birth': a.birthYear })));
  add('Country Data', d.countries.map((c) => ({ ID: c.id, Country: c.name, Region: c.region.toUpperCase(), Population: c.population,
    Area: c.areaKm2, 'Pop. Density': c.areaKm2 > 0 ? Math.round((c.population / c.areaKm2) * 100) / 100 : null,
    Coastline: c.coastlineKm === null || !(c.areaKm2 > 0) ? null : Math.round((c.coastlineKm / c.areaKm2) * 10000) / 100,
    'Net migration': c.netMigration, GDP: c.gdpPerCapita, Literacy: c.literacy, Birthrate: c.birthrate })));
  add('Medal Types', [{ ID: 1, 'Medal Type': 'Gold' }, { ID: 2, 'Medal Type': 'Silver' }, { ID: 3, 'Medal Type': 'Bronze' }]);
  add('Olympic Events', d.games.map((g) => ({ ID: g.id, Year: g.year, 'Type of Games': g.season, Location: g.city, Country: g.hostCountry })));
  add('Sport Types', d.sports.map((s) => ({ ID: s.id, Sport: s.name, Season: s.season, 'Counting rule': s.countingRule })));
  return wb;
}
