/**
 * Medal counting (team sports once per team): the single most important rule in the app.
 *
 * The source data has one row per ATHLETE medal. In team sports every squad
 * member has a row, so one football gold appears ~18 times. This rule gets as
 * close to "medals as awarded to nations" as the data allows: a team medal counts once.
 * Limit: the data has no event column, so relays and crews inside mixed sports
 * (swimming, athletics, rowing) still count per athlete (~1.5x official totals).
 *
 * Rule:
 *  - sport.countingRule === 'team'       -> 1 medal per country x Games x sport x colour
 *  - sport.countingRule === 'individual' -> sum of medalCount (Phelps 2008 = 8)
 *
 * Every event-level number on every screen goes through eventMedals().
 * The Athletes screen deliberately does NOT use it (athlete level).
 */
import type { Dataset, MedalRecord, MedalType, Sport, Tally } from './types';

/** A medal as awarded to a nation (after collapsing team squads). */
export interface EventMedal {
  countryId: number;
  gamesId: number;
  sportId: number;
  medal: MedalType;
  count: number;
}

export function eventMedals(records: MedalRecord[], sports: Sport[]): EventMedal[] {
  const ruleBySport = new Map(sports.map((s) => [s.id, s.countingRule]));
  const countedTeams = new Set<string>();
  const out: EventMedal[] = [];

  for (const rec of records) {
    if (ruleBySport.get(rec.sportId) === 'team') {
      const key = [rec.countryId, rec.gamesId, rec.sportId, rec.medal].join('|');
      if (countedTeams.has(key)) continue; // this squad's medal is already counted
      countedTeams.add(key);
      out.push({ countryId: rec.countryId, gamesId: rec.gamesId, sportId: rec.sportId, medal: rec.medal, count: 1 });
    } else {
      out.push({ countryId: rec.countryId, gamesId: rec.gamesId, sportId: rec.sportId, medal: rec.medal, count: rec.medalCount });
    }
  }
  return out;
}

export const emptyTally = (): Tally => ({ gold: 0, silver: 0, bronze: 0, total: 0 });

export function addToTally(t: Tally, medal: MedalType, count: number): Tally {
  t[medal] += count;
  t.total += count;
  return t;
}

/** Sum event medals into one tally. */
export function tally(medals: EventMedal[]): Tally {
  return medals.reduce((t, m) => addToTally(t, m.medal, m.count), emptyTally());
}

/** Group event medals by any key and tally each group. */
export function tallyBy<K>(medals: EventMedal[], keyOf: (m: EventMedal) => K): Map<K, Tally> {
  const map = new Map<K, Tally>();
  for (const m of medals) {
    const k = keyOf(m);
    if (!map.has(k)) map.set(k, emptyTally());
    addToTally(map.get(k)!, m.medal, m.count);
  }
  return map;
}

/** Convenience: event medals for a whole dataset. */
export const datasetEventMedals = (d: Dataset) => eventMedals(d.records, d.sports);
