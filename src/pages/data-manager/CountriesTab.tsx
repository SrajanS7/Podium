import { useMemo, useState } from 'react';
import { countryRows } from '../../domain/metrics';
import type { Country } from '../../domain/types';
import { countrySchema } from '../../domain/validation';
import { useDataStore, useDataset } from '../../store/useDataStore';
import { fmt, usd } from '../../utils/format';

/** Edit a nation's facts. Population and GDP feed the Drivers of success model. */
export function CountriesTab() {
  const d = useDataset();
  const updateCountry = useDataStore((s) => s.updateCountry);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Country | null>(null);
  const medals = useMemo(() => new Map(countryRows(d, { season: 'all', gamesId: 'all' }).map((r) => [r.countryId, r.total])), [d]);
  const q = query.trim().toLowerCase();
  const list = d.countries.filter((c) => !q || `${c.name} ${c.region}`.toLowerCase().includes(q))
    .sort((a, b) => (medals.get(b.id) ?? 0) - (medals.get(a.id) ?? 0) || a.name.localeCompare(b.name)).slice(0, 25);

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <section className="card" style={{ flex: '999 1 520px' }} aria-label="Nations">
        <label className="field" style={{ maxWidth: 360 }}>Search nations
          <input type="search" value={query} placeholder="Name or region" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="table-wrap">
          <table>
            <thead><tr><th scope="col">Nation</th><th scope="col">Region</th><th scope="col" className="num">Population</th><th scope="col" className="num">GDP per person</th><th scope="col" className="num">Medals</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className={editing?.id === c.id ? 'is-selected' : ''}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td><td>{c.region}</td>
                  <td className="num">{fmt(c.population)}</td>
                  <td className="num">{c.gdpPerCapita === null ? <span className="muted">missing</span> : usd(c.gdpPerCapita)}</td>
                  <td className="num">{medals.get(c.id) ?? 0}</td>
                  <td><button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Showing up to 25 nations, most medals first. Use search to find others.</p>
      </section>
      {editing && <CountryEditor key={editing.id} country={editing} onClose={() => setEditing(null)} onSave={(c) => { updateCountry(c); setEditing(null); }} />}
    </div>
  );
}

function CountryEditor({ country, onClose, onSave }: { country: Country; onClose: () => void; onSave: (c: Country) => void }) {
  const [draft, setDraft] = useState(country);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const res = countrySchema.safeParse(draft);
    if (!res.success) {
      const e: Record<string, string> = {};
      for (const i of res.error.issues) e[String(i.path[0])] ??= i.message;
      setErrors(e);
      return;
    }
    onSave(draft);
  };
  return (
    <aside className="card editor" aria-labelledby="country-editor">
      <h2 id="country-editor" className="card-title">Edit {country.name}</h2>
      <p className="muted small">Population and GDP per person drive the expected-medals model on Drivers of success. Coastline and net migration feed Geography myths and Regions.</p>
      <label className="field">Region
        <input type="text" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} aria-invalid={!!errors.region} />
        {errors.region && <span className="field-error">{errors.region}</span>}
      </label>
      <label className="field">Population
        <input type="number" min={1} value={Number.isNaN(draft.population) ? '' : draft.population} onChange={(e) => setDraft({ ...draft, population: e.target.value === '' ? NaN : Number(e.target.value) })} aria-invalid={!!errors.population} />
        {errors.population && <span className="field-error">{errors.population}</span>}
      </label>
      <label className="field">GDP per person (USD)
        <input type="number" min={1} value={draft.gdpPerCapita ?? ''} onChange={(e) => setDraft({ ...draft, gdpPerCapita: e.target.value === '' ? null : Number(e.target.value) })} aria-invalid={!!errors.gdpPerCapita} />
        {errors.gdpPerCapita ? <span className="field-error">{errors.gdpPerCapita}</span> : <span className="field-hint">Leave empty if unknown: the nation is then left out of the model</span>}
      </label>
      <label className="field">Coastline (km)
        <input type="number" min={0} value={draft.coastlineKm ?? ''} onChange={(e) => setDraft({ ...draft, coastlineKm: e.target.value === '' ? null : Number(e.target.value) })} aria-invalid={!!errors.coastlineKm} />
        {errors.coastlineKm ? <span className="field-error">{errors.coastlineKm}</span> : <span className="field-hint">0 = landlocked · used on Geography myths</span>}
      </label>
      <label className="field">Net migration (per 1,000 people)
        <input type="number" step={0.1} value={draft.netMigration ?? ''} onChange={(e) => setDraft({ ...draft, netMigration: e.target.value === '' ? null : Number(e.target.value) })} aria-invalid={!!errors.netMigration} />
        {errors.netMigration ? <span className="field-error">{errors.netMigration}</span> : <span className="field-hint">Negative = more people leave than arrive</span>}
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save}>Save changes</button>
      </div>
    </aside>
  );
}
