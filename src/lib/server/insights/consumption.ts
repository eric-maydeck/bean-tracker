import type { Agg, By, Unit } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { addDays, addMonths, autoBy, daysBetween, inPeriod, trackedBounds, weekday, type Period } from './time';
import { consumption, gramsOnHand, isFinished, loggedGrams, paceDelta, remaining, type Delta } from './overview';

export interface Bucket { start: string; end: string; partial: boolean }
export type ConsumptionTiles = {
  brewed: number; bought: number; net: number; avg: number | null; onHand: number; daysToClear: number | null;
};
export interface Busiest { date: string; brews: number; grams: number }
export interface ConsumptionTab {
  by: By; // effective (explicit or auto)
  tiles: ConsumptionTiles; clearBy: string | null;
  busiest: Busiest | null; prevBusiest: string | null; // Avg per day's 4th tile: the day with the most grams (household)
  deltas: { brewed: Delta; bought: Delta; net: Delta; avg: Delta } | null;
  buckets: Bucket[]; labels: string[]; brewed: number[]; bought: number[]; backlog: number[];
  compareBrewed: number[] | null; // same-length compare: bucket for bucket
  compareTitles: (string | null)[] | null; // the compare bars' real dates, bucket for bucket with `brewed`
  compareAverage: number | null; // longer/custom compare: its per-bucket average (dashed line)
}
export interface ConsumptionCtx {
  period: Period; prev: Period | null; sameLength: boolean; unit: Unit; agg: Agg; by: By | undefined; size: number;
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

// Axis labels: day/week → "Sep 7" (bucket start), month → "Sep", or "Sep 2026" when the span crosses a
// year; a partial bucket gets a trailing "*".
export function bucketLabels(bs: readonly Bucket[], by: By = 'day'): string[] {
  const years = by === 'month' && bs.length > 0 && bs[0].start.slice(0, 4) !== bs[bs.length - 1].start.slice(0, 4);
  const opts: Intl.DateTimeFormatOptions =
    by === 'month' ? { month: 'short', ...(years && { year: 'numeric' }), timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return bs.map((b) => new Date(`${b.start}T00:00:00Z`).toLocaleDateString('en-US', opts) + (b.partial ? '*' : ''));
}

// Tooltip names: the dates a bucket really covers, with the year ("Sep 8 – Sep 14, 2025"), so a
// compare bar says which days it is. A clipped bucket is marked partial.
export function bucketTitles(bs: readonly Bucket[], by: By): string[] {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
  const md = (d: string, year: boolean) => f(d, { month: 'short', day: 'numeric', ...(year && { year: 'numeric' }) });
  return bs.map((b) => {
    const sameMonth = b.start.slice(0, 7) === b.end.slice(0, 7);
    const sameYear = b.start.slice(0, 4) === b.end.slice(0, 4);
    // A whole month is just its name; a week, day or clipped month shows its days ("Aug 18–31, 2025").
    const name =
      by === 'month' && !b.partial ? f(b.start, { month: 'short', year: 'numeric' })
      : b.start === b.end ? md(b.start, true)
      : sameMonth ? `${md(b.start, false)}–${+b.end.slice(8)}, ${b.end.slice(0, 4)}`
      : `${md(b.start, !sameYear)} – ${md(b.end, true)}`;
    return name + (b.partial ? ' (partial)' : '');
  });
}

// On hand at each end date: bought by then and not finished (last brew) by then. Grams count what's
// left (overview's `remaining` over doses logged by then). Archived bags with no brews have no
// finish date, so they're left out. A bag with no roast date counts as on hand from the start.
// ponytail: re-sums the logged doses per end, O(ends × brews); fine at prod size, sweep once if not.
export function backlogSeries(brews: readonly BrewFact[], bags: readonly BagFact[], ends: readonly string[], unit: Unit): number[] {
  const live = bags.filter((g) => g.status !== 'archive' || g.lastBrew !== null);
  return ends.map((d) => {
    const logged = loggedGrams(brews.filter((b) => b.localDate <= d));
    let sum = 0;
    for (const g of live) {
      if ((g.purchaseDate !== null && g.purchaseDate > d) || (isFinished(g) && g.lastBrew! <= d)) continue;
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
  // Average: each bucket's per-day rate (its own days, so a clipped bucket isn't understated).
  if (c.agg === 'average') bs.forEach((b, i) => { const n = daysBetween(b.start, b.end) + 1; brewed[i] /= n; bought[i] /= n; });
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

// The calendar day (local) in the period with the most grams brewed; a tie goes to the latest.
function busiestDay(brews: readonly BrewFact[], p: Period): Busiest | null {
  const days = new Map<string, Busiest>();
  for (const b of brews) {
    if (!inPeriod(b.localDate, p)) continue;
    const d = days.get(b.localDate) ?? { date: b.localDate, brews: 0, grams: 0 };
    d.brews++;
    d.grams += b.dose ?? 0;
    days.set(b.localDate, d);
  }
  let best: Busiest | null = null;
  for (const d of days.values()) if (!best || d.grams > best.grams || (d.grams === best.grams && d.date > best.date)) best = d;
  return best;
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
  // Average: the totals become per-day rates over the tracked span (0 when nothing is tracked).
  const rate = (v: { brewed: number; bought: number }, n: number) =>
    c.agg === 'average' ? { brewed: n ? v.brewed / n : 0, bought: n ? v.bought / n : 0 } : v;
  const raw = totals(brews, bags, c.period, c);
  const cur = rate(raw, span);
  const tiles: ConsumptionTiles = {
    ...cur, net: cur.bought - cur.brewed, avg: avgOf(raw.brewed, span, by),
    onHand: c.unit === 'grams' ? onHandG : bags.filter((g) => g.status !== 'archive').length,
    daysToClear: use.daysToClear
  };
  let deltas: ConsumptionTab['deltas'] = null;
  let compareBrewed: number[] | null = null;
  let compareAverage: number | null = null;
  let compareTitles: ConsumptionTab['compareTitles'] = null;
  let prevBusiest: string | null = null;
  if (c.prev) {
    const pt = trackedBounds(c.prev, c.dataStart, c.today);
    const pspan = spanOf(pt);
    const pb = buckets(pt, by);
    const praw = totals(brews, bags, c.prev, c);
    const p = rate(praw, pspan);
    // Per-day rates already compare like for like: no pace scaling.
    const pace = c.pace && c.agg === 'total';
    // ponytail: tileDelta gives no change from a base <= 0, so a shrinking pile (net < 0) has no Net delta.
    deltas = {
      brewed: paceDelta(tiles.brewed, p.brewed, span, pspan, pace),
      bought: paceDelta(tiles.bought, p.bought, span, pspan, pace),
      net: paceDelta(tiles.net, p.bought - p.brewed, span, pspan, pace),
      avg: paceDelta(tiles.avg, avgOf(praw.brewed, pspan, by), span, pspan, false)
    };
    prevBusiest = busiestDay(brews, c.prev)?.date ?? null;
    const pf = flows(brews, bags, pb, c);
    if (c.sameLength) {
      compareBrewed = pf.brewed;
      const names = bucketTitles(pb, by);
      compareTitles = bs.map((_, i) => names[i] ?? null);
    }
    else compareAverage = !pb.length ? null : c.agg === 'average' ? p.brewed : sum(pf.brewed) / pb.length;
  }
  return {
    by, tiles, clearBy: use.clearBy, busiest: busiestDay(brews, c.period), prevBusiest, deltas, buckets: bs, labels: bucketLabels(bs, by), brewed, bought,
    backlog: backlogSeries(brews, bags, bs.map((b) => b.end), c.unit), compareBrewed, compareTitles, compareAverage
  };
}
