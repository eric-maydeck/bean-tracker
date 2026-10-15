import type { BrewFact } from './facts';
import { groupBy } from './records';
import { mean } from './stats';

// Rated brews to reach a bag's settled rating (1-based): the first at or above (mean of its best half) − 0.5.
// Moved from insightGenerators.ts (spec 2026-10-15 Part 2); the dial-in findings use it too.
export const settleAt = (rs: readonly number[]): number => {
  const top = [...rs].sort((a, b) => b - a).slice(0, Math.ceil(rs.length / 2));
  return rs.findIndex((r) => r >= mean(top) - 0.5) + 1;
};

// How many of a bag's first rated brews Once dialed leaves out, by its rated-brew count (spec tiers, a first
// try locked at the Part 2 preview): 1–3 none (the bag is small, sample.ts), 4–7 the first 2, 8+ up to the
// settle point, at least 1 and at most half.
export const skipCount = (rs: readonly number[]): number =>
  rs.length <= 3 ? 0 : rs.length <= 7 ? 2 : Math.min(Math.max(settleAt(rs) - 1, 1), Math.floor(rs.length / 2));

// The ids of every dial-in brew. Bag-intrinsic: over each bag's whole rated history in time order (`brews`
// as loadFacts returns them), before any Period, People, Current/All or Coffees filter.
export function dialInIds(brews: readonly BrewFact[]): Set<number> {
  const out = new Set<number>();
  const rated = brews.filter((b) => b.coffeeId !== null && b.rating !== null && b.rating > 0);
  for (const bs of groupBy(rated, (b) => b.coffeeId).values())
    for (const b of bs.slice(0, skipCount(bs.map((x) => x.rating!)))) out.add(b.id);
  return out;
}

// Once dialed: dial-in brews lose only their rating, so every rating aggregation skips them while brew
// counts and grams stay whole.
export const onceDialed = (brews: readonly BrewFact[], ids: ReadonlySet<number>): BrewFact[] =>
  brews.map((b) => (ids.has(b.id) ? { ...b, rating: null } : b));
