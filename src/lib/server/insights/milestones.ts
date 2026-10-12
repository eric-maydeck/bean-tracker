import type { Kind, Ratings } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { countsForRating, RATINGS_SETTLED_FROM } from './ratings';
import { addMonths, daysBetween, inPeriod, type Period } from './time';
import { isFinished } from './overview';
import { BREW_KEY } from './leaderboards';
import { bagHolder, type Holder } from './records';

export interface Ladder { early: number[]; steps: [until: number, step: number][]; then: number }
export type LadderKey = 'brews' | 'kgBrewed' | 'kgBought' | 'bagsBought' | 'bagsFinished' | 'coffees'
  | 'perRoaster' | 'perOrigin' | 'mileage' | 'waterL' | 'nines' | 'streak';

// Thresholds grow as the numbers do (user, 2026-10-11). Tuning a step is a one-line edit.
export const LADDERS: Record<LadderKey, Ladder> = {
  brews: { early: [1, 10, 50, 100, 250, 500, 1000], steps: [[10000, 500]], then: 1000 },
  kgBrewed: { early: [1, 2, 5, 10], steps: [[50, 5], [100, 10], [500, 50]], then: 100 },
  kgBought: { early: [1, 2, 5, 10], steps: [[50, 5], [100, 10], [500, 50]], then: 100 },
  bagsBought: { early: [1, 10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  bagsFinished: { early: [1, 10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  coffees: { early: [1, 10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  nines: { early: [1, 10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  perRoaster: { early: [10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  perOrigin: { early: [10, 25, 50, 100], steps: [[500, 50]], then: 100 },
  mileage: { early: [100, 250, 500, 1000], steps: [[5000, 500]], then: 1000 },
  waterL: { early: [10, 50, 100, 200, 500], steps: [], then: 250 },
  streak: { early: [7, 14, 30, 50, 100, 150, 365], steps: [], then: 365 }
};

export function* ladder(l: Ladder): Generator<number> {
  yield* l.early;
  let t = l.early[l.early.length - 1];
  for (const [until, step] of l.steps) while (t + step <= until) yield (t += step);
  for (;;) yield (t += l.then);
}
export function thresholds(l: Ladder, upTo: number): number[] {
  const out: number[] = [];
  for (const t of ladder(l)) { if (t > upTo) break; out.push(t); }
  return out;
}
export const crossed = (l: Ladder, before: number, after: number) => thresholds(l, after).filter((t) => t > before);
export function nextThreshold(l: Ladder, value: number): number {
  for (const t of ladder(l)) if (t > value) return t;
  return Infinity; // unreachable: ladders are endless
}

// Brew days don't fit one ladder: 1, 7, 30, 100, 200, then every 100, plus every 365·k (years).
export function brewDayThresholds(upTo: number): number[] {
  const out = new Set([1, 7, 30, 100, 200].filter((t) => t <= upTo));
  for (let t = 300; t <= upTo; t += 100) out.add(t);
  for (let t = 365; t <= upTo; t += 365) out.add(t);
  return [...out].sort((a, b) => a - b);
}
const NUM = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export function brewDayTitle(t: number): string {
  if (t === 7) return 'A week of brew days';
  if (t === 30) return 'A month of brew days';
  if (t === 365) return "A year's worth of brew days";
  if (t % 365 === 0) return `${NUM[t / 365 - 2] ?? t / 365} years' worth of brew days`;
  return `${t} brew day${t === 1 ? '' : 's'}`;
}

export interface MilestoneEvent {
  date: string; kind: Kind; key: string; title: string; detail?: string; href?: string; rating?: true;
}

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

interface Step { date: string; v: number; detail?: string; href?: string }

// Running total over dated steps; one event per threshold crossed, dated at the step that crossed it.
function walk(key: string, steps: Step[], ts: (upTo: number) => number[], title: (t: number) => string, scale = 1): MilestoneEvent[] {
  const out: MilestoneEvent[] = [];
  let total = 0;
  for (const s of [...steps].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const before = Math.round((total / scale) * 1e6) / 1e6;
    total += s.v;
    // Weights sum in grams (scale 1000): float kg sums miss exact thresholds (5000 x 20 g = 99.999...).
    const now = Math.round((total / scale) * 1e6) / 1e6;
    for (const t of ts(now).filter((t) => t > before))
      out.push({ date: s.date, kind: 'counts', key: `${key}:${t}`, title: title(t), ...(s.detail ? { detail: s.detail } : {}), ...(s.href ? { href: s.href } : {}) });
  }
  return out;
}

// Count milestones over all-time history: thresholds are the real totals, the caller filters by period.
export function countEvents(brews: readonly BrewFact[], bags: readonly BagFact[]): MilestoneEvent[] {
  const byId = new Map(bags.map((b) => [b.id, b]));
  const sorted = [...brews].sort((a, b) => (a.localTime < b.localTime ? -1 : a.localTime > b.localTime ? 1 : 0));
  const L = (k: LadderKey) => (upTo: number) => thresholds(LADDERS[k], upTo);
  const brewStep = (b: BrewFact, v: number): Step => {
    const c = b.coffeeId === null ? undefined : byId.get(b.coffeeId);
    return { date: b.localDate, v, detail: [c?.name, b.brewer].filter(Boolean).join(' · ') || undefined, href: c?.slug ? `/coffees/${c.slug}` : undefined };
  };
  const seen = new Set<number>();
  const firstOfCoffee = sorted.filter((b) => b.coffeeId !== null && !seen.has(b.coffeeId) && seen.add(b.coffeeId));
  const days = [...new Set(sorted.map((b) => b.localDate))];
  const bought = bags.filter((b) => b.purchaseDate);
  return [
    ...walk('brews', sorted.map((b) => brewStep(b, 1)), L('brews'), (t) => `${ordinal(t)} brew`),
    ...walk('kgBrewed', sorted.map((b) => brewStep(b, b.dose ?? 0)), L('kgBrewed'), (t) => `${t} kg brewed`, 1000),
    ...walk('waterL', sorted.map((b) => brewStep(b, b.waterG ?? 0)), L('waterL'), (t) => `${t} L of water poured`, 1000),
    ...walk('bagsBought', bought.map((b) => ({ date: b.purchaseDate!, v: 1 })), L('bagsBought'), (t) => `${ordinal(t)} bag`),
    ...walk('kgBought', bought.map((b) => ({ date: b.purchaseDate!, v: b.amountG ?? 0 })), L('kgBought'), (t) => `${t} kg bought`, 1000),
    ...walk('bagsFinished', bags.filter(isFinished).map((b) => ({ date: b.lastBrew!, v: 1 })), L('bagsFinished'), (t) => `${t} bags finished`),
    ...walk('coffees', firstOfCoffee.map((b) => brewStep(b, 1)), L('coffees'), (t) => `${t} different coffee${t === 1 ? '' : 's'}`),
    ...walk('nines', sorted.filter((b) => (b.rating ?? 0) >= 9 && countsForRating(b, 'all')).map((b) => brewStep(b, 1)), L('nines'), (t) => `${ordinal(t)} brew rated 9+`),
    ...walk('brewDays', days.map((date) => ({ date, v: 1 })), brewDayThresholds, brewDayTitle)
  ];
}

// Streak thresholds on the day reached; a gap restarts the run. Keys carry the date so a second run
// reaching the same length stays distinct.
export function streakEvents(brewDays: readonly string[]): MilestoneEvent[] {
  const out: MilestoneEvent[] = [];
  let run = 0, prev: string | null = null;
  for (const date of [...new Set(brewDays)].sort()) {
    run = prev !== null && daysBetween(prev, date) === 1 ? run + 1 : 1;
    prev = date;
    for (const t of crossed(LADDERS.streak, run - 1, run))
      out.push({ date, kind: 'streaks', key: `streak:${t}:${date}`, title: `${t}-day streak` });
  }
  return out;
}

const byTime = (brews: readonly BrewFact[]) => [...brews].sort((a, b) => (a.localTime < b.localTime ? -1 : a.localTime > b.localTime ? 1 : 0));
const group = <T>(xs: readonly T[], key: (x: T) => string | null) => {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = key(x); if (k !== null) (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
  return m;
};
const asKind = (k: Kind, ev: MilestoneEvent[]): MilestoneEvent[] => ev.map((e) => ({ ...e, kind: k }));

// First time each roaster, origin, ... shows up; plus Nth roaster / origin ever and bags per roaster / origin.
const FIRSTS: [dim: string, label: string, key: (b: BrewFact) => string | null][] = [
  ['roaster', 'roaster', BREW_KEY.roasters], ['origin', 'origin', BREW_KEY.origins], ['process', 'process group', BREW_KEY.process],
  ['roast', 'roast level', BREW_KEY.roast], ['dripper', 'dripper', BREW_KEY.dripper], ['filter', 'filter', BREW_KEY.filter],
  ['grinder', 'grinder', BREW_KEY.grinder], ['water', 'water', BREW_KEY.water]
];
const TYPE_LABEL: Record<string, string> = { pourover: 'pour-over', espresso: 'espresso', immersion: 'immersion', soup: 'soup' };
export function firstEvents(brews: readonly BrewFact[], bags: readonly BagFact[]): MilestoneEvent[] {
  const byId = new Map(bags.map((b) => [b.id, b]));
  const out: MilestoneEvent[] = [];
  const seen = new Set<string>();
  const add = (b: BrewFact, key: string, title: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const c = b.coffeeId === null ? undefined : byId.get(b.coffeeId);
    out.push({ date: b.localDate, kind: 'firsts', key, title, ...(c ? { detail: c.name } : {}), ...(c?.slug ? { href: `/coffees/${c.slug}` } : {}) });
  };
  for (const b of byTime(brews)) {
    for (const [dim, label, f] of FIRSTS) { const v = f(b); if (v) add(b, `first:${dim}:${v}`, `First ${label}: ${v}`); }
    if (b.decaf) add(b, 'first:decaf', 'First decaf');
    if (b.brewerType !== 'other') add(b, `first:type:${b.brewerType}`, `First ${TYPE_LABEL[b.brewerType]} brew`);
  }
  const bought = bags.filter((b) => b.purchaseDate).sort((a, b) => a.purchaseDate!.localeCompare(b.purchaseDate!));
  const origin = (b: BagFact) => BREW_KEY.origins({ origin: b.origin } as BrewFact);
  // From the 10th: the first roaster / origin is already a "First roaster: X" event.
  const distinct = (key: (b: BagFact) => string | null, name: string, title: (t: number) => string) =>
    walk(name, [...group(bought, key).values()].map((g) => ({ date: g[0].purchaseDate!, v: 1 })), (n) => thresholds(LADDERS.bagsBought, n).filter((t) => t > 1), title);
  const depth = (key: (b: BagFact) => string | null, name: string, L: Ladder) =>
    [...group(bought, key)].flatMap(([k, g]) => walk(`${name}:${k}`, g.map((b) => ({ date: b.purchaseDate!, v: 1 })), (n) => thresholds(L, n), (t) => `${ordinal(t)} bag from ${k}`));
  return [
    ...out,
    ...asKind('firsts', distinct((b) => b.roaster, 'roasters', (t) => `${ordinal(t)} roaster`)),
    ...asKind('firsts', distinct(origin, 'origins', (t) => `${ordinal(t)} origin`)),
    ...asKind('firsts', depth((b) => b.roaster, 'perRoaster', LADDERS.perRoaster)),
    ...asKind('firsts', depth(origin, 'perOrigin', LADDERS.perOrigin))
  ];
}

// Personal-best brew, best bag (mean of >=3 counted ratings) and busiest-day records, as they were broken.
export function bestEvents(brews: readonly BrewFact[], bags: readonly BagFact[], ratings: Ratings): MilestoneEvent[] {
  const name = new Map(bags.map((b) => [b.id, b.name]));
  const out: MilestoneEvent[] = [];
  const perBag = new Map<number, number[]>();
  let bestBrew = -Infinity, bestBag = -Infinity, busiest = 0, dayCount = 0;
  const sorted = byTime(brews);
  sorted.forEach((b, i) => {
    if (b.coffeeId !== null && countsForRating(b, ratings)) {
      const r = b.rating!;
      if (r > bestBrew) { bestBrew = r; out.push({ date: b.localDate, kind: 'bests', key: `best:brew:${r}`, title: `New best brew: ${r}`, rating: true }); }
      const xs = perBag.get(b.coffeeId) ?? perBag.set(b.coffeeId, []).get(b.coffeeId)!;
      xs.push(r);
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      if (xs.length >= 3 && m > bestBag + 1e-9) {
        bestBag = m;
        out.push({ date: b.localDate, kind: 'bests', key: `best:bag:${b.coffeeId}:${b.localTime}`, title: `New best bag: ${name.get(b.coffeeId) ?? `Bag ${b.coffeeId}`}`, detail: `Mean ${m.toFixed(2)}`, rating: true });
      }
    }
    dayCount++;
    if (sorted[i + 1]?.localDate !== b.localDate) { // end of the day
      if (dayCount > busiest) { // the first day only sets the bar
        if (busiest > 0) out.push({ date: b.localDate, kind: 'bests', key: `best:day:${dayCount}`, title: `Busiest day: ${dayCount} brew${dayCount > 1 ? 's' : ''}` });
        busiest = dayCount;
      }
      dayCount = 0;
    }
  });
  return out;
}

// Brewer, dripper and water mileage.
const GEAR: [dim: string, key: (b: BrewFact) => string | null, verb: string][] = [
  ['brewer', (b) => b.brewer, 'on'], ['dripper', (b) => b.dripper, 'on'], ['water', (b) => b.water, 'with']
];
export function gearEvents(brews: readonly BrewFact[]): MilestoneEvent[] {
  const sorted = byTime(brews);
  return GEAR.flatMap(([dim, key, verb]) => [...group(sorted, key)].flatMap(([k, g]) =>
    asKind('gear', walk(`mileage:${dim}:${k}`, g.map((b) => ({ date: b.localDate, v: 1 })), (n) => thresholds(LADDERS.mileage, n), (t) => `${ordinal(t)} brew ${verb} ${k}`))));
}

const span = (m: number) => { const n = m % 12 ? m : m / 12, u = m % 12 ? 'month' : 'year'; return `${n} ${u}${n > 1 ? 's' : ''}`; };
export function anniversaryEvents(brews: readonly BrewFact[], bags: readonly BagFact[], today: string): MilestoneEvent[] {
  const out: MilestoneEvent[] = [];
  const mark = (key: string, start: string, ms: number[], title: (s: string) => string) => {
    for (const m of ms) { const date = addMonths(start, m); if (date <= today) out.push({ date, kind: 'anniversaries', key: `${key}:${m}`, title: title(span(m)) }); }
  };
  const years = (start: string) => Array.from({ length: Math.max(0, Math.floor(daysBetween(start, today) / 365)) + 1 }, (_, i) => 12 * (i + 1));
  const bought = bags.filter((b) => b.purchaseDate);
  const firstOf = (xs: BagFact[]) => xs.reduce((m, b) => (b.purchaseDate! < m ? b.purchaseDate! : m), xs[0].purchaseDate!);
  const sorted = byTime(brews);
  if (bought.length) { const s = firstOf(bought); mark('ann:bag', s, [1, 3, 6, ...years(s)], (t) => `${t} since the first bag`); }
  if (sorted.length) { const s = sorted[0].localDate; mark('ann:brew', s, [1, 3, 6, ...years(s)], (t) => `${t} since the first brew`); }
  for (const [r, g] of group(bought, (b) => b.roaster))
    if (g.length >= 5) mark(`ann:roaster:${r}`, firstOf(g), years(firstOf(g)), (t) => `${t} with ${r}`);
  for (const [dim, key] of GEAR) for (const [k, g] of group(sorted, key))
    if (daysBetween(g[g.length - 1].localDate, today) <= 60) mark(`ann:${dim}:${k}`, g[0].localDate, years(g[0].localDate), (t) => `${t} with ${k}`);
  mark('ann:ratings', RATINGS_SETTLED_FROM, [6, 12], (t) => `${t} of the Current rating scale`);
  return out;
}

export interface MilestonesCtx { period: Period; prev: Period | null; ratings: Ratings; kinds?: Kind[]; today: string }
type Summary = { total: number; firsts: number; bests: number };
export interface MilestonesTab {
  months: { month: string; events: MilestoneEvent[] }[]; // 'YYYY-MM', newest first; events newest first
  summary: Summary;
  summaryPrev: Summary | null;
  nextUp: { key: string; label: string; value: number; target: number }[]; // closest first
  onThisDay: { holder: Holder; rating: number | null; brewer: string | null } | null;
}

export function milestonesTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: MilestonesCtx): MilestonesTab {
  const sorted = byTime(brews);
  const all = [
    ...countEvents(brews, bags), ...streakEvents(brews.map((b) => b.localDate)), ...firstEvents(brews, bags),
    ...bestEvents(brews, bags, c.ratings), ...gearEvents(brews), ...anniversaryEvents(brews, bags, c.today)
  ].filter((e) => !c.kinds || c.kinds.includes(e.kind));
  const within = (p: Period) => all.filter((e) => inPeriod(e.date, p));
  const summarize = (evs: MilestoneEvent[]): Summary =>
    ({ total: evs.length, firsts: evs.filter((e) => e.kind === 'firsts').length, bests: evs.filter((e) => e.kind === 'bests').length });
  const months = new Map<string, MilestoneEvent[]>();
  for (const e of within(c.period).reverse().sort((a, b) => b.date.localeCompare(a.date))) {
    const m = e.date.slice(0, 7);
    (months.get(m) ?? months.set(m, []).get(m)!).push(e);
  }

  const days = [...new Set(sorted.map((b) => b.localDate))];
  let streak = 0; // the run ending today or yesterday
  if (days.length && daysBetween(days[days.length - 1], c.today) <= 1) {
    streak = 1;
    for (let i = days.length - 2; i >= 0 && daysBetween(days[i], days[i + 1]) === 1; i--) streak++;
  }
  const grams = sorted.reduce((s, b) => s + (b.dose ?? 0), 0);
  const L = (key: string, label: string, ladder: Ladder, value: number) => ({ key, label, value, target: nextThreshold(ladder, value) });
  const bought = bags.filter((b) => b.purchaseDate);
  const nextUp = [
    L('brews', 'Brews', LADDERS.brews, sorted.length),
    L('kgBrewed', 'kg brewed', LADDERS.kgBrewed, Math.round(grams / 100) / 10),
    L('bagsBought', 'Bags bought', LADDERS.bagsBought, bought.length),
    L('coffees', 'Different coffees', LADDERS.coffees, new Set(sorted.map((b) => b.coffeeId).filter((x) => x !== null)).size),
    L('roasters', 'Roasters', LADDERS.bagsBought, new Set(bought.map((b) => b.roaster)).size),
    L('streak', 'Day streak', LADDERS.streak, streak),
    { key: 'brewDays', label: 'Brew days', value: days.length, target: brewDayThresholds(days.length + 366).find((t) => t > days.length)! }
  ].sort((a, b) => b.value / b.target - a.value / a.target).slice(0, 6);

  const ago = addMonths(c.today, -12);
  const top = sorted.length && sorted[0].localDate <= ago
    ? sorted.filter((b) => b.localDate === ago).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))[0] : undefined;
  return {
    months: [...months].map(([month, events]) => ({ month, events })),
    summary: summarize(within(c.period)),
    summaryPrev: c.prev ? summarize(within(c.prev)) : null,
    nextUp,
    onThisDay: top ? { holder: bagHolder(bags, top.coffeeId, top.localDate), rating: top.rating, brewer: top.brewer } : null
  };
}
