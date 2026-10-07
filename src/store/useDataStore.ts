/**
 * Global state (Zustand): the dataset, the shared filters and the undo history.
 * Every edit replaces the dataset immutably, so React re-renders every screen
 * that depends on it and the previous version can be restored with Undo.
 */
import { create } from 'zustand';
import { repository } from '../data/repository';
import type { Athlete, Country, Dataset, Filters, MedalRecord, Sport } from '../domain/types';

const MAX_UNDO = 25;

interface DataState {
  dataset: Dataset | null;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  filters: Filters;
  history: { dataset: Dataset; label: string }[];
  changeCount: number;
  lastChange: string | null;

  init: () => Promise<void>;
  setFilters: (f: Partial<Filters>) => void;
  /** Save a record; pass `newAthlete` to create that athlete in the same step (one undo restores both). */
  upsertRecord: (r: MedalRecord, newAthlete?: Athlete) => void;
  deleteRecord: (id: number) => void;
  updateCountry: (c: Country) => void;
  updateSport: (s: Sport) => void;
  replaceDataset: (d: Dataset, label: string) => void;
  undo: () => void;
  resetToOriginal: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => {
  /** Apply a change: remember the old version for undo, then persist. */
  const commit = (next: Dataset, label: string) => {
    const prev = get().dataset;
    if (!prev) return;
    set((s) => ({
      dataset: next,
      history: [...s.history, { dataset: prev, label }].slice(-MAX_UNDO),
      changeCount: s.changeCount + 1,
      lastChange: label,
    }));
    void repository.save(next);
  };

  return {
    dataset: null, status: 'loading', error: null,
    filters: { season: 'all', gamesId: 'all' },
    history: [], changeCount: 0, lastChange: null,

    init: async () => {
      try {
        const { dataset, fromWorkingCopy } = await repository.load();
        set({ dataset, status: 'ready', lastChange: fromWorkingCopy ? 'Loaded your saved working copy' : null });
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'Unknown error' });
      }
    },

    setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

    upsertRecord: (r, newAthlete) => {
      const d = get().dataset!;
      const exists = d.records.some((x) => x.id === r.id);
      const records = exists ? d.records.map((x) => (x.id === r.id ? r : x)) : [...d.records, r];
      const athletes = newAthlete ? [...d.athletes, newAthlete] : d.athletes;
      const label = `${exists ? 'Edited' : 'Added'} medal record #${r.id}${newAthlete ? ` with new athlete ${newAthlete.name}` : ''}`;
      commit({ ...d, records, athletes }, label);
    },

    deleteRecord: (id) => {
      const d = get().dataset!;
      commit({ ...d, records: d.records.filter((x) => x.id !== id) }, `Deleted medal record #${id}`);
    },

    updateCountry: (c) => {
      const d = get().dataset!;
      commit({ ...d, countries: d.countries.map((x) => (x.id === c.id ? c : x)) }, `Updated ${c.name}`);
    },

    updateSport: (s) => {
      const d = get().dataset!;
      const label = `${s.name}: counted ${s.countingRule === 'team' ? 'once per team' : 'per athlete'}`;
      commit({ ...d, sports: d.sports.map((x) => (x.id === s.id ? s : x)) }, label);
    },

    replaceDataset: (next, label) => commit(next, label),

    undo: () => {
      const { history } = get();
      const last = history[history.length - 1];
      if (!last) return;
      set((s) => ({ dataset: last.dataset, history: s.history.slice(0, -1), changeCount: Math.max(0, s.changeCount - 1), lastChange: `Undid: ${last.label}` }));
      void repository.save(last.dataset);
    },

    resetToOriginal: async () => {
      const dataset = await repository.reset();
      set({ dataset, history: [], changeCount: 0, lastChange: 'Reset to the original data' });
    },
  };
});

/** Convenience hook: the loaded dataset (pages render only after loading). */
export const useDataset = () => useDataStore((s) => s.dataset!);
