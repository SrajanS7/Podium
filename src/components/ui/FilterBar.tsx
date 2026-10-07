import { useDataStore, useDataset } from '../../store/useDataStore';
import type { Filters } from '../../domain/types';
import { Dropdown } from './Dropdown';
import { SegmentedControl } from './SegmentedControl';

/** Global filters (season + Games) shared by Overview, Countries and Drivers. */
export function FilterBar() {
  const d = useDataset();
  const { filters, setFilters } = useDataStore();
  const games = [...d.games].sort((a, b) => a.year - b.year)
    .filter((g) => filters.season === 'all' || g.season === filters.season);
  return (
    <>
      <SegmentedControl<Filters['season']>
        label="Season" value={filters.season}
        options={[{ value: 'all', label: 'All' }, { value: 'Summer', label: 'Summer' }, { value: 'Winter', label: 'Winter' }]}
        onChange={(season) => setFilters({ season, gamesId: 'all' })}
      />
      <Dropdown<Filters['gamesId']>
        label="Games" value={filters.gamesId} onChange={(gamesId) => setFilters({ gamesId })}
        options={[{ value: 'all', label: `All Games${filters.season !== 'all' ? ` (${filters.season})` : ''}` },
          ...games.map((g) => ({ value: g.id, label: `${g.city} ${g.year}` }))]}
      />
    </>
  );
}
