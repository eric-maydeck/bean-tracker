import type { Agg, By, Ratings, Trend, Unit } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { addDays, addMonths, autoBy, daysBetween, inPeriod, trackedBounds, weekday, type Period } from './time';
import { countsForRating, RATINGS_SETTLED_FROM } from './ratings';
import { consumption, gramsOnHand, isFinished, loggedGrams, paceDelta, remaining, type Delta } from './overview';

export interface Bucket { start: string; end: string; partial: boolean }
export type ConsumptionTiles = {
  brewed: number; bought: number; net: number; avg: number | null; onHand: number; daysToClear: number | null;
};
export interface Busiest { date: string; brews: number; grams: number }
export interface ConsumptionTab {
  by: By; // effective (explicit or auto)
  tiles: ConsumptionTiles; clearBy: string | null;
  busiest: Busiest | null; prevBusiest: Busiest | null; // Avg per day's 4th tile: the day with the most grams (household)
  deltas: { brewed: Delta; bought: Delta; net: Delta; avg: Delta } | null;
  // `brewed` is the Brewed over time measure (c.trend, else the Unit): a rating mean is null for a bucket with none.
  // `ratingFrom`: Calibrated ratings start at the first bucket reaching the calibration date (0 otherwise).
  ratingFrom: number;
  trendLine: number[] | null; trendLabel: string | null; // the rolling average of `brewed` over TREND_WINDOW[by] buckets ("7-day average"); null for a rating
  buckets: Bucket[]; labels: string[]; brewed: (number | null)[]; bought: number[]; backlog: number[];
  compareBrewed: (number | null)[] | null; // same-length compare: bucket for bucket
  compareTitles: (string | null)[] | null; // the compare bars' real dates, bucket for bucket with `brewed`
  compareAverage: number | null; // longer/custom compare: its per-bucket average (dashed line)
}
export interface ConsumptionCtx {
  period: Period; prev: Period | null; sameLength: boolean; unit: Unit; agg: Agg; by: By | undefined; size: number;
  // Brewed over time's measure (absent = the Unit). Rating reads `scored` (Once dialed) under `ratings`.
  trend?: Trend; scored?: readonly BrewFact[]; ratings?: Ratings;
  dataStart: string | null; today: string; pace: boolean;
  // Brews before the brew filters: on hand, time to clear, Net and the backlog are about whole bags. Default: `brews`.
  whole?: readonly BrewFact[];
}

// The trend line's rolling-average window, in buckets: a week of days, a month of weeks, a quarter of months.
export const TREND_WINDOW: Record<By, number> = { day: 7, week: 4, month: 3 };
export const PER: Record<By, number> = { day: 1, week: 7, month: 30.44 };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const brewDaysIn = (brews: readonly BrewFact[], p: Period) => new Set(brews.filter((b) => inPeriod(b.localDate, p)).map((b) => b.localDate)).size;

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

// Trailing mean over the last `n` buckets (fewer at the start). Not for a rating line (a mean of means).
export const rolling = (vs: readonly (number | null)[], n: number): number[] =>
  vs.map((_, i) => { const w = vs.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v !== null); return sum(w) / (w.length || 1); });

// The Show denominator: days (Average), brew days (Per brew day: days with 1+ brew) or none (Total).
const denom = (agg: Agg, days: number, brewDays: number) => (agg === 'average' ? days : agg === 'brewday' ? brewDays : 1);

// Mean counted rating per bucket (null with none): Show doesn't apply to a mean.
const ratingSeries = (brews: readonly BrewFact[], bs: readonly Bucket[], ratings: Ratings): (number | null)[] =>
  bs.map((b) => {
    const r = brews.filter((x) => x.localDate >= b.start && x.localDate <= b.end && countsForRating(x, ratings)).map((x) => x.rating!);
    return r.length ? sum(r) / r.length : null;
  });

// Brewed and bought per bucket (÷ size): grams of doses / of bags bought, or bags finished / bought. A trend measure
// replaces `brewed` with brews or litres of water (÷ size) or the mean rating; `bought` keeps the Unit.
// ponytail: findIndex per item is O(items × buckets); fine at ~1,600 × 366, bisect if it ever isn't.
function flows(brews: readonly BrewFact[], bags: readonly BagFact[], bs: readonly Bucket[], c: ConsumptionCtx) {
  const brewed: (number | null)[] = bs.map(() => 0);
  const bought = bs.map(() => 0);
  const brewDays = bs.map(() => new Set<string>());
  const at = (d: string | null) => (d === null ? -1 : bs.findIndex((b) => d >= b.start && d <= b.end));
  const m = c.trend && c.trend !== 'rating' ? c.trend : c.unit;
  const weight = (b: BrewFact) => (m === 'brews' ? 1 : m === 'water' ? (b.waterG ?? 0) / 1000 : m === 'grams' ? (b.dose ?? 0) : 0);
  for (const b of brews) {
    const i = at(b.localDate);
    if (i < 0) continue;
    brewDays[i].add(b.localDate);
    brewed[i]! += weight(b) / c.size;
  }
  if (m === 'bags') for (const g of bags) { const i = isFinished(g) ? at(g.lastBrew) : -1; if (i >= 0) brewed[i]! += 1 / c.size; }
  for (const g of bags) { const i = at(g.purchaseDate); if (i >= 0) bought[i] += (c.unit === 'grams' ? (g.amountG ?? 0) : 1) / c.size; }
  bs.forEach((b, i) => {
    const n = denom(c.agg, daysBetween(b.start, b.end) + 1, Math.max(1, brewDays[i].size));
    brewed[i]! /= n; bought[i] /= n;
  });
  return { brewed: c.trend === 'rating' ? ratingSeries(c.scored ?? brews, bs, c.ratings ?? 'current') : brewed, bought };
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

const spanOf = (t: { start: string; end: string } | null) => (t ? daysBetween(t.start, t.end) + 1 : 0);
const avgOf = (brewed: number, span: number, by: By) => (span && brewed ? (brewed / span) * PER[by] : null);

export function consumptionTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: ConsumptionCtx): ConsumptionTab {
  const t = trackedBounds(c.period, c.dataStart, c.today);
  const span = spanOf(t);
  const by = c.by ?? autoBy(span);
  const bs = buckets(t, by);
  const { brewed, bought } = flows(brews, bags, bs, c);
  const whole = c.whole ?? brews;
  const onHandG = gramsOnHand(bags, whole);
  const use = consumption(whole, c.period, c.dataStart, c.today, onHandG, c.size);
  // Average / Per brew day: the totals become rates over the tracked span / the brew days (0 when there are none).
  const rate = (v: { brewed: number; bought: number }, span: number, p: Period) => {
    const n = c.agg === 'total' ? 1 : denom(c.agg, span, brewDaysIn(brews, p));
    return c.agg === 'total' ? v : { brewed: n ? v.brewed / n : 0, bought: n ? v.bought / n : 0 };
  };
  const raw = totals(brews, bags, c.period, c);
  const cur = rate(raw, span, c.period);
  const tiles: ConsumptionTiles = {
    ...cur, net: cur.bought - rate(totals(whole, bags, c.period, c), span, c.period).brewed, avg: avgOf(raw.brewed, span, by),
    onHand: c.unit === 'grams' ? onHandG : bags.filter((g) => g.status !== 'archive').length,
    daysToClear: use.daysToClear
  };
  let deltas: ConsumptionTab['deltas'] = null;
  let compareBrewed: (number | null)[] | null = null;
  let compareAverage: number | null = null;
  let compareTitles: ConsumptionTab['compareTitles'] = null;
  let prevBusiest: Busiest | null = null;
  if (c.prev) {
    const pt = trackedBounds(c.prev, c.dataStart, c.today);
    const pspan = spanOf(pt);
    const pb = buckets(pt, by);
    const praw = totals(brews, bags, c.prev, c);
    const p = rate(praw, pspan, c.prev);
    // Per-day rates already compare like for like: no pace scaling.
    const pace = c.pace && c.agg === 'total';
    // ponytail: tileDelta gives no change from a base <= 0, so a shrinking pile (net < 0) has no Net delta.
    deltas = {
      brewed: paceDelta(tiles.brewed, p.brewed, span, pspan, pace),
      bought: paceDelta(tiles.bought, p.bought, span, pspan, pace),
      net: paceDelta(tiles.net, p.bought - rate(totals(whole, bags, c.prev, c), pspan, c.prev).brewed, span, pspan, pace),
      avg: paceDelta(tiles.avg, avgOf(praw.brewed, pspan, by), span, pspan, false)
    };
    prevBusiest = busiestDay(brews, c.prev);
    const pf = flows(brews, bags, pb, c);
    if (c.sameLength) {
      compareBrewed = pf.brewed;
      const names = bucketTitles(pb, by);
      compareTitles = bs.map((_, i) => names[i] ?? null);
    }
    else {
      const seen = pf.brewed.filter((v): v is number => v !== null);
      compareAverage = !pb.length || !seen.length ? null : c.trend ? sum(seen) / seen.length : c.agg === 'total' ? sum(seen) / pb.length : p.brewed;
    }
  }
  // Calibrated ratings start at the first bucket reaching the calibration date (Leaderboards' Over time does the same).
  const calibrated = c.trend === 'rating' && c.ratings !== 'all' ? bs.findIndex((b) => b.end >= RATINGS_SETTLED_FROM) : 0;
  const ratingFrom = calibrated < 0 ? bs.length : calibrated;
  return {
    by, tiles, trendLine: c.trend === 'rating' ? null : rolling(brewed, TREND_WINDOW[by]),
    trendLabel: c.trend === 'rating' ? null : `${TREND_WINDOW[by]}-${by} average`, clearBy: use.clearBy, busiest: busiestDay(brews, c.period), prevBusiest, deltas, ratingFrom, buckets: bs, labels: bucketLabels(bs, by), brewed, bought,
    backlog: backlogSeries(whole, bags, bs.map((b) => b.end), c.unit), compareBrewed, compareTitles, compareAverage
  };
}
