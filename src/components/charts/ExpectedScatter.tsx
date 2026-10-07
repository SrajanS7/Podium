import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { ExpectedPoint } from '../../domain/metrics';
import { axisTick, C } from '../../styles/colors';
import { bnUsd, fmt, fmt1, millions, usd } from '../../utils/format';
import { ChartFrame } from '../ui/ChartFrame';

/** Performance bands for colouring: actual vs expected (on the medals + 1 scale). */
const OVER = 1.5, UNDER = 1 / 1.5;
export const band = (p: number) => (p >= OVER ? 'over' : p <= UNDER ? 'under' : 'as expected');
const bandColor = { over: C.over, under: C.under, 'as expected': C.neutral } as const;
export const ratio = (p: number) => (p < 1 ? p.toFixed(2) : fmt1(p));

/**
 * Expected vs actual medals, one dot per medal-winning nation, on log scales.
 * Used by Drivers of success (population + wealth) and Literacy model (+ literacy):
 * the page passes the model and says in `factors` what the expected value is based on.
 */
export function ExpectedScatter({ points, highlightId, factors }: { points: ExpectedPoint[]; highlightId: number | 'none'; factors: string }) {
  const highlight = points.find((p) => p.countryId === highlightId);
  const winners = points.filter((p) => p.actual > 0);
  const nearLine = winners.filter((p) => band(p.performance) === 'as expected').length;
  const scatter = winners.map((p) => ({ ...p, x: Math.max(p.expected, 0.3), band: band(p.performance) }));
  const byBand = (b: string) => scatter.filter((p) => p.band === b && p.countryId !== highlightId);
  return (
    <ChartFrame
        title={`Expected vs actual medals: ${factors}`}
        summary={`Each dot is a medal-winning nation. Dots above the diagonal won more than ${factors} predict; the largest nations (USA, France, Italy, UK) sit close to the line. ${nearLine} of ${winners.length} medal-winning nations are within 1.5× of their expected count.`}
        legend={<>
          <span><span className="dot" style={{ background: C.over }} />Beats expectation (1.5× or more)</span>
          <span><span className="dot" style={{ background: C.neutral }} />Close to expected</span>
          <span><span className="dot" style={{ background: C.under }} />Below expectation</span>
          {highlight && <span><span className="dot" style={{ background: C.highlight, outline: `2px solid ${C.text}` }} />{highlight.name}</span>}
        </>}
        table={{ headers: ['Nation', 'Expected', 'Actual', 'Actual ÷ expected'], rows: [...winners].sort((a, b) => b.actual - a.actual).map((p) => [p.name, fmt1(p.expected), p.actual, `${ratio(p.performance)}×`]) }}
        footer={highlight && <HighlightCard p={highlight} />}
      >
        <div style={{ height: 420 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
              <CartesianGrid stroke={C.grid} />
              <XAxis type="number" dataKey="x" name="Expected" scale="log" domain={[0.3, 1500]} allowDataOverflow ticks={[1, 10, 100, 1000]} tick={axisTick}
                label={{ value: `Expected medals (from ${factors})`, position: 'insideBottom', offset: -16, fill: C.axis, fontSize: 12 }} />
              <YAxis type="number" dataKey="actual" name="Actual" scale="log" domain={[1, 1500]} allowDataOverflow ticks={[1, 10, 100, 1000]} tick={axisTick}
                label={{ value: 'Actual medals', angle: -90, position: 'insideLeft', fill: C.axis, fontSize: 12 }} />
              <ZAxis range={[46, 46]} />
              <ReferenceLine segment={[{ x: 1, y: 1 }, { x: 1500, y: 1500 }]} stroke={C.axis} strokeDasharray="4 4" ifOverflow="hidden" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTip />} />
              <Scatter name="Below expectation" data={byBand('under')} fill={C.under} fillOpacity={0.85} />
              <Scatter name="Close to expected" data={byBand('as expected')} fill={C.neutral} fillOpacity={0.85} />
              <Scatter name="Beats expectation" data={byBand('over')} fill={C.over} fillOpacity={0.85} />
              {highlight && highlight.actual > 0 && (
                <Scatter name={highlight.name} data={[{ ...highlight, x: Math.max(highlight.expected, 0.3) }]} fill={C.highlight} stroke={C.text} strokeWidth={2}
                  label={{ dataKey: 'name', position: 'right', fill: C.text, fontSize: 12, fontWeight: 600 }} />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
  );
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: ExpectedPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card" style={{ padding: 10, gap: 2, fontSize: 13 }}>
      <strong>{p.name}</strong>
      <span>Actual {fmt(p.actual)} · expected {fmt1(p.expected)}</span>
      <span className="muted">Population {millions(p.population)} · {usd(p.gdpPerCapita)} per person</span>
    </div>
  );
}

function HighlightCard({ p }: { p: ExpectedPoint }) {
  const b = band(p.performance);
  return (
    <div className="note" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline' }}>
      <strong style={{ fontSize: 16 }}>{p.name}</strong>
      <span>Population {millions(p.population)} · {usd(p.gdpPerCapita)} per person · economy {bnUsd(p.totalGdpBn)}</span>
      <span>Expected <strong>{fmt1(p.expected)}</strong> medals, actually won <strong>{fmt(p.actual)}</strong></span>
      <span style={{ color: bandColor[b], fontWeight: 700 }}>{b === 'as expected' ? 'Close to expected' : b === 'over' ? `${fmt1(p.performance)}× expectation` : `${ratio(p.performance)}× expectation (below)`}</span>
    </div>
  );
}

