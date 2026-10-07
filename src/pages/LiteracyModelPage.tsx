import { useMemo, useState } from 'react';
import { ExpectedScatter } from '../components/charts/ExpectedScatter';
import { InsightBanner, PageHeader } from '../components/ui/Card';
import { Dropdown } from '../components/ui/Dropdown';
import { FilterBar } from '../components/ui/FilterBar';
import { expectedMedalsModel, literacyModelChanges } from '../domain/metrics';
import { useDataStore, useDataset } from '../store/useDataStore';
import { C } from '../styles/colors';
import { fmt, fmt1, pct } from '../utils/format';

/**
 * Additional insight: the expected-medals model with literacy as a third factor
 * (population + wealth + literacy), compared with the two-factor model on Drivers of success.
 */
export default function LiteracyModelPage() {
  const d = useDataset();
  const filters = useDataStore((s) => s.filters);
  const base = useMemo(() => expectedMedalsModel(d, filters), [d, filters]);
  const lit = useMemo(() => expectedMedalsModel(d, filters, { literacy: true }), [d, filters]);
  const changes = useMemo(() => literacyModelChanges(d, filters), [d, filters]);
  const [highlightId, setHighlightId] = useState<number | 'none'>(() => d.countries.find((c) => c.name === 'India')?.id ?? 'none');

  const india = changes.find((c) => c.name === 'India');
  const biggest = changes.filter((c) => c.expectedBase >= 5 || c.expected >= 5).slice(0, 10);

  return (
    <>
      <PageHeader title="Literacy model" subtitle="What if the general rule also knew how many adults can read?">
        <Dropdown<number | 'none'> label="Highlight a nation" value={highlightId} onChange={setHighlightId} minWidth={180}
          options={[{ value: 'none', label: 'None' }, ...[...lit.points].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.countryId, label: p.name }))]} />
        <FilterBar />
      </PageHeader>

      <InsightBanner>
        Adding literacy lifts the share of medal differences explained from {pct(base.explained)} to {pct(lit.explained)}
        {india ? <>, and most of India's gap disappears: expected {fmt(Math.round(india.expectedBase))} → {fmt(Math.round(india.expected))} medals.</> : '.'}
      </InsightBanner>

      <div className="row">
        <ModelCard title="Population + wealth" note="The model on Drivers of success" model={base} />
        <ModelCard title="+ Literacy" note="Adds adult literacy (%) as a third factor" model={lit} highlight />
      </div>

      <ExpectedScatter points={lit.points} highlightId={highlightId} factors="population, wealth and literacy" />

      <section className="card" aria-labelledby="changes">
        <h2 id="changes" className="card-title">Whose expected medals change most when literacy is added?</h2>
        <p className="muted small">Nations expected to win 5+ medals in either model, sorted by the size of the change.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Nation</th><th scope="col" className="num">Literacy</th><th scope="col" className="num">Expected: population + wealth</th><th scope="col" className="num">Expected: + literacy</th><th scope="col" className="num">Actual medals</th></tr></thead>
            <tbody>
              {biggest.map((c) => (
                <tr key={c.countryId}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td className="num">{c.literacy === null ? '–' : `${fmt1(c.literacy)}%`}</td>
                  <td className="num">{fmt1(c.expectedBase)}</td>
                  <td className="num" style={{ fontWeight: 700, color: c.expected < c.expectedBase ? C.under : C.over }}>{fmt1(c.expected)}</td>
                  <td className="num">{fmt(c.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="note">
        Read with care: literacy and wealth move together, so with literacy in the model 10× the wealth adds only {fmt1(lit.gdpMultiplier)}× the medals
        (was {fmt1(base.gdpMultiplier)}×). Nations with low literacy are now expected to win almost nothing, so East African distance runners look like
        huge over-performers. {base.n - lit.n} nations without literacy data drop out of this model.
      </p>

      <p className="footnote">Model: Poisson regression, expected medals = exp(a + b₁·log₁₀ population + b₂·log₁₀ GDP per person + b₃·literacy %),
        fitted on {lit.n} nations with GDP and literacy data (including those with no medals), re-fitted live for the current filters and data edits.
        "Share explained" is deviance explained (a pseudo-R²). Team sports count once per team.</p>
    </>
  );
}

function ModelCard({ title, note, model, highlight = false }: { title: string; note: string; model: ReturnType<typeof expectedMedalsModel>; highlight?: boolean }) {
  const stat = (label: string, value: string) => (
    <div><dt className="muted small" style={{ fontWeight: 600 }}>{label}</dt><dd style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{value}</dd></div>
  );
  return (
    <section className="card" style={{ flex: '1 1 320px', ...(highlight ? { borderColor: C.primary } : {}) }} aria-label={`Model: ${title}`}>
      <h2 className="card-title">{title}</h2>
      <p className="muted small">{note} · {model.n} nations</p>
      <dl className="stack" style={{ margin: 0, gap: 12 }}>
        {stat('Share of medal differences explained', pct(model.explained))}
        {stat('10× the population', `≈ ${fmt1(model.popMultiplier)}× the medals`)}
        {stat('10× the wealth per person', `≈ ${fmt1(model.gdpMultiplier)}× the medals`)}
        {model.literacyMultiplier !== null && stat('+10 points of literacy', `≈ ${fmt1(model.literacyMultiplier)}× the medals`)}
      </dl>
    </section>
  );
}
