import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GeoPoint, GroupStats } from '../../domain/metrics';
import { axisTick, C } from '../../styles/colors';
import { fmt, fmt1, millions, usd } from '../../utils/format';

export const ratioText = (v: number | null) => (v === null ? '–' : `${v.toFixed(2)}×`);

/** "Nice" tick values from 0 up to just above `max`, so axes read 0, 0.5, 1, 1.5 … or 0, 10, 20 … */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const axisTitle = { fill: C.axis, fontSize: 12, fontWeight: 600 };

/**
 * Vertical bars for a few groups (bands). Both axes are titled.
 * mode 'ratio': actual ÷ expected, y axis 0×, 0.5×, 1×…, a dashed line labelled "as expected" at 1.0×;
 *               bars above it blue, below it orange.
 * mode 'value': a plain measure in the primary colour; `tickFormat` formats the y axis.
 */
export function GroupBars({ groups, value, mode, format, height = 280, label, xLabel, yLabel, tickFormat }: {
  groups: GroupStats[]; value: (g: GroupStats) => number | null; mode: 'ratio' | 'value';
  format: (v: number) => string; height?: number; label: string; xLabel: string; yLabel: string; tickFormat?: (v: number) => string;
}) {
  const data = groups.map((g) => ({ key: g.key, v: value(g) ?? 0, g }));
  const ticks = niceTicks(Math.max(...data.map((x) => x.v), mode === 'ratio' ? 1.2 : 0) * 1.08);
  const yTick = mode === 'ratio' ? (v: number) => `${v.toFixed(1)}×` : tickFormat ?? ((v: number) => fmt1(v));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 16, left: 12, bottom: 22 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="key" tick={<WrapTick />} height={44} interval={0} tickLine={false} axisLine={{ stroke: C.axis }}
            label={{ value: xLabel, position: 'insideBottom', offset: -16, ...axisTitle }} />
          <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={axisTick} tickFormatter={(v) => yTick(Number(v))} width={58}
            axisLine={{ stroke: C.axis }} label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 2, style: { textAnchor: 'middle' }, ...axisTitle }} />
          <Tooltip cursor={{ fill: 'rgba(29, 91, 184, 0.06)' }} content={<GroupTip label={label} format={format} />} />
          {mode === 'ratio' && (
            <ReferenceLine y={1} stroke={C.text} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" />
          )}
          <Bar dataKey="v" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            {data.map((x) => <Cell key={x.key} fill={mode === 'ratio' ? (x.v >= 1 ? C.over : C.under) : C.primary} />)}
            {/* ratio bars: value inside the bar top, so it never collides with the dashed 1.0× line */}
            <LabelList dataKey="v" position={mode === 'ratio' ? 'insideTop' : 'top'} offset={mode === 'ratio' ? 8 : 5} formatter={(v) => format(Number(v))}
              style={{ fontSize: 12, fontWeight: 700, fill: mode === 'ratio' ? '#fff' : C.text }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Category label that wraps onto two lines (e.g. "Gaining / people") so narrow charts never overlap. */
function WrapTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = String(payload?.value ?? '').split(' ');
  const lines = words.length > 1 && String(payload?.value).length > 10 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words;
  return (
    <text x={x} y={(y ?? 0) + 12} textAnchor="middle" fill={C.axis} fontSize={12}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>{l}</tspan>)}
    </text>
  );
}

function GroupTip({ active, payload, label, format }: { active?: boolean; payload?: { payload: { key: string; v: number; g: GroupStats } }[]; label: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const { key, v, g } = payload[0].payload;
  return (
    <div className="card" style={{ padding: 10, gap: 2, fontSize: 13 }}>
      <strong>{key}</strong>
      <span>{label}: {format(v)}</span>
      <span className="muted">{g.nations} nations, {g.winners} with a medal · {fmt(g.medals)} medals</span>
      <span className="muted">{fmt1(g.perTenMillion)} medals per 10M people</span>
      {g.gdpPerCapita !== null && <span className="muted">GDP {usd(g.gdpPerCapita)} per person · literacy {g.literacy === null ? '–' : `${fmt1(g.literacy)}%`}</span>}
    </div>
  );
}

export function GeoTip({ active, payload }: { active?: boolean; payload?: { payload: GeoPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card" style={{ padding: 10, gap: 2, fontSize: 13 }}>
      <strong>{p.name}</strong>
      <span>{fmt(p.medals)} medals · {fmt1(p.perTenMillion)} per 10M people</span>
      <span className="muted">{fmt(p.density)} people per km² · net migration {p.netMigration === null ? '–' : signed(p.netMigration)}</span>
      <span className="muted">Population {millions(p.population)} · {p.gdpPerCapita === null ? 'GDP unknown' : `${usd(p.gdpPerCapita)} per person`}</span>
    </div>
  );
}

export const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

/** Horizontal bars for many groups (regions), sorted as given. Same colour rules as GroupBars; the value axis is titled. */
export function GroupHBars({ groups, value, mode, format, label, xLabel }: {
  groups: GroupStats[]; value: (g: GroupStats) => number | null; mode: 'ratio' | 'value'; format: (v: number) => string; label: string; xLabel: string;
}) {
  const data = groups.map((g) => ({ key: g.key, v: value(g) ?? 0, g }));
  const ticks = niceTicks(Math.max(...data.map((x) => x.v), mode === 'ratio' ? 1.2 : 0) * 1.05, 5);
  return (
    <div style={{ height: 70 + data.length * 34 }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 22, right: 56, left: 8, bottom: 22 }}>
          <CartesianGrid horizontal={false} stroke={C.grid} />
          <XAxis type="number" ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={axisTick} axisLine={{ stroke: C.axis }}
            tickFormatter={(v) => (mode === 'ratio' ? `${Number(v).toFixed(1)}×` : fmt(Number(v)))}
            label={{ value: xLabel, position: 'insideBottom', offset: -16, ...axisTitle }} />
          <YAxis type="category" dataKey="key" tick={axisTick} width={176} interval={0} tickLine={false} axisLine={{ stroke: C.axis }} />
          <Tooltip cursor={{ fill: 'rgba(29, 91, 184, 0.06)' }} content={<GroupTip label={label} format={format} />} />
          {mode === 'ratio' && (
            <ReferenceLine x={1} stroke={C.text} strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: 'as expected', position: 'top', fill: C.text, fontSize: 12, fontWeight: 600 }} />
          )}
          <Bar dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {data.map((x) => <Cell key={x.key} fill={mode === 'ratio' ? (x.v >= 1 ? C.over : C.under) : C.primary} />)}
            {/* white halo keeps the value readable where it crosses the dashed 1.0× line */}
            <LabelList dataKey="v" position="right" formatter={(v) => format(Number(v))}
              style={{ fontSize: 12, fontWeight: 700, fill: C.text, stroke: '#fff', strokeWidth: 4, paintOrder: 'stroke' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend entry for ratio charts: the dashed line and the two bar colours. */
export function RatioLegend() {
  return (
    <>
      <span><span className="dot" style={{ background: C.over }} />Above expectation</span>
      <span><span className="dot" style={{ background: C.under }} />Below expectation</span>
      <span><span aria-hidden="true" style={{ display: 'inline-block', width: 18, borderTop: `2px dashed ${C.axis}`, verticalAlign: 'middle', marginRight: 6 }} />1.0× = as population and wealth predict</span>
    </>
  );
}
