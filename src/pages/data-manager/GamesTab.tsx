import { useMemo } from 'react';
import { medalsPerGames } from '../../domain/metrics';
import { useDataset } from '../../store/useDataStore';
import { fmt } from '../../utils/format';

/** The seven Games. Host country drives the home-advantage analysis. */
export function GamesTab() {
  const d = useDataset();
  const totals = useMemo(() => new Map(medalsPerGames(d, { season: 'all', gamesId: 'all' }).map((g) => [g.gamesId, g.total])), [d]);
  return (
    <section className="card" aria-labelledby="games-list">
      <h2 id="games-list" className="card-title">Olympic Games in the data</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Year</th><th scope="col">Season</th><th scope="col">City</th><th scope="col">Host nation</th><th scope="col" className="num">Medals (team sports counted once)</th></tr></thead>
          <tbody>
            {[...d.games].sort((a, b) => a.year - b.year).map((g) => (
              <tr key={g.id}><td>{g.year}</td><td>{g.season}</td><td>{g.city}</td><td>{g.hostCountry}</td><td className="num">{fmt(totals.get(g.id) ?? 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">To add later Games (for example Rio 2016), add them to the Excel file's "Olympic Events" sheet with their medal records and use Import Excel.</p>
    </section>
  );
}
