import type { By, Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { inPeriod, trackedDays, type Period } from './time';
import { compareTiles, type Delta } from './overview';

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

export interface SpendTab {
  tiles: SpendTiles; free: number;
  deltas: Partial<Record<keyof SpendTiles, Delta>> | null; scaled: boolean;
}

// `scored`/`whole` are for the panels later tasks add.
export function spendTab(_scored: readonly BrewFact[], _whole: readonly BrewFact[], bags: readonly BagFact[], c: SpendCtx): SpendTab {
  const { free, ...tiles } = spendTiles(bags, c.plans, c.period, c.size);
  const cmp = c.prev && compareTiles(
    tiles, spendTiles(bags, c.plans, c.prev, c.size),
    trackedDays(c.period, c.dataStart, c.today), trackedDays(c.prev, c.dataStart, c.today), c.pace, SPEND_KIND
  );
  // Plans are current-state: no delta.
  const { plansPerMonth: _now, ...deltas } = cmp?.deltas ?? ({} as Record<keyof SpendTiles, Delta>);
  return { tiles, free, deltas: cmp ? deltas : null, scaled: cmp ? cmp.scaled : false };
}
