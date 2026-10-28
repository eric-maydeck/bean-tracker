// The Pours tab: recipes and pour technique against rating, always as same-bag paired deltas (lab.ts).
import type { DatabaseSync } from 'node:sqlite';
import { MON } from '$lib/insightsUrl';
import { AGITATION_LABEL, brewAgitation, sequenceLabel, type Agitation, type BrewAgitation } from '$lib/agitation';
import type { PourReading } from '$lib/pours';
import type { Match, Recipe } from '$lib/recipes';
import { pooled, type Sample } from '$lib/sample';
import { getNoteWords, listRecipes } from '$lib/server/recipes';
import { WAIT_BUCKETS, waitBucket, type BrewFact } from './facts';
import { SLICE_OF, breakdown, labFn, pairedDeltas, type BandFn, type BandStat, type Breakdown } from './lab';
import type { Band } from './labBands';
import { groupBy } from './records';
import { demeaned, mean } from './stats';

export interface PourFact {
  brewId: number; recipeId: number | null; how: Match['how'] | null; reading: PourReading | null;
  agitation: BrewAgitation; agitationSet: boolean; words: string[];
  sequence: string | null; // a Mixed brew's pour-by-pour label ("High then Low"); null when not every pour is known
}

export const FLAVOR_WORDS: readonly { label: string; terms: readonly string[] }[] = [
  { label: 'Bright', terms: ['bright', 'acid', 'tart', 'juicy'] }, { label: 'Sour', terms: ['sour'] },
  { label: 'Floral', terms: ['floral'] }, { label: 'Sweet', terms: ['sweet'] }, { label: 'Clean', terms: ['clean', 'clarity'] },
  { label: 'Bitter', terms: ['bitter'] }, { label: 'Brown', terms: ['brown', 'roasty'] }, { label: 'Astringent', terms: ['astringent'] }
];
// A term at a word start; the rest of the word is free ("acid" finds "acidic"). Terms are plain letters.
const WORD_RES = FLAVOR_WORDS.map((w) => ({ label: w.label, res: w.terms.map((t) => new RegExp(`(?<![A-Za-z0-9])${t}\\w*`, 'i')) }));
const wordsIn = (note: string | null): string[] =>
  note ? WORD_RES.filter((w) => w.res.some((re) => re.test(note))).map((w) => w.label) : [];

export function loadPourFacts(db: DatabaseSync, brews: readonly BrewFact[]): { facts: Map<number, PourFact>; recipes: Recipe[] } {
  const recipes = listRecipes(db), words = getNoteWords(db);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const dripper = new Map(brews.map((b) => [b.id, b.dripper]));
  const blind = new Set(recipes.filter((r) => r.def.anySpeed).flatMap((r) => r.def.drippers));
  const rows = db.prepare(
    `SELECT b.id, b.notes, r.reading, r.pour_count, m.recipe_id, m.how
     FROM beanconqueror_brews b LEFT JOIN brew_pour_readings r ON r.bc_uuid = b.bc_uuid
     LEFT JOIN brew_recipe_matches m ON m.brew_id = b.id WHERE r.pour_count > 0 OR m.brew_id IS NOT NULL`
  ).all() as { id: number; notes: string | null; reading: string | null; pour_count: number | null; recipe_id: number | null; how: Match['how'] | null }[];
  const facts = new Map<number, PourFact>();
  for (const r of rows) {
    if (!dripper.has(r.id)) continue;
    const recipe = r.recipe_id === null ? null : (byId.get(r.recipe_id) ?? null);
    const reading = r.reading && r.pour_count ? (JSON.parse(r.reading) as PourReading) : null;
    const d = dripper.get(r.id);
    const a = brewAgitation(
      { reading, how: r.how, recipe: recipe?.def ?? null, notes: r.notes, speedBlind: !!recipe?.def.anySpeed || (!!d && blind.has(d)) },
      words
    );
    facts.set(r.id, {
      brewId: r.id, recipeId: recipe?.id ?? null, how: recipe ? r.how : null, reading, agitation: a.agitation, agitationSet: a.set, words: wordsIn(r.notes),
      sequence: a.agitation === 'mixed' && a.pours.length && !a.pours.includes(null) ? sequenceLabel(a.pours as Agitation[]) : null
    });
  }
  return { facts, recipes };
}

type Facts = ReadonlyMap<number, PourFact>;
const NO_RECIPE = 'No recipe', OTHER_MIXED = 'Mixed (other)';
const AG_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const m_ss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
// `step`-second bands from `lo` to `hi`: "< lo", "a–b" ..., "hi+".
const timeBand = (s: number, lo: number, hi: number, step = 30): Band => {
  if (s < lo) return { label: `< ${m_ss(lo)}`, order: lo - step };
  if (s >= hi) return { label: `${m_ss(hi)}+`, order: hi };
  const a = Math.floor(s / step) * step;
  return { label: `${m_ss(a)}–${m_ss(a + step - 1)}`, order: a };
};
const withReading = (facts: Facts, f: (r: PourReading, b: BrewFact) => Band | null): BandFn => (b) => {
  const r = facts.get(b.id)?.reading;
  return r ? f(r, b) : null;
};

export const recipeBand = (facts: Facts, recipes: readonly Recipe[]): BandFn => {
  const names = new Map(recipes.map((r) => [r.id, r.name]));
  return (b) => {
    const f = facts.get(b.id);
    if (!f) return null;
    if (f.recipeId !== null) return names.has(f.recipeId) ? { label: names.get(f.recipeId)!, order: 0 } : null;
    return f.reading ? { label: NO_RECIPE, order: 1 } : null;
  };
};
// `keep`: with `split`, the sequences that get their own band (default every one); the rest fold into Mixed (other).
export const agitationBand = (facts: Facts, split: boolean, keep?: ReadonlySet<string>): BandFn => (b) => {
  const f = facts.get(b.id);
  if (!f || f.agitation === 'unknown') return null;
  if (f.agitation !== 'mixed') return { label: AGITATION_LABEL[f.agitation], order: AG_ORDER[f.agitation] };
  if (!split) return { label: AGITATION_LABEL.mixed, order: 3 };
  return f.sequence && (!keep || keep.has(f.sequence)) ? { label: f.sequence, order: 3 } : { label: OTHER_MIXED, order: 4 };
};
export const pourCountBand = (facts: Facts): BandFn => withReading(facts, (r) => ({ label: `${r.pours.length} pour${r.pours.length === 1 ? '' : 's'}`, order: r.pours.length }));
export const swirlCountBand = (facts: Facts): BandFn => withReading(facts, (r) => { const n = Math.min(r.swirls.length, 3); return { label: n === 3 ? '3+' : String(n), order: n }; });
export const swirlAfterBand = (facts: Facts): BandFn => withReading(facts, (r) => {
  const at = [...new Set(r.swirls.map((s) => s.afterPour))].sort((a, b) => a - b);
  if (!at.length) return { label: 'No swirl', order: 0 };
  const name = (p: number) => (p < 0 ? 'Before first pour' : p < r.bloomCount ? 'After bloom' : `After pour ${p + 1}`);
  return { label: at.map(name).join(' + '), order: at.length * 100 + at[0] + 1 };
});
export const bloomHoldBand = (facts: Facts): BandFn => withReading(facts, (r) => {
  if (r.bloomHoldS == null) return null;
  const h = Math.round(r.bloomHoldS / 10) * 10;
  return h <= 10 ? { label: '≤ 10 s', order: 10 } : h >= 60 ? { label: '60 s+', order: 60 } : { label: `${h} s`, order: h };
});
export const contactBand = (facts: Facts): BandFn => withReading(facts, (r) => timeBand(r.totalS, 90, 270));
export const drawdownBand = (facts: Facts): BandFn => withReading(facts, (r) => (r.drawdownS == null ? null : timeBand(r.drawdownS, 30, 120)));
export const restBand: BandFn = (b) => {
  const i = waitBucket(b.restDays);
  return i === null ? null : { label: WAIT_BUCKETS[i].label, order: i };
};

export type TechVar = 'agitation' | 'pours' | 'swirls' | 'swirlAfter' | 'bloom' | 'contact' | 'drawdown' | 'ratio';
export interface BestCell { label: string; delta: number; brews: number; small: boolean }
export interface RecipeRow {
  id: number | null; name: string; rated: number; bags: number; sample: Sample; stat: BandStat | null;
  best: { roast: BestCell | null; process: BestCell | null }; trend: { label: string; value: number }[];
  logged: number; matched: number; modified: number; dripper: string | null; thin: boolean;
}
export interface WordRow {
  label: string; brews: number; bags: number; sample: Sample;
  byAgitation: { label: string; share: number; brews: number }[]; byContact: { label: string; share: number; brews: number }[];
}
export interface PoursTab {
  recipes: RecipeRow[]; noFlow: number;
  technique: { key: TechVar; bands: BandStat[]; inferred?: Record<string, number> }[];
  split: { label: string; pourS: number; drawdownS: number }[];
  agitationByProcess: Breakdown | null;
  recipeBy: Record<'roast' | 'process' | 'roaster', Breakdown | null>;
  rest: { byRecipe: Breakdown | null; byAgitation: Breakdown | null };
  words: WordRow[]; agitationSplit: boolean;
  mixedKeep: string[]; // the sequences with their own band when split (pass to agitationBand)
  hiddenByRatings: string[];
}

export const MIXED_SPLIT_SHARE = 0.75;
const MIN_WORD_BAND = 10;
const countBy = <T>(xs: readonly T[], f: (x: T) => string) => { const m = new Map<string, number>(); for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1); return m; };
const bagsOf = (rs: readonly BrewFact[]) => new Set(rs.map((r) => r.coffeeId)).size;

// A cell column's best row: the highest delta, solid cells first; `small` flags the fallback.
function bestOf(bd: Breakdown | null, col: string): BestCell | null {
  const j = bd?.cols.indexOf(col) ?? -1;
  if (!bd || j < 0) return null;
  const cs = bd.rows.flatMap((label, i) => { const c = bd.cells[i][j]; return c && c.delta !== null ? [{ label, delta: c.delta, brews: c.brews, small: c.sample.small }] : []; });
  const pick = (xs: BestCell[]) => xs.reduce<BestCell | null>((a, c) => (!a || c.delta > a.delta ? c : a), null);
  return pick(cs.filter((c) => !c.small)) ?? pick(cs);
}
// Rest rows in WAIT_BUCKETS order (the breakdown sorts rows by brew count).
function byRestOrder(bd: Breakdown | null): Breakdown | null {
  if (!bd) return bd;
  const ix = bd.rows.map((r, i) => i).sort((a, b) => WAIT_BUCKETS.findIndex((w) => w.label === bd.rows[a]) - WAIT_BUCKETS.findIndex((w) => w.label === bd.rows[b]));
  return { ...bd, rows: ix.map((i) => bd.rows[i]), cells: ix.map((i) => bd.cells[i]) };
}

export function poursTab(
  rows: readonly BrewFact[], facts: Facts, recipes: readonly Recipe[], o: { split?: boolean; allRows?: readonly BrewFact[] } = {}
): PoursTab | null {
  const cut = rows.filter((b) => facts.has(b.id));
  // Recipes the Calibrated default hides (those of `allRows` with a big enough sample that no card shows).
  const hiddenOf = (shown: ReadonlySet<number | null>) => o.allRows
    ? [...groupBy(o.allRows.filter((b) => facts.get(b.id)?.recipeId != null), (b) => facts.get(b.id)!.recipeId)]
        .filter(([id, g]) => id !== null && !shown.has(id) && !pooled(bagsOf(g), g.length).small && recipes.some((r) => r.id === id))
        .sort((a, b) => b[1].length - a[1].length).map(([id]) => recipes.find((r) => r.id === id)!.name)
    : [];
  if (!cut.length) {
    // Nothing rated here: null, unless Calibrated hid recipes (the tab then still says so).
    const hiddenByRatings = hiddenOf(new Set());
    return hiddenByRatings.length ? {
      recipes: [], noFlow: rows.length, technique: [], split: [], agitationByProcess: null, recipeBy: { roast: null, process: null, roaster: null },
      rest: { byRecipe: null, byAgitation: null }, words: [], agitationSplit: false, mixedKeep: [], hiddenByRatings
    } : null;
  }
  const F = (b: BrewFact) => facts.get(b.id)!;
  const lone = bagsOf(cut) < 2; // ponytail: one bag has nothing to compare against; no deltas at all
  // Deltas read every rated row: a brew without a reading still sets its bag's mean (bands skip it).
  const paired = (rs: readonly BrewFact[], band: BandFn) => (lone ? [] : pairedDeltas(rs, band));

  // Mixed split (per load): own bands for the sequences whose paired sample clears, if they hold >= 75% of Mixed brews.
  const mixed = cut.filter((b) => F(b).agitation === 'mixed').length;
  const seq = paired(rows, agitationBand(facts, true)).filter((s) => s.label.includes(' then ') && s.delta !== null && !s.sample.small);
  const split = o.split ?? (mixed > 0 && seq.reduce((n, s) => n + s.plainBrews, 0) / mixed >= MIXED_SPLIT_SHARE);
  const keep = new Set(seq.map((s) => s.label));
  const agBand = agitationBand(facts, split, keep);
  const agCols = [...new Map(cut.flatMap((b) => { const k = agBand(b); return k ? [[k.label, k.order] as const] : []; })).entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([l]) => l);

  // Report card
  const rBand = recipeBand(facts, recipes);
  const stats = new Map(paired(rows, rBand).map((s) => [s.label, s]));
  const dmOf = new Map(demeaned(rows).map((r) => [r.id, r.dm])); // same basis as the deltas: every rated row of the bag
  const groups = groupBy(cut, (b) => rBand(b)?.label ?? null);
  const card: RecipeRow[] = [];
  for (const [name, rs] of groups) {
    if (name === null) continue;
    const bags = bagsOf(rs), sample = pooled(bags, rs.length);
    const hows = countBy(rs, (b) => F(b).how ?? 'none');
    const months = [...groupBy(rs.map((b) => ({ localDate: b.localDate, dm: dmOf.get(b.id)! })), (r) => r.localDate.slice(0, 7))].filter(([, g]) => g.length >= 3).sort((a, b) => a[0].localeCompare(b[0]));
    const drips = [...countBy(rs.filter((b) => b.dripper), (b) => b.dripper!)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    card.push({
      id: F(rs[0]).recipeId, name, rated: rs.length, bags, sample, stat: stats.get(name) ?? null, best: { roast: null, process: null },
      trend: months.length >= 2 ? months.map(([k, g]) => ({ label: MON[+k.slice(5) - 1], value: mean(g.map((r) => r.dm)) })) : [],
      logged: hows.get('logged') ?? 0, matched: hows.get('match') ?? 0, modified: hows.get('modified') ?? 0, dripper: drips[0]?.[0] ?? null, thin: sample.small
    });
  }
  card.sort((a, b) => +(a.id === null) - +(b.id === null) || +a.thin - +b.thin || b.rated - a.rated || a.name.localeCompare(b.name));
  const names = card.map((r) => r.name);
  const recipeBy = Object.fromEntries((['roast', 'process', 'roaster'] as const).map((d) => [d, breakdown(rows, rBand, SLICE_OF[d], names)])) as PoursTab['recipeBy'];
  for (const r of card) r.best = { roast: bestOf(recipeBy.roast, r.name), process: bestOf(recipeBy.process, r.name) };

  // Technique
  const bands: Record<TechVar, BandFn> = {
    agitation: agBand, pours: pourCountBand(facts), swirls: swirlCountBand(facts), swirlAfter: swirlAfterBand(facts), bloom: bloomHoldBand(facts),
    contact: contactBand(facts), drawdown: drawdownBand(facts), ratio: withReading(facts, (_, b) => labFn('ratio')(b))
  };
  const technique: PoursTab['technique'] = [];
  for (const key of Object.keys(bands) as TechVar[]) {
    let fn = bands[key], st = paired(rows, fn);
    if (key === 'swirlAfter' && st.some((s) => s.sample.small)) {
      const small = new Set(st.filter((s) => s.sample.small).map((s) => s.label)), base = fn;
      fn = (b) => { const k = base(b); return k && small.has(k.label) ? { label: 'Other', order: 1e6 } : k; };
      st = paired(rows, fn);
    }
    st = st.filter((s) => s.delta !== null);
    if (st.length < 2) continue;
    const inferred = key === 'agitation'
      ? Object.fromEntries(st.map((s) => [s.label, cut.filter((b) => agBand(b)?.label === s.label && !F(b).agitationSet).length]))
      : undefined;
    technique.push({ key, bands: st, ...(inferred ? { inferred } : {}) });
  }
  const contactCols = new Set(technique.find((t) => t.key === 'contact')?.bands.map((s) => s.label));
  const cBand = bands.contact;
  const splitRows = [...groupBy(cut.filter((b) => cBand(b) && F(b).reading!.drawdownS != null && contactCols.has(cBand(b)!.label)), (b) => cBand(b)!.label)]
    .map(([label, g]) => ({ label, order: cBand(g[0])!.order, pourS: mean(g.map((b) => F(b).reading!.totalS - F(b).reading!.drawdownS!)), drawdownS: mean(g.map((b) => F(b).reading!.drawdownS!)) }))
    .sort((a, b) => a.order - b.order).map(({ label, pourS, drawdownS }) => ({ label, pourS, drawdownS }));

  // Rest, words
  const byRest = (band: BandFn, cols: string[]) => byRestOrder(breakdown(rows, band, (b) => restBand(b)?.label ?? null, cols));
  const wordRows: WordRow[] = [];
  const share = (band: BandFn, w: string) => [...groupBy(cut, (b) => band(b)?.label ?? null)]
    .filter(([k, g]) => k !== null && g.length >= MIN_WORD_BAND)
    .sort((a, b) => band(a[1][0])!.order - band(b[1][0])!.order || a[0]!.localeCompare(b[0]!))
    .map(([k, g]) => ({ label: k!, share: g.filter((b) => F(b).words.includes(w)).length / g.length, brews: g.length }));
  for (const { label } of FLAVOR_WORDS) {
    const rs = cut.filter((b) => F(b).words.includes(label)), bags = bagsOf(rs), sample = pooled(bags, rs.length);
    if (!rs.length || sample.small) continue;
    wordRows.push({ label, brews: rs.length, bags, sample, byAgitation: share(agBand, label), byContact: share(cBand, label) });
  }

  // Ratings hint: recipes the Calibrated default hides
  const hidden = hiddenOf(new Set(card.filter((r) => !r.thin).map((r) => r.id)));

  return {
    recipes: card, noFlow: rows.length - cut.length, technique, split: splitRows,
    agitationByProcess: lone ? null : breakdown(rows, agBand, SLICE_OF.process, agCols), recipeBy,
    rest: { byRecipe: byRest(rBand, names), byAgitation: byRest(agBand, agCols) },
    words: wordRows, agitationSplit: split, mixedKeep: [...keep], hiddenByRatings: hidden
  };
}
