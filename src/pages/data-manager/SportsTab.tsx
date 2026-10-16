import { useMemo } from 'react';
import { changedRules, defaultRule } from '../../data/excel';
import { eventMedals, tally } from '../../domain/counting';
import { useDataStore, useDataset } from '../../store/useDataStore';
import { fmt } from '../../utils/format';

/** Counting rules: switch a sport between "one medal per team" and "per athlete". */
export function SportsTab() {
  const d = useDataset();
  const updateSport = useDataStore((s) => s.updateSport);
  const replaceDataset = useDataStore((s) => s.replaceDataset);
  const rules = changedRules(d.sports);
  const nChanged = rules.toTeam.length + rules.toAthlete.length;
  const restoreDefaults = () => replaceDataset({ ...d, sports: d.sports.map((s) => ({ ...s, countingRule: defaultRule(s.name) })) }, `Restored the default counting rules (${nChanged} sport${nChanged > 1 ? 's' : ''})`);
  const stats = useMemo(() => d.sports.map((s) => {
    const recs = d.records.filter((r) => r.sportId === s.id);
    return { sport: s, rows: recs.reduce((a, r) => a + r.medalCount, 0), counted: tally(eventMedals(recs, d.sports)).total };
  }).sort((a, b) => b.rows - a.rows), [d]);

  return (
    <section className="card" aria-labelledby="rules">
      <h2 id="rules" className="card-title">How medals are counted</h2>
      <p className="muted" style={{ maxWidth: 860 }}>
        The data lists one row per athlete, so in team sports every player has a row: one football gold appears about 18 times.
        For each sport, choose how its medals count: <strong>Once per team</strong> (the whole squad shares one medal) or{' '}
        <strong>Per athlete</strong> (every athlete's medal counts). The highlighted option is the rule in use. Every screen except Athletes uses these rules.
      </p>
      <p id="rules-hint" className="muted small">Sports you change are marked “Changed”; all your changes stay in effect until you change them back or restore the defaults.</p>
      {nChanged > 0 && (
        <div className="warning-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            <strong>{nChanged} sport{nChanged > 1 ? 's' : ''} changed from the default rule:</strong>{' '}
            {rules.toTeam.length > 0 && <>once per team: {rules.toTeam.join(', ')}. </>}
            {rules.toAthlete.length > 0 && <>per athlete: {rules.toAthlete.join(', ')}.</>}
          </span>
          <button type="button" className="btn btn-small" onClick={restoreDefaults}>Restore default rules</button>
        </div>
      )}
      <div className="table-wrap">
        <table aria-describedby="rules-hint">
          <thead><tr><th scope="col">Sport</th><th scope="col">Season</th><th scope="col">Count medals</th><th scope="col" className="num">Athlete medals</th><th scope="col" className="num">Medals counted</th></tr></thead>
          <tbody>
            {stats.map(({ sport, rows, counted }) => (
              <tr key={sport.id}>
                <td style={{ fontWeight: 500 }}>
                  {sport.name}
                  {sport.countingRule !== defaultRule(sport.name) && <span className="tag tag-warm" style={{ marginLeft: 8 }}>Changed</span>}
                </td>
                <td>{sport.season}</td>
                <td>
                  {/* Two named options instead of one checkbox: the selected one always says what is in effect */}
                  <div className="rule-choice" role="radiogroup" aria-label={`How to count ${sport.name} medals`}>
                    {([['team', 'Once per team'], ['individual', 'Per athlete']] as const).map(([rule, label]) => (
                      <label key={rule}>
                        <input type="radio" name={`rule-${sport.id}`} value={rule} checked={sport.countingRule === rule}
                          onChange={() => updateSport({ ...sport, countingRule: rule })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="num">{fmt(rows)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{fmt(counted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">Sports that mix individual and crew events (rowing, swimming relays) stay per athlete, so their counts run high.
        Checked against the official Beijing 2008 medal table, this rule keeps the nation ranking almost identical (rank correlation 0.97).</p>
    </section>
  );
}
