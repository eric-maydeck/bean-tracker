// Recipes as data: definition, parser, wording and brew matching (client-safe, no server imports).
import { FAST_GPS, capital, type PourReading, type Timeline } from './pours';

export interface RecipePour {
  bloom: boolean;
  grams: number | null;
  share: number | null;
  speed: 'fast' | 'slow';
  rateGps: [number, number] | null;
  agitation: 'high' | 'low' | null;
  tool: string | null;
  swirlAfter: boolean;
  /** Typical values, for the timeline. */
  startS: number | null;
  durationS: number | null;
}
export interface RecipeDef {
  v: 1;
  pours: RecipePour[];
  pourCount: { min: number; max: number };
  bloomHoldS: number | null;
  bloomHoldTolS: number;
  ratio: { target: number; tol: number };
  tempC: number | null;
  totalS: number | null;
  notes: string | null;
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
    agitation: p.agitation == null ? null : oneOf(p.agitation, ['high', 'low'] as const),
    tool: strOrNull(p.tool),
    swirlAfter: p.swirlAfter,
    startS: numOrNull(p.startS),
    durationS: numOrNull(p.durationS)
  };
}

export function parseRecipeDef(json: unknown): { def: RecipeDef } | { error: string } {
  try {
    if (!isObj(json) || json.v !== 1 || !Array.isArray(json.pours) || json.pours.length > 12)
      throw new Error(INVALID);
    if (!isObj(json.pourCount) || !isObj(json.ratio)) throw new Error(INVALID);
    const pours = json.pours.map(parsePour);
    const { min, max } = json.pourCount;
    const { target, tol } = json.ratio;
    if (!isNum(min) || !isNum(max) || !isNum(target) || !isNum(tol) || !isNum(json.bloomHoldTolS))
      throw new Error(INVALID);
    const bloomHoldS = numOrNull(json.bloomHoldS);
    const tempC = numOrNull(json.tempC, -Infinity);
    const totalS = numOrNull(json.totalS);
    const notes = strOrNull(json.notes);
    if (json.bloomHoldTolS < 0) throw new Error(INVALID);
    if (!pours.length) throw new Error('Add at least one pour');
    const blooms = pours.filter((p) => p.bloom).length;
    if (blooms > 3) throw new Error('Blooms come first');
    if (pours.slice(0, blooms).some((p) => !p.bloom)) throw new Error('Blooms come first');
    if (!(min >= 1 && min <= pours.length && pours.length <= max && max <= 12))
      throw new Error('Pour count range must include the pours listed');
    if (target < 5 || target > 30 || tol < 0.1 || tol > 3) throw new Error('Ratio must be between 1:5 and 1:30');
    if (tempC != null && (tempC < 60 || tempC > 100)) throw new Error('Temperature must be 60-100 °C');
    return {
      def: {
        v: 1,
        pours,
        pourCount: { min, max },
        bloomHoldS,
        bloomHoldTolS: json.bloomHoldTolS,
        ratio: { target, tol },
        tempC,
        totalS,
        notes
      }
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : INVALID };
  }
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
    durationS: round(col(i, (r) => r.pours[i].durationS))
  }));
  const ratio = median(rs.map((r) => r.ratio).filter(isNum));
  return {
    v: 1,
    pours,
    pourCount: { min: n, max: n },
    bloomHoldS: round(median(rs.map((r) => r.bloomHoldS).filter(isNum))),
    bloomHoldTolS: 5,
    ratio: { target: round(ratio) ?? 16, tol: 0.7 },
    tempC: round(median(tempsC.filter(isNum))),
    totalS: round(median(rs.map((r) => r.totalS)), 0),
    notes: null
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
  else if (blooms > 1) parts.push(`two ${hold}blooms`);
  const kinds: { kind: 'fast' | 'slow'; n: number }[] = [];
  for (const p of def.pours.slice(blooms)) {
    const kind = recipeSpeed(p);
    const l = kinds[kinds.length - 1];
    if (l?.kind === kind) l.n++;
    else kinds.push({ kind, n: 1 });
  }
  const names = { fast: ['fast pour', 'fast pours'], slow: ['slow pour', 'slow pours'] };
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
  out.push(`~1:${+def.ratio.target.toFixed(1)}`);
  if (def.totalS != null) out.push(`${mmss(def.totalS)} total`);
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
      grams: p.grams ?? 0,
      kind: p.bloom ? ('bloom' as const) : recipeSpeed(p)
    };
  });
  const swirls = def.pours.flatMap((p, i) => (p.swirlAfter ? [pours[i].startS + pours[i].durationS] : []));
  return { pours, swirls, totalS: def.totalS ?? t };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The recipe whose name or tag appears first in the note, as a whole word. */
export function noteTag(note: string | null, recipes: Recipe[]): Recipe | null {
  if (!note) return null;
  let best: { at: number; r: Recipe } | null = null;
  for (const r of recipes)
    for (const term of [r.name, ...r.tags]) {
      if (!term.trim()) continue;
      const m = new RegExp(`(?<![A-Za-z0-9])${esc(term.trim())}(?![A-Za-z0-9])`, 'i').exec(note);
      if (m && (!best || m.index < best.at)) best = { at: m.index, r };
    }
  return best?.r ?? null;
}

export type Match = {
  recipeId: number;
  how: 'logged' | 'match' | 'modified';
  diffs: { text: string; modified: boolean }[];
  distance: number;
};
interface MatchBrew {
  notes: string | null;
  reading: PourReading | null;
  tempC: number | null;
}

function diffsOf(def: RecipeDef, r: PourReading, tempC: number | null) {
  const out: Match['diffs'] = [];
  const n = r.pours.length;
  if (n < def.pourCount.min || n > def.pourCount.max) out.push({ text: `${n} pours`, modified: true });
  const blooms = def.pours.filter((p) => p.bloom).length;
  if (r.bloomCount !== blooms)
    out.push({
      text: r.bloomCount === 2 ? 'two blooms' : r.bloomCount === 0 ? 'no bloom' : `${r.bloomCount} bloom${r.bloomCount === 1 ? '' : 's'}`,
      modified: true
    });
  if (r.bloomHoldS != null && def.bloomHoldS != null && Math.abs(r.bloomHoldS - def.bloomHoldS) > def.bloomHoldTolS)
    out.push({ text: `${fmtHold(r.bloomHoldS)} s bloom${r.bloomCount === 1 ? '' : 's'}`, modified: true });
  if (tempC != null && def.tempC != null && Math.abs(tempC - def.tempC) > 1)
    out.push({ text: `${+tempC.toFixed(1)} °C vs ${+def.tempC.toFixed(1)} °C`, modified: false });
  if (def.totalS != null && Math.abs(r.totalS - def.totalS) > 20)
    out.push({ text: `${mmss(r.totalS)} total vs ${mmss(def.totalS)}`, modified: false });
  return out;
}

/** The recipe a brew is logged as or looks like, or null. */
export function matchBrew(brew: MatchBrew, recipes: Recipe[]): Match | null {
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
    const speeds = def.pours.map(recipeSpeed);
    const aligned = r.pours.map((_, i) => speeds[Math.min(i, speeds.length - 1)]);
    if (aligned.map((s) => (s === 'fast' ? 'F' : 'S')).join('') !== r.pattern.toUpperCase()) continue;
    if (Math.abs(r.ratio - def.ratio.target) > def.ratio.tol) continue;
    const diffs = diffsOf(def, r, brew.tempC);
    const mods = diffs.filter((d) => d.modified).length;
    const distance = Math.abs(r.ratio - def.ratio.target) / def.ratio.tol + 0.5 * mods;
    if (!best || distance < best.distance || (distance === best.distance && id < best.recipeId))
      best = { recipeId: id, how: mods ? 'modified' : 'match', diffs, distance };
  }
  return best;
}
