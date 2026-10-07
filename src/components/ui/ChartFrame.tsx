import { useId, useState, type ReactNode } from 'react';

/**
 * Wraps every chart: title, one-line summary for screen readers and sighted
 * users alike, and a "Show as table" toggle so the data is readable without
 * the visual (WCAG: charts need a text alternative).
 */
export function ChartFrame({ title, summary, legend, table, children, footer, style }: {
  title: string; summary: string; legend?: ReactNode; table: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode; footer?: ReactNode; style?: React.CSSProperties;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure className="card" style={{ margin: 0, ...style }} aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <div className="card-head">
        <h2 id={`${id}-t`} className="card-title">{title}</h2>
        <button type="button" className="btn btn-ghost btn-small" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {legend && !asTable && <div className="legend">{legend}</div>}
      {asTable ? (
        <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }} tabIndex={0} role="region" aria-label={`${title} data table`}>
          <table>
            <thead><tr>{table.headers.map((h, i) => <th key={h} className={i > 0 ? 'num' : ''} scope="col">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : children}
      <figcaption id={`${id}-s`} className="muted small">{summary}</figcaption>
      {footer}
    </figure>
  );
}
