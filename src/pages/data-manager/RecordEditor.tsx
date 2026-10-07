import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IconClose } from '../../components/ui/Icons';
import type { Athlete, Dataset, MedalRecord, MedalType } from '../../domain/types';
import { validateMedalRecord } from '../../domain/validation';
import { useDataStore, useDataset } from '../../store/useDataStore';

/**
 * Add / edit form for one medal record. Works on a local draft; nothing changes
 * until Save, and Save is blocked while there are errors. Warnings are shown
 * but do not block (the user may know something the checks don't).
 */
export function RecordEditor({ record, onClose, goToSports }: { record: MedalRecord; onClose: () => void; goToSports: () => void }) {
  const d = useDataset();
  const { upsertRecord, deleteRecord } = useDataStore();
  const isNew = !d.records.some((r) => r.id === record.id);
  const [draft, setDraft] = useState<MedalRecord>(record);
  const [athleteText, setAthleteText] = useState(() => d.athletes.find((a) => a.id === record.athleteId)?.name ?? '');
  const [pickedId, setPickedId] = useState<number | null>(record.athleteId);
  const [creating, setCreating] = useState(false);          // adding an athlete who is not in the data yet
  const [birthYear, setBirthYear] = useState<number>(NaN);
  const [noAthlete, setNoAthlete] = useState(!isNew && record.athleteId === null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const athleteIdByName = useMemo(() => new Map(d.athletes.map((a) => [a.name.toLowerCase(), a.id])), [d]);
  // an athlete counts as chosen when picked from the list or typed exactly
  const matchedAthlete = pickedId !== null && d.athletes.find((a) => a.id === pickedId)?.name === athleteText ? pickedId : athleteIdByName.get(athleteText.trim().toLowerCase()) ?? null;
  const sport = d.sports.find((s) => s.id === draft.sportId);
  const games = d.games.find((g) => g.id === draft.gamesId);
  const nation = d.countries.find((c) => c.id === draft.countryId);
  const newName = athleteText.trim().replace(/\s+/g, ' ');
  const isCreating = !noAthlete && creating && !matchedAthlete;
  const newAthlete: Athlete | undefined = isCreating
    ? { id: Math.max(0, ...d.athletes.map((a) => a.id)) + 1, name: newName, country: nation?.name ?? '', sport: sport?.name ?? '', birthYear }
    : undefined;

  const candidate: MedalRecord = { ...draft, athleteId: noAthlete ? null : isCreating ? newAthlete!.id : matchedAthlete };
  const { errors, warnings } = validateMedalRecord(candidate, d);
  if (!noAthlete && !matchedAthlete && !isCreating)
    errors.athlete = newName ? 'Pick a name from the list, or choose “Add as a new athlete”.' : 'Enter an athlete';
  if (isCreating) {
    if (newName.length < 2) errors.athlete = 'Enter the new athlete’s full name';
    const maxYear = (games?.year ?? 2012) - 10;
    if (!Number.isInteger(birthYear) || birthYear < 1930 || birthYear > maxYear) errors.birthYear = `Enter a birth year between 1930 and ${maxYear}`;
    else if (draft.age !== null && games && Math.abs(games.year - birthYear - draft.age) > 1)
      warnings.push(`Age ${draft.age} does not match birth year ${birthYear} (expected about ${games.year - birthYear}).`);
  }
  const athlete = d.athletes.find((a) => a.id === matchedAthlete);
  const set = <K extends keyof MedalRecord>(k: K, v: MedalRecord[K]) => setDraft((x) => ({ ...x, [k]: v }));
  const show = (k: string) => (submitted || k === 'sportId') && errors[k];

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    upsertRecord(candidate, newAthlete);
    onClose();
  };

  return (
    <aside className="card editor" aria-labelledby="editor-title">
      <div className="card-head" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="editor-title" className="card-title">{isNew ? 'Add medal record' : `Edit medal record #${record.id}`}</h2>
          <span className="muted small">{isNew ? 'All fields except age are required' : 'Changes apply when you save'}</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close editor"><IconClose /></button>
      </div>

      <AthleteSearch d={d} value={athleteText} disabled={noAthlete} invalid={!!(submitted && errors.athlete)}
        onType={(t) => { setAthleteText(t); setPickedId(null); setCreating(false); }}
        onPick={(a) => { setAthleteText(a.name); setPickedId(a.id); setCreating(false); }}
        onCreate={() => setCreating(true)}
        hint={submitted && errors.athlete ? <span className="field-error">{errors.athlete}</span>
          : athlete ? <span className="field-hint">{athlete.country} · {athlete.sport} · born {athlete.birthYear}</span>
          : isCreating ? <span className="field-hint">New athlete: will be added to the data when you save</span>
          : <span className="field-hint">Search by any part of the name, e.g. “phelps”</span>} />
      {isCreating && (
        <div className="new-athlete">
          <strong className="small">New athlete: {newName || '…'}</strong>
          <span className="muted small">Nation and sport are taken from this record ({nation?.name ?? 'choose a nation'} · {sport?.name ?? 'choose a sport'}).</span>
          <label className="field" style={{ maxWidth: 200 }}>Year of birth
            <input type="number" min={1930} max={2010} value={Number.isNaN(birthYear) ? '' : birthYear}
              onChange={(e) => setBirthYear(e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!!(submitted && errors.birthYear)} />
            {submitted && errors.birthYear && <span className="field-error">{errors.birthYear}</span>}
          </label>
        </div>
      )}
      <label className="switch small"><input type="checkbox" checked={noAthlete} onChange={(e) => setNoAthlete(e.target.checked)} /> No athlete (unknown team member)</label>

      <div className="form-grid">
        <label className="field">Nation
          <select value={draft.countryId || ''} onChange={(e) => set('countryId', Number(e.target.value))} aria-invalid={!!show('countryId')}>
            <option value="" disabled>Choose…</option>
            {[...d.countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {show('countryId') && <span className="field-error">{errors.countryId}</span>}
        </label>
        <label className="field">Games
          <select value={draft.gamesId || ''} onChange={(e) => set('gamesId', Number(e.target.value))} aria-invalid={!!show('gamesId')}>
            <option value="" disabled>Choose…</option>
            {[...d.games].sort((a, b) => a.year - b.year).map((g) => <option key={g.id} value={g.id}>{g.city} {g.year}</option>)}
          </select>
          {show('gamesId') && <span className="field-error">{errors.gamesId}</span>}
        </label>
      </div>

      <label className="field">Sport
        <select value={draft.sportId || ''} onChange={(e) => set('sportId', Number(e.target.value))} aria-invalid={!!show('sportId')}>
          <option value="" disabled>Choose…</option>
          {[...d.sports].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.season})</option>)}
        </select>
        {show('sportId') && <span className="field-error">{errors.sportId}</span>}
      </label>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="field" style={{ padding: 0, marginBottom: 4 }}>Medal</legend>
        <div className="radio-row">
          {(['gold', 'silver', 'bronze'] as MedalType[]).map((m) => (
            <label key={m} className="radio"><input type="radio" name="medal" checked={draft.medal === m} onChange={() => set('medal', m)} /> {m[0].toUpperCase() + m.slice(1)}</label>
          ))}
        </div>
      </fieldset>

      <div className="form-grid">
        <label className="field">Number of medals
          <input type="number" min={1} max={10} value={Number.isNaN(draft.medalCount) ? '' : draft.medalCount}
            onChange={(e) => set('medalCount', e.target.value === '' ? NaN : Number(e.target.value))} aria-invalid={!!show('medalCount')} />
          {show('medalCount') ? <span className="field-error">{errors.medalCount}</span> : <span className="field-hint">Same colour, same sport, same Games</span>}
        </label>
        <label className="field">Age at Games
          <input type="number" min={10} max={80} value={draft.age ?? ''} onChange={(e) => set('age', e.target.value === '' ? null : Number(e.target.value))} aria-invalid={!!show('age')} />
          {show('age') ? <span className="field-error">{errors.age}</span>
            : <span className="field-hint">{athlete && games ? `Expected about ${games.year - athlete.birthYear}` : 'Optional'}</span>}
        </label>
      </div>

      {sport && (
        <div className="warning-box">
          <strong>Counting rule:</strong> {sport.countingRule === 'team'
            ? `${sport.name} is a team event, so the whole team's medal counts once for the nation.`
            : `${sport.name} is counted per athlete, so each medal here adds to the nation's total.`}{' '}
          <button type="button" className="btn btn-ghost btn-small" style={{ padding: 0 }} onClick={goToSports}>Change rule</button>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="warning-box" style={{ margin: 0, paddingLeft: 28 }} aria-live="polite">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {submitted && Object.keys(errors).length > 0 && <p role="alert" className="field-error small">Please fix the highlighted fields before saving.</p>}

      <div className="card-head" style={{ alignItems: 'center' }}>
        {!isNew ? (confirmDelete ? (
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-danger" onClick={() => { deleteRecord(record.id); onClose(); }}>Confirm delete</button>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Keep</button>
          </span>
        ) : <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete record</button>) : <span />}
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>{isNew ? 'Add record' : 'Save changes'}</button>
        </span>
      </div>
    </aside>
  );
}

/** Normalise for searching: lower case, accents removed ("Bjørndalen" matches "bjorndalen"). */
const norm = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/g, 'o').toLowerCase();

/**
 * Athlete search box (combobox). Type any part of a name; the list shows up to 8 matches with nation,
 * sport and birth year, plus "Add as a new athlete" when the name is not in the data.
 * Keyboard: ↑ ↓ move, Enter chooses, Escape closes.
 */
function AthleteSearch({ d, value, disabled, invalid, hint, onType, onPick, onCreate }: {
  d: Dataset; value: string; disabled: boolean; invalid: boolean; hint: React.ReactNode;
  onType: (t: string) => void; onPick: (a: Athlete) => void; onCreate: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const q = norm(value.trim());
  const index = useMemo(() => d.athletes.map((a) => ({ a, n: norm(a.name) })), [d]);
  const matches = useMemo(() => (q.length < 2 ? [] : index.filter((x) => x.n.includes(q))
    .sort((x, y) => Number(!x.n.startsWith(q)) - Number(!y.n.startsWith(q)) || x.a.name.localeCompare(y.a.name)).slice(0, 8).map((x) => x.a)), [index, q]);
  const exact = matches.some((a) => norm(a.name) === q);
  const options: ({ kind: 'athlete'; a: Athlete } | { kind: 'new' })[] = [
    ...matches.map((a) => ({ kind: 'athlete' as const, a })),
    ...(q.length >= 2 && !exact ? [{ kind: 'new' as const }] : []),
  ];
  const showList = open && !disabled && options.length > 0;
  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.kind === 'athlete') onPick(o.a); else onCreate();
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && showList) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') setOpen(false);
  };
  return (
    <div className="field athlete-search">
      <label htmlFor={`${id}-input`}>Athlete</label>
      <input ref={input} id={`${id}-input`} type="text" role="combobox" autoComplete="off" value={value} disabled={disabled}
        placeholder="Type a name, e.g. phelps" aria-invalid={invalid} aria-autocomplete="list" aria-expanded={showList}
        aria-controls={`${id}-list`} aria-activedescendant={showList ? `${id}-opt-${active}` : undefined} aria-describedby={`${id}-hint`}
        onChange={(e) => { onType(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="dropdown-list" aria-label="Matching athletes">
          {options.map((o, i) => (
            <li key={o.kind === 'athlete' ? o.a.id : 'new'} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'is-active' : undefined} onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              {o.kind === 'athlete' ? (
                <span className="stack" style={{ gap: 0 }}>
                  <span>{o.a.name}</span>
                  <span className="muted small">{o.a.country} · {o.a.sport} · born {o.a.birthYear}</span>
                </span>
              ) : (
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>+ Add “{value.trim()}” as a new athlete</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <span id={`${id}-hint`}>{hint}</span>
    </div>
  );
}
