import type { Ratings, Avg } from '$lib/insightsUrl';
import { pooled, type Sample } from '$lib/sample';
import { sd, strengthOf } from './stats';

// Ratings before this date were ~3× as scattered (calibration period), so
// "Settled" (the default) leaves them out of every rating-based stat.
export const RATINGS_SETTLED_FROM = '2026-06-01';
// Shrinkage strength for adjusted means, in bags, per Avg mode (0 = none; the best-k* modes shrink in brews).
export const ADJUSTED_K: Record<Avg, number> = { raw: 0, min3: 0, k2: 2, adjusted: 5, best: 0, 'best-k2': 2, 'best-k5': 5 };

export type Rated = { coffeeId: number | null; rating: number | null; localDate: string };

export const countsForRating = (b: Rated, ratings: Ratings): boolean =>
  b.rating !== null && (ratings === 'all' || b.localDate >= RATINGS_SETTLED_FROM);

export interface RatedGroup {
  label: string;
  mean: number; // mean of the group's bag means
  adjusted: number; // shrunk by the avg mode's K (= mean for the unshrunk modes)
  value: number; // what the mode ranks by
  bags: number;
  brews: number;
  sample: Sample; // pooled rule over the group's bags and brews
  best: number; // highest single brew rating
  atBest: number; // brews at that rating
}

// Bag-weighted: each bag's mean rating is one point, so 40 brews of one bag
// don't outvote five bags. adjusted = (bags × groupMean + K × overallMean) / (bags + K).
// Rows come back best first for the mode.
// best-k*: (hits × best + K × overall) / (hits + K), hits = brews at the group's best score,
// overall = mean of every counted brew rating on the board (hits are brews, so the prior is too).
// ponytail: brews with no linked coffee are skipped (every prod bean is linked).
export function ratedGroups<T extends Rated>(
  brews: readonly T[],
  key: (b: T) => string | null,
  ratings: Ratings,
  avg: Avg
): RatedGroup[] {
  let sumAll = 0; // every counted brew rating: the overall mean best-k* shrinks toward
  let nAll = 0;
  const peak = new Map<string, { best: number; atBest: number }>();
  const perBag = new Map<string, { label: string; sum: number; n: number }>();
  for (const b of brews) {
    const label = key(b);
    if (label === null || b.coffeeId === null || !countsForRating(b, ratings)) continue;
    const k = `${label}\u0000${b.coffeeId}`;
    const p = perBag.get(k) ?? { label, sum: 0, n: 0 };
    p.sum += b.rating!;
    p.n += 1;
    perBag.set(k, p);
    sumAll += b.rating!;
    nAll += 1;
    const t = peak.get(label);
    if (!t || b.rating! > t.best) peak.set(label, { best: b.rating!, atBest: 1 });
    else if (b.rating === t.best) t.atBest += 1;
  }
  const points = [...perBag.values()];
  if (!points.length) return [];
  const overall = points.reduce((s, p) => s + p.sum / p.n, 0) / points.length;
  const groups = new Map<string, { sum: number; bags: number; brews: number }>();
  for (const p of points) {
    const g = groups.get(p.label) ?? { sum: 0, bags: 0, brews: 0 };
    g.sum += p.sum / p.n;
    g.bags += 1;
    g.brews += p.n;
    groups.set(p.label, g);
  }
  const K = ADJUSTED_K[avg];
  const brewMean = sumAll / nAll;
  return [...groups]
    .map(([label, g]) => {
      const t = peak.get(label)!;
      const adjusted = (g.sum + K * overall) / (g.bags + K);
      const value = avg === 'best' ? t.best
        : avg.startsWith('best') ? (t.atBest * t.best + K * brewMean) / (t.atBest + K)
        : adjusted;
      return { label, mean: g.sum / g.bags, adjusted, value, bags: g.bags, brews: g.brews, sample: pooled(g.bags, g.brews), ...t };
    })
    .sort((a, b) =>
      b.value - a.value || (avg.startsWith('best') ? b.atBest - a.atBest : 0) || b.mean - a.mean
    );
}

// The mixed-roast nudge (spec Part 3): roast levels passing the pooled rule, best first, when the highest and
// lowest bag-weighted means differ at Likely (groupZ-style SE over the qualifying bag means, Bonferroni over
// level pairs); else null. `brews`: the rating views' source in the Period.
export function roastMix<T extends Rated & { roastLevel: string | null }>(
  brews: readonly T[],
  ratings: Ratings
): { roast: string; mean: number }[] | null {
  const levels = ratedGroups(brews, (b) => b.roastLevel, ratings, 'raw').filter((g) => !g.sample.small)
    .sort((a, b) => b.mean - a.mean);
  if (levels.length < 2) return null;
  const keep = new Set(levels.map((g) => g.label));
  const bagMeans = ratedGroups(brews, (b) => (keep.has(b.roastLevel!) ? String(b.coffeeId) : null), ratings, 'raw').map((g) => g.mean);
  const [hi, lo] = [levels[0], levels.at(-1)!];
  const z = (hi.mean - lo.mean) / (sd(bagMeans) * Math.sqrt(1 / hi.bags + 1 / lo.bags));
  const k = levels.length;
  return strengthOf(z, true, (k * (k - 1)) / 2) === 'solid' ? levels.map((g) => ({ roast: g.label, mean: g.mean })) : null;
}
