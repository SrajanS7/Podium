/** Number formatting used across the app (British English formatting). */
const nf = new Intl.NumberFormat('en-GB');
export const fmt = (n: number) => nf.format(Math.round(n));
export const fmt1 = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(n);
export const pct = (share: number) => `${Math.round(share * 100)}%`;
export const signedPct = (p: number) => `${p > 0 ? '+' : ''}${Math.round(p)}%`;
export const millions = (n: number) => `${fmt1(n / 1e6)} M`;
export const usd = (n: number) => `$${nf.format(Math.round(n))}`;
export const bnUsd = (n: number) => (n >= 1000 ? `$${fmt1(n / 1000)} trn` : `$${fmt(n)} bn`);
