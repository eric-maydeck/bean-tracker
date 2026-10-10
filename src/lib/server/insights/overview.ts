import type { Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { inPeriod, type Period } from './time';
import { countsForRating } from './ratings';

export interface OverviewTiles {
  brews: number;
  grams: number;
  spend: number;
  avgRating: number | null;
  rated: number;
  bagsFinished: number;
  costPerBrew: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Spend = bags bought (roast date) in the period; subscription deliveries are
// already logged as bags. Bags finished = archived bags whose last brew is in it.
export function overviewTiles(brews: readonly BrewFact[], bags: readonly BagFact[], p: Period, ratings: Ratings): OverviewTiles {
  const inP = brews.filter((b) => inPeriod(b.localDate, p));
  const rated = inP.filter((b) => countsForRating(b, ratings)).map((b) => b.rating!);
  return {
    brews: inP.length,
    grams: inP.reduce((s, b) => s + (b.dose ?? 0), 0),
    spend: bags.reduce((s, g) => s + (g.purchaseDate && inPeriod(g.purchaseDate, p) ? (g.cost ?? 0) : 0), 0),
    avgRating: mean(rated),
    rated: rated.length,
    bagsFinished: bags.filter((g) => g.status === 'archive' && g.lastBrew !== null && inPeriod(g.lastBrew, p)).length,
    costPerBrew: mean(inP.flatMap((b) => (b.costPerBrew === null ? [] : [b.costPerBrew])))
  };
}

export type Delta = { abs: number; pct: number } | null;

// No change without a previous value to compare to (a % from 0 is undefined).
export function tileDelta(cur: number | null, prev: number | null): Delta {
  if (cur === null || prev === null || prev === 0) return null;
  return { abs: cur - prev, pct: ((cur - prev) / prev) * 100 };
}

export function compareTiles(cur: OverviewTiles, prev: OverviewTiles): Record<keyof OverviewTiles, Delta> {
  const keys = Object.keys(cur) as (keyof OverviewTiles)[];
  return Object.fromEntries(keys.map((k) => [k, tileDelta(cur[k], prev[k])])) as Record<keyof OverviewTiles, Delta>;
}
