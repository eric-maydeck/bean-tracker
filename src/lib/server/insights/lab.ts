import { pooled, single, type Sample } from '$lib/sample';
import { DOSE_BANDS, MON, BREW_FILTER_KEYS, type BrewFilterKey, type BrewFilters, type Ratings, type Slice } from '$lib/insightsUrl';
import { slugify } from '$lib/server/slug';
import { grindKey, MIXED_FILTER, type BagFact, type BrewFact } from './facts';
import { monthlyMulti, settleGroups, type Multi } from './insightGenerators';
import { BREW_NO_LABELS, MINERALS, REST_LABELS, bandOf, doseBand, grindSteps, mineralOf, type Band, type LabVar, type Mineral } from './labBands';
import { bagSizes, countsForRating, ratedGroups } from './ratings';
import { likeGaps, twinKeys } from './likeGroup';
import { groupBy } from './records';
import { waitWindow, type WaitWindow } from './freshness';
import { demeaned, mean, MIN_BAGS, MIN_BREWS, restZ, sd, strengthOf, tCrit, type Strength } from './stats';
import { inPeriod, type Period } from './time';

// The lab's input rows: the period's linked brews with a counted rating (spec "Shared rules").
export const ratedIn = (brews: readonly BrewFact[], period: Period, ratings: Ratings): BrewFact[] =>
  brews.filter((b) => b.coffeeId !== null && inPeriod(b.localDate, period) && countsForRating(b, ratings) && b.rating! > 0);

// Both caffeine kinds have a rated brew in the period: the only case the Caffeinated vs. decaf board has anything to compare.
export const bothCaffeineKinds = (brews: readonly BrewFact[], period: Period, ratings: Ratings): boolean =>
  new Set(ratedIn(brews, period, ratings).map((b) => b.decaf)).size === 2;

export type BandFn = (b: BrewFact) => Band | null;
export const labFn = (v: LabVar, grinder: string | null = null): BandFn => (b) => bandOf(v, b, grinder);

export interface BandStat {
  label: string; order: number; range?: string; // range: the band's span when the label is its first value (grind)
  delta: number | null; // mean same-bag delta of the paired brews; null = no paired bag
  brews: number; bags: number; // paired brews / bags behind `delta`
  solid: boolean; // ≥ MIN_BAGS paired bags and ≥ MIN_BREWS paired brews
  sample: Sample; // the small-sample marker (sample.ts): paired counts, or plain ones for "no match"
  strength: Strength | null; // vs the other bands' deltas, Bonferroni over every band of the variable in the period's data; null = nothing to compare
  adjusted: number; plainBrews: number; plainBags: number; // bag-weighted adjusted mean (K = 5) over every rated brew in the band
  se: number | null; // the badge test's SE (bag level); the bar's text shows 2 dp only under 0.05 (stats audit precision rule)
  z: number | null; // the badge test's signed z (mean per-bag gap ÷ se); null when it has no test. May disagree in sign with `delta`
  spread: number | null; // sample SD of the paired brews' same-bag deltas (consistency); null under 2 paired brews
  sd: number | null; // sample SD of the band's rated brews' ratings (board SD column, over plainBrews); null under 2 brews
}
export const BEST_WINDOW = 7; // the Brews until dialed chart reads each bag's first 7 brews
const EPS = 1e-9; // an SD below this is float noise: no spread to measure a gap against
const byOrder = (a: { order: number; label: string }, b: { order: number; label: string }) => a.order - b.order || a.label.localeCompare(b.label);
const sampleSd = (xs: number[]) => sd(xs) * Math.sqrt(xs.length / (xs.length - 1));

// Same-bag deltas per band (spec "The measurement"): rating minus the bag's mean over `rows`. A bag is
// paired when ≥ 2 of its bands have ≥ minPerBand brews; those bands' brews make `delta`.
// The badge's test has the bag as its unit (stats review I-2, user 2026-10-17): each paired bag gives one number,
// its mean in this band minus its mean in its other paired bands (the band against the rest, within the bag), and
// the strength is a paired t test on those, n = bags. A bag's brews share its mean and its days, so counting each
// brew as a unit understated the SE.
export function pairedDeltas(rows: readonly BrewFact[], band: BandFn, minPerBand = 2): BandStat[] {
  const dm = demeaned(rows).flatMap((r) => { const k = band(r); return k ? [{ ...r, k }] : []; });
  const bands = new Map<string, { order: number; range?: string; paired: number[]; bags: Set<number>; byBag: number[] }>();
  for (const r of dm) if (!bands.has(r.k.label)) bands.set(r.k.label, { order: r.k.order, range: r.k.range, paired: [], bags: new Set(), byBag: [] });
  for (const [id, rs] of groupBy(dm, (r) => r.coffeeId)) {
    const used = [...groupBy(rs, (r) => r.k.label)].filter(([, g]) => g.length >= minPerBand);
    if (used.length < 2) continue;
    for (const [label, g] of used) {
      const s = bands.get(label)!;
      s.paired.push(...g.map((r) => r.dm));
      s.bags.add(id!);
      s.byBag.push(mean(g.map((r) => r.dm)) - mean(used.filter(([l]) => l !== label).flatMap(([, o]) => o.map((r) => r.dm))));
    }
  }
  const plain = new Map(ratedGroups(dm, (r) => r.k.label, 'all', 'adjusted').map((g) => [g.label, g]));
  const tests = bands.size; // Bonferroni: every band of the variable present in the data (spec), not only those with pairs
  const pairedSd = new Map([...bands].map(([l, s]) => [l, s.paired.length >= 2 ? sampleSd(s.paired) : null]));
  const ratingSd = new Map([...groupBy(dm, (r) => r.k.label)].map(([l, g]) => [l, g.length >= 2 ? sampleSd(g.map((r) => r.rating!)) : null]));
  return [...bands].map(([label, s]): BandStat => {
    const solid = s.bags.size >= MIN_BAGS && s.paired.length >= MIN_BREWS;
    const n = s.byBag.length, spread = n >= 2 ? sampleSd(s.byBag) : 0;
    const z = n >= 2 && spread > EPS ? mean(s.byBag) / (spread / Math.sqrt(n)) : null;
    const g = plain.get(label)!, delta = s.paired.length ? mean(s.paired) : null;
    // The bar shows `delta` (brew-weighted), the test runs on the per-bag gaps: when the two point opposite ways a
    // badge would back a gap the bar contradicts, so it is Too early (stats re-review B).
    const strength = z === null ? null : Math.sign(z) !== Math.sign(delta!) ? 'early' : strengthOf(z, solid, tests, n);
    return {
      label, order: s.order, ...(s.range ? { range: s.range } : {}), delta, brews: s.paired.length, bags: s.bags.size, solid,
      sample: s.paired.length ? pooled(s.bags.size, s.paired.length) : pooled(g.bags, g.brews),
      strength, se: z === null ? null : spread / Math.sqrt(n), z,
      adjusted: g.adjusted, plainBrews: g.brews, plainBags: g.bags, spread: pairedSd.get(label)!, sd: ratingSd.get(label)!
    };
  }).sort(byOrder);
}

// Grind in Bands mode (ui-rules 35, M-6): every step from the lowest band present to the highest; a step with no
// brews becomes an empty band (no delta, 0 brews: a "no brews" row, no bar). Other forms are left as they are.
export function fillGrind<T extends { label: string }>(bands: T[], empty: (b: Band) => T): T[] {
  const steps = grindSteps(bands.map((b) => b.label));
  if (!steps) return bands;
  const have = new Map(bands.map((b) => [b.label, b]));
  return steps.map((s) => have.get(s.label) ?? empty(s));
}
export const emptyStat = (b: Band): BandStat => ({
  label: b.label, order: b.order, ...(b.range ? { range: b.range } : {}), delta: null, brews: 0, bags: 0, solid: false, strength: null,
  adjusted: 0, plainBrews: 0, plainBags: 0, se: null, z: null, spread: null, sd: null, sample: pooled(0, 0)
});
const emptySpot = (b: Band): SpotBand => ({ label: b.label, ...(b.range ? { range: b.range } : {}), value: null, bags: 0, brews: 0, solid: false, sample: pooled(0, 0) });

// Tier 2: per band, each bag's mean rating within the band (the bag is the unit, no pseudo-replication).
function bagBandMeans(rows: readonly BrewFact[], band: BandFn) {
  const out = new Map<string, { order: number; range?: string; means: number[]; ids: number[]; brews: number }>();
  for (const [id, bs] of groupBy(rows, (b) => b.coffeeId))
    for (const [label, g] of groupBy(bs, (b) => band(b)?.label)) {
      const k = band(g[0])!;
      const s = out.get(label) ?? out.set(label, { order: k.order, range: k.range, means: [], ids: [], brews: 0 }).get(label)!;
      s.means.push(mean(g.map((b) => b.rating!)));
      s.ids.push(id!);
      s.brews += g.length;
    }
  return out;
}

const isSolid = (s: { means: number[]; brews: number }) => s.means.length >= MIN_BAGS && s.brews >= MIN_BREWS;
const meanBands = (all: ReturnType<typeof bagBandMeans>): SpotBand[] =>
  [...all].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([label, s]) => ({ label, ...(s.range ? { range: s.range } : {}), value: mean(s.means), bags: s.means.length, brews: s.brews, solid: isSolid(s), sample: pooled(s.means.length, s.brews) }));

export interface Group { name: string; brews: BrewFact[] } // narrowest first
export interface Spot {
  tier: 1 | 2 | 3;
  // none: tier 3. early: a lead short of Possible. tie: the best bands are too close to matter, with enough bags to say so.
  verdict: 'win' | 'leaning' | 'early' | 'tie' | 'none';
  // verdict tie: the tied bands (best first), their widest gap, the card's headline and, when the names don't fit it, the list for the line below.
  tie: { labels: string[]; within: number; proven: boolean; head: string; list: string | null } | null;
  // An Early single leader's hedged headline ("Maybe X"), only when it takes no more lines than the bare setting; else null (the badge alone carries the doubt).
  might: string | null;
  // A band under the solid minimum that looks higher than `best` by TIE_MARGIN or more, on the value the chart plots (tier 1 delta, tier 2 mean).
  thin: { label: string; bags: number } | null;
  best: { label: string; value: number; strength: Strength | null } | null; // tier 1: delta; tier 2: mean of bag means
  next: { label: string; value: number } | null; // tier 2: the runner-up band
  group: string | null; // tier 2: the group's name
  bags: number; // tier 1: paired bags behind `best`; tier 2: bags in `best`
  varied: boolean; // tier 3: the widest group used more than one band
  usual: { label: string; mean: number }; // the slice's most-brewed (coarsest) band and its plain mean rating
  // Every band of the evidence the card used, in band order (the card's mini chart): tier 1 same-bag
  // deltas of the winning band set; tier 2 the group's mean of bag means; tier 3 the widest group's bag
  // means on the coarse bands. `solid` as the tier counts it (pale otherwise).
  bands: SpotBand[];
}
// value null: a no-match band (brews, never paired on the same bag): tier 1 of an ordered dial (grind) keeps it, so
// the chart spans every setting brewed, lowest to highest (round 3, S-grind); bags/brews are then its plain counts.
export interface SpotBand { label: string; range?: string; value: number | null; se?: number | null; bags: number; brews: number; solid: boolean; sample: Sample }
// The Insights tab's two badges: Likely wins (strength 'solid'), Possible leans (strength 'hint') (spec "Strong/Likely/Hint" mapped onto them).
export const verdictOf = (s: Strength | null): Spot['verdict'] => (s === 'solid' ? 'win' : s === 'hint' ? 'leaning' : 'early');

// A tie: a band ties the best when its observed gap is within ±TIE_MARGIN rating points (the headline: what the data
// seems to show). It is `proven` (no badge) when also the 90% confidence interval of every tied gap (the two one-sided
// 5% tests, TOST) lies inside the margin, so only enough bags prove "close"; else the tile wears Early (looks tied so
// far). The margin is a quarter point: about a third of the typical brew-to-brew SD (~0.77), too small to steer a decision.
export const TIE_MARGIN = 0.25;
const TIE_P = 0.05;
// ponytail: a character budget for "fits the tile" (the narrowest phone card, 3 across at 360px, wraps ~12 characters a line, 2 lines);
// live text measuring is the upgrade if a name list cuts early.
export const HEAD_FIT = 24;
export function tieHead(labels: readonly string[]): { head: string; list: string | null } {
  const list = labels.length > 2 ? `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}` : labels.join(' or ');
  return list.length <= HEAD_FIT ? { head: list, list: null } : { head: `${labels.length} in the running`, list };
}
// ponytail: "Maybe X" must stay on the one line the bare setting takes at 360px portrait (a card ~150px wide: ~12 characters
// at the headline's step-down size); live text measuring is the upgrade.
export const MAYBE_FIT = 12;
export const mightBe = (label: string): Spot['might'] => (`Maybe ${label}`.length <= MAYBE_FIT ? `Maybe ${label}` : null);
// The top thin band (not solid, so the bars draw it pale) standing TIE_MARGIN or more above `best`: one line says so.
export function thinOf(best: number, bands: readonly SpotBand[]): Spot['thin'] {
  const t = bands.filter((b) => !b.solid && b.value !== null && b.value - best >= TIE_MARGIN - 1e-9).sort((a, b) => b.value! - a.value!)[0];
  return t ? { label: t.label, bags: t.bags } : null;
}
// `rivals`: the other solid bands' gap to the best, its SE and the bags behind the smaller side.
// Best's gap to band `x` on the bags that brewed both (≥ 2 brews each, as pairedDeltas pairs): each bag's mean rating in
// best minus its mean in x. Its mean, SE (SD of those bag gaps ÷ √n) and n; null under 2 shared bags.
export function pairedGap(rows: readonly BrewFact[], band: BandFn, best: string, x: string) {
  const d: number[] = [];
  for (const [, g] of groupBy(rows, (r) => r.coffeeId)) {
    const by = groupBy(g, (r) => band(r)?.label), a = by.get(best), c = by.get(x);
    if (a && c && a.length >= 2 && c.length >= 2) d.push(mean(a.map((r) => r.rating!)) - mean(c.map((r) => r.rating!)));
  }
  return d.length >= 2 ? { diff: mean(d), se: sampleSd(d) / Math.sqrt(d.length), n: d.length } : null;
}
// `diff`: the gap between the two bands' chart values (the bar heights the viewer sees) says who is in the running and
// how close; `proof`: the gap measured on shared bags (with its SE and n) says whether it is proven.
function tieOf(best: string, rivals: { label: string; diff: number; proof: { diff: number; se: number | null; n: number } | null }[]): Spot['tie'] {
  const close = rivals.filter((r) => Math.abs(r.diff) <= TIE_MARGIN);
  if (!close.length) return null;
  const labels = [best, ...close.map((r) => r.label)];
  // A proof needs a real sample: ≥ MIN_BAGS bags behind the gap and a spread to measure it by (zero variance proves nothing).
  const proven = close.every(({ proof: p }) => p !== null && p.se !== null && p.se > EPS && p.n >= MIN_BAGS && Math.abs(p.diff) + tCrit(p.n - 1, TIE_P) * p.se <= TIE_MARGIN);
  return { labels, within: Math.max(...close.map((r) => Math.abs(r.diff))), proven, ...tieHead(labels) };
}

// Sweet spots grouping ladder (spec): same bag within the slice, else bag means within the narrowest
// group with ≥ 2 solid bands, else no comparison. `bands` are tried in order (temp: exact, then bands).
// `keepUnpaired`: tier 1 keeps no-match bands (grind), as Brewing's Grind chart does.
export function ladder(slice: readonly BrewFact[], groups: readonly Group[], bands: readonly BandFn[], keepUnpaired = false): Spot | null {
  const coarse = bands.at(-1)!;
  const used = (rows: readonly BrewFact[]) => groupBy(rows, (b) => coarse(b)?.label);
  const top = [...used(slice)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  if (!top) return null; // no brew in the slice has this variable: the card is hidden
  const base = { next: null, group: null, varied: true, tie: null as Spot['tie'], might: null as Spot['might'], thin: null as Spot['thin'], usual: { label: top[0], mean: ratedGroups(top[1], () => 'x', 'all', 'adjusted')[0].mean } };
  for (const f of bands) {
    const st = pairedDeltas(slice, f), solid = st.filter((s) => s.solid);
    if (solid.length < 2) continue;
    const b = solid.reduce((x, y) => (y.delta! > x.delta! ? y : x));
    const shown = st.filter((s) => s.delta !== null || keepUnpaired).map((s) => {
      const bags = s.delta === null ? s.plainBags : s.bags, brews = s.delta === null ? s.plainBrews : s.brews;
      return { label: s.label, ...(s.range ? { range: s.range } : {}), value: s.delta, se: s.se, bags, brews, solid: s.solid, sample: pooled(bags, brews) };
    });
    const verdict = verdictOf(b.strength);
    // Who is in the running: the gap between the chart values (same-bag deltas). Proven: the paired per-bag difference
    // on the bags that brewed both (not the two deltas against the rest of the bag, which double it in a two-band split);
    // under 2 shared bags there is no proof.
    const tie = verdict === 'early' ? tieOf(b.label, solid.filter((x) => x !== b).map((x) => ({ label: x.label, diff: b.delta! - x.delta!, proof: pairedGap(slice, f, b.label, x.label) }))) : null;
    return { ...base, tie, might: verdict === 'early' && !tie ? mightBe(b.label) : null, thin: thinOf(b.delta!, shown), tier: 1, verdict: tie ? 'tie' : verdict, best: { label: b.label, value: b.delta!, strength: b.strength }, bags: b.bags, bands: shown };
  }
  for (const g of groups)
    for (const f of bands) {
      const all = bagBandMeans(g.brews, f);
      const solid = [...all].filter(([, s]) => isSolid(s))
        .sort((a, b) => mean(b[1].means) - mean(a[1].means) || a[1].order - b[1].order);
      if (solid.length < 2) continue;
      const [[label, s], [nextLabel, n]] = solid;
      // The winner against the group's other solid bands (not a pool holding it), as a t test on the bags behind
      // them (stats review I-2); Bonferroni over every band of the group, not only the solid ones. n counts distinct
      // bags: a bag brewed in two bands gives a mean to each, but is one unit (stats re-review C).
      const rest = solid.slice(1).flatMap(([, x]) => x.means), pool = [...s.means, ...rest];
      const bags = new Set(solid.flatMap(([, x]) => x.ids)).size;
      const strength = sd(pool) < EPS ? 'early' : strengthOf(restZ(s.means, rest), true, all.size, bags);
      const verdict = verdictOf(strength), poolSd = pool.length > 1 ? sampleSd(pool) : null;
      const tie = verdict === 'early' ? tieOf(label, solid.slice(1).map(([l, x]) => ({ label: l, diff: mean(s.means) - mean(x.means), proof: { diff: mean(s.means) - mean(x.means), se: poolSd === null ? null : poolSd * Math.sqrt(1 / s.means.length + 1 / x.means.length), n: Math.min(s.means.length, x.means.length) } }))) : null;
      return {
        ...base, tie, might: verdict === 'early' && !tie ? mightBe(label) : null, thin: thinOf(mean(s.means), meanBands(all)), tier: 2, verdict: tie ? 'tie' : verdict, best: { label, value: mean(s.means), strength },
        next: { label: nextLabel, value: mean(n.means) }, group: g.name, bags: s.means.length, bands: meanBands(all)
      };
    }
  const widest = groups.at(-1)?.brews ?? slice;
  return { ...base, tier: 3, verdict: 'none', best: null, bags: 0, varied: used(widest).size > 1, bands: meanBands(bagBandMeans(widest, coarse)) };
}

export const SLICE_OF: Record<Slice, (b: BrewFact) => string | null> = {
  roast: (b) => b.roastLevel, process: (b) => b.processGroup, origin: (b) => b.origin, roaster: (b) => b.roaster
};
// delta null = no paired brews (blank); a thin cell (not solid) keeps its delta and draws faded; counts for the tip.
export interface Cell { delta: number | null; se?: number | null; z?: number; solid: boolean; sample: Sample; brews: number; bags: number; plain?: { brews: number; bags: number } } // plain: a no-match cell's own brews and bags (no same-bag partner)
// One mapping for every heatmap (breakdown, gearTab's matrix): counts are the paired brews and bags
// behind the delta, so a tip never reads "6 brews, 0 bags".
export const cellOf = (s: Pick<BandStat, 'delta' | 'solid' | 'brews' | 'bags'> & { se?: number | null; z?: number | null; plainBrews?: number; plainBags?: number }): Cell => ({
  delta: s.delta, ...(s.se != null ? { se: s.se } : {}), ...(s.z != null ? { z: s.z } : {}), solid: s.solid, sample: pooled(s.bags, s.brews), brews: s.brews, bags: s.bags,
  ...(s.delta === null && s.plainBrews ? { plain: { brews: s.plainBrews, bags: s.plainBags ?? 0 } } : {})
});
export interface Breakdown { rows: string[]; cols: string[]; cells: (Cell | null)[][] } // null cell = no brews there
// Drop rows, then columns, with no cell that has a delta (all blank: nothing to show, round 1 I8); null when none is left.
const live = (c: Cell | null) => c !== null && c.delta !== null;
// `ordered` columns (grind steps, rest windows; ui-rules 35) keep every step between the first and last live one.
export function trimBlank(b: Breakdown, ordered = false): Breakdown | null {
  const ri = b.rows.map((_, i) => i).filter((i) => b.cells[i].some(live));
  const used = (j: number) => ri.some((i) => live(b.cells[i][j]));
  const all = b.cols.map((_, j) => j);
  const first = all.findIndex(used), last = all.findLastIndex(used);
  const ci = ordered ? (first < 0 ? [] : all.slice(first, last + 1)) : all.filter(used);
  return ri.length && ci.length ? { rows: ri.map((i) => b.rows[i]), cols: ci.map((j) => b.cols[j]), cells: ri.map((i) => ci.map((j) => b.cells[i][j])) } : null;
}

// A heatmap of same-bag deltas: rows = slice values with ≥ MIN_BAGS bags that have the variable,
// most-brewed first; columns = `cols`. A bag's mean stays its mean over the whole row (all its brews).
export function breakdown(rows: readonly BrewFact[], band: BandFn, slice: (b: BrewFact) => string | null, cols: string[], minPerBand = 2, ordered = false): Breakdown | null {
  const groups = [...groupBy(rows, slice)]
    .filter(([, g]) => new Set(g.filter((b) => band(b)).map((b) => b.coffeeId)).size >= MIN_BAGS)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (!groups.length) return null;
  return trimBlank({
    rows: groups.map(([k]) => k),
    cols,
    cells: groups.map(([, g]) => {
      const st = new Map(pairedDeltas(g, band, minPerBand).map((s) => [s.label, s]));
      return cols.map((c) => { const s = st.get(c); return s ? cellOf(s) : null; });
    })
  }, ordered);
}

export interface LabOptions {
  bags: { slug: string; label: string; onHand: boolean; roast: string | null; process: string }[];
  roasts: string[]; processes: string[]; origins: string[]; roasters: string[];
  grinders: { slug: string; name: string }[]; // most rated brews first: [0] is the default
  drippers: string[]; filters: string[]; waters: string[];
  doses: string[]; // band slugs present, band order
  temps: string[]; // numeric order
}
// The values the pickers offer and the URL parser accepts (spec "URL state": values from the data).
// Roast levels need ≥ MIN_BAGS brewed bags (spec "Bands"); every slugged bag parses (an archived bag's
// link still works), the Bag select shows the on-hand ones.
export function labOptions(brews: readonly BrewFact[], bags: readonly BagFact[]): LabOptions {
  const brewed = bags.filter((b) => b.firstBrew);
  const values = (f: (b: BagFact) => string | null, min = 1) =>
    [...groupBy(brewed, f)].filter(([, g]) => g.length >= min).map(([k]) => k).sort((a, b) => a.localeCompare(b));
  const uniq = (f: (b: BrewFact) => string | null) =>
    [...new Set(brews.map(f).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));
  const dosesPresent = new Set(brews.map((b) => doseBand(b.dose)));
  return {
    bags: bags.filter((b) => b.slug).map((b) => ({ slug: b.slug!, label: `${b.roaster} ${b.name}`, onHand: b.status !== 'archive', roast: b.roastLevel, process: b.processGroup })),
    roasts: values((b) => b.roastLevel, MIN_BAGS), processes: values((b) => b.processGroup), origins: values((b) => b.origin), roasters: values((b) => b.roaster),
    grinders: [...groupBy(brews.filter((b) => b.rating! > 0), (b) => b.grinder)]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([name]) => ({ slug: slugify(name), name })),
    drippers: uniq((b) => b.dripper), filters: uniq((b) => (b.filter === MIXED_FILTER ? null : b.filter)), waters: uniq((b) => b.water),
    doses: DOSE_BANDS.map((d) => d.slug).filter((s) => dosesPresent.has(s)),
    temps: [...new Set(brews.map((b) => b.tempC).filter((t): t is number => t !== null))].sort((a, b) => a - b).map(String)
  };
}

// The brew filters (spec 2026-10-21): each set key must match; a missing value or the mixed filter never does.
export const matchesBrew = (f: BrewFilters) => (b: BrewFact): boolean =>
  (!f.dripper || b.dripper === f.dripper) && (!f.filter || (b.filter !== MIXED_FILTER && b.filter === f.filter)) &&
  (!f.water || b.water === f.water) && (!f.brewDose || doseBand(b.dose) === f.brewDose) &&
  (!f.brewTemp || (b.tempC !== null && b.tempC === Number(f.brewTemp)));
// A control's own filter doesn't narrow its own options.
export const exceptOwn = (f: BrewFilters, k: BrewFilterKey | string): BrewFilters => {
  if (!(BREW_FILTER_KEYS as readonly string[]).includes(k)) return f;
  const { [k as BrewFilterKey]: _, ...rest } = f;
  return rest;
};

const SETTLE_DIM = { roast: 'roastLevel', process: 'processGroup', dripper: 'dripper', water: 'water' } as const;
export interface LabFilters { roast?: string; process?: string; origin?: string; roaster?: string }
type CoffeeFields = Pick<BrewFact, 'roastLevel' | 'processGroup' | 'origin' | 'roaster'>;
// The Coffees filter (spec 2026-10-15 Part 3), page-wide: a brew or a bag (same field names) matches every set field.
export const matchesCoffee = (f: LabFilters) => (b: CoffeeFields) =>
  (!f.roast || b.roastLevel === f.roast) && (!f.process || b.processGroup === f.process) && (!f.origin || b.origin === f.origin) && (!f.roaster || b.roaster === f.roaster);
// Tier 2 groups, narrowest first: roast + process + roaster + origin → roast + process + roaster → roast +
// process → roast level (spec; levels with an Any filter are skipped or deduped by name). With no Roast
// level set the widest group is all coffees.
const LEVELS: (keyof LabFilters)[][] = [['roast', 'process', 'origin', 'roaster'], ['roast', 'process', 'roaster'], ['roast', 'process'], ['roast']];
const groupName = (g: LabFilters) =>
  `${[g.process, g.roast].filter(Boolean).join(' ') || 'all'} coffees${g.origin ? ` from ${g.origin}` : ''}${g.roaster ? ` by ${g.roaster}` : ''}`;
export function groupsFor(rows: readonly BrewFact[], f: LabFilters): Group[] {
  const seen = new Set<string>();
  return LEVELS.flatMap((keys) => {
    const g: LabFilters = Object.fromEntries(keys.filter((k) => f[k]).map((k) => [k, f[k]]));
    const name = groupName(g);
    if (seen.has(name)) return [];
    seen.add(name);
    return [{ name, brews: rows.filter(matchesCoffee(g)) }];
  });
}

export type SpotVar = 'temp' | 'water' | 'dripper' | 'filter' | 'ratio' | 'dose' | 'grind' | 'bloom' | 'rest';
const SPOT_NAMES: Record<SpotVar, string> = { temp: 'Temp', water: 'Water', dripper: 'Dripper', filter: 'Filter', ratio: 'Ratio', dose: 'Dose', grind: 'Grind', bloom: 'Bloom', rest: 'Rest' };
const SPOT_VARS: Record<SpotVar, LabVar[]> = { temp: ['tempExact', 'temp'], water: ['water'], dripper: ['dripper'], filter: ['filter'], ratio: ['ratio'], dose: ['dose'], grind: ['grind'], bloom: ['bloom'], rest: ['rest'] };
export interface SweetSpotsTab {
  matching: { bags: number; brews: number };
  cards: { key: SpotVar; name: string; spot: Spot }[];
  // `tag`: what tells apart listed bags sharing a name ("roasted May 5" / "opened Jul 30"), else null.
  topBags: { label: string; tag: string | null; sub: string; href: string | null; score: number; brews: number; sd: number | null; usual: string; sample: Sample; like?: { gap: number; label: string } }[];
}
const TOP_N = 5; // bags listed
const TOP_K = 5; // shrink a bag's mean toward the slice mean by 5 brews: one great brew doesn't top the list
const mode = (bs: readonly BrewFact[], f: (b: BrewFact) => string | null | undefined) =>
  [...groupBy(bs, f)].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? null;

// Listed bags sharing a name (a repurchase) each get their roast date, so the rows tell apart; twins
// roasted the same day get their opened date instead.
type Dated = { label: string; roastedOn: string | null; openedOn: string | null };
export function tagTwins<T extends Dated>(rows: T[]): (Omit<T, 'roastedOn' | 'openedOn'> & { tag: string | null })[] {
  const day = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
  const key = (b: { label: string; tag: string | null }) => `${b.label}|${b.tag}`;
  const twins = <U extends { label: string; tag: string | null }>(xs: U[], b: U) => xs.filter((x) => key(x) === key(b)).length > 1;
  const untagged = rows.map((b) => ({ ...b, tag: null as string | null }));
  const roasted = untagged.map((b) => (twins(untagged, b) && b.roastedOn ? { ...b, tag: `roasted ${day(b.roastedOn)}` } : b));
  return roasted.map((b) => {
    const { roastedOn: _, openedOn, ...row } = b;
    return twins(roasted, b) && openedOn ? { ...row, tag: `opened ${day(openedOn)}` } : row;
  });
}

export function sweetSpotsTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; ratings: Ratings; grinder: string | null; filters: LabFilters; all: readonly BrewFact[] }): SweetSpotsTab {
  // `brews` is already Coffees-filtered; the ladder widens past the filter, so it reads `all`.
  const slice = ratedIn(brews, c.period, c.ratings);
  const perBag = groupBy(slice, (b) => b.coffeeId);
  const sizes = bagSizes(brews.filter((b) => inPeriod(b.localDate, c.period)), c.ratings); // one-bag rule: dial-in brews count
  const groups = groupsFor(ratedIn(c.all, c.period, c.ratings), c.filters);
  const cards = (Object.keys(SPOT_VARS) as SpotVar[]).flatMap((key) => {
    const spot = ladder(slice, groups, SPOT_VARS[key].map((v) => labFn(v, c.grinder)), key === 'grind');
    if (spot && key === 'grind') spot.bands = fillGrind(spot.bands, emptySpot);
    return spot ? [{ key, name: SPOT_NAMES[key], spot }] : [];
  });
  const overall = mean(slice.map((b) => b.rating!));
  const byId = new Map(bags.map((b) => [b.id, b]));
  const likes = likeGaps(slice, false, twinKeys(bags), sizes);
  const topBags = [...perBag].map(([id, bs]) => {
    const bag = byId.get(id!), like = likes.get(id!);
    return {
      label: bag?.name ?? `Bag ${id}`, sub: bag?.roaster ?? '', href: bag?.slug ? `/coffees/${bag.slug}` : null, brews: bs.length,
      ...(like ? { like: { gap: like.gap, label: like.label } } : {}),
      roastedOn: bag?.purchaseDate ?? null, openedOn: bag?.firstBrew ?? null,
      score: (bs.reduce((s, b) => s + b.rating!, 0) + TOP_K * overall) / (bs.length + TOP_K),
      sd: bs.length >= 2 ? sampleSd(bs.map((b) => b.rating!)) : null, sample: single(sizes.get(id!) ?? bs.length),
      usual: [mode(bs, (b) => bandOf('tempExact', b)?.label), mode(bs, (b) => b.water), mode(bs, (b) => b.dripper)].filter(Boolean).join(' · ')
    };
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, TOP_N);
  return { matching: { bags: perBag.size, brews: slice.length }, cards, topBags: tagTwins(topBags) };
}

export type BrewVar = 'temp' | 'ratio' | 'dose' | 'time' | 'bloom' | 'grind';
export interface VarChart { key: BrewVar; bands: BandStat[]; by: Breakdown | null }
export interface BrewingTab {
  // Rest heatmap: rows = roast levels (≥ MIN_BAGS bags, ≥ 2 rest bands with data), cols = rest bands trimmed to
  // the data; cell = its bags' mean rating in the band (bag = unit) less the roast level's mean bag rating,
  // thin cells (not solid) kept for a faded draw. `best[row]`: column of the row's best solid cell, null
  // under 2 solid cells (nothing to compare).
  rest: (Breakdown & { best: (number | null)[] }) | null;
  dialIn: BandStat[]; // delta by brew number in the bag (one brew per band per bag: minPerBand 1)
  bestAt: { label: string; bags: number }[]; // brew number of each bag's best brew within its first 7 (bags with ≥ 5 rated there)
  bestLater: { label: string; bags: number }[]; // of those bags, the ones whose best brew came after #7, by its number (#8, #9, #10+)
  drift: { label: string; value: number; bags: number; sample: Sample }[]; // mean setting change vs the bag's first brew
  // Brews until dialed in (gate P4): per roast level / process / dripper / water, the median brew its bags settle at (the dialinBy
  // findings' measure), fastest first; empty under 2 groups.
  settle: Record<'roast' | 'process' | 'dripper' | 'water', { label: string; value: number; bags: number; brews: number; sample: Sample }[]>;
  vars: VarChart[];
  // Rating by wait and Rest window (freshness.ts), beside the rest curve; null with no bags passed or nothing to show.
  wait: WaitWindow | null;
}
const round2 = (x: number) => Math.round(x * 100) / 100;
// A grind setting read as a decimal (1.3.5 → 1.35, 6.2 → 6.2), so drift reads in the grinder's own steps.
// ponytail: a part ≥ 10 overlaps the next digit; fine for A4Z / ZP6 settings, revisit for other grinders.
const dial = (g: string | null) => grindKey(g)?.reduce((s, n, i) => s + n / 10 ** i, 0) ?? null;

export function brewingTab(brews: readonly BrewFact[], c: {
  period: Period; ratings: Ratings; grinder: string | null; by: Partial<Record<BrewVar, Slice>>; exact: Partial<Record<BrewVar, boolean>>;
  all: readonly BrewFact[]; // every rating: the dial-in views (Once dialed exempts them)
  whole?: readonly BrewFact[]; brewFilters?: BrewFilters; // before the brew filters, every rating: the settle charts. Default: `all`.
  bags?: readonly BagFact[]; // for Rating by wait and Rest window (each bag's rest window)
}): BrewingTab {
  // Dial-in views (spec Part 2 exemptions) read every brew; the rest curve and variables follow Once dialed.
  const rows = ratedIn(brews, c.period, c.ratings);
  const every = ratedIn(c.all, c.period, c.ratings);
  // Rest is mostly a bag-level property (a bag spans about one rest band), so same-bag deltas barely exist:
  // compare bags instead (Sweet spots tier 2), each row centered on its roast level's mean bag rating.
  const rest = labFn('rest');
  // The center uses the same brews as the bands: a brew (or bag) with no rest band counts in neither.
  const levels = [...groupBy(rows.filter((b) => rest(b)), (b) => b.roastLevel)].flatMap(([label, g]) => {
    const center = bagMeanAvg(g);
    const bm = bagBandMeans(g, rest);
    const cells = REST_LABELS.map((l) => { const s = bm.get(l); return s ? cellOf({ delta: mean(s.means) - center, solid: isSolid(s), brews: s.brews, bags: s.means.length }) : null; });
    // A roast level needs ≥ MIN_BAGS bags (as the Roast picker and breakdowns).
    return label && new Set(g.map((b) => b.coffeeId)).size >= MIN_BAGS && cells.filter(Boolean).length >= 2 ? [{ label, cells }] : [];
  }).sort((a, b) => a.label.localeCompare(b.label));
  // Rest windows: only leading/trailing blank ones are dropped (trimBlank, ordered).
  const restMap = levels.length ? trimBlank({ rows: levels.map((l) => l.label), cols: [...REST_LABELS], cells: levels.map((l) => l.cells) }, true) : null;
  const bestOf = (row: (Cell | null)[]) => {
    const solid = row.flatMap((x, i) => (x?.solid ? [{ i, d: x.delta! }] : []));
    return solid.length >= 2 ? solid.reduce((x, y) => (y.d > x.d ? y : x)).i : null;
  };
  // Each bag's first BEST_WINDOW brews only, so a bag brewed 20 times has no more chances at a late best than one
  // brewed 7 (user, 2026-10-17: the bag-length bias).
  const top = (g: BrewFact[]) => g.reduce((x, y) => (y.rating! > x.rating! ? y : x)); // rows are in time order: earliest best wins
  const windows = [...groupBy(every.filter((b) => b.brewIndex > 0 && b.brewIndex <= BEST_WINDOW), (b) => b.coffeeId).values()].filter((g) => g.length >= 5);
  const best = windows.map((g) => bandOf('brewNo', top(g))!.label);
  // What the window hides (ui-rules 47): those bags whose best brew came after #7, by that brew's number.
  const after = groupBy(every.filter((b) => b.brewIndex > BEST_WINDOW), (b) => b.coffeeId);
  const later = windows.flatMap((g) => { const l = after.get(g[0].coffeeId!); return l && top(l).rating! > top(g).rating! ? [bandOf('brewNo', top(l))!.label] : []; });
  // Baseline = the bag's first in-period brew on the chosen grinder. Ignores the ratings switch: drift is
  // about settings, not ratings (controller ruling).
  const first = new Map<number, number>();
  for (const b of c.all) if (b.coffeeId !== null && inPeriod(b.localDate, c.period) && b.grinder === c.grinder && !first.has(b.coffeeId) && dial(b.grind) !== null) first.set(b.coffeeId, dial(b.grind)!);
  const drifted = c.all.filter((b) => inPeriod(b.localDate, c.period) && b.grinder === c.grinder && first.has(b.coffeeId!) && dial(b.grind) !== null && b.brewIndex > 0);
  const drift = [...groupBy(drifted, (b) => bandOf('brewNo', b)!.label)].map(([label, g]) => {
    const bags = new Set(g.map((b) => b.coffeeId)).size;
    return { label, value: round2(mean(g.map((b) => dial(b.grind)! - first.get(b.coffeeId!)!))), bags, sample: pooled(bags, g.length) };
  }).sort((a, b) => BREW_NO_LABELS.indexOf(a.label) - BREW_NO_LABELS.indexOf(b.label));
  const VARS: BrewVar[] = ['temp', 'ratio', 'dose', 'time', 'bloom', 'grind'];
  const ww = c.bags ? waitWindow(brews, c.whole ?? c.all, c.bags, c) : null;
  return {
    wait: ww && (ww.byWait.some((w) => w.rating !== null) || ww.window.some((w) => w.brews > 0) ? ww : null),
    rest: restMap && { ...restMap, best: restMap.cells.map(bestOf) },
    dialIn: pairedDeltas(every, labFn('brewNo'), 1),
    bestAt: best.length ? BREW_NO_LABELS.slice(0, BEST_WINDOW).map((label) => ({ label, bags: best.filter((l) => l === label).length })) : [],
    bestLater: BREW_NO_LABELS.slice(BEST_WINDOW).flatMap((label) => { const bags = later.filter((l) => l === label).length; return bags ? [{ label, bags }] : []; }),
    drift: drift.length >= 2 ? drift : [],
    settle: Object.fromEntries((['roast', 'process', 'dripper', 'water'] as const).map((k) => {
      const g = settleGroups({ brews: (c.whole ?? c.all).filter((b) => inPeriod(b.localDate, c.period)), ratings: c.ratings }, SETTLE_DIM[k], matchesBrew(exceptOwn(c.brewFilters ?? {}, k))) // a chart ignores its own filter
        .sort((a, b) => a.value - b.value || b.bags - a.bags || a.label.localeCompare(b.label))
        .map(({ label, value, bags, brews, sample }) => ({ label, value, bags, brews, sample }));
      return [k, g.length >= 2 ? g : []];
    })) as BrewingTab['settle'],
    vars: VARS.flatMap((key) => {
      const f = labFn(c.exact[key] ? `${key}Exact` : key, c.grinder); // each chart's own Band/Exact toggle (G10)
      // A band with no paired brews carries no delta: dropped, except exact temps (every whole °C used is listed, user)
      // and grind (round 2: a setting with brews but no same-bag pair shows as "no match", as Recipes do).
      const paired = pairedDeltas(rows, f).filter((b) => b.delta !== null || key === 'grind' || (key === 'temp' && c.exact.temp));
      // Grind bands: no step skipped inside the range (M-6); Exact lists only the settings used.
      const bands = key === 'grind' && !c.exact.grind ? fillGrind(paired, emptyStat) : paired;
      const by = c.by[key];
      return bands.length ? [{ key, bands, by: by ? breakdown(rows, f, SLICE_OF[by], bands.map((b) => b.label), 2, key === 'grind') : null }] : [];
    })
  };
}

export type LeaderRow = BandStat & { months?: string };
// Leaderboard order: rows with a same-bag delta first, solid before thin (as Leaderboards' min3), best
// delta first; then the rest by adjusted mean.
export const ranked = <T extends BandStat>(st: T[]): T[] =>
  [...st].sort((a, b) => Number(b.delta !== null) - Number(a.delta !== null) || Number(b.solid) - Number(a.solid) ||
    (b.delta ?? 0) - (a.delta ?? 0) || b.adjusted - a.adjusted || a.label.localeCompare(b.label));
// "Feb–Apr", one month "Sep", across years "Nov 25–Feb 26" (rows in time order).
const monthsOf = (bs: readonly BrewFact[]) => {
  const [a, b] = [bs[0].localDate, bs.at(-1)!.localDate], y = a.slice(0, 4) !== b.slice(0, 4);
  const m = (d: string) => `${MON[+d.slice(5, 7) - 1]}${y ? ` ${d.slice(2, 4)}` : ''}`;
  return a.slice(0, 7) === b.slice(0, 7) ? m(a) : `${m(a)}–${m(b)}`;
};
const bagMeanAvg = (rs: readonly BrewFact[]) => mean([...groupBy(rs, (b) => b.coffeeId).values()].map((g) => mean(g.map((b) => b.rating!))));
// Whole percents that sum to exactly 100 (largest remainder; ties go to the earlier line).
const hundred = (xs: number[]) => {
  const out = xs.map(Math.floor);
  let left = 100 - out.reduce((s, x) => s + x, 0);
  for (const i of xs.map((_, i) => i).sort((a, b) => xs[b] - out[b] - (xs[a] - out[a]) || a - b)) if (left-- > 0) out[i]++;
  return out;
};
// Each month's shares of brews (the lines, with "Other", cover every brew) sum to 100: stacked bars (G6).
// `other[i]`: what month i's "Other" segment holds, [name, whole % of the month] biggest first (round 2, C4).
export type Eras = Multi & { other: [string, number][][] };
const eraOf = (brews: readonly BrewFact[], period: Period, key: (b: BrewFact) => string | null): Eras | null => {
  const rows = brews.filter((b) => inPeriod(b.localDate, period) && key(b));
  const m = monthlyMulti(rows, key, (g, month) => (100 * g.length) / month.length, '%', 20);
  if (!m) return null;
  const cols = m.x.map((_, i) => hundred(m.lines.map((l) => l.values[i] ?? 0)));
  // The same months monthlyMulti kept (≥ 20 brews), in order.
  const months = [...groupBy(rows, (b) => b.localDate.slice(0, 7))].filter(([, g]) => g.length >= 20).sort(([a], [b]) => a.localeCompare(b));
  const named = new Set(m.lines.map((l) => l.label));
  const other = months.map(([, g]) => [...groupBy(g.filter((b) => !named.has(key(b)!)), key)]
    .map(([k, x]): [string, number] => [k!, Math.round((100 * x.length) / g.length)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  return { ...m, lines: m.lines.map((l, j) => ({ ...l, values: cols.map((col) => col[j]) })), other };
};

export interface WaterPair {
  a: string; b: string; // A = the recipe that won more bags (then the higher mean delta, then name)
  slug: string; // "a--b" (slugified, sorted: independent of which recipe wins): the URL's `pairs` names the expanded pairs by it
  won: number; lost: number; tied: number; // bags, from A's side; tied = bag means within 0.005
  delta: number; // mean over the bags of A's bag mean minus B's
  bags: { label: string; tag: string | null; href: string | null; a: number; b: number; na: number; nb: number; win: 'a' | 'b' | null }[]; // na / nb: rated brews behind a / b; win: the higher side, null = a tie; biggest |a − b| first
}
export interface WaterTab {
  recipes: LeaderRow[];
  map: MineralMap | null;
  gh: BandStat[]; byRoast: Breakdown | null; byProcess: Breakdown | null; eras: Eras | null;
  pairs: WaterPair[]; // most bags first
}
const MINERAL_UNIT: Partial<Record<Mineral, string>> = { gh: 'ppm', kh: 'ppm', mgca: '', mgk: '' };
// Recipe mineral map (round 2, W-map): a row per recipe with an entered profile, in Ratings by recipe order
// (no match last), its same-bag delta and counts, and its profile's amounts per column (null = not entered).
// `unit`: mg/L, ppm (GH, KH), '' for the ratios.
export interface MineralMap {
  cols: { key: Mineral; name: string; unit: string }[];
  rows: { label: string; delta: number | null; se: number | null; solid: boolean; sample: Sample; strength: Strength | null; brews: number; bags: number; values: (number | null)[] }[];
}
const MAP_COLS = MINERALS.filter(([k]) => k !== 'chloride' && k !== 'sulfate');
function mineralMap(rows: readonly BrewFact[], recipes: LeaderRow[]): MineralMap | null {
  // ponytail: keyed by recipe name, last brew wins; recipes with equal names but different profiles show one. Key by water id if that ever happens.
  const profiled = new Map(rows.filter((b) => b.water && MAP_COLS.some(([k]) => mineralOf(k, b) !== null)).map((b) => [b.water!, b]));
  const out = recipes.flatMap((r) => {
    const b = profiled.get(r.label);
    return b ? [{ label: r.label, delta: r.delta, se: r.se, solid: r.solid, sample: r.sample, strength: r.strength, brews: r.plainBrews, bags: r.plainBags,
      values: MAP_COLS.map(([k]) => mineralOf(k, b)) }] : [];
  });
  return out.length ? { cols: MAP_COLS.map(([key, name]) => ({ key, name, unit: MINERAL_UNIT[key] ?? 'mg/L' })), rows: out } : null;
}
const TIE = 0.005; // bag means this close show the same at 2 dp: a tie
export function waterTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; ratings: Ratings }): WaterTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  const water = labFn('water');
  const byWater = groupBy(rows, (b) => b.water);
  const recipes = ranked(pairedDeltas(rows, water)).map((s) => ({ ...s, months: monthsOf(byWater.get(s.label)!) }));
  const cols = recipes.map((r) => r.label);
  const byId = new Map(bags.map((b) => [b.id, b]));
  return {
    recipes,
    map: mineralMap(rows, recipes),
    gh: pairedDeltas(rows, labFn('gh')),
    byRoast: breakdown(rows, water, SLICE_OF.roast, cols),
    byProcess: breakdown(rows, water, SLICE_OF.process, cols),
    eras: eraOf(brews, c.period, (b) => b.water),
    pairs: waterPairs(rows, byId)
  };
}

// Same bag, different water (W7): every two recipes a bag was brewed with (≥ 2 rated brews each), grouped by
// recipe pair. A bag with three recipes joins three pairs.
function waterPairs(rows: readonly BrewFact[], byId: Map<number, BagFact>): WaterPair[] {
  const pairs = new Map<string, { x: string; y: string; bags: { id: number; x: number; y: number; nx: number; ny: number }[] }>();
  for (const [id, g] of groupBy(rows.filter((b) => b.water), (b) => b.coffeeId)) {
    const ws = [...groupBy(g, (b) => b.water)].filter(([, x]) => x.length >= 2)
      .map(([w, x]) => ({ w: w!, m: mean(x.map((b) => b.rating!)), n: x.length })).sort((a, b) => a.w.localeCompare(b.w));
    for (let i = 0; i < ws.length; i++)
      for (let j = i + 1; j < ws.length; j++) {
        const k = `${ws[i].w}\u0000${ws[j].w}`;
        (pairs.get(k) ?? pairs.set(k, { x: ws[i].w, y: ws[j].w, bags: [] }).get(k)!).bags.push({ id: id!, x: ws[i].m, y: ws[j].m, nx: ws[i].n, ny: ws[j].n });
      }
  }
  return [...pairs.values()].map((p) => {
    const d = p.bags.map((b) => b.x - b.y);
    const xw = d.filter((x) => x >= TIE).length, yw = d.filter((x) => x <= -TIE).length;
    const flip = yw > xw || (yw === xw && mean(d) < 0);
    const bags = p.bags.map(({ id, x, y, nx, ny }) => {
      const bag = byId.get(id);
      return { label: bag ? `${bag.roaster} · ${bag.name}` : `Bag ${id}`, href: bag?.slug ? `/coffees/${bag.slug}` : null,
        roastedOn: bag?.purchaseDate ?? null, openedOn: bag?.firstBrew ?? null, a: flip ? y : x, b: flip ? x : y, na: flip ? ny : nx, nb: flip ? nx : ny, win: Math.abs(x - y) < TIE ? null : (x > y) !== flip ? 'a' as const : 'b' as const };
    }).sort((u, v) => Math.abs(v.a - v.b) - Math.abs(u.a - u.b) || u.label.localeCompare(v.label)); // biggest gap first (the UI shows 5)
    const [a, b] = flip ? [p.y, p.x] : [p.x, p.y];
    return { a, b, slug: [slugify(a) || 'x', slugify(b) || 'x'].sort().join('--'), won: flip ? yw : xw, lost: flip ? xw : yw, tied: d.length - xw - yw,
      delta: (flip ? -1 : 1) * mean(d), bags: tagTwins(bags) };
  }).sort((p, q) => q.bags.length - p.bags.length || p.a.localeCompare(q.a) || p.b.localeCompare(q.b));
}

export interface GearTab { drippers: BandStat[]; filters: BandStat[]; matrix: Breakdown | null; byRoast: Breakdown | null; eras: Eras | null; grinderEras: Eras | null }
export function gearTab(brews: readonly BrewFact[], c: { period: Period; ratings: Ratings }): GearTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  const filter = labFn('filter');
  const drippers = ranked(pairedDeltas(rows, labFn('dripper')));
  const filters = ranked(pairedDeltas(rows, filter));
  // Filters within each dripper (R3): same bag AND same dripper, different filter. Rows = drippers with rated
  // brews on ≥ 2 filters (unpaired cells blank); columns = the filters those rows used.
  const within = new Map([...groupBy(rows.filter((b) => b.dripper && filter(b)), (b) => b.dripper)]
    .map(([d, g]) => [d!, new Map(pairedDeltas(g, filter).map((s) => [s.label, s]))] as const)
    .filter(([, st]) => st.size >= 2));
  const mRows = drippers.map((d) => d.label).filter((d) => within.has(d));
  const mCols = filters.map((f) => f.label).filter((f) => mRows.some((d) => within.get(d)!.has(f)));
  return {
    drippers, filters,
    matrix: mRows.length ? trimBlank({
      rows: mRows, cols: mCols,
      cells: mRows.map((d) => mCols.map((f) => { const s = within.get(d)!.get(f); return s ? cellOf(s) : null; }))
    }) : null,
    byRoast: breakdown(rows, labFn('dripper'), SLICE_OF.roast, drippers.map((d) => d.label)),
    eras: eraOf(brews, c.period, (b) => b.dripper),
    grinderEras: eraOf(brews, c.period, (b) => b.grinder)
  };
}
