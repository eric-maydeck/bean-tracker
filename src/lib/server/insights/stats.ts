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

// Ranks 1..n, ties sharing their average rank.
const ranks = (xs: readonly number[]): number[] => {
  const o = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r: number[] = [];
  for (let i = 0, j = 0; i < o.length; i = j) {
    while (j < o.length && o[j][0] === o[i][0]) j++;
    for (let k = i; k < j; k++) r[o[k][1]] = (i + j + 1) / 2;
  }
  return r;
};
// Spearman's rank correlation: Pearson on ranks, so one extreme point (a $117/100 g bag) can't swing it.
export const spearman = (xs: readonly number[], ys: readonly number[]): number | null => pearson(ranks(xs), ranks(ys));
// About 2 SE of a correlation r from n points (Fisher's z, mapped back near r): the myths' margin of error.
export const rBand = (n: number, r = 0): number => (2 * (1 - r * r)) / Math.sqrt(n - 3);

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
// Under T_SMALL units the SE is itself a rough estimate, so the normal curve overstates certainty (5 pairs at
// z 2.11: normal p .035, t(4) p .10; stats audit 2026-10-17): the test uses Student's t, df = n − 1.
export const T_SMALL = 30;
// One-sided P(T > t), t ≥ 0, Student's t with integer df ≥ 1 (Abramowitz & Stegun 26.7.3 / 26.7.4, exact).
export const tTail = (t: number, df: number): number => {
  const th = Math.atan(t / Math.sqrt(df)), c2 = Math.cos(th) ** 2;
  let term = 1, sum = df % 2 ? (df > 1 ? 1 : 0) : 1;
  for (let k = 1; k <= (df - (df % 2 ? 3 : 2)) / 2; k++) sum += (term *= (df % 2 ? (2 * k) / (2 * k + 1) : (2 * k - 1) / (2 * k)) * c2);
  const inside = df % 2 ? (2 / Math.PI) * (th + Math.sin(th) * Math.cos(th) * sum) : Math.sin(th) * sum; // P(|T| < t)
  return (1 - inside) / 2;
};
// solid = |z| ≥ 2, hint = |z| ≥ 1.5, as two-sided p-values. Over a multiple-comparison set of
// `tests` (weekdays, roaster groups…) the p-value is multiplied by `tests` first (Bonferroni).
// `n`: the units behind the SE (pairs, bags, days); under T_SMALL, z is read as t with n − 1 df.
export const strengthOf = (z: number, enoughSample: boolean, tests = 1, n = Infinity): Strength => {
  if (!enoughSample || n < 2) return 'hidden';
  const p = (n < T_SMALL ? tTail(Math.abs(z), n - 1) : tail(Math.abs(z))) * tests;
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

// A group vs the rest of the pool, not vs a pool that holds it (stats audit 2026-10-17: Washed, 81 of ~100 bags,
// had its delta shrunk ~5×). SE from the whole pool's spread. NaN when there is no rest.
export const restZ = (group: number[], rest: number[]): number => brewZ(group, rest, sd([...group, ...rest]));
