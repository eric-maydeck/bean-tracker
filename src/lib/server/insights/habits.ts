import type { Agg, Measure, Ratings } from '$lib/insightsUrl';
import type { BrewFact } from './facts';
import { addDays, inPeriod, trackedBounds, weekday, type Period } from './time';
import { countsForRating } from './ratings';
import { pooled, type Sample } from '$lib/sample';
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
  prevActive: { brewDays: number; trackedDays: number } | null; // the count behind the previous Active days ratio
  busiestAvg: number | null; // the busiest weekday's byWeekday value: per occurrence of it, or its mean rating
  streakAtEnd: boolean; // the period ends before today: "Streak at period end"
  longestFrom: string | null; // kept out of tiles: tile values are numbers
  longestTo: string | null;
  byHour: (number | null)[]; // 24
  byWeekday: (number | null)[]; // 7
  bySampleHour: Sample[] | null; // rating measure: the sample behind each hour / weekday bar
  bySampleWeekday: Sample[] | null;
  compareHour: (number | null)[] | null;
  compareWeekday: (number | null)[] | null;
  heatmap: (number | null)[][]; // [weekday 0–6][hour 0–23]
  heatSample: Sample[][] | null; // rating measure: each cell's sample (small ones are marked)
  calendar: { date: string; value: number | null }[]; // every tracked day
  backfilledLeftOut: number;
}
export interface HabitsCtx {
  period: Period;
  prev: Period | null;
  measure: Measure;
  ratings: Ratings;
  agg: Agg; // Avg per day (hour, heatmap) or Total; rating is a mean either way
  size: number;
  dataStart: string | null;
  today: string;
  pace: boolean;
}

// A bucket's counted ratings as a pooled sample (sample.ts): a rating peak needs one that isn't small,
// and the rating heatmap mutes small cells instead of hiding them.
const sampleOf = (bs: readonly BrewFact[], c: HabitsCtx) => {
  const r = bs.filter((b) => countsForRating(b, c.ratings));
  return pooled(new Set(r.flatMap((b) => (b.coffeeId === null ? [] : [b.coffeeId]))).size, r.length);
};

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
// ratings (null when there are none).
function value(bs: readonly BrewFact[], c: HabitsCtx): number | null {
  if (c.measure === 'brews') return bs.length / c.size;
  if (c.measure === 'grams') return bs.reduce((s, b) => s + (b.dose ?? 0), 0) / c.size;
  const r = bs.filter((b) => countsForRating(b, c.ratings)).map((b) => b.rating!);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
}

const group = (bs: readonly BrewFact[], n: number, key: (b: BrewFact) => number): BrewFact[][] => {
  const g: BrewFact[][] = Array.from({ length: n }, () => []);
  for (const b of bs) g[key(b)].push(b);
  return g;
};

// Index of the tallest bar (earliest on ties); a rating bar needs a sample that isn't small.
function peak(values: readonly (number | null)[], groups: readonly BrewFact[][], c: HabitsCtx): number | null {
  let at: number | null = null;
  let top = 0;
  values.forEach((v, i) => {
    if (v === null || v <= top) return;
    if (c.measure === 'rating' && sampleOf(groups[i], c).small) return;
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
  // Avg per day: brews and grams per tracked day (hours) / per occurrence of the weekday (weekdays,
  // heatmap). Per brew day: the same over the days with a brew (all of them / those on the weekday).
  // Rating is a plain mean, so the choice doesn't touch it.
  const perDay = c.agg !== 'total' && c.measure !== 'rating';
  const brewDays = [...new Set(inP.map((b) => b.localDate))].sort();
  const brewOccurrences = Array(7).fill(0);
  for (const d of brewDays) brewOccurrences[weekday(d)]++;
  const perBrewDay = c.agg === 'brewday';
  // The weekday divisors (also the heatmap's rows) and the one the hours share.
  const divisors: number[] = perBrewDay ? brewOccurrences : occurrences;
  const byHour = hours.map((g) => {
    const v = value(g, c);
    return perDay && v !== null ? v / ((perBrewDay ? brewDays.length : tracked.length) || 1) : v;
  });
  // The tiles always read the per-occurrence weekday values (the Show choice only changes the chart).
  const weekdayAvg = days.map((g, i) => {
    if (!occurrences[i]) return null;
    const v = value(g, c);
    return v === null || c.measure === 'rating' ? v : v / occurrences[i];
  });
  const byWeekday = perBrewDay && c.measure !== 'rating'
    ? days.map((g, i) => { const v = value(g, c); return v !== null && divisors[i] ? v / divisors[i] : v; })
    : perDay || c.measure === 'rating' ? weekdayAvg : days.map((g, i) => (occurrences[i] ? value(g, c) : null));
  return {
    inP, timed, tracked, hours, days, byHour, byWeekday, weekdayAvg, occurrences, divisors, perDay, brewDays,
    activeDays: tracked.length ? brewDays.length / tracked.length : null,
    brewsPerBrewDay: brewDays.length ? inP.length / brewDays.length / c.size : null,
    peakHour: peak(byHour, hours, c), busiestWeekday: peak(weekdayAvg, days, c)
  };
}

// A heatmap cell per occurrence of its weekday under Avg per day (per brew day on it under Per brew day).
const cell = (v: number | null, w: { perDay: boolean; divisors: number[] }, d: number) =>
  v !== null && w.perDay && w.divisors[d] ? v / w.divisors[d] : v;

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
  let prevActive: Habits['prevActive'] = null;
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
    prevActive = { brewDays: v.brewDays.length, trackedDays: v.tracked.length };
    // Hour totals pace to this window's tracked days when the lengths differ (the compareTiles rule).
    const k = !v.perDay && c.pace && v.tracked.length && v.tracked.length !== w.tracked.length ? w.tracked.length / v.tracked.length : 1;
    compareHour = v.byHour.map((x) => (x === null || c.measure === 'rating' ? x : x * k));
    compareWeekday = v.byWeekday.map((x) => (x === null || c.measure === 'rating' ? x : x * k));
  }
  return {
    tiles, deltas, prevPeak, prevActive,
    busiestAvg: w.busiestWeekday === null ? null : w.weekdayAvg[w.busiestWeekday],
    streakAtEnd: c.period.end < c.today,
    longestFrom: long.from, longestTo: long.to,
    byHour: w.byHour, byWeekday: w.byWeekday,
    bySampleHour: c.measure === 'rating' ? w.hours.map((g) => sampleOf(g, c)) : null,
    bySampleWeekday: c.measure === 'rating' ? w.days.map((g) => sampleOf(g, c)) : null,
    compareHour, compareWeekday,
    // ponytail: filters w.timed once per cell (168 passes); group by weekday * 24 + hour if it ever shows
    heatmap: Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) =>
        cell(value(w.timed.filter((b) => weekday(b.localDate) === d && hourOf(b) === h), c), w, d))
    ),
    heatSample: c.measure === 'rating' ? Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => sampleOf(w.timed.filter((b) => weekday(b.localDate) === d && hourOf(b) === h), c))) : null,
    calendar: w.tracked.map((date) => ({ date, value: value(byDay.get(date) ?? [], c) })),
    backfilledLeftOut: w.inP.length - w.timed.length
  };
}
