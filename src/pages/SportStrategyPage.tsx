import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { niceTicks } from '../components/charts/GroupBars';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { sportReturns, type SportReturn } from '../domain/metrics';
import { useDataset } from '../store/useDataStore';
import { axisTick, C } from '../styles/colors';
import { fmt, pct } from '../utils/format';

const two = (v: number) => v.toFixed(2);

/**
 * Screen: which sports give the best return per funded athlete? Same chart as the notebook (section C4).
 * All Games 2000–2012, independent of the filters. (Peak age by sport lives on the Athletes screen.)
 */
export default function SportStrategyPage() {
  const d = useDataset();
  const returns = useMemo(() => sportReturns(d), [d]);
  const [returnView, setReturnView] = useState<'extremes' | 'all'>('extremes');

  const best = returns[0];
  // squad sports: 8+ athletes share each medal (excludes beach volleyball pairs and curling fours)
  const squads = returns.filter((r) => r.isTeam && r.perMedallist < 1 / 8);
  const multi = returns.filter((r) => ['Swimming', 'Biathlon', 'Nordic Combined'].includes(r.sport));
  const football = returns.find((r) => r.sport === 'Football');

  return (
    <>
      <PageHeader title="Sport strategy" badge="2000–2012"
        subtitle="In which sports does a funded athlete bring the most medals?" />

      {best && football && (
        <InsightBanner linkTo="/athletes" linkText="Peak age by sport">
          A {best.sport.toLowerCase()} medallist wins {two(best.perMedallist)} medals on average, a football medallist {two(football.perMedallist)}:
          about {Math.round(best.perMedallist / football.perMedallist)}× the return per funded athlete.
        </InsightBanner>
      )}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <h2 className="section-title" style={{ flex: '1 1 auto' }}>Return per athlete: medals won per medallist</h2>
        <SegmentedControl label="Show" value={returnView} onChange={setReturnView}
          options={[{ value: 'extremes', label: 'Top 10 & team sports' }, { value: 'all', label: `All ${returns.length} sports` }]} />
      </div>
      <ReturnChart returns={returns} view={returnView} />
      <p className="note">
        In multi-event individual sports one athlete can win several medals: {multi.length ? `${pct(Math.min(...multi.map((m) => m.multiShare)))}–${pct(Math.max(...multi.map((m) => m.multiShare)))}` : 'about half'} of swimming, biathlon and Nordic combined medallists won more than one.
        In squad sports such as football, hockey and basketball, 12–18 players share one medal ({squads.length ? `${two(Math.min(...squads.map((t) => t.perMedallist)))}–${two(Math.max(...squads.map((t) => t.perMedallist)))}` : '–'} medals per athlete).
        This is a return-on-investment lens, not the only lens: team sports bring participation and public interest.
        Some fields are also narrow: only 7 nations won a medal in short-track speed skating or Nordic combined, so a focused programme can break in.
      </p>

      <p className="footnote">
        Return per athlete = medals as awarded to nations (team sports once per team) ÷ distinct athletes who won a medal in the sport, all Games 2000–2012.
        Same definition as the Python notebook. Not affected by the Season and Games filters.
      </p>
    </>
  );
}

function ReturnChart({ returns, view }: { returns: SportReturn[]; view: 'extremes' | 'all' }) {
  // Notebook view: the 10 best-returning sports, then the 6 lowest (all team sports)
  const data = view === 'all' ? returns : [...returns.slice(0, 10), ...returns.slice(-6)];
  const ticks = niceTicks(Math.max(...data.map((r) => r.perMedallist)) * 1.08, 5);
  return (
    <ChartFrame
      title="Medals won per medallist"
      summary={`${returns[0].sport} gives the best return (${two(returns[0].perMedallist)} medals per medallist), ${returns[returns.length - 1].sport} the lowest (${two(returns[returns.length - 1].perMedallist)}). Team sports in grey.`}
      legend={<>
        <span><span className="swatch" style={{ background: C.primary }} />Individual and small-crew sports</span>
        <span><span className="swatch" style={{ background: C.neutral }} />Team sports (one medal per squad)</span>
      </>}
      table={{
        headers: ['Sport', 'Season', 'Medals', 'Medallists', 'Medals per medallist', 'Won 2+ medals', 'Nations medalling'],
        rows: returns.map((r) => [r.sport, r.season, fmt(r.medals), fmt(r.medallists), two(r.perMedallist), pct(r.multiShare), r.nations]),
      }}
    >
      <div style={{ height: 60 + data.length * 30 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, left: 8, bottom: 22 }}>
            <CartesianGrid horizontal={false} stroke={C.grid} />
            <XAxis type="number" ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={axisTick} axisLine={{ stroke: C.axis }}
              tickFormatter={(v) => Number(v).toFixed(1)}
              label={{ value: 'Medals ÷ distinct medallists', position: 'insideBottom', offset: -16, fill: C.axis, fontSize: 12, fontWeight: 600 }} />
            <YAxis type="category" dataKey="sport" tick={axisTick} width={190} interval={0} tickLine={false} axisLine={{ stroke: C.axis }} />
            <Tooltip cursor={{ fill: 'rgba(29, 91, 184, 0.06)' }}
              formatter={(v, _n, item) => {
                const r = item.payload as SportReturn;
                return [`${two(Number(v))} (${fmt(r.medals)} medals, ${fmt(r.medallists)} medallists, ${pct(r.multiShare)} won 2+)`, 'Medals per medallist'];
              }} />
            <Bar dataKey="perMedallist" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {data.map((r) => <Cell key={r.sport} fill={r.isTeam ? C.neutral : C.primary} />)}
              <LabelList dataKey="perMedallist" position="right" formatter={(v) => two(Number(v))} style={{ fontSize: 12, fontWeight: 700, fill: C.text }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
