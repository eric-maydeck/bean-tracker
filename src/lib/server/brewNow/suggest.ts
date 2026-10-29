import { weightedMedian, spearman } from '../insights/stats';
import { daysBetween } from '../insights/time';
import { normalizeRoastLevel } from '../insights/facts';
import { processGroup } from '$lib/processGroups';
import type { BrewRow, CoffeeDetails, GearClass } from './load';
import type { Confidence } from '$lib/brewNowConfidence';

export type Setting = 'grind' | 'temp' | 'dose' | 'ratio' | 'recipe' | 'water';
export type { Confidence };
export interface Row {
  setting: Setting; value: string | null; reason: string; tier: Tier | null; confidence: Confidence;
  synopsis: string[]; // 2-4 short sentences shown when the row expands (empty when there is no value)
  evidence: BrewRow[]; // up to 8, highest weight first, low ratings kept
  link: string | null; reference?: { grinder: string; grind: string }[] // grind with no data on this grinder
}
export interface OtherGrinder { grinder: string; grind: string; tier: Tier; brews: number }
export interface BasisCoffee { slug: string; name: string; roaster: string; brews: number }
// Left in the bag after the suggested dose, split into the user's preferred doses (least wasted, then fewest brews).
export interface DosePlan { leftAfter: number; brews: number[]; leftover: number }
export interface Suggestion {
  rows: Row[]; dose: number | null; ratio: number | null; // the pair in use (the user's pick, else the suggestion)
  suggestedDose: number | null; suggestedRatio: number | null; dosePlan: DosePlan | null; confidence: Confidence; basis: string; basisCoffees: BasisCoffee[]; lastNote: string | null;
  otherGrinders: OtherGrinder[]; // other grinders with tier 1-3 data: their best / typical setting, not converted
}
export interface Gear { grinder: string | null; dripper: string | null; filter: string | null }
export interface SimilarCoffee {
  slug: string; roaster: string; coffeeName: string; tier: 2 | 3 | 4; brews: number; avgRating: number | null;
  grindRange: [string, string] | null; tempRange: [number, number] | null; topRecipe: string | null;
}
// 1 this coffee, 2 same roaster + origin/process, 3 same roaster, 4 similar coffees, 5 all brews.
export type Tier = 1 | 2 | 3 | 4 | 5;

const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
const OTHER = 'Other / Unknown';

// R2: the target's raw processing / roast level are normalized here; BrewRow already holds normalized ones.
export function tierOf(target: CoffeeDetails, row: BrewRow): Tier {
  const sameRoaster = norm(target.roaster) === norm(row.roaster);
  if (sameRoaster && norm(target.coffeeName) === norm(row.coffeeName)) return 1;
  const pg = processGroup(target.processing), samePg = pg !== OTHER && pg === row.processGroup;
  const sameOrigin = !!target.origin && norm(target.origin) === norm(row.origin);
  if (sameRoaster) return sameOrigin || samePg ? 2 : 3;
  const roast = normalizeRoastLevel(target.roastLevel);
  return samePg && !!roast && roast === row.roastLevel && target.decaf === row.decaf ? 4 : 5;
}

// A grind as one decimal number: "5.5" → 5.5, "1.4.5" → 1.45 (one digit per later part). Anything else is skipped
// ponytail: parts of 2+ digits ("6.10") are skipped, not ordered; add if a grinder needs them.
export const lin = (g: string | null): number | null => {
  if (!g || !/^\d+(\.\d)*$/.test(g)) return null;
  const [a, ...rest] = g.split('.');
  return Number(a) + (rest.length ? Number(rest.join('')) / 10 ** rest.length : 0);
};
// Decimals / dot-parts a grinder's settings use, to print a number back in its own notation.
const parts = (gs: (string | null)[]) => Math.max(0, ...gs.map((g) => (g && lin(g) !== null ? g.split('.').length - 1 : 0)));
const fmtGrind = (v: number, k: number) => {
  const s = v.toFixed(k);
  return k > 1 ? s.replace(/\.(\d+)$/, (_, d: string) => '.' + d.split('').join('.')) : s;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Median absolute non-zero change between consecutive brews of one bag on this grinder (all bags), in the
// grinder's own decimals; with none moved, 1 for whole-number settings and 0.1 otherwise.
export function grindStep(rows: BrewRow[], grinder: string): number {
  const mine = rows.filter((r) => r.grinder === grinder && lin(r.grind) !== null);
  const k = parts(mine.map((r) => r.grind)), unit = 10 ** k;
  const bags = new Map<number, BrewRow[]>();
  for (const r of mine) bags.set(r.coffeeId, [...(bags.get(r.coffeeId) ?? []), r]);
  const diffs: number[] = [];
  for (const b of bags.values()) {
    b.sort((x, y) => x.localTime.localeCompare(y.localTime) || x.id - y.id);
    for (let i = 1; i < b.length; i++) {
      const d = Math.abs(Math.round(lin(b[i].grind)! * unit) - Math.round(lin(b[i - 1].grind)! * unit)); // whole units
      if (d > 0) diffs.push(d);
    }
  }
  return diffs.length ? Math.round(median(diffs)) / unit : k === 0 ? 1 : 0.1;
}

const rank = (c: Confidence) => ['guess', 'low', 'moderate', 'high'].indexOf(c);
const compat = (r: BrewRow, g: Gear, gc: GearClass) =>
  gc.dripper(r.dripper) === gc.dripper(g.dripper) && gc.filter(r.filter) === gc.filter(g.filter);
const brews = (n: number) => `${n} ${n === 1 ? 'brew' : 'brews'}`;
const num = (n: number) => String(Math.round(n * 10) / 10);
const range = (xs: number[]) => (Math.min(...xs) === Math.max(...xs) ? num(xs[0]) : `${num(Math.min(...xs))}–${num(Math.max(...xs))}`);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const fmtRatio = (r: number) => `1:${num(r)}`;

// Unbounded knapsack in tenths of a gram: the most grams of `doses` that fit in `left`, then the fewest brews.
export function dosePlan(left: number, doses: number[]): DosePlan {
  const cap = Math.max(0, Math.floor(left * 10 + 1e-6)), ds = [...new Set(doses.map((d) => Math.round(d * 10)))].filter((d) => d > 0);
  const best: { sum: number; n: number; last: number }[] = [{ sum: 0, n: 0, last: 0 }]; // best[c]: fill of c tenths or less
  for (let c = 1; c <= cap; c++) {
    let b = { ...best[c - 1], last: 0 };
    for (const d of ds) if (d <= c) {
      const p = best[c - d], cand = { sum: p.sum + d, n: p.n + 1, last: d };
      if (cand.sum > b.sum || (cand.sum === b.sum && cand.n < b.n)) b = cand;
    }
    best[c] = b;
  }
  const plan: number[] = [];
  for (let c = cap; c > 0 && best[c].sum > 0;) {
    if (best[c].last === 0) { c--; continue; }
    plan.push(best[c].last / 10);
    c -= best[c].last;
  }
  const used = plan.reduce((a, b) => a + b, 0);
  return { leftAfter: Math.round(left * 10) / 10, brews: plan.sort((a, b) => a - b), leftover: Math.round((left - used) * 10) / 10 };
}

interface Pick { tier: Tier; set: BrewRow[]; w: Map<BrewRow, number>; loose: boolean; counts: Map<Tier, number> }
interface PickOpts { anyGear?: boolean; /* dose / ratio: the same whatever gear is picked */ rest?: boolean; grinder?: string; maxTier?: Tier; factor?: (r: BrewRow) => number }

export interface Chosen { dose: number | null; ratio: number | null }
export function suggest(target: CoffeeDetails, rows: BrewRow[], gear: Gear, gc: GearClass, doses: number[], today: string,
  ratios: number[] = [], chosen: Chosen = { dose: null, ratio: null }): Suggestion {
  const tiers = new Map(rows.map((r) => [r, tierOf(target, r)]));
  const rated = rows.filter((r) => r.rating !== null);
  const tg = processGroup(target.processing);
  const phrase = (t: Tier) => ['', 'of this coffee', `of similar ${target.roaster} coffees`, `of other ${target.roaster} coffees`, target.decaf ? 'of similar decafs' : 'of similar coffees', 'of other coffees'][t];
  // "6 brews of this coffee" or, pooled, "3 brews: 1 of this coffee and 2 of similar decafs"
  const basisText = (p: Pick) => {
    const parts = [...p.counts].map(([t, n]) => `${n} ${phrase(t)}`);
    return p.counts.size === 1 ? `${brews(p.set.length)} ${phrase(p.tier)}` : `${brews(p.set.length)}: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };
  const label = (t: Tier) => ['', 'this coffee', 'same roaster, alike', 'same roaster, other', target.decaf ? 'similar decafs' : 'similar coffees', 'other coffees'][t];
  const weights = (set: BrewRow[], first: Tier, o: PickOpts) => {
    const med = median(set.map((r) => r.rating!));
    return new Map(set.map((r) => {
      const age = Math.max(0, daysBetween(r.localTime.slice(0, 10), today));
      const rest = o.rest && target.restDays !== null && r.restDays !== null ? 1 / (1 + Math.abs(r.restDays - target.restDays) / 14) : 1;
      const exact = !o.anyGear && r.dripper === gear.dripper && r.filter === gear.filter ? 2 : 1;
      const t = tiers.get(r)!, decaf = t === 2 || t === 3 || t === 5 ? (r.decaf === target.decaf ? 2 : 0.5) : 1;
      return [r, 0.5 ** (age / 90) * Math.max(r.rating! - med + 1, 0.25) * rest * exact * decaf * 0.5 ** (t - first) * (o.factor?.(r) ?? 1)] as const;
    }));
  };
  // The first tier with a rated, gear-compatible brew carrying the setting; thin (< 3) pools down into the next tiers at
  // half weight per step (best rated first). Gear is ignored only when the gear has no rated brew at all.
  const gearHas = rated.some((r) => compat(r, gear, gc));
  const pick = (has: (r: BrewRow) => boolean, o: PickOpts = {}): Pick | null => {
    const loose = !gearHas && !o.anyGear, max = o.maxTier ?? 5;
    const pool = rated.filter((r) => has(r) && (o.grinder === undefined || r.grinder === o.grinder) && (loose || o.anyGear || compat(r, gear, gc)));
    const at = (t: number) => pool.filter((r) => tiers.get(r) === t);
    const first = ([1, 2, 3, 4, 5] as Tier[]).find((t) => t <= max && at(t).length);
    if (!first) return null;
    let set = at(first);
    for (let t = first + 1; set.length < 3 && t <= max; t++) {
      set = [...set, ...at(t).sort((a, b) => b.rating! - a.rating! || b.localTime.localeCompare(a.localTime)).slice(0, 3 - set.length)];
    }
    const counts = new Map<Tier, number>();
    for (const r of set) counts.set(tiers.get(r)!, (counts.get(tiers.get(r)!) ?? 0) + 1);
    return { tier: first, set, w: weights(set, first, o), loose, counts };
  };
  const byWeight = (p: Pick) => [...p.set].sort((a, b) => p.w.get(b)! - p.w.get(a)!);
  const conf = (p: Pick): Confidence =>
    p.loose || p.tier === 5 ? 'guess' : p.tier === 1 ? ((p.counts.get(1) ?? 0) >= 3 ? 'high' : 'moderate') : p.tier === 2 ? 'moderate' : 'low';
  // "3 brews, this coffee" or, pooled, "3 brews, 1 this coffee + 2 similar coffees"
  const src = (p: Pick) => `${brews(p.set.length)}, ${p.counts.size === 1 ? label(p.tier) : [...p.counts].map(([t, n]) => `${n} ${label(t)}`).join(' + ')}`;

  // Plain sentences for the expanded row: what matters for this setting first, then what differs between the evidence brews.
  const WHAT: Record<Setting, string> = { grind: 'grind', temp: 'temperature', dose: 'dose', ratio: 'ratio', recipe: 'recipe', water: 'water choice' };
  const lurk = (p: Pick, setting: Setting): string[] => {
    const n = p.set.length, out: string[] = [], carry = `so their ${WHAT[setting]} may not carry over`;
    const most = (xs: string[]) => { const c = new Map<string, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]; };
    const otherDrip = p.set.flatMap((r) => (gear.dripper && r.dripper && r.dripper !== gear.dripper ? r.dripper : []));
    if (otherDrip.length) out.push(`${otherDrip.length} of these ${n} brews ${otherDrip.length === 1 ? 'was' : 'were'} on the ${most(otherDrip)[0]} rather than the ${gear.dripper}, ${carry}`);
    const otherGr = p.set.filter((r) => gear.grinder && r.grinder && r.grinder !== gear.grinder).length;
    if (setting !== 'grind' && otherGr) out.push(`${otherGr} of these ${n} brews ${otherGr === 1 ? 'was' : 'were'} made on another grinder, ${carry}`);
    const ts = p.set.flatMap((r) => r.tempC ?? []);
    if (setting !== 'temp' && ts.length > 1 && Math.max(...ts) - Math.min(...ts) >= 2) out.push(`Water temperatures in these brews ranged from ${num(Math.min(...ts))} to ${num(Math.max(...ts))} °C`);
    const ds = p.set.flatMap((r) => r.dose ?? []);
    if (setting !== 'dose' && ds.length > 1 && Math.max(...ds) - Math.min(...ds) >= 3) out.push(`Doses ranged from ${num(Math.min(...ds))} to ${num(Math.max(...ds))} g`);
    const ws = new Set(p.set.flatMap((r) => r.water?.trim() || []));
    if (setting !== 'water' && ws.size > 1) out.push(`These brews used ${ws.size} different waters`);
    const rs = new Set(p.set.map((r) => r.recipeName ?? ''));
    if (setting !== 'recipe' && rs.size > 1) out.push(`They also used ${rs.size} different recipes`);
    return out.slice(0, 2);
  };
  const used: Pick[] = []; // the evidence behind every filled row (for the footer)
  const synopsis = (p: Pick, setting: Setting, extras: string[]): string[] => {
    const rs = p.set.map((r) => r.rating!);
    const out = [...extras, ...lurk(p, setting)].map((x) => x.replace(/\.?$/, '.')).slice(0, 4);
    return out.length >= 2 ? out : [`This comes from ${basisText(p)}, rated ${range(rs).replace('–', ' to ')}.`, ...out];
  };
  const row = (setting: Setting, p: Pick, value: string, reason: string, link: string | null = null, extras: string[] = []): Row => {
    used.push(p);
    return {
      setting, value, reason: p.loose ? `No brews on this gear; ${reason}` : reason, tier: p.tier, confidence: conf(p),
      synopsis: synopsis(p, setting, p.loose ? ['You have no brews on this exact gear, so this uses other gear', ...extras] : extras),
      evidence: byWeight(p).slice(0, 8), link
    };
  };

  // Dose first: the grind leans on brews made with a similar dose.
  const snap = (v: number) => (doses.length ? doses.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : Math.round(v));
  const noData = (setting: Setting, what: string): Row =>
    ({ setting, value: null, reason: `No rated brews with ${what} on this gear`, tier: null, confidence: 'guess', synopsis: [], evidence: [], link: null });
  const stat = (get: (r: BrewRow) => number | null, o: PickOpts = {}) => {
    const p = pick((r) => get(r) !== null, o);
    return p ? { p, v: weightedMedian(p.set.map((r) => get(r)!), p.set.map((r) => p.w.get(r)!)) } : null;
  };
  const left = target.gramsLeft;
  // E1 (round 5): dose and ratio never depend on the gear picked; the filter's gear weight and pool were moving the dose.
  const dS = stat((r) => r.dose, { anyGear: true }), rS = stat((r) => (r.dose && r.waterG ? r.waterG / r.dose : null), { anyGear: true });
  const snapRatio = (v: number) => (ratios.length ? ratios.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : Math.round(v * 2) / 2);
  const sugDose = dS ? (() => { const d = snap(dS.v); return left !== null && left > 0 && left < d ? Math.round(left * 10) / 10 : d; })() : null; // never more than the bag holds
  const sugRatio = rS ? snapRatio(rS.v) : null;
  const brewDose = chosen.dose ?? sugDose, brewRatio = chosen.ratio ?? sugRatio;
  const water = brewDose !== null && brewRatio !== null ? Math.round(brewDose * brewRatio) : null;
  const want = chosen.dose ?? (dS ? snap(dS.v) : null); // the dose before the bag limit
  const plan = left !== null && brewDose !== null && want !== null && left >= want ? dosePlan(left - brewDose, doses) : null;
  const picked = (setting: Setting, value: string, suggested: string | null): Row => ({ setting, value, reason: suggested ? `Your choice; suggested ${suggested}` : 'Your choice',
    tier: null, confidence: 'guess', synopsis: [], evidence: [], link: null });
  const doseRow = ((): Row => {
    if (brewDose === null) return noData('dose', 'dose');
    const value = `${num(brewDose)} g${water !== null ? ` · ${water} g water` : ''}`;
    if (chosen.dose !== null && chosen.dose !== sugDose) return dS ? { ...row('dose', dS.p, value, `Your choice; suggested ${num(sugDose!)} g`), tier: dS.p.tier } : picked('dose', value, null);
    const d = brewDose;
    const say = left === null ? `Median ${num(dS!.v)} of ${src(dS!.p)}` : left < want! ? (left > 0 ? 'Use the rest of the bag' : 'The bag is empty')
      : left - d <= 1 ? `${num(d)} g uses the bag exactly`
      : `${num(d)} g leaves ${num(left - d)} g` + (plan?.brews.length ? `, enough for ${plan.brews.length} more ${plan.brews.length === 1 ? 'brew' : 'brews'}` : '');
    return row('dose', dS!.p, value, say, null, [`The typical dose in these brews is ${num(dS!.v)} g, rounded to your nearest saved dose`]);
  })();
  const ratioRow = ((): Row => {
    if (brewRatio === null) return noData('ratio', 'a water amount');
    if (chosen.ratio !== null && chosen.ratio !== sugRatio) return rS ? { ...row('ratio', rS.p, fmtRatio(brewRatio), `Your choice; suggested ${fmtRatio(sugRatio!)}`), tier: rS.p.tier } : picked('ratio', fmtRatio(brewRatio), null);
    return row('ratio', rS!.p, fmtRatio(brewRatio), `Median ${fmtRatio(rS!.v)} of ${src(rS!.p)}`, null,
      [`These brews ran about ${fmtRatio(rS!.v)}, and ${fmtRatio(brewRatio)} is the nearest ratio on your list`]);
  })();
  // E4: brews with a dose near the suggested one count more for grind.
  const doseFactor = (r: BrewRow) => (brewDose !== null && r.dose !== null ? 1 / (1 + Math.abs(r.dose - brewDose) / 2) : 1);

  // Grind: only the chosen grinder's brews, in its own scale. `plain` keeps a single setting (no range) for reference lists.
  const grindPick = (grinder: string, maxTier?: Tier) => pick((r) => lin(r.grind) !== null, { rest: true, grinder, maxTier, factor: doseFactor });
  const grindOn = (grinder: string, maxTier?: Tier, plain = false): { p: Pick; value: string; reason: string; extras: string[] } => {
    const p = grindPick(grinder, maxTier)!, k = parts(rows.filter((r) => r.grinder === grinder).map((r) => r.grind));
    const own = p.set.filter((r) => tiers.get(r) === p.tier);
    const med = weightedMedian(p.set.map((x) => lin(x.grind)!), p.set.map((x) => p.w.get(x)!));
    const doseNote = () => { // E4: the evidence's typical dose vs the one suggested
      const typical = weightedMedian(p.set.flatMap((x) => x.dose ?? []), p.set.filter((x) => x.dose !== null).map((x) => p.w.get(x)!));
      if (brewDose === null || !p.set.some((x) => x.dose !== null) || Math.abs(typical - brewDose) < 2) return [];
      return [brewDose > typical
        ? `These brews used about ${num(typical)} g and you'll brew ${num(brewDose)} g, and larger doses usually need a coarser grind`
        : `These brews used about ${num(typical)} g and you'll brew ${num(brewDose)} g, and smaller doses usually need a finer grind`];
    };
    if (p.tier === 1 && own.length >= 4) {
      const start = own.filter((r) => r.best).sort((a, b) => b.localTime.localeCompare(a.localTime))[0] ?? byWeight(p).find((r) => tiers.get(r) === 1)!;
      const s = lin(start.grind)!;
      const last = [...own].sort((a, b) => a.localTime.localeCompare(b.localTime) || a.id - b.id).slice(-6);
      const r = spearman(last.map((x) => lin(x.grind)!), last.map((x) => x.rating!));
      const all = own.map((x) => lin(x.grind)!);
      const dir = r !== null && Math.abs(r) >= 0.4 ? Math.sign(r) : 0; // + : higher settings rate higher (higher = coarser, R15)
      if ((dir > 0 && s >= Math.max(...all)) || (dir < 0 && s <= Math.min(...all))) {
        const far = fmtGrind(s + dir * grindStep(rows, grinder), k), best = start.best ? 'Best' : 'Top rated';
        const cup = `Your ${start.best ? 'best cup' : 'top-rated cup'} of this coffee was at ${start.grind}, and ratings climbed as you went ${dir > 0 ? 'coarser' : 'finer'}`;
        const trend = [cup, dir > 0
          ? 'Coarser grinds usually bring more clarity and a lighter body, but going much further risks a thin, sour cup (under-extraction)'
          : 'Finer grinds usually bring more sweetness and body, but going much further risks a bitter, dry cup (over-extraction)'];
        return { p, value: plain ? start.grind! : dir > 0 ? `${start.grind}–${far}` : `${far}–${start.grind}`,
          reason: `${best} at ${start.grind}; ${dir > 0 ? `up to ${far} for more clarity` : `down to ${far} for more sweetness`}`, extras: [...trend, ...doseNote()] };
      }
      return { p, value: start.grind!, reason: start.best ? `Best brew ${start.grind}` : `Top-weighted of ${src(p)}: ${start.grind}`,
        extras: [dir === 0 ? `Your ${start.best ? 'best cup' : 'top-rated cup'} was at ${start.grind}, and the latest brews show no clear pattern, so it starts from there`
          : `Your ${start.best ? 'best cup' : 'top-rated cup'} was at ${start.grind}, inside the range you have tried, so it stays there`, ...doseNote()] };
    }
    return { p, value: fmtGrind(med, k), reason: `Median of ${src(p)}`, extras: [`Higher settings are coarser, which brings more clarity and a lighter body, and lower ones are finer, with more sweetness and body`, ...doseNote()] };
  };
  const grindRow = (): Row => {
    if (gear.grinder && grindPick(gear.grinder)) {
      const g = grindOn(gear.grinder);
      return row('grind', g.p, g.value, g.reason, null, g.extras);
    }
    const reference = [...new Set(rated.flatMap((r) => (r.grinder && r.grinder !== gear.grinder && lin(r.grind) !== null ? r.grinder : [])))]
      .filter((grinder) => grindPick(grinder))
      .map((grinder) => ({ grinder, grind: grindOn(grinder, undefined, true).value }));
    const hasBrews = gear.grinder && rows.some((r) => r.grinder === gear.grinder);
    const reason = !hasBrews ? 'No data on this grinder yet' : gear.dripper ? `No ${gear.dripper} brews on this grinder yet` : 'No matching brews on this grinder yet';
    return { setting: 'grind', value: null, reason, tier: null, confidence: 'guess', synopsis: [], evidence: [], link: null, reference };
  };
  // E8: other grinders' best / typical setting from tier 1-3 brews, as plain reference.
  const otherGrinders = [...new Set(rated.flatMap((r) => (r.grinder && !r.grinderArchived && r.grinder !== gear.grinder && lin(r.grind) !== null ? r.grinder : [])))]
    .flatMap((grinder) => {
      if (!grindPick(grinder, 3)) return [];
      const g = grindOn(grinder, 3, true);
      return [{ grinder, grind: g.value, tier: g.p.tier, brews: g.p.set.length }];
    }).sort((a, b) => b.brews - a.brews || a.grinder.localeCompare(b.grinder));

  // E3: temps from the same process group count double, other processes half.
  const procFactor = (r: BrewRow) => (tg === OTHER ? 1 : r.processGroup === tg ? 2 : 0.5);
  const tempRow = ((): Row => {
    const t = stat((r) => r.tempC, { rest: true, factor: procFactor });
    if (!t) return noData('temp', 'temp');
    const p = t.p;
    const by = new Map<string, number[]>();
    for (const r of p.set) if (r.tempC !== null) by.set(r.processGroup, [...(by.get(r.processGroup) ?? []), r.tempC]);
    const mine = by.get(tg);
    const other = [...by].filter(([g]) => g !== tg).sort((a, b) => b[1].length - a[1].length)[0];
    if (!mine || !other || tg === OTHER) return row('temp', p, `${num(t.v)} °C`, `Median ${num(t.v)} °C of ${src(p)}`);
    const d = median(mine) - median(other[1]);
    return row('temp', p, `${num(t.v)} °C`, `Median ${num(t.v)} °C of ${src(p)}`, null, Math.abs(d) < 0.5 ? [] : [`Your ${tg.toLowerCase()} coffees ran about ${num(Math.abs(d))} °C ${d < 0 ? 'cooler' : 'warmer'} than ${other[0].toLowerCase()} ones`]);
  })();
  const groupRow = (setting: 'recipe' | 'water', key: (r: BrewRow) => string | number | null, name: (r: BrewRow) => string, link: (r: BrewRow) => string): Row => {
    const p = pick((r) => key(r) !== null);
    if (!p) return noData(setting, setting);
    const sums = new Map<string | number, { w: number; n: number; r: BrewRow }>();
    for (const r of p.set) { const s = sums.get(key(r)!); sums.set(key(r)!, { w: (s?.w ?? 0) + p.w.get(r)!, n: (s?.n ?? 0) + 1, r: s?.r ?? r }); }
    const [best, next] = [...sums.values()].sort((a, b) => b.w - a.w);
    return row(setting, p, name(best.r), `${best.n} of ${src(p)}`, link(best.r),
      [`${best.n} of these ${p.set.length} brews used ${name(best.r)}`, ...(next ? [`The next most common is ${name(next.r)}, with ${next.n} ${plural(next.n, 'brew', 'brews')}`] : [])]);
  };

  const rowsOut = [
    grindRow(), tempRow, doseRow, ratioRow,
    groupRow('recipe', (r) => r.recipeId, (r) => r.recipeName ?? '', (r) => `/recipes#recipe-${r.recipeId}`),
    groupRow('water', (r) => r.water?.trim() || null, (r) => r.water!, (r) => `/insights?tab=water&water=${encodeURIComponent(r.water!)}`)
  ];

  const filled = rowsOut.filter((r) => r.value !== null);
  const confidence = rowsOut.filter((r) => r.value !== null || r.setting === 'grind') // a missing grind drags it to guess
    .reduce<Confidence>((c, r) => (rank(r.confidence) < rank(c) ? r.confidence : c), 'high');
  const lead = used.length ? [...used].sort((a, b) => a.tier - b.tier || b.set.length - a.set.length)[0] : null; // the lowest tier, then the most brews
  const basis = lead ? `Based on ${basisText(lead)}.` : 'No brews to base this on yet.';
  const byCoffee = new Map<number, BasisCoffee>();
  for (const r of lead?.set ?? []) byCoffee.set(r.coffeeId, { slug: r.slug, name: r.coffeeName, roaster: r.roaster, brews: (byCoffee.get(r.coffeeId)?.brews ?? 0) + 1 });
  const lastNote = rows.filter((r) => tiers.get(r) === 1 && r.notes).sort((a, b) => b.localTime.localeCompare(a.localTime) || b.id - a.id)[0]?.notes ?? null;
  return {
    rows: rowsOut, confidence: filled.length ? confidence : 'guess', basis, lastNote, otherGrinders,
    dose: brewDose, ratio: brewRatio, suggestedDose: sugDose, suggestedRatio: sugRatio, dosePlan: plan,
    basisCoffees: [...byCoffee.values()].sort((a, b) => b.brews - a.brews || a.name.localeCompare(b.name))
  };
}

// E7: what this coffee's own brews say, for the chosen grinder. Notes only when asked for (they are admin-only, R9).
export function thisCoffeeSummary(target: CoffeeDetails, rows: BrewRow[], gear: Gear, withNotes: boolean): string[] {
  const mine = rows.filter((r) => tierOf(target, r) === 1);
  const rated = mine.filter((r) => r.rating !== null);
  if (!rated.length) return [];
  const out: string[] = [];
  const latest = (a: BrewRow, b: BrewRow) => b.localTime.localeCompare(a.localTime) || b.id - a.id;
  const on = rated.filter((r) => r.grinder === gear.grinder && lin(r.grind) !== null);
  const best = [...(on.length ? on : rated)].sort((a, b) => Number(b.best) - Number(a.best) || b.rating! - a.rating! || latest(a, b))[0];
  out.push(`${brews(rated.length)} rated, ${range(rated.map((r) => r.rating!))}`);
  out.push(`Best brew: ${[best.grinder, best.grind].filter(Boolean).join(' ') || 'no grind logged'}${best.tempC ? `, ${num(best.tempC)} °C` : ''}, rated ${best.rating}`);
  if (on.length >= 4 && best.grinder === gear.grinder) {
    const r = spearman(on.map((x) => lin(x.grind)!), on.map((x) => x.rating!));
    if (r !== null && Math.abs(r) >= 0.4) out.push(`On the ${gear.grinder}, ratings rise with ${r > 0 ? 'coarser' : 'finer'} settings`);
    const b = lin(best.grind)!, ok = (x: BrewRow) => x.rating! >= best.rating! - 1;
    const edge = (sign: 1 | -1) => on.filter((x) => (lin(x.grind)! - b) * sign >= 0 && ok(x)).map((x) => x.grind!).sort((x, y) => (lin(x)! - lin(y)!) * -sign)[0];
    const hi = edge(1), lo = edge(-1);
    if (on.some((x) => lin(x.grind)! > lin(hi)! && !ok(x))) out.push(`Ratings dropped above ${hi}`);
    if (on.some((x) => lin(x.grind)! < lin(lo)! && !ok(x))) out.push(`Ratings dropped below ${lo}`);
  }
  if (withNotes) {
    const noted = mine.filter((r) => r.notes).sort(latest).slice(0, 3);
    const asks = /\b(try|next time|more|less|too|finer|coarser|hotter|cooler)\b/i;
    for (const r of [...noted.filter((x) => asks.test(x.notes!)), ...noted].filter((x, i, l) => l.indexOf(x) === i).slice(0, 2)) {
      out.push(`Note, ${r.localTime.slice(0, 10)}: "${r.notes!.length > 80 ? r.notes!.slice(0, 77) + '...' : r.notes}"`);
    }
  }
  return out.slice(0, 5);
}

// Other coffees (tiers 2-4) brewed on this gear: same-roaster ones first, then best rated.
export function similarCoffees(target: CoffeeDetails, rows: BrewRow[], gear: Gear, gc: GearClass): SimilarCoffee[] {
  const by = new Map<number, BrewRow[]>();
  for (const r of rows) if (tierOf(target, r) >= 2 && tierOf(target, r) <= 4) if (compat(r, gear, gc)) by.set(r.coffeeId, [...(by.get(r.coffeeId) ?? []), r]);
  return [...by.values()].map((bs): SimilarCoffee => {
    const r0 = bs[0], rs = bs.flatMap((b) => b.rating ?? []);
    const g = bs.filter((b) => b.grinder === gear.grinder && lin(b.grind) !== null).sort((a, b) => lin(a.grind)! - lin(b.grind)!);
    const t = bs.flatMap((b) => b.tempC ?? []);
    const rc = new Map<string, number>();
    for (const b of bs) if (b.recipeName) rc.set(b.recipeName, (rc.get(b.recipeName) ?? 0) + 1);
    return {
      slug: r0.slug, roaster: r0.roaster, coffeeName: r0.coffeeName, tier: tierOf(target, r0) as 2 | 3 | 4, brews: bs.length,
      avgRating: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      grindRange: g.length ? [g[0].grind!, g[g.length - 1].grind!] : null,
      tempRange: t.length ? [Math.min(...t), Math.max(...t)] : null,
      topRecipe: [...rc].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    };
  }).sort((a, b) => a.tier - b.tier || (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.brews - a.brews).slice(0, 6);
}
