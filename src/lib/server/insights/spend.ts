import type { By, Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { autoBy, daysBetween, inPeriod, trackedBounds, trackedDays, type Period } from './time';
import { buckets, bucketLabels, bucketTitles, type Bucket } from './consumption';
import { ratedGroups, bagSizes } from './ratings';
import { twinKeys } from './likeGroup';
import { groupBy, valueScore } from './records';
import { weightedMedian } from './stats';
import { BAG_MIN_BREWS, single, type Sample } from '$lib/sample';
import { compareTiles, type Delta } from './overview';
import { leaderboard, listHref } from './leaderboards';
import { toParams } from '$lib/coffeeViewState';
import type { Filter } from '$lib/coffeeFilters';
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

// Bags bought (roast date) in `p`. `size`: per person divides spent and plans per month only (bags are shared in the household, user 2026-10-26).
export function spendTiles(bags: readonly BagFact[], plans: readonly Plan[], p: Period, size = 1): SpendTiles & { free: number } {
  const inP = bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, p));
  const first = new Map<string, string>(); // roaster → earliest purchase date over all bags
  for (const b of bags) if (b.purchaseDate && (first.get(b.roaster) ?? '9') > b.purchaseDate) first.set(b.roaster, b.purchaseDate);
  const grams = inP.reduce((s, b) => s + (b.amountG ?? 0), 0);
  const subG = inP.reduce((s, b) => s + (b.subscriptionId !== null ? (b.amountG ?? 0) : 0), 0);
  const monthly = plans.filter((x) => !x.paused && x.price !== null);
  return {
    spent: inP.reduce((s, b) => s + (b.cost ?? 0), 0) / size,
    bags: inP.length,
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
  // The compare window split the same way (same shapes as the totals above, one per plan kind).
  compareSplit: { sub: (number | null)[]; oneOff: (number | null)[] } | null;
  comparePpgSplit: { sub: (number | null)[]; oneOff: (number | null)[] } | null;
  compareAverageSplit: { sub: number; oneOff: number } | null;
}

// Per bucket: $ split by plan, and $/g (All / plan / one-off). Bags land in the bucket holding their roast date.
function flows(bags: readonly BagFact[], bs: readonly Bucket[], size: number) {
  const per = bs.map((b) => bags.filter((g) => g.purchaseDate && g.purchaseDate >= b.start && g.purchaseDate <= b.end));
  const cost = (xs: readonly BagFact[]) => xs.reduce((s, g) => s + (g.cost ?? 0), 0) / size;
  const subs = per.map((xs) => xs.filter((g) => g.subscriptionId !== null));
  const ones = per.map((xs) => xs.filter((g) => g.subscriptionId === null));
  return { sub: subs.map(cost), oneOff: ones.map(cost), ppg: { all: per.map(pricedPpg), sub: subs.map(pricedPpg), oneOff: ones.map(pricedPpg) } };
}

// Money is counted by roast date, and a bag can be roasted before the first brew: the buckets start at the earlier of
// the first brew and the first roast date, so the chart adds up to the tiles.
const origin = (bags: readonly BagFact[], c: SpendCtx): string | null =>
  bags.reduce<string | null>((m, b) => (b.purchaseDate && (m === null || b.purchaseDate < m) ? b.purchaseDate : m), c.dataStart);

// The Period's buckets (Spend over time and Share of spend use the same ones).
function periodBuckets(bags: readonly BagFact[], c: SpendCtx) {
  const t = trackedBounds(c.period, origin(bags, c), c.today);
  const by = c.by ?? autoBy(t ? daysBetween(t.start, t.end) + 1 : 0);
  return { by, bs: buckets(t, by) };
}

function spendSeries(bags: readonly BagFact[], c: SpendCtx): SpendSeries {
  const { by, bs } = periodBuckets(bags, c);
  const f = flows(bags, bs, c.size);
  let compare: SpendSeries['compare'] = null, comparePpg: SpendSeries['comparePpg'] = null;
  let compareTitles: SpendSeries['compareTitles'] = null, compareAverage: number | null = null;
  let compareSplit: SpendSeries['compareSplit'] = null, comparePpgSplit: SpendSeries['comparePpgSplit'] = null, compareAverageSplit: SpendSeries['compareAverageSplit'] = null;
  if (c.prev) {
    const pb = buckets(trackedBounds(c.prev, origin(bags, c), c.today), by);
    const pf = flows(bags, pb, c.size);
    const total = pf.sub.map((v, i) => v + pf.oneOff[i]);
    if (c.sameLength) {
      // A clipped previous window can be shorter: pad to this window's buckets.
      const names = bucketTitles(pb, by);
      compare = bs.map((_, i) => total[i] ?? null);
      comparePpg = bs.map((_, i) => pf.ppg.all[i] ?? null);
      compareTitles = bs.map((_, i) => names[i] ?? null);
      const pad = <T,>(xs: T[]) => bs.map((_, i) => xs[i] ?? null);
      compareSplit = { sub: pad(pf.sub), oneOff: pad(pf.oneOff) };
      comparePpgSplit = { sub: pad(pf.ppg.sub), oneOff: pad(pf.ppg.oneOff) };
    } else if (pb.length) {
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / pb.length;
      compareAverage = avg(total);
      compareAverageSplit = { sub: avg(pf.sub), oneOff: avg(pf.oneOff) };
    }
  }
  return { by, labels: bucketLabels(bs, by), titles: bucketTitles(bs, by), partial: bs.some((b) => b.partial), ...f, compare, compareTitles, compareAverage, comparePpg, compareSplit, comparePpgSplit, compareAverageSplit };
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
    roaster, bags: inP.length, spent: inP.reduce((s, b) => s + (b.cost ?? 0), 0) / c.size, ppg: pricedPpg(inP),
    rating: rating.get(roaster)?.value ?? null, ratingSample: rating.get(roaster)?.sample,
    like: like.get(roaster)?.value ?? null, likeSample: like.get(roaster)?.sample,
    last: bags.reduce((m, b) => (b.roaster === roaster && b.purchaseDate && b.purchaseDate <= c.period.end && b.purchaseDate > m ? b.purchaseDate : m), ''),
    href: listHref('roaster', [roaster])
  }));
}

export interface Discovery {
  labels: string[]; titles: string[]; cumulative: number[]; band: [number, number] | null;
  // `dollars[k][i]`: line k's $ in bucket i (÷ size); `other[i]`: what bucket i's Other holds, [name, %, $].
  share: (Multi & { other: [string, number, number][][]; dollars: number[][] }) | null; repeatRate: number | null; roasters: number;
}
// Share of spend names the roasters with a bag in 2+ buckets, biggest Period spend first, up to the categorical
// palette's 14 slots (ui-rules 42); everything else is Other.
const SHARE_SLOTS = 14;

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
  // Repeat-buy: roasters of the Period you have bought 2+ bags from by its end.
  const bagCount = new Map<string, number>();
  for (const b of dated) if (b.purchaseDate! <= c.period.end) bagCount.set(b.roaster, (bagCount.get(b.roaster) ?? 0) + 1);
  const repeat = [...mine].filter((r) => (bagCount.get(r) ?? 0) >= 2).length;

  const spend = new Map<string, number>();
  for (const b of inP) spend.set(b.roaster, (spend.get(b.roaster) ?? 0) + (b.cost ?? 0));
  const { by: sBy, bs } = periodBuckets(bags, c);
  const per = bs.map((b) => {
    const m = new Map<string, number>();
    for (const g of inP) if (g.purchaseDate! >= b.start && g.purchaseDate! <= b.end) m.set(g.roaster, (m.get(g.roaster) ?? 0) + (g.cost ?? 0));
    return m;
  });
  const spendTotal = [...spend.values()].reduce((a, b) => a + b, 0);
  const top = [...spend].filter(([r]) => per.filter((m) => (m.get(r) ?? 0) > 0).length >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, SHARE_SLOTS).map(([r]) => r);
  const rest = [...spend.keys()].filter((r) => !top.includes(r));
  const names = rest.length ? [...top, 'Other'] : top;
  const dollars = per.map((m) => [...top.map((r) => m.get(r) ?? 0), ...(rest.length ? [rest.reduce((s, r) => s + (m.get(r) ?? 0), 0)] : [])]);
  const cols = dollars.map(percents);
  const share = spendTotal > 0 && top.length ? {
    x: bucketLabels(bs, sBy), unit: '%',
    lines: names.map((label, k) => ({ label, values: cols.map((p) => p[k]) })),
    dollars: names.map((_, k) => dollars.map((d) => d[k] / c.size)),
    other: per.map((m) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      return rest.filter((r) => (m.get(r) ?? 0) > 0).sort((a, b) => m.get(b)! - m.get(a)!).map((r): [string, number, number] => [r, Math.round((100 * m.get(r)!) / total), m.get(r)! / c.size]);
    })
  } : null;
  return {
    labels: bucketLabels(all, by), titles: bucketTitles(all, by),
    cumulative: all.map((b) => [...first.values()].filter((d) => d <= b.end).length),
    band: c.period.start === null || !hit.length ? null : [hit[0], hit.at(-1)!],
    share, repeatRate: mine.size ? repeat / mine.size : null, roasters: mine.size
  };
}

export interface PlanRow { id: number; name: string; paused: boolean; perMonth: number | null; bags: number; ppg: number | null; rating: number | null; sample?: Sample; href: string }
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
    return { bags: mine.length, ppg: pricedPpg(mine), rating: g?.mean ?? null, sample: g?.sample };
  };
  const perMonth = (p: Plan) => (p.price === null ? null : p.price / c.size);
  // The /coffees list of the plan's bags the count counts: every status, roast dates in the Period.
  const { start, end } = c.period;
  const roast: Filter = start === null ? { column: 'roast_date', mode: 'range', op: '<=', a: end, b: '' } : { column: 'roast_date', mode: 'range', op: 'between', a: start, b: end };
  const href = (id: number) => `/coffees?${toParams({ status: ['all'], filters: [{ column: 'subscription', mode: 'plan', value: id }, roast] })}`;
  const rows = c.plans.map((p) => ({ id: p.id, name: p.name, paused: p.paused, perMonth: perMonth(p), href: href(p.id), ...figures(inP.filter((b) => b.subscriptionId === p.id)) }));
  const one = figures(inP.filter((b) => b.subscriptionId === null));
  const all = figures(inP.filter((b) => b.subscriptionId !== null));
  const active = c.plans.filter((p) => !p.paused && p.price !== null);
  return {
    rows, oneOffPpg: one.ppg, oneOffRating: one.rating, oneOffSample: one.sample,
    total: { perMonth: active.length ? active.reduce((s, p) => s + perMonth(p)!, 0) : null, bags: all.bags, ppg: all.ppg, rating: all.rating }
  };
}

export interface SpendTab {
  tiles: SpendTiles; free: number; series: SpendSeries; valueMap: ValueMap; reportCard: RcRow[]; discovery: Discovery; plans: PlanPanel;
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
  return { tiles, free, series: spendSeries(bags, c), valueMap: valueMap(scored, whole, bags, c), reportCard: reportCard(scored, bags, c), discovery: discovery(bags, c), plans: plansPanel(scored, bags, c), deltas: cmp ? deltas : null, scaled: cmp ? cmp.scaled : false };
}
