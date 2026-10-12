import type { Kind } from '$lib/insightsUrl';
import type { BrewFact, BagFact } from './facts';
import { countsForRating } from './ratings';
import { daysBetween } from './time';

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
  return `${t} brew days`;
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
function walk(key: string, steps: Step[], ts: (upTo: number) => number[], title: (t: number) => string): MilestoneEvent[] {
  const out: MilestoneEvent[] = [];
  let total = 0;
  for (const s of [...steps].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const before = total;
    total += s.v;
    for (const t of ts(total).filter((t) => t > before))
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
    ...walk('kgBrewed', sorted.map((b) => brewStep(b, (b.dose ?? 0) / 1000)), L('kgBrewed'), (t) => `${t} kg brewed`),
    ...walk('waterL', sorted.map((b) => brewStep(b, (b.waterG ?? 0) / 1000)), L('waterL'), (t) => `${t} L of water poured`),
    ...walk('bagsBought', bought.map((b) => ({ date: b.purchaseDate!, v: 1 })), L('bagsBought'), (t) => `${ordinal(t)} bag`),
    ...walk('kgBought', bought.map((b) => ({ date: b.purchaseDate!, v: (b.amountG ?? 0) / 1000 })), L('kgBought'), (t) => `${t} kg bought`),
    ...walk('bagsFinished', bags.filter((b) => b.status === 'archive' && b.lastBrew).map((b) => ({ date: b.lastBrew!, v: 1 })), L('bagsFinished'), (t) => `${t} bags finished`),
    ...walk('coffees', firstOfCoffee.map((b) => brewStep(b, 1)), L('coffees'), (t) => `${t} different coffees`),
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
