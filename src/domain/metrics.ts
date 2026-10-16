/**
 * Derived measures for every screen. All functions are pure: (dataset, filters) in,
 * plain objects out. Pages call them through useMemo, so any edit in the Data
 * manager flows through to every chart automatically.
 */
import { eventMedals, tally, tallyBy, type EventMedal } from './counting';
import { median, poissonRegression, quantile, spearman } from './stats';
import type { Country, Dataset, Filters, Games, MedalRecord, Season, Tally } from './types';

// ------------------------------------------------------------------ scope
export function gamesInScope(d: Dataset, f: Filters): Games[] {
  return d.games
    .filter((g) => (f.season === 'all' || g.season === f.season) && (f.gamesId === 'all' || g.id === f.gamesId))
    .sort((a, b) => a.year - b.year);
}

export function scopedRecords(d: Dataset, f: Filters): MedalRecord[] {
  const ids = new Set(gamesInScope(d, f).map((g) => g.id));
  return d.records.filter((r) => ids.has(r.gamesId));
}

export const scopedEventMedals = (d: Dataset, f: Filters): EventMedal[] => eventMedals(scopedRecords(d, f), d.sports);

export const gamesLabel = (g: Games) => `${g.city} ${g.year}`;

// ------------------------------------------------------------------ countries
export interface CountryRow extends Tally {
  countryId: number;
  name: string;
  region: string;
  population: number;
  gdpPerCapita: number | null;
  perTenMillion: number;
  rank: number; // rank by total medals among medal-winning nations
}

export function countryRows(d: Dataset, f: Filters): CountryRow[] {
  const byCountry = tallyBy(scopedEventMedals(d, f), (m) => m.countryId);
  const rows = d.countries.map((c) => {
    const t = byCountry.get(c.id) ?? { gold: 0, silver: 0, bronze: 0, total: 0 };
    return { countryId: c.id, name: c.name, region: c.region, population: c.population, gdpPerCapita: c.gdpPerCapita,
      ...t, perTenMillion: c.population > 0 ? (t.total / c.population) * 1e7 : 0, rank: 0 };
  });
  rows.sort((a, b) => b.total - a.total || b.gold - a.gold || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = r.total > 0 ? i + 1 : 0));
  return rows;
}

export type RankMode = 'total' | 'gold' | 'perCapita';

/** Ranking table. Per-capita ranking only includes nations with >= 20 medals so tiny samples don't dominate. */
export function rankCountries(rows: CountryRow[], mode: RankMode, minMedalsPerCapita = 20): CountryRow[] {
  const winners = rows.filter((r) => r.total > 0);
  if (mode === 'gold') return [...winners].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  if (mode === 'perCapita') return winners.filter((r) => r.total >= minMedalsPerCapita).sort((a, b) => b.perTenMillion - a.perTenMillion);
  return winners;
}

// ------------------------------------------------------------------ overview
export interface GamesBar { gamesId: number; label: string; city: string; year: number; season: Season; total: number }

export function medalsPerGames(d: Dataset, f: Filters): GamesBar[] {
  const byGames = tallyBy(scopedEventMedals(d, f), (m) => m.gamesId);
  return gamesInScope(d, f).map((g) => ({ gamesId: g.id, label: gamesLabel(g), city: g.city, year: g.year, season: g.season, total: byGames.get(g.id)?.total ?? 0 }));
}

export function overviewStats(d: Dataset, f: Filters) {
  const medals = scopedEventMedals(d, f);
  const records = scopedRecords(d, f);
  const rows = countryRows(d, f);
  const winners = rows.filter((r) => r.total > 0);
  const total = tally(medals).total;
  const top10 = winners.slice(0, 10);
  const top10Share = total > 0 ? top10.reduce((s, r) => s + r.total, 0) / total : 0;

  const medallistIds = new Set(records.filter((r) => r.athleteId !== null).map((r) => r.athleteId!));
  const perAthlete = new Map<number, number>();
  for (const r of records) if (r.athleteId !== null) perAthlete.set(r.athleteId, (perAthlete.get(r.athleteId) ?? 0) + r.medalCount);
  const multi = [...perAthlete.values()].filter((v) => v > 1).length;

  const sportIds = new Set(records.map((r) => r.sportId));
  const sportsInScope = d.sports.filter((s) => sportIds.has(s.id));

  // Share of medals from the two biggest sports
  const bySport = [...tallyBy(medals, (m) => m.sportId).entries()].sort((a, b) => b[1].total - a[1].total);
  const top2 = bySport.slice(0, 2);
  const top2Share = total > 0 ? top2.reduce((s, [, t]) => s + t.total, 0) / total : 0;
  const top2Names = top2.map(([id]) => d.sports.find((s) => s.id === id)?.name ?? '');

  return {
    totalMedals: total, nationsWithMedal: winners.length, nationsTotal: d.countries.length,
    medallists: medallistIds.size, multiMedallists: multi,
    sportsCount: sportsInScope.length,
    summerSports: sportsInScope.filter((s) => s.season === 'Summer').length,
    winterSports: sportsInScope.filter((s) => s.season === 'Winter').length,
    top10, top10Share, top2Share, top2Names,
  };
}

// ------------------------------------------------------------------ country profile
export function countryProfile(d: Dataset, f: Filters, countryId: number) {
  const medals = scopedEventMedals(d, f).filter((m) => m.countryId === countryId);
  const byGames = tallyBy(medals, (m) => m.gamesId);
  const bySport = tallyBy(medals, (m) => m.sportId);
  const games = gamesInScope(d, f);
  const seasonOf = new Map(d.games.map((g) => [g.id, g.season]));
  const perGames = games.map((g) => ({ gamesId: g.id, label: `${g.city.slice(0, 3).toUpperCase()} ${String(g.year).slice(2)}`, full: gamesLabel(g), season: g.season, total: byGames.get(g.id)?.total ?? 0 }));
  const topSports = [...bySport.entries()]
    .map(([sportId, t]) => { const s = d.sports.find((x) => x.id === sportId)!; return { sport: s.name, season: s.season, total: t.total }; })
    .sort((a, b) => b.total - a.total).slice(0, 8);
  const winter = medals.filter((m) => seasonOf.get(m.gamesId) === 'Winter').reduce((s, m) => s + m.count, 0);
  const total = tally(medals);
  return { tally: total, perGames, topSports, winterShare: total.total > 0 ? winter / total.total : 0 };
}

// ------------------------------------------------------------------ drivers of success
export interface HostRow { country: string; games: string; season: Season; asHost: number; otherAvg: number; upliftPct: number }

/** Home advantage: each host vs its OWN average in the other Games of the same season (all Games, ignores filters). */
export function hostEffect(d: Dataset): HostRow[] {
  const byCountryGames = tallyBy(eventMedals(d.records, d.sports), (m) => `${m.countryId}|${m.gamesId}`);
  const rows: HostRow[] = [];
  for (const g of d.games) {
    const c = d.countries.find((x) => x.name === g.hostCountry);
    if (!c) continue;
    const others = d.games.filter((o) => o.season === g.season && o.id !== g.id);
    if (others.length === 0) continue;
    const asHost = byCountryGames.get(`${c.id}|${g.id}`)?.total ?? 0;
    const otherAvg = others.reduce((s, o) => s + (byCountryGames.get(`${c.id}|${o.id}`)?.total ?? 0), 0) / others.length;
    rows.push({ country: c.name, games: gamesLabel(g), season: g.season, asHost, otherAvg, upliftPct: otherAvg > 0 ? (asHost / otherAvg - 1) * 100 : 0 });
  }
  return rows.sort((a, b) => b.upliftPct - a.upliftPct);
}

/** People per km², derived so it stays right when population or area is edited. */
export const populationDensity = (c: Country) => (c.areaKm2 > 0 ? c.population / c.areaKm2 : null);

const totalGdpBn = (c: Country) => (c.gdpPerCapita === null ? null : (c.population * c.gdpPerCapita) / 1e9);

export interface CorrelationMatrix {
  /** variable names, in the same order for rows and columns */
  labels: string[];
  /** rho[i][j] = Spearman rank correlation between variable i and variable j (null: too few nations) */
  rho: (number | null)[][];
  /** n[i][j] = number of nations that have data for both variables */
  n: number[][];
}

/**
 * Correlation matrix: medals and national factors, every pair against every other pair.
 * Spearman (rank) correlation, because medals are very skewed (868 for the USA, 0 for most nations).
 * Each pair uses every nation that has data for both variables (nations without medals count as 0).
 * To add a variable: add one line to `variables`.
 */
export function correlationMatrix(d: Dataset, f: Filters): CorrelationMatrix {
  const rows = new Map(countryRows(d, f).map((r) => [r.countryId, r]));
  const variables: [string, (c: Country) => number | null][] = [
    ['Total medals', (c) => rows.get(c.id)?.total ?? 0],
    ['Gold medals', (c) => rows.get(c.id)?.gold ?? 0],
    ['Economy size', totalGdpBn],
    ['Population', (c) => c.population],
    ['GDP per person', (c) => c.gdpPerCapita],
    ['Literacy', (c) => c.literacy],
    ['Birthrate', (c) => c.birthrate],
    ['Land area', (c) => (c.areaKm2 > 0 ? c.areaKm2 : null)],
    ['Pop. density', populationDensity],
  ];
  // one column of values per variable (null = no data for that nation)
  const values = variables.map(([, get]) => d.countries.map(get));
  const pair = (i: number, j: number) => {
    const xs: number[] = [], ys: number[] = [];
    d.countries.forEach((_, k) => {
      const x = values[i][k], y = values[j][k];
      if (x !== null && y !== null) { xs.push(x); ys.push(y); }
    });
    return { rho: xs.length >= 3 ? spearman(xs, ys) : null, n: xs.length };
  };
  const cells = variables.map((_, i) => variables.map((__, j) => pair(i, j)));
  return { labels: variables.map(([label]) => label), rho: cells.map((r) => r.map((c) => c.rho)), n: cells.map((r) => r.map((c) => c.n)) };
}

export interface ExpectedPoint {
  countryId: number; name: string; region: string; actual: number; expected: number;
  /** (actual + 1) / (expected + 1): above 1 = wins more than the model predicts */
  performance: number; population: number; gdpPerCapita: number; totalGdpBn: number; literacy: number | null;
}

/**
 * "Expected medals" model - how far population and wealth (and optionally literacy) explain medal success.
 *   expected medals = exp(a + b1 * log10(population) + b2 * log10(GDP per person) [+ b3 * literacy %])
 * A Poisson regression (the standard model for counts) fitted on every nation with the data it needs,
 * including those with zero medals. Re-fitted live for filters and edits.
 * Drivers of success uses the two-factor default; the Literacy model screen passes { literacy: true }.
 */
export function expectedMedalsModel(d: Dataset, f: Filters, opts: { literacy?: boolean } = {}) {
  const withLiteracy = !!opts.literacy;
  const totals = new Map(countryRows(d, f).map((r) => [r.countryId, r.total]));
  const usable = d.countries.filter((c) => c.gdpPerCapita !== null && c.gdpPerCapita > 0 && c.population > 0 && (!withLiteracy || c.literacy !== null));
  const features = (c: Country) => withLiteracy
    ? [Math.log10(c.population), Math.log10(c.gdpPerCapita!), c.literacy!]
    : [Math.log10(c.population), Math.log10(c.gdpPerCapita!)];
  const reg = poissonRegression(usable.map(features), usable.map((c) => totals.get(c.id) ?? 0));

  const points: ExpectedPoint[] = usable.map((c) => {
    const actual = totals.get(c.id) ?? 0;
    const expected = reg.predict(features(c));
    return { countryId: c.id, name: c.name, region: c.region, actual, expected, performance: (actual + 1) / (expected + 1),
      population: c.population, gdpPerCapita: c.gdpPerCapita!, totalGdpBn: totalGdpBn(c)!, literacy: c.literacy };
  });
  const [, bPop, bGdp, bLit] = reg.coefficients;
  return {
    withLiteracy,
    /** share of the variation in medals explained (deviance explained, a pseudo R squared) */
    explained: reg.devianceExplained,
    /** medals multiply by this for 10x more of each factor */
    popMultiplier: Math.exp(bPop),
    gdpMultiplier: Math.exp(bGdp),
    /** medals multiply by this for +10 percentage points of literacy (null without literacy) */
    literacyMultiplier: withLiteracy ? Math.exp(10 * bLit) : null,
    points, n: usable.length,
  };
}

/**
 * What literacy changes: for every nation in both models, expected medals with and without literacy.
 * Sorted by the biggest change (ratio, either direction), so India (158 -> 6) comes first.
 */
export function literacyModelChanges(d: Dataset, f: Filters) {
  const base = expectedMedalsModel(d, f);
  const lit = expectedMedalsModel(d, f, { literacy: true });
  const before = new Map(base.points.map((p) => [p.countryId, p.expected]));
  return lit.points.filter((p) => before.has(p.countryId))
    .map((p) => ({ ...p, expectedBase: before.get(p.countryId)!, change: (p.expected + 1) / (before.get(p.countryId)! + 1) }))
    .sort((a, b) => Math.abs(Math.log(b.change)) - Math.abs(Math.log(a.change)));
}

// ------------------------------------------------------------------ geography & regions
/** Sports held in or on water (pool, river, lake or sea). */
export const WATER_SPORTS = new Set(['Swimming', 'Diving', 'Synchronized Swimming', 'Waterpolo', 'Rowing', 'Canoeing', 'Sailing']);

const REGION_LABELS: Record<string, string> = {
  'WESTERN EUROPE': 'Western Europe', 'NORTHERN AMERICA': 'Northern America', 'ASIA (EX. NEAR EAST)': 'Asia (ex. Near East)',
  'C.W. OF IND. STATES': 'CIS (former USSR)', 'LATIN AMER. & CARIB': 'Latin America & Caribbean', 'EASTERN EUROPE': 'Eastern Europe',
  OCEANIA: 'Oceania', 'SUB-SAHARAN AFRICA': 'Sub-Saharan Africa', BALTICS: 'Baltics', 'NEAR EAST': 'Near East', 'NORTHERN AFRICA': 'Northern Africa',
};
/** Readable region names (the source abbreviates, e.g. 'C.W. OF IND. STATES'). */
export const regionLabel = (region: string) => REGION_LABELS[region.trim().toUpperCase()] ?? region;

export interface GroupStats {
  key: string;
  nations: number;
  winners: number;
  medals: number;
  waterMedals: number;
  sailingMedals: number;
  winterMedals: number;
  population: number;
  /** medals per 10 million people (every nation in the group counts, also those without medals) */
  perTenMillion: number;
  waterPerTenMillion: number;
  /** water-sport medals ÷ all medals of the group */
  waterShare: number;
  /** share of all medals / of all sailing medals / of world population in the current selection */
  shareOfMedals: number;
  shareOfSailing: number;
  shareOfPopulation: number;
  /** medals ÷ what population and wealth predict (nations without GDP data left out); 1 = as expected */
  actualVsExpected: number | null;
  /** population-weighted averages (big nations count more), nations without data left out */
  gdpPerCapita: number | null;
  literacy: number | null;
  birthrate: number | null;
  netMigration: number | null;
}

function weighted(cs: Country[], get: (c: Country) => number | null): number | null {
  let s = 0, w = 0;
  for (const c of cs) { const v = get(c); if (v !== null && c.population > 0) { s += v * c.population; w += c.population; } }
  return w > 0 ? s / w : null;
}

/**
 * Splits nations into groups (bands or regions) and measures each group. The groups come back
 * in the order of `order`; nations whose key is null (missing data) are left out.
 */
export function groupStats(d: Dataset, f: Filters, keyOf: (c: Country) => string | null, order: string[]): GroupStats[] {
  const medals = scopedEventMedals(d, f);
  const sportName = new Map(d.sports.map((s) => [s.id, s.name]));
  const seasonOf = new Map(d.games.map((g) => [g.id, g.season]));
  const per = new Map<number, { all: number; water: number; sailing: number; winter: number }>();
  for (const m of medals) {
    const t = per.get(m.countryId) ?? { all: 0, water: 0, sailing: 0, winter: 0 };
    const sport = sportName.get(m.sportId) ?? '';
    t.all += m.count;
    if (WATER_SPORTS.has(sport)) t.water += m.count;
    if (sport === 'Sailing') t.sailing += m.count;
    if (seasonOf.get(m.gamesId) === 'Winter') t.winter += m.count;
    per.set(m.countryId, t);
  }
  const expected = new Map(expectedMedalsModel(d, f).points.map((p) => [p.countryId, p.expected]));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const totalMedals = sum([...per.values()].map((t) => t.all));
  const totalSailing = sum([...per.values()].map((t) => t.sailing));
  const totalPopulation = sum(d.countries.map((c) => c.population));

  return order.map((key) => {
    const cs = d.countries.filter((c) => keyOf(c) === key);
    const get = (c: Country) => per.get(c.id) ?? { all: 0, water: 0, sailing: 0, winter: 0 };
    const all = sum(cs.map((c) => get(c).all));
    const water = sum(cs.map((c) => get(c).water));
    const sailing = sum(cs.map((c) => get(c).sailing));
    const population = sum(cs.map((c) => c.population));
    const modelled = cs.filter((c) => expected.has(c.id));
    const exp = sum(modelled.map((c) => expected.get(c.id)!));
    return {
      key, nations: cs.length, winners: cs.filter((c) => get(c).all > 0).length,
      medals: all, waterMedals: water, sailingMedals: sailing, winterMedals: sum(cs.map((c) => get(c).winter)), population,
      perTenMillion: population > 0 ? (all / population) * 1e7 : 0,
      waterPerTenMillion: population > 0 ? (water / population) * 1e7 : 0,
      waterShare: all > 0 ? water / all : 0,
      shareOfMedals: totalMedals > 0 ? all / totalMedals : 0,
      shareOfSailing: totalSailing > 0 ? sailing / totalSailing : 0,
      shareOfPopulation: totalPopulation > 0 ? population / totalPopulation : 0,
      actualVsExpected: exp > 0 ? sum(modelled.map((c) => get(c).all)) / exp : null,
      gdpPerCapita: weighted(cs, (c) => c.gdpPerCapita), literacy: weighted(cs, (c) => c.literacy),
      birthrate: weighted(cs, (c) => c.birthrate), netMigration: weighted(cs, (c) => c.netMigration),
    };
  });
}

export const COASTLINE_BANDS = ['Landlocked', 'Under 1,000 km', '1,000–5,000 km', 'Over 5,000 km'];
export const coastlineBand = (c: Country) =>
  c.coastlineKm === null ? null : c.coastlineKm === 0 ? COASTLINE_BANDS[0] : c.coastlineKm < 1000 ? COASTLINE_BANDS[1] : c.coastlineKm < 5000 ? COASTLINE_BANDS[2] : COASTLINE_BANDS[3];

export const DENSITY_BANDS = ['Under 25', '25–100', '100–300', '300 and more'];
export const densityBand = (c: Country) => {
  const v = populationDensity(c);
  return v === null ? null : v < 25 ? DENSITY_BANDS[0] : v < 100 ? DENSITY_BANDS[1] : v < 300 ? DENSITY_BANDS[2] : DENSITY_BANDS[3];
};

export const MIGRATION_BANDS = ['Losing people', 'Balanced', 'Gaining people'];
/** Net migration per 1,000: below −1 losing people, above +1 gaining people. */
export const migrationBand = (c: Country) =>
  c.netMigration === null ? null : c.netMigration < -1 ? MIGRATION_BANDS[0] : c.netMigration <= 1 ? MIGRATION_BANDS[1] : MIGRATION_BANDS[2];

export interface GeoPoint {
  countryId: number; name: string; region: string; medals: number; waterMedals: number; perTenMillion: number;
  population: number; density: number; coastlineKm: number | null; netMigration: number | null;
  gdpPerCapita: number | null; literacy: number | null;
}

/** One row per nation with the geography facts and its medals (all nations, also those without medals). */
export function geographyPoints(d: Dataset, f: Filters): GeoPoint[] {
  const medals = scopedEventMedals(d, f);
  const sportName = new Map(d.sports.map((s) => [s.id, s.name]));
  const all = tallyBy(medals, (m) => m.countryId);
  const water = tallyBy(medals.filter((m) => WATER_SPORTS.has(sportName.get(m.sportId) ?? '')), (m) => m.countryId);
  return d.countries.filter((c) => c.population > 0 && c.areaKm2 > 0).map((c) => {
    const total = all.get(c.id)?.total ?? 0;
    return { countryId: c.id, name: c.name, region: regionLabel(c.region), medals: total, waterMedals: water.get(c.id)?.total ?? 0,
      perTenMillion: (total / c.population) * 1e7, population: c.population, density: c.population / c.areaKm2,
      coastlineKm: c.coastlineKm, netMigration: c.netMigration, gdpPerCapita: c.gdpPerCapita, literacy: c.literacy };
  });
}

export function geographyInsights(d: Dataset, f: Filters) {
  const coast = groupStats(d, f, coastlineBand, COASTLINE_BANDS);
  const density = groupStats(d, f, densityBand, DENSITY_BANDS);
  const migration = groupStats(d, f, migrationBand, MIGRATION_BANDS);
  const points = geographyPoints(d, f);
  const landlockedWater = points.filter((p) => p.coastlineKm === 0 && p.waterMedals > 0)
    .map((p) => ({ ...p, waterShare: p.waterMedals / p.medals }))
    .sort((a, b) => b.waterMedals - a.waterMedals);
  return { coast, density, migration, points, landlockedWater };
}


/**
 * Literacy beyond wealth: among poorer nations (GDP per person under $6,000, 1M+ people),
 * how often do highly literate ones (90%+) win a medal compared with the rest?
 */
export function literacyContrast(d: Dataset, f: Filters, gdpBelow = 6000, literacyFrom = 90, minPopulation = 1e6) {
  const totals = new Map(countryRows(d, f).map((r) => [r.countryId, r.total]));
  const poor = d.countries.filter((c) => c.gdpPerCapita !== null && c.gdpPerCapita < gdpBelow && c.literacy !== null && c.population >= minPopulation);
  const side = (cs: Country[]) => ({
    nations: cs.length, winners: cs.filter((c) => (totals.get(c.id) ?? 0) > 0).length,
    medals: cs.reduce((s, c) => s + (totals.get(c.id) ?? 0), 0), population: cs.reduce((s, c) => s + c.population, 0),
    examples: [...cs].sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0)).slice(0, 4).map((c) => c.name),
  });
  return { gdpBelow, literacyFrom, literate: side(poor.filter((c) => c.literacy! >= literacyFrom)), rest: side(poor.filter((c) => c.literacy! < literacyFrom)) };
}

// ------------------------------------------------------------------ athletes (athlete level)
export interface AthleteRow { athleteId: number; name: string; country: string; sport: string; gold: number; silver: number; bronze: number; total: number; games: number }

export function athleteStats(d: Dataset, sport: string | 'all' = 'all') {
  const sportName = new Map(d.sports.map((s) => [s.id, s.name]));
  const countryName = new Map(d.countries.map((c) => [c.id, c.name]));
  const athleteById = new Map(d.athletes.map((a) => [a.id, a]));
  const recs = d.records.filter((r) => r.athleteId !== null && (sport === 'all' || sportName.get(r.sportId) === sport));

  const byAthlete = new Map<number, AthleteRow & { gamesSet: Set<number> }>();
  for (const r of recs) {
    const a = athleteById.get(r.athleteId!);
    if (!a) continue;
    if (!byAthlete.has(a.id)) byAthlete.set(a.id, { athleteId: a.id, name: a.name, country: countryName.get(r.countryId) ?? a.country, sport: sportName.get(r.sportId) ?? a.sport, gold: 0, silver: 0, bronze: 0, total: 0, games: 0, gamesSet: new Set() });
    const row = byAthlete.get(a.id)!;
    row[r.medal] += r.medalCount;
    row.total += r.medalCount;
    row.gamesSet.add(r.gamesId);
  }
  const athletes = [...byAthlete.values()].map(({ gamesSet, ...row }) => ({ ...row, games: gamesSet.size }))
    .sort((a, b) => b.total - a.total || b.gold - a.gold || a.name.localeCompare(b.name));

  const ages = recs.map((r) => r.age).filter((a): a is number => a !== null);
  const bins: [string, number, number][] = [['14–17', 0, 17], ['18–21', 18, 21], ['22–25', 22, 25], ['26–29', 26, 29], ['30–33', 30, 33], ['34–37', 34, 37], ['38–41', 38, 41], ['42+', 42, 200]];
  const histogram = bins.map(([label, lo, hi]) => ({ label, count: ages.filter((a) => a >= lo && a <= hi).length }));

  const agesBySport = new Map<string, number[]>();
  for (const r of recs) if (r.age !== null) {
    const s = sportName.get(r.sportId)!;
    if (!agesBySport.has(s)) agesBySport.set(s, []);
    agesBySport.get(s)!.push(r.age);
  }
  const ageBySport = [...agesBySport.entries()].filter(([, a]) => a.length >= 40)
    .map(([s, a]) => ({ sport: s, median: median(a), q1: quantile(a, 0.25), q3: quantile(a, 0.75), n: a.length }))
    .sort((a, b) => a.median - b.median);

  return {
    athletes, medallists: athletes.length, multiMedallists: athletes.filter((a) => a.total > 1).length,
    medianAge: median(ages), minAge: Math.min(...ages), maxAge: Math.max(...ages), histogram, ageBySport,
  };
}

// ------------------------------------------------------------------ sport strategy
export interface SportReturn {
  sport: string;
  season: Season;
  isTeam: boolean;
  /** medals as awarded to nations (team sports once per team), all Games */
  medals: number;
  /** distinct athletes who won a medal in the sport */
  medallists: number;
  /** medals ÷ medallists: the return per funded athlete */
  perMedallist: number;
  /** share of medallists who won more than one medal in the sport */
  multiShare: number;
  /** nations that won at least one medal in the sport */
  nations: number;
}

/**
 * Return per athlete, per sport (same as the notebook's sport_profile): team-adjusted medals ÷ distinct medallists.
 * In swimming one medallist wins about 2 medals; in football a squad of ~18 shares one (0.07 per athlete).
 */
export function sportReturns(d: Dataset): SportReturn[] {
  const medals = new Map<number, number>();
  for (const m of eventMedals(d.records, d.sports)) medals.set(m.sportId, (medals.get(m.sportId) ?? 0) + m.count);
  const perAthlete = new Map<number, Map<number, number>>();   // sport -> athlete -> medals
  const nations = new Map<number, Set<number>>();
  for (const r of d.records) {
    if (!nations.has(r.sportId)) nations.set(r.sportId, new Set());
    nations.get(r.sportId)!.add(r.countryId);
    if (r.athleteId === null) continue;
    if (!perAthlete.has(r.sportId)) perAthlete.set(r.sportId, new Map());
    const a = perAthlete.get(r.sportId)!;
    a.set(r.athleteId, (a.get(r.athleteId) ?? 0) + r.medalCount);
  }
  return d.sports.filter((s) => (perAthlete.get(s.id)?.size ?? 0) > 0).map((s) => {
    const athletes = [...perAthlete.get(s.id)!.values()];
    const total = medals.get(s.id) ?? 0;
    return {
      sport: s.name, season: s.season, isTeam: s.countingRule === 'team', medals: total, medallists: athletes.length,
      perMedallist: total / athletes.length, multiShare: athletes.filter((n) => n > 1).length / athletes.length,
      nations: nations.get(s.id)?.size ?? 0,
    };
  }).sort((a, b) => b.perMedallist - a.perMedallist);
}

// ------------------------------------------------------------------ data quality
export function qualityChecks(d: Dataset) {
  const athleteById = new Map(d.athletes.map((a) => [a.id, a]));
  const countryName = new Map(d.countries.map((c) => [c.id, c.name]));
  const sportName = new Map(d.sports.map((s) => [s.id, s.name]));
  const gamesYear = new Map(d.games.map((g) => [g.id, g.year]));
  const missingAthlete: number[] = [], countryMismatch: number[] = [], sportMismatch: number[] = [], ageMismatch: number[] = [];
  for (const r of d.records) {
    const a = r.athleteId === null ? undefined : athleteById.get(r.athleteId);
    if (!a) { missingAthlete.push(r.id); continue; }
    if (a.country !== countryName.get(r.countryId)) countryMismatch.push(r.id);
    if (a.sport !== sportName.get(r.sportId)) sportMismatch.push(r.id);
    if (r.age !== null && Math.abs((gamesYear.get(r.gamesId)! - a.birthYear) - r.age) > 1) ageMismatch.push(r.id);
  }
  return { missingAthlete, countryMismatch, sportMismatch, ageMismatch };
}
