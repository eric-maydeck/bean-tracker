import { computeDaysSinceRoast, computeDrinkAfter, computeUrgencyRating, diffDays, parseDate, type UrgencyInput } from '../urgency';
import { consumption, gramsOnHand, loggedGrams, remaining } from './overview';
import { WAIT_BUCKETS, roastLevelLabels, waitBucket, windowState, type BagFact, type BrewFact } from './facts';
import type { Period } from './time';
import { country, processLabels } from './leaderboards';
import { groupBy } from './records';
import { ageHref, freshHref, waitHref, type AgeKey, type FreshKey } from './onHandLinks';
import type { Filter } from '$lib/coffeeFilters';

export interface FreshBag extends UrgencyInput { name: string; roaster: string; slug: string | null; grams: number }
export interface FreshGroup { count: number; grams: number; bags: { name: string; roaster: string; slug: string | null }[]; href?: string }
export interface Freshness {
  ready: FreshGroup; drinkSoon: FreshGroup; resting: FreshGroup; frozen: FreshGroup;
  nextReadyInDays: number | null; unknown: number;
}

// Ready bags with an urgency rating of at least this are "Drink soon".
export const DRINK_SOON_URGENCY = 40;

const validDate = (d: string | null): d is string => d != null && Number.isFinite(parseDate(d).getTime());
// An open freeze: started (a real date) and not ended.
const frozenNow = (b: UrgencyInput) => validDate(b.frozen_start_date) && !b.frozen_end_date;

// A junk freeze start is no freeze.
const cleanFreeze = <T extends UrgencyInput>(b: T): T => (validDate(b.frozen_start_date) ? b : { ...b, frozen_start_date: null, frozen_end_date: null });

export const freshBag = (b: BagFact, logged: Map<number, number>): FreshBag => cleanFreeze({
  roast_date: validDate(b.purchaseDate) ? b.purchaseDate : null, frozen_start_date: b.frozenStart ?? null, frozen_end_date: b.frozenEnd ?? null,
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
  for (const b of bags.map(cleanFreeze).sort((x, y) => (x.roast_date ?? '9').localeCompare(y.roast_date ?? '9'))) {
    if (frozenNow(b)) { add(f.frozen, b); continue; }
    if (!b.roast_date || b.rest_days_low == null || b.rest_days_high == null) { f.unknown++; continue; }
    const until = diffDays(parseDate(computeDrinkAfter(b, t)!), t);
    if (until > 0) { add(f.resting, b); f.nextReadyInDays = Math.min(f.nextReadyInDays ?? Infinity, until); continue; }
    const u = computeUrgencyRating(b, t);
    add(typeof u === 'number' && u >= DRINK_SOON_URGENCY ? f.drinkSoon : f.ready, b);
  }
  return f;
}

export type OnHandTiles = {
  bagsWaiting: number; gramsWaiting: number; tiedUp: number; avgAge: number | null;
  frozenBags: number; frozenGrams: number; avgBagCost: number | null;
};
export interface Runway { days: number | null; clearBy: string | null; perDay: number | null }
export type WaitRow = { label: string; grams: number; bags: number; href: string | null };
export interface Waiting { by: Record<'roaster' | 'origin' | 'process' | 'roast', WaitRow[]>; sub: number; oneOff: number }
const TOP = 10;

// Backlog grams on the shelf grouped four ways: biggest first, the top 10 then Other. A missing value is "Unknown".
// Grams divide per person; the bag counts beside them don't. Sub + one-off add up to the grams waiting.
export function whatsWaiting(bags: readonly BagFact[], logged: Map<number, number>, size: number, page: Filter[] = []): Waiting {
  const rows = bags.filter((b) => b.status === 'backlog').map((b) => ({ b, g: remaining(b, logged) / size }));
  // `filter`: the /coffees filter listing one group's bags (null label = Unknown); "Other" has none (no "is not" filter).
  const by = (key: (b: BagFact) => string | null, filter: (label: string | null) => Filter | null): WaitRow[] => {
    const all = [...groupBy(rows, (r) => key(r.b) ?? 'Unknown')]
      .map(([label, rs]) => ({ label, grams: rs.reduce((s, r) => s + r.g, 0), bags: rs.length, href: waitHref(filter(label === 'Unknown' ? null : label), page) }))
      .sort((a, b) => b.grams - a.grams || b.bags - a.bags || a.label.localeCompare(b.label));
    const rest = all.slice(TOP);
    return rest.length ? [...all.slice(0, TOP), { label: 'Other', grams: rest.reduce((s, r) => s + r.grams, 0), bags: rest.reduce((s, r) => s + r.bags, 0), href: null }] : all;
  };
  const sub = rows.reduce((s, r) => s + (r.b.subscriptionId !== null ? r.g : 0), 0);
  return {
    by: {
      roaster: by((b) => b.roaster, (l) => ({ column: 'roaster', mode: 'any', values: [l] })),
      // Unknown = whatever country() maps to no country: the group's own raw values (blank, "n/a", " N/A "), as processLabels does.
      origin: by((b) => country(b.origin), (l) => ({ column: 'origin', mode: 'any', values: l === null ? [...new Set(rows.filter((r) => country(r.b.origin) === null).map((r) => r.b.origin || null))] : [l] })),
      process: by((b) => b.processGroup, (l) => { const v = processLabels(rows.map((r) => r.b), l ?? ''); return v.length ? { column: 'processing', mode: 'any', values: v } : null; }),
      roast: by((b) => b.roastLevel, (l) => ({ column: 'roast_level', mode: 'any', values: l === null ? [null] : roastLevelLabels(l) }))
    },
    sub, oneOff: rows.reduce((s, r) => s + r.g, 0) - sub
  };
}

export type AgeSplit = { before: number[]; inside: number[]; past: number[]; noWindow: number[] };
export interface OnHandTab { tiles: OnHandTiles; runway: Runway; runwayAll: Runway; onHandG: number; freshness: Freshness; waiting: Waiting; age: { labels: string[]; bags: AgeSplit; grams: AgeSplit; links: Record<AgeKey, string[]> } }

// Waiting (backlog) bags by freezer-net days since roast, split by where that age sits against the roaster's rest
// window. Bags are counted whole (shared in the household); grams divide per person.
export function ageProfile(waiting: readonly BagFact[], logged: Map<number, number>, today: string, size: number, page: Filter[] = []) {
  const t = parseDate(today);
  const zeros = (): AgeSplit => { const z = () => WAIT_BUCKETS.map(() => 0); return { before: z(), inside: z(), past: z(), noWindow: z() }; };
  const bags = zeros(), grams = zeros();
  const KEY = { before: 'before', in: 'inside', past: 'past', none: 'noWindow' } as const;
  for (const b of waiting) {
    const f = freshBag(b, logged);
    const age = computeDaysSinceRoast(f, t);
    const i = waitBucket(age);
    if (i === null) continue;
    const k = KEY[windowState(age, b.restLow, b.restHigh)];
    bags[k][i] += 1;
    grams[k][i] += f.grams / size;
  }
  // The /coffees list behind each bar segment (ageHref): links[state][bucket].
  const links = Object.fromEntries((['before', 'inside', 'past', 'noWindow'] as AgeKey[]).map((k) => [k, WAIT_BUCKETS.map((_, i) => ageHref(i, k, page))])) as Record<AgeKey, string[]>;
  return { labels: WAIT_BUCKETS.map((w) => w.label), bags, grams, links };
}

// Each freshness group's /coffees link (the page's Coffees filter included).
function withLinks(f: Freshness, today: string, page: Filter[]): Freshness {
  for (const k of ['ready', 'drinkSoon', 'resting', 'frozen'] as FreshKey[]) f[k].href = freshHref(k, today, page);
  return f;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// What sits on the shelf now (backlog + open bags). `size` divides grams and dollars only: bags are shared in the
// household (user, 2026-10-26), as are ages and averages.
export function onHandTab(
  whole: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; size: number; dataStart: string | null; today: string; filters?: Filter[] }
): OnHandTab {
  const logged = loggedGrams(whole);
  const live = bags.filter((b) => b.status !== 'archive');
  const waiting = live.filter((b) => b.status === 'backlog');
  const fresh = live.map((b) => freshBag(b, logged));
  const t = parseDate(c.today);
  const frozen = fresh.filter(frozenNow);
  const tiedUp = live.reduce((s, b) => s + (b.status === 'backlog' ? (b.cost ?? 0) : b.cost && b.amountG ? (b.cost * remaining(b, logged)) / b.amountG : 0), 0);
  const onHandG = gramsOnHand(bags, whole);
  const run = (p: Period): Runway => {
    const u = consumption(whole, p, c.dataStart, c.today, onHandG, c.size);
    return { days: u.daysToClear, clearBy: u.clearBy, perDay: u.perDay };
  };
  return {
    tiles: {
      bagsWaiting: waiting.length,
      gramsWaiting: waiting.reduce((s, b) => s + remaining(b, logged), 0) / c.size,
      tiedUp: tiedUp / c.size,
      avgAge: mean(fresh.flatMap((b) => computeDaysSinceRoast(b, t) ?? [])),
      frozenBags: frozen.length,
      frozenGrams: frozen.reduce((s, b) => s + b.grams, 0) / c.size,
      avgBagCost: mean(live.flatMap((b) => (b.cost !== null && b.cost > 0 ? [b.cost] : [])))
    },
    onHandG,
    runway: run(c.period),
    runwayAll: run({ start: null, end: c.today }),
    waiting: whatsWaiting(bags, logged, c.size, c.filters ?? []),
    age: ageProfile(waiting, logged, c.today, c.size, c.filters ?? []),
    freshness: withLinks(freshness(fresh.map((b) => ({ ...b, grams: b.grams / c.size })), c.today), c.today, c.filters ?? [])
  };
}
