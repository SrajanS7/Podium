/**
 * Small, dependency-free statistics helpers. Kept deliberately simple so every
 * line can be explained: ranks, Spearman correlation, median/quantile and a
 * multiple linear regression solved with the normal equations.
 */

export function median(xs: number[]): number {
  return quantile(xs, 0.5);
}

/** Linear-interpolated quantile (same method as pandas' default). */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Ranks with ties sharing their average rank (1-based). */
export function ranks(xs: number[]): number[] {
  const order = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman rank correlation = Pearson correlation of the ranks. */
export function spearman(x: number[], y: number[]): number {
  return pearson(ranks(x), ranks(y));
}

export interface Regression {
  coefficients: number[]; // [intercept, b1, b2, ...]
  rSquared: number;
  predict: (features: number[]) => number;
}

/**
 * Ordinary least squares: solves (X'X) b = X'y with Gaussian elimination.
 * rows = feature vectors (without the intercept column), y = targets.
 */
export function linearRegression(rows: number[][], y: number[]): Regression {
  const X = rows.map((r) => [1, ...r]);
  const p = X[0].length;
  // Build the normal equations as an augmented matrix [X'X | X'y]
  const A = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p + 1 }, (_, j) =>
      j < p ? X.reduce((s, row) => s + row[i] * row[j], 0) : X.reduce((s, row, k) => s + row[i] * y[k], 0)));
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= p; c++) A[r][c] -= f * A[col][c];
    }
  }
  const b = A.map((row, i) => row[p] / row[i]);
  const predict = (f: number[]) => b[0] + f.reduce((s, v, i) => s + v * b[i + 1], 0);
  const mean = y.reduce((a, v) => a + v, 0) / y.length;
  const ssRes = y.reduce((s, v, i) => s + (v - predict(rows[i])) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  return { coefficients: b, rSquared: 1 - ssRes / ssTot, predict };
}

export interface PoissonRegression {
  coefficients: number[];      // [intercept, b1, b2, ...] on the log scale
  devianceExplained: number;   // pseudo R squared: share of variation explained (0-1)
  predict: (features: number[]) => number; // expected count
}

/**
 * Poisson regression (log link) fitted with iteratively re-weighted least squares.
 * The standard model for COUNTS (medals): predictions are never negative, large
 * and small nations are both fitted on their natural scale, and exp(b) reads
 * directly as a multiplier ("10x the population -> exp(b) x the medals").
 */
export function poissonRegression(rows: number[][], y: number[], iterations = 50): PoissonRegression {
  const X = rows.map((r) => [1, ...r]);
  const p = X[0].length;
  const meanY = y.reduce((a, v) => a + v, 0) / y.length;
  let b = Array.from({ length: p }, (_, i) => (i === 0 ? Math.log(meanY) : 0));

  for (let it = 0; it < iterations; it++) {
    const eta = X.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
    const mu = eta.map(Math.exp);
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / mu[i]); // working response
    // Solve the weighted normal equations (X' W X) b = X' W z, with W = mu
    const A = Array.from({ length: p }, (_, i) => Array.from({ length: p + 1 }, (_, j) =>
      j < p ? X.reduce((s, row, k) => s + mu[k] * row[i] * row[j], 0) : X.reduce((s, row, k) => s + mu[k] * row[i] * z[k], 0)));
    const next = solve(A);
    const change = Math.max(...next.map((v, i) => Math.abs(v - b[i])));
    b = next;
    if (change < 1e-10) break;
  }
  const predict = (f: number[]) => Math.exp(b[0] + f.reduce((s, v, i) => s + v * b[i + 1], 0));
  const dev = (obs: number, exp: number) => 2 * ((obs > 0 ? obs * Math.log(obs / exp) : 0) - (obs - exp));
  const deviance = y.reduce((s, v, i) => s + dev(v, predict(rows[i])), 0);
  const nullDeviance = y.reduce((s, v) => s + dev(v, meanY), 0);
  return { coefficients: b, devianceExplained: 1 - deviance / nullDeviance, predict };
}

/** Gaussian elimination with partial pivoting on an augmented matrix [A | b]. */
function solve(A: number[][]): number[] {
  const p = A.length;
  for (let col = 0; col < p; col++) {
    let pivot = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let c = col; c <= p; c++) A[r][c] -= f * A[col][c];
    }
  }
  return A.map((row, i) => row[p] / row[i]);
}
