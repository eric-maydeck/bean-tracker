import type { Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { inPeriod, daysBetween, type Period } from './time';
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

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const present = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

// Spend = bags bought (roast date) in the period; subscription deliveries are
// already logged as bags. Bags finished = archived bags whose last brew is in it.
// Brews per day divides by the period's days up to `today` (a calendar year
// still running isn't diluted by its future); all time starts at the first brew.
export function overviewTiles(
  brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, ratings: Ratings, today = p.end
): OverviewTiles {
  const inP = brews.filter((b) => inPeriod(b.localDate, p));
  const rated = inP.filter((b) => countsForRating(b, ratings)).map((b) => b.rating!);
  const first = p.start ?? inP.reduce((m, b) => (b.localDate < m ? b.localDate : m), p.end);
  const last = today < p.end ? today : p.end;
  return {
    brews: inP.length,
    grams: inP.reduce((s, b) => s + (b.dose ?? 0), 0),
    spend: bags.reduce((s, g) => s + (g.purchaseDate && inPeriod(g.purchaseDate, p) ? (g.cost ?? 0) : 0), 0),
    avgRating: mean(rated),
    rated: rated.length,
    bagsFinished: bags.filter((g) => g.status === 'archive' && g.lastBrew !== null && inPeriod(g.lastBrew, p)).length,
    costPerBrew: mean(present(inP.map((b) => b.costPerBrew))),
    brewsPerDay: inP.length ? inP.length / (daysBetween(first, last) + 1) : null,
    avgDose: mean(inP.flatMap((b) => (b.dose ? [b.dose] : []))),
    // Negative rest = a brew logged before its bag's roast date: missing, like dose 0.
    avgRestDays: mean(inP.flatMap((b) => (b.restDays !== null && b.restDays >= 0 ? [b.restDays] : []))),
    avgBrewTime: mean(present(inP.map((b) => b.brewTimeSeconds)))
  };
}

export type Delta = { abs: number; pct: number } | null;

// No change without a previous value to compare to (a % from 0 or below is meaningless).
export function tileDelta(cur: number | null, prev: number | null): Delta {
  if (cur === null || prev === null || prev <= 0) return null;
  return { abs: cur - prev, pct: ((cur - prev) / prev) * 100 };
}

export function compareTiles(cur: OverviewTiles, prev: OverviewTiles): Record<keyof OverviewTiles, Delta> {
  const keys = Object.keys(cur) as (keyof OverviewTiles)[];
  return Object.fromEntries(keys.map((k) => [k, tileDelta(cur[k], prev[k])])) as Record<keyof OverviewTiles, Delta>;
}
