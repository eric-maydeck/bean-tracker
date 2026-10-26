import { restDays, waitBucket, WAIT_BUCKETS, windowState, type BagFact, type BrewFact } from './facts';
import { daysBetween, inPeriod, type Period } from './time';
import { isFinished } from './overview';
import { ratedGroups } from './ratings';
import { groupBy } from './records';
import { weightedMedian } from './stats';
import { pooled, type Sample } from '$lib/sample';
import type { Ratings } from '$lib/insightsUrl';

export interface Wait { median: number | null; n: number; sample: Sample }
export interface WaitRow extends Wait { key: string }
export interface TimeToOpen { toOpen: Wait; byRoaster: WaitRow[]; byProcess: WaitRow[]; daysOpen: Wait }
export interface WaitWindow {
  byWait: { label: string; rating: number | null; sample: Sample; bags: number }[];
  window: { label: 'Before' | 'Inside' | 'After'; share: number; brews: number; rating: number | null; sample: Sample }[];
  noWindow: number;
}
const TOP = 5;

const wait = (xs: number[]): Wait => ({ median: xs.length ? weightedMedian(xs, xs.map(() => 1)) : null, n: xs.length, sample: pooled(xs.length, xs.length) });
function waitRows(items: readonly { key: string; days: number }[]): WaitRow[] {
  return [...groupBy(items, (i) => i.key)].map(([key, xs]) => ({ key, ...wait(xs.map((i) => i.days)) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, TOP);
}

// A bag's open day is its first brew (user, 2026-10-26: moving a bag to "open" is not opening it, so opened_date is
// not used). Time to open: roast → first brew (freezer-net) for bags first brewed in the Period; negative rests are
// left out. Days open: first brew → last brew, inclusive, for finished bags whose last brew is in the Period.
export function timeToOpen(bags: readonly BagFact[], period: Period): TimeToOpen {
  const brewed = bags.filter((b) => b.firstBrew);
  const toOpen = brewed.flatMap((b) => {
    const days = inPeriod(b.firstBrew!, period) ? restDays(b.purchaseDate, b.frozenStart ?? null, b.frozenEnd ?? null, b.firstBrew!) : null;
    return days === null || days < 0 ? [] : [{ b, days }];
  });
  return {
    toOpen: wait(toOpen.map((x) => x.days)),
    byRoaster: waitRows(toOpen.map((x) => ({ key: x.b.roaster, days: x.days }))),
    byProcess: waitRows(toOpen.map((x) => ({ key: x.b.processGroup, days: x.days }))),
    daysOpen: wait(brewed.filter((b) => isFinished(b) && inPeriod(b.lastBrew!, period)).map((b) => daysBetween(b.firstBrew!, b.lastBrew!) + 1))
  };
}

// Rating by wait: each bag's first brew (`whole`, brewIndex 1) rest places the bag in a bucket; the Period's scored brews
// are rated by their bag's bucket. Rest window: every Period brew of `whole` with a rest and its bag's window.
export function waitWindow(scored: readonly BrewFact[], whole: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; ratings: Ratings }): WaitWindow {
  const inP = (xs: readonly BrewFact[]) => xs.filter((b) => inPeriod(b.localDate, c.period));
  const scoredP = inP(scored);
  const bucketOf = new Map<number, number>();
  for (const b of whole) if (b.brewIndex === 1 && b.coffeeId !== null) { const i = waitBucket(b.restDays); if (i !== null) bucketOf.set(b.coffeeId, i); }
  const byBucket = new Map(ratedGroups(scoredP, (b) => (b.coffeeId === null || !bucketOf.has(b.coffeeId) ? null : String(bucketOf.get(b.coffeeId))), c.ratings, 'adjusted').map((g) => [g.label, g]));
  const byId = new Map(bags.map((b) => [b.id, b]));
  const stateOf = (b: BrewFact) => { const g = b.coffeeId === null ? undefined : byId.get(b.coffeeId); return windowState(b.restDays, g?.restLow, g?.restHigh); };
  const classes = [['before', 'Before'], ['in', 'Inside'], ['past', 'After']] as const;
  const wholeP = inP(whole);
  const counts = classes.map(([k]) => wholeP.filter((b) => stateOf(b) === k).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const byState = new Map(ratedGroups(scoredP, (b) => { const k = stateOf(b); return k === 'none' ? null : k; }, c.ratings, 'adjusted').map((g) => [g.label, g]));
  return {
    byWait: WAIT_BUCKETS.map((w, i) => {
      const g = byBucket.get(String(i));
      return { label: w.label, rating: g?.adjusted ?? null, sample: g?.sample ?? pooled(0, 0), bags: g?.bags ?? 0 };
    }),
    window: classes.map(([k, label], i) => {
      const g = byState.get(k);
      return { label, share: total ? counts[i] / total : 0, brews: counts[i], rating: g?.adjusted ?? null, sample: g?.sample ?? pooled(0, 0) };
    }),
    noWindow: wholeP.length - total
  };
}
