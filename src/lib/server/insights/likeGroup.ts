import type { DatabaseSync } from 'node:sqlite';
import { DEFAULTS } from '$lib/insightsUrl';
import { pooled, single, type Sample } from '$lib/sample';
import { loadFacts, type BrewFact } from './facts';
import { dialInIds, onceDialed } from './dialed';
import { countsForRating } from './ratings';
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
// `outside`: for roaster-level comparisons. The group leaves out every bag of the bag's own roaster and the
// ladder skips its roaster step, so a roaster is never compared against itself.
export function likeGaps(rows: readonly BrewFact[], outside = false): Map<number, Like> {
  const byBag = groupBy(rows, (b) => b.coffeeId);
  const score = new Map([...byBag].map(([id, bs]) => [id, mean(bs.map((b) => b.rating!))]));
  const out = new Map<number, Like>();
  for (const [id, bs] of byBag) {
    const f = filtersOf(bs[0]);
    if (!f) continue;
    const r = bs[0].roaster;
    if (outside) delete f.roaster;
    const g = groupsFor(rows.filter((b) => b.coffeeId !== id && !(outside && r && b.roaster === r)), f)
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

export interface RoasterLike { gap: number; gaps: number[]; bags: number; brews: number }
// Each roaster's bag-weighted mean gap against like coffees from other roasters (likeGaps `outside`). The one
// computation behind the Leaderboards roaster row and the likeRoaster finding.
export function roasterLikes(rows: readonly BrewFact[]): Map<string, RoasterLike> {
  const roasterOf = new Map(rows.map((b) => [b.coffeeId, b.roaster]));
  const out = new Map<string, RoasterLike>();
  for (const [r, g] of groupBy([...likeGaps(rows, true)].filter(([id]) => roasterOf.get(id)), ([id]) => roasterOf.get(id)!)) {
    const gaps = g.map(([, l]) => l.gap);
    out.set(r, { gap: mean(gaps), gaps, bags: g.length, brews: g.reduce((n, [, l]) => n + l.sample.brews, 0) });
  }
  return out;
}

// The /coffees/[slug] panel (spec Part 4): all time, Current ratings, once dialed; null when no group qualifies.
// ponytail: loads every brew per coffee-page view (like each insights view); cache per request if it ever shows.
export function coffeeLike(db: DatabaseSync, id: number): Like | null {
  const { brews } = loadFacts(db);
  const rows = onceDialed(brews, dialInIds(brews)).filter((b) => b.coffeeId !== null && countsForRating(b, DEFAULTS.ratings) && b.rating! > 0);
  return likeGaps(rows).get(id) ?? null;
}
