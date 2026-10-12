import { MON, type Ratings, type Slice } from '$lib/insightsUrl';
import { slugify } from '$lib/server/slug';
import { grindKey, MIXED_FILTER, type BagFact, type BrewFact } from './facts';
import { monthlyMulti, shareCell, type Multi } from './insightGenerators';
import { BREW_NO_LABELS, MINERALS, REST_LABELS, bandOf, mineralOf, type Band, type LabVar, type Mineral } from './labBands';
import { countsForRating, ratedGroups } from './ratings';
import { groupBy } from './records';
import { brewZ, demeaned, groupZ, mean, MIN_BAGS, MIN_BREWS, sd, strengthOf, type Strength } from './stats';
import { inPeriod, type Period } from './time';

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
  spread: number | null; // sample SD of the paired brews' same-bag deltas (consistency); null under 2 paired brews
}
const EPS = 1e-9; // an SD below this is float noise: no spread to measure a gap against
const byOrder = (a: { order: number; label: string }, b: { order: number; label: string }) => a.order - b.order || a.label.localeCompare(b.label);
const sampleSd = (xs: number[]) => sd(xs) * Math.sqrt(xs.length / (xs.length - 1));

// Same-bag deltas per band (spec "The measurement"): rating minus the bag's mean over `rows`. A bag is
// paired when ≥ 2 of its bands have ≥ minPerBand brews; those bands' brews make `delta`.
export function pairedDeltas(rows: readonly BrewFact[], band: BandFn, minPerBand = 2): BandStat[] {
  const dm = demeaned(rows).flatMap((r) => { const k = band(r); return k ? [{ ...r, k }] : []; });
  const bands = new Map<string, { order: number; paired: number[]; bags: Set<number> }>();
  for (const r of dm) if (!bands.has(r.k.label)) bands.set(r.k.label, { order: r.k.order, paired: [], bags: new Set() });
  for (const [id, rs] of groupBy(dm, (r) => r.coffeeId)) {
    const used = [...groupBy(rs, (r) => r.k.label)].filter(([, g]) => g.length >= minPerBand);
    if (used.length < 2) continue;
    for (const [label, g] of used) { const s = bands.get(label)!; s.paired.push(...g.map((r) => r.dm)); s.bags.add(id!); }
  }
  const plain = new Map(ratedGroups(dm, (r) => r.k.label, 'all', 'adjusted').map((g) => [g.label, g]));
  const tests = bands.size; // Bonferroni: every band of the variable present in the data (spec), not only those with pairs
  const residual = sd([...bands.values()].flatMap((s) => s.paired));
  const pairedSd = new Map([...bands].map(([l, s]) => [l, s.paired.length >= 2 ? sampleSd(s.paired) : null]));
  return [...bands].map(([label, s]): BandStat => {
    const others = [...bands].filter(([l]) => l !== label).flatMap(([, o]) => o.paired);
    const solid = s.bags.size >= MIN_BAGS && s.paired.length >= MIN_BREWS;
    const z = s.paired.length && others.length && residual > EPS ? brewZ(s.paired, others, residual) : null;
    const g = plain.get(label)!;
    return {
      label, order: s.order, delta: s.paired.length ? mean(s.paired) : null, brews: s.paired.length, bags: s.bags.size, solid,
      strength: z === null ? null : strengthOf(z, solid, tests),
      adjusted: g.adjusted, plainBrews: g.brews, plainBags: g.bags, spread: pairedSd.get(label)!
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

const isSolid = (s: { means: number[]; brews: number }) => s.means.length >= MIN_BAGS && s.brews >= MIN_BREWS;
const meanBands = (all: ReturnType<typeof bagBandMeans>): SpotBand[] =>
  [...all].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([label, s]) => ({ label, value: mean(s.means), bags: s.means.length, brews: s.brews, solid: isSolid(s) }));

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
  // Every band of the evidence the card used, in band order (the card's mini chart): tier 1 same-bag
  // deltas of the winning band set; tier 2 the group's mean of bag means; tier 3 the widest group's bag
  // means on the coarse bands. `solid` as the tier counts it (pale otherwise).
  bands: SpotBand[];
}
export interface SpotBand { label: string; value: number; bags: number; brews: number; solid: boolean }
// The Insights tab's two badges: Solid wins, Hint leans (spec "Strong/Likely/Hint" mapped onto them).
export const verdictOf = (s: Strength | null): Spot['verdict'] => (s === 'solid' ? 'win' : s === 'hint' ? 'leaning' : 'none');

// Sweet spots grouping ladder (spec): same bag within the slice, else bag means within the narrowest
// group with ≥ 2 solid bands, else no comparison. `bands` are tried in order (temp: exact, then bands).
export function ladder(slice: readonly BrewFact[], groups: readonly Group[], bands: readonly BandFn[]): Spot | null {
  const coarse = bands.at(-1)!;
  const used = (rows: readonly BrewFact[]) => groupBy(rows, (b) => coarse(b)?.label);
  const top = [...used(slice)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  if (!top) return null; // no brew in the slice has this variable: the card is hidden
  const base = { next: null, group: null, varied: true, usual: { label: top[0], mean: ratedGroups(top[1], () => 'x', 'all', 'adjusted')[0].mean } };
  for (const f of bands) {
    const st = pairedDeltas(slice, f), solid = st.filter((s) => s.solid);
    if (solid.length < 2) continue;
    const b = solid.reduce((x, y) => (y.delta! > x.delta! ? y : x));
    const shown = st.filter((s) => s.delta !== null).map((s) => ({ label: s.label, value: s.delta!, bags: s.bags, brews: s.brews, solid: s.solid }));
    return { ...base, tier: 1, verdict: verdictOf(b.strength), best: { label: b.label, value: b.delta!, strength: b.strength }, bags: b.bags, bands: shown };
  }
  for (const g of groups)
    for (const f of bands) {
      const all = bagBandMeans(g.brews, f);
      const solid = [...all].filter(([, s]) => isSolid(s))
        .sort((a, b) => mean(b[1].means) - mean(a[1].means) || a[1].order - b[1].order);
      if (solid.length < 2) continue;
      const [[label, s], [nextLabel, n]] = solid;
      const pool = solid.flatMap(([, x]) => x.means);
      // Bonferroni over every band of the group, not only the solid ones.
      const strength = sd(pool) < EPS ? 'early' : strengthOf(groupZ(s.means, pool), true, all.size);
      return {
        ...base, tier: 2, verdict: verdictOf(strength), best: { label, value: mean(s.means), strength },
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
export interface Cell { delta: number | null; solid: boolean; brews: number; bags: number }
// One mapping for every heatmap (breakdown, gearTab's matrix): counts are the paired brews and bags
// behind the delta, so a tip never reads "6 brews, 0 bags".
export const cellOf = (s: BandStat): Cell => ({ delta: s.delta, solid: s.solid, brews: s.brews, bags: s.bags });
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

export interface LabOptions {
  bags: { slug: string; label: string; onHand: boolean; roast: string | null; process: string }[];
  roasts: string[]; processes: string[]; origins: string[]; roasters: string[];
  grinders: { slug: string; name: string }[]; // most rated brews first: [0] is the default
}
// The values the pickers offer and the URL parser accepts (spec "URL state": values from the data).
// Roast levels need ≥ MIN_BAGS brewed bags (spec "Bands"); every slugged bag parses (an archived bag's
// link still works), the Bag select shows the on-hand ones.
export function labOptions(brews: readonly BrewFact[], bags: readonly BagFact[]): LabOptions {
  const brewed = bags.filter((b) => b.firstBrew);
  const values = (f: (b: BagFact) => string | null, min = 1) =>
    [...groupBy(brewed, f)].filter(([, g]) => g.length >= min).map(([k]) => k).sort((a, b) => a.localeCompare(b));
  return {
    bags: bags.filter((b) => b.slug).map((b) => ({ slug: b.slug!, label: `${b.roaster} ${b.name}`, onHand: b.status !== 'archive', roast: b.roastLevel, process: b.processGroup })),
    roasts: values((b) => b.roastLevel, MIN_BAGS), processes: values((b) => b.processGroup), origins: values((b) => b.origin), roasters: values((b) => b.roaster),
    grinders: [...groupBy(brews.filter((b) => b.rating! > 0), (b) => b.grinder)]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([name]) => ({ slug: slugify(name), name }))
  };
}

export interface LabFilters { roast?: string; process?: string; origin?: string; roaster?: string }
const matches = (f: LabFilters) => (b: BrewFact) =>
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
    return [{ name, brews: rows.filter(matches(g)) }];
  });
}

export type SpotVar = 'temp' | 'water' | 'dripper' | 'filter' | 'ratio' | 'dose' | 'grind' | 'bloom' | 'rest';
export const SPOT_NAMES: Record<SpotVar, string> = { temp: 'Temp', water: 'Water', dripper: 'Dripper', filter: 'Filter', ratio: 'Ratio', dose: 'Dose', grind: 'Grind', bloom: 'Bloom', rest: 'Rest' };
const SPOT_VARS: Record<SpotVar, LabVar[]> = { temp: ['tempExact', 'temp'], water: ['water'], dripper: ['dripper'], filter: ['filter'], ratio: ['ratio'], dose: ['dose'], grind: ['grind'], bloom: ['bloom'], rest: ['rest'] };
export interface SweetSpotsTab {
  matching: { bags: number; brews: number };
  cards: { key: SpotVar; name: string; spot: Spot }[];
  // `tag`: what tells apart listed bags sharing a name ("roasted May 5" / "opened Jul 30"), else null.
  topBags: { label: string; tag: string | null; sub: string; href: string | null; score: number; brews: number; usual: string }[];
}
const TOP_N = 5; // bags listed
const TOP_K = 5; // shrink a bag's mean toward the slice mean by 5 brews: one great brew doesn't top the list
const mode = (bs: readonly BrewFact[], f: (b: BrewFact) => string | null | undefined) =>
  [...groupBy(bs, f)].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])))[0]?.[0] ?? null;

export function sweetSpotsTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; ratings: Ratings; grinder: string | null; filters: LabFilters }): SweetSpotsTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  const slice = rows.filter(matches(c.filters));
  const perBag = groupBy(slice, (b) => b.coffeeId);
  const groups = groupsFor(rows, c.filters);
  const cards = (Object.keys(SPOT_VARS) as SpotVar[]).flatMap((key) => {
    const spot = ladder(slice, groups, SPOT_VARS[key].map((v) => labFn(v, c.grinder)));
    return spot ? [{ key, name: SPOT_NAMES[key], spot }] : [];
  });
  const overall = mean(slice.map((b) => b.rating!));
  const byId = new Map(bags.map((b) => [b.id, b]));
  const topBags = [...perBag].map(([id, bs]) => {
    const bag = byId.get(id!);
    return {
      label: bag?.name ?? `Bag ${id}`, sub: bag?.roaster ?? '', href: bag?.slug ? `/coffees/${bag.slug}` : null, brews: bs.length,
      roastedOn: bag?.purchaseDate ?? null, openedOn: bag?.firstBrew ?? null,
      score: (bs.reduce((s, b) => s + b.rating!, 0) + TOP_K * overall) / (bs.length + TOP_K),
      usual: [mode(bs, (b) => bandOf('tempExact', b)?.label), mode(bs, (b) => b.water), mode(bs, (b) => b.dripper)].filter(Boolean).join(' · ')
    };
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, TOP_N);
  // Listed bags sharing a name (a repurchase) each get their roast date, so the rows tell apart; twins
  // roasted the same day get their opened date instead.
  const day = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
  const key = (b: { label: string; tag: string | null }) => `${b.label}|${b.tag}`;
  const twins = <T extends { label: string; tag: string | null }>(xs: T[], b: T) => xs.filter((x) => key(x) === key(b)).length > 1;
  const untagged = topBags.map((b) => ({ ...b, tag: null as string | null }));
  const roasted = untagged.map((b) => (twins(untagged, b) && b.roastedOn ? { ...b, tag: `roasted ${day(b.roastedOn)}` } : b));
  const named = roasted.map((b) => {
    const { roastedOn: _, openedOn, ...row } = b;
    return twins(roasted, b) && openedOn ? { ...row, tag: `opened ${day(openedOn)}` } : row;
  });
  return { matching: { bags: perBag.size, brews: slice.length }, cards, topBags: named };
}

export type BrewVar = 'temp' | 'ratio' | 'dose' | 'time' | 'bloom' | 'grind';
export interface VarChart { key: BrewVar; bands: BandStat[]; by: Breakdown | null }
export interface BrewingTab {
  // x = rest bands; a line per roast level: its bags' mean rating per band (bag = unit) less the roast level's
  // mean bag rating. Lines need ≥ 2 solid bands (null where not solid); when no roast level has that, `faded`
  // and every roast level with ≥ 2 bands of any size is drawn.
  rest: (Multi & { faded: boolean }) | null;
  dialIn: BandStat[]; // delta by brew number in the bag (one brew per band per bag: minPerBand 1)
  bestAt: { label: string; bags: number }[]; // brew number of each bag's best brew (bags with ≥ 5 rated brews)
  drift: { label: string; value: number; bags: number; solid: boolean }[]; // mean setting change vs the bag's first brew
  vars: VarChart[];
}
const round2 = (x: number) => Math.round(x * 100) / 100;
// A grind setting read as a decimal (1.3.5 → 1.35, 6.2 → 6.2), so drift reads in the grinder's own steps.
// ponytail: a part ≥ 10 overlaps the next digit; fine for A4Z / ZP6 settings, revisit for other grinders.
const dial = (g: string | null) => grindKey(g)?.reduce((s, n, i) => s + n / 10 ** i, 0) ?? null;

export function brewingTab(brews: readonly BrewFact[], c: { period: Period; ratings: Ratings; grinder: string | null; by: Partial<Record<BrewVar, Slice>>; exact: boolean }): BrewingTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  // Rest is mostly a bag-level property (a bag spans about one rest band), so same-bag deltas barely exist:
  // compare bags instead (Sweet spots tier 2), each line centred on its roast level's mean bag rating.
  const rest = labFn('rest');
  const restLines = (solidOnly: boolean) => [...groupBy(rows, (b) => b.roastLevel)].flatMap(([label, g]) => {
    const centre = mean([...groupBy(g, (b) => b.coffeeId).values()].map((bs) => mean(bs.map((b) => b.rating!))));
    const bm = bagBandMeans(g, rest);
    const values = REST_LABELS.map((l) => { const s = bm.get(l); return s && (!solidOnly || isSolid(s)) ? round2(mean(s.means) - centre) : null; });
    return label && values.filter((v) => v !== null).length >= 2 ? [{ label, values }] : [];
  }).sort((a, b) => a.label.localeCompare(b.label));
  const solidLines = restLines(true);
  const all = solidLines.length ? solidLines : restLines(false);
  // The axis starts and ends where the data does: bands with no value in any line are trimmed off both ends.
  const has = REST_LABELS.map((_, i) => all.some((l) => l.values[i] !== null));
  const [from, to] = [has.indexOf(true), has.lastIndexOf(true) + 1];
  const lines = all.map((l) => ({ ...l, values: l.values.slice(from, to) }));
  const best = [...groupBy(rows.filter((b) => b.brewIndex > 0), (b) => b.coffeeId).values()].filter((g) => g.length >= 5)
    .map((g) => bandOf('brewNo', g.reduce((x, y) => (y.rating! > x.rating! ? y : x)))!.label); // rows are in time order: earliest best wins
  // Baseline = the bag's first in-period brew on the chosen grinder. Ignores the ratings switch: drift is
  // about settings, not ratings (controller ruling).
  const first = new Map<number, number>();
  for (const b of brews) if (b.coffeeId !== null && inPeriod(b.localDate, c.period) && b.grinder === c.grinder && !first.has(b.coffeeId) && dial(b.grind) !== null) first.set(b.coffeeId, dial(b.grind)!);
  const drifted = brews.filter((b) => inPeriod(b.localDate, c.period) && b.grinder === c.grinder && first.has(b.coffeeId!) && dial(b.grind) !== null && b.brewIndex > 0);
  const drift = [...groupBy(drifted, (b) => bandOf('brewNo', b)!.label)].map(([label, g]) => {
    const bags = new Set(g.map((b) => b.coffeeId)).size;
    return { label, value: round2(mean(g.map((b) => dial(b.grind)! - first.get(b.coffeeId!)!))), bags, solid: bags >= MIN_BAGS }; // solid counts bags only: the bag is the unit, brews within it aren't independent
  }).sort((a, b) => BREW_NO_LABELS.indexOf(a.label) - BREW_NO_LABELS.indexOf(b.label));
  const VARS: [BrewVar, LabVar][] = [['temp', c.exact ? 'tempExact' : 'temp'], ['ratio', 'ratio'], ['dose', 'dose'], ['time', 'time'], ['bloom', 'bloom'], ['grind', 'grind']];
  return {
    rest: lines.length ? { x: REST_LABELS.slice(from, to), lines, unit: 'vs roast level average', faded: !solidLines.length } : null,
    dialIn: pairedDeltas(rows, labFn('brewNo'), 1),
    bestAt: best.length ? BREW_NO_LABELS.map((label) => ({ label, bags: best.filter((l) => l === label).length })) : [],
    drift: drift.length >= 2 ? drift : [],
    vars: VARS.flatMap(([key, v]) => {
      const f = labFn(v, c.grinder);
      // A band with no paired brews carries no delta: dropped, except exact temps (every whole °C used is listed, user).
      const bands = pairedDeltas(rows, f).filter((b) => b.delta !== null || (key === 'temp' && c.exact));
      const by = c.by[key];
      return bands.length ? [{ key, bands, by: by ? breakdown(rows, f, SLICE_OF[by], bands.map((b) => b.label)) : null }] : [];
    })
  };
}

export type LeaderRow = BandStat & { months?: string };
// Leaderboard order: rows with a same-bag delta first (best first), then the rest by adjusted mean.
export const ranked = <T extends BandStat>(st: T[]): T[] =>
  [...st].sort((a, b) => Number(b.delta !== null) - Number(a.delta !== null) || (b.delta ?? 0) - (a.delta ?? 0) || b.adjusted - a.adjusted || a.label.localeCompare(b.label));
// "Feb–Apr", one month "Sep", across years "Nov 25–Feb 26" (rows in time order).
const monthsOf = (bs: readonly BrewFact[]) => {
  const [a, b] = [bs[0].localDate, bs.at(-1)!.localDate], y = a.slice(0, 4) !== b.slice(0, 4);
  const m = (d: string) => `${MON[+d.slice(5, 7) - 1]}${y ? ` ${d.slice(2, 4)}` : ''}`;
  return a.slice(0, 7) === b.slice(0, 7) ? m(a) : `${m(a)}–${m(b)}`;
};
const bagMeanAvg = (rs: readonly BrewFact[]) => mean([...groupBy(rs, (b) => b.coffeeId).values()].map((g) => mean(g.map((b) => b.rating!))));
const eraOf = (brews: readonly BrewFact[], period: Period, key: (b: BrewFact) => string | null) =>
  monthlyMulti(brews.filter((b) => inPeriod(b.localDate, period) && key(b)), key, shareCell, '%', 20);

export interface WaterTab {
  recipes: LeaderRow[];
  minerals: { key: Mineral; name: string; overall: number; bars: { label: string; value: number; brews: number; bags: number; solid: boolean }[] }[];
  gh: BandStat[]; byRoast: Breakdown | null; byProcess: Breakdown | null; eras: Multi | null;
  pairs: { label: string; href: string | null; best: { water: string; mean: number }; others: { water: string; mean: number }[]; gap: number }[];
}
export function waterTab(brews: readonly BrewFact[], bags: readonly BagFact[], c: { period: Period; ratings: Ratings }): WaterTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  const water = labFn('water');
  const byWater = groupBy(rows, (b) => b.water);
  const recipes = ranked(pairedDeltas(rows, water)).map((s) => ({ ...s, months: monthsOf(byWater.get(s.label)!) }));
  const cols = recipes.map((r) => r.label);
  const byId = new Map(bags.map((b) => [b.id, b]));
  return {
    recipes,
    // Plain adjusted means (spec exception): same-bag water pairs are too thin; the UI notes the confound.
    minerals: MINERALS.flatMap(([key, name]) => {
      const has = rows.filter((b) => mineralOf(key, b) !== null);
      const g = ratedGroups(has, (b) => String(mineralOf(key, b)), 'all', 'adjusted');
      if (g.length < 2) return [];
      return [{ key, name, overall: bagMeanAvg(has), bars: g.map((x) => ({ label: x.label, value: x.adjusted, brews: x.brews, bags: x.bags, solid: x.bags >= MIN_BAGS && x.brews >= MIN_BREWS })).sort((a, b) => +a.label - +b.label) }];
    }),
    gh: pairedDeltas(rows, labFn('gh')),
    byRoast: breakdown(rows, water, SLICE_OF.roast, cols),
    byProcess: breakdown(rows, water, SLICE_OF.process, cols),
    eras: eraOf(brews, c.period, (b) => b.water),
    pairs: [...groupBy(rows.filter((b) => b.water), (b) => b.coffeeId)].flatMap(([id, g]) => {
      const ws = [...groupBy(g, (b) => b.water)].filter(([, x]) => x.length >= 2)
        .map(([w, x]) => ({ water: w!, mean: mean(x.map((b) => b.rating!)) })).sort((a, b) => b.mean - a.mean || a.water.localeCompare(b.water));
      if (ws.length < 2) return [];
      const bag = byId.get(id!);
      return [{ label: bag ? `${bag.roaster} ${bag.name}` : `Bag ${id}`, href: bag?.slug ? `/coffees/${bag.slug}` : null, best: ws[0], others: ws.slice(1), gap: ws[0].mean - ws[1].mean }];
    }).sort((a, b) => b.gap - a.gap || a.label.localeCompare(b.label)).slice(0, 10) // ponytail: top 10 pairs; add a Show all when asked
  };
}

export interface GearTab { drippers: BandStat[]; filters: BandStat[]; matrix: Breakdown | null; byRoast: Breakdown | null; eras: Multi | null }
export function gearTab(brews: readonly BrewFact[], c: { period: Period; ratings: Ratings }): GearTab {
  const rows = ratedIn(brews, c.period, c.ratings);
  const drippers = ranked(pairedDeltas(rows, labFn('dripper')));
  const filters = ranked(pairedDeltas(rows, labFn('filter')));
  // The matrix: each dripper + filter pair is one band; pivoted into rows (drippers) × columns (filters).
  const combos = new Map(pairedDeltas(rows, (b) => (b.dripper && b.filter && b.filter !== MIXED_FILTER ? { label: `${b.dripper}\u0000${b.filter}`, order: 0 } : null))
    .map((s) => [s.label, s]));
  const used = [...combos.keys()].map((k) => k.split('\u0000'));
  const mRows = drippers.map((d) => d.label).filter((d) => used.some(([x]) => x === d));
  const mCols = filters.map((f) => f.label).filter((f) => used.some(([, y]) => y === f));
  return {
    drippers, filters,
    matrix: mRows.length && mCols.length ? {
      rows: mRows, cols: mCols,
      cells: mRows.map((d) => mCols.map((f) => { const s = combos.get(`${d}\u0000${f}`); return s ? cellOf(s) : null; }))
    } : null,
    byRoast: breakdown(rows, labFn('dripper'), SLICE_OF.roast, drippers.map((d) => d.label)),
    eras: eraOf(brews, c.period, (b) => b.dripper)
  };
}
