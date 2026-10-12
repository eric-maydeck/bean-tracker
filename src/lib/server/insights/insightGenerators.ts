import type { Ratings } from '$lib/insightsUrl';
import { formatGrams } from '$lib/grams';
import type { BagFact, BrewFact } from './facts';
import { countsForRating } from './ratings';
import { brewZ, demeaned, groupZ, mean, MIN_BAGS, MIN_BREWS, sd, strengthOf, type Strength } from './stats';
import { daysBetween, inPeriod } from './time';

export type Theme = 'taste' | 'dialin' | 'habits' | 'gear' | 'money';
export type CardKind = 'number' | 'pattern' | 'versus' | 'myth' | 'story' | 'whatif';
export interface Finding {
  key: string; theme: Theme; kind: CardKind;
  headline: string; // short, number-first
  value?: string; // the big value ("+0.28")
  sides?: { label: string; value: string }[]; // versus: exactly 2
  body?: string; // 1-3 plain sentences
  series?: { label: string; value: number }[]; // mini chart points
  sample: string;
  settle?: string; // too-early: what would settle it
  href?: string; // "See the data" deep link
  z: number | null; // null = descriptive (no badge)
  strength: Strength | null;
  caveat?: string;
}
export interface GenCtx {
  brews: readonly BrewFact[]; bags: readonly BagFact[]; prevBrews: readonly BrewFact[] | null;
  ratings: Ratings; today: string; householdSize: number; onHandG: number;
  period: { from: string; to: string }; dataStart: string; // What-if defaults (Task 14)
}
export type Generator = (c: GenCtx) => Finding | Finding[] | null;

const signed = (x: number, d = 2) => `${x < 0 ? '-' : '+'}${Math.abs(x).toFixed(d)}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const counted = (c: GenCtx) => c.brews.filter((b) => countsForRating(b, c.ratings));
const bagLabel = (c: GenCtx, id: number) => { const b = c.bags.find((x) => x.id === id); return b ? `${b.roaster} ${b.name}` : `Bag ${id}`; };
const bagMeans = (rows: readonly BrewFact[]): Map<number, number> => {
  const by = new Map<number, number[]>();
  for (const b of rows) if (b.coffeeId !== null) (by.get(b.coffeeId) ?? by.set(b.coffeeId, []).get(b.coffeeId)!).push(b.rating!);
  return new Map([...by].map(([id, rs]) => [id, mean(rs)]));
};
// Rated brews of each bag, in time order.
const perBag = (rows: readonly BrewFact[]): Map<number, BrewFact[]> => {
  const by = new Map<number, BrewFact[]>();
  for (const b of rows) if (b.coffeeId !== null) (by.get(b.coffeeId) ?? by.set(b.coffeeId, []).get(b.coffeeId)!).push(b);
  return by;
};
// Mean paired difference with z = mean / (sd / sqrt(n)); null z when the data can't support one.
const paired = (d: number[]) => ({ m: mean(d), z: mean(d) / (sd(d) / Math.sqrt(d.length)) });

// ponytail: "about N more would settle it" assumes the effect and spread stay as seen.
const settleText = (z: number, n: number, unit: string): string | undefined => {
  const more = Math.ceil(n * (4 / z ** 2 - 1));
  return Number.isFinite(more) && more > 0 ? `About ${more} more ${unit} would settle it.` : undefined;
};

// Attach z and strength; null when z isn't finite or the strength is hidden.
function graded(f: Omit<Finding, 'z' | 'strength'>, z: number, enough: boolean, unit: string, n: number, caveatEarly?: string): Finding | null {
  if (!Number.isFinite(z)) return null;
  const strength = strengthOf(z, enough);
  if (strength === 'hidden') return null;
  const early = strength === 'early';
  return { ...f, z, strength, ...(early ? { settle: settleText(z, n, unit), caveat: caveatEarly ?? f.caveat } : {}) };
}

const LB = '/insights?tab=leaderboards';

const dialinCurve: Generator = (c) => {
  const all = demeaned(counted(c));
  const n = new Map<number, number>();
  for (const r of all) n.set(r.coffeeId!, (n.get(r.coffeeId!) ?? 0) + 1);
  const rows = all.filter((r) => n.get(r.coffeeId!)! >= MIN_BAGS);
  const bags = new Set(rows.map((r) => r.coffeeId));
  const first = rows.filter((r) => r.brewIndex === 1), rest = rows.filter((r) => r.brewIndex > 1);
  if (bags.size < MIN_BAGS || first.length < MIN_BAGS || !rest.length) return null;
  const bucket = (r: { brewIndex: number }) => Math.min(r.brewIndex, 7);
  const series = [1, 2, 3, 4, 5, 6, 7].flatMap((i) => {
    const rs = rows.filter((r) => bucket(r) === i);
    return rs.length ? [{ label: i === 7 ? '7+' : String(i), value: mean(rs.map((r) => r.dm)) }] : [];
  });
  const lower = mean(first.map((r) => r.dm)) < mean(rest.map((r) => r.dm));
  const z = brewZ(first.map((r) => r.dm), rest.map((r) => r.dm), sd(rows.map((r) => r.dm)));
  const base = { theme: 'dialin' as const, sample: `${bags.size} bags`, href: `${LB}&open=coffees` };
  const curve = graded({
    ...base, key: 'dialinCurve', kind: 'pattern',
    headline: lower ? 'Your first brew of a bag is your worst' : 'You nail a bag from the first brew',
    value: signed(mean(first.map((r) => r.dm)) - mean(rest.map((r) => r.dm))), series
  }, z, true, 'bags', bags.size);
  if (!curve) return null;
  const raw = (i: number) => mean(rows.filter((r) => bucket(r) === i).map((r) => r.rating!));
  const lastI = series.length ? Math.max(...series.map((s) => (s.label === '7+' ? 7 : +s.label))) : 1;
  const pick = lower ? Math.min : Math.max;
  const extreme = first.filter((r) => r.dm === pick(...rows.filter((x) => x.coffeeId === r.coffeeId).map((x) => x.dm))).length;
  const story: Finding = {
    ...curve, key: 'dialinStory', kind: 'story',
    body: `Brew #1 averages ${raw(1).toFixed(2)}; by brew #${lastI}${lastI === 7 ? '+' : ''} you're at ${raw(lastI).toFixed(2)}. ` +
      `The first brew was the ${lower ? 'worst' : 'best'} in ${Math.round((100 * extreme) / first.length)}% of ${bags.size} bags.`
  };
  return [curve, story];
};

// Rated brews to reach the bag's settled rating: the first at or above (mean of its best half) - 0.5.
const dialinSpeed: Generator = (c) => {
  const slow: { id: number; pos: number }[] = [];
  for (const [id, bs] of perBag(counted(c))) {
    if (bs.length < 5) continue;
    const rs = bs.map((b) => b.rating!);
    const top = [...rs].sort((a, b) => b - a).slice(0, Math.ceil(rs.length / 2));
    slow.push({ id, pos: rs.findIndex((r) => r >= mean(top) - 0.5) + 1 });
  }
  if (slow.length < MIN_BAGS) return null;
  const label = (x: { id: number }) => bagLabel(c, x.id);
  const by = (a: { id: number; pos: number }, b: { id: number; pos: number }) => a.pos - b.pos || label(a).localeCompare(label(b));
  const sorted = slow.sort(by);
  const fast = sorted[0], last = sorted[sorted.length - 1];
  if (fast.pos === last.pos) return null;
  const s = sorted.filter((x) => x.pos === last.pos).sort((a, b) => label(a).localeCompare(label(b)))[0];
  return {
    key: 'dialinSpeed', theme: 'dialin', kind: 'versus', headline: `Dial-in takes ${fast.pos} to ${last.pos} brews`,
    sides: [{ label: `Slowest: ${label(s)}`, value: plural(s.pos, 'brew') }, { label: `Fastest: ${label(fast)}`, value: plural(fast.pos, 'brew') }],
    sample: `${slow.length} bags`, href: `${LB}&open=coffees`, z: null, strength: null
  };
};

const secondCup: Generator = (c) => {
  const days = new Map<string, BrewFact[]>();
  for (const b of counted(c)) if (b.coffeeId !== null) (days.get(`${b.coffeeId}|${b.localDate}`) ?? days.set(`${b.coffeeId}|${b.localDate}`, []).get(`${b.coffeeId}|${b.localDate}`)!).push(b);
  const d = [...days.values()].filter((g) => g.length >= 2).map((g) => g.sort((a, b) => a.localTime.localeCompare(b.localTime))).map((g) => g[1].rating! - g[0].rating!);
  if (d.length < MIN_BREWS) return null;
  const { m, z } = paired(d);
  return graded({
    key: 'secondCup', theme: 'dialin', kind: 'number', headline: m >= 0 ? 'Your second cup is better' : 'Your second cup is worse',
    value: signed(m), sample: `${d.length} pairs`, href: `${LB}&open=coffees`
  }, z, true, 'pairs', d.length);
};

const fondMemory: Generator = (c) => {
  const by = perBag(counted(c));
  const d = c.bags.flatMap((b) => {
    const bs = by.get(b.id);
    return b.bagRating !== null && bs && bs.length >= MIN_BAGS ? [b.bagRating - mean(bs.map((x) => x.rating!))] : [];
  });
  if (d.length < MIN_BREWS) return null;
  const { m, z } = paired(d);
  return graded({
    key: 'fondMemory', theme: 'taste', kind: 'number', headline: m >= 0 ? 'You remember bags more fondly than you brewed them' : 'You remember bags less fondly than you brewed them',
    value: signed(m), body: `${Math.round((100 * d.filter((x) => (m >= 0 ? x > 0 : x < 0)).length) / d.length)}% of ${d.length} bags.`,
    sample: `${d.length} bags`, href: `${LB}&open=coffees`
  }, z, true, 'bags', d.length);
};

const repeatBuys: Generator = (c) => {
  const means = bagMeans(counted(c));
  const groups = new Map<string, BagFact[]>();
  for (const b of c.bags) if (means.has(b.id)) (groups.get(`${b.name.toLowerCase()}|${b.roaster.toLowerCase()}`) ?? groups.set(`${b.name.toLowerCase()}|${b.roaster.toLowerCase()}`, []).get(`${b.name.toLowerCase()}|${b.roaster.toLowerCase()}`)!).push(b);
  const d = [...groups.values()].filter((g) => g.length >= 2)
    .map((g) => g.sort((a, b) => (a.purchaseDate ?? '').localeCompare(b.purchaseDate ?? '') || a.id - b.id))
    .map((g) => means.get(g[1].id)! - means.get(g[0].id)!);
  if (d.length < MIN_BAGS) return null;
  const { m, z } = paired(d);
  const f = {
    key: 'repeatBuys', theme: 'taste' as const, kind: 'number' as const, headline: m >= 0 ? 'Repeat buys rate higher' : 'Repeat buys rate lower',
    value: signed(m), body: `${d.filter((x) => x > 0).length} of ${d.length} second bags rated higher.`,
    sample: `${d.length} repeat pairs`, href: `${LB}&open=coffees`, caveat: 'Ratings settled over time and you re-buy winners.'
  };
  return graded(f, z, true, 'pairs', d.length) ?? { ...f, z: null, strength: null };
};

const DIMS = [
  ['roaster', 'roasters', 'bags', 'roaster'], ['origin', 'origins', 'coffees', 'origin'],
  ['processGroup', 'process', 'coffees', 'process'], ['roastLevel', 'roast', 'roasts', 'roast level']
] as const;
const groupDelta: Generator = (c) => {
  const means = bagMeans(counted(c));
  const rated = c.bags.filter((b) => means.has(b.id));
  const all = rated.map((b) => means.get(b.id)!);
  return DIMS.flatMap(([dim, board, noun, dimName]) => {
    const groups = new Map<string, number[]>();
    for (const b of rated) {
      const label = b[dim];
      if (label && label !== 'Other / Unknown') (groups.get(label) ?? groups.set(label, []).get(label)!).push(means.get(b.id)!);
    }
    const big = [...groups].filter(([, ms]) => ms.length >= MIN_BAGS);
    return big.flatMap(([label, ms]) => {
      const delta = mean(ms) - mean(all);
      const f = graded({
        key: `groupDelta:${dim}:${label}`, theme: 'taste', kind: 'number',
        headline: `${label} ${noun} rate ${Math.abs(delta).toFixed(2)} ${delta < 0 ? 'lower' : 'higher'}`,
        value: signed(delta), sample: `${plural(ms.length, 'bag')}`, href: `${LB}&open=${board}`
      }, groupZ(ms, all), true, 'bags', ms.length, `With ${big.length} ${dimName} groups compared, one usually stands out by chance.`);
      return f ? [f] : [];
    });
  });
};

const coFerments: Generator = (c) => {
  const co = c.bags.filter((b) => b.processGroup === 'Co-ferment / Infused' && b.origin);
  const top = new Map<string, number>();
  for (const b of co) top.set(b.origin!, (top.get(b.origin!) ?? 0) + 1);
  const [origin, n] = [...top].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (co.length < 5 || n !== co.length) return null;
  return {
    key: 'coFerments', theme: 'taste', kind: 'number', headline: `All ${n} of your co-ferments are ${origin}`,
    value: `${n} of ${n}`, sample: `${plural(n, 'bag')}`, href: `${LB}&open=process`, z: null, strength: null
  };
};

const notesTrouble: Generator = (c) => {
  const rows = demeaned(counted(c));
  const [yes, no] = [rows.filter((r) => r.hasNote).map((r) => r.dm), rows.filter((r) => !r.hasNote).map((r) => r.dm)];
  if (yes.length < MIN_BREWS || no.length < MIN_BREWS) return null;
  const diff = mean(yes) - mean(no);
  return graded({
    key: 'notesTrouble', theme: 'taste', kind: 'number', headline: diff < 0 ? 'Brews you write notes on rate lower' : 'Brews you write notes on rate higher',
    value: signed(diff), sample: `${yes.length} noted vs ${no.length} plain brews`, href: `${LB}&open=coffees`
  }, brewZ(yes, no, sd(rows.map((r) => r.dm))), true, 'brews', Math.min(yes.length, no.length));
};

// On hand / recent g/day over the period; bought vs brewed kg in it. Descriptive.
const MIN_RUNWAY_DAYS = 14;
const backlogRunway: Generator = (c) => {
  const p = { start: c.period.from, end: c.period.to };
  const days = daysBetween(p.start, p.end) + 1;
  const brewed = c.brews.filter((b) => inPeriod(b.localDate, p)).reduce((s, b) => s + (b.dose ?? 0), 0);
  if (days < MIN_RUNWAY_DAYS || brewed <= 0 || c.onHandG <= 0) return null;
  const bought = c.bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, p)).reduce((s, b) => s + (b.amountG ?? 0), 0);
  const perDay = brewed / days;
  return {
    key: 'backlogRunway', theme: 'money', kind: 'number', headline: `${formatGrams(c.onHandG)} on hand, about ${Math.round(c.onHandG / perDay)} days`,
    value: `${Math.round(c.onHandG / perDay)} days`,
    body: `At ${Math.round(perDay)} g/day. Bought ${formatGrams(bought)} vs brewed ${formatGrams(brewed)} in this period.`,
    sample: `${days} days`, href: '/insights?tab=consumption', z: null, strength: null
  };
};

export const GENERATORS: Generator[] = [
  dialinCurve, dialinSpeed, secondCup, fondMemory, repeatBuys, groupDelta, coFerments, notesTrouble, backlogRunway
];
