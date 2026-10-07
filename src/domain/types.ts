/**
 * Domain model. These types mirror the six Excel sheets after cleaning
 * (see scripts/convert-excel.ts). Everything else in the app is derived.
 */
export type MedalType = 'gold' | 'silver' | 'bronze';
export type Season = 'Summer' | 'Winter';

/** 'team'  = every event in the sport is a team event -> one medal per team.
 *  'individual' = count each athlete's medals (Number of Medals won). */
export type CountingRule = 'team' | 'individual';

export interface Country {
  id: number;
  name: string;
  region: string;
  population: number;
  areaKm2: number;
  gdpPerCapita: number | null; // USD, one snapshot for all Games
  literacy: number | null;     // %
  birthrate: number | null;    // per 1,000 people
  /** Coastline length in km (source: coast ÷ area × 100 ratio, converted on import). 0 = landlocked. */
  coastlineKm: number | null;
  /** Net migrants per 1,000 residents per year; negative = more people leave than arrive. */
  netMigration: number | null;
}

export interface Athlete {
  id: number;
  name: string;
  country: string;
  sport: string;
  birthYear: number;
}

export interface Sport {
  id: number;
  name: string;
  season: Season;
  countingRule: CountingRule;
}

export interface Games {
  id: number;
  year: number;
  season: Season;
  city: string;
  hostCountry: string;
}

/** One row of 'Medal Victories': one athlete's medal(s) in one sport at one Games. */
export interface MedalRecord {
  id: number;
  athleteId: number | null; // null = unknown team member (5 rows in the source)
  countryId: number;        // source of truth for nation
  gamesId: number;
  sportId: number;          // source of truth for sport
  medal: MedalType;
  medalCount: number;       // 'Number of Medals won', e.g. 8 for Phelps in 2008
  age: number | null;
}

export interface Dataset {
  version: number;
  countries: Country[];
  games: Games[];
  sports: Sport[];
  athletes: Athlete[];
  records: MedalRecord[];
}

export interface Tally {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

/** Global filters shared by the insight screens. */
export interface Filters {
  season: 'all' | Season;
  gamesId: number | 'all';
}

export const MEDALS: MedalType[] = ['gold', 'silver', 'bronze'];
