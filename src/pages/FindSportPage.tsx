import { useMemo, useState } from 'react';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { Dropdown } from '../components/ui/Dropdown';
import { bestBets, countryRows, expectedMedalsModel, regionLabel, sportAgeFit, sportMedalsFor, type AgeFitStatus, type SportAgeFit } from '../domain/metrics';
import { useDataset } from '../store/useDataStore';
import { C } from '../styles/colors';
import { fmt, fmt1, pct } from '../utils/format';

const ALL = { season: 'all', gamesId: 'all' } as const;
const DEFAULT_COUNTRY = 'Germany';
const SHOW_FIRST = 12;
/** Age axis of the range chart */
const LO = 14, HI = 62, TICKS = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const pos = (age: number) => `${((Math.min(Math.max(age, LO), HI) - LO) / (HI - LO)) * 100}%`;

const STATUS: Record<AgeFitStatus, { label: string; color: string; bg: string; text: string }> = {
  prime: { label: 'Prime age', color: C.primary, bg: '#e8effa', text: '#123e80' },
  reach: { label: 'Within reach', color: '#5598e7', bg: '#eef4fc', text: '#1c5cab' },
  longshot: { label: 'Long shot', color: C.summer, bg: '#fdf0e9', text: '#9a3412' },
  out: { label: 'No medallist this age', color: C.neutral, bg: '#f1f2f4', text: '#4a5058' },
};

const StatusChip = ({ s }: { s: AgeFitStatus }) => (
  <span className="fit-chip" style={{ background: STATUS[s].bg, color: STATUS[s].text }}>
    <span className="dot" style={{ background: STATUS[s].color }} />{STATUS[s].label}
  </span>
);

/**
 * Fun screen: "Find your Olympic sport". Compares the visitor's age (now, or after some years of training)
 * with the ages of every medallist per sport, and their country's medal history. It describes who actually
 * won 2000–2012; it does not predict anyone's chances (the data only contains winners).
 */
export default function FindSportPage() {
  const d = useDataset();
  const byName = useMemo(() => [...d.countries].sort((a, b) => a.name.localeCompare(b.name)), [d]);
  const [age, setAge] = useState(25);
  const [years, setYears] = useState(0);
  const [countryId, setCountryId] = useState(() => d.countries.find((c) => c.name === DEFAULT_COUNTRY)?.id ?? d.countries[0].id);
  const [showAll, setShowAll] = useState(false);

  const validAge = Number.isFinite(age) && age >= 10 && age <= 80;
  const validYears = Number.isFinite(years) && years >= 0 && years <= 20;
  const target = validAge && validYears ? age + years : null;

  const country = d.countries.find((c) => c.id === countryId)!;
  const fit = useMemo(() => (target === null ? [] : sportAgeFit(d, target)), [d, target]);
  const own = useMemo(() => sportMedalsFor(d, { countryId }), [d, countryId]);
  const regional = useMemo(() => sportMedalsFor(d, { region: country.region }), [d, country.region]);
  const usesRegion = own.length === 0;
  const medalsBySport = usesRegion ? regional : own;
  const bets = useMemo(() => bestBets(fit, medalsBySport), [fit, medalsBySport]);

  const row = useMemo(() => countryRows(d, ALL).find((r) => r.countryId === countryId), [d, countryId]);
  const model = useMemo(() => expectedMedalsModel(d, ALL), [d]);
  const point = model.points.find((p) => p.countryId === countryId);
  const winners = useMemo(() => countryRows(d, ALL).filter((r) => r.total > 0).length, [d]);

  const counts = fit.reduce((m, f) => ({ ...m, [f.status]: (m[f.status] ?? 0) + 1 }), {} as Partial<Record<AgeFitStatus, number>>);
  const shown = showAll ? fit : fit.slice(0, SHOW_FIRST);
  const region = regionLabel(country.region);

  return (
    <>
      <PageHeader title="Find your Olympic sport" badge="Just for fun"
        subtitle="Where would you have the best shot? Based on the ages and nations of every medallist, 2000–2012.">
        <label className="field" htmlFor="fs-age">Your age
          <input id="fs-age" type="number" min={10} max={80} value={Number.isNaN(age) ? '' : age} style={{ width: 110 }}
            onChange={(e) => setAge(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!validAge} />
        </label>
        <label className="field" htmlFor="fs-years">Years of training first
          <input id="fs-years" type="number" min={0} max={20} value={Number.isNaN(years) ? '' : years} style={{ width: 150 }}
            onChange={(e) => setYears(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!validYears} />
        </label>
        <Dropdown<number> label="Your country" value={countryId} onChange={setCountryId} minWidth={200}
          options={byName.map((c) => ({ value: c.id, label: c.name }))} />
      </PageHeader>

      {target === null ? (
        <p className="field-error" role="alert">Enter an age between 10 and 80 and 0 to 20 years of training.</p>
      ) : (
        <>
          <InsightBanner>
            {years > 0 ? <>After {years} year{years > 1 ? 's' : ''} of training you'd be {target}. </> : <>At {target}, </>}
            {years > 0 ? 'That age' : 'your age'} sits in the prime window of {counts.prime ?? 0} of {fit.length} sports.
            {bets.length > 0 && <> Best bets{usesRegion ? ` in ${region}` : ` for ${country.name}`}: {bets.slice(0, 3).map((b) => b.sport.toLowerCase()).join(', ')}.</>}
          </InsightBanner>

          <div className="row">
            <section className="card" style={{ flex: '3 1 420px' }} aria-labelledby="bets">
              <h2 id="bets" className="card-title">Your best bets</h2>
              <p className="muted small">
                Sports where medallists your age are common <strong>and</strong> {usesRegion
                  ? <>nations in {region} win medals ({country.name} won none in 2000–2012)</>
                  : <>{country.name} wins medals</>}.
              </p>
              {bets.length === 0 ? (
                <p className="note">No overlap between the sports that suit age {target} and the sports {usesRegion ? region : country.name} has won medals in. Try fewer years of training or another country.</p>
              ) : (
                <ol className="bet-list">
                  {bets.map((b, i) => (
                    <li key={b.sport}>
                      <span className="bet-rank">{i + 1}</span>
                      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <strong>{b.sport}</strong>
                        <span className="muted small">
                          {pct(b.shareNearAge)} of its medallists were within a year of {target} · median medallist {b.median}
                        </span>
                      </span>
                      <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                        <StatusChip s={b.status} />
                        <span className="small" style={{ fontWeight: 600 }}>{fmt(b.medals)} medal{b.medals === 1 ? '' : 's'}{usesRegion ? ` for ${region}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="card" style={{ flex: '2 1 320px' }} aria-labelledby="country">
              <h2 id="country" className="card-title">{country.name} at the Games</h2>
              <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="kpi-label">Medals</span>
                  <span className="kpi-value">{fmt(row?.total ?? 0)}</span>
                  <span className="muted small">{row && row.rank > 0 ? `#${row.rank} of ${winners}` : 'none 2000–2012'}</span>
                </div>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="kpi-label">Expected</span>
                  <span className="kpi-value">{point ? fmt1(point.expected) : '–'}</span>
                  <span className="muted small">{point ? 'from population and wealth' : 'no GDP data'}</span>
                </div>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="kpi-label">Actual ÷ expected</span>
                  <span className="kpi-value" style={{ color: point ? (point.performance >= 1 ? C.over : C.under) : undefined }}>
                    {point ? `${point.performance < 1 ? point.performance.toFixed(2) : fmt1(point.performance)}×` : '–'}
                  </span>
                  <span className="muted small">{point ? (point.performance >= 1.5 ? 'punches above its weight' : point.performance <= 1 / 1.5 ? 'below expectation' : 'close to expected') : ''}</span>
                </div>
              </div>
              <h3 className="kpi-label" style={{ marginTop: 6 }}>{usesRegion ? `Where ${region} wins` : `Where ${country.name} wins`}</h3>
              {medalsBySport.length === 0 ? <p className="muted small">No medals in this region either.</p> : (
                <ul className="hbar-list">
                  {medalsBySport.slice(0, 5).map((s) => (
                    <li key={s.sport} className="hbar-row">
                      <span className="hbar-label">{s.sport}</span>
                      <span className="hbar-track"><span style={{ position: 'absolute', inset: 0, width: `${(s.medals / medalsBySport[0].medals) * 100}%`, background: s.season === 'Winter' ? C.winter : C.summer, borderRadius: 3 }} /></span>
                      <span className="hbar-value">{fmt(s.medals)}</span>
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

          <ChartFrame
            title={`Age ${target} against each sport's medallists`}
            summary={`Each row is a sport (40+ medallists with a known age). Light bar: middle 80% of medallist ages, dark bar: middle 50%, dot: median; the orange line marks age ${target}. ${counts.prime ?? 0} prime, ${counts.reach ?? 0} within reach, ${counts.longshot ?? 0} long shots, ${counts.out ?? 0} with no medallist aged ${target}.`}
            legend={<>
              {(['prime', 'reach', 'longshot', 'out'] as AgeFitStatus[]).map((s) => <span key={s}><span className="dot" style={{ background: STATUS[s].color }} />{STATUS[s].label}{counts[s] ? ` (${counts[s]})` : ''}</span>)}
              <span><span aria-hidden="true" style={{ display: 'inline-block', width: 3, height: 14, background: C.summer, verticalAlign: 'middle', marginRight: 6 }} />Age {target}</span>
            </>}
            table={{ headers: ['Sport', 'Fit', 'Median age', 'Middle 50%', 'Middle 80%', 'Youngest–oldest', 'Medallists'],
              rows: fit.map((f) => [f.sport, STATUS[f.status].label, f.median, `${f.q1}–${f.q3}`, `${f.p10}–${f.p90}`, `${f.min}–${f.max}`, f.n]) }}
          >
            <div className="fit-chart">
              <ul className="fit-rows" aria-label="Sports by age fit">
                {shown.map((f) => <FitRow key={f.sport} f={f} age={target} />)}
              </ul>
              <div className="fit-axis" aria-hidden="true">
                <span />
                <span className="fit-axis-track">
                  {TICKS.map((t) => <span key={t} style={{ left: pos(t) }}>{t}</span>)}
                </span>
                <span />
              </div>
              <p className="muted small" style={{ textAlign: 'center', fontWeight: 600, margin: 0 }}>Age at the Games (years)</p>
            </div>
            {fit.length > SHOW_FIRST && (
              <button type="button" className="btn btn-small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? `Show the best ${SHOW_FIRST} only` : `Show all ${fit.length} sports`}
              </button>
            )}
          </ChartFrame>
        </>
      )}

      <p className="footnote">
        How to read this: the data only contains medallists, so it shows the ages and nations that actually won, not anyone's chance of winning.
        "Prime age" means your age falls in the middle 50% of the sport's medallist ages, "within reach" the middle 80%, "long shot" means at least one
        medallist was that age. Ages are from every medal record with an age (athlete level, every team member counted). Country medals use the usual rule:
        team sports once per team. Expected medals come from the population-and-wealth model on Drivers of success.
      </p>
    </>
  );
}

function FitRow({ f, age }: { f: SportAgeFit; age: number }) {
  return (
    <li className="fit-row" aria-label={`${f.sport}: ${STATUS[f.status].label}. Median medallist ${f.median}, middle half ${f.q1} to ${f.q3}, youngest ${f.min}, oldest ${f.max}.`}>
      <span className="fit-name">{f.sport}</span>
      <span className="fit-track" aria-hidden="true">
        {TICKS.map((t) => <span key={t} className="fit-grid" style={{ left: pos(t) }} />)}
        <span className="fit-range" style={{ left: pos(f.min), width: `calc(${pos(f.max)} - ${pos(f.min)})` }} />
        <span className="fit-p80" style={{ left: pos(f.p10), width: `calc(${pos(f.p90)} - ${pos(f.p10)})` }} />
        <span className="fit-p50" style={{ left: pos(f.q1), width: `calc(${pos(f.q3)} - ${pos(f.q1)})`, background: STATUS[f.status].color }} />
        <span className="fit-median" style={{ left: pos(f.median) }} />
        <span className="fit-you" style={{ left: pos(age) }} />
      </span>
      <StatusChip s={f.status} />
    </li>
  );
}
