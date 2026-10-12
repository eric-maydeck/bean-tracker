// Pure statistics for the Insights generators (no facts imports).
export const MIN_BAGS = 3;
export const MIN_BREWS = 30;

export const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length; // NaN on empty
export const sd = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); // population SD
};

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

// Correlation of x and y with z held constant.
export function partialR(x: number[], y: number[], z: number[]): number | null {
  const rxy = pearson(x, y), rxz = pearson(x, z), ryz = pearson(y, z);
  if (rxy === null || rxz === null || ryz === null) return null;
  const d = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2));
  return d === 0 ? null : (rxy - rxz * ryz) / d;
}

// Each rated row with its rating minus its bag's mean rating (`dm`); unrated rows and brews
// of no bag are dropped.
export function demeaned<T extends { coffeeId: number | null; rating: number | null }>(rows: readonly T[]): (T & { dm: number })[] {
  const by = new Map<number, number[]>();
  for (const r of rows) if (r.coffeeId !== null && r.rating !== null) (by.get(r.coffeeId) ?? by.set(r.coffeeId, []).get(r.coffeeId)!).push(r.rating);
  const means = new Map([...by].map(([id, rs]) => [id, mean(rs)]));
  return rows.filter((r) => r.coffeeId !== null && r.rating !== null).map((r) => ({ ...r, dm: r.rating! - means.get(r.coffeeId!)! }));
}

export type Strength = 'solid' | 'hint' | 'early' | 'hidden';
// One-sided normal tail P(Z > z), z ≥ 0 (Abramowitz & Stegun 26.2.17, error < 1e-7).
const tail = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * z);
  return (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
};
// solid = |z| ≥ 2, hint = |z| ≥ 1.5, as two-sided p-values. Over a multiple-comparison set of
// `tests` (weekdays, roaster groups…) the p-value is multiplied by `tests` first (Bonferroni).
export const strengthOf = (z: number, enoughSample: boolean, tests = 1): Strength => {
  if (!enoughSample) return 'hidden';
  const p = tail(Math.abs(z)) * tests;
  return p <= tail(2) ? 'solid' : p <= tail(1.5) ? 'hint' : 'early';
};
// The |z| a finding needs for solid over `tests` comparisons (2 for one test), by bisection.
export const solidBar = (tests: number): number => {
  let lo = 2, hi = 10;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (tail(m) * tests > tail(2)) lo = m; else hi = m; }
  return hi;
};

// Group's bag-mean average vs all bags, SE = sd(all bag means) / sqrt(bags in the group).
export const groupZ = (groupBagMeans: number[], allBagMeans: number[]): number =>
  (mean(groupBagMeans) - mean(allBagMeans)) / (sd(allBagMeans) / Math.sqrt(groupBagMeans.length));

// Difference of two demeaned-rating means, SE = residualSd * sqrt(1/n1 + 1/n2).
export const brewZ = (a: number[], b: number[], residualSd: number): number =>
  (mean(a) - mean(b)) / (residualSd * Math.sqrt(1 / a.length + 1 / b.length));
