import type { Ratings, Avg } from '$lib/insightsUrl';
import { BAG_MIN_BREWS, pooled, type Sample } from '$lib/sample';
import { bagWeight, sd, strengthOf } from './stats';

// Ratings before this date were ~3× as scattered (calibration period), so
// "Settled" (the default) leaves them out of every rating-based stat.
export const RATINGS_SETTLED_FROM = '2026-06-01';
// Shrinkage strength for adjusted means, in bags, per Avg mode (0 = none; the best-k* modes shrink in brews).
export const ADJUSTED_K: Record<Avg, number> = { raw: 0, min3: 0, k2: 2, adjusted: 5, best: 0, 'best-k2': 2, 'best-k5': 5 };

export type Rated = { coffeeId: number | null; rating: number | null; localDate: string; dialRating?: number | null };

export const countsForRating = (b: Rated, ratings: Ratings): boolean =>
  b.rating !== null && (ratings === 'all' || b.localDate >= RATINGS_SETTLED_FROM);

// Each bag's size: its rated brews under the Ratings setting, dial-in ones included (Once dialed keeps a dial-in
// brew's rating as `dialRating`), so the dial-in skip never knocks a bag under the one-bag rule (user ruling
// 2026-10-17, threshold audit: counting after the skip turned 31 bags of 4–5 brews into "small" ones).
export function bagSizes(brews: readonly Rated[], ratings: Ratings): Map<number, number> {
  const n = new Map<number, number>();
  for (const b of brews) {
    const r = b.rating ?? b.dialRating ?? null;
    if (b.coffeeId !== null && r !== null && r > 0 && countsForRating({ ...b, rating: r }, ratings)) n.set(b.coffeeId, (n.get(b.coffeeId) ?? 0) + 1);
  }
  return n;
}

// The brews of bags of BAG_MIN_BREWS+ rated brews (bagSizes): the one-bag rule, for the per-bag findings (a bag's
// own figure: repurchases, price, backlog wait, remembered rating). Pooled means weight every bag instead (bagWeight).
export function fullBags<T extends Rated>(brews: readonly T[], ratings: Ratings): T[] {
  const n = bagSizes(brews, ratings);
  return brews.filter((b) => b.coffeeId !== null && (n.get(b.coffeeId) ?? 0) >= BAG_MIN_BREWS);
}

export interface RatedGroup {
  label: string;
  mean: number; // the group's bag means, each weighted by bagWeight
  adjusted: number; // shrunk by the avg mode's K (= mean for the unshrunk modes)
  value: number; // what the mode ranks by
  bags: number;
  brews: number;
  eff: number; // effective bags (Kish: (Σw)² / Σw²): the bag count a weighted mean's spread is read against
  se?: number; // 1 SE of `mean`: the board's pooled within-group spread of bag means ÷ √Σw (none without 2+ bags in a group)
  sample: Sample; // pooled rule over the group's bags and its rated brews before the dial-in skip
  best: number; // highest single brew rating
  atBest: number; // brews at that rating
}

// Precision-weighted: each bag's mean rating is one point weighted bagWeight(n) (n/(n+2)), so 40 brews of one bag
// don't outvote five bags and a 1-brew sachet counts a third (user ruling 2026-10-17; it replaces dropping bags under
// 4 brews, which dropped the bags you disliked). adjusted = (Σw·m + K × overall) / (Σw + K), K in bags.
// `perBrew` (the Coffees board, one bag a row): k2/adjusted shrink by brews instead, (Σr + K × brew mean) / (n + K),
// so a 1-brew bag can't top it (by bags, every row had the same weight and the order was Raw's).
// Rows come back best first for the mode.
// best-k*: (hits × best + K × overall) / (hits + K), hits = brews at the group's best score,
// overall = mean of every counted brew rating on the board (hits are brews, so the prior is too).
// ponytail: brews with no linked coffee are skipped (every prod bean is linked).
export function ratedGroups<T extends Rated>(
  brews: readonly T[],
  key: (b: T) => string | null,
  ratings: Ratings,
  avg: Avg,
  perBrew = false
): RatedGroup[] {
  let sumAll = 0; // every counted brew rating: the overall mean best-k* shrinks toward
  let nAll = 0;
  const peak = new Map<string, { best: number; atBest: number }>();
  const perBag = new Map<string, { label: string; sum: number; n: number }>();
  // The group's rated brews before the dial-in skip (as bagSizes): the 10-brew rule counts them (coordinator ruling
  // 2026-10-17, following the user's item A), so the skip never knocks a group under it.
  const size = new Map<string, number>();
  for (const b of brews) {
    const label = key(b);
    if (label === null || b.coffeeId === null) continue;
    if (countsForRating({ ...b, rating: b.rating ?? b.dialRating ?? null }, ratings)) size.set(label, (size.get(label) ?? 0) + 1);
    if (!countsForRating(b, ratings)) continue;
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
  const points = [...perBag.values()].map((p) => ({ ...p, m: p.sum / p.n, w: bagWeight(p.n) }));
  if (!points.length) return [];
  const overall = points.reduce((s, p) => s + p.w * p.m, 0) / points.reduce((s, p) => s + p.w, 0);
  const groups = new Map<string, { wm: number; w: number; w2: number; bags: number; brews: number; sum: number; pts: typeof points }>();
  for (const p of points) {
    const g = groups.get(p.label) ?? { wm: 0, w: 0, w2: 0, bags: 0, brews: 0, sum: 0, pts: [] };
    g.wm += p.w * p.m;
    g.w += p.w;
    g.w2 += p.w * p.w;
    g.bags += 1;
    g.brews += p.n;
    g.sum += p.sum;
    g.pts.push(p);
    groups.set(p.label, g);
  }
  // The board's within-group variance of bag means (weighted: w·(m − group mean)² estimates the bag-to-bag variance
  // under n/(n+2) weights), pooled over its groups: what one group's mean could move by chance.
  let ss = 0;
  for (const g of groups.values()) for (const p of g.pts) ss += p.w * (p.m - g.wm / g.w) ** 2;
  const df = points.length - groups.size;
  const within = df > 0 ? Math.sqrt(ss / df) : null;
  const K = ADJUSTED_K[avg];
  const brewMean = sumAll / nAll;
  return [...groups]
    .map(([label, g]) => {
      const t = peak.get(label)!;
      const mean = g.wm / g.w;
      const adjusted = perBrew ? (g.sum + K * brewMean) / (g.brews + K) : (g.wm + K * overall) / (g.w + K);
      const value = avg === 'best' ? t.best
        : avg.startsWith('best') ? (t.atBest * t.best + K * brewMean) / (t.atBest + K)
        : adjusted;
      return {
        label, mean, adjusted, value, bags: g.bags, brews: g.brews, eff: (g.w * g.w) / g.w2,
        ...(within !== null ? { se: within / Math.sqrt(g.w) } : {}), sample: pooled(g.bags, size.get(label)!), ...t
      };
    })
    .sort((a, b) =>
      b.value - a.value || (avg.startsWith('best') ? b.atBest - a.atBest : 0) || b.mean - a.mean
    );
}

// The roast nudge's smallest gap worth naming (user ruling, gate 3): a z ≥ 2 alone fires on a big sample's tiny gap.
export const ROAST_GAP = 0.5;

// The mixed-roast nudge (spec Part 3, gate-3 rule): roast levels passing the pooled rule, best first, when the
// highest and lowest weighted means (ratedGroups) differ at strengthOf 'solid' (the SD of the qualifying bag means
// over each level's effective bags, one test) and by ROAST_GAP or more; else null. `brews`: the rating views'
// source in the Period.
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
  const z = (hi.mean - lo.mean) / (sd(bagMeans) * Math.sqrt(1 / hi.eff + 1 / lo.eff));
  // 1e-9: bag means are float sums, a 0.5 gap can land at 0.49999….
  return strengthOf(z, true, 1) === 'solid' && hi.mean - lo.mean >= ROAST_GAP - 1e-9 ? levels.map((g) => ({ roast: g.label, mean: g.mean })) : null;
}
