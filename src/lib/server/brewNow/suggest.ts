import { weightedMedian, spearman } from '../insights/stats';
import { daysBetween } from '../insights/time';
import { normalizeRoastLevel } from '../insights/facts';
import { processGroup } from '$lib/processGroups';
import type { BrewRow, CoffeeDetails, GearClass } from './load';

export type Setting = 'grind' | 'temp' | 'dose' | 'recipe' | 'water';
export type Confidence = 'good' | 'rough' | 'guess';
export interface Row {
  setting: Setting; value: string | null; reason: string; tier: 1 | 2 | 3 | 4 | null; confidence: Confidence;
  evidence: BrewRow[]; // up to 8, highest weight first, low ratings kept
  link: string | null; reference?: { grinder: string; grind: string }[] // grind with no data on this grinder
}
export interface Suggestion { rows: Row[]; confidence: Confidence; basis: string; lastNote: string | null }
export interface Gear { grinder: string | null; dripper: string | null; filter: string | null }
export interface SimilarCoffee {
  slug: string; roaster: string; coffeeName: string; tier: 2 | 3; brews: number; avgRating: number | null;
  grindRange: [string, string] | null; tempRange: [number, number] | null; topRecipe: string | null;
}
type Tier = 1 | 2 | 3 | 4;

const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
const OTHER = 'Other / Unknown';

// R2: the target's raw processing / roast level are normalized here; BrewRow already holds normalized ones.
export function tierOf(target: CoffeeDetails, row: BrewRow): Tier {
  if (norm(target.roaster) === norm(row.roaster) && norm(target.coffeeName) === norm(row.coffeeName)) return 1;
  const pg = processGroup(target.processing), samePg = pg !== OTHER && pg === row.processGroup;
  const sameOrigin = !!target.origin && norm(target.origin) === norm(row.origin);
  if (norm(target.roaster) === norm(row.roaster) && (sameOrigin || samePg)) return 2;
  const roast = normalizeRoastLevel(target.roastLevel);
  return samePg && !!roast && roast === row.roastLevel ? 3 : 4;
}

// A grind as one decimal number: "5.5" → 5.5, "1.4.5" → 1.45 (one digit per later part). Anything else is skipped
// ponytail: parts of 2+ digits ("6.10") are skipped, not ordered; add if a grinder needs them.
const lin = (g: string | null): number | null => {
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
// grinder's own decimals; 0.1 when no bag ever moved.
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

const TIER_LABEL = ['', 'this coffee', 'same roaster', 'similar coffees', 'all brews'];
const rank = (c: Confidence) => ['guess', 'rough', 'good'].indexOf(c);
const compat = (r: BrewRow, g: Gear, gc: GearClass) =>
  gc.dripper(r.dripper) === gc.dripper(g.dripper) && gc.filter(r.filter) === gc.filter(g.filter);

interface Pick { tier: Tier; set: BrewRow[]; w: Map<BrewRow, number>; loose: boolean }

export function suggest(target: CoffeeDetails, rows: BrewRow[], gear: Gear, gc: GearClass, doses: number[], today: string): Suggestion {
  const tiers = new Map(rows.map((r) => [r, tierOf(target, r)]));
  const rated = rows.filter((r) => r.rating !== null);
  const weights = (set: BrewRow[], useRest: boolean) => {
    const med = median(set.map((r) => r.rating!));
    return new Map(set.map((r) => {
      const age = Math.max(0, daysBetween(r.localTime.slice(0, 10), today));
      const rest = useRest && target.restDays !== null && r.restDays !== null ? 1 / (1 + Math.abs(r.restDays - target.restDays) / 14) : 1;
      const exact = r.dripper === gear.dripper && r.filter === gear.filter ? 2 : 1;
      return [r, 0.5 ** (age / 90) * Math.max(r.rating! - med + 1, 0.25) * rest * exact] as const;
    }));
  };
  // First tier with a rated, gear-compatible brew carrying the setting. Gear is ignored only when the gear has no rated brew at all.
  const gearHas = rated.some((r) => compat(r, gear, gc));
  const pick = (has: (r: BrewRow) => boolean, useRest: boolean, grinder?: string): Pick | null => {
    for (const loose of [!gearHas]) {
      const pool = rated.filter((r) => has(r) && (grinder === undefined || r.grinder === grinder) && (loose || compat(r, gear, gc)));
      for (const t of [1, 2, 3, 4] as Tier[]) {
        const set = pool.filter((r) => tiers.get(r) === t);
        if (set.length) return { tier: t, set, w: weights(set, useRest), loose };
      }
    }
    return null;
  };
  const byWeight = (p: Pick) => [...p.set].sort((a, b) => p.w.get(b)! - p.w.get(a)!);
  const conf = (p: Pick): Confidence => (p.loose || p.tier >= 3 ? 'guess' : p.tier === 1 && p.set.length >= 3 ? 'good' : 'rough');
  const row = (setting: Setting, p: Pick, value: string, reason: string, link: string | null = null): Row => ({
    setting, value, reason: p.loose ? `No brews on this gear; ${reason}` : reason, tier: p.tier, confidence: conf(p),
    evidence: byWeight(p).slice(0, 8), link
  });
  const src = (p: Pick) => `${p.set.length} ${p.set.length === 1 ? 'brew' : 'brews'}, ${TIER_LABEL[p.tier]}`;
  const num = (n: number) => String(Math.round(n * 10) / 10);

  // Grind: only the chosen grinder's brews, in its own scale.
  const grindPick = (grinder: string) => pick((r) => lin(r.grind) !== null, true, grinder);
  const grindOn = (grinder: string): { p: Pick; value: string; reason: string } => {
    const p = grindPick(grinder)!, k = parts(rows.filter((r) => r.grinder === grinder).map((r) => r.grind));
    const top = byWeight(p);
    if (p.tier === 1 && p.set.length >= 4) {
      const start = p.set.filter((r) => r.best).sort((a, b) => b.localTime.localeCompare(a.localTime))[0] ?? top[0];
      const s = lin(start.grind)!;
      const last = [...p.set].sort((a, b) => a.localTime.localeCompare(b.localTime) || a.id - b.id).slice(-6);
      const r = spearman(last.map((x) => lin(x.grind)!), last.map((x) => x.rating!));
      const all = p.set.map((x) => lin(x.grind)!);
      const dir = r !== null && Math.abs(r) >= 0.4 ? Math.sign(r) : 0; // + : higher settings rate higher
      if ((dir > 0 && s >= Math.max(...all)) || (dir < 0 && s <= Math.min(...all))) {
        const step = grindStep(rows, grinder);
        return { p, value: fmtGrind(s + dir * step, k), reason: `Best brew ${start.grind}; ${dir > 0 ? 'higher' : 'lower'} settings rated higher lately` };
      }
      return { p, value: start.grind!, reason: start.best ? `Best brew ${start.grind}` : `Top-weighted of ${src(p)}: ${start.grind}` };
    }
    const v = weightedMedian(p.set.map((x) => lin(x.grind)!), p.set.map((x) => p.w.get(x)!));
    return { p, value: fmtGrind(v, k), reason: `Median of ${src(p)}` };
  };
  const grindRow = (): Row => {
    if (gear.grinder && grindPick(gear.grinder)) {
      const g = grindOn(gear.grinder);
      return row('grind', g.p, g.value, g.reason);
    }
    const reference = [...new Set(rated.flatMap((r) => (r.grinder && r.grinder !== gear.grinder && lin(r.grind) !== null ? r.grinder : [])))]
      .filter((grinder) => grindPick(grinder))
      .map((grinder) => ({ grinder, grind: grindOn(grinder).value }));
    return { setting: 'grind', value: null, reason: 'No data on this grinder yet', tier: null, confidence: 'guess', evidence: [], link: null, reference };
  };

  const none = (setting: Setting, what: string): Row =>
    ({ setting, value: null, reason: `No rated brews with ${what} on this gear`, tier: null, confidence: 'guess', evidence: [], link: null });
  const numRow = (setting: 'temp' | 'dose', get: (r: BrewRow) => number | null, show: (v: number) => string, say: (v: number, p: Pick) => string): Row => {
    const p = pick((r) => get(r) !== null, setting === 'temp');
    if (!p) return none(setting, setting);
    const v = weightedMedian(p.set.map((r) => get(r)!), p.set.map((r) => p.w.get(r)!));
    return row(setting, p, show(v), say(v, p));
  };
  const groupRow = (setting: 'recipe' | 'water', key: (r: BrewRow) => string | number | null, name: (r: BrewRow) => string, link: (r: BrewRow) => string): Row => {
    const p = pick((r) => key(r) !== null, false);
    if (!p) return none(setting, setting);
    const sums = new Map<string | number, { w: number; n: number; r: BrewRow }>();
    for (const r of p.set) { const s = sums.get(key(r)!); sums.set(key(r)!, { w: (s?.w ?? 0) + p.w.get(r)!, n: (s?.n ?? 0) + 1, r: s?.r ?? r }); }
    const best = [...sums.values()].sort((a, b) => b.w - a.w)[0];
    return row(setting, p, name(best.r), `${best.n} of ${src(p)}`, link(best.r));
  };

  const dose = (): Row => numRow('dose', (r) => r.dose, (v) => {
    const d = doses.length ? doses.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : Math.round(v);
    return `${d} g`;
  }, (v, p) => {
    const d = doses.length ? doses.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : Math.round(v), left = target.gramsLeft;
    if (left === null) return `Median ${num(v)} of ${src(p)}`;
    if (left < d) return left > 0 ? `Only ${num(left)} g left in the bag` : 'No coffee left in the bag';
    const exact = doses.find((x) => left >= x && left % x <= 1);
    if (exact === d && left - d <= 1) return `${d} g uses the bag exactly`;
    return `${d} g leaves ${num(left - d)} g` + (exact === d ? ', one more brew' : exact ? `; ${exact} g uses the bag exactly` : '');
  });

  const rowsOut = [
    grindRow(),
    numRow('temp', (r) => r.tempC, (v) => `${num(v)} °C`, (v, p) => `Median ${num(v)} °C of ${src(p)}`),
    dose(),
    groupRow('recipe', (r) => r.recipeId, (r) => r.recipeName ?? '', (r) => `/account/recipes?brews=r${r.recipeId}`),
    groupRow('water', (r) => r.water?.trim() || null, (r) => r.water!, (r) => `/insights?tab=water&water=${encodeURIComponent(r.water!)}`)
  ];

  const filled = rowsOut.filter((r) => r.value !== null);
  const confidence = filled.reduce<Confidence>((c, r) => (rank(r.confidence) < rank(c) ? r.confidence : c), 'good');
  const top = filled.length ? Math.min(...filled.map((r) => r.tier!)) as Tier : null;
  const inTop = rated.filter((r) => tiers.get(r) === top), n = (inTop.filter((r) => compat(r, gear, gc)).length || inTop.length);
  const pg = processGroup(target.processing);
  const basis = top === null ? 'no brews yet' : `${top === 1 ? 'this coffee' : top === 2 ? `${target.roaster}${pg === OTHER ? '' : ` ${pg.toLowerCase()}`} coffees` : top === 3 ? 'similar coffees' : 'any coffee'}, ${n} ${n === 1 ? 'brew' : 'brews'}`;
  const lastNote = rows.filter((r) => tiers.get(r) === 1 && r.notes).sort((a, b) => b.localTime.localeCompare(a.localTime) || b.id - a.id)[0]?.notes ?? null;
  return { rows: rowsOut, confidence: filled.length ? confidence : 'guess', basis, lastNote };
}

// Other coffees (tiers 2–3) brewed on this gear: same-roaster ones first, then best rated.
export function similarCoffees(target: CoffeeDetails, rows: BrewRow[], gear: Gear, gc: GearClass): SimilarCoffee[] {
  const by = new Map<number, BrewRow[]>();
  for (const r of rows) if (tierOf(target, r) === 2 || tierOf(target, r) === 3) if (compat(r, gear, gc)) by.set(r.coffeeId, [...(by.get(r.coffeeId) ?? []), r]);
  return [...by.values()].map((bs): SimilarCoffee => {
    const r0 = bs[0], rs = bs.flatMap((b) => b.rating ?? []);
    const g = bs.filter((b) => b.grinder === gear.grinder && lin(b.grind) !== null).sort((a, b) => lin(a.grind)! - lin(b.grind)!);
    const t = bs.flatMap((b) => b.tempC ?? []);
    const rc = new Map<string, number>();
    for (const b of bs) if (b.recipeName) rc.set(b.recipeName, (rc.get(b.recipeName) ?? 0) + 1);
    return {
      slug: r0.slug, roaster: r0.roaster, coffeeName: r0.coffeeName, tier: tierOf(target, r0) as 2 | 3, brews: bs.length,
      avgRating: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      grindRange: g.length ? [g[0].grind!, g[g.length - 1].grind!] : null,
      tempRange: t.length ? [Math.min(...t), Math.max(...t)] : null,
      topRecipe: [...rc].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    };
  }).sort((a, b) => a.tier - b.tier || (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.brews - a.brews).slice(0, 6);
}
