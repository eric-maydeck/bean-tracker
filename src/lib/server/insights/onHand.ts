import { computeDrinkAfter, computeUrgencyRating, diffDays, parseDate, type UrgencyInput } from '../urgency';
import { remaining } from './overview';
import type { BagFact } from './facts';

export interface FreshBag extends UrgencyInput { name: string; roaster: string; slug: string | null; grams: number }
export interface FreshGroup { count: number; grams: number; bags: { name: string; roaster: string; slug: string | null }[] }
export interface Freshness {
  ready: FreshGroup; drinkSoon: FreshGroup; resting: FreshGroup; frozen: FreshGroup;
  nextReadyInDays: number | null; unknown: number;
}

// Ready bags with an urgency rating of at least this are "Drink soon".
export const DRINK_SOON_URGENCY = 40;

export const freshBag = (b: BagFact, logged: Map<number, number>): FreshBag => ({
  roast_date: b.purchaseDate, frozen_start_date: b.frozenStart ?? null, frozen_end_date: b.frozenEnd ?? null,
  rest_days_low: b.restLow ?? null, rest_days_high: b.restHigh ?? null, drank: 0,
  name: b.name, roaster: b.roaster, slug: b.slug, grams: remaining(b, logged)
});

// Open and backlog bags by where they sit in their rest window, in disjoint groups: an open freeze is only frozen, a
// ready bag with urgency 40+ is Drink soon (not Ready), and a bag without a roast date or window is counted nowhere.
export function freshness(bags: readonly FreshBag[], today: string): Freshness {
  const t = parseDate(today);
  const group = (): FreshGroup => ({ count: 0, grams: 0, bags: [] });
  const f: Freshness = { ready: group(), drinkSoon: group(), resting: group(), frozen: group(), nextReadyInDays: null, unknown: 0 };
  const add = (g: FreshGroup, b: FreshBag) => { g.count++; g.grams += b.grams; g.bags.push({ name: b.name, roaster: b.roaster, slug: b.slug }); };
  for (const b of [...bags].sort((x, y) => (x.roast_date ?? '').localeCompare(y.roast_date ?? ''))) {
    if (b.frozen_start_date && !b.frozen_end_date) { add(f.frozen, b); continue; }
    if (!b.roast_date || b.rest_days_low == null || b.rest_days_high == null) { f.unknown++; continue; }
    const until = diffDays(parseDate(computeDrinkAfter(b, t)!), t);
    if (until > 0) { add(f.resting, b); f.nextReadyInDays = Math.min(f.nextReadyInDays ?? Infinity, until); continue; }
    const u = computeUrgencyRating(b, t);
    add(typeof u === 'number' && u >= DRINK_SOON_URGENCY ? f.drinkSoon : f.ready, b);
  }
  return f;
}
