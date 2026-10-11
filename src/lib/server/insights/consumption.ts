import type { By, Unit } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { addDays, addMonths, autoBy, daysBetween, inPeriod, trackedBounds, weekday, type Period } from './time';
import { consumption, gramsOnHand, isFinished, loggedGrams, paceDelta, remaining, type Delta } from './overview';

export interface Bucket { start: string; end: string; partial: boolean }
export type ConsumptionTiles = {
  brewed: number; bought: number; net: number; avg: number | null; onHand: number; daysToClear: number | null;
};
export interface ConsumptionTab {
  by: By; // effective (explicit or auto)
  tiles: ConsumptionTiles; clearBy: string | null;
  deltas: { brewed: Delta; bought: Delta; net: Delta; avg: Delta } | null;
  buckets: Bucket[]; brewed: number[]; bought: number[]; backlog: number[];
  compareBrewed: number[] | null; // same-length compare: bucket for bucket
  compareAverage: number | null; // longer/custom compare: its per-bucket average (dashed line)
}
export interface ConsumptionCtx {
  period: Period; prev: Period | null; sameLength: boolean; unit: Unit; by: By | undefined; size: number;
  dataStart: string | null; today: string; pace: boolean;
}

export const PER: Record<By, number> = { day: 1, week: 7, month: 30.44 };

const unitStart = (d: string, by: By) => (by === 'week' ? addDays(d, -weekday(d)) : by === 'month' ? `${d.slice(0, 7)}-01` : d);
const unitNext = (d: string, by: By) => (by === 'week' ? addDays(d, 7) : by === 'month' ? addMonths(d, 1) : addDays(d, 1));

// Mon-start weeks and calendar months, clipped to the tracked span; a clipped bucket is partial.
export function buckets(t: { start: string; end: string } | null, by: By): Bucket[] {
  const out: Bucket[] = [];
  for (let u = t ? unitStart(t.start, by) : ''; t && u <= t.end; u = unitNext(u, by)) {
    const natEnd = addDays(unitNext(u, by), -1);
    const start = u < t.start ? t.start : u;
    const end = natEnd > t.end ? t.end : natEnd;
    out.push({ start, end, partial: start !== u || end !== natEnd });
  }
  return out;
}

// On hand at each end date: bought by then and not finished (last brew) by then. Grams count what's
// left (overview's `remaining` over doses logged by then). Archived bags with no brews have no
// finish date, so they're left out.
// ponytail: re-sums the logged doses per end, O(ends × brews); fine at prod size, sweep once if not.
export function backlogSeries(brews: readonly BrewFact[], bags: readonly BagFact[], ends: readonly string[], unit: Unit): number[] {
  const live = bags.filter((g) => g.purchaseDate !== null && (g.status !== 'archive' || g.lastBrew !== null));
  return ends.map((d) => {
    const logged = loggedGrams(brews.filter((b) => b.localDate <= d));
    let sum = 0;
    for (const g of live) {
      if (g.purchaseDate! > d || (isFinished(g) && g.lastBrew! <= d)) continue;
      sum += unit === 'bags' ? 1 : remaining(g, logged);
    }
    return sum;
  });
}

// Brewed and bought per bucket (÷ size): grams of doses / of bags bought, or bags finished / bought.
// ponytail: findIndex per item is O(items × buckets); fine at ~1,600 × 366, bisect if it ever isn't.
function flows(brews: readonly BrewFact[], bags: readonly BagFact[], bs: readonly Bucket[], c: ConsumptionCtx) {
  const brewed = bs.map(() => 0);
  const bought = bs.map(() => 0);
  const at = (d: string | null) => (d === null ? -1 : bs.findIndex((b) => d >= b.start && d <= b.end));
  if (c.unit === 'grams') for (const b of brews) { const i = at(b.localDate); if (i >= 0) brewed[i] += (b.dose ?? 0) / c.size; }
  else for (const g of bags) { const i = isFinished(g) ? at(g.lastBrew) : -1; if (i >= 0) brewed[i] += 1 / c.size; }
  for (const g of bags) { const i = at(g.purchaseDate); if (i >= 0) bought[i] += (c.unit === 'grams' ? (g.amountG ?? 0) : 1) / c.size; }
  return { brewed, bought };
}

// Period totals (÷ size), by date in the period like Overview's tiles, independent of the buckets.
function totals(brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, c: ConsumptionCtx) {
  const brewed = c.unit === 'grams'
    ? brews.reduce((s, b) => s + (inPeriod(b.localDate, p) ? (b.dose ?? 0) : 0), 0)
    : bags.filter((g) => isFinished(g) && inPeriod(g.lastBrew!, p)).length;
  const bought = bags.reduce(
    (s, g) => s + (g.purchaseDate && inPeriod(g.purchaseDate, p) ? (c.unit === 'grams' ? (g.amountG ?? 0) : 1) : 0), 0);
  return { brewed: brewed / c.size, bought: bought / c.size };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const spanOf = (t: { start: string; end: string } | null) => (t ? daysBetween(t.start, t.end) + 1 : 0);
const avgOf = (brewed: number, span: number, by: By) => (span && brewed ? (brewed / span) * PER[by] : null);

export function consumptionTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: ConsumptionCtx): ConsumptionTab {
  const t = trackedBounds(c.period, c.dataStart, c.today);
  const span = spanOf(t);
  const by = c.by ?? autoBy(span);
  const bs = buckets(t, by);
  const { brewed, bought } = flows(brews, bags, bs, c);
  const onHandG = gramsOnHand(bags, brews);
  const use = consumption(brews, c.period, c.dataStart, c.today, onHandG, c.size);
  const cur = totals(brews, bags, c.period, c);
  const tiles: ConsumptionTiles = {
    ...cur, net: cur.bought - cur.brewed, avg: avgOf(cur.brewed, span, by),
    onHand: c.unit === 'grams' ? onHandG : bags.filter((g) => g.status !== 'archive').length,
    daysToClear: use.daysToClear
  };
  let deltas: ConsumptionTab['deltas'] = null;
  let compareBrewed: number[] | null = null;
  let compareAverage: number | null = null;
  if (c.prev) {
    const pt = trackedBounds(c.prev, c.dataStart, c.today);
    const pspan = spanOf(pt);
    const pb = buckets(pt, by);
    const p = totals(brews, bags, c.prev, c);
    // ponytail: tileDelta gives no change from a base <= 0, so a shrinking pile (net < 0) has no Net delta.
    deltas = {
      brewed: paceDelta(tiles.brewed, p.brewed, span, pspan, c.pace),
      bought: paceDelta(tiles.bought, p.bought, span, pspan, c.pace),
      net: paceDelta(tiles.net, p.bought - p.brewed, span, pspan, c.pace),
      avg: paceDelta(tiles.avg, avgOf(p.brewed, pspan, by), span, pspan, false)
    };
    const pf = flows(brews, bags, pb, c);
    if (c.sameLength) compareBrewed = pf.brewed;
    else compareAverage = pb.length ? sum(pf.brewed) / pb.length : null;
  }
  return {
    by, tiles, clearBy: use.clearBy, deltas, buckets: bs, brewed, bought,
    backlog: backlogSeries(brews, bags, bs.map((b) => b.end), c.unit), compareBrewed, compareAverage
  };
}
