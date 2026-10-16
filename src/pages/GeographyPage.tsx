import { useMemo } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { GeoTip, GroupBars, RatioLegend, ratioText, signed } from '../components/charts/GroupBars';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { FilterBar } from '../components/ui/FilterBar';
import { geographyInsights, type GeoPoint, type GroupStats } from '../domain/metrics';
import { useDataStore, useDataset } from '../store/useDataStore';
import { axisTick, C } from '../styles/colors';
import { fmt, fmt1, pct, usd } from '../utils/format';

const pct1 = (v: number) => `${fmt1(v * 100)}%`;
/** Nations named in the scatter charts: chosen from the data (biggest medal winners plus the extremes on the x axis), not hand-picked. */
const labelSet = (points: GeoPoint[], x: (p: GeoPoint) => number, top = 5, extremes = 2) => {
  const byMedals = [...points].sort((a, b) => b.medals - a.medals).slice(0, top);
  const byX = [...points].sort((a, b) => x(a) - x(b));
  return new Set([...byMedals, ...byX.slice(0, extremes), ...byX.slice(-extremes)].map((p) => p.name));
};
const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const shortName = (n: string) => (n === 'Korea, South' ? 'South Korea' : n === 'United States' ? 'USA' : n);

/**
 * Screen: three common assumptions about geography tested against the data.
 * Coastline vs water sports, population density, net migration. Ratio charts compare each group
 * with what population and wealth predict (the model on Drivers of success), so 1.0× everywhere
 * means the factor adds nothing.
 */
export default function GeographyPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);
  const g = useMemo(() => geographyInsights(d, filters), [d, filters]);
  const winners = g.points.filter((p) => p.medals > 0);

  // The most crowded nations (1M+ people, 300+ per km²), best to worst medals per person
  const crowded = g.points.filter((p) => p.population >= 1e6 && p.density >= 300).sort((a, b) => b.perTenMillion - a.perTenMillion);
  const crowdedWin = crowded.filter((p) => p.medals > 0);
  const crowdedNone = crowded.filter((p) => p.medals === 0);
  // Exceptions on migration (1M+ people): losing people yet winning most per person; gaining people AND rich ($15k+) yet winning least
  const big = g.points.filter((p) => p.population >= 1e6 && p.netMigration !== null);
  const losingWinners = big.filter((p) => p.netMigration! < -1 && p.medals > 0).sort((a, b) => b.perTenMillion - a.perTenMillion).slice(0, 4);
  const gainingLaggards = big.filter((p) => p.netMigration! > 1 && (p.gdpPerCapita ?? 0) >= 15000).sort((a, b) => a.perTenMillion - b.perTenMillion || b.gdpPerCapita! - a.gdpPerCapita!).slice(0, 4);

  const [landlocked, , , longest] = g.coast;
  const densest = g.density[g.density.length - 1];
  const [losing, , gaining] = g.migration;
  const hungary = g.landlockedWater.find((p) => p.name === 'Hungary');

  return (
    <>
      <PageHeader title="Geography myths" subtitle="Do a long coastline, empty land or immigration help a nation win? Mostly not.">
        <FilterBar />
      </PageHeader>

      <InsightBanner linkTo="/drivers" linkText="See what drives success">
        Coastline, crowding and migration add little once population and wealth are known.
      </InsightBanner>

      <h2 className="section-title">1 · Does a long coastline mean more water-sport medals?</h2>
      <div className="row">
        <ChartFrame
          style={{ flex: '1 1 400px' }}
          title="Water-sport medals per 10M people, by coastline"
          summary={`About level: ${fmt1(landlocked.waterPerTenMillion)} per 10M people for landlocked nations, ${fmt1(longest.waterPerTenMillion)} for the longest coastlines. Most water sports take place in pools, rivers and lakes. Water sports: swimming, diving, synchronised swimming, water polo, rowing, canoeing, sailing.`}
          table={{ headers: ['Coastline', 'Nations', 'Water medals', 'Per 10M people', 'Share of the group’s medals', 'Share of all sailing medals'],
            rows: g.coast.map((b) => [b.key, b.nations, fmt(b.waterMedals), fmt1(b.waterPerTenMillion), pct1(b.waterShare), pct1(b.shareOfSailing)]) }}
        >
          <GroupBars groups={g.coast} value={(b) => b.waterPerTenMillion} mode="value" format={fmt1} label="Water medals per 10M people"
            xLabel="Length of coastline" yLabel="Water medals per 10M people" />
        </ChartFrame>

        <section className="card" style={{ flex: '1 1 400px' }} aria-labelledby="landlocked">
          <h2 id="landlocked" className="card-title">Landlocked, yet strong in water</h2>
          <p className="muted small">Nations with no coastline at all that won water-sport medals</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Landlocked nations with water-sport medals">
            <table>
              <thead><tr><th scope="col">Nation</th><th scope="col" className="num">Water medals</th><th scope="col" className="num">All medals</th><th scope="col" className="num">Water share</th></tr></thead>
              <tbody>
                {g.landlockedWater.map((p) => (
                  <tr key={p.countryId}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td className="num">{fmt(p.waterMedals)}</td>
                    <td className="num">{fmt(p.medals)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{pct(p.waterShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            {hungary ? `Hungary has no coast and won ${pct(hungary.waterShare)} of its medals in water, mostly canoeing and water polo. ` : ''}
            Landlocked nations specialise rather than avoid water: strong in canoeing and water polo, weak in sailing
            ({pct1(landlocked.shareOfSailing)} of sailing medals vs {pct1(landlocked.shareOfMedals)} of all medals), but just as weak in
            swimming, rowing and even gymnastics, so the sea is not the explanation.
          </p>
        </section>
      </div>

      <h2 className="section-title">2 · Do crowded nations fall behind?</h2>
      <div className="row">
        <ChartFrame
          style={{ flex: '2 1 380px' }}
          title="Medals vs expectation, by density"
          legend={<RatioLegend />}
          summary={`People per km². 1.0× = what the group's population and wealth predict. No steady pattern from empty to crowded; the most crowded group wins ${ratioText(densest.actualVsExpected)} its expected medals.`}
          table={groupTable(g.density, 'People per km²')}
        >
          <GroupBars groups={g.density} value={(b) => b.actualVsExpected} mode="ratio" format={(v) => ratioText(v)} label="Actual ÷ expected"
            xLabel="People per km²" yLabel="Actual ÷ expected medals" />
        </ChartFrame>
        <section className="card" style={{ flex: '3 1 440px' }} aria-labelledby="crowding">
          <h2 id="crowding" className="card-title">The most crowded nations: very different results</h2>
          <p className="muted small">All {crowded.length} nations with 1M+ people and 300+ people per km², most medals per person first</p>
          <NationTable rows={crowded} cols={['density', 'gdp', 'literacy', 'medals', 'per10m']} label="Most crowded nations" maxHeight={260} />
          <p className="note">
            Equally crowded nations range from {fmt1(crowded[0]?.perTenMillion ?? 0)} to {fmt1(crowded[crowded.length - 1]?.perTenMillion ?? 0)} medals
            per 10M people. The {crowdedWin.length} that won medals average {usd(mean(crowdedWin.map((p) => p.gdpPerCapita)) ?? 0)} GDP per person
            and {fmt(mean(crowdedWin.map((p) => p.literacy)) ?? 0)}% literacy; the {crowdedNone.length} that won none
            average {usd(mean(crowdedNone.map((p) => p.gdpPerCapita)) ?? 0)} and {fmt(mean(crowdedNone.map((p) => p.literacy)) ?? 0)}%.
            Wealth and literacy separate them, not crowding. The data has no infrastructure column, so these are the closest stand-ins.
          </p>
        </section>
      </div>
      <ChartFrame
        title="Crowding vs medals per person"
        summary="Each dot is a medal-winning nation, both axes on a log scale. No slope: crowded and empty nations both win, and both lose. Named: the five biggest medal winners and the two least and most crowded."
        table={{ headers: ['Nation', 'People per km²', 'Medals', 'Per 10M people'], rows: [...winners].sort((a, b) => b.density - a.density).map((p) => [p.name, fmt(p.density), p.medals, fmt1(p.perTenMillion)]) }}
      >
        <GeoScatter points={winners} x={(p) => Math.max(p.density, 1)} xLog xDomain={[1, 20000]} xTicks={[1, 10, 100, 1000, 10000]} xLabel="People per km² (log scale)" labelled={labelSet(winners, (p) => p.density)} />
      </ChartFrame>

      <h2 className="section-title">3 · Do nations that lose people win fewer medals?</h2>
      <div className="row">
        <ChartFrame
          style={{ flex: '1 1 300px' }}
          title="Medals per 10M people"
          summary={`At first sight yes: nations gaining people win ${fmt1(gaining.perTenMillion)} medals per 10M people, those losing people ${fmt1(losing.perTenMillion)}. Losing = net migration below −1 per 1,000 residents, gaining = above +1.`}
          table={groupTable(g.migration, 'Net migration')}
        >
          <GroupBars groups={g.migration} value={(b) => b.perTenMillion} mode="value" format={fmt1} label="Medals per 10M people"
            xLabel="Net migration" yLabel="Medals per 10M people" />
        </ChartFrame>
        <ChartFrame
          style={{ flex: '1 1 300px' }}
          title="GDP per person"
          summary={`But gaining nations are also far richer (${usd(gaining.gdpPerCapita ?? 0)} vs ${usd(losing.gdpPerCapita ?? 0)} per person, population-weighted). Migrants move to rich countries.`}
          table={groupTable(g.migration, 'Net migration')}
        >
          <GroupBars groups={g.migration} value={(b) => b.gdpPerCapita} mode="value" format={usd} label="GDP per person (population-weighted)"
            xLabel="Net migration" yLabel="GDP per person (USD)" tickFormat={(v) => (v === 0 ? '$0' : `$${v / 1000}k`)} />
        </ChartFrame>
        <ChartFrame
          style={{ flex: '1 1 300px' }}
          title="Adjusted for wealth"
          legend={<RatioLegend />}
          summary={`Against what population and wealth predict, the gap almost disappears: ${ratioText(gaining.actualVsExpected)} for gaining nations, ${ratioText(losing.actualVsExpected)} for losing ones.`}
          table={groupTable(g.migration, 'Net migration')}
        >
          <GroupBars groups={g.migration} value={(b) => b.actualVsExpected} mode="ratio" format={(v) => ratioText(v)} label="Actual ÷ expected"
            xLabel="Net migration" yLabel="Actual ÷ expected medals" />
        </ChartFrame>
      </div>
      <div className="row">
        <section className="card" style={{ flex: '2 1 360px' }} aria-labelledby="migration-nations">
          <h2 id="migration-nations" className="card-title">Exceptions in both directions</h2>
          <p className="muted small">Nations with 1M+ people · net migration per 1,000 residents per year</p>
          <h3 className="kpi-label" style={{ marginTop: 4 }}>Losing people, yet winning the most per person</h3>
          <NationTable rows={losingWinners} cols={['migration', 'gdp', 'per10m']} label="Nations losing people that win most per person" />
          <h3 className="kpi-label" style={{ marginTop: 8 }}>Gaining people and rich, yet winning the least per person</h3>
          <NationTable rows={gainingLaggards} cols={['migration', 'gdp', 'per10m']} label="Rich nations gaining people that win least per person" />
          <p className="note">
            Migration on its own predicts little in both directions. The data also cannot show athletes who moved and compete for their new country.
          </p>
        </section>
        <ChartFrame
          style={{ flex: '3 1 440px' }}
          title="Net migration vs medals per person"
          summary="Each dot is a medal-winning nation; medals per person on a log scale. Dots left of the dashed line lose people, right of it gain people. No clear slope. Named: the five biggest medal winners and the two most extreme on each side."
          table={{ headers: ['Nation', 'Net migration', 'Medals', 'Per 10M people'], rows: [...winners].filter((p) => p.netMigration !== null).sort((a, b) => a.netMigration! - b.netMigration!).map((p) => [p.name, signed(p.netMigration!), p.medals, fmt1(p.perTenMillion)]) }}
        >
          <GeoScatter points={winners.filter((p) => p.netMigration !== null)} x={(p) => p.netMigration!} xDomain={[-24, 24]} xTicks={[-20, -10, 0, 10, 20]} xLabel="Net migration per 1,000 residents" labelled={labelSet(winners.filter((p) => p.netMigration !== null), (p) => p.netMigration!)} zeroLine />
        </ChartFrame>
      </div>

      <p className="footnote">
        Coastline: the workbook gives coast length ÷ area × 100, converted here to kilometres (ratio × area ÷ 100). Density: people per km²,
        from population and area. Expected medals come from the population-and-wealth model on Drivers of success, summed over the nations in
        each group (nations without GDP data are left out). These are associations across nations, not proof of cause. Team sports count once per team.
      </p>
    </>
  );
}


function groupTable(groups: GroupStats[], first: string) {
  return {
    headers: [first, 'Nations', 'With a medal', 'Medals', 'Per 10M people', 'Actual ÷ expected', 'GDP per person*', 'Literacy*'],
    rows: groups.map((b) => [b.key, b.nations, b.winners, fmt(b.medals), fmt1(b.perTenMillion), ratioText(b.actualVsExpected),
      b.gdpPerCapita === null ? '–' : usd(b.gdpPerCapita), b.literacy === null ? '–' : `${fmt1(b.literacy)}%`]),
  };
}

type Col = 'density' | 'migration' | 'gdp' | 'literacy' | 'medals' | 'per10m';
const COLS: Record<Col, [string, (p: GeoPoint) => string]> = {
  density: ['People/km²', (p) => fmt(p.density)],
  migration: ['Migration', (p) => (p.netMigration === null ? '–' : signed(p.netMigration))],
  gdp: ['GDP/person', (p) => (p.gdpPerCapita === null ? '–' : usd(p.gdpPerCapita))],
  literacy: ['Literacy', (p) => (p.literacy === null ? '–' : `${fmt1(p.literacy)}%`)],
  medals: ['Medals', (p) => fmt(p.medals)],
  per10m: ['Per 10M', (p) => fmt1(p.perTenMillion)],
};

function NationTable({ rows, cols, label, maxHeight }: { rows: GeoPoint[]; cols: Col[]; label: string; maxHeight?: number }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={label} style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table>
        <thead><tr><th scope="col">Nation</th>{cols.map((c) => <th key={c} scope="col" className="num">{COLS[c][0]}</th>)}</tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.countryId}>
              <td style={{ fontWeight: 500 }}>{shortName(p.name)}</td>
              {cols.map((c) => <td key={c} className="num" style={c === 'per10m' ? { fontWeight: 700 } : undefined}>{COLS[c][1](p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeoScatter({ points, x, xLog, xDomain, xTicks, xLabel, labelled, zeroLine }: {
  points: GeoPoint[]; x: (p: GeoPoint) => number; xLog?: boolean; xDomain: [number, number]; xTicks: number[];
  xLabel: string; labelled: Set<string>; zeroLine?: boolean;
}) {
  const data = points.map((p) => ({ ...p, x: x(p), y: Math.max(p.perTenMillion, 0.01), label: shortName(p.name) }));
  const named = data.filter((p) => labelled.has(p.name));
  const rest = data.filter((p) => !labelled.has(p.name));
  return (
    <div style={{ height: 380 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid stroke={C.grid} />
          <XAxis type="number" dataKey="x" scale={xLog ? 'log' : 'linear'} domain={xDomain} allowDataOverflow ticks={xTicks} tick={axisTick}
            tickFormatter={(v) => fmt(Number(v))} label={{ value: xLabel, position: 'insideBottom', offset: -16, fill: C.axis, fontSize: 12 }} />
          <YAxis type="number" dataKey="y" scale="log" domain={[0.01, 1000]} allowDataOverflow ticks={[0.01, 0.1, 1, 10, 100, 1000]} tick={axisTick}
            tickFormatter={(v) => String(v)} label={{ value: 'Medals per 10M people', angle: -90, position: 'insideLeft', fill: C.axis, fontSize: 12 }} />
          <ZAxis range={[46, 46]} />
          {zeroLine && <ReferenceLine x={0} stroke={C.axis} strokeDasharray="4 4" />}
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<GeoTip />} />
          <Scatter name="Nations" data={rest} fill={C.neutral} fillOpacity={0.8} isAnimationActive={false} />
          <Scatter name="Named nations" data={named} fill={C.primary} isAnimationActive={false}
            label={{ dataKey: 'label', position: 'right', fill: C.text, fontSize: 12, fontWeight: 600 }} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
