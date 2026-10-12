import type { Ratings } from '$lib/insightsUrl';
import type { BrewFact } from './facts';
import { bandOf, type Band, type LabVar } from './labBands';
import { countsForRating, ratedGroups } from './ratings';
import { groupBy } from './records';
import { brewZ, demeaned, groupZ, mean, MIN_BAGS, MIN_BREWS, sd, strengthOf, type Strength } from './stats';
import { inPeriod, type Period } from './time';

type Slice = 'roast' | 'process' | 'origin' | 'roaster'; // Task 6: from $lib/insightsUrl

// The lab's input rows: the period's linked brews with a counted rating (spec "Shared rules").
export const ratedIn = (brews: readonly BrewFact[], period: Period, ratings: Ratings): BrewFact[] =>
  brews.filter((b) => b.coffeeId !== null && inPeriod(b.localDate, period) && countsForRating(b, ratings) && b.rating! > 0);

export type BandFn = (b: BrewFact) => Band | null;
export const labFn = (v: LabVar, grinder: string | null = null): BandFn => (b) => bandOf(v, b, grinder);

export interface BandStat {
  label: string; order: number;
  delta: number | null; // mean same-bag delta of the paired brews; null = no paired bag
  brews: number; bags: number; // paired brews / bags behind `delta`
  solid: boolean; // ≥ MIN_BAGS paired bags and ≥ MIN_BREWS paired brews
  strength: Strength | null; // vs the other bands' deltas, Bonferroni over every band of the variable in the period's data; null = nothing to compare
  adjusted: number; plainBrews: number; plainBags: number; // bag-weighted adjusted mean (K = 5) over every rated brew in the band
  spread: number | null; // sample SD of the band's brews' same-bag deltas (consistency); null under 2 brews
}
const byOrder = (a: { order: number; label: string }, b: { order: number; label: string }) => a.order - b.order || a.label.localeCompare(b.label);
const sampleSd = (xs: number[]) => sd(xs) * Math.sqrt(xs.length / (xs.length - 1));

// Same-bag deltas per band (spec "The measurement"): rating minus the bag's mean over `rows`. A bag is
// paired when ≥ 2 of its bands have ≥ minPerBand brews; those bands' brews make `delta`.
export function pairedDeltas(rows: readonly BrewFact[], band: BandFn, minPerBand = 2): BandStat[] {
  const dm = demeaned(rows).flatMap((r) => { const k = band(r); return k ? [{ ...r, k }] : []; });
  const bands = new Map<string, { order: number; paired: number[]; bags: Set<number>; all: number[] }>();
  for (const r of dm) (bands.get(r.k.label) ?? bands.set(r.k.label, { order: r.k.order, paired: [], bags: new Set(), all: [] }).get(r.k.label)!).all.push(r.dm);
  for (const [id, rs] of groupBy(dm, (r) => r.coffeeId)) {
    const used = [...groupBy(rs, (r) => r.k.label)].filter(([, g]) => g.length >= minPerBand);
    if (used.length < 2) continue;
    for (const [label, g] of used) { const s = bands.get(label)!; s.paired.push(...g.map((r) => r.dm)); s.bags.add(id!); }
  }
  const plain = new Map(ratedGroups(dm, (r) => r.k.label, 'all', 'adjusted').map((g) => [g.label, g]));
  const tests = bands.size; // Bonferroni: every band of the variable present in the data (spec), not only those with pairs
  const residual = sd([...bands.values()].flatMap((s) => s.paired));
  return [...bands].map(([label, s]): BandStat => {
    const others = [...bands].filter(([l]) => l !== label).flatMap(([, o]) => o.paired);
    const solid = s.bags.size >= MIN_BAGS && s.paired.length >= MIN_BREWS;
    const z = s.paired.length && others.length && residual > 0 ? brewZ(s.paired, others, residual) : null;
    const g = plain.get(label)!;
    return {
      label, order: s.order, delta: s.paired.length ? mean(s.paired) : null, brews: s.paired.length, bags: s.bags.size, solid,
      strength: z === null ? null : strengthOf(z, solid, tests),
      adjusted: g.adjusted, plainBrews: g.brews, plainBags: g.bags, spread: s.all.length >= 2 ? sampleSd(s.all) : null
    };
  }).sort(byOrder);
}

// Tier 2: per band, each bag's mean rating within the band (the bag is the unit, no pseudo-replication).
function bagBandMeans(rows: readonly BrewFact[], band: BandFn) {
  const out = new Map<string, { order: number; means: number[]; brews: number }>();
  for (const bs of groupBy(rows, (b) => b.coffeeId).values())
    for (const [label, g] of groupBy(bs, (b) => band(b)?.label)) {
      const s = out.get(label) ?? out.set(label, { order: band(g[0])!.order, means: [], brews: 0 }).get(label)!;
      s.means.push(mean(g.map((b) => b.rating!)));
      s.brews += g.length;
    }
  return out;
}

export interface Group { name: string; brews: BrewFact[] } // narrowest first
export interface Spot {
  tier: 1 | 2 | 3;
  verdict: 'win' | 'leaning' | 'none';
  best: { label: string; value: number; strength: Strength | null } | null; // tier 1: delta; tier 2: mean of bag means
  next: { label: string; value: number } | null; // tier 2: the runner-up band
  group: string | null; // tier 2: the group's name
  bags: number; // tier 1: paired bags behind `best`; tier 2: bags in `best`
  varied: boolean; // tier 3: the widest group used more than one band
  usual: { label: string; mean: number }; // the slice's most-brewed (coarsest) band and its plain mean rating
}
// The Insights tab's two badges: Solid wins, Hint leans (spec "Strong/Likely/Hint" mapped onto them).
export const verdictOf = (s: Strength | null): Spot['verdict'] => (s === 'solid' ? 'win' : s === 'hint' ? 'leaning' : 'none');

// Sweet spots grouping ladder (spec): same bag within the slice, else bag means within the narrowest
// group with ≥ 2 solid bands, else no comparison. `bands` are tried in order (temp: exact, then bands).
export function ladder(slice: readonly BrewFact[], groups: readonly Group[], bands: readonly BandFn[]): Spot | null {
  const coarse = bands.at(-1)!;
  const used = (rows: readonly BrewFact[]) => groupBy(rows, (b) => coarse(b)?.label);
  const top = [...used(slice)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  if (!top) return null; // no brew in the slice has this variable: the card is hidden
  const base = { next: null, group: null, varied: true, usual: { label: top[0], mean: mean(top[1].map((b) => b.rating!)) } };
  for (const f of bands) {
    const solid = pairedDeltas(slice, f).filter((s) => s.solid);
    if (solid.length < 2) continue;
    const b = solid.reduce((x, y) => (y.delta! > x.delta! ? y : x));
    return { ...base, tier: 1, verdict: verdictOf(b.strength), best: { label: b.label, value: b.delta!, strength: b.strength }, bags: b.bags };
  }
  for (const g of groups)
    for (const f of bands) {
      const solid = [...bagBandMeans(g.brews, f)].filter(([, s]) => s.means.length >= MIN_BAGS && s.brews >= MIN_BREWS)
        .sort((a, b) => mean(b[1].means) - mean(a[1].means) || a[1].order - b[1].order);
      if (solid.length < 2) continue;
      const [[label, s], [nextLabel, n]] = solid;
      const strength = strengthOf(groupZ(s.means, solid.flatMap(([, x]) => x.means)), true, solid.length);
      return {
        ...base, tier: 2, verdict: verdictOf(strength), best: { label, value: mean(s.means), strength },
        next: { label: nextLabel, value: mean(n.means) }, group: g.name, bags: s.means.length
      };
    }
  return { ...base, tier: 3, verdict: 'none', best: null, bags: 0, varied: used(groups.at(-1)?.brews ?? slice).size > 1 };
}

export const SLICE_OF: Record<Slice, (b: BrewFact) => string | null> = {
  roast: (b) => b.roastLevel, process: (b) => b.processGroup, origin: (b) => b.origin, roaster: (b) => b.roaster
};
export interface Cell { delta: number | null; brews: number; bags: number } // delta null = thin (blank); counts for the tip
// One mapping for every heatmap (breakdown, gearTab's matrix): counts are the paired brews and bags
// behind the delta, so a tip never reads "6 brews, 0 bags".
export const cellOf = (s: BandStat): Cell => ({ delta: s.solid ? s.delta : null, brews: s.brews, bags: s.bags });
export interface Breakdown { rows: string[]; cols: string[]; cells: (Cell | null)[][] } // null cell = no brews there

// A heatmap of same-bag deltas: rows = slice values with ≥ MIN_BAGS bags that have the variable,
// most-brewed first; columns = `cols`. A bag's mean stays its mean over the whole row (all its brews).
export function breakdown(rows: readonly BrewFact[], band: BandFn, slice: (b: BrewFact) => string | null, cols: string[], minPerBand = 2): Breakdown | null {
  const groups = [...groupBy(rows, slice)]
    .filter(([, g]) => new Set(g.filter((b) => band(b)).map((b) => b.coffeeId)).size >= MIN_BAGS)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (!groups.length) return null;
  return {
    rows: groups.map(([k]) => k),
    cols,
    cells: groups.map(([, g]) => {
      const st = new Map(pairedDeltas(g, band, minPerBand).map((s) => [s.label, s]));
      return cols.map((c) => { const s = st.get(c); return s ? cellOf(s) : null; });
    })
  };
}
