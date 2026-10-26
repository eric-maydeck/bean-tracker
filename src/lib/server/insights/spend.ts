import type { By, Ratings } from '$lib/insightsUrl';
import { restDays, waitBucket, WAIT_BUCKETS, windowState, type BrewFact, type BagFact } from './facts';
import { autoBy, daysBetween, inPeriod, trackedBounds, trackedDays, type Period } from './time';
import { buckets, bucketLabels, bucketTitles, type Bucket } from './consumption';
import { ratedGroups, bagSizes } from './ratings';
import { twinKeys } from './likeGroup';
import { groupBy, valueScore } from './records';
import { weightedMedian } from './stats';
import { BAG_MIN_BREWS, pooled, single, type Sample } from '$lib/sample';
import { compareTiles, isFinished, type Delta } from './overview';
import { leaderboard, listHref } from './leaderboards';
import type { Multi } from './insightGenerators';
import type { RcRow } from '../../../routes/insights/reportCard';

export interface Plan { id: number; name: string; roaster: string; price: number | null; paused: boolean }
export interface SpendCtx {
  period: Period; prev: Period | null; sameLength: boolean; pace: boolean; size: number;
  dataStart: string | null; today: string; by: By | undefined; ratings: Ratings; plans: readonly Plan[];
}

// $/g only for a bag with a cost above 0 and a size (free and unsized bags are left out of every $/g figure).
export const ppgOf = (b: BagFact): number | null =>
  b.cost !== null && b.cost > 0 && b.amountG !== null && b.amountG > 0 ? b.cost / b.amountG : null;

// Grams-weighted: total cost over total grams of the priced bags.
export const pricedPpg = (bags: readonly BagFact[]): number | null => {
  const priced = bags.filter((b) => ppgOf(b) !== null);
  const g = priced.reduce((s, b) => s + b.amountG!, 0);
  return g ? priced.reduce((s, b) => s + b.cost!, 0) / g : null;
};

export type SpendTiles = {
  spent: number; bags: number; avgPpg: number | null; avgBagCost: number | null; avgBagSize: number | null;
  newRoasters: number; subShare: number | null; plansPerMonth: number | null;
};
export const SPEND_KIND: Record<keyof SpendTiles, 'total' | 'average'> = {
  spent: 'total', bags: 'total', newRoasters: 'total',
  avgPpg: 'average', avgBagCost: 'average', avgBagSize: 'average', subShare: 'average', plansPerMonth: 'average'
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Bags bought (roast date) in `p`. `size`: per person divides spent, bags and plans per month only.
export function spendTiles(bags: readonly BagFact[], plans: readonly Plan[], p: Period, size = 1): SpendTiles & { free: number } {
  const inP = bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, p));
  const first = new Map<string, string>(); // roaster → earliest purchase date over all bags
  for (const b of bags) if (b.purchaseDate && (first.get(b.roaster) ?? '9') > b.purchaseDate) first.set(b.roaster, b.purchaseDate);
  const grams = inP.reduce((s, b) => s + (b.amountG ?? 0), 0);
  const subG = inP.reduce((s, b) => s + (b.subscriptionId !== null ? (b.amountG ?? 0) : 0), 0);
  const monthly = plans.filter((x) => !x.paused && x.price !== null);
  return {
    spent: inP.reduce((s, b) => s + (b.cost ?? 0), 0) / size,
    bags: inP.length / size,
    avgPpg: pricedPpg(inP),
    avgBagCost: mean(inP.flatMap((b) => (b.cost !== null && b.cost > 0 ? [b.cost] : []))),
    avgBagSize: mean(inP.flatMap((b) => (b.amountG !== null && b.amountG > 0 ? [b.amountG] : []))),
    newRoasters: [...first.values()].filter((d) => inPeriod(d, p)).length,
    subShare: grams ? subG / grams : null,
    plansPerMonth: monthly.length ? monthly.reduce((s, x) => s + x.price!, 0) / size : null,
    free: inP.filter((b) => b.cost === 0).length
  };
}

export interface SpendSeries {
  by: By; labels: string[]; titles: string[]; partial: boolean;
  sub: number[]; oneOff: number[]; // $ per bucket (÷ size), by roast date
  ppg: { all: (number | null)[]; sub: (number | null)[]; oneOff: (number | null)[] }; // grams-weighted; null = no priced bag
  compare: (number | null)[] | null; compareTitles: (string | null)[] | null; compareAverage: number | null; comparePpg: (number | null)[] | null;
}

// Per bucket: $ split by plan, and $/g (All / plan / one-off). Bags land in the bucket holding their roast date.
function flows(bags: readonly BagFact[], bs: readonly Bucket[], size: number) {
  const per = bs.map((b) => bags.filter((g) => g.purchaseDate && g.purchaseDate >= b.start && g.purchaseDate <= b.end));
  const cost = (xs: readonly BagFact[]) => xs.reduce((s, g) => s + (g.cost ?? 0), 0) / size;
  const subs = per.map((xs) => xs.filter((g) => g.subscriptionId !== null));
  const ones = per.map((xs) => xs.filter((g) => g.subscriptionId === null));
  return { sub: subs.map(cost), oneOff: ones.map(cost), ppg: { all: per.map(pricedPpg), sub: subs.map(pricedPpg), oneOff: ones.map(pricedPpg) } };
}

// The Period's buckets (Spend over time and Share of spend use the same ones).
function periodBuckets(c: SpendCtx) {
  const t = trackedBounds(c.period, c.dataStart, c.today);
  const by = c.by ?? autoBy(t ? daysBetween(t.start, t.end) + 1 : 0);
  return { by, bs: buckets(t, by) };
}

function spendSeries(bags: readonly BagFact[], c: SpendCtx): SpendSeries {
  const { by, bs } = periodBuckets(c);
  const f = flows(bags, bs, c.size);
  let compare: SpendSeries['compare'] = null, comparePpg: SpendSeries['comparePpg'] = null;
  let compareTitles: SpendSeries['compareTitles'] = null, compareAverage: number | null = null;
  if (c.prev) {
    const pb = buckets(trackedBounds(c.prev, c.dataStart, c.today), by);
    const pf = flows(bags, pb, c.size);
    const total = pf.sub.map((v, i) => v + pf.oneOff[i]);
    if (c.sameLength) {
      // A clipped previous window can be shorter: pad to this window's buckets.
      const names = bucketTitles(pb, by);
      compare = bs.map((_, i) => total[i] ?? null);
      comparePpg = bs.map((_, i) => pf.ppg.all[i] ?? null);
      compareTitles = bs.map((_, i) => names[i] ?? null);
    } else compareAverage = pb.length ? total.reduce((a, b) => a + b, 0) / pb.length : null;
  }
  return { by, labels: bucketLabels(bs, by), titles: bucketTitles(bs, by), partial: bs.some((b) => b.partial), ...f, compare, compareTitles, compareAverage, comparePpg };
}

export interface ValuePoint {
  key: string; name: string; roaster: string; slug: string | null; ppg: number; rating: number; mean: number;
  brews: number; sample: Sample; sub: boolean;
}
export interface ValueMap {
  points: ValuePoint[]; cut: ValuePoint[]; cap: number | null; medianPpg: number | null; medianRating: number | null;
  best: (ValuePoint & { score: number })[];
}

// One point per coffee (a repurchase is the same coffee) with a counted rated brew in the Period and a priced bag.
// $/g pools all its priced bags (any date). The axis stops at the 95th percentile (nearest rank): `cut` is above it.
function valueMap(scored: readonly BrewFact[], whole: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): ValueMap {
  const twins = twinKeys(bags);
  const inP = (bs: readonly BrewFact[]) => bs.filter((b) => inPeriod(b.localDate, c.period));
  const sizes = bagSizes(inP(whole), c.ratings);
  const byKey = groupBy(bags, (b) => twins.get(b.id));
  const points: ValuePoint[] = [];
  for (const g of ratedGroups(inP(scored), (b) => (b.coffeeId === null ? null : (twins.get(b.coffeeId) ?? null)), c.ratings, 'adjusted', true)) {
    const mine = byKey.get(g.label) ?? [];
    const ppg = pricedPpg(mine);
    if (ppg === null) continue;
    const latest = mine.reduce((a, b) => ((b.purchaseDate ?? '') >= (a.purchaseDate ?? '') ? b : a));
    points.push({
      key: g.label, name: latest.name, roaster: latest.roaster, slug: latest.slug, ppg, rating: g.adjusted, mean: g.mean, brews: g.brews,
      sample: single(mine.reduce((s, b) => s + (sizes.get(b.id) ?? 0), 0), g.brews), sub: mine.some((b) => b.subscriptionId !== null)
    });
  }
  const sorted = points.map((p) => p.ppg).sort((a, b) => a - b);
  const cap = sorted.length ? sorted[Math.ceil(0.95 * sorted.length) - 1] : null;
  const median = (xs: number[]) => (xs.length > 1 ? weightedMedian(xs, xs.map(() => 1)) : null);
  const best = points.filter((p) => p.sample.brews >= BAG_MIN_BREWS).map((p) => ({ ...p, score: valueScore(p.mean, p.ppg) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 5);
  return {
    points, cut: points.filter((p) => cap !== null && p.ppg > cap), cap,
    medianPpg: median(points.map((p) => p.ppg)), medianRating: median(points.map((p) => p.rating)), best
  };
}

// One row per roaster with a bag bought in the Period. Rating and vs like come from the Leaderboards roaster rows (raw average).
function reportCard(scored: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): RcRow[] {
  const board = (rank: 'rating' | 'like') => new Map(leaderboard(scored, bags, c.period, 'roasters', rank, c.ratings, 'raw', false).map((r) => [r.key, r]));
  const rating = board('rating'), like = board('like');
  const mine = groupBy(bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, c.period)), (b) => b.roaster);
  return [...mine].map(([roaster, inP]) => ({
    roaster, bags: inP.length / c.size, spent: inP.reduce((s, b) => s + (b.cost ?? 0), 0) / c.size, ppg: pricedPpg(inP),
    rating: rating.get(roaster)?.value ?? null, ratingSample: rating.get(roaster)?.sample,
    like: like.get(roaster)?.value ?? null, likeSample: like.get(roaster)?.sample,
    last: bags.reduce((m, b) => (b.roaster === roaster && b.purchaseDate && b.purchaseDate <= c.period.end && b.purchaseDate > m ? b.purchaseDate : m), ''),
    href: listHref('roaster', [roaster])
  }));
}

export interface Discovery {
  labels: string[]; titles: string[]; cumulative: number[]; band: [number, number] | null;
  share: (Multi & { other: [string, number][][] }) | null; repeatRate: number | null; roasters: number;
}
const SHARE_TOP = 5;

// Integer percents of `vals` that add up to exactly 100 (largest remainder); all zeros when there is nothing.
function percents(vals: readonly number[]): number[] {
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return vals.map(() => 0);
  const exact = vals.map((v) => (100 * v) / total), out = exact.map(Math.floor);
  const order = exact.map((e, i) => [e - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const left = 100 - out.reduce((a, b) => a + b, 0);
  for (let k = 0; k < left; k++) out[order[k][1]]++;
  return out;
}

// Cumulative distinct roasters over all history; the Period's roaster spend shares; the repeat-buy rate.
function discovery(bags: readonly BagFact[], c: SpendCtx): Discovery {
  const dated = bags.filter((b) => b.purchaseDate);
  const first = new Map<string, string>();
  for (const b of dated) if ((first.get(b.roaster) ?? '9') > b.purchaseDate!) first.set(b.roaster, b.purchaseDate!);
  const start = [...first.values()].sort()[0];
  const by = autoBy(start ? daysBetween(start, c.today) + 1 : 0);
  const all = buckets(start ? { start, end: c.today } : null, by);
  const hit = all.flatMap((b, i) => (b.end >= (c.period.start ?? '') && b.start <= c.period.end ? [i] : []));
  const inP = dated.filter((b) => inPeriod(b.purchaseDate!, c.period));
  const mine = new Set(inP.map((b) => b.roaster));
  const repeat = [...mine].filter((r) => c.period.start !== null && first.get(r)! < c.period.start).length;

  const spend = new Map<string, number>();
  for (const b of inP) spend.set(b.roaster, (spend.get(b.roaster) ?? 0) + (b.cost ?? 0));
  const ranked = [...spend].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r]) => r);
  const top = ranked.slice(0, SHARE_TOP), rest = ranked.slice(SHARE_TOP);
  const { by: sBy, bs } = periodBuckets(c);
  const per = bs.map((b) => {
    const m = new Map<string, number>();
    for (const g of inP) if (g.purchaseDate! >= b.start && g.purchaseDate! <= b.end) m.set(g.roaster, (m.get(g.roaster) ?? 0) + (g.cost ?? 0));
    return m;
  });
  const names = rest.length ? [...top, 'Other'] : top;
  const cols = per.map((m) => percents([...top.map((r) => m.get(r) ?? 0), ...(rest.length ? [rest.reduce((s, r) => s + (m.get(r) ?? 0), 0)] : [])]));
  const share = [...spend.values()].some((v) => v > 0) ? {
    x: bucketLabels(bs, sBy), unit: '%',
    lines: names.map((label, k) => ({ label, values: cols.map((p) => p[k]) })),
    other: per.map((m) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      return rest.filter((r) => (m.get(r) ?? 0) > 0).sort((a, b) => m.get(b)! - m.get(a)!).map((r): [string, number] => [r, Math.round((100 * m.get(r)!) / total)]);
    })
  } : null;
  return {
    labels: bucketLabels(all, by), titles: bucketTitles(all, by),
    cumulative: all.map((b) => [...first.values()].filter((d) => d <= b.end).length),
    band: c.period.start === null || !hit.length ? null : [hit[0], hit.at(-1)!],
    share, repeatRate: mine.size && c.period.start !== null ? repeat / mine.size : null, roasters: mine.size
  };
}

export interface PlanRow { id: number; name: string; paused: boolean; perMonth: number | null; bags: number; ppg: number | null; rating: number | null; sample?: Sample }
export interface PlanPanel {
  rows: PlanRow[]; oneOffPpg: number | null; oneOffRating: number | null; oneOffSample?: Sample;
  total: { perMonth: number | null; bags: number; ppg: number | null; rating: number | null };
}

// Every plan (paused too) with the figures of its linked bags bought in the Period, against the one-off bags.
// Rating: all counted rated brews of those bags bought in the Period (any brew date; `scored` is not range-limited), bag-weighted (ratedGroups raw). Totals: $/month over active plans only.
function plansPanel(scored: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): PlanPanel {
  const inP = bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, c.period));
  const figures = (mine: readonly BagFact[]) => {
    const ids = new Set(mine.map((b) => b.id));
    const g = ratedGroups(scored.filter((b) => b.coffeeId !== null && ids.has(b.coffeeId)), () => 'x', c.ratings, 'raw')[0];
    return { bags: mine.length / c.size, ppg: pricedPpg(mine), rating: g?.mean ?? null, sample: g?.sample };
  };
  const perMonth = (p: Plan) => (p.price === null ? null : p.price / c.size);
  const rows = c.plans.map((p) => ({ id: p.id, name: p.name, paused: p.paused, perMonth: perMonth(p), ...figures(inP.filter((b) => b.subscriptionId === p.id)) }));
  const one = figures(inP.filter((b) => b.subscriptionId === null));
  const all = figures(inP.filter((b) => b.subscriptionId !== null));
  const active = c.plans.filter((p) => !p.paused && p.price !== null);
  return {
    rows, oneOffPpg: one.ppg, oneOffRating: one.rating, oneOffSample: one.sample,
    total: { perMonth: active.length ? active.reduce((s, p) => s + perMonth(p)!, 0) : null, bags: all.bags, ppg: all.ppg, rating: all.rating }
  };
}

export interface Wait { median: number | null; n: number; sample: Sample }
export interface WaitRow extends Wait { key: string }
export interface Fresh {
  toOpen: Wait; byRoaster: WaitRow[]; byProcess: WaitRow[]; daysOpen: Wait;
  byWait: { label: string; rating: number | null; sample: Sample; bags: number }[];
  window: { label: 'Before' | 'Inside' | 'After'; share: number; brews: number; rating: number | null; sample: Sample }[];
  noWindow: number;
}
const FRESH_TOP = 5;

const wait = (xs: number[]): Wait => ({ median: xs.length ? weightedMedian(xs, xs.map(() => 1)) : null, n: xs.length, sample: pooled(xs.length, xs.length) });
function waitRows(items: readonly { key: string; days: number }[]): WaitRow[] {
  return [...groupBy(items, (i) => i.key)].map(([key, xs]) => ({ key, ...wait(xs.map((i) => i.days)) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, FRESH_TOP);
}

// Freshness history. Open day = the earlier of openedDate and the first brew (opened_date lags it), only for bags that
// have an openedDate: no fallback for the rest. Time to open: roast → open (freezer-net) for bags opened in the Period.
// Days open: open day → last brew, inclusive, for finished bags whose last brew is in the Period.
function fresh(scored: readonly BrewFact[], whole: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): Fresh {
  const opened = bags.flatMap((b) => (b.openedDate ? [{ b, day: b.firstBrew && b.firstBrew < b.openedDate ? b.firstBrew : b.openedDate }] : []));
  const toOpen = opened.flatMap(({ b, day }) => {
    const days = inPeriod(day, c.period) ? restDays(b.purchaseDate, b.frozenStart ?? null, b.frozenEnd ?? null, day) : null;
    return days === null ? [] : [{ b, days }];
  });
  const daysOpen = opened.filter(({ b }) => isFinished(b) && inPeriod(b.lastBrew!, c.period)).map(({ b, day }) => daysBetween(day, b.lastBrew!) + 1);

  const inP = (xs: readonly BrewFact[]) => xs.filter((b) => inPeriod(b.localDate, c.period));
  const scoredP = inP(scored);
  // Rating by wait: each bag's first brew places the bag in a bucket.
  const bucketOf = new Map<number, number>();
  for (const b of whole) if (b.brewIndex === 1 && b.coffeeId !== null) { const i = waitBucket(b.restDays); if (i !== null) bucketOf.set(b.coffeeId, i); }
  const byBucket = new Map(ratedGroups(scoredP, (b) => (b.coffeeId === null || !bucketOf.has(b.coffeeId) ? null : String(bucketOf.get(b.coffeeId))), c.ratings, 'adjusted').map((g) => [g.label, g]));
  // Rest window: every Period brew with a rest and its bag's window.
  const byId = new Map(bags.map((b) => [b.id, b]));
  const stateOf = (b: BrewFact) => { const g = b.coffeeId === null ? undefined : byId.get(b.coffeeId); return windowState(b.restDays, g?.restLow, g?.restHigh); };
  const classes = [['before', 'Before'], ['in', 'Inside'], ['past', 'After']] as const;
  const counts = classes.map(([k]) => inP(whole).filter((b) => stateOf(b) === k).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const byState = new Map(ratedGroups(scoredP, (b) => { const k = stateOf(b); return k === 'none' ? null : k; }, c.ratings, 'adjusted').map((g) => [g.label, g]));
  return {
    toOpen: wait(toOpen.map((x) => x.days)),
    byRoaster: waitRows(toOpen.map((x) => ({ key: x.b.roaster, days: x.days }))),
    byProcess: waitRows(toOpen.map((x) => ({ key: x.b.processGroup, days: x.days }))),
    daysOpen: wait(daysOpen),
    byWait: WAIT_BUCKETS.map((w, i) => {
      const g = byBucket.get(String(i));
      return { label: w.label, rating: g?.adjusted ?? null, sample: g?.sample ?? pooled(0, 0), bags: g?.bags ?? 0 };
    }),
    window: classes.map(([k, label], i) => {
      const g = byState.get(k);
      return { label, share: total ? counts[i] / total : 0, brews: counts[i], rating: g?.adjusted ?? null, sample: g?.sample ?? pooled(0, 0) };
    }),
    noWindow: inP(whole).length - total
  };
}

export interface SpendTab {
  tiles: SpendTiles; free: number; series: SpendSeries; valueMap: ValueMap; reportCard: RcRow[]; discovery: Discovery; plans: PlanPanel; fresh: Fresh;
  deltas: Partial<Record<keyof SpendTiles, Delta>> | null; scaled: boolean;
}

export function spendTab(scored: readonly BrewFact[], whole: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): SpendTab {
  const { free, ...tiles } = spendTiles(bags, c.plans, c.period, c.size);
  const cmp = c.prev && compareTiles(
    tiles, spendTiles(bags, c.plans, c.prev, c.size),
    trackedDays(c.period, c.dataStart, c.today), trackedDays(c.prev, c.dataStart, c.today), c.pace, SPEND_KIND
  );
  // Plans are current-state: no delta.
  const { plansPerMonth: _now, ...deltas } = cmp?.deltas ?? ({} as Record<keyof SpendTiles, Delta>);
  return { tiles, free, series: spendSeries(bags, c), valueMap: valueMap(scored, whole, bags, c), reportCard: reportCard(scored, bags, c), discovery: discovery(bags, c), plans: plansPanel(scored, bags, c), fresh: fresh(scored, whole, bags, c), deltas: cmp ? deltas : null, scaled: cmp ? cmp.scaled : false };
}
