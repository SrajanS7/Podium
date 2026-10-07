import { useEffect, useMemo, useState } from 'react';
import { qualityChecks } from '../../domain/metrics';
import type { MedalRecord, MedalType } from '../../domain/types';
import { useDataset } from '../../store/useDataStore';
import { fmt } from '../../utils/format';
import { RecordEditor } from './RecordEditor';

export type ReviewFilter = 'all' | 'missingAthlete' | 'countryMismatch' | 'sportMismatch' | 'ageMismatch';
type SortKey = 'id' | 'athlete' | 'nation' | 'games' | 'sport' | 'medal' | 'count' | 'age';

const PAGE = 12;
const MEDAL_ORDER: Record<MedalType, number> = { gold: 1, silver: 2, bronze: 3 };
const MEDAL_COLOR: Record<MedalType, string> = { gold: 'var(--color-gold)', silver: 'var(--color-silver)', bronze: 'var(--color-bronze)' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function RecordsTab({ review, setReview, addSignal, goToSports }: {
  review: ReviewFilter; setReview: (r: ReviewFilter) => void; addSignal: number; goToSports: () => void;
}) {
  const d = useDataset();
  const [query, setQuery] = useState('');
  const [gamesId, setGamesId] = useState<number | 'all'>('all');
  const [medal, setMedal] = useState<MedalType | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: 1 });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<MedalRecord | null>(null);

  // "Add medal record" button in the page header opens a blank form
  useEffect(() => {
    if (addSignal === 0) return;
    const nextId = Math.max(...d.records.map((r) => r.id)) + 1;
    setEditing({ id: nextId, athleteId: null, countryId: 0, gamesId: 0, sportId: 0, medal: 'gold', medalCount: 1, age: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const checks = useMemo(() => qualityChecks(d), [d]);
  const reviewIds = useMemo(() => (review === 'all' ? null : new Set(checks[review])), [checks, review]);

  // Join the fact table to its dimensions once, for display, search and sort
  const rows = useMemo(() => {
    const athlete = new Map(d.athletes.map((a) => [a.id, a.name]));
    const nation = new Map(d.countries.map((c) => [c.id, c.name]));
    const sport = new Map(d.sports.map((s) => [s.id, s.name]));
    const games = new Map(d.games.map((g) => [g.id, `${g.city} ${g.year}`]));
    return d.records.map((r) => ({
      rec: r,
      athlete: r.athleteId === null ? '' : athlete.get(r.athleteId) ?? `#${r.athleteId}`,
      nation: nation.get(r.countryId) ?? '?', games: games.get(r.gamesId) ?? '?', sport: sport.get(r.sportId) ?? '?',
    }));
  }, [d]);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    (gamesId === 'all' || r.rec.gamesId === gamesId) && (medal === 'all' || r.rec.medal === medal) &&
    (!reviewIds || reviewIds.has(r.rec.id)) &&
    (!q || `${r.athlete} ${r.nation} ${r.sport} ${r.rec.id}`.toLowerCase().includes(q)));

  const value = (r: (typeof rows)[number]): string | number => {
    switch (sort.key) {
      case 'id': return r.rec.id;
      case 'medal': return MEDAL_ORDER[r.rec.medal];
      case 'count': return r.rec.medalCount;
      case 'age': return r.rec.age ?? -1;
      default: return r[sort.key];
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const va = value(a), vb = value(b);
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * PAGE, current * PAGE + PAGE);

  const header = (key: SortKey, label: string, num = false) => (
    <th scope="col" className={num ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
  const resetPage = () => setPage(0);
  const flagged = (id: number) => checks.missingAthlete.includes(id);

  return (
    <>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card" style={{ flex: '999 1 560px', padding: 16 }} aria-label="Medal records">
          <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
            <label className="field" style={{ flex: '2 1 200px' }}>Search
              <input type="search" placeholder="Athlete, nation, sport or ID" value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }} />
            </label>
            <label className="field" style={{ flex: '1 1 140px' }}>Games
              <select value={gamesId} onChange={(e) => { setGamesId(e.target.value === 'all' ? 'all' : Number(e.target.value)); resetPage(); }}>
                <option value="all">All Games</option>
                {[...d.games].sort((a, b) => a.year - b.year).map((g) => <option key={g.id} value={g.id}>{g.city} {g.year}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: '1 1 120px' }}>Medal
              <select value={medal} onChange={(e) => { setMedal(e.target.value as MedalType | 'all'); resetPage(); }}>
                <option value="all">All medals</option><option value="gold">Gold</option><option value="silver">Silver</option><option value="bronze">Bronze</option>
              </select>
            </label>
            <label className="field" style={{ flex: '1 1 170px' }}>Show
              <select value={review} onChange={(e) => { setReview(e.target.value as ReviewFilter); resetPage(); }}>
                <option value="all">All records</option>
                <option value="missingAthlete">No athlete ({checks.missingAthlete.length})</option>
                <option value="countryMismatch">Nation conflicts ({checks.countryMismatch.length})</option>
                <option value="sportMismatch">Sport conflicts ({checks.sportMismatch.length})</option>
                <option value="ageMismatch">Age mismatches ({checks.ageMismatch.length})</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                {header('id', 'ID')}{header('athlete', 'Athlete')}{header('nation', 'Nation')}{header('games', 'Games')}
                {header('sport', 'Sport')}{header('medal', 'Medal')}{header('count', 'Medals', true)}{header('age', 'Age', true)}
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.rec.id} className={editing?.id === r.rec.id ? 'is-selected' : flagged(r.rec.id) ? 'is-flagged' : ''}>
                    <td className="muted">{r.rec.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.athlete || <span className="muted">No athlete</span>}</td>
                    <td>{r.nation}</td><td>{r.games}</td><td>{r.sport}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: MEDAL_COLOR[r.rec.medal] }} />{cap(r.rec.medal)}</span></td>
                    <td className="num">{r.rec.medalCount}</td>
                    <td className="num">{r.rec.age ?? '—'}</td>
                    <td><button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(r.rec)} aria-label={`Edit record ${r.rec.id}${r.athlete ? `, ${r.athlete}` : ''}`}>Edit</button></td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={9} className="muted">No records match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card-head" style={{ alignItems: 'center' }}>
            <span className="muted small">Showing {sorted.length ? current * PAGE + 1 : 0}–{Math.min(sorted.length, (current + 1) * PAGE)} of {fmt(sorted.length)} records</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-small" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="btn btn-small" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </span>
          </div>
        </section>

        {editing && <RecordEditor key={editing.id} record={editing} onClose={() => setEditing(null)} goToSports={goToSports} />}
      </div>

      <section className="card" aria-labelledby="quality">
        <div className="card-head">
          <h2 id="quality" className="card-title">Data quality checks</h2>
          <span className="muted small">Re-run automatically after every change</span>
        </div>
        <div className="grid-kpi">
          {([
            ['missingAthlete', 'Medal records with no athlete'],
            ['countryMismatch', "Athlete's nation differs from the medal's nation"],
            ['sportMismatch', "Athlete's sport differs from the medal's sport"],
            ['ageMismatch', 'Age differs from birth year by more than 1'],
          ] as const).map(([key, label]) => (
            <div key={key} className="quality-item">
              <span style={{ fontSize: 24, fontWeight: 700 }}>{checks[key].length}</span>
              <span style={{ fontSize: 14 }}>{label}</span>
              <button type="button" className="btn btn-ghost btn-small" style={{ alignSelf: 'flex-start', padding: 0 }}
                onClick={() => { setReview(key); resetPage(); }} disabled={checks[key].length === 0}>Review</button>
            </div>
          ))}
        </div>
        <p className="muted small">The medal record is treated as the source of truth for nation and sport; conflicts are shown for review, not changed automatically.</p>
      </section>
    </>
  );
}
