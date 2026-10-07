import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { InsightBanner, InsightCard, KpiCard, PageHeader } from '../components/ui/Card';
import { IconGoldMedal, IconMedallist, IconPodium, IconRunner } from '../components/ui/Icons';
import { ChartFrame } from '../components/ui/ChartFrame';
import { FilterBar } from '../components/ui/FilterBar';
import { MedalBar, MedalLegend, SeasonLegend } from '../components/charts/MedalBar';
import { GamesTick } from '../components/charts/GamesTick';
import { athleteStats, countryRows, hostEffect, medalsPerGames, overviewStats } from '../domain/metrics';
import { median } from '../domain/stats';
import { useDataStore, useDataset } from '../store/useDataStore';
import { axisTick, C, seasonColor } from '../styles/colors';
import { fmt, pct, signedPct } from '../utils/format';

/** Screen 1: the one-minute picture, with routes into the detail screens. */
export default function OverviewPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);

  const o = useMemo(() => overviewStats(d, filters), [d, filters]);
  const bars = useMemo(() => medalsPerGames(d, filters), [d, filters]);
  const hostMedian = useMemo(() => median(hostEffect(d).map((h) => h.upliftPct)), [d]);
  const topAthlete = useMemo(() => athleteStats(d).athletes[0], [d]);
  // Compared over all Games (athlete totals are for 2000–2012), independent of the filters
  const allGames = useMemo(() => countryRows(d, { season: 'all', gamesId: 'all' }).filter((r) => r.total > 0), [d]);
  const nationsBelowTopAthlete = topAthlete ? allGames.filter((r) => r.total < topAthlete.total).length : 0;

  const max = o.top10[0]?.total ?? 1;
  const withoutMedal = o.nationsTotal - o.nationsWithMedal;

  return (
    <>
      <PageHeader title="Overview" subtitle="Olympic medals 2000–2012 · 7 Games from Sydney to London">
        <FilterBar />
      </PageHeader>

      <InsightBanner linkTo="/countries" linkText="Explore countries">
        A small club wins most medals: the top 10 nations took {pct(o.top10Share)} of all medals, and {withoutMedal} of {o.nationsTotal} nations won none.
      </InsightBanner>

      <div className="grid-kpi">
        <KpiCard icon={<IconGoldMedal />} label="Medals awarded" value={fmt(o.totalMedals)} note="Team sports (football, hockey…) count once per team" />
        <KpiCard icon={<IconPodium />} label="Nations on the podium" value={o.nationsWithMedal} unit={`of ${o.nationsTotal}`} note="Won at least one medal" />
        <KpiCard icon={<IconMedallist />} label="Medallists" value={fmt(o.medallists)} note={`${fmt(o.multiMedallists)} won more than one medal`} />
        <KpiCard icon={<IconRunner />} label="Sports" value={o.sportsCount} note={`${o.summerSports} Summer · ${o.winterSports} Winter`} />
      </div>

      <div className="row">
        <ChartFrame
          style={{ flex: '1 1 440px' }}
          title="Medals per Games"
          summary="Totals are stable within a season, so Games compare fairly Summer-to-Summer and Winter-to-Winter. Relay and crew medals still count once per athlete, so totals run above the official medal tables."
          legend={<SeasonLegend />}
          table={{ headers: ['Games', 'Season', 'Medals'], rows: bars.map((b) => [b.label, b.season, fmt(b.total)]) }}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 24, right: 8, left: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={<GamesTick />} interval={0} height={40} />
                <YAxis tick={axisTick} width={52} label={{ value: 'Medals awarded', angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle' }, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
                <Tooltip formatter={(v) => [fmt(Number(v)), 'Medals']} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {bars.map((b) => <Cell key={b.gamesId} fill={seasonColor(b.season)} />)}
                  <LabelList dataKey="total" position="top" formatter={(v) => fmt(Number(v))} style={{ fontSize: 12, fontWeight: 600, fill: C.text }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <section className="card" style={{ flex: '1 1 380px' }} aria-labelledby="top10">
          <div className="card-head">
            <h2 id="top10" className="card-title">Top 10 nations</h2>
            <Link to="/countries" style={{ fontWeight: 600, textDecoration: 'none' }}>All nations</Link>
          </div>
          <div className="legend"><MedalLegend /><span className="muted">Hover a nation for its medal split</span></div>
          <ol className="hbar-list" style={{ listStyle: 'none' }}>
            {o.top10.map((r) => (
              <li key={r.countryId} className="hbar-row has-tip" tabIndex={0} style={{ gridTemplateColumns: '24px minmax(100px,130px) minmax(0,1fr) 48px' }}>
                <span className="muted" style={{ fontWeight: 600 }}>{r.rank}</span>
                <span className="hbar-label" style={{ fontWeight: 500 }}>{r.name}</span>
                <MedalBar t={r} max={max} name={r.name} />
                <span className="hbar-value">{fmt(r.total)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid-3">
        <InsightCard to="/drivers" tag="Drivers" tagClass="tag-warm" value={signedPct(hostMedian)}
          text="Median medal uplift for host nations compared with their own other Games." linkText="See what drives success" />
        {topAthlete && (
          <InsightCard to="/athletes" tag="Athletes" value={`${topAthlete.total} medals`}
            text={`${topAthlete.name} alone won more medals (2000–2012) than ${nationsBelowTopAthlete} of the ${allGames.length} medal-winning nations.`} linkText="Explore athletes" />
        )}
        <InsightCard to="/countries" tag="Sports" tagClass="tag-green" value={pct(o.top2Share)}
          text={`of all medals come from just two sports: ${o.top2Names.join(' and ').toLowerCase()}.`} linkText="Compare countries" />
      </div>

      <p className="footnote">
        Source: Olympic Games dataset, 2000–2012. Medals in team sports (football, hockey, basketball…) count once per team; in other sports,
        including relays and rowing crews, each athlete's medal counts, so totals run about 1.5× the official
        medal tables (the data has no event column to collapse them). Nation rankings stay reliable: rank correlation 0.97
        with the official Beijing 2008 table. Rules are editable in the <Link to="/data">Data manager</Link>. Athlete counts include every team member.
      </p>
    </>
  );
}

