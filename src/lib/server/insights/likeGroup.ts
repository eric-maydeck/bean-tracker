import { pooled, single, type Sample } from '$lib/sample';
import type { BrewFact } from './facts';
import { groupsFor, type LabFilters } from './lab';
import { groupBy } from './records';
import { mean } from './stats';

export interface Like {
  label: string; // the group, as Sweet spots names it ("Washed Light coffees from Kenya")
  score: number; // the bag's mean rating over `rows`
  groupMean: number; // the group's other bags, bag-weighted (each bag's mean is one point)
  gap: number; // score − groupMean
  rank: number; of: number; // the bag's place among the group's bags and itself, best first; ties share a place
  sample: Sample; // the bag's own (one-bag rule)
}

// A bag's ladder fields; no roast level → no ladder (the widest step is roast level). An unknown process is no key.
const filtersOf = (b: BrewFact): LabFilters | null =>
  b.roastLevel ? {
    roast: b.roastLevel, process: b.processGroup === 'Other / Unknown' ? undefined : b.processGroup,
    origin: b.origin ?? undefined, roaster: b.roaster ?? undefined
  } : null;

// Each bag's like-group (spec 2026-10-15 Part 4): the narrowest groupsFor step (roast + process + origin +
// roaster → roast + process + roaster → roast + process → roast) whose bags, without the bag itself, pass the
// pooled small-sample rule. `rows`: rated, linked brews already cut to the view (Coffees filter, Period,
// Current/All, Once dialed). No qualifying step: no entry.
// ponytail: O(bags × brews) per call (≈ 200 × 1500 on prod); index rows by field if it ever shows.
export function likeGaps(rows: readonly BrewFact[]): Map<number, Like> {
  const byBag = groupBy(rows, (b) => b.coffeeId);
  const score = new Map([...byBag].map(([id, bs]) => [id, mean(bs.map((b) => b.rating!))]));
  const out = new Map<number, Like>();
  for (const [id, bs] of byBag) {
    const f = filtersOf(bs[0]);
    if (!f) continue;
    const g = groupsFor(rows.filter((b) => b.coffeeId !== id), f)
      // pooled() calls an empty group "no data", not small, so an empty step must be rejected here.
      .find((x) => x.brews.length > 0 && !pooled(new Set(x.brews.map((b) => b.coffeeId)).size, x.brews.length).small);
    if (!g) continue;
    const ids = [...new Set(g.brews.map((b) => b.coffeeId!))];
    const mine = score.get(id)!, groupMean = mean(ids.map((x) => score.get(x)!));
    out.set(id, {
      label: g.name, score: mine, groupMean, gap: mine - groupMean,
      rank: 1 + ids.filter((x) => score.get(x)! > mine).length, of: ids.length + 1, sample: single(bs.length)
    });
  }
  return out;
}
