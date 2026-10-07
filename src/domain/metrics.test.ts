/**
 * Golden-value tests: the expected numbers come from the independent Python
 * analysis of the same workbook. If a change breaks the counting rule or a
 * metric, these fail immediately.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventMedals, tally } from './counting';
import { athleteStats, bestBets, countryRows, sportAgeFit, sportMedalsFor, correlationMatrix, expectedMedalsModel, geographyInsights, literacyModelChanges, hostEffect, literacyContrast, overviewStats, qualityChecks, regionStats } from './metrics';
import { linearRegression, spearman } from './stats';
import type { Dataset, Filters } from './types';
import { validateMedalRecord } from './validation';

const data: Dataset = JSON.parse(readFileSync('public/data/dataset.json', 'utf8'));
const ALL: Filters = { season: 'all', gamesId: 'all' };
const byName = (name: string) => countryRows(data, ALL).find((r) => r.name === name)!;

describe('event-level counting', () => {
  it('counts every medal once per team: 6,854 event-level medals in total', () => {
    expect(tally(eventMedals(data.records, data.sports)).total).toBe(6854);
  });
  it('football: 2 events x 3 medals x 4 Games = 24', () => {
    const football = data.sports.find((s) => s.name === 'Football')!;
    const medals = eventMedals(data.records.filter((r) => r.sportId === football.id), data.sports);
    expect(tally(medals).total).toBe(24);
  });
  it('switching a sport to per-athlete counting restores raw rows (407 for football)', () => {
    const sports = data.sports.map((s) => (s.name === 'Football' ? { ...s, countingRule: 'individual' as const } : s));
    const football = sports.find((s) => s.name === 'Football')!;
    expect(tally(eventMedals(data.records.filter((r) => r.sportId === football.id), sports)).total).toBe(407);
  });
});

describe('country metrics', () => {
  it('USA 868 and Germany 505 (176 / 169 / 160)', () => {
    expect(byName('United States').total).toBe(868);
    expect(byName('Germany')).toMatchObject({ gold: 176, silver: 169, bronze: 160, total: 505, rank: 3 });
  });
  it('108 of 227 nations won a medal; top 10 share is 59%', () => {
    const o = overviewStats(data, ALL);
    expect(o.nationsWithMedal).toBe(108);
    expect(o.nationsTotal).toBe(227);
    expect(Math.round(o.top10Share * 100)).toBe(59);
  });
  it('season filter: Summer Games total 5,765', () => {
    expect(overviewStats(data, { season: 'Summer', gamesId: 'all' }).totalMedals).toBe(1421 + 1419 + 1460 + 1465);
  });
});

describe('drivers of success', () => {
  it('host effect: Greece +104%, USA 2002 -1%', () => {
    const h = hostEffect(data);
    expect(Math.round(h.find((r) => r.country === 'Greece')!.upliftPct)).toBe(104);
    expect(Math.round(h.find((r) => r.country === 'United States')!.upliftPct)).toBe(-1);
  });
  it('correlation matrix matches pandas (Spearman, pairwise): medals vs economy 0.75, gold 0.89, birthrate -0.48', () => {
    const m = correlationMatrix(data, ALL);
    const at = (a: string, b: string) => Math.round(m.rho[m.labels.indexOf(a)][m.labels.indexOf(b)]! * 100) / 100;
    expect(m.labels).toHaveLength(9);
    expect([at('Total medals', 'Gold medals'), at('Total medals', 'Economy size'), at('Total medals', 'Population'), at('Total medals', 'GDP per person')]).toEqual([0.89, 0.75, 0.56, 0.37]);
    expect([at('Total medals', 'Literacy'), at('Total medals', 'Birthrate'), at('Total medals', 'Land area'), at('Total medals', 'Pop. density')]).toEqual([0.47, -0.48, 0.43, -0.02]);
    expect([at('GDP per person', 'Birthrate'), at('Literacy', 'Birthrate'), at('Population', 'Land area')]).toEqual([-0.82, -0.8, 0.83]);
  });
  it('the matrix is symmetric with 1 on the diagonal', () => {
    const m = correlationMatrix(data, ALL);
    m.labels.forEach((_, i) => {
      expect(m.rho[i][i]).toBeCloseTo(1);
      m.labels.forEach((__, j) => expect(m.rho[i][j]).toBeCloseTo(m.rho[j][i]!));
    });
  });
  it('Poisson model matches statsmodels: coefficients and 77% deviance explained', () => {
    const m = expectedMedalsModel(data, ALL);
    expect(m.explained).toBeCloseTo(0.766, 2);
    expect(Math.log(m.popMultiplier)).toBeCloseTo(1.568, 2);
    expect(Math.log(m.gdpMultiplier)).toBeCloseTo(2.504, 2);
  });
  it('the biggest exceptions are Jamaica and Cuba', () => {
    const over = expectedMedalsModel(data, ALL).points.filter((p) => p.actual >= 10).sort((a, b) => b.performance - a.performance);
    expect(over.slice(0, 2).map((p) => p.name)).toEqual(['Jamaica', 'Cuba']);
  });
});

describe('athletes (athlete level)', () => {
  it('Michael Phelps: 22 medals, 18 gold, 3 Games', () => {
    expect(athleteStats(data).athletes[0]).toMatchObject({ name: 'Michael Phelps', total: 22, gold: 18, games: 3 });
  });
  it('6,955 medallists, 1,665 multi-medallists, median age 26', () => {
    const s = athleteStats(data);
    expect([s.medallists, s.multiMedallists, s.medianAge]).toEqual([6955, 1665, 26]);
  });
});

describe('data quality and validation', () => {
  it('finds the known issues: 5 / 8 / 22 / 15', () => {
    const q = qualityChecks(data);
    expect([q.missingAthlete.length, q.countryMismatch.length, q.sportMismatch.length, q.ageMismatch.length]).toEqual([5, 8, 22, 15]);
  });
  it('blocks a Summer sport at a Winter Games and an impossible age', () => {
    const rowing = data.sports.find((s) => s.name === 'Rowing')!;
    const vancouver = data.games.find((g) => g.year === 2010)!;
    const res = validateMedalRecord({ ...data.records[0], sportId: rowing.id, gamesId: vancouver.id, age: 5 }, data);
    expect(res.errors.sportId).toMatch(/Summer sport/);
    expect(res.errors.age).toBeDefined();
  });
});

describe('stats helpers', () => {
  it('spearman of a perfect monotonic relation is 1', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 400, 8000])).toBeCloseTo(1);
  });
  it('regression recovers y = 2 + 3x', () => {
    const r = linearRegression([[1], [2], [3], [4]], [5, 8, 11, 14]);
    expect(r.coefficients[0]).toBeCloseTo(2);
    expect(r.coefficients[1]).toBeCloseTo(3);
    expect(r.rSquared).toBeCloseTo(1);
  });
});

describe('geography myths (golden values from the Python analysis, team sports once)', () => {
  const g = geographyInsights(data, ALL);
  const r2 = (x: number | null) => Math.round((x ?? NaN) * 100) / 100;
  it('coastline: water-sport medals per 10M people are about the same with or without a coast', () => {
    expect(g.coast.map((b) => r2(b.waterPerTenMillion))).toEqual([3.19, 2.96, 2.99, 3.56]);
    expect(g.coast.map((b) => Math.round(b.waterShare * 1000) / 10)).toEqual([25.7, 33.7, 22.7, 36.8]);
  });
  it('sailing is the exception: landlocked nations hold 9.1% of medals but 3.3% of sailing medals', () => {
    expect(Math.round(g.coast[0].shareOfMedals * 1000) / 10).toBe(9.1);
    expect(Math.round(g.coast[0].shareOfSailing * 1000) / 10).toBe(3.3);
  });
  it('landlocked water winners: Hungary first with 66 of 95', () => {
    expect(g.landlockedWater[0]).toMatchObject({ name: 'Hungary', waterMedals: 66, medals: 95 });
    expect(g.landlockedWater).toHaveLength(8);
  });
  it('density: actual vs expected 1.46 / 0.86 / 1.19 / 0.52', () => {
    expect(g.density.map((b) => r2(b.actualVsExpected))).toEqual([1.46, 0.86, 1.19, 0.52]);
  });
  it('migration: medals per 10M 6.6 / 4.7 / 46.5 but actual vs expected only 0.93 / 0.76 / 1.23', () => {
    expect(g.migration.map((b) => Math.round(b.perTenMillion * 10) / 10)).toEqual([6.6, 4.7, 46.5]);
    expect(g.migration.map((b) => r2(b.actualVsExpected))).toEqual([0.93, 0.76, 1.23]);
  });
});

describe('regions and literacy', () => {
  const r = regionStats(data, ALL);
  it('Oceania wins most per person (132.5 per 10M), Sub-Saharan Africa least (1.8)', () => {
    expect(r[0].key).toBe('Oceania');
    expect(Math.round(r[0].perTenMillion * 10) / 10).toBe(132.5);
    expect(r[r.length - 1]).toMatchObject({ key: 'Sub-Saharan Africa' });
    expect(Math.round(r[r.length - 1].perTenMillion * 10) / 10).toBe(1.8);
  });
  it('Western Europe: 32% of medals; CIS 3.89x what population and wealth predict', () => {
    expect(Math.round(r.find((x) => x.key === 'Western Europe')!.shareOfMedals * 100)).toBe(32);
    expect(Math.round(r.find((x) => x.key === 'CIS (former USSR)')!.actualVsExpected! * 100) / 100).toBe(3.89);
  });
  it('poorer nations: 19 of 23 highly literate ones won a medal vs 18 of 63 others (866 vs 237 medals)', () => {
    const l = literacyContrast(data, ALL);
    expect([l.literate.winners, l.literate.nations, l.literate.medals]).toEqual([19, 23, 866]);
    expect([l.rest.winners, l.rest.nations, l.rest.medals]).toEqual([18, 63, 237]);
  });
});

describe('literacy model (Additional insights)', () => {
  const m = expectedMedalsModel(data, ALL, { literacy: true });
  it('matches statsmodels: 209 nations, 85% explained, +10 literacy points = 3.4x medals', () => {
    expect(m.n).toBe(209);
    expect(m.explained).toBeCloseTo(0.846, 2);
    expect(m.literacyMultiplier!).toBeCloseTo(3.44, 1);
    expect(Math.log(m.gdpMultiplier)).toBeCloseTo(1.164, 2);
  });
  it("literacy explains most of India's gap: expected falls from about 158 to about 6", () => {
    const india = literacyModelChanges(data, ALL).find((c) => c.name === 'India')!;
    expect([Math.round(india.expectedBase), Math.round(india.expected)]).toEqual([158, 6]);
  });
  it('the default model is unchanged: 226 nations, no literacy', () => {
    expect(expectedMedalsModel(data, ALL)).toMatchObject({ withLiteracy: false, n: 226, literacyMultiplier: null });
  });
});

describe('find your sport (golden values from the Python analysis)', () => {
  const count = (age: number) => sportAgeFit(data, age).reduce((m, f) => ({ ...m, [f.status]: (m[f.status] ?? 0) + 1 }), {} as Record<string, number>);
  it('44 sports with 40+ medallist ages; at 25 most are in the prime window', () => {
    expect(sportAgeFit(data, 25)).toHaveLength(44);
    expect(count(25)).toEqual({ prime: 37, reach: 5, longshot: 2 });
  });
  it('windows by age: 18, 31 and 45', () => {
    expect(count(18)).toEqual({ prime: 2, reach: 3, longshot: 25, out: 14 });
    expect(count(31)).toEqual({ prime: 10, reach: 17, longshot: 16, out: 1 });
    expect(count(45)).toEqual({ reach: 1, longshot: 5, out: 38 });
  });
  it('at 25: past the gymnastics window, prime for shooting; equestrian median 39, oldest medallist 61', () => {
    const f = new Map(sportAgeFit(data, 25).map((x) => [x.sport, x]));
    expect(f.get('Gymnastics')!.status).toBe('reach');
    expect(f.get('Rhythmic Gymnastics')!.status).toBe('longshot');
    expect(f.get('Shooting')!.status).toBe('prime');
    expect(f.get('Equestrian')).toMatchObject({ median: 39, max: 61 });
  });
  it('Germany at 25: best bets canoeing (68), rowing (46), biathlon (40)', () => {
    const germany = data.countries.find((c) => c.name === 'Germany')!;
    const bets = bestBets(sportAgeFit(data, 25), sportMedalsFor(data, { countryId: germany.id }));
    expect(bets.slice(0, 3).map((b) => [b.sport, b.medals])).toEqual([['Canoeing', 68], ['Rowing', 46], ['Biathlon', 40]]);
  });
});
