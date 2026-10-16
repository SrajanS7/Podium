import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { niceTicks } from '../components/charts/GroupBars';
import { CorrelationMatrixChart } from '../components/charts/CorrelationMatrix';
import { ExpectedScatter, ratio } from '../components/charts/ExpectedScatter';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { Dropdown } from '../components/ui/Dropdown';
import { FilterBar } from '../components/ui/FilterBar';
import { correlationMatrix, expectedMedalsModel, hostEffect, literacyContrast, type ExpectedPoint } from '../domain/metrics';
import { median } from '../domain/stats';
import { useDataStore, useDataset } from '../store/useDataStore';
import { axisTick, C } from '../styles/colors';
import { fmt, fmt1, pct, signedPct, usd } from '../utils/format';


/**
 * Screen 3: WHY nations perform as they do.
 *  1. Correlation matrix: which national factors move with medals
 *  2. A simple model (population + wealth -> expected medals) and the nations that break it
 *  3. Literacy beyond wealth, and home advantage
 */
export default function DriversPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);
  const model = useMemo(() => expectedMedalsModel(d, filters), [d, filters]);
  const matrix = useMemo(() => correlationMatrix(d, filters), [d, filters]);
  const hosts = useMemo(() => hostEffect(d), [d]);
  const lit = useMemo(() => literacyContrast(d, filters), [d, filters]);

  const [highlightId, setHighlightId] = useState<number | 'none'>(() => d.countries.find((c) => c.name === 'Kenya')?.id ?? 'none');

  const over = [...model.points].filter((p) => p.actual >= 10).sort((a, b) => b.performance - a.performance).slice(0, 8);
  const under = [...model.points].filter((p) => p.expected >= 10).sort((a, b) => a.performance - b.performance).slice(0, 8);

  // strongest factor link with total medals (row 0 of the matrix, skipping medals themselves)
  const medalLinks = matrix.labels.map((label, j) => ({ label, rho: matrix.rho[0][j] ?? 0 })).slice(2).sort((a, b) => b.rho - a.rho);
  const strongest = medalLinks[0];
  const weakest = [...medalLinks].sort((a, b) => Math.abs(a.rho) - Math.abs(b.rho))[0];
  const india = model.points.find((p) => p.name === 'India');
  const usa = model.points.find((p) => p.name === 'United States');

  return (
    <>
      <PageHeader title="Drivers of success" subtitle="Why do some nations win far more medals than others, and who breaks the pattern?">
        <Dropdown<number | 'none'> label="Highlight a nation" value={highlightId} onChange={setHighlightId} minWidth={180}
          options={[{ value: 'none', label: 'None' }, ...[...model.points].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.countryId, label: p.name }))]} />
        <FilterBar />
      </PageHeader>

      <InsightBanner>
        Population and wealth explain {pct(model.explained)} of medal differences. {over[0]?.name} and {over[1]?.name} show what sport systems add.
      </InsightBanner>

      <div className="row">
        <ChartFrame
          style={{ flex: '3 1 560px' }}
          title="Which national factors move with medals?"
          summary={`Rank correlation (Spearman) between every pair, across all nations with data (In simple words - "do the nations that rank high on economy size also rank high on medals?"). Green = rise together, red = one rises as the other falls, pale = no link. Strongest link with total medals: ${strongest.label.toLowerCase()} (${signed(strongest.rho)}); weakest: ${weakest.label.toLowerCase()} (${signed(weakest.rho)}). Correlation shows that two things move together, not that one causes the other.`}
          table={{ headers: ['', ...matrix.labels], rows: matrix.labels.map((label, i) => [label, ...matrix.rho[i].map((r) => (r === null ? '–' : r.toFixed(2)))]) }}
        >
          <CorrelationMatrixChart matrix={matrix} />
        </ChartFrame>

        <section className="card" style={{ flex: '2 1 300px' }} aria-labelledby="model">
          <h2 id="model" className="card-title">The general rule, in numbers</h2>
          <p className="muted small">A simple model predicts each nation's medals from just two facts: how many people it has and how wealthy they are.</p>
          <dl className="stack" style={{ margin: 0, gap: 14 }}>
            <div><dt className="muted small" style={{ fontWeight: 600 }}>10× the population</dt><dd style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>≈ {fmt1(model.popMultiplier)}× the medals</dd></div>
            <div><dt className="muted small" style={{ fontWeight: 600 }}>10× the wealth per person</dt><dd style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>≈ {fmt1(model.gdpMultiplier)}× the medals</dd></div>
            <div><dt className="muted small" style={{ fontWeight: 600 }}>Share of medal differences the model explains</dt><dd style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{pct(model.explained)}</dd></div>
          </dl>
          <p className="note">Wealth matters more than size: India has nearly 4× the population of the USA but won {fmt(india?.actual ?? 0)} medals vs {fmt(usa?.actual ?? 0)}.</p>
        </section>
      </div>

      <ExpectedScatter points={model.points} highlightId={highlightId} factors="population and wealth" />

      <div className="row">
        <PerformerList title="Biggest exceptions: punching above their weight" subtitle="Nations with 10+ medals, ranked by actual ÷ expected" items={over} color={C.over} />
        <PerformerList title="Untapped potential" subtitle="Nations expected to win 10+ medals, furthest below expectation" items={under} color={C.under} />
      </div>
      <p className="note">Common threads among the exceptions: former Eastern-bloc sport systems (Russia, Belarus, Ukraine, Hungary), specialisation in a few sports (Jamaica in sprinting, Kenya in distance running, Norway in winter sports) and state investment (Cuba). At the other end, populous nations such as India, Pakistan, Bangladesh and the Philippines win far fewer medals than their size and wealth suggest.</p>

      <LiteracyCard lit={lit} />

      <HostEffect rows={hosts} />

      <p className="footnote">Model: Poisson regression, expected medals = exp(a + b₁·log₁₀ population + b₂·log₁₀ GDP per person),
        fitted on {model.n} nations with GDP data (including those with no medals) and re-fitted live for the current filters and data edits. "Share explained" is deviance explained, the standard goodness-of-fit for a count model (a pseudo-R², not an ordinary R²). Economic data is one snapshot from the Country Data sheet. Team sports count once per team.</p>
    </>
  );
}

const signed = (r: number) => (r > 0 ? `+${r.toFixed(2)}` : r.toFixed(2));

function PerformerList({ title, subtitle, items, color }: { title: string; subtitle: string; items: ExpectedPoint[]; color: string }) {
  return (
    <section className="card" style={{ flex: '1 1 380px' }} aria-label={title}>
      <h2 className="card-title">{title}</h2>
      <p className="muted small">{subtitle}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Nation</th><th scope="col" className="num">Expected</th><th scope="col" className="num">Actual</th><th scope="col" className="num">Actual ÷ expected</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.countryId}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td className="num">{fmt1(p.expected)}</td>
                <td className="num">{fmt(p.actual)}</td>
                <td className="num" style={{ fontWeight: 700, color }}>{ratio(p.performance)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HostEffect({ rows }: { rows: ReturnType<typeof hostEffect> }) {
  const improved = rows.filter((r) => r.upliftPct > 0).length;
  const data = rows.map((r) => ({ ...r, label: `${r.country} · ${r.games}`, avg: Math.round(r.otherAvg * 10) / 10 }));
  const ticks = niceTicks(Math.max(...rows.flatMap((r) => [r.asHost, r.otherAvg])) * 1.05, 5);
  return (
    <ChartFrame
      title={`Home advantage: ${improved} of ${rows.length} hosts won more at home`}
      summary={`For each host: its medals at its own Games (orange) next to its average in the other Games of that season (grey). The percentage is the change. Median uplift ${signedPct(median(rows.map((r) => r.upliftPct)))}. Shown for all Games regardless of filters.`}
      legend={<><span><span className="swatch" style={{ background: C.neutral }} />Average in its other Games</span><span><span className="swatch" style={{ background: C.summer }} />Medals as host</span></>}
      table={{ headers: ['Host', 'Games', 'As host', 'Other Games average', 'Uplift'], rows: rows.map((r) => [r.country, r.games, r.asHost, fmt1(r.otherAvg), signedPct(r.upliftPct)]) }}
    >
      <div style={{ height: 90 + rows.length * 62 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 22 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid horizontal={false} stroke={C.grid} />
            <XAxis type="number" ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={axisTick} axisLine={{ stroke: C.axis }}
              label={{ value: 'Medals won', position: 'insideBottom', offset: -16, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
            <YAxis type="category" dataKey="label" width={230} tick={<HostTick rows={rows} />} interval={0} tickLine={false} axisLine={{ stroke: C.axis }} />
            <Tooltip cursor={{ fill: 'rgba(29, 91, 184, 0.06)' }} formatter={(v, n) => [fmt1(Number(v)), n]} />
            <Bar dataKey="avg" name="Average in its other Games" fill={C.neutral} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="avg" position="right" formatter={(v) => fmt1(Number(v))} style={{ fontSize: 12, fill: C.axis }} />
            </Bar>
            <Bar dataKey="asHost" name="Medals as host" fill={C.summer} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="asHost" position="right" style={{ fontSize: 12, fontWeight: 700, fill: C.text }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Two-line y-axis label for the home-advantage chart: host and Games, then the uplift. */
function HostTick({ x, y, payload, rows }: { x?: number; y?: number; payload?: { value: string }; rows: ReturnType<typeof hostEffect> }) {
  const r = rows.find((row) => `${row.country} · ${row.games}` === payload?.value);
  if (!r) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-10} y={-4} textAnchor="end" fill={C.text} fontSize={13} fontWeight={600}>{r.country}</text>
      <text x={-10} y={12} textAnchor="end" fill={C.axis} fontSize={12}>
        {r.games} · <tspan fill={r.upliftPct > 0 ? '#9a3412' : C.axis} fontWeight={700}>{signedPct(r.upliftPct)}</tspan>
      </text>
    </g>
  );
}

/** Literacy beyond wealth: poorer nations that school everyone still reach the podium. */
function LiteracyCard({ lit }: { lit: ReturnType<typeof literacyContrast> }) {
  const share = (x: { winners: number; nations: number }) => (x.nations > 0 ? x.winners / x.nations : 0);
  return (
    <section className="card" aria-labelledby="literacy">
      <h2 id="literacy" className="card-title">Literacy matters, even without wealth</h2>
      <p className="muted small">Poorer nations only (GDP under {usd(lit.gdpBelow)} per person, 1M+ people): how often did they win at least one medal?</p>
      <div className="grid-3">
        <div className="stack" style={{ gap: 2 }}>
          <span className="kpi-label">{lit.literacyFrom}%+ literate</span>
          <span className="kpi-value" style={{ color: C.over }}>{pct(share(lit.literate))}</span>
          <span className="muted small">{lit.literate.winners} of {lit.literate.nations} nations · {fmt(lit.literate.medals)} medals · e.g. {lit.literate.examples.join(', ')}</span>
        </div>
        <div className="stack" style={{ gap: 2 }}>
          <span className="kpi-label">Less literate</span>
          <span className="kpi-value" style={{ color: C.under }}>{pct(share(lit.rest))}</span>
          <span className="muted small">{lit.rest.winners} of {lit.rest.nations} nations · {fmt(lit.rest.medals)} medals, from {fmt1(lit.rest.population / 1e9)} bn people vs {fmt1(lit.literate.population / 1e9)} bn</span>
        </div>
        <p className="note" style={{ margin: 0 }}>
          At similar wealth, nations that school everyone reach the podium far more often. Literacy works as a marker of education and
          organised school sport; many of these nations are former Soviet-bloc states.
        </p>
      </div>
    </section>
  );
}

