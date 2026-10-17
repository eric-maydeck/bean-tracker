import type { DatabaseSync } from 'node:sqlite';
import { DEFAULTS, type LikeView } from '$lib/insightsUrl';
import { BAG_MIN_BREWS, POOLED_MIN_BAGS, POOLED_MIN_BREWS, pooled, single, type Sample } from '$lib/sample';
import { loadFacts, type BagFact, type BrewFact } from './facts';
import { dialInIds, onceDialed } from './dialed';
import { countsForRating, fullBags } from './ratings';
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
// pooled small-sample rule. The group's bags are full bags only (fullBags: BAG_MIN_BREWS+ brews), so a 1-brew bag never
// drags the baseline; the bag itself may be small (its own sample says so). `rows`: rated, linked brews already cut to the view (Coffees filter, Period,
// Current/All, Once dialed). No qualifying step: no entry.
// ponytail: O(bags × same-roast brews) per call; every step has the bag's roast level, so rows are pre-split by it.
// `outside`: for roaster-level comparisons. The group leaves out every bag of the bag's own roaster and the
// ladder skips its roaster step, so a roaster is never compared against itself.
// `twins` (twinKeys): a repurchase of the same coffee is left out of its twin's group, so a coffee is never compared
// with itself (stats audit 2026-10-17: 9 twin pairs sat in each other's groups).
export function likeGaps(rows: readonly BrewFact[], outside = false, twins?: ReadonlyMap<number, string>): Map<number, Like> {
  const byBag = groupBy(rows, (b) => b.coffeeId);
  const score = new Map([...byBag].map(([id, bs]) => [id, mean(bs.map((b) => b.rating!))]));
  const byRoast = groupBy(fullBags(rows, 'all'), (b) => b.roastLevel);
  const out = new Map<number, Like>();
  for (const [id, bs] of byBag) {
    const f = filtersOf(bs[0]);
    if (!f) continue;
    const r = bs[0].roaster;
    if (outside) delete f.roaster;
    const twin = twins?.get(id!);
    const g = groupsFor((byRoast.get(f.roast!) ?? []).filter((b) => b.coffeeId !== id && !(twin && twins!.get(b.coffeeId!) === twin) && !(outside && r && b.roaster === r)), f)
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

// Each bag's coffee (roaster + name, case-insensitive, as repeatBuys keys repurchases), for likeGaps' `twins`.
export const twinKeys = (bags: readonly BagFact[]): Map<number, string> =>
  new Map(bags.map((b) => [b.id, `${b.roaster.toLowerCase()}|${b.name.toLowerCase()}`]));

export interface RoasterLike { gap: number; gaps: number[]; bags: number; brews: number }
// Each roaster's bag-weighted mean gap against like coffees from other roasters (likeGaps `outside`), over its bags
// past the one-bag rule (a 1-brew bag's gap is a full point otherwise). The one computation behind the Leaderboards
// roaster row and the likeRoaster finding.
export function roasterLikes(rows: readonly BrewFact[], twins?: ReadonlyMap<number, string>): Map<string, RoasterLike> {
  const roasterOf = new Map(rows.map((b) => [b.coffeeId, b.roaster]));
  const out = new Map<string, RoasterLike>();
  for (const [r, g] of groupBy([...likeGaps(fullBags(rows, 'all'), true, twins)].filter(([id]) => roasterOf.get(id)), ([id]) => roasterOf.get(id)!)) {
    const gaps = g.map(([, l]) => l.gap);
    out.set(r, { gap: mean(gaps), gaps, bags: g.length, brews: g.reduce((n, [, l]) => n + l.sample.brews, 0) });
  }
  return out;
}

// The /coffees/[slug] panel's rows (spec Part 4, gate P4): all time, rated linked brews under the view's Ratings,
// Brews and Caffeine (default: Calibrated, Once dialed, decaf brews' ratings left out, as on Leaderboards).
function viewRows(brews: readonly BrewFact[], dialIn: ReadonlySet<number>, v: LikeView): BrewFact[] {
  const pool = v.caffeine === 'all' ? brews : brews.map((b) => (b.decaf ? { ...b, rating: null } : b));
  return (v.dial === 'all' ? pool : onceDialed(pool, dialIn))
    .filter((b) => b.coffeeId !== null && countsForRating(b, v.ratings ?? DEFAULTS.ratings) && b.rating! > 0);
}

// No panel, and why (gate P4): one line, its counts for the tip, and the nearest view that has a comparison (null: none).
export interface NoLike { why: string; rows: [string, string][]; fix: LikeView | null }

// The panel for a coffee under a view, or why there is none; null when the coffee has no rated brews at all.
// ponytail: loads every brew per coffee-page view, up to 5 likeGaps runs when there is no panel; cache if it ever shows.
export function coffeeLike(db: DatabaseSync, id: number, v: LikeView = {}): { like: Like } | NoLike | null {
  const { brews, bags } = loadFacts(db);
  const dialIn = dialInIds(brews), twins = twinKeys(bags);
  const like = likeGaps(viewRows(brews, dialIn, v), false, twins).get(id);
  if (like) return { like };
  const mine = brews.filter((b) => b.coffeeId === id && b.rating !== null && b.rating > 0);
  if (!mine.length) return null;
  const n = mine.length, ratings = v.ratings ?? DEFAULTS.ratings;
  const early = mine.filter((b) => !countsForRating(b, ratings)).length;
  // Dial-in brews among the calibrated ones only, so the tip's rows don't overlap: early + dialing + left = n.
  const dialing = v.dial === 'all' ? 0 : mine.filter((b) => countsForRating(b, ratings) && dialIn.has(b.id)).length;
  const left = mine.filter((b) => countsForRating(b, ratings) && (v.dial === 'all' || !dialIn.has(b.id))).length;
  const decaf = mine[0].decaf && v.caffeine !== 'all';
  const all = n === 1 ? 'its only rated brew is' : `all ${n} rated brews are`;
  const why = decaf ? 'No comparison: decaf coffees are left out by default.'
    : !mine[0].roastLevel ? 'No comparison: this coffee has no roast level.'
    : !left ? `No comparison yet: ${all} ${early === n ? 'from before calibration' : !early ? 'dial-in brews' : 'from before calibration or dial-in'}.`
    : 'No comparison yet: too few similar coffees to compare with.';
  // The widest like group (same roast level), as likeGaps sees it under this view: full bags only.
  const similar = fullBags(viewRows(brews, dialIn, v), 'all').filter((b) => b.coffeeId !== id && b.roastLevel === mine[0].roastLevel);
  const rows: [string, string][] = [
    ['Rated brews', `${n}`],
    ...(ratings === 'current' ? [['Before calibration', `${early}`] as [string, string]] : []),
    ...(v.dial !== 'all' ? [['Dial-in brews', `${dialing}`] as [string, string]] : []),
    ...(!decaf && left && mine[0].roastLevel ? [
      [`Other ${mine[0].roastLevel} coffees`, `${new Set(similar.map((b) => b.coffeeId)).size} bags, ${similar.length} brews`],
      ['Needed', `${POOLED_MIN_BAGS}+ bags of ${BAG_MIN_BREWS}+ brews, ${POOLED_MIN_BREWS}+ brews`]
    ] as [string, string][] : [])
  ];
  // The nearest view with a comparison: Caffeine first for a decaf coffee, then Ratings, Brews, both.
  const base: LikeView = decaf ? { ...v, caffeine: 'all' } : v;
  const fix = ([base, { ...base, ratings: 'all' }, { ...base, dial: 'all' }, { ...base, ratings: 'all', dial: 'all' }] as LikeView[])
    .find((x) => JSON.stringify(x) !== JSON.stringify(v) && likeGaps(viewRows(brews, dialIn, x), false, twins).has(id));
  return { why, rows, fix: fix ?? null };
}
