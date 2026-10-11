import type { Measure, Ratings } from '$lib/insightsUrl';
import type { BrewFact } from './facts';
import { addDays, inPeriod, trackedBounds, weekday, type Period } from './time';
import { countsForRating } from './ratings';
import { tileDelta, type Delta } from './overview';

export type HabitTiles = {
  activeDays: number | null; // fraction 0–1 of tracked days with a brew
  brewDays: number;
  trackedDays: number;
  currentStreak: number;
  longestStreak: number;
  brewsPerBrewDay: number | null;
  peakHour: number | null;
  busiestWeekday: number | null;
};
export interface Habits {
  tiles: HabitTiles;
  deltas: { activeDays: Delta; longestStreak: Delta; brewsPerBrewDay: Delta } | null;
  prevPeak: { hour: number | null; weekday: number | null } | null;
  streakAtEnd: boolean; // the period ends before today: "Streak at period end"
  longestFrom: string | null; // kept out of tiles: tile values are numbers
  longestTo: string | null;
  byHour: (number | null)[]; // 24
  byWeekday: (number | null)[]; // 7
  compareHour: (number | null)[] | null;
  compareWeekday: (number | null)[] | null;
  heatmap: (number | null)[][]; // [weekday 0–6][hour 0–23]
  calendar: { date: string; value: number | null }[]; // every tracked day
  backfilledLeftOut: number;
}
export interface HabitsCtx {
  period: Period;
  prev: Period | null;
  measure: Measure;
  ratings: Ratings;
  size: number;
  dataStart: string | null;
  today: string;
  pace: boolean;
}

export const PEAK_MIN_RATED = 5; // a rating peak needs this many ratings in its bucket
export const CELL_MIN_RATED = 3; // a rating heatmap cell needs this many

const hourOf = (b: BrewFact) => Number(b.localTime.slice(11, 13));

export function currentStreak(days: ReadonlySet<string>, end: string, today: string): number {
  let d = end === today && !days.has(end) ? addDays(end, -1) : end; // today isn't over yet
  let n = 0;
  for (; days.has(d); d = addDays(d, -1)) n++;
  return n;
}

export function longestStreak(sortedDays: readonly string[]): { length: number; from: string | null; to: string | null } {
  let best = { length: 0, from: null as string | null, to: null as string | null };
  let start = 0; // index where the current run began
  sortedDays.forEach((d, i) => {
    if (i > 0 && addDays(sortedDays[i - 1], 1) !== d) start = i;
    if (i - start + 1 > best.length) best = { length: i - start + 1, from: sortedDays[start], to: d };
  });
  return best;
}

// One bucket's value under the measure: count or grams (÷ size), or the mean of counted
// ratings (null under `minRated`).
function value(bs: readonly BrewFact[], c: HabitsCtx, minRated = 1): number | null {
  if (c.measure === 'brews') return bs.length / c.size;
  if (c.measure === 'grams') return bs.reduce((s, b) => s + (b.dose ?? 0), 0) / c.size;
  const r = bs.filter((b) => countsForRating(b, c.ratings)).map((b) => b.rating!);
  return r.length >= minRated ? r.reduce((a, b) => a + b, 0) / r.length : null;
}

const group = (bs: readonly BrewFact[], n: number, key: (b: BrewFact) => number): BrewFact[][] => {
  const g: BrewFact[][] = Array.from({ length: n }, () => []);
  for (const b of bs) g[key(b)].push(b);
  return g;
};

// Index of the tallest bar (earliest on ties); a rating bar needs PEAK_MIN_RATED ratings.
function peak(values: readonly (number | null)[], groups: readonly BrewFact[][], c: HabitsCtx): number | null {
  let at: number | null = null;
  let top = 0;
  values.forEach((v, i) => {
    if (v === null || v <= top) return;
    if (c.measure === 'rating' && groups[i].filter((b) => countsForRating(b, c.ratings)).length < PEAK_MIN_RATED) return;
    [at, top] = [i, v];
  });
  return at;
}

function windowStats(brews: readonly BrewFact[], p: Period, c: HabitsCtx) {
  const inP = brews.filter((b) => inPeriod(b.localDate, p));
  const t = trackedBounds(p, c.dataStart, c.today);
  const tracked: string[] = [];
  for (let d = t?.start; t && d! <= t.end; d = addDays(d!, 1)) tracked.push(d!);
  const occurrences = Array(7).fill(0);
  for (const d of tracked) occurrences[weekday(d)]++;
  const timed = inP.filter((b) => !b.backfilled);
  const hours = group(timed, 24, hourOf);
  const days = group(inP, 7, (b) => weekday(b.localDate));
  const byHour = hours.map((g) => value(g, c));
  // Brews and grams per occurrence of the weekday ("avg per Monday"); rating is a plain mean.
  const byWeekday = days.map((g, i) => {
    if (!occurrences[i]) return null;
    const v = value(g, c);
    return v === null || c.measure === 'rating' ? v : v / occurrences[i];
  });
  const brewDays = [...new Set(inP.map((b) => b.localDate))].sort();
  return {
    inP, timed, tracked, byHour, byWeekday, brewDays,
    activeDays: tracked.length ? brewDays.length / tracked.length : null,
    brewsPerBrewDay: brewDays.length ? inP.length / brewDays.length / c.size : null,
    peakHour: peak(byHour, hours, c), busiestWeekday: peak(byWeekday, days, c)
  };
}

export function habits(brews: readonly BrewFact[], c: HabitsCtx): Habits {
  const w = windowStats(brews, c.period, c);
  const all = new Set(brews.map((b) => b.localDate));
  const end = c.today < c.period.end ? c.today : c.period.end;
  const long = longestStreak(w.brewDays);
  const tiles: HabitTiles = {
    activeDays: w.activeDays,
    brewDays: w.brewDays.length,
    trackedDays: w.tracked.length,
    currentStreak: currentStreak(all, end, c.today),
    longestStreak: long.length,
    brewsPerBrewDay: w.brewsPerBrewDay,
    peakHour: w.peakHour,
    busiestWeekday: w.busiestWeekday
  };
  const byDay = new Map<string, BrewFact[]>();
  for (const b of w.inP) byDay.set(b.localDate, [...(byDay.get(b.localDate) ?? []), b]);
  let deltas: Habits['deltas'] = null;
  let prevPeak: Habits['prevPeak'] = null;
  let compareHour: Habits['compareHour'] = null;
  let compareWeekday: Habits['compareWeekday'] = null;
  if (c.prev) {
    const v = windowStats(brews, c.prev, c);
    deltas = {
      activeDays: tileDelta(w.activeDays, v.activeDays),
      longestStreak: tileDelta(long.length, longestStreak(v.brewDays).length),
      brewsPerBrewDay: tileDelta(w.brewsPerBrewDay, v.brewsPerBrewDay)
    };
    prevPeak = { hour: v.peakHour, weekday: v.busiestWeekday };
    // Hour totals pace to this window's tracked days when the lengths differ (the compareTiles rule).
    const k = c.pace && v.tracked.length && v.tracked.length !== w.tracked.length ? w.tracked.length / v.tracked.length : 1;
    compareHour = v.byHour.map((x) => (x === null || c.measure === 'rating' ? x : x * k));
    compareWeekday = v.byWeekday;
  }
  return {
    tiles, deltas, prevPeak,
    streakAtEnd: c.period.end < c.today,
    longestFrom: long.from, longestTo: long.to,
    byHour: w.byHour, byWeekday: w.byWeekday, compareHour, compareWeekday,
    // ponytail: filters w.timed once per cell (168 passes); group by weekday * 24 + hour if it ever shows
    heatmap: Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) =>
        value(w.timed.filter((b) => weekday(b.localDate) === d && hourOf(b) === h), c, c.measure === 'rating' ? CELL_MIN_RATED : 1))
    ),
    calendar: w.tracked.map((date) => ({ date, value: value(byDay.get(date) ?? [], c) })),
    backfilledLeftOut: w.inP.length - w.timed.length
  };
}
