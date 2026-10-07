import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { IconCheck, IconDownload, IconPlus, IconUpload } from '../components/ui/Icons';
import { PageHeader } from '../components/ui/Card';
import { changedRules, datasetToWorkbook, ImportError, parseWorkbook } from '../data/excel';
import { useDataStore, useDataset } from '../store/useDataStore';
import { fmt } from '../utils/format';
import { RecordsTab, type ReviewFilter } from './data-manager/RecordsTab';
import { CountriesTab } from './data-manager/CountriesTab';
import { SportsTab } from './data-manager/SportsTab';
import { GamesTab } from './data-manager/GamesTab';

type Tab = 'records' | 'countries' | 'sports' | 'games';

/** Screen 5: add, correct and review the data behind every chart. */
export default function DataManagerPage() {
  const d = useDataset();
  const { lastChange, history, changeCount, undo, resetToOriginal, replaceDataset } = useDataStore();
  const rules = changedRules(d.sports);
  const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const ruleText = [
    rules.toTeam.length ? `${list(rules.toTeam)} ${rules.toTeam.length > 1 ? 'are' : 'is'} counted once per team` : '',
    rules.toAthlete.length ? `${list(rules.toAthlete)} ${rules.toAthlete.length > 1 ? 'are' : 'is'} counted per athlete` : '',
  ].filter(Boolean).join('; ');
  const [tab, setTab] = useState<Tab>('records');
  const [review, setReview] = useState<ReviewFilter>('all');
  const [addSignal, setAddSignal] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<{ file: string; problems: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportExcel = () => XLSX.writeFile(datasetToWorkbook(d), `olympic-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
  const importExcel = async (file: File) => {
    setImportError(null);
    try {
      const next = parseWorkbook(XLSX.read(await file.arrayBuffer()));
      replaceDataset(next, `Imported ${file.name} (${fmt(next.records.length)} medal records)`);
    } catch (e) {
      const problems = e instanceof ImportError ? e.problems : ['The file could not be read as an Excel workbook.'];
      setImportError({ file: file.name, problems });
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'records', label: 'Medal records', count: d.records.length },
    { id: 'countries', label: 'Nations', count: d.countries.length },
    { id: 'sports', label: 'Sports & counting rules', count: d.sports.length },
    { id: 'games', label: 'Games', count: d.games.length },
  ];

  return (
    <>
      <PageHeader title="Data manager" subtitle="Add, correct and review the data behind every chart. Changes update all screens immediately.">
        <input ref={fileInput} type="file" accept=".xlsx,.xls" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importExcel(f); e.target.value = ''; }} />
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}><IconUpload />Import Excel</button>
        <button type="button" className="btn" onClick={exportExcel}><IconDownload />Export Excel</button>
        <button type="button" className="btn btn-primary" onClick={() => { setTab('records'); setAddSignal((n) => n + 1); }}><IconPlus />Add medal record</button>
      </PageHeader>

      {importError && (
        <div role="alert" className="warning-box">
          <p style={{ margin: 0 }}><strong>Import failed: nothing was changed.</strong> {importError.file} has {importError.problems.length === 1 ? 'this problem' : `${fmt(importError.problems.length)} problems`}:</p>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {importError.problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}
          </ul>
          {importError.problems.length > 8 && <p style={{ margin: '4px 0 0' }}>…and {fmt(importError.problems.length - 8)} more.</p>}
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setImportError(null)}>Dismiss</button>
        </div>
      )}

      <div role="status" className={`status-bar${lastChange && history.length ? ' is-success' : ''}`}>
        <span className="stack" style={{ gap: 2, minWidth: 0, flex: '1 1 420px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconCheck />
            {lastChange
              ? `${lastChange}. All charts now use the updated data.`
              : 'Showing the original data. Edits are saved in this browser; the original file is never changed.'}
          </span>
          {(ruleText || changeCount > 1) && (
            <span className="small" style={{ paddingLeft: 28 }}>
              {changeCount > 1 && <><strong>{changeCount} edits</strong> this session. </>}
              {ruleText && <>Counting rules changed from the original: <strong>{ruleText}</strong>.</>}
            </span>
          )}
        </span>
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={undo} disabled={history.length === 0}>Undo last change</button>
          {confirmReset ? (
            <>
              <button type="button" className="btn btn-danger btn-small" onClick={async () => { await resetToOriginal(); setConfirmReset(false); }}>Yes, discard all edits</button>
              <button type="button" className="btn btn-small" onClick={() => setConfirmReset(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReset(true)}>Reset to original data</button>
          )}
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="Data tables">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="muted" style={{ fontWeight: 500 }}>{fmt(t.count)}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack" style={{ gap: 16 }}>
        {tab === 'records' && <RecordsTab review={review} setReview={setReview} addSignal={addSignal} goToSports={() => setTab('sports')} />}
        {tab === 'countries' && <CountriesTab />}
        {tab === 'sports' && <SportsTab />}
        {tab === 'games' && <GamesTab />}
      </div>
    </>
  );
}
