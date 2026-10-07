import type { Tally } from '../../domain/types';

/** Stacked gold / silver / bronze bar, scaled to `max` so rows are comparable.
 *  Hovering the bar (or its row, see .hbar-row in global.css) shows the gold / silver / bronze counts. */
export function MedalBar({ t, max, name }: { t: Pick<Tally, 'gold' | 'silver' | 'bronze'>; max: number; name?: string }) {
  const w = (v: number) => `${(v / max) * 100}%`;
  return (
    <span className="medal-bar-wrap">
      <span className="medal-bar" role="img" aria-label={`${name ? `${name}: ` : ''}${t.gold} gold, ${t.silver} silver, ${t.bronze} bronze`}>
        <span style={{ width: w(t.gold), background: 'var(--color-gold)' }} />
        <span style={{ width: w(t.silver), background: 'var(--color-silver)' }} />
        <span style={{ width: w(t.bronze), background: 'var(--color-bronze)' }} />
      </span>
      <span className="medal-tip" aria-hidden="true">
        {name && <strong>{name}</strong>}
        <span><span className="swatch" style={{ background: 'var(--color-gold)' }} />Gold <b>{t.gold}</b></span>
        <span><span className="swatch" style={{ background: 'var(--color-silver)' }} />Silver <b>{t.silver}</b></span>
        <span><span className="swatch" style={{ background: 'var(--color-bronze)' }} />Bronze <b>{t.bronze}</b></span>
      </span>
    </span>
  );
}

export const MedalLegend = () => (
  <>
    <span><span className="swatch" style={{ background: 'var(--color-gold)' }} />Gold</span>
    <span><span className="swatch" style={{ background: 'var(--color-silver)' }} />Silver</span>
    <span><span className="swatch" style={{ background: 'var(--color-bronze)' }} />Bronze</span>
  </>
);

export const SeasonLegend = () => (
  <>
    <span><span className="swatch" style={{ background: 'var(--color-summer)' }} />Summer</span>
    <span><span className="swatch" style={{ background: 'var(--color-winter)' }} />Winter</span>
  </>
);
