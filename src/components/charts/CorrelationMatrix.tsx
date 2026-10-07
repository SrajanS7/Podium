import type { CorrelationMatrix } from '../../domain/metrics';

/**
 * Diverging colour scale for a correlation: red (−1) → pale yellow (0) → green (+1).
 * Linear blend between three colour stops; easy to change in one place.
 */
const NEG = [176, 46, 38];    // #b02e26  strong negative
const MID = [250, 246, 214];  // #faf6d6  no link
const POS = [27, 94, 48];     // #1b5e30  strong positive

function mix(rho: number): number[] {
  const t = Math.max(-1, Math.min(1, rho));
  const [from, to, w] = t < 0 ? [MID, NEG, -t] : [MID, POS, t];
  return from.map((c, i) => Math.round(c + (to[i] - c) * w));
}

export const correlationColor = (rho: number) => `rgb(${mix(rho).join(',')})`;

/** Relative luminance (WCAG formula) of an RGB colour. */
function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or black text, whichever contrasts more with the cell: every number stays at 4.5:1 or better (WCAG AA). */
const textColor = (rho: number) => {
  const L = luminance(mix(rho));
  return 1.05 / (L + 0.05) > (L + 0.05) / 0.05 ? '#ffffff' : '#000000';
};

/**
 * Heatmap of every variable against every other one. The numbers are printed in each cell,
 * so colour is never the only cue; ChartFrame adds the "Show as table" view and the summary.
 */
export function CorrelationMatrixChart({ matrix }: { matrix: CorrelationMatrix }) {
  const { labels, rho, n } = matrix;
  return (
    <div className="corr-matrix-wrap" tabIndex={0} role="region" aria-label="Correlation matrix (scrolls sideways on small screens)">
      <div className="corr-matrix" style={{ gridTemplateColumns: `minmax(104px, auto) repeat(${labels.length}, minmax(44px, 1fr))` }} aria-hidden="true">
        {labels.map((rowLabel, i) => (
          <div key={rowLabel} className="corr-row">
            <span className="corr-row-label">{rowLabel}</span>
            {labels.map((colLabel, j) => {
              const r = rho[i][j];
              return (
                <span key={colLabel} className={`corr-cell${i === j ? ' is-diagonal' : ''}`}
                  style={{ background: r === null ? '#f4f5f7' : correlationColor(r), color: r === null ? '#59606b' : textColor(r) }}
                  title={r === null ? `${rowLabel} × ${colLabel}: not enough data` : `${rowLabel} × ${colLabel}: ${r.toFixed(2)} (${n[i][j]} nations)`}>
                  {r === null ? '–' : r.toFixed(2)}
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {labels.map((label) => <span key={label} className="corr-col-label"><span>{label}</span></span>)}
      </div>
      <div className="corr-scale" aria-hidden="true">
        <span>−1 · move in opposite directions</span>
        <span className="corr-scale-bar" style={{ background: `linear-gradient(90deg, ${correlationColor(-1)}, ${correlationColor(0)}, ${correlationColor(1)})` }} />
        <span>+1 · rise together</span>
      </div>
    </div>
  );
}
