import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KpiCard, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { Dropdown } from '../components/ui/Dropdown';
import { MedalBar, MedalLegend } from '../components/charts/MedalBar';
import { athleteStats } from '../domain/metrics';
import { useDataset } from '../store/useDataStore';
import { axisTick, C, seasonColor } from '../styles/colors';
import { fmt, pct } from '../utils/format';

const PAGE = 15;

/** Screen 4: ATHLETE level - every athlete's medals count, including team members. */
export default function AthletesPage() {
  const d = useDataset();
  const [sport, setSport] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const s = useMemo(() => athleteStats(d, sport), [d, sport]);
  const seasonOf = useMemo(() => new Map(d.sports.map((x) => [x.name, x.season])), [d]);
  const sportsWithMedals = useMemo(() => [...new Set(d.sports.map((x) => x.name))].sort(), [d]);

  const q = query.trim().toLowerCase();
  const filtered = q ? s.athletes.filter((a) => `${a.name} ${a.country}`.toLowerCase().includes(q)) : s.athletes;
  const list = filtered.slice(0, shown);
  const max = s.athletes[0]?.total ?? 1;
  const swimmersInTop10 = s.athletes.slice(0, 10).filter((a) => a.sport === 'Swimming').length;
  const ageWindow = s.ageBySport.length ? [s.ageBySport[0], s.ageBySport[s.ageBySport.length - 1]] : [];
  const span = { lo: 15, hi: 45 };
  const pos = (v: number) => `${((Math.min(Math.max(v, span.lo), span.hi) - span.lo) / (span.hi - span.lo)) * 100}%`;
  const peakShare = s.histogram.filter((h) => h.label === '22–25' || h.label === '26–29').reduce((a, h) => a + h.count, 0) / Math.max(1, s.histogram.reduce((a, h) => a + h.count, 0));

  return (
    <>
      <PageHeader title="Athletes" badge="2000–2012" subtitle="Who wins, how often, and at what age, across 7 Olympic Games from Sydney 2000 to London 2012.">
        <Dropdown<string> label="Sport" value={sport} onChange={(v) => { setSport(v); setShown(PAGE); }}
          options={[{ value: 'all', label: 'All sports' }, ...sportsWithMedals.map((n) => ({ value: n, label: n }))]} />
        <label className="field">Search athlete or nation
          <input type="search" value={query} placeholder="e.g. Phelps" onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} />
        </label>
      </PageHeader>
      <span className="tag tag-warm">Athlete level: every team member's medal is counted</span>

      <div className="grid-kpi">
        <KpiCard label="Medallists" value={fmt(s.medallists)} note={sport === 'all' ? 'Distinct athletes, 2000–2012' : `in ${sport}`} />
        <KpiCard label="Multi-medallists" value={fmt(s.multiMedallists)} unit={pct(s.multiMedallists / Math.max(1, s.medallists))} note="Won more than one medal" />
        <KpiCard label="Median age" value={Number.isFinite(s.medianAge) ? s.medianAge : '—'} note="Age at the Games" />
        <KpiCard label="Age range" value={s.athletes.length ? `${s.minAge}–${s.maxAge}` : '—'} note="Youngest to oldest medallist" />
      </div>

      <section className="card" aria-labelledby="decorated">
        <div className="card-head">
          <h2 id="decorated" className="card-title">Most decorated athletes{sport !== 'all' ? ` · ${sport}` : ''}</h2>
          <div className="legend"><MedalLegend /></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">#</th><th scope="col">Athlete</th><th scope="col">Nation</th><th scope="col">Sport</th><th scope="col" style={{ width: '30%' }}>Medals</th><th scope="col" className="num">Total</th><th scope="col" className="num">Games</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.athleteId}>
                  <td className="muted" style={{ fontWeight: 600 }}>{s.athletes.indexOf(a) + 1}</td>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{a.country}</td>
                  <td>{a.sport}</td>
                  <td><MedalBar t={a} max={max} /></td>
                  <td className="num" style={{ fontWeight: 700 }}>{a.total}</td>
                  <td className="num">{a.games}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="muted">No athletes match “{query}”.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-head">
          <span className="muted small">Showing {list.length} of {fmt(filtered.length)} athletes{sport === 'all' && !q ? ` · ${swimmersInTop10} of the top 10 are swimmers: one athlete can enter many events` : ''}</span>
          {shown < filtered.length && <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>Show {PAGE} more</button>}
        </div>
      </section>

      <div className="row">
        <ChartFrame
          style={{ flex: '1 1 380px' }}
          title="Age of medallists"
          summary={`About ${pct(peakShare)} of medallists are aged 22–29.`}
          table={{ headers: ['Age', 'Medallists'], rows: s.histogram.map((h) => [h.label, fmt(h.count)]) }}
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={s.histogram} margin={{ top: 22, right: 8, left: 12, bottom: 22 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={axisTick} interval={0} label={{ value: 'Age at the Games (years)', position: 'insideBottom', offset: -16, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={axisTick} width={52} label={{ value: 'Number of medallists', angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle' }, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Medallists']} />
                <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" formatter={(v) => fmt(Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: C.text }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          style={{ flex: '1 1 380px' }}
          title="Peak-age window by sport"
          summary={ageWindow.length === 2 ? `Medallists peak youngest in ${ageWindow[0].sport} (median ${ageWindow[0].median}) and oldest in ${ageWindow[1].sport} (median ${ageWindow[1].median}). Bar = middle 50% of medallists, dot = median. Sports with 40+ medallists.` : 'Not enough medallists in this selection.'}
          legend={<><span><span className="swatch" style={{ background: C.summer }} />Summer sport</span><span><span className="swatch" style={{ background: C.winter }} />Winter sport</span></>}
          table={{ headers: ['Sport', 'Median', 'Middle 50%', 'Medallists'], rows: s.ageBySport.map((a) => [a.sport, a.median, `${a.q1}–${a.q3}`, a.n]) }}
        >
          <ul className="hbar-list" style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} tabIndex={0} aria-label="Peak-age window by sport, scrollable list">
            {s.ageBySport.map((a) => {
              const c = seasonColor(seasonOf.get(a.sport) ?? 'Summer');
              return (
                <li key={a.sport} className="hbar-row" style={{ gridTemplateColumns: 'minmax(110px,170px) minmax(0,1fr) 32px' }}>
                  <span className="hbar-label">{a.sport}</span>
                  <span className="hbar-track" style={{ background: '#f4f5f7', borderRadius: 3 }}>
                    <span style={{ position: 'absolute', top: 3, height: 10, left: pos(a.q1), width: `calc(${pos(a.q3)} - ${pos(a.q1)})`, background: c, opacity: 0.4, borderRadius: 5 }} />
                    <span style={{ position: 'absolute', top: 2, left: pos(a.median), width: 12, height: 12, borderRadius: 6, background: c, transform: 'translateX(-50%)' }} />
                  </span>
                  <span className="hbar-value">{a.median}</span>
                </li>
              );
            })}
          </ul>
          <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 'min(180px, 35%)', marginRight: 42 }}>
            {[15, 25, 35, 45].map((v) => <span key={v}>{v}</span>)}
          </div>
          <p className="muted small" style={{ textAlign: 'center', fontWeight: 600, margin: 0 }}>Age at the Games (years)</p>
        </ChartFrame>
      </div>

      <p className="footnote">Athlete-level counts: each athlete's medals are counted individually, including every team member. Medal records with no athlete are excluded on this screen.</p>
    </>
  );
}
