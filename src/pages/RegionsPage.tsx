import { useMemo } from 'react';
import { GroupHBars, RatioLegend, ratioText, signed } from '../components/charts/GroupBars';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { ChartFrame } from '../components/ui/ChartFrame';
import { FilterBar } from '../components/ui/FilterBar';
import { regionStats, type GroupStats } from '../domain/metrics';
import { useDataStore, useDataset } from '../store/useDataStore';
import { C } from '../styles/colors';
import { fmt, fmt1, pct, usd } from '../utils/format';

const find = (rs: GroupStats[], key: string) => rs.find((r) => r.key === key);
const range = (xs: (number | null)[], unit = '') => {
  const v = xs.filter((x): x is number => x !== null);
  return `${fmt(Math.min(...v))}–${fmt(Math.max(...v))}${unit}`;
};
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Screen: medals by world region, and which national factors explain the gaps. */
export default function RegionsPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);
  const regions = useMemo(() => regionStats(d, filters), [d, filters]);
  const byRatio = [...regions].sort((a, b) => (b.actualVsExpected ?? 0) - (a.actualVsExpected ?? 0));
  const byMedals = [...regions].sort((a, b) => b.medals - a.medals);

  const we = find(regions, 'Western Europe');
  const asia = find(regions, 'Asia (ex. Near East)');
  const weakest = regions.slice(-4);
  const strong = regions.filter((r) => r.perTenMillion >= 20);
  const noWinter = regions.filter((r) => r.medals > 0 && r.winterMedals === 0).map((r) => r.key);
  const postSoviet = ['CIS (former USSR)', 'Eastern Europe', 'Baltics'].map((k) => find(regions, k)).filter((r): r is GroupStats => !!r);

  return (
    <>
      <PageHeader title="Regions" subtitle="Which parts of the world win most, and why?">
        <FilterBar />
      </PageHeader>

      {we && asia && (
        <InsightBanner linkTo="/drivers" linkText="See what drives success">
          Western Europe won {pct(we.shareOfMedals)} of medals with {pct(we.shareOfPopulation)} of the people; Asia won {pct(asia.shareOfMedals)} with {pct(asia.shareOfPopulation)}.
        </InsightBanner>
      )}

      <div className="row">
        <ChartFrame
          style={{ flex: '1 1 440px' }}
          title="Medals per 10M people"
          summary={`${regions[0].key} wins most per person (${fmt1(regions[0].perTenMillion)} per 10M people), ${regions[regions.length - 1].key} least (${fmt1(regions[regions.length - 1].perTenMillion)}). Every nation in a region counts, also those without medals.`}
          table={regionTable(regions)}
        >
          <GroupHBars groups={regions} value={(r) => r.perTenMillion} mode="value" format={fmt1} label="Medals per 10M people" xLabel="Medals per 10 million people" />
        </ChartFrame>
        <ChartFrame
          style={{ flex: '1 1 440px' }}
          title="Beyond population and wealth"
          legend={<RatioLegend />}
          summary={`Medals ÷ what the region's population and wealth predict. ${byRatio[0].key} wins ${ratioText(byRatio[0].actualVsExpected)} its expected medals; ${byRatio[byRatio.length - 1].key} only ${ratioText(byRatio[byRatio.length - 1].actualVsExpected)}.`}
          table={regionTable(byRatio)}
        >
          <GroupHBars groups={byRatio} value={(r) => r.actualVsExpected} mode="ratio" format={(v) => ratioText(v)} label="Actual ÷ expected" xLabel="Actual ÷ expected medals (1.0× = as population and wealth predict)" />
        </ChartFrame>
      </div>

      <section className="card" aria-labelledby="profile">
        <h2 id="profile" className="card-title">Region profile</h2>
        <p className="muted small">Averages are population-weighted, so they reflect where people live. Birth rate and net migration per 1,000 people. Sorted by medals.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Region profile table">
          <table>
            <thead>
              <tr>
                <th scope="col">Region</th><th scope="col" className="num">Medals</th><th scope="col" className="num">Share of medals</th>
                <th scope="col" className="num">Share of people</th><th scope="col" className="num">Per 10M people</th><th scope="col" className="num">Actual ÷ expected</th>
                <th scope="col" className="num">GDP per person</th><th scope="col" className="num">Literacy</th><th scope="col" className="num">Birth rate</th>
                <th scope="col" className="num">Net migration</th><th scope="col" className="num">Winter share</th><th scope="col" className="num">Nations with a medal</th>
              </tr>
            </thead>
            <tbody>
              {byMedals.map((r) => (
                <tr key={r.key}>
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.key}</td>
                  <td className="num">{fmt(r.medals)}</td>
                  <td className="num">{pct(r.shareOfMedals)}</td>
                  <td className="num">{pct(r.shareOfPopulation)}</td>
                  <td className="num">{fmt1(r.perTenMillion)}</td>
                  <td className="num" style={{ fontWeight: 700, color: (r.actualVsExpected ?? 0) >= 1 ? C.over : C.under }}>{ratioText(r.actualVsExpected)}</td>
                  <td className="num">{r.gdpPerCapita === null ? '–' : usd(r.gdpPerCapita)}</td>
                  <td className="num">{r.literacy === null ? '–' : `${fmt1(r.literacy)}%`}</td>
                  <td className="num">{r.birthrate === null ? '–' : fmt1(r.birthrate)}</td>
                  <td className="num">{r.netMigration === null ? '–' : signed(r.netMigration)}</td>
                  <td className="num">{r.medals > 0 ? pct(r.winterMedals / r.medals) : '–'}</td>
                  <td className="num">{r.winners} of {r.nations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="why">
        <h2 id="why" className="card-title">Why the gaps?</h2>
        <ul className="stack" style={{ margin: 0, paddingLeft: 20, gap: 10 }}>
          <li>
            <strong>Development explains most of it.</strong> The four weakest regions are {list(weakest.map((r) => r.key))}. They have
            literacy of {range(weakest.map((r) => r.literacy), '%')} and birth rates of {range(weakest.map((r) => r.birthrate))} per 1,000.
            Regions winning 20+ medals per 10M people sit at {range(strong.map((r) => r.literacy), '%')} literacy.
          </li>
          {postSoviet.length > 0 && (
            <li>
              <strong>The former Soviet bloc over-performs.</strong> {list(postSoviet.map((r) => `${r.key} ${ratioText(r.actualVsExpected)}`))} of
              what population and wealth predict. Near-universal literacy and the legacy of state sport systems are the usual explanation;
              the data itself cannot test the second.
            </li>
          )}
          <li>
            <strong>Rich does not always mean medals.</strong> The Near East is richer than Asia, yet wins furthest below expectation; the Gulf states
            (Qatar, Kuwait, the UAE) won only a handful of medals.
          </li>
          {noWinter.length > 0 && (
            <li>
              <strong>Climate is a hidden factor.</strong> {list(noWinter)} won no Winter medals, while Winter Games make up a large
              part of Western Europe's and Northern America's totals.
            </li>
          )}
          <li>
            <strong>Some regions are one country.</strong> Oceania is mostly Australia and Northern America mostly the USA, so their averages
            describe those two nations.
          </li>
        </ul>
      </section>

      <p className="footnote">
        Regions as in the Country Data sheet (abbreviations spelled out). Expected medals come from the population-and-wealth model on Drivers of
        success, summed over each region's nations with GDP data. Team sports count once per team.
      </p>
    </>
  );
}

function regionTable(rs: GroupStats[]) {
  return {
    headers: ['Region', 'Medals', 'Per 10M people', 'Actual ÷ expected', 'Nations with a medal'],
    rows: rs.map((r) => [r.key, fmt(r.medals), fmt1(r.perTenMillion), ratioText(r.actualVsExpected), `${r.winners} of ${r.nations}`]),
  };
}
