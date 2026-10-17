import { MON, type Ratings, type Theme } from '$lib/insightsUrl';
import { likeGap as gapText } from '$lib/components/deltaColor'; // like gaps read the same as on Leaderboards ("−0.1")
import { formatGrams } from '$lib/grams';
import type { WhatIf } from '$lib/insightsWhatIf';
import { grindValue, MIXED_FILTER, restDays, type BagFact, type BrewFact } from './facts';
import { countsForRating } from './ratings';
import { SETTLE_WINDOW, settleWithin } from './dialed';
import { brewZ, demeaned, mean, MIN_BAGS, MIN_BREWS, partialR, pearson, restZ, sd, solidBar, strengthOf, type Strength } from './stats';
import { consumption, remaining } from './overview';
import { likeGaps, roasterLikes, type Like } from './likeGroup';
import { BAG_MIN_BREWS, POOLED_MIN_BAGS, pooled, single } from '$lib/sample';
import { tagTwins } from './lab';
import { listHref } from './leaderboards';
import { groupBy } from './records';
import { addDays, daysBetween, inPeriod, trackedBounds, trackedDays, weekday } from './time';

export type CardKind = 'number' | 'pattern' | 'versus' | 'myth' | 'story';
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
  of?: string; // a story: the key of the grid finding it retells (left out of the grid)
  // Multi-line trend: x = period labels ("Mar 26"), one line per category, null = gap.
  multi?: { x: string[]; lines: { label: string; values: (number | null)[] }[]; unit?: string };
  progress?: number; // too early only: n / (n + more needed), 0..1, how close to settled
  details?: { label: string; items: DetailItem[] }[]; // supporting lists from real data: ≤ 2 groups × 2 items
  chart?: 'bars'; // draw `series` as mini vertical bars instead of a line
  barLabels?: 'full'; // bars: full labels with values (default: one-letter labels, the weekday bars)
}
export interface DetailItem { name: string; value?: string; href?: string }
export interface GenCtx {
  brews: readonly BrewFact[]; bags: readonly BagFact[]; prevBrews: readonly BrewFact[] | null;
  ratings: Ratings; today: string; householdSize: number; onHandG: number;
  logged: Map<number, number>; // all-history doses per bag (loggedGrams), so on-hand amounts match onHandG
  period: { from: string; to: string }; dataStart: string; // What-if defaults (Task 14)
  allBrews: readonly BrewFact[]; // in-period, every rating: the dial-in findings (Once dialed exempts them)
  dialIn: ReadonlySet<number>; // dialed.ts dialInIds over the whole history
}
export type Generator = (c: GenCtx) => Finding | Finding[] | null;

const num = (x: number, d = 2) => (+x.toFixed(d) || 0).toFixed(d); // never "-0.00"
const signed = (x: number, d = 2) => `${+x.toFixed(d) < 0 ? '-' : '+'}${Math.abs(x).toFixed(d)}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const rated = (b: BrewFact) => b.rating !== null && b.rating > 0; // 0 = not entered
const counted = (c: Pick<GenCtx, 'brews' | 'ratings'>) => c.brews.filter((b) => countsForRating(b, c.ratings) && rated(b));
const bagLabel = (c: GenCtx, id: number, b = bagById(c).get(id)) => (b ? `${b.roaster} ${b.name}` : `Bag ${id}`);
// Mean rating per bag, for bags with BAG_MIN_BREWS+ rated brews: the page's one bag rule (sample.ts, fullBags).
const bagMeans = (rows: readonly BrewFact[]): Map<number, number> =>
  new Map([...perBag(rows)].filter(([, bs]) => bs.length >= BAG_MIN_BREWS).map(([id, bs]) => [id, mean(bs.map((b) => b.rating!))]));
// Rated brews of each bag, in time order.
const perBag = (rows: readonly BrewFact[]): Map<number, BrewFact[]> => groupBy(rows, (b) => b.coffeeId);
// Supporting lists: `details(['Label', items], …)` keeps non-empty groups, DETAIL_ITEMS each, unique names.
const DETAIL_ITEMS = 2;
const detail = (name: string, value?: string, href?: string | null): DetailItem => ({ name, ...(value ? { value } : {}), ...(href ? { href } : {}) });
const coffeeHref = (b: BagFact | undefined) => (b?.slug ? `/coffees/${b.slug}` : null);
function details(...groups: [string, DetailItem[]][]): Pick<Finding, 'details'> {
  const out = groups.map(([label, items]) => ({ label, items: items.filter((x, i) => items.findIndex((y) => y.name === x.name) === i).slice(0, DETAIL_ITEMS) })).filter((g) => g.items.length);
  return out.length ? { details: out } : {};
}
// Cached per bags array: bagLabel and the generators call it inside loops.
const bagMaps = new WeakMap<readonly BagFact[], Map<number, BagFact>>();
const bagById = (c: GenCtx) => bagMaps.get(c.bags) ?? (bagMaps.set(c.bags, new Map(c.bags.map((b) => [b.id, b]))), bagMaps.get(c.bags)!);
// Mean paired difference with z = mean / (sample sd / sqrt(n)); non-finite z when the data can't support one.
const paired = (d: number[]) => ({ m: mean(d), z: mean(d) / ((sd(d) * Math.sqrt(d.length / (d.length - 1))) / Math.sqrt(d.length)) });

// ponytail: "about N more would settle it" assumes the effect and spread stay as seen.
// progress = n / (n + more): how far the sample is toward settling it (0 when it never would).
const settleText = (z: number, n: number, unit: string, bar = 2): { settle?: string; progress: number } => {
  const more = Math.ceil(n * ((bar / z) ** 2 - 1));
  if (!Number.isFinite(more) || more > 10 * n) return { settle: 'Too small a difference to settle with your data.', progress: Number.isFinite(more) ? n / (n + more) : 0 };
  return more > 0 ? { settle: `About ${more} more ${unit} would settle it.`, progress: n / (n + more) } : { progress: 1 };
};

// Attach z and strength; null when z isn't finite or the strength is hidden. `tests` > 1: the finding
// is the pick of a multiple-comparison set, held to a Bonferroni bar (spec: Strength). `sdN`: the units the SE's spread
// was measured over (default n; all bags for a group vs all): under T_SMALL the test is a t test on sdN − 1 df.
function graded(f: Omit<Finding, 'z' | 'strength'>, z: number, enough: boolean, unit: string, n: number, caveatEarly?: string, tests = 1, sdN = n): Finding | null {
  // A signed delta that rounds to ±0.00 isn't a finding ("rate 0.00 higher").
  if (!Number.isFinite(z) || /^[-+]0\.0+$/.test(f.value ?? '')) return null;
  const strength = strengthOf(z, enough, tests, sdN);
  if (strength === 'hidden') return null;
  const early = strength === 'early';
  return { ...f, z, strength, ...(early ? { ...settleText(z, n, unit, solidBar(tests)), caveat: caveatEarly ?? f.caveat } : {}) };
}

const LB = '/insights?tab=leaderboards';
const DIAL_IN = '/insights?tab=brewing#brewing-dialin'; // rescues: the Brewing tab's Dial-in chart
const SETTLE: Record<'roastLevel' | 'processGroup', string> = { roastLevel: '/insights?tab=brewing#brewing-settle-roast', processGroup: '/insights?tab=brewing#brewing-settle-process' }; // dialinBy: its chart

const dialinCurve: Generator = (c) => {
  const all = demeaned(counted(c));
  const n = new Map<number, number>();
  for (const r of all) n.set(r.coffeeId!, (n.get(r.coffeeId!) ?? 0) + 1);
  const rows = all.filter((r) => n.get(r.coffeeId!)! >= MIN_BAGS);
  const bags = new Set(rows.map((r) => r.coffeeId));
  const first = rows.filter((r) => r.brewIndex === 1), rest = rows.filter((r) => r.brewIndex > 1);
  if (bags.size < MIN_BAGS || first.length < MIN_BAGS || !rest.length) return null;
  const enough = first.length >= MIN_BREWS;
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
    headline: lower ? 'Your first brew of a bag rates below the rest' : 'You nail a bag from the first brew',
    value: signed(mean(first.map((r) => r.dm)) - mean(rest.map((r) => r.dm))), series
  }, z, enough, 'bags', first.length);
  if (!curve) return null;
  const raw = (i: number) => mean(rows.filter((r) => bucket(r) === i).map((r) => r.rating!));
  const lastI = series.length ? Math.max(...series.map((s) => (s.label === '7+' ? 7 : +s.label))) : 1;
  // Below (above) the bag's own average = below (above) its later brews' average.
  const share = first.filter((r) => (lower ? r.dm < 0 : r.dm > 0)).length;
  const story: Finding = {
    ...curve, key: 'dialinStory', kind: 'story', of: 'dialinCurve',
    body: `Brew #1 averages ${raw(1).toFixed(1)}; by brew #${lastI}${lastI === 7 ? '+' : ''} you're at ${raw(lastI).toFixed(1)}. ` +
      `The first brew rated ${lower ? 'below' : 'above'} the bag's later brews in ${Math.round((100 * share) / first.length)}% of ${first.length} bags.`
  };
  return [curve, story];
};

// Brews to reach the bag's settled rating within its first SETTLE_WINDOW rated brews (dialed.ts settleWithin).
// Bags with SETTLE_WINDOW+ counted rated brews that began in the period; `month` = the month of its first rated brew;
// `n`: the window's brews (what the measure read).
export const settlePositions = (c: Pick<GenCtx, 'brews' | 'ratings'>) => {
  const out: { id: number; pos: number; month: string; n: number; roastLevel: string | null; processGroup: string | null }[] = [];
  const firstIdx = new Map([...perBag(c.brews)].map(([id, bs]) => [id, Math.min(...bs.map((b) => b.brewIndex))]));
  for (const [id, bs] of perBag(counted(c))) {
    const pos = settleWithin(bs.map((b) => b.rating!));
    if (pos === null || firstIdx.get(id) !== 1) continue;
    const { roastLevel, processGroup } = bs[0];
    out.push({ id, pos, month: bs[0].localDate.slice(0, 7), n: SETTLE_WINDOW, roastLevel, processGroup });
  }
  return out;
};
// Dial-in speed per roast level or process group (spec Part 4): the median brew its bags settle at (settleWithin), as
// whole brews rounded up; `brews`: in-period, every rating (Once dialed exempts dial-in). Unknown groups are left out.
// The dialinBy findings keep groups of 3+ bags; the Brewing charts show all, marking the pooled rule's small ones.
export function settleGroups(c: Pick<GenCtx, 'brews' | 'ratings'>, dim: 'roastLevel' | 'processGroup') {
  return [...groupBy(settlePositions(c), (x) => (x[dim] && x[dim] !== 'Other / Unknown' ? x[dim] : null))].map(([label, g]) => {
    const brews = g.reduce((n, x) => n + x.n, 0);
    return { label: label!, value: Math.ceil(median(g.map((x) => x.pos))), bags: g.length, brews, ps: g.map((x) => x.pos), sample: pooled(g.length, brews) };
  });
}
const dialinSpeed: Generator = (c) => {
  const slow = settlePositions(c);
  if (slow.length < MIN_BAGS) return null;
  const label = (x: { id: number }) => bagLabel(c, x.id);
  const by = (a: { id: number; pos: number }, b: { id: number; pos: number }) => a.pos - b.pos || label(a).localeCompare(label(b));
  const sorted = slow.sort(by);
  const fast = sorted[0], last = sorted[sorted.length - 1];
  if (fast.pos === last.pos) return null;
  const s = sorted.filter((x) => x.pos === last.pos).sort((a, b) => label(a).localeCompare(label(b)))[0];
  // "Fastest: 1 brew" is no contest (any bag right on brew 1 wins): count those bags instead.
  const hits = sorted.filter((x) => x.pos === 1).length;
  return {
    key: 'dialinSpeed', theme: 'dialin', kind: 'versus', headline: hits ? `Dial-in takes up to ${last.pos} brews` : `Dial-in takes ${fast.pos} to ${last.pos} brews`,
    sides: [{ label: `Slowest: ${label(s)}`, value: plural(s.pos, 'brew') },
      hits ? { label: 'Right on brew 1', value: `${hits} of ${plural(slow.length, 'bag')}` } : { label: `Fastest: ${label(fast)}`, value: plural(fast.pos, 'brew') }],
    sample: `${slow.length} bags`, href: `${LB}&open=coffees`, z: null, strength: null,
    ...details(
      ['Next slowest', [...sorted].reverse().filter((x) => x !== s).map((x) => detail(label(x), plural(x.pos, 'brew'), coffeeHref(c.bags.find((b) => b.id === x.id))))],
      ['Most bags settle by', [...groupBy(sorted, (x) => x.pos)].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
        .map(([pos, g]) => detail(`brew ${pos}`, plural(g.length, 'bag')))]
    )
  };
};

const secondCup: Generator = (c) => {
  const days = groupBy(counted(c), (b) => (b.coffeeId === null ? null : `${b.coffeeId}|${b.localDate}`));
  // A backfilled brew's time is a guess, so its day can't say which cup came second.
  const d = [...days.values()].filter((g) => g.length >= 2 && !g.some((b) => b.backfilled)).map((g) => g.sort((a, b) => a.localTime.localeCompare(b.localTime))).map((g) => g[1].rating! - g[0].rating!);
  if (d.length < MIN_BREWS) return null;
  const { m, z } = paired(d);
  return graded({
    key: 'secondCup', theme: 'dialin', kind: 'number', headline: m >= 0 ? 'Your second cup is better' : 'Your second cup is worse',
    value: signed(m), sample: `${d.length} pairs`, href: `${LB}&open=coffees`
  }, z, true, 'pairs', d.length);
};

const fondMemory: Generator = (c) => {
  const by = perBag(counted(c));
  const gaps = c.bags.flatMap((b) => {
    const bs = by.get(b.id);
    return b.bagRating !== null && bs && bs.length >= BAG_MIN_BREWS ? [{ b, gap: b.bagRating - mean(bs.map((x) => x.rating!)) }] : [];
  });
  const d = gaps.map((g) => g.gap);
  if (d.length < MIN_BREWS) return null;
  const { m, z } = paired(d);
  const most = [...gaps].sort((x, y) => (m >= 0 ? y.gap - x.gap : x.gap - y.gap) || x.b.name.localeCompare(y.b.name));
  return graded({
    key: 'fondMemory', theme: 'taste', kind: 'number', headline: m >= 0 ? 'You remember bags more fondly than you brewed them' : 'You remember bags less fondly than you brewed them',
    value: signed(m), body: `${Math.round((100 * d.filter((x) => (m >= 0 ? x > 0 : x < 0)).length) / d.length)}% of ${d.length} bags.`,
    sample: `${d.length} bags`, href: `${LB}&open=coffees`,
    ...details([m >= 0 ? 'Remembered most fondly' : 'Remembered least fondly', most.map((g) => detail(g.b.name, signed(g.gap), coffeeHref(g.b)))])
  }, z, true, 'bags', d.length);
};

const repeatBuys: Generator = (c) => {
  const means = bagMeans(counted(c));
  const groups = groupBy(c.bags.filter((b) => means.has(b.id)), (b) => `${b.name.toLowerCase()}|${b.roaster.toLowerCase()}`);
  const pairs = [...groups.values()].filter((g) => g.length >= 2)
    .map((g) => g.sort((a, b) => (a.purchaseDate ?? '').localeCompare(b.purchaseDate ?? '') || a.id - b.id))
    .map((g) => ({ b: g[1], d: means.get(g[1].id)! - means.get(g[0].id)! }));
  const d = pairs.map((x) => x.d);
  if (d.length < MIN_BAGS) return null;
  const { m, z } = paired(d);
  const big = [...pairs].sort((x, y) => (m >= 0 ? y.d - x.d : x.d - y.d) || x.b.name.localeCompare(y.b.name));
  const f = {
    key: 'repeatBuys', theme: 'taste' as const, kind: 'number' as const, headline: m >= 0 ? 'Repeat buys rate higher' : 'Repeat buys rate lower',
    value: signed(m), body: `${d.filter((x) => x > 0).length} of ${d.length} second bags rated higher.`,
    sample: `${d.length} repeat pairs`, href: `${LB}&open=coffees`, caveat: 'Ratings settled over time and you re-buy winners.',
    ...details([m >= 0 ? 'Biggest second-bag gains' : 'Biggest second-bag drops', big.map((x) => detail(x.b.name, signed(x.d), coffeeHref(x.b)))])
  };
  return graded(f, z, true, 'pairs', d.length);
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
    const groups = groupBy(rated, (b) => (b[dim] && b[dim] !== 'Other / Unknown' ? b[dim] : null));
    const big = [...groups].filter(([, bs]) => bs.length >= MIN_BAGS);
    return big.flatMap(([label, bs]) => {
      const ms = bs.map((b) => means.get(b.id)!), rest = rated.filter((b) => !bs.includes(b)).map((b) => means.get(b.id)!);
      if (!rest.length) return [];
      const delta = mean(ms) - mean(rest); // vs your other bags
      const ranked = [...bs].sort((x, y) => (delta >= 0 ? means.get(y.id)! - means.get(x.id)! : means.get(x.id)! - means.get(y.id)!) || x.name.localeCompare(y.name));
      const f = graded({
        key: `groupDelta:${dim}:${label}`, theme: 'taste', kind: 'number',
        headline: `${label} ${noun} rate ${Math.abs(delta).toFixed(1)} ${delta < 0 ? 'lower' : 'higher'}`,
        value: signed(delta, 1), sample: `${plural(ms.length, 'bag')}`, href: `${LB}&open=${board}`,
        ...details([delta >= 0 ? 'Highest rated' : 'Lowest rated', ranked.map((b) => detail(b.name, means.get(b.id)!.toFixed(1), coffeeHref(b)))])
      }, restZ(ms, rest), true, 'bags', ms.length, big.length > 1 ? `With ${big.length} ${dimName} groups compared, one usually stands out by chance.` : undefined, big.length, all.length);
      return f ? [f] : [];
    });
  });
};

// processGroups.ts's co-ferment / infused keywords (minus "co-ferment", parsed for its fruit).
const CO_METHODS = ['thermal shock', 'tartaric acid', 'pink champagne', 'infused'];
const coFerments: Generator = (c) => {
  const co = c.bags.filter((b) => b.processGroup === 'Co-ferment / Infused');
  const top = new Map<string, number>();
  for (const b of co) if (b.origin) top.set(b.origin, (top.get(b.origin) ?? 0) + 1);
  const [origin, n] = [...top].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (co.length < 5 || n !== co.length) return null;
  // What was added, from the process text: "Red fruits co-ferment" → "Red fruits"; else the method named.
  const what = (b: BagFact) => {
    const s = (b.processing ?? '').toLowerCase();
    const fruit = /^(.+?)\s*co-?ferment/.exec(s)?.[1];
    const k = fruit ?? CO_METHODS.find((x) => s.includes(x));
    return k ? k[0].toUpperCase() + k.slice(1) : null;
  };
  // Most brewed by brew count (all bags of one coffee together); ratings would hide pre-cutoff co-ferments.
  const brews = groupBy(c.brews, (b) => b.coffeeId);
  const byCoffee = [...groupBy(co, (b) => `${b.roaster}|${b.name}`).values()]
    .map((bs) => ({ b: bs.find((b) => b.slug) ?? bs[0], n: sum(bs.map((b) => brews.get(b.id)?.length ?? 0)) })).filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.b.name.localeCompare(y.b.name));
  return {
    key: 'coFerments', theme: 'taste', kind: 'number', headline: `All ${n} of your co-ferments are ${origin}`,
    value: `${n} of ${n}`, sample: `${plural(n, 'bag')}`, href: `${LB}&open=process`, z: null, strength: null,
    ...details(
      ['Process', [...groupBy(co, what)].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0])).map(([k, g]) => detail(k, plural(g.length, 'bag')))],
      ['Most brewed', byCoffee.map((x) => detail(x.b.name, plural(x.n, 'brew'), coffeeHref(x.b)))]
    )
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

// On hand / measured g/day (consumption); bought vs brewed kg in the period. Descriptive.
const MIN_RUNWAY_DAYS = 14;
const backlogRunway: Generator = (c) => {
  const p = { start: c.period.from, end: c.period.to };
  const days = trackedDays(p, c.dataStart, c.today);
  const { perDay, daysToClear } = consumption(c.brews, p, c.dataStart, c.today, c.onHandG);
  if (days < MIN_RUNWAY_DAYS || perDay === null || daysToClear === null) return null;
  const brewed = c.brews.filter((b) => inPeriod(b.localDate, p)).reduce((s, b) => s + (b.dose ?? 0), 0);
  const bought = c.bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, p)).reduce((s, b) => s + (b.amountG ?? 0), 0);
  const held = c.bags.filter((b) => b.status !== 'archive').map((b) => ({ b, g: remaining(b, c.logged) })).filter((x) => x.g > 0);
  return {
    key: 'backlogRunway', theme: 'money', kind: 'number', headline: `${formatGrams(c.onHandG)} on hand, about ${daysToClear} days`,
    value: `${daysToClear} days`,
    body: `At ${Math.round(perDay)} g/day. Bought ${formatGrams(bought)} vs brewed ${formatGrams(brewed)} in this period.`,
    sample: `${days} days`, href: '/insights?tab=consumption', z: null, strength: null,
    ...details(
      ['Most on hand', [...held].sort((x, y) => y.g - x.g || x.b.name.localeCompare(y.b.name)).map((x) => detail(x.b.name, formatGrams(x.g), coffeeHref(x.b)))],
      // Oldest off roast still on hand, rest net of freezer time.
      ['Oldest on hand', held.flatMap((x) => { const d = restDays(x.b.purchaseDate, x.b.frozenStart ?? null, x.b.frozenEnd ?? null, c.today); return d === null ? [] : [{ ...x, d }]; })
        .sort((x, y) => y.d - x.d || x.b.name.localeCompare(y.b.name)).map((x) => detail(x.b.name, `${plural(x.d, 'day')} off roast`, coffeeHref(x.b)))]
    )
  };
};

// ---- shared helpers for Habits / Gear / Money / Myths ----
// The most common key and its count; ties go to the name first in order.
const topOf = <T>(xs: readonly T[], key: (x: T) => string | null): { name: string; n: number } | null => {
  const [name, g] = [...groupBy(xs, key)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0] ?? [];
  return name === undefined ? null : { name, n: g!.length };
};
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const monthLabel = (ym: string) => `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
const minuteOf = (b: BrewFact) => +b.localTime.slice(11, 13) * 60 + +b.localTime.slice(14, 16);
const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const money = (x: number) => `$${x.toFixed(2)}`;
const pct = (x: number) => `${Math.round(100 * x)}%`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const period = (c: GenCtx) => ({ start: c.period.from, end: c.period.to });
const per100 = (b: BagFact) => (b.cost && b.amountG ? (100 * b.cost) / b.amountG : null); // cost 0/null excluded
const moves = (r: number) => Math.abs(r) < 0.1 ? 'barely move together' : `${Math.abs(r) < 0.3 ? 'loosely' : 'clearly'} ${r < 0 ? 'move in opposite directions' : 'move together'}`;
const myth = (f: Omit<Finding, 'kind' | 'z' | 'strength'>): Finding => ({ ...f, kind: 'myth', z: null, strength: null });
const HABITS = '/insights?tab=habits';
const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

// ---- Habits ----
// Median first-brew time per month. A day with any back-filled brew is skipped: its first time is unknown.
const morningDrift: Generator = (c) => {
  const firsts = [...groupBy(c.brews, (b) => b.localDate).values()].filter((d) => !d.some((b) => b.backfilled))
    .map((d) => ({ month: d[0].localDate.slice(0, 7), min: Math.min(...d.map(minuteOf)) }));
  const months = [...groupBy(firsts, (f) => f.month)].filter(([, fs]) => fs.length >= 10).sort(([a], [b]) => a.localeCompare(b))
    .map(([m, fs]) => ({ label: monthLabel(m), value: Math.round(median(fs.map((f) => f.min))) }));
  if (months.length < 3) return null;
  const a = months[0].value, b = months.at(-1)!.value;
  return {
    key: 'morningDrift', theme: 'habits', kind: 'pattern',
    headline: Math.abs(b - a) < 30 ? `Your first brew holds around ${clock(b)}` : `Your first brew moved ${b < a ? 'earlier' : 'later'}`,
    value: `${clock(a)} → ${clock(b)}`, series: months, sample: plural(months.length, 'month'), href: HABITS, z: null, strength: null
  };
};

// Brews per tracked day (a day with no brews counts as 0).
const weekendVsWeekday: Generator = (c) => {
  const t = trackedBounds(period(c), c.dataStart, c.today);
  if (!t) return null;
  const n = new Map([...groupBy(c.brews, (b) => b.localDate)].map(([d, bs]) => [d, bs.length]));
  const all = Array.from({ length: daysBetween(t.start, t.end) + 1 }, (_, i) => addDays(t.start, i));
  const [we, wd] = [true, false].map((w) => all.filter((d) => (weekday(d) >= 5) === w).map((d) => n.get(d) ?? 0));
  if (sum(we) < MIN_BREWS || sum(wd) < MIN_BREWS) return null;
  const [a, b] = [mean(we), mean(wd)];
  const series = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, value: mean(all.filter((d) => weekday(d) === i).map((d) => n.get(d) ?? 0)) || 0 }));
  return {
    series, chart: 'bars',
    key: 'weekendVsWeekday', theme: 'habits', kind: 'versus', headline: a > b * 1.1 ? 'You brew more on weekends' : "Weekends aren't binges",
    sides: [{ label: 'Weekdays', value: b.toFixed(2) }, { label: 'Weekends', value: a.toFixed(2) }], body: 'Brews per day.',
    sample: plural(all.length, 'day'), href: HABITS, z: null, strength: null
  };
};

const earlyBrews: Generator = (c) => {
  const rows = demeaned(counted(c).filter((b) => !b.backfilled));
  const early = rows.filter((r) => minuteOf(r) < 9 * 60).map((r) => r.dm), rest = rows.filter((r) => minuteOf(r) >= 9 * 60).map((r) => r.dm);
  if (early.length < MIN_BREWS || rest.length < MIN_BREWS) return null;
  const diff = mean(early) - mean(rest);
  return graded({
    key: 'earlyBrews', theme: 'habits', kind: 'number', headline: `Brews before 9 am rate ${Math.abs(diff).toFixed(2)} ${diff < 0 ? 'lower' : 'higher'}`,
    value: signed(diff), sample: `${early.length} early vs ${rest.length} later brews`, href: HABITS
  }, brewZ(early, rest, sd(rows.map((r) => r.dm))), true, 'brews', Math.min(early.length, rest.length));
};

// The weekday that stands out most (demeaned, vs the other days); one card, multiple-comparison caveat.
// The unit is the brew day: one day's brews move together (same bag, same morning), so z is on day
// means, and the pick of the weekdays is held to a Bonferroni bar.
const weekdayRatings: Generator = (c) => {
  const rows = demeaned(counted(c));
  const dayMeans = [...groupBy(rows, (r) => r.localDate)].map(([d, g]) => ({ wd: weekday(d), m: mean(g.map((r) => r.dm)) }));
  const res = sd(dayMeans.map((x) => x.m));
  const groups = [...groupBy(rows, (r) => weekday(r.localDate))].filter(([, g]) => g.length >= MIN_BREWS);
  if (groups.length < 2) return null;
  const best = groups.map(([d, g]) => {
    const dm = g.map((r) => r.dm), rest = rows.filter((r) => weekday(r.localDate) !== d).map((r) => r.dm);
    const [a, b] = [true, false].map((on) => dayMeans.filter((x) => (x.wd === d) === on).map((x) => x.m));
    return { d, n: g.length, days: a.length, diff: mean(dm) - mean(rest), z: brewZ(a, b, res) };
  }).filter((x) => Number.isFinite(x.z)).sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || a.d - b.d)[0];
  if (!best) return null;
  return graded({
    key: 'weekday', theme: 'habits', kind: 'number', headline: `${DAY_NAMES[best.d]} rate ${Math.abs(best.diff).toFixed(2)} ${best.diff < 0 ? 'lower' : 'higher'}`,
    value: signed(best.diff), sample: `${best.n} brews on ${plural(best.days, DAY_NAMES[best.d].slice(0, -1))}`, href: HABITS
  }, best.z, true, DAY_NAMES[best.d], best.days, `With ${groups.length} weekdays compared, one usually stands out by chance.`, groups.length, dayMeans.length);
};

// This period vs prevBrews (Compare window when on, else the previous period). Descriptive; the
// rating line (bags brewed in both windows, demeaned) only shows when it is a hint or better.
const periodVsPrevious: Generator = (c) => {
  const prev = c.prevBrews;
  if (!prev?.length || !c.brews.length) return null;
  const bagsOf = (bs: readonly BrewFact[]) => new Set(bs.flatMap((b) => (b.coffeeId === null ? [] : [b.coffeeId]))).size;
  const change = c.brews.length / prev.length - 1;
  const lines = [`${plural(bagsOf(c.brews), 'bag')} brewed vs ${bagsOf(prev)}.`];
  const [o, po] = [c.brews, prev].map((bs) => topOf(bs, (b) => b.origin));
  if (o) lines.push(`Top origin ${o.name}${po && po.name !== o.name ? ` (was ${po.name})` : ''}.`);
  const [g, pg] = [c.brews, prev].map((bs) => topOf(bs, (b) => b.dripper));
  if (g) lines.push(`${g.name} on ${pct(g.n / c.brews.length)} of brews${pg ? ` (was ${pg.name} ${pct(pg.n / prev.length)})` : ''}.`);
  const cur = counted(c), old = prev.filter((b) => countsForRating(b, c.ratings) && rated(b));
  const [ci, oi] = [new Set(cur.map((b) => b.coffeeId)), new Set(old.map((b) => b.coffeeId))];
  const rows = demeaned([...cur.map((b) => ({ ...b, now: true })), ...old.map((b) => ({ ...b, now: false }))].filter((b) => ci.has(b.coffeeId) && oi.has(b.coffeeId)));
  const [a, b] = [true, false].map((now) => rows.filter((r) => r.now === now).map((r) => r.dm));
  if (a.length >= MIN_BREWS && b.length >= MIN_BREWS) {
    const z = brewZ(a, b, sd(rows.map((r) => r.dm)));
    if (Number.isFinite(z) && Math.abs(z) >= 1.5) lines.push(`The same bags rate ${signed(mean(a) - mean(b))} vs then.`);
  }
  return {
    key: 'periodVsPrevious', theme: 'habits', kind: 'versus',
    headline: `${Math.round(Math.abs(change) * 100)}% ${change < 0 ? 'fewer' : 'more'} brews than the comparison period`,
    sides: [{ label: 'This period', value: plural(c.brews.length, 'brew') }, { label: 'Comparison', value: plural(prev.length, 'brew') }],
    body: lines.join(' '), sample: `${c.brews.length + prev.length} brews`, href: '/insights?tab=overview', z: null, strength: null
  };
};

// ---- Trend charts (descriptive, `multi`) ----
const MULTI_LINES = 5, MULTI_KEEP = 0.2;
export type Multi = NonNullable<Finding['multi']>;
// Months with `minMonth`+ rows (3+ needed); one line per category holding MULTI_KEEP+ of some month's
// rows, at most MULTI_LINES with the rest folded into "Other". `cell` = a line's value in one month
// from its rows and the month's rows (null = gap). `fixed` = these lines, in this order, no folding.
export function monthlyMulti<T extends { localDate: string }>(
  rows: readonly T[], cat: (x: T) => string | null, cell: (g: T[], month: T[]) => number | null, unit: string, minMonth = 10, fixed?: string[]
): Multi | null {
  const months = [...groupBy(rows.filter((x) => cat(x) !== null), (x) => x.localDate.slice(0, 7))]
    .filter(([, g]) => g.length >= minMonth).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 3) return null;
  const totals = [...groupBy(months.flatMap(([, g]) => g), cat)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const big = totals.map(([k]) => k).filter((k) => months.some(([, g]) => g.filter((x) => cat(x) === k).length >= MULTI_KEEP * g.length));
  const names = fixed ?? (big.length === totals.length && big.length <= MULTI_LINES ? big : big.slice(0, MULTI_LINES - 1));
  const line = (x: T) => (names.includes(cat(x)!) ? cat(x)! : 'Other');
  const labels = !fixed && names.length < totals.length ? [...names, 'Other'] : names;
  return { x: months.map(([m]) => monthLabel(m)), unit, lines: labels.map((label) => ({ label, values: months.map(([, g]) => cell(g.filter((x) => line(x) === label), g)) })) };
}
const shareCell = (g: unknown[], month: unknown[]) => Math.round((100 * g.length) / month.length);
const meanCell = (min: number) => (g: { rating: number | null }[]) => (g.length >= min ? Math.round(100 * mean(g.map((b) => b.rating!))) / 100 : null);
const ends = (vs: (number | null)[]) => { const v = vs.filter((x): x is number => x !== null); return v.length ? { a: v[0], b: v.at(-1)!, range: Math.max(...v) - Math.min(...v) } : null; };
// The named line (not "Other") that moved most from its first to its last value.
const mover = (m: Multi) => m.lines.flatMap((l) => { const e = l.label !== 'Other' && ends(l.values); return e ? [{ label: l.label, ...e }] : []; })
  .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a) || x.label.localeCompare(y.label))[0];
const flat = (m: Multi, min: number) => !m.lines.some((l) => (ends(l.values)?.range ?? 0) >= min);

// Taste: monthly mean rating per roast level (5+ rated brews a cell), and each roast level's share of brews.
const roastRating: Generator = (c) => {
  const m = monthlyMulti(counted(c), (b) => b.roastLevel, meanCell(5), 'rating');
  const t = m && m.lines.length >= 2 && !flat(m, 0.3) && mover(m);
  if (!m || !t) return null;
  return {
    key: 'roastRating', theme: 'taste', kind: 'pattern', headline: `${t.label} roasts: ${t.a.toFixed(2)} → ${t.b.toFixed(2)}`,
    value: signed(t.b - t.a), body: 'Mean rating by roast level each month (5+ rated brews).', multi: m,
    sample: plural(m.x.length, 'month'), href: `${LB}&open=roast`, z: null, strength: null
  };
};
const roastShare: Generator = (c) => {
  const m = monthlyMulti(c.brews, (b) => b.roastLevel, shareCell, '%');
  const t = m && m.lines.length >= 2 && !flat(m, 15) && mover(m);
  if (!m || !t) return null;
  return {
    key: 'roastShare', theme: 'taste', kind: 'pattern', headline: `${t.label}: ${t.a}% → ${t.b}% of brews`,
    value: `${t.b}%`, body: 'Share of brews by roast level each month.', multi: m,
    sample: plural(m.x.length, 'month'), href: `${LB}&open=roast&rank=brews`, z: null, strength: null
  };
};

// Dial-in: each bag's first brew vs its later brews, by month; brews to settle by the month a bag began.
const firstVsLater: Generator = (c) => {
  const m = monthlyMulti(counted(c).filter((b) => b.brewIndex > 0), (b) => (b.brewIndex === 1 ? 'Brew #1' : 'Later brews'), meanCell(3), 'rating', 10, ['Brew #1', 'Later brews']);
  if (!m) return null;
  const [one, later] = m.lines.map((l) => l.values);
  const gaps = one.flatMap((v, i) => (v !== null && later[i] !== null ? [v - later[i]!] : []));
  if (gaps.length < 3) return null;
  return {
    key: 'firstVsLater', theme: 'dialin', kind: 'pattern', headline: `Brew #1 gap: ${signed(gaps[0])} → ${signed(gaps.at(-1)!)}`,
    value: signed(gaps.at(-1)!), body: "Each bag's first brew vs its later brews, mean rating by month.", multi: m,
    sample: plural(m.x.length, 'month'), href: `${LB}&open=coffees`, z: null, strength: null
  };
};
const settleTrend: Generator = (c) => {
  const months = [...groupBy(settlePositions(c), (x) => x.month)].filter(([, g]) => g.length >= MIN_BAGS).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 3) return null;
  const values = months.map(([, g]) => Math.round(10 * mean(g.map((x) => x.pos))) / 10);
  const e = ends(values)!;
  if (e.range < 0.5) return null;
  return {
    key: 'settleTrend', theme: 'dialin', kind: 'pattern', headline: `Dial-in: ${e.a} → ${e.b} brews to settle`, value: `${e.b} brews`,
    body: 'Mean brews to settle a bag, by the month you opened it.',
    multi: { x: months.map(([m]) => monthLabel(m)), lines: [{ label: 'Brews to settle', values }], unit: 'brews' },
    sample: plural(sum(months.map(([, g]) => g.length)), 'bag'), href: `${LB}&open=coffees`, z: null, strength: null
  };
};

// ---- Gear ----
// Months (20+ brews) where one item has 80%+ of brews; back-to-back months of the same item merge.
// With no two eras, a share-over-time card when the mix moved (15+ points) instead.
const ERA_DIMS = [['dripper', 'Dripper'], ['water', 'Water'], ['grinder', 'Grinder']] as const;
const gearEras: Generator = (c) => ERA_DIMS.flatMap(([dim, name]): Finding[] => {
  const rows = c.brews.filter((b) => b[dim]);
  const multi = monthlyMulti(rows, (b) => b[dim], shareCell, '%', 20);
  if (!multi) return [];
  const months = [...groupBy(rows, (b) => b.localDate.slice(0, 7))].filter(([, bs]) => bs.length >= 20).sort(([a], [b]) => a.localeCompare(b))
    .map(([m, bs]) => ({ m, top: topOf(bs, (b) => b[dim]), total: bs.length }));
  const eras: { g: string; from: string; to: string; n: number; total: number; i: number }[] = [];
  months.forEach(({ m, top, total }, i) => {
    if (!top || top.n / total < 0.8) return;
    const last = eras.at(-1);
    if (last && last.g === top.name && last.i === i - 1) Object.assign(last, { to: m, n: last.n + top.n, total: last.total + total, i });
    else eras.push({ g: top.name, from: m, to: m, n: top.n, total, i });
  });
  const base = { theme: 'gear' as const, kind: 'pattern' as const, multi, sample: plural(months.length, 'month'), href: `${LB}&open=${dim}`, z: null, strength: null };
  if (new Set(eras.map((e) => e.g)).size >= 2) {
    const when = (e: (typeof eras)[number]) => (e.from === e.to ? monthLabel(e.from) : `${monthLabel(e.from)}–${monthLabel(e.to)}`);
    return [{
      ...base, key: `gearEras:${dim}`, headline: `${name} eras: ${eras.map((e) => e.g).join(' → ')}`,
      body: `${eras.map((e) => `${e.g} ${pct(e.n / e.total)} of ${when(e)}`).join(', ')}.`
    }];
  }
  if (multi.lines.length < 2 || flat(multi, 15)) return [];
  const [a, b] = [months[0], months.at(-1)!];
  return [{
    ...base, key: `gearShare:${dim}`, headline: a.top!.name === b.top!.name ? `${name}: mostly ${b.top!.name}` : `${name}: ${a.top!.name} → ${b.top!.name}`,
    body: `${a.top!.name} had ${pct(a.top!.n / a.total)} of ${monthLabel(a.m)}; ${b.top!.name} ${pct(b.top!.n / b.total)} of ${monthLabel(b.m)}.`
  }];
});

// The top 2 by brews, on bags brewed with both (demeaned within those bags). A confident dead heat
// (|Δ| < TIE and the 2-SE band inside ±TIE_BAND) is its own descriptive finding.
const TIE = 0.1, TIE_BAND = 0.25;
const SAME_BAG = ['grinder', 'water', 'dripper', 'filter'] as const;
const sameBagVersus: Generator = (c) => SAME_BAG.flatMap((dim) => {
  const val = (b: BrewFact) => (b[dim] && b[dim] !== MIXED_FILTER ? b[dim] : null);
  const [a, b] = [...groupBy(c.brews, val)].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0])).map(([k]) => k);
  if (!b) return [];
  const rs = counted(c).filter((x) => x.coffeeId !== null && (val(x) === a || val(x) === b));
  const [ha, hb] = [a, b].map((k) => new Set(rs.filter((x) => val(x) === k).map((x) => x.coffeeId)));
  const rows = demeaned(rs.filter((x) => ha.has(x.coffeeId) && hb.has(x.coffeeId)));
  const [da, db] = [a, b].map((k) => rows.filter((r) => val(r) === k).map((r) => r.dm));
  if (da.length < MIN_BREWS || db.length < MIN_BREWS) return [];
  const diff = mean(da) - mean(db), se = sd(rows.map((r) => r.dm)) * Math.sqrt(1 / da.length + 1 / db.length);
  const base = {
    key: `sameBagVersus:${dim}`, theme: 'gear' as const, kind: 'versus' as const, value: signed(diff),
    sides: [{ label: a, value: signed(mean(da)) }, { label: b, value: signed(mean(db)) }],
    sample: `${new Set(rows.map((r) => r.coffeeId)).size} bags, ${rows.length} brews`, href: `${LB}&open=${dim}`
  };
  if (Math.abs(diff) < TIE && Math.abs(diff) + 2 * se < TIE_BAND) return [{ ...base, headline: `${a} and ${b} tie on the same bags`, z: null, strength: null }];
  const [w, l] = diff > 0 ? [a, b] : [b, a];
  const headline = Math.abs(diff) < TIE ? `${a} and ${b} look even on the same bags` : `${w} beats ${l} by ${Math.abs(diff).toFixed(2)} on the same bags`;
  const f = graded({ ...base, headline }, diff / se, true, 'brews', Math.min(da.length, db.length));
  return f ? [f] : [];
});

// Dripper with the widest demeaned spread vs the narrowest; z on log SDs (SE ≈ 1/√(2(n−1)) each).
const wildcardBrewer: Generator = (c) => {
  const gs = [...groupBy(demeaned(counted(c)), (r) => r.dripper)].filter(([, g]) => g.length >= MIN_BREWS)
    .map(([k, g]) => ({ k, n: g.length, s: sd(g.map((r) => r.dm)) })).filter((g) => g.s > 0).sort((a, b) => b.s - a.s || a.k.localeCompare(b.k));
  if (gs.length < 2) return null;
  const hi = gs[0], lo = gs.at(-1)!;
  const z = Math.log(hi.s / lo.s) / Math.sqrt(1 / (2 * (hi.n - 1)) + 1 / (2 * (lo.n - 1)));
  return graded({
    key: 'wildcardBrewer', theme: 'gear', kind: 'versus', headline: `The ${hi.k} is your wildcard`,
    sides: [{ label: hi.k, value: `±${hi.s.toFixed(2)}` }, { label: lo.k, value: `±${lo.s.toFixed(2)}` }],
    body: `Ratings on the ${hi.k} swing ${hi.s.toFixed(2)} around each bag's average; on the ${lo.k}, ${lo.s.toFixed(2)}.`,
    sample: `${hi.n + lo.n} brews`, href: `${LB}&open=dripper`
    // The pick of k drippers: a Bonferroni bar over the k compared (spec: Strength).
  }, z, true, 'brews', Math.min(hi.n, lo.n), gs.length > 2 ? `With ${gs.length} drippers compared, one usually stands out by chance.` : undefined, gs.length);
};

// ---- Money ----
const priceVsRating: Generator = (c) => {
  const means = bagMeans(counted(c));
  const pts = c.bags.flatMap((b) => { const p = per100(b); return p !== null && means.has(b.id) ? [[p, means.get(b.id)!]] : []; });
  const r = pts.length >= MIN_BREWS ? pearson(pts.map((p) => p[0]), pts.map((p) => p[1])) : null;
  if (r === null) return null;
  return myth({
    key: 'priceVsRating', theme: 'money', headline: Math.abs(r) < 0.2 ? "Price doesn't buy rating" : r > 0 ? 'Pricier bags rate higher' : 'Cheaper bags rate higher',
    value: `r = ${num(r)}`, body: `Across ${pts.length} bags, $/100 g and your bag rating ${moves(r)}.`,
    sample: `${pts.length} bags`, href: `${LB}&open=coffees&rank=ppg`
  });
};

const costPerCup: Generator = (c) => {
  const cost = c.brews.filter((b) => b.costPerBrew !== null);
  if (cost.length < MIN_BREWS) return null;
  const avg = mean(cost.map((b) => b.costPerBrew!));
  const top = cost.filter((b) => countsForRating(b, c.ratings) && b.rating! >= 9);
  const bags = bagById(c);
  const perBagCost = [...groupBy(cost, (b) => b.coffeeId)].filter(([, g]) => g.length >= MIN_BAGS).map(([id, g]) => ({ b: bags.get(id), v: mean(g.map((x) => x.costPerBrew!)) }))
    .filter((x): x is { b: BagFact; v: number } => !!x.b).sort((x, y) => y.v - x.v || x.b.name.localeCompare(y.b.name));
  const cup = (x: { b: BagFact; v: number }) => detail(x.b.name, money(x.v), coffeeHref(x.b));
  return {
    key: 'costPerCup', theme: 'money', kind: 'number', headline: `${money(avg)} a cup`, value: money(avg),
    ...(top.length >= 10 ? { body: `A 9+ cup costs ${money(mean(top.map((b) => b.costPerBrew!)))} on average.` } : {}),
    sample: `${cost.length} brews`, href: `${LB}&rank=spend`, z: null, strength: null,
    ...(perBagCost.length >= 6 ? details(['Priciest cups', perBagCost.map(cup)], ['Cheapest cups', [...perBagCost].reverse().map(cup)]) : {})
  };
};

// Mean $/100 g of the bags bought each quarter of the period (3+ bags a quarter).
const pricePerMonth: Generator = (c) => {
  const p = period(c);
  const bs = c.bags.filter((b) => per100(b) !== null && b.purchaseDate && inPeriod(b.purchaseDate, p));
  const qs = [...groupBy(bs, (b) => `${b.purchaseDate!.slice(0, 4)} Q${Math.ceil(+b.purchaseDate!.slice(5, 7) / 3)}`)]
    .filter(([, g]) => g.length >= MIN_BAGS).sort(([a], [b]) => a.localeCompare(b))
    .map(([q, g]) => ({ label: q, value: mean(g.map((b) => per100(b)!)) }));
  if (qs.length < 2) return null;
  const [a, b] = [qs[0].value, qs.at(-1)!.value];
  return {
    key: 'pricePerMonth', theme: 'money', kind: 'pattern', headline: `$/100 g went from ${money(a)} to ${money(b)}`, value: money(b),
    series: qs, sample: plural(bs.length, 'bag'), href: `${LB}&open=coffees&rank=ppg`, z: null, strength: null
  };
};

// Top-3 roaster share of the period's bags; rising = the roaster with most bags bought in the last
// 90 days, when its share of them beats its share before.
const loyalty: Generator = (c) => {
  const p = period(c);
  const bs = c.bags.filter((b) => b.purchaseDate && inPeriod(b.purchaseDate, p));
  const by = [...groupBy(bs, (b) => b.roaster)].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (bs.length < 10 || by.length < 4) return null;
  const top3 = by.slice(0, 3);
  const cut = addDays(c.today, -90);
  const recent = c.bags.filter((b) => b.purchaseDate && b.purchaseDate > cut), before = c.bags.filter((b) => b.purchaseDate && b.purchaseDate <= cut);
  const r = topOf(recent, (b) => b.roaster);
  const was = r ? before.filter((b) => b.roaster === r.name).length : 0;
  const rising = r && r.n >= 2 && before.length && r.n / recent.length > was / before.length
    ? ` Rising: ${r.name}, ${r.n} of your last ${recent.length} bags (${was} of ${before.length} before).` : '';
  return {
    key: 'loyalty', theme: 'money', kind: 'number', headline: `Top 3 roasters: ${pct(sum(top3.map(([, g]) => g.length)) / bs.length)} of bags`,
    value: pct(sum(top3.map(([, g]) => g.length)) / bs.length), body: `${list(top3.map(([k]) => k))}.${rising}`,
    sample: `${bs.length} bags, ${by.length} roasters`, href: `${LB}&open=roasters`, z: null, strength: null,
    ...details(['Top roasters', top3.map(([k, g]) => detail(k, plural(g.length, 'bag'), listHref('roaster', [k])))])
  };
};

// ---- Myths ----
const restMyth: Generator = (c) => {
  const rows = demeaned(counted(c)).filter((r) => r.restDays !== null);
  if (rows.length < MIN_BREWS) return null;
  const x = rows.map((r) => r.restDays!), y = rows.map((r) => r.dm);
  const r = pearson(x, y), p = partialR(x, y, rows.map((r) => r.brewIndex));
  if (r === null || p === null) return null;
  return myth({
    key: 'restMyth', theme: 'dialin', headline: Math.abs(p) < 0.1 ? "Longer rest doesn't make a better cup" : p > 0 ? 'Longer rest helps' : 'Longer rest hurts',
    value: `r = ${num(p)}`,
    body: `Rest days and rating line up at r = ${num(r)}; with brew number held fixed, r = ${num(p)}.` +
      (Math.abs(p) < Math.abs(r) - 0.05 ? ' Later brews of a bag are both more rested and better dialed in.' : ''),
    sample: `${rows.length} brews`, href: `${LB}&open=coffees`
  });
};

// Demeaned rating before / inside / after the bag's rest window; a myth only when all three are within 0.2.
const restWindowMyth: Generator = (c) => {
  const win = new Map(c.bags.filter((b) => b.restLow != null && b.restHigh != null).map((b) => [b.id, b]));
  const rows = demeaned(counted(c)).filter((r) => r.restDays !== null && win.has(r.coffeeId!));
  const side = (r: { coffeeId: number | null; restDays: number | null }) => { const b = win.get(r.coffeeId!)!; return r.restDays! < b.restLow! ? 0 : r.restDays! <= b.restHigh! ? 1 : 2; };
  const g = [0, 1, 2].map((i) => rows.filter((r) => side(r) === i).map((r) => r.dm));
  if (g.some((x) => x.length < MIN_BREWS)) return null;
  const m = g.map(mean), spread = Math.max(...m) - Math.min(...m);
  if (spread > 0.2) return null;
  return myth({
    key: 'restWindowMyth', theme: 'dialin', headline: "The roaster's rest window doesn't matter", value: `${spread.toFixed(2)} apart`,
    body: `Brews before, inside and after the rest window rate within ${spread.toFixed(2)} of each other.`,
    series: ['Before', 'Inside', 'After'].map((label, i) => ({ label, value: m[i] })),
    sample: `${rows.length} brews`, href: `${LB}&open=coffees`
  });
};

const originMyth: Generator = (c) => {
  const means = bagMeans(counted(c));
  const bs = c.bags.filter((b) => means.has(b.id));
  const all = mean(bs.map((b) => means.get(b.id)!));
  const gs = [...groupBy(bs, (b) => (b.origin && b.origin !== 'Other / Unknown' ? b.origin : null)).values()].filter((g) => g.length >= MIN_BAGS);
  if (gs.length < 3) return null;
  const max = Math.max(...gs.map((g) => Math.abs(mean(g.map((b) => means.get(b.id)!)) - all)));
  if (max > 0.5) return null;
  return myth({
    key: 'originMyth', theme: 'taste', headline: 'Origin barely matters', value: `±${max.toFixed(2)}`,
    body: `All ${gs.length} origins with ${MIN_BAGS}+ bags rate within ±${max.toFixed(2)} of your average.`,
    sample: plural(sum(gs.map((g) => g.length)), 'bag'), href: `${LB}&open=origins`
  });
};

// Days from roast to first brew (freezer time left out) vs the bag's mean rating.
const backlogWaitMyth: Generator = (c) => {
  const means = bagMeans(counted(c));
  const pts = c.bags.flatMap((b) => {
    const w = b.firstBrew ? restDays(b.purchaseDate, b.frozenStart ?? null, b.frozenEnd ?? null, b.firstBrew) : null;
    return w !== null && means.has(b.id) ? [[w, means.get(b.id)!]] : [];
  });
  const r = pts.length >= MIN_BREWS ? pearson(pts.map((p) => p[0]), pts.map((p) => p[1])) : null;
  if (r === null) return null;
  return myth({
    key: 'backlogWaitMyth', theme: 'money', headline: Math.abs(r) < 0.2 ? "Waiting in the backlog doesn't hurt" : r < 0 ? 'Bags that wait rate lower' : 'Bags that wait rate higher',
    value: `r = ${num(r)}`, body: `Across ${pts.length} bags, days from roast to first brew and the bag's rating ${moves(r)}.`,
    sample: `${pts.length} bags`, href: '/insights?tab=consumption'
  });
};

// |r| of each brew variable vs demeaned rating (grind as its rank within one grinder); one card when all ≤ 0.1.
const variablesMyth: Generator = (c) => {
  const rows = demeaned(counted(c));
  const rs: { name: string; r: number }[] = [];
  const add = (name: string, pts: number[][]) => {
    const r = pts.length >= MIN_BREWS ? pearson(pts.map((p) => p[0]), pts.map((p) => p[1])) : null;
    if (r !== null) rs.push({ name, r });
  };
  const VARS: [string, (b: BrewFact) => number | null][] = [
    ['ratio', (b) => b.ratio], ['dose', (b) => (b.dose && b.dose > 0 ? b.dose : null)], ['bloom', (b) => b.bloomSeconds], ['time', (b) => b.brewTimeSeconds]
  ];
  for (const [name, f] of VARS) add(name, rows.flatMap((r) => { const v = f(r); return v === null ? [] : [[v, r.dm]]; }));
  for (const [grinder, g] of groupBy(rows.filter((r) => grindValue(r.grind) !== null), (r) => r.grinder)) {
    const pos = (s: string) => grindValue(s)!;
    const settings = [...new Set(g.map((r) => r.grind!))].sort((a, b) => pos(a) - pos(b));
    add(`${grinder} grind`, g.map((r) => [settings.indexOf(r.grind!), r.dm]));
  }
  if (rs.length < 2) return null;
  const max = Math.max(...rs.map((x) => Math.abs(x.r)));
  // Rounds to 0.00: the variables barely vary at all, so "|r| ≤ 0.00" would say nothing.
  if (max > 0.1 || max < 0.005) return null;
  const names = rs.map((x) => x.name);
  names[0] = names[0][0].toUpperCase() + names[0].slice(1);
  return myth({
    key: 'variablesMyth', theme: 'dialin', headline: 'Your brew variables barely move the rating', value: `|r| ≤ ${max.toFixed(2)}`,
    body: `${list(names)} all stay within |r| ≤ ${max.toFixed(2)} of your rating, within a bag.`,
    sample: `${rows.length} brews`, href: `${LB}&open=grinder`
  });
};

// Rating SD of the first vs last full month with 30+ rated brews (every rated brew: ignores the Current/All
// ratings switch; the current month is partial and left out), plus brews rated in a row (brews come in time order).
const calibration: Generator = (c) => {
  const months = [...groupBy(c.brews.filter(rated), (b) => b.localDate.slice(0, 7))].filter(([m, g]) => m < c.today.slice(0, 7) && g.length >= MIN_BREWS).sort(([a], [b]) => a.localeCompare(b))
    .map(([m, g]) => ({ m, s: sd(g.map((b) => b.rating!)) }));
  if (months.length < 2) return null;
  const [a, b] = [months[0], months.at(-1)!];
  let streak = 0;
  for (let i = c.brews.length - 1; i >= 0 && rated(c.brews[i]); i--) streak++;
  return myth({
    key: 'calibration', theme: 'taste',
    headline: b.s < a.s - 0.1 ? 'Your ratings have settled' : b.s > a.s + 0.1 ? 'Your ratings spread wider' : 'Your ratings hold steady',
    value: `${a.s.toFixed(2)} → ${b.s.toFixed(2)}`,
    body: `Monthly rating spread (SD) went from ${a.s.toFixed(2)} in ${monthLabel(a.m)} to ${b.s.toFixed(2)} in ${monthLabel(b.m)}.` +
      (streak >= 10 ? ` ${streak} brews in a row rated.` : ''),
    series: months.map((x) => ({ label: monthLabel(x.m), value: x.s })), sample: plural(months.length, 'month'), href: '/insights?tab=overview'
  });
};


// vs like coffees (spec Part 4): the coffee, and the roaster, furthest from its like-group (likeGroup.ts).
// Coffee z: its gap over the spread of every bag's gap, Bonferroni over the bags compared.
const likeStandouts: Generator = (c) => {
  const likes = [...likeGaps(counted(c))].filter(([, l]) => !l.sample.small);
  const gaps = likes.map(([, l]) => l.gap), spread = sd(gaps);
  const byGap = (a: [number, Like], b: [number, Like]) => Math.abs(b[1].gap) - Math.abs(a[1].gap) || bagLabel(c, a[0]).localeCompare(bagLabel(c, b[0]));
  const ranked = [...likes].sort(byGap), byId = bagById(c), [id, top] = ranked[0] ?? [];
  const up = (top?.gap ?? 0) >= 0;
  // Repurchases of one coffee share a name: tag the headline's and the listed ones with their roast date.
  const same = ranked.slice(1).filter(([, l]) => (l.gap >= 0) === up).slice(0, DETAIL_ITEMS);
  const named = new Map(tagTwins([[id], ...same].map(([x]) => { const b = byId.get(x as number); return { x, label: bagLabel(c, x as number, b), roastedOn: b?.purchaseDate ?? null, openedOn: b?.firstBrew ?? null }; }))
    .map((t) => [t.x, t.tag ? `${t.label} (${t.tag})` : t.label]));
  const coffee = likes.length < POOLED_MIN_BAGS || spread < 1e-9 ? null : graded({
    key: 'likeStandout', theme: 'taste', kind: 'number', headline: `${named.get(id)} ${up ? 'beats' : 'trails'} ${top.label} by ${Math.abs(top.gap).toFixed(1)}`,
    value: gapText(top.gap), sample: plural(likes.length, 'bag'), href: `${LB}&rank=like&open=coffees`,
    ...details([up ? 'Also above their peers' : 'Also below their peers', same.map(([x, l]) => detail(named.get(x)!, gapText(l.gap), coffeeHref(byId.get(x))))])
  }, top.gap / spread, true, 'bags', likes.length, undefined, likes.length);
  // Roasters: the Leaderboards figure (roasterLikes: against other roasters' coffees), 3+ bags each.
  const rl = roasterLikes(counted(c)), allGaps = [...rl.values()].flatMap((x) => x.gaps);
  const roasters = [...rl].filter(([, x]) => !pooled(x.bags, x.brews).small); // the board's small-sample rule
  const best = roasters.map(([r, x]) => ({ r, ...x })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.r.localeCompare(b.r))[0];
  const roaster = best ? graded({
    key: 'likeRoaster', theme: 'taste', kind: 'number',
    headline: `${best.r} rates ${Math.abs(best.gap).toFixed(1)} ${best.gap >= 0 ? 'above' : 'below'} like coffees`,
    value: gapText(best.gap), sample: plural(best.bags, 'bag'), href: `${LB}&rank=like&open=roasters`
  }, restZ(best.gaps, [...rl].filter(([r]) => r !== best.r).flatMap(([, x]) => x.gaps)), true, 'bags', best.bags, undefined, roasters.length, allGaps.length) : null;
  return [coffee, roaster].filter((f): f is Finding => f !== null);
};

// Dial-in speed by roast level and by process (spec Part 4): the median brew a bag settles at within its first
// SETTLE_WINDOW rated brews (settleWithin), per group of 3+ bags (so the brew half of the pooled rule always holds).
// No "N more bags would settle it": the window's settle brews take few values and the median rounds up, so the
// sample-size estimate (built for a mean) would promise more than it can (audit must-fix 6).
const dialinByGroup: Generator = (c) => {
  const pos = settlePositions({ ...c, brews: c.allBrews });
  const allPos = pos.map((x) => x.pos);
  return (['roastLevel', 'processGroup'] as const).flatMap((dim) => {
    // Groups under the pooled bag rule are left out.
    const groups = settleGroups({ ...c, brews: c.allBrews }, dim).filter((g) => g.bags >= POOLED_MIN_BAGS);
    if (groups.length < 2) return [];
    // Ties go to the group with more bags.
    const by = (dir: 1 | -1) => (a: (typeof groups)[0], b: (typeof groups)[0]) => dir * (a.value - b.value) || b.bags - a.bags || a.label.localeCompare(b.label);
    const [fast, slow] = [[...groups].sort(by(1))[0], [...groups].sort(by(-1))[0]];
    if (fast.value === slow.value) return [];
    const phrase = (g: typeof fast) => (g.value === 1 ? 'is right on brew 1' : `settles by brew ${g.value}`);
    const z = restZ(slow.ps, pos.filter((x) => x[dim] !== slow.label).map((x) => x.pos));
    const f = graded({
      key: `dialinBy:${dim}`, theme: 'dialin', kind: 'pattern', chart: 'bars', barLabels: 'full',
      headline: `${fast.label} ${phrase(fast)}; ${slow.label} ${phrase(slow)}`,
      body: `Median brew each bag settles at, within its first ${SETTLE_WINDOW} rated brews (bags of ${SETTLE_WINDOW}+).`,
      series: [...groups].sort(by(1)).map(({ label, value }) => ({ label, value })), sample: plural(pos.length, 'bag'),
      href: SETTLE[dim]
    }, Number.isFinite(z) ? z : 0, true, 'bags', slow.bags, undefined, groups.length, allPos.length);
    if (!f) return [];
    const { settle: _s, progress: _p, ...rest } = f;
    return [rest];
  });
};

// Rescued bags (spec Part 4): the first two rated brews (both dial-in) average below your own mean, the
// once-dialed brews at or above it, and at least RESCUE higher. Dropped bags are the reverse (started at or above,
// ended below, RESCUE lower). Any bag with a low start averages higher later by chance alone (regression to the
// mean; stats audit 2026-10-17 must-fix 7), so the card says how many would look rescued with each bag's ratings in
// random order (exact over every ordering, rescueOdds), and earns a badge only when the count clearly beats that.
const RESCUE = 1; // ponytail: a fixed 1-point climb; tune at the Part 4 preview
const rescued = (start: number, end: number, m: number) => start < m && end >= m && end - start >= RESCUE;
const dropped = (start: number, end: number, m: number) => start >= m && end < m && start - end >= RESCUE;
// Every k-subset of 0..n−1, as sorted index lists.
const combos = (n: number, k: number, from = 0): number[][] =>
  k === 0 ? [[]] : Array.from({ length: Math.max(0, n - k - from + 1) }, (_, j) => from + j).flatMap((i) => combos(n, k - 1, i + 1).map((c) => [i, ...c]));
// The chance a bag looks rescued if its ratings came in random order: every pick of its 2 start brews and of its
// other `skip` − 2 dial-in brews, the rest once dialed. Exact; ponytail: C(n,2)·C(n−2,skip−2), ~2,400 orderings
// at 20 brews; sample orderings if bags ever run to 40+.
export function rescueOdds(rs: readonly number[], skip: number, m: number): number {
  let hit = 0, all = 0;
  for (const st of combos(rs.length, 2)) {
    const rest = rs.map((_, i) => i).filter((i) => !st.includes(i));
    for (const out of combos(rest.length, skip - 2)) {
      const later = rest.filter((_, j) => !out.includes(j));
      if (!later.length) continue;
      all++;
      if (rescued(mean(st.map((i) => rs[i])), mean(later.map((i) => rs[i])), m)) hit++;
    }
  }
  return all ? hit / all : 0;
}
const rescuedBags: Generator = (c) => {
  const raw = c.allBrews.filter((b) => countsForRating(b, c.ratings) && rated(b));
  const userMean = mean(raw.map((b) => b.rating!)), byId = bagById(c);
  const bags = [...perBag(raw)].flatMap(([id, bs]) => {
    const later = bs.filter((b) => !c.dialIn.has(b.id));
    if (single(bs.length).small || !c.dialIn.has(bs[0].id) || !c.dialIn.has(bs[1].id) || !later.length) return [];
    const start = mean(bs.slice(0, 2).map((b) => b.rating!)), end = mean(later.map((b) => b.rating!));
    return [{ id: id!, start, end, odds: rescueOdds(bs.map((b) => b.rating!), bs.length - later.length, userMean) }];
  });
  const saved = bags.filter((x) => rescued(x.start, x.end, userMean))
    .sort((a, b) => b.end - b.start - (a.end - a.start) || bagLabel(c, a.id).localeCompare(bagLabel(c, b.id)));
  if (bags.length < POOLED_MIN_BAGS || !saved.length) return null;
  const fell = bags.filter((x) => dropped(x.start, x.end, userMean)).length;
  // The chance count is a sum of independent bags' coin flips: its mean and SD.
  const chance = sum(bags.map((x) => x.odds)), spread = Math.sqrt(sum(bags.map((x) => x.odds * (1 - x.odds))));
  const z = spread > 0 ? (saved.length - chance) / spread : 0;
  const strength = strengthOf(z, true, 1, bags.length);
  const badge = strength === 'solid' || strength === 'hint';
  return {
    key: 'rescuedBags', theme: 'dialin', kind: 'number', headline: `${plural(saved.length, 'bag')} rescued after a rough start`,
    value: `${saved.length} of ${bags.length}`,
    body: `Their first two brews averaged ${mean(saved.map((x) => x.start)).toFixed(1)}; once dialed, ${mean(saved.map((x) => x.end)).toFixed(1)}. ` +
      `${Math.round(chance) ? `About ${Math.round(chance)}` : 'Almost none'} would look rescued by chance alone. ${fell || 'None'} started well then dropped.`,
    sample: plural(bags.length, 'bag'), href: DIAL_IN, z: badge ? z : null, strength: badge ? strength : null,
    ...details(['Biggest rescues', saved.map((x) => detail(bagLabel(c, x.id), `${x.start.toFixed(1)} → ${x.end.toFixed(1)}`, coffeeHref(byId.get(x.id))))])
  };
};

export const DIAL_IN_GENERATORS: ReadonlySet<Generator> = new Set([dialinCurve, dialinSpeed, firstVsLater, settleTrend]);

export const GENERATORS: Generator[] = [
  dialinCurve, dialinSpeed, firstVsLater, settleTrend, roastRating, roastShare, secondCup, fondMemory, repeatBuys, groupDelta, coFerments, notesTrouble, backlogRunway,
  morningDrift, weekendVsWeekday, earlyBrews, weekdayRatings, periodVsPrevious, gearEras, sameBagVersus, wildcardBrewer,
  priceVsRating, costPerCup, pricePerMonth, loyalty, restMyth, restWindowMyth, originMyth, backlogWaitMyth, variablesMyth, calibration,
  likeStandouts, dialinByGroup, rescuedBags
];

// ---- Insights tab: bucketing and What-if ----
export interface InsightsTab {
  grid: Finding[]; stories: Finding[]; myths: Finding[]; tooEarly: Finding[];
  whatIf: { defaults: WhatIf; onHandG: number; avgPricePerG: number | null }; // the client computes runway and spend
}
const DECK = 5;
// Too early to tell: a rating delta under EARLY_FLOOR is noise, not a lead ("rate 0.01 higher");
// the list keeps the EARLY_CAP strongest. Not in the spec: set 2026-10-12 against prod data.
const EARLY_FLOOR = 0.1, EARLY_CAP = 12;
// Always listed (user, gate P4): the dialinBy findings show in the grid when graded, else in Too early outside the cap.
const PINNED = (f: Finding) => f.key.startsWith('dialinBy:');
const negligible = (f: Finding) => /^[-+]\d/.test(f.value ?? '') && Math.abs(parseFloat(f.value!)) < EARLY_FLOOR;
const byZ = (a: Finding, b: Finding) => Math.abs(b.z ?? -1) - Math.abs(a.z ?? -1); // null z last

export function insightsTab(c: GenCtx, theme: Theme | undefined): InsightsTab {
  const fs = GENERATORS.flatMap((g) => [g(DIAL_IN_GENERATORS.has(g) ? { ...c, brews: c.allBrews } : c)].flat()).filter((f): f is Finding => f !== null).sort(byZ);
  const inGrid = (f: Finding) => (f.kind === 'number' || f.kind === 'pattern' || f.kind === 'versus') && f.strength !== 'early';

  const p = { start: c.period.from, end: c.period.to };
  const { perDay } = consumption(c.brews, p, c.dataStart, c.today, c.onHandG);
  const days = trackedDays(p, c.dataStart, c.today);
  const doses = c.brews.filter((b) => inPeriod(b.localDate, p) && (b.dose ?? 0) > 0);
  const size = Math.max(c.householdSize, 0);
  const defaults: WhatIf = {
    drinkers: size,
    gpp: perDay !== null && size > 0 ? perDay / size : 0, // measured g/day ÷ household
    inflow: 0,
    bpd: days > 0 ? doses.length / days : 0, // brews per tracked day
    dose: doses.length ? sum(doses.map((b) => b.dose!)) / doses.length : 0 // mean dose
  };
  // Weighted $/g over bags bought in the last 12 months; cost 0/null excluded.
  const since = addDays(c.today, -365);
  const priced = c.bags.filter((b) => b.purchaseDate && b.purchaseDate >= since && b.purchaseDate <= c.today && b.cost && b.amountG);
  const grams = sum(priced.map((b) => b.amountG!));
  const avgPricePerG = grams > 0 ? sum(priced.map((b) => b.cost!)) / grams : null;
  // Top stories: the story findings, topped up with the strongest graded grid findings that have a
  // body. Picked before the theme filter, so the deck is the same under every theme; a finding in the
  // deck (or retold by a story) leaves the grid.
  const graded = (f: Finding) => f.strength === 'solid' || f.strength === 'hint';
  const told = fs.filter((f) => f.kind === 'story' && graded(f)).slice(0, DECK);
  const stories = [...told, ...fs.filter((f) => inGrid(f) && graded(f) && f.body)].slice(0, DECK);
  const out = new Set(stories.flatMap((f) => (f.of ? [f.key, f.of] : [f.key])));
  return {
    grid: fs.filter((f) => inGrid(f) && !out.has(f.key) && (!theme || f.theme === theme)),
    stories,
    myths: fs.filter((f) => f.kind === 'myth'),
    tooEarly: ((k) => fs.filter((f) => f.strength === 'early' && !negligible(f) && (PINNED(f) || k++ < EARLY_CAP)))(0),
    whatIf: { defaults, onHandG: c.onHandG, avgPricePerG }
  };
}
