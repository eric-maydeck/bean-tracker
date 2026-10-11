import type { Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { inPeriod, trackedDays, addDays, type Period } from './time';
import { countsForRating } from './ratings';

export interface OverviewTiles {
  brews: number;
  grams: number;
  spend: number;
  avgRating: number | null;
  rated: number;
  bagsFinished: number;
  costPerBrew: number | null;
  brewsPerDay: number | null;
  avgDose: number | null; // g
  avgRestDays: number | null;
  avgBrewTime: number | null; // seconds
}

// A total sums over the period; an average doesn't grow with its length.
export const TILE_KIND: Record<keyof OverviewTiles, 'total' | 'average'> = {
  brews: 'total',
  grams: 'total',
  spend: 'total',
  bagsFinished: 'total',
  rated: 'total',
  avgRating: 'average',
  costPerBrew: 'average',
  brewsPerDay: 'average',
  avgDose: 'average',
  avgRestDays: 'average',
  avgBrewTime: 'average'
};

// Per person: totals and brews per day ÷ household size, an even split (Bean Conqueror
// doesn't record who brewed). Averages don't change. Applied before compareTiles, so
// deltas, % and "vs N at that pace" read per person too.
export function perPerson(t: OverviewTiles, size: number): OverviewTiles {
  if (size === 1) return t;
  const out: Record<string, number | null> = { ...t };
  for (const k of Object.keys(t) as (keyof OverviewTiles)[]) {
    if ((TILE_KIND[k] === 'total' || k === 'brewsPerDay') && t[k] !== null) out[k] = t[k]! / size;
  }
  return out as unknown as OverviewTiles;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const present = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

// Spend = bags bought (roast date) in the period; subscription deliveries are
// already logged as bags. Bags finished = archived bags whose last brew is in it.
// Brews per day divides by the period's tracked days (trackedDays: from the first
// brew ever, `dataStart`, up to `today`), so neither the time before tracking nor a
// calendar year's future dilutes it.
export function overviewTiles(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, ratings: Ratings, today = p.end,
  dataStart: string | null = null
): OverviewTiles {
  const inP = brews.filter((b) => inPeriod(b.localDate, p));
  const rated = inP.filter((b) => countsForRating(b, ratings)).map((b) => b.rating!);
  const days = trackedDays(p, dataStart, today);
  return {
    brews: inP.length,
    grams: inP.reduce((s, b) => s + (b.dose ?? 0), 0),
    spend: bags.reduce((s, g) => s + (g.purchaseDate && inPeriod(g.purchaseDate, p) ? (g.cost ?? 0) : 0), 0),
    avgRating: mean(rated),
    rated: rated.length,
    bagsFinished: bags.filter((g) => g.status === 'archive' && g.lastBrew !== null && inPeriod(g.lastBrew, p)).length,
    costPerBrew: mean(present(inP.map((b) => b.costPerBrew))),
    brewsPerDay: inP.length && days ? inP.length / days : null,
    avgDose: mean(inP.flatMap((b) => (b.dose ? [b.dose] : []))),
    // Negative rest = a brew logged before its bag's roast date: missing, like dose 0.
    avgRestDays: mean(inP.flatMap((b) => (b.restDays !== null && b.restDays >= 0 ? [b.restDays] : []))),
    avgBrewTime: mean(present(inP.map((b) => b.brewTimeSeconds)))
  };
}

export type Delta = { abs: number; pct: number; base: number } | null;

// No change without a previous value to compare to (a % from 0 or below is meaningless).
// `base` is the value the change is measured against.
export function tileDelta(cur: number | null, prev: number | null): Delta {
  if (cur === null || prev === null || prev <= 0) return null;
  return { abs: cur - prev, pct: ((cur - prev) / prev) * 100, base: prev };
}

// Windows of different tracked lengths (trackedDays): a total's baseline becomes its
// pace over the period's days, total × curDays / prevDays; averages compare as they are.
// `pace` false compares totals raw regardless (same-length windows that are fully tracked).
export function compareTiles(
  cur: OverviewTiles, prev: OverviewTiles, curDays: number, prevDays: number, pace = true
): { deltas: Record<keyof OverviewTiles, Delta>; scaled: boolean } {
  const scaled = pace && curDays !== prevDays;
  const base = (k: keyof OverviewTiles) =>
    !scaled || TILE_KIND[k] === 'average' ? prev[k] : prevDays ? ((prev[k] ?? 0) * curDays) / prevDays : null;
  const keys = Object.keys(cur) as (keyof OverviewTiles)[];
  const deltas = Object.fromEntries(keys.map((k) => [k, tileDelta(cur[k], base(k))]));
  return { deltas: deltas as Record<keyof OverviewTiles, Delta>, scaled };
}

export interface Consumption {
  perDay: number | null; // g
  perWeek: number | null;
  perMonth: number | null;
  daysToClear: number | null;
  clearBy: string | null; // 'YYYY-MM-DD'
}

// Grams on hand: the open and backlog bags (what /stats has always counted).
export const gramsOnHand = (bags: readonly BagFact[]): number =>
  bags.reduce((g, b) => g + (b.status === 'archive' ? 0 : (b.amountG ?? 0)), 0);

// Measured rate: grams brewed in `p` over its tracked days (the brews-per-day rule), ÷ size
// per person. Time to clear: on hand ÷ that rate, rounded up (multiplied out first, so an
// exact multiple doesn't gain a day from float error), plus the clear-by date.
export function consumption(
  brews: readonly BrewFact[], p: Period, dataStart: string | null, today: string, onHandG: number, size = 1
): Consumption {
  const grams = brews.reduce((g, b) => g + (inPeriod(b.localDate, p) ? (b.dose ?? 0) : 0), 0);
  const days = trackedDays(p, dataStart, today);
  const perDay = grams > 0 && days > 0 ? grams / days / size : null;
  const daysToClear = perDay !== null && onHandG > 0 ? Math.ceil((onHandG * days * size) / grams) : null;
  return {
    perDay,
    perWeek: perDay === null ? null : perDay * 7,
    perMonth: perDay === null ? null : perDay * 30.44,
    daysToClear,
    clearBy: daysToClear === null ? null : addDays(today, daysToClear)
  };
}
