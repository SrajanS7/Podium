import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { Dropdown } from '../components/ui/Dropdown';
import { FilterBar } from '../components/ui/FilterBar';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { countryProfile, countryRows, rankCountries, type RankMode } from '../domain/metrics';
import { useDataStore, useDataset } from '../store/useDataStore';
import { axisTick, C, seasonColor } from '../styles/colors';
import { fmt, fmt1, millions, pct } from '../utils/format';

const DEFAULT_COUNTRY = 'Germany';
const DEFAULT_COMPARE = 'United States';

/** Screen 2: profile one nation, compare it with another, and rank all nations. */
export default function CountriesPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);
  const rows = useMemo(() => countryRows(d, filters), [d, filters]);
  const byName = useMemo(() => [...d.countries].sort((a, b) => a.name.localeCompare(b.name)), [d]);

  const idOf = (name: string) => d.countries.find((c) => c.name === name)?.id ?? d.countries[0].id;
  const [countryId, setCountryId] = useState(() => idOf(DEFAULT_COUNTRY));
  const [compareId, setCompareId] = useState<number | 'none'>(() => idOf(DEFAULT_COMPARE));
  const [mode, setMode] = useState<RankMode>('total');

  const row = rows.find((r) => r.countryId === countryId)!;
  const country = d.countries.find((c) => c.id === countryId)!;
  const profile = useMemo(() => countryProfile(d, filters, countryId), [d, filters, countryId]);
  const compare = useMemo(() => (compareId === 'none' ? null : countryProfile(d, filters, compareId)), [d, filters, compareId]);
  const compareName = compareId === 'none' ? '' : d.countries.find((c) => c.id === compareId)!.name;
  const winners = rows.filter((r) => r.total > 0).length;

  const chartData = profile.perGames.map((g, i) => ({ label: g.label, full: g.full, [country.name]: g.total, ...(compare ? { [compareName]: compare.perGames[i].total } : {}) }));
  const ranking = rankCountries(rows, mode).slice(0, 15);
  const sportsMax = profile.topSports[0]?.total ?? 1;

  return (
    <>
      <PageHeader title="Countries" subtitle="Profile one nation, compare it with another, and see where it ranks.">
        <Dropdown<number> label="Country" value={countryId} onChange={setCountryId} minWidth={180}
          options={byName.map((c) => ({ value: c.id, label: c.name }))} />
        <Dropdown<number | 'none'> label="Compare with" value={compareId} onChange={setCompareId} minWidth={180}
          options={[{ value: 'none', label: 'No comparison' }, ...byName.filter((c) => c.id !== countryId).map((c) => ({ value: c.id, label: c.name }))]} />
        <FilterBar />
      </PageHeader>

      <section className="card" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'center' }} aria-label={`${country.name} profile`}>
        <div className="stack" style={{ gap: 4, flex: '1 1 220px' }}>
          <span className="muted small" style={{ fontWeight: 600 }}>{country.region} · population {millions(country.population)}</span>
          <span style={{ fontSize: 28, fontWeight: 700 }}>{country.name}</span>
          <span className="tag">{row.total > 0 ? `Rank ${row.rank} of ${winners} medal-winning nations` : 'No medals in this selection'}</span>
        </div>
        <dl className="grid-kpi" style={{ flex: '3 1 520px', margin: 0, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          {[
            ['Total medals', fmt(row.total), C.text],
            ['Gold', fmt(row.gold), '#7a5b0a'],
            ['Silver', fmt(row.silver), '#5b6168'],
            ['Bronze', fmt(row.bronze), '#7a4520'],
            ['Per 10 M people', fmt1(row.perTenMillion), C.text],
          ].map(([k, v, color]) => (
            <div key={k} className="stack" style={{ gap: 2 }}>
              <dt className="muted small" style={{ fontWeight: 600 }}>{k}</dt>
              <dd style={{ margin: 0, fontSize: 30, fontWeight: 700, color }}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="row">
        <ChartFrame
          style={{ flex: '3 1 460px' }}
          title={`Medals per Games: ${country.name}${compare ? ` vs ${compareName}` : ''}`}
          summary={compare
            ? `${pct(profile.winterShare)} of ${country.name}'s medals come from Winter Games, vs ${pct(compare.winterShare)} for ${compareName}.`
            : `${pct(profile.winterShare)} of ${country.name}'s medals come from Winter Games.`}
          table={{ headers: ['Games', country.name, ...(compare ? [compareName] : [])],
            rows: profile.perGames.map((g, i) => [g.full, g.total, ...(compare ? [compare.perGames[i].total] : [])]) }}
        >
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 12, bottom: 0 }} barGap={3}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={axisTick} interval={0} />
                <YAxis tick={axisTick} width={48} allowDecimals={false} label={{ value: 'Medals won', angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle' }, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ''} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey={country.name} fill={C.primary} radius={[3, 3, 0, 0]} maxBarSize={28} />
                {compare && <Bar dataKey={compareName} fill={C.summer} radius={[3, 3, 0, 0]} maxBarSize={28} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <section className="card" style={{ flex: '2 1 320px' }} aria-labelledby="topsports">
          <h2 id="topsports" className="card-title">{country.name}'s top sports</h2>
          <p className="muted small">Medals in the current selection · team sports counted once</p>
          {profile.topSports.length === 0 ? <p className="muted">No medals in this selection.</p> : (
            <ul className="hbar-list">
              {profile.topSports.map((s) => (
                <li key={s.sport} className="hbar-row">
                  <span className="hbar-label">{s.sport}</span>
                  <span className="hbar-track"><span style={{ position: 'absolute', inset: 0, width: `${(s.total / sportsMax) * 100}%`, background: seasonColor(s.season), borderRadius: 3 }} /></span>
                  <span className="hbar-value">{s.total}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="legend">
            <span><span className="swatch" style={{ background: C.summer }} />Summer sport</span>
            <span><span className="swatch" style={{ background: C.winter }} />Winter sport</span>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="ranking">
        <div className="card-head" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 2 }}>
            <h2 id="ranking" className="card-title">Nation ranking</h2>
            <span className="muted small">{{ total: 'Sorted by total medals', gold: 'Sorted by gold, then silver, then bronze (Olympic convention)', perCapita: 'Medals per 10 million people · nations with 20+ medals only' }[mode]} · top 15</span>
          </div>
          <SegmentedControl<RankMode> label="Rank by" value={mode} onChange={setMode}
            options={[{ value: 'total', label: 'Total medals' }, { value: 'gold', label: 'Gold medals' }, { value: 'perCapita', label: 'Per 10 M people' }]} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">#</th><th scope="col">Nation</th><th scope="col" className="num">Gold</th><th scope="col" className="num">Silver</th><th scope="col" className="num">Bronze</th><th scope="col" className="num">Total</th><th scope="col" className="num">Per 10 M people</th></tr></thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.countryId} className={r.countryId === countryId ? 'is-selected' : ''}>
                  <td style={{ fontWeight: 600 }}>{i + 1}</td>
                  <td><button type="button" className="btn-ghost btn btn-small" style={{ padding: 0, fontWeight: 500 }} onClick={() => setCountryId(r.countryId)}>{r.name}</button></td>
                  <td className="num">{r.gold}</td><td className="num">{r.silver}</td><td className="num">{r.bronze}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.total}</td><td className="num">{fmt1(r.perTenMillion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Select a nation's name to open its profile.</p>
      </section>

      <p className="footnote">Team sports count once per team; relays and crews count per athlete. Population comes from the Country Data sheet, one snapshot applied to all Games.</p>
    </>
  );
}
