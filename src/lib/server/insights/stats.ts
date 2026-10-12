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
export const strengthOf = (z: number, enoughSample: boolean): Strength =>
  !enoughSample ? 'hidden' : Math.abs(z) >= 2 ? 'solid' : Math.abs(z) >= 1.5 ? 'hint' : 'early';

// Group's bag-mean average vs all bags, SE = sd(all bag means) / sqrt(bags in the group).
export const groupZ = (groupBagMeans: number[], allBagMeans: number[]): number =>
  (mean(groupBagMeans) - mean(allBagMeans)) / (sd(allBagMeans) / Math.sqrt(groupBagMeans.length));

// Difference of two demeaned-rating means, SE = residualSd * sqrt(1/n1 + 1/n2).
export const brewZ = (a: number[], b: number[], residualSd: number): number =>
  (mean(a) - mean(b)) / (residualSd * Math.sqrt(1 / a.length + 1 / b.length));
