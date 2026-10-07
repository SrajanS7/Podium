/**
 * Where the data lives. The UI only talks to the DataRepository interface, so
 * swapping browser storage for a real backend later means writing one new class
 * (e.g. ApiRepository calling a REST API) without touching any screen.
 */
import { del, get, set } from 'idb-keyval';
import type { Dataset } from '../domain/types';

export interface DataRepository {
  /** Working copy if one exists, otherwise the original seed data. */
  load(): Promise<{ dataset: Dataset; fromWorkingCopy: boolean }>;
  save(dataset: Dataset): Promise<void>;
  /** Discard all edits and return the original data. */
  reset(): Promise<Dataset>;
}

const KEY = 'podium-working-copy-v1';
const SEED_URL = './data/dataset.json';

async function fetchSeed(): Promise<Dataset> {
  const res = await fetch(SEED_URL);
  if (!res.ok) throw new Error(`Could not load the data (${res.status}).`);
  return res.json();
}

/** Working copies saved by an older version lack newer country fields (coastline,
 *  net migration): copy them from the seed data so every screen still works. */
async function backfill(saved: Dataset): Promise<Dataset> {
  if (saved.countries.every((c) => 'coastlineKm' in c && 'netMigration' in c)) return saved;
  try {
    const seed = new Map((await fetchSeed()).countries.map((c) => [c.id, c]));
    return { ...saved, countries: saved.countries.map((c) => ({
      ...c,
      coastlineKm: c.coastlineKm !== undefined ? c.coastlineKm : seed.get(c.id)?.coastlineKm ?? null,
      netMigration: c.netMigration !== undefined ? c.netMigration : seed.get(c.id)?.netMigration ?? null,
    })) };
  } catch {
    return { ...saved, countries: saved.countries.map((c) => ({ ...c, coastlineKm: c.coastlineKm ?? null, netMigration: c.netMigration ?? null })) };
  }
}

/** Stores the working copy in IndexedDB. Storage can be unavailable (private
 *  windows, blocked site data), so every call is wrapped and the app keeps
 *  working in memory if it fails. */
export class BrowserRepository implements DataRepository {
  async load() {
    try {
      const saved = await get<Dataset>(KEY);
      if (saved) return { dataset: await backfill(saved), fromWorkingCopy: true };
    } catch { /* storage unavailable: fall back to seed */ }
    return { dataset: await fetchSeed(), fromWorkingCopy: false };
  }
  async save(dataset: Dataset) {
    try { await set(KEY, dataset); } catch { /* keep working in memory */ }
  }
  async reset() {
    try { await del(KEY); } catch { /* ignore */ }
    return fetchSeed();
  }
}

export const repository: DataRepository = new BrowserRepository();
