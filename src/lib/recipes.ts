// Recipes as data: definition, parser, wording and brew matching (client-safe, no server imports).
import { FAST_GPS, capital, type PourReading, type Timeline } from './pours';

/** When a pour starts: null = unspecified (legacy), `after` = seconds after the previous pour, `low` = when the water runs low. */
export type Trigger = null | { kind: 'after'; targetS: number; maxS: number } | { kind: 'low' };
export interface RecipePour {
  bloom: boolean;
  grams: number | null;
  share: number | null;
  speed: 'fast' | 'slow';
  rateGps: [number, number] | null;
  agitation: 'high' | 'medium' | 'low' | null;
  tool: string | null;
  swirlAfter: boolean;
  /** Typical values, for the timeline. */
  startS: number | null;
  durationS: number | null;
  trigger: Trigger;
}
export interface RecipeDef {
  v: 1;
  pours: RecipePour[];
  pourCount: { min: number; max: number };
  bloomHoldS: number | null;
  bloomHoldTolS: number;
  /** Empty only in a draft whose brews have no ratio; the parser rejects it on save. */
  ratio: { targets: number[]; tol: number };
  tempC: number | null;
  totalS: number | null;
  notes: string | null;
  /** Only brews on one of these drippers match; empty = any. */
  drippers: string[];
  /** Pour speed is ignored when matching (a dripper that restricts flow makes it meaningless). */
  anySpeed: boolean;
  /** Every pour is an equal share of the water. */
  equalSplit: boolean;
}
export interface Recipe {
  id: number;
  name: string;
  tags: string[];
  def: RecipeDef;
}

const INVALID = 'Invalid recipe';
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const numOrNull = (x: unknown, min = 0): number | null => {
  if (x == null) return null;
  if (!isNum(x) || x < min) throw new Error(INVALID);
  return x;
};
const strOrNull = (x: unknown): string | null => {
  if (x == null || x === '') return null;
  if (typeof x !== 'string' || x.length > 40) throw new Error(INVALID);
  return x;
};
const oneOf = <T extends string>(x: unknown, ok: readonly T[]): T => {
  if (!ok.includes(x as T)) throw new Error(INVALID);
  return x as T;
};

function parseTrigger(t: unknown): Trigger {
  if (t == null) return null;
  if (!isObj(t)) throw new Error(INVALID);
  if (t.kind === 'low') return { kind: 'low' };
  if (t.kind !== 'after' || !isNum(t.targetS) || !isNum(t.maxS)) throw new Error(INVALID);
  if (!(t.targetS > 0 && t.maxS >= t.targetS && t.maxS <= 600)) throw new Error('Trigger time must be at least its target');
  return { kind: 'after', targetS: t.targetS, maxS: t.maxS };
}

function parsePour(p: unknown): RecipePour {
  if (!isObj(p) || typeof p.bloom !== 'boolean' || typeof p.swirlAfter !== 'boolean') throw new Error(INVALID);
  let rateGps: [number, number] | null = null;
  if (p.rateGps != null) {
    const r = p.rateGps;
    if (!Array.isArray(r) || r.length !== 2 || !isNum(r[0]) || !isNum(r[1]) || r[0] < 0 || r[1] < r[0])
      throw new Error(INVALID);
    rateGps = [r[0], r[1]];
  }
  return {
    bloom: p.bloom,
    grams: numOrNull(p.grams),
    share: numOrNull(p.share),
    speed: oneOf(p.speed, ['fast', 'slow'] as const),
    rateGps,
    agitation: p.agitation == null ? null : oneOf(p.agitation, ['high', 'medium', 'low'] as const),
    tool: strOrNull(p.tool),
    swirlAfter: p.swirlAfter,
    startS: numOrNull(p.startS),
    durationS: numOrNull(p.durationS),
    trigger: parseTrigger(p.trigger)
  };
}

export function parseRecipeDef(json: unknown): { def: RecipeDef } | { error: string } {
  try {
    if (!isObj(json) || json.v !== 1 || !Array.isArray(json.pours) || json.pours.length > 12)
      throw new Error(INVALID);
    if (!isObj(json.pourCount) || !isObj(json.ratio)) throw new Error(INVALID);
    const pours = json.pours.map(parsePour);
    if (pours[0]) pours[0].trigger = null;
    const { min, max } = json.pourCount;
    const { tol } = json.ratio;
    const raw = json.ratio.targets ?? [json.ratio.target];
    if (!Array.isArray(raw) || raw.length > 5 || !raw.every(isNum)) throw new Error(INVALID);
    const targets = [...new Set(raw)].sort((a, b) => a - b);
    if (!isNum(min) || !isNum(max) || !Number.isInteger(min) || !Number.isInteger(max) || !isNum(tol) || !isNum(json.bloomHoldTolS))
      throw new Error(INVALID);
    const bloomHoldS = numOrNull(json.bloomHoldS);
    const tempC = numOrNull(json.tempC, -Infinity);
    const totalS = numOrNull(json.totalS);
    const notes = strOrNull(json.notes);
    const drippers = json.drippers ?? [];
    if (!Array.isArray(drippers) || drippers.length > 10) throw new Error(INVALID);
    for (const d of drippers) if (typeof d !== 'string' || !d || d.length > 40) throw new Error(INVALID);
    if (json.anySpeed != null && typeof json.anySpeed !== 'boolean') throw new Error(INVALID);
    if (json.equalSplit != null && typeof json.equalSplit !== 'boolean') throw new Error(INVALID);
    if (json.bloomHoldTolS < 0) throw new Error(INVALID);
    if (!pours.length) throw new Error('Add at least one pour');
    const blooms = pours.filter((p) => p.bloom).length;
    if (blooms > 3) throw new Error('Blooms come first');
    if (pours.slice(0, blooms).some((p) => !p.bloom)) throw new Error('Blooms come first');
    if (!(min >= 1 && min <= pours.length && pours.length <= max && max <= 12))
      throw new Error('Pour count range must include the pours listed');
    if (!targets.length) throw new Error('Add a ratio');
    if (targets.some((t) => t < 5 || t > 30) || tol < 0.1 || tol > 3) throw new Error('Ratio must be between 1:5 and 1:30');
    if (tempC != null && (tempC < 60 || tempC > 100)) throw new Error('Temperature must be 60-100 °C');
    return {
      def: {
        v: 1,
        pours,
        pourCount: { min, max },
        bloomHoldS,
        bloomHoldTolS: json.bloomHoldTolS,
        ratio: { targets, tol },
        tempC,
        totalS,
        notes,
        drippers: [...new Set(drippers as string[])],
        anySpeed: json.anySpeed === true,
        equalSplit: json.equalSplit === true
      }
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : INVALID };
  }
}

/** Fills what older stored defs lack; no validation (they were validated when saved). */
export function withDefaults(raw: unknown): RecipeDef {
  const d = raw as Obj & { ratio: { target?: number | null; targets?: number[]; tol: number }; pours: RecipePour[] };
  const { target, targets, tol } = d.ratio ?? ({} as Partial<typeof d.ratio>); // partial test fixtures have none
  return {
    drippers: [],
    anySpeed: false,
    equalSplit: false,
    ...d,
    pours: (d.pours ?? []).map((p) => ({ ...p, trigger: p.trigger ?? null })),
    ratio: { targets: targets ?? (target == null ? [] : [target]), tol }
  } as unknown as RecipeDef;
}

export function parseRecipeInput(
  name: string,
  tags: string
): { name: string; tags: string[] } | { error: string } {
  const n = name.trim();
  if (!n || n.length > 40) return { error: 'Name the recipe' };
  const t = tags.split(',').map((s) => s.trim()).filter(Boolean);
  if (t.length > 10 || t.some((s) => s.length > 40)) return { error: 'Invalid recipe' };
  return { name: n, tags: t };
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x: number | null, d = 1): number | null => (x == null ? null : +x.toFixed(d));

export function draftFromReadings(readings: PourReading[], tempsC: (number | null)[]): RecipeDef {
  // pour count shared by most readings (the group's structure key makes them agree)
  const counts = new Map<number, number>();
  for (const r of readings) counts.set(r.pours.length, (counts.get(r.pours.length) ?? 0) + 1);
  const n = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1;
  const rs = readings.filter((r) => r.pours.length === n);
  const col = (i: number, f: (r: PourReading) => number) => median(rs.map(f).filter(isNum)); // pour i
  const grams = Array.from({ length: n }, (_, i) => round(col(i, (r) => r.pours[i].grams)));
  const total = grams.reduce<number>((s, g) => s + (g ?? 0), 0);
  const half = (f: (r: PourReading) => boolean) => rs.filter(f).length * 2 >= rs.length;
  const pours: RecipePour[] = Array.from({ length: n }, (_, i) => ({
    bloom: half((r) => r.pours[i].bloom),
    grams: grams[i],
    share: total > 0 && grams[i] != null ? round(grams[i]! / total, 2) : null,
    speed: half((r) => r.pours[i].speed === 'fast') ? 'fast' : 'slow',
    rateGps: null,
    agitation: null,
    tool: null,
    swirlAfter: half((r) => r.swirls.some((w) => w.afterPour === i)),
    startS: round(col(i, (r) => r.pours[i].startS)),
    durationS: round(col(i, (r) => r.pours[i].durationS)),
    trigger: null
  }));
  const ratio = median(rs.map((r) => r.ratio).filter(isNum));
  return {
    v: 1,
    pours,
    pourCount: { min: n, max: n },
    bloomHoldS: round(median(rs.map((r) => r.bloomHoldS).filter(isNum))),
    bloomHoldTolS: 5,
    ratio: { targets: ratio == null ? [] : [round(ratio)!], tol: 0.5 },
    tempC: round(median(tempsC.filter(isNum))),
    totalS: round(median(rs.map((r) => r.totalS)), 0),
    notes: null,
    drippers: [],
    anySpeed: false,
    equalSplit: false
  };
}

/**
 * Switch every pour between grams and shares of the water. g to %: each pour's share of the summed grams (to 0.1 %,
 * the last pour absorbing rounding so shares sum to 1). % to g: shares times `totalG`, the water remembered from the
 * last grams state; with no total the grams stay null (never invent one) and the shares are kept.
 */
export function convertAmounts(
  pours: RecipePour[],
  to: 'g' | '%',
  totalG: number | null
): { pours: RecipePour[]; totalG: number | null } {
  if (to === '%') {
    const sum = pours.reduce((t, p) => t + (p.grams ?? 0), 0);
    if (sum <= 0) return { pours: pours.map((p) => ({ ...p })), totalG };
    const withGrams = pours.flatMap((p, i) => (p.grams != null ? [i] : []));
    const last = withGrams[withGrams.length - 1];
    let used = 0;
    const out = pours.map((p, i) => {
      if (p.grams == null) return { ...p };
      const share = i === last ? +(1 - used).toFixed(3) : +(Math.round((p.grams / sum) * 1000) / 1000).toFixed(3);
      used += share;
      return { ...p, share, grams: null };
    });
    return { pours: out, totalG: sum };
  }
  return {
    pours: pours.map((p) => ({
      ...p,
      grams: p.share != null && totalG != null ? round(p.share * totalG) : p.grams,
      share: p.share != null && totalG != null ? null : p.share
    })),
    totalG
  };
}

const recipeSpeed = (p: RecipePour): 'fast' | 'slow' =>
  p.rateGps ? ((p.rateGps[0] + p.rateGps[1]) / 2 >= FAST_GPS ? 'fast' : 'slow') : p.speed;
const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const fmtHold = (s: number) => Math.round(s / 5) * 5;

export function describeRecipe(def: RecipeDef): string {
  const blooms = def.pours.filter((p) => p.bloom).length;
  const hold = def.bloomHoldS == null ? '' : `${fmtHold(def.bloomHoldS)} s `;
  const parts: string[] = [];
  if (blooms === 1) parts.push(`${hold}bloom`);
  else if (blooms > 1) parts.push(`${['', '', 'two', 'three'][blooms] ?? blooms} ${hold}blooms`);
  const kinds: { kind: 'fast' | 'slow' | 'any'; n: number }[] = [];
  for (const p of def.pours.slice(blooms)) {
    const kind = def.anySpeed ? 'any' : recipeSpeed(p);
    const l = kinds[kinds.length - 1];
    if (l?.kind === kind) l.n++;
    else kinds.push({ kind, n: 1 });
  }
  const names = { fast: ['fast pour', 'fast pours'], slow: ['slow pour', 'slow pours'], any: ['pour', 'pours'] };
  kinds.forEach((k, i) => {
    let lo = k.n;
    let hi = k.n;
    if (i === kinds.length - 1) {
      lo = Math.max(1, k.n - (def.pours.length - def.pourCount.min));
      hi = k.n + (def.pourCount.max - def.pours.length);
    }
    parts.push(`${lo === hi ? lo : `${lo}-${hi}`} ${names[k.kind][hi === 1 ? 0 : 1]}`);
  });
  const out = [parts.join(' + ')];
  const sw = def.pours.flatMap((p, i) => (p.swirlAfter ? [i] : []));
  if (sw.length > 2) out.push(`${sw.length} swirls`);
  else if (sw.length)
    out.push(sw.map((i) => (i < blooms ? 'swirl after bloom' : `swirl after pour ${i + 1}`)).join(', '));
  const ts = def.ratio.targets.map((t) => +t.toFixed(1));
  out.push(ts.length ? `~1:${ts.join(', ').replace(/, ([^,]*)$/, ' or $1')}` : 'ratio unknown');
  if (def.anySpeed) out.push('any pour speed');
  if (def.drippers.length) out.push(`on ${def.drippers.join(', ').replace(/, ([^,]*)$/, ' or $1')}`);
  return capital(out.join(' · '));
}

export function recipeTimeline(def: RecipeDef): Timeline {
  let t = 0;
  const pours = def.pours.map((p) => {
    const startS = p.startS ?? t;
    const durationS = p.durationS ?? 0;
    t = startS + durationS;
    return {
      startS,
      durationS,
      grams: p.grams ?? (p.share ?? 0) * 100, // a % recipe: shares at 100 g per 100 %, the chart only needs proportions
      kind: p.bloom ? ('bloom' as const) : recipeSpeed(p)
    };
  });
  const swirls = def.pours.flatMap((p, i) => (p.swirlAfter ? [pours[i].startS + pours[i].durationS] : []));
  return { pours, swirls, totalS: def.totalS ?? t };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Index of the first whole-word, case-insensitive hit of `term` in `text`, -1 for none. */
export function hasWord(text: string, term: string): number {
  return new RegExp(`(?<![A-Za-z0-9])${esc(term)}(?![A-Za-z0-9])`, 'i').exec(text)?.index ?? -1;
}
/** The recipe whose name or tag appears first in the note, as a whole word. */
export function noteTag(note: string | null, recipes: Recipe[]): Recipe | null {
  if (!note) return null;
  let best: { at: number; r: Recipe } | null = null;
  for (const r of recipes)
    for (const term of [r.name, ...r.tags]) {
      if (!term.trim()) continue;
      const at = hasWord(note, term.trim());
      if (at >= 0 && (!best || at < best.at)) best = { at, r };
    }
  return best?.r ?? null;
}

export type Match = {
  recipeId: number;
  how: 'logged' | 'match' | 'modified';
  diffs: { text: string; modified: boolean }[];
  distance: number;
};
export interface MatchBrew {
  notes: string | null;
  reading: PourReading | null;
  tempC: number | null;
  dripper?: string | null;
}

export const SHARE_TOL = 0.06, TRIGGER_GRACE_S = 5, TEMP_TOL_C = 2;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Target share per brew pour (length n), or null when the share gate doesn't apply. */
export function recipeShares(def: RecipeDef, n: number): number[] | null {
  if (def.equalSplit) return Array<number>(n).fill(1 / n);
  if (n !== def.pours.length) return null;
  const amounts = def.pours.map((p) => p.share ?? p.grams);
  const total = sum(amounts.map((a) => a ?? 0));
  return amounts.some((a) => a == null) || total <= 0 ? null : amounts.map((a) => a! / total);
}
const sharesFor = (def: RecipeDef, r: PourReading) =>
  sum(r.pours.map((p) => p.grams)) > 0 ? recipeShares(def, r.pours.length) : null;

function diffsOf(def: RecipeDef, r: PourReading, tempC: number | null, sharesApplied = false) {
  const out: Match['diffs'] = [];
  const n = r.pours.length;
  if (n < def.pourCount.min || n > def.pourCount.max) out.push({ text: `${n} pours`, modified: true });
  const blooms = def.pours.filter((p) => p.bloom).length;
  if (!sharesApplied && r.bloomCount !== blooms)
    out.push({
      text: r.bloomCount === 2 ? 'two blooms' : r.bloomCount === 0 ? 'no bloom' : `${r.bloomCount} bloom${r.bloomCount === 1 ? '' : 's'}`,
      modified: true
    });
  if (r.bloomHoldS != null && def.bloomHoldS != null && Math.abs(r.bloomHoldS - def.bloomHoldS) > def.bloomHoldTolS)
    out.push({ text: `${fmtHold(r.bloomHoldS)} s bloom${r.bloomCount === 1 ? '' : 's'}`, modified: true });
  if (tempC && def.tempC && Math.abs(tempC - def.tempC) > 1)
    out.push({ text: `${+tempC.toFixed(1)} °C vs ${+def.tempC.toFixed(1)} °C`, modified: Math.abs(tempC - def.tempC) > TEMP_TOL_C });
  if (def.totalS != null && Math.abs(r.totalS - def.totalS) > 20)
    out.push({ text: `${mmss(r.totalS)} total vs ${mmss(def.totalS)}`, modified: false });
  return out;
}

export interface Fit {
  pass: boolean;
  failed: 'dripper' | 'count' | 'pattern' | 'shares' | 'ratio' | 'blooms' | null;
  how: 'match' | 'modified';
  diffs: Match['diffs'];
  distance: number;
}
/** How well a recipe fits a brew: the first failed gate (diffs and distance are filled in regardless, for ranking). */
export function fitRecipe(def: RecipeDef, brew: MatchBrew, ctx: { recipes: Recipe[]; locked: ReadonlySet<string> }): Fit {
  const { reading: r } = brew;
  if (!r || r.ratio == null || !r.pours.length) return { pass: false, failed: 'count', how: 'match', diffs: [], distance: Infinity };
  const n = r.pours.length;
  // A recipe tied to drippers never matches another; a locked dripper's brews match only recipes listing it (the lock only counts while a recipe lists it).
  const d = brew.dripper;
  const dripperBad = def.drippers.length
    ? !d || !def.drippers.includes(d)
    : !!d && ctx.locked.has(d) && ctx.recipes.some((x) => x.def.drippers.includes(d));
  const countBad = n < def.pourCount.min || n > def.pourCount.max;

  const speeds = def.pours.map(recipeSpeed);
  const aligned = r.pours.map((_, i) => speeds[Math.min(i, speeds.length - 1)]);
  const patternBad = !def.anySpeed && aligned.map((s) => (s === 'fast' ? 'F' : 'S')).join('') !== r.pattern.toUpperCase();

  const shares = sharesFor(def, r);
  const trig = (i: number) => def.pours[i]?.trigger ?? null;
  let devs: number[] = [];
  if (shares) {
    const total = sum(r.pours.map((p) => p.grams));
    const groups: number[][] = [];
    for (let i = 0; i < n; i++) {
      if (i > 0 && trig(i)?.kind === 'low' && trig(i - 1)?.kind === 'low') groups[groups.length - 1].push(i);
      else groups.push([i]);
    }
    devs = groups.map((g) => Math.abs(sum(g.map((i) => r.pours[i].grams / total)) - sum(g.map((i) => shares[i]))));
  }
  const dev = devs.length ? sum(devs) / devs.length : 0;
  const sharesBad = devs.some((x) => x > SHARE_TOL + 1e-9);

  const off = Math.min(...def.ratio.targets.map((t) => Math.abs(r.ratio! - t)));
  const ratioBad = !(off <= def.ratio.tol);
  const bloomsBad = !shares && def.anySpeed && r.bloomCount !== def.pours.filter((p) => p.bloom).length;

  const diffs = diffsOf(def, r, brew.tempC, !!shares);
  if (shares) {
    for (let i = 1; i < n; i++) {
      const t = trig(i);
      if (t?.kind !== 'after') continue;
      const gap = r.pours[i].startS - r.pours[i - 1].startS;
      if (gap < t.targetS - TRIGGER_GRACE_S || gap > t.maxS + TRIGGER_GRACE_S)
        diffs.push({ text: `pour ${i + 1} after ${Math.round(gap)} s`, modified: true });
    }
  }
  const speedException = patternBad && !!shares && !sharesBad && !ratioBad && !countBad;
  if (speedException) {
    const wrong = [...r.pattern.toUpperCase()].filter((c, i) => c !== (aligned[i] === 'fast' ? 'F' : 'S'));
    diffs.push({ text: wrong.every((c) => c === 'S') ? 'slow pours' : wrong.every((c) => c === 'F') ? 'fast pours' : 'pour speeds', modified: true });
  }

  const failed = dripperBad ? 'dripper' : countBad ? 'count'
    : patternBad && !speedException ? 'pattern' : sharesBad ? 'shares' : ratioBad ? 'ratio' : bloomsBad ? 'blooms' : null;
  const mods = diffs.filter((x) => x.modified).length;
  const tempTerm = brew.tempC && def.tempC ? Math.abs(brew.tempC - def.tempC) / TEMP_TOL_C : 0;
  return {
    pass: failed == null, failed, how: mods ? 'modified' : 'match', diffs,
    distance: off / def.ratio.tol + 0.5 * mods + dev / SHARE_TOL + tempTerm
  };
}

/** The recipe a brew is logged as or looks like, or null. */
export function matchBrew(brew: MatchBrew, recipes: Recipe[], locked: ReadonlySet<string> = new Set()): Match | null {
  const { reading: r } = brew;
  const tagged = noteTag(brew.notes, recipes);
  if (tagged)
    return {
      recipeId: tagged.id,
      how: 'logged',
      diffs: r ? diffsOf(tagged.def, r, brew.tempC) : [],
      distance: 0
    };
  if (!r || r.ratio == null || !r.pours.length) return null;
  let best: Match | null = null;
  for (const { id, def } of recipes) {
    const fit = fitRecipe(def, brew, { recipes, locked });
    if (fit.pass && (!best || fit.distance < best.distance || (fit.distance === best.distance && id < best.recipeId)))
      best = { recipeId: id, how: fit.how, diffs: fit.diffs, distance: fit.distance };
  }
  return best;
}

export function middleHalf(seconds: number[]): { lo: number; hi: number; n: number } | null {
  const v = seconds.filter((s) => s > 0).sort((a, b) => a - b);
  if (v.length < 4) return null;
  const at = (q: number) => {
    const i = (v.length - 1) * q;
    return v[Math.floor(i)] + (v[Math.ceil(i)] - v[Math.floor(i)]) * (i - Math.floor(i));
  };
  return { lo: Math.round(at(0.25)), hi: Math.round(at(0.75)), n: v.length };
}

export const fmtRange = (r: { lo: number; hi: number }) => `${mmss(r.lo)}–${mmss(r.hi)}`;
