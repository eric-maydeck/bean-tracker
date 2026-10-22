import { pickOne } from '$lib/pageUrlState';
import { GEAR_KINDS, type GearKind } from '$lib/gear';
import { upsertFilter, type Filter } from '$lib/coffeeFilters';
import { fromParams, toParams } from '$lib/coffeeViewState';

// /insights view state (spec "URL state"). Explicit choices only: a param a
// visitor never touched stays undefined and out of the URL (HANDOFF rule).
export const RANGES = ['1w', '1m', '3m', '6m', '12m', '3y', 'ytd', 'all'] as const;
export const RANGE_LABELS: Record<(typeof RANGES)[number], string> = {
  '1w': 'Last week',
  '1m': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  '3y': 'Last 3 years',
  ytd: 'Year to date',
  all: 'All time'
};
// How people abbreviate on a phone ("Last 12 months" → "Last 12 mo."); the narrow selects use it, and app.html's
// first-paint script applies the same data-short text before hydration (no flash of the long words).
export const phoneWords = (s: string): string => s.replace(/\bmonths\b/g, 'mo.').replace(/\byears\b/g, 'yr.').replace(/^Previous /, 'Prev. ');
export const RATINGS = ['current', 'all'] as const;
export type Ratings = (typeof RATINGS)[number];
// Option names, used verbatim wherever a setting is shown (the URL values stay current / all).
export const RATINGS_LABEL: Record<Ratings, string> = { current: 'Calibrated ratings', all: 'All ratings' };
// Rating boards' score: raw mean of bag means; min3 (the same, rows marked Low confidence left out); k2 / adjusted
// (shrunk toward the overall mean, K = 2 / 5 bags; a Coffees row, one bag, by K = 2 / 5 brews); best (highest single
// brew) and best-k2 / best-k5 (best pulled toward the overall mean, K = 2 / 5 brews at that score).
export const AVGS = ['raw', 'min3', 'k2', 'adjusted', 'best', 'best-k2', 'best-k5'] as const;
export type Avg = (typeof AVGS)[number];
// Old links to the retired best-half scores.
const RETIRED_AVGS = new Map<string, Avg>([['dial-k2', 'k2'], ['dial-k5', 'adjusted']]);
// The Score default per board (user ruling 2026-10-17): Coffees COFFEES_AVG (k2: shrunk by brews, every coffee
// shows, a 1-brew one can't top it), every other board DEFAULT_AVG (min3: rows under 3 bags / 10 brews left out).
// The one `avg` param: absent = these defaults; an explicit value (min3 included) applies to every board.
export const DEFAULT_AVG: Avg = 'min3';
export const COFFEES_AVG: Avg = 'k2';
export const boardAvg = (board: Board, avg: Avg | undefined): Avg => avg ?? (board === 'coffees' ? COFFEES_AVG : DEFAULT_AVG);
export const PEOPLE = ['household', 'person'] as const;
export type People = (typeof PEOPLE)[number];
export const BREWER_TYPES = ['pourover', 'espresso', 'immersion', 'soup', 'other'] as const;
export type BrewerType = (typeof BREWER_TYPES)[number];
// The Coffees filter's Caffeine: absent = Caffeinated (decaf brews skip rating views), Decaf only, or All.
export const CAFFEINES = ['decaf', 'all'] as const;
export type Caffeine = (typeof CAFFEINES)[number];
// Records: how many top brews show (absent = 10).
export const TOPS = [20, 50] as const;
export type Top = (typeof TOPS)[number];

// Insights brew filters (spec 2026-10-21): one value each, in the URL as these param names.
export const BREW_FILTER_KEYS = ['dripper', 'filter', 'water', 'brewDose', 'brewTemp'] as const;
export type BrewFilterKey = (typeof BREW_FILTER_KEYS)[number];
export type BrewFilters = Partial<Record<BrewFilterKey, string>>;
export const DOSE_BANDS: readonly { slug: string; label: string }[] = [
  { slug: 'lt12', label: '< 12g' }, { slug: '12', label: '12g' }, { slug: '15', label: '15g' },
  { slug: '18', label: '18g' }, { slug: '20', label: '20g' }, { slug: 'gt20', label: '> 20g' }
];
export const BREW_FILTER_LABEL: Record<BrewFilterKey, string> = { dripper: 'Dripper', filter: 'Filter', water: 'Water', brewDose: 'Dose', brewTemp: 'Temp' };
export const brewFilterText = (k: BrewFilterKey, v: string): string =>
  k === 'brewDose' ? (DOSE_BANDS.find((d) => d.slug === v)?.label ?? v) : k === 'brewTemp' ? `${v} °C` : v;

// Brewing lab tabs (spec 2026-10-12): Compare is hidden on them.
export const LAB_TABS = ['sweetspots', 'brewing', 'water', 'gear'] as const;
// Brewing breakdowns (tempBy=roast…; absent = None) and the slice functions' names in lab.ts.
export const SLICES = ['roast', 'process', 'origin', 'roaster'] as const;
export type Slice = (typeof SLICES)[number];
export const BY_PARAMS = ['tempBy', 'ratioBy', 'doseBy', 'timeBy', 'bloomBy', 'grindBy'] as const;
export type ByParam = (typeof BY_PARAMS)[number];
// Brewing Band/Exact toggles (G10): <param>=exact, absent = bands. Dose's is `dosing` because `dose` is What if's.
export const EXACT_PARAM = { temp: 'temp', ratio: 'ratio', dose: 'dosing', time: 'time', bloom: 'bloom', grind: 'grind' } as const;
export const EXACT_PARAMS = Object.values(EXACT_PARAM);
export type ExactParam = (typeof EXACT_PARAMS)[number];
// The values the lab's pickers offer (lab.ts labOptions, server-side): anything else in the URL is dropped.
export interface LabValues {
  bags: string[]; roasts: string[]; processes: string[]; origins: string[]; roasters: string[]; grinders: string[];
  drippers: string[]; filters: string[]; waters: string[]; doses: string[]; temps: string[];
}
export const NO_LAB: LabValues = { bags: [], roasts: [], processes: [], origins: [], roasters: [], grinders: [], drippers: [], filters: [], waters: [], doses: [], temps: [] };

export const TABS = ['overview', 'leaderboards', 'habits', 'consumption', 'records', 'milestones', 'insights', ...LAB_TABS] as const;
export type Tab = (typeof TABS)[number];
// The desktop side rail's groups, in TABS order: a new tab joins one group here (a test checks every tab is in one).
export const TAB_GROUPS: readonly { label: string; tabs: readonly Tab[] }[] = [
  { label: 'Summary', tabs: ['overview', 'leaderboards'] },
  { label: 'Habits', tabs: ['habits', 'consumption'] },
  { label: 'Highlights', tabs: ['records', 'milestones', 'insights'] },
  { label: 'Lab', tabs: LAB_TABS }
];
// Habits: one Measure for every chart. Consumption: grams or bags, bucketed by day/week/month
// (absent = auto from the tracked span, time.ts autoBy).
export const MEASURES = ['brews', 'grams', 'rating'] as const;
export type Measure = (typeof MEASURES)[number];
export const UNITS = ['grams', 'bags'] as const;
export type Unit = (typeof UNITS)[number];
// Consumption: per-day average within each bucket, or the bucket's total (URL carries only `total`).
export const AGGS = ['average', 'total'] as const;
export type Agg = (typeof AGGS)[number];
export const AGG_LABEL: Record<Agg, string> = { average: 'Avg per day', total: 'Total' };
// Once dialed (spec 2026-10-15 Part 2): rating views skip each bag's dial-in brews (dialed.ts). Only `all`
// is ever in the URL (dial=all); absent = Once dialed.
export const DIALS = ['dialed', 'all'] as const;
export type Dial = (typeof DIALS)[number];
export const DIAL_LABEL: Record<Dial, string> = { all: 'All brews', dialed: 'Once dialed' };
export const DIAL_HELP: Record<Dial, string> = {
  dialed: "Leaves out each bag's dial-in brews (the first, or 2 for an 8+ brew bag). Sample minimums still count them.",
  all: 'Every rated brew, dial-in included.'
};
export const BYS = ['day', 'week', 'month'] as const;
export type By = (typeof BYS)[number];
// Whether a `by` gives a readable chart for a range (time.ts byFits; this module is client-safe).
export type ByFits = (range: string, by: By) => boolean;
// Leaderboards: one Rank by for every board; `open` = the boards showing all their rows (open=water,process; board order).
export const RANKS = ['rating', 'brews', 'grams', 'spend', 'ppg', 'like'] as const;
export type Rank = (typeof RANKS)[number];
// Milestones: which kinds of moment to show (kinds=firsts,bests; absent = all).
export const KINDS = ['counts', 'firsts', 'bests', 'streaks', 'gear', 'anniversaries'] as const;
export type Kind = (typeof KINDS)[number];
// Insights: theme chip (absent = All).
export const THEMES = ['taste', 'dialin', 'habits', 'gear', 'money'] as const;
export type Theme = (typeof THEMES)[number];

// A plain decimal in [min, max] (integers only when `int`); anything else is dropped.
export function pickNumber(p: URLSearchParams, name: string, min: number, max: number, int = false): number | undefined {
  const v = p.get(name)?.trim();
  if (!v || !(int ? /^\d+$/ : /^\d+(\.\d+)?$/).test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

// What if inputs: [min, max] for the URL parser and the inputs.
export const WHATIF_LIMITS = { drinkers: [1, 20], gpp: [1, 500], inflow: [0, 10000], bpd: [0.5, 20], dose: [5, 40] } as const;

export const BOARDS = ['roasters', 'coffees', 'origins', 'process', 'roast', 'water', 'dripper', 'filter', 'grinder'] as const;
export type Board = (typeof BOARDS)[number];
// Spend and $/g are per bag: only boards of bag attributes rank by them.
export const BAG_BOARDS: readonly Board[] = ['roasters', 'coffees', 'origins', 'process', 'roast'];
// vs like coffees ranks coffees and their roasters only.
export const LIKE_BOARDS: readonly Board[] = ['coffees', 'roasters'];
// The small boards' List · Over time switch: views=roast-time,water-time-wide (absent = List; `wide`: the Over time card
// expanded to the band's full row).
export const VIEW_BOARDS = ['process', 'roast', 'water', 'dripper', 'filter', 'grinder'] as const satisfies readonly Board[];
export type ViewBoard = (typeof VIEW_BOARDS)[number];
export type BoardView = 'time' | 'wide';
export type BoardViews = Partial<Record<ViewBoard, BoardView>>;
function parseViews(v: string | null): BoardViews | undefined {
  const out: BoardViews = {};
  for (const x of (v ?? '').toLowerCase().split(',')) {
    const [b, w, e, ...rest] = x.trim().split('-');
    const board = VIEW_BOARDS.find((a) => a === b);
    if (board && w === 'time' && !rest.length && (e === undefined || e === 'wide')) out[board] = e ? 'wide' : 'time';
  }
  return Object.keys(out).length ? out : undefined;
}
const viewsText = (v: BoardViews) => VIEW_BOARDS.filter((b) => v[b]).map((b) => `${b}-time${v[b] === 'wide' ? '-wide' : ''}`).join(',');

// Shared by /insights and /stats: the People switch's help text.
export const peopleHelp = (size: number): Record<People, string> => ({
  household: "Everyone's brews together.",
  person: `Totals and rates ÷ ${size}: an even split (Bean Conqueror doesn't record who brewed).`
});

// people=person splits totals evenly by household size; a household of one has nothing to
// split, so the param is dropped (a link from a 2-person household still opens cleanly).
export const parsePeople = (p: URLSearchParams, householdSize: number): People | undefined =>
  householdSize > 1 ? pickOne(p, 'people', PEOPLE) : undefined;

// A comma list (kinds=firsts,bests): allowed values in their own order, junk dropped.
export function parseList<T extends string>(p: URLSearchParams, name: string, allowed: readonly T[]): T[] | undefined {
  const given = new Set((p.get(name) ?? '').toLowerCase().split(',').map((v) => v.trim()));
  const picked = allowed.filter((a) => given.has(a));
  return picked.length ? picked : undefined;
}

// A Period: a RANGES value or an offered calendar year (/insights, and /stats' Time to Clear).
export const parseRange = (p: URLSearchParams, years: readonly number[]): string | undefined =>
  pickOne(p, 'range', [...RANGES, ...years.map(String)]);

// compare=YYYY-MM-DD..YYYY-MM-DD: a custom window (checked by comparePeriod in time.ts).
export const CUSTOM_RANGE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export const isDate = (d: string): boolean => !isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

// A custom Period from the URL (/insights only; /stats' parseRange ignores it): real dates,
// from <= to, starting no later than today (a later end clamps to today in periodBounds).
export const parseCustomPeriod = (p: URLSearchParams, today: string): string | undefined => {
  const c = p.get('range');
  const m = c && CUSTOM_RANGE.exec(c);
  return m && isDate(m[1]) && isDate(m[2]) && m[1] <= m[2] && m[1] <= today ? c : undefined;
};

export const isCustom = (c: unknown): c is string => typeof c === 'string' && CUSTOM_RANGE.test(c);

// The compare value for drafted From/To dates, or null while Apply must stay disabled.
export const customRange = (from: string, to: string, today: string): string | null =>
  from && to && from <= to && to <= today ? `${from}..${to}` : null;

// Whether a longer or custom compare gives a usable window for a range (first-brew
// cutoff, a tracked day before the period, end ≤ today). Built server-side by
// time.ts compareFits; this client-safe module can't import it.
export type Fits = (range: string, compare: string) => boolean;
export interface CompareGroup {
  label: string;
  options: { value: string; label: string }[];
}

export interface InsightsUrlState {
  range?: string; // a RANGES value, a calendar year ("2026") or a custom 'YYYY-MM-DD..YYYY-MM-DD'
  compare?: number | string; // n periods back (0 = off), a longer window ('3m', 'before') or a custom 'YYYY-MM-DD..YYYY-MM-DD'
  ratings?: Ratings;
  avg?: Avg;
  people?: People;
  tab?: Tab;
  rank?: Rank;
  open?: Board[];
  views?: BoardViews; // Leaderboards: each small board's view (absent = List)
  measure?: Measure;
  unit?: Unit;
  by?: By;
  brewer?: BrewerType; // Records: one brewer type (absent = all)
  caffeine?: Caffeine; // absent = Caffeinated; an old caffeine=caf parses to it
  top?: Top; // Records: the top-brews list expanded from 10 to 20 or 50
  topc?: Top; // Records: the top-coffees list, likewise
  recent?: Top; // Overview: the Recent "Last brews" list expanded from 10 to 20 or 50
  recentc?: Top; // Overview: the "Last coffees finished" list, likewise
  kinds?: Kind[]; // Milestones: absent = all kinds
  theme?: Theme; // Insights: absent = All
  drinkers?: number; // Insights What if: absent = household size
  gpp?: number; // g/day per person
  inflow?: number; // g/week incoming
  bpd?: number; // brews/day
  dose?: number; // g per brew
  bag?: string; // Sweet spots: a coffee slug
  roast?: string;
  process?: string;
  origin?: string;
  roaster?: string;
  grinder?: string; // a grinder slug (absent = the most-used one)
  dripper?: string; // brew filters (BREW_FILTER_KEYS), one value each
  filter?: string;
  water?: string;
  brewDose?: string; // a DOSE_BANDS slug
  brewTemp?: string;
  tempBy?: Slice;
  ratioBy?: Slice;
  doseBy?: Slice;
  timeBy?: Slice;
  bloomBy?: Slice;
  grindBy?: Slice;
  temp?: 'exact'; // Brewing Band/Exact toggles (EXACT_PARAM): bands is the bare default
  ratio?: 'exact';
  dosing?: 'exact';
  time?: 'exact';
  bloom?: 'exact';
  grind?: 'exact';
  card?: string; // Gear's open trophy card (key "kind-slug")
  retired?: 'open'; // Gear's retired shelf is open
  gear?: GearKind; // Gear showcase's kind toggle: absent = All
  pairs?: string[]; // Water's "Same bag, different water": the recipe pairs shown in full (WaterPair slugs, "a--b")
  agg?: Agg; // only 'total' is ever explicit: average is the default
  dial?: Dial; // only 'all' is ever explicit
}

// avg: absent = each board's default (boardAvg), so there is no one default to fill in.
type Optional = 'avg' | 'open' | 'views' | 'by' | 'agg' | 'dial' | 'brewer' | 'kinds' | 'caffeine' | 'top' | 'topc' | 'recent' | 'recentc' | 'theme' | 'drinkers' | 'gpp' | 'inflow' | 'bpd' | 'dose'
  | 'bag' | 'roast' | 'process' | 'origin' | 'roaster' | 'grinder' | BrewFilterKey | ByParam | ExactParam | 'pairs' | 'card' | 'retired' | 'gear';
export type InsightsView = Required<Omit<InsightsUrlState, Optional>> & {
  avg?: Avg; open?: Board[]; views?: BoardViews; by?: By; agg: Agg; dial: Dial; brewer?: BrewerType; kinds?: Kind[]; caffeine?: Caffeine; top?: Top; topc?: Top; recent?: Top; recentc?: Top;
  theme?: Theme; drinkers?: number; gpp?: number; inflow?: number; bpd?: number; dose?: number;
  bag?: string; roast?: string; process?: string; origin?: string; roaster?: string; grinder?: string;
  tempBy?: Slice; ratioBy?: Slice; doseBy?: Slice; timeBy?: Slice; bloomBy?: Slice; grindBy?: Slice; pairs?: string[]; card?: string; retired?: 'open'; gear?: GearKind;
} & Partial<Record<ExactParam, 'exact'>> & BrewFilters;

export const DEFAULTS: Required<Omit<InsightsUrlState, Optional>> & { agg: Agg; dial: Dial } = {
  range: 'all', // All time (user ruling 2026-10-17; /stats' Time to Clear shares it)
  compare: 0,
  ratings: 'current',
  people: 'household',
  tab: 'overview',
  rank: 'rating',
  measure: 'brews',
  unit: 'grams',
  agg: 'average',
  dial: 'dialed'
};

// Same-length windows to compare a range with, n periods back. Rolling ranges
// have fixed depths; YTD and calendar years offer each earlier year that has
// brews (`brewYears`), n = years back; all time has nothing before it.
const ROLLING_COMPARE: Record<string, string[]> = {
  '1w': ['Previous week', ...[2, 3, 4].map((n) => `${n} weeks ago`)],
  '1m': ['Previous month', ...[2, 3, 4, 5, 6].map((n) => `${n} months ago`)],
  '3m': ['Previous 3 months', ...[2, 3, 4].map((n) => `${n * 3}–${n * 3 + 3} months ago`)],
  '6m': ['Previous 6 months', '12–18 months ago'],
  '12m': ['Previous 12 months', '2 years ago'],
  '3y': ['Previous 3 years']
};
// Longer windows end the day before the period (time.ts comparePeriod). Rolling ranges
// get the rolling lengths above their own; YTD and years get All before only.
const LONGER: Record<string, string> = {
  '1m': 'Previous month',
  '3m': 'Previous 3 months',
  '6m': 'Previous 6 months',
  '12m': 'Previous 12 months',
  '3y': 'Previous 3 years',
  before: 'All before'
};

function sameLength(
  range: string, years: readonly number[], brewYears: readonly number[] = years
): { n: number; label: string }[] {
  if (range in ROLLING_COMPARE) return ROLLING_COMPARE[range].map((label, i) => ({ n: i + 1, label }));
  if (range === 'all') return [];
  if (isCustom(range)) return [{ n: 1, label: 'Previous period' }];
  const ytd = range === 'ytd';
  const year = ytd ? years[years.length - 1] : Number(range);
  return [...brewYears]
    .filter((y) => y < year)
    .reverse()
    .map((y) => ({ n: year - y, label: ytd ? `${y} YTD` : String(y) }));
}

// The Compare menu for a range, by group. Off and Custom range… are the page's own.
export function compareOptions(
  range: string, years: readonly number[], brewYears: readonly number[] = years, fits: Fits = () => false
): CompareGroup[] {
  const rolling = Object.keys(ROLLING_COMPARE);
  const i = rolling.indexOf(range);
  const longer = Object.keys(LONGER).filter(
    (c) => range !== 'all' && (c === 'before' || (i >= 0 && rolling.indexOf(c) > i)) && fits(range, c)
  );
  return [
    {
      label: i >= 0 || isCustom(range) ? 'Same length' : 'Earlier years',
      options: sameLength(range, years, brewYears).map((o) => ({ value: String(o.n), label: o.label }))
    },
    { label: 'Longer', options: longer.map((c) => ({ value: c, label: LONGER[c] })) }
  ].filter((g) => g.options.length);
}

// Period changed: a custom range stays; a same-length depth the new range lacks falls
// back to the nearest shallower one; a longer window it doesn't offer turns compare off.
export function keepCompare(c: number | string | undefined, offered: readonly string[]): number | string | undefined {
  if (!c || isCustom(c)) return c;
  if (typeof c === 'string') return offered.includes(c) ? c : undefined;
  return Math.max(0, ...offered.map(Number).filter((n) => n <= c)) || undefined;
}

// `years`: the calendar years on offer (first brew year → this year);
// `brewYears`: the ones that have brews (defaults to all of them);
// `fits`: time.ts compareFits (without it, longer and custom values are ignored);
// `householdSize`: getHouseholdSize (1 drops `people`).
export function parseInsightsUrl(
  p: URLSearchParams, years: readonly number[], brewYears: readonly number[] = years, fits: Fits = () => false,
  householdSize = 1, byFits: ByFits = () => true, today = '9999-12-31',
  brewerTypes: readonly BrewerType[] = BREWER_TYPES, lab: LabValues = NO_LAB
): InsightsUrlState {
  const range = parseRange(p, years) ?? parseCustomPeriod(p, today);
  const r = range ?? DEFAULTS.range;
  const tab = pickOne(p, 'tab', TABS);
  const c = p.get('compare')?.toLowerCase();
  const offered = compareOptions(r, years, brewYears, fits).flatMap((g) => g.options.map((o) => o.value));
  const n = c !== undefined && /^\d+$/.test(c) ? Number(c) : NaN;
  const compare =
    n === 0 || offered.includes(String(n)) ? n
    : c && (offered.includes(c) || (isCustom(c) && fits(r, c))) ? c
    : undefined;
  return {
    range,
    compare,
    // `settled` was the old name for `current`; old links keep working.
    ratings: p.get('ratings')?.toLowerCase() === 'settled' ? 'current' : pickOne(p, 'ratings', RATINGS),
    dial: pickOne(p, 'dial', DIALS) === 'all' ? 'all' : undefined,
    // The retired best-half scores (dial-k2 / dial-k5) parse to their nearest remaining ones.
    avg: pickOne(p, 'avg', AVGS) ?? RETIRED_AVGS.get(p.get('avg')?.toLowerCase() ?? ''),
    people: parsePeople(p, householdSize),
    tab,
    // Tab-specific choices are kept on every tab so they survive a tab switch (each is only
    // used on its own tab); a by the range doesn't offer is dropped.
    rank: pickOne(p, 'rank', RANKS),
    open: parseList(p, 'open', BOARDS),
    views: parseViews(p.get('views')),
    measure: pickOne(p, 'measure', MEASURES),
    unit: pickOne(p, 'unit', UNITS),
    by: ((b) => (b && byFits(r, b) ? b : undefined))(pickOne(p, 'by', BYS)),
    agg: pickOne(p, 'agg', AGGS) === 'total' ? 'total' : undefined,
    brewer: pickOne(p, 'brewer', brewerTypes),
    kinds: parseList(p, 'kinds', KINDS),
    caffeine: pickOne(p, 'caffeine', CAFFEINES),
    top: TOPS.find((n) => String(n) === p.get('top')),
    topc: TOPS.find((n) => String(n) === p.get('topc')),
    recent: TOPS.find((n) => String(n) === p.get('recent')),
    recentc: TOPS.find((n) => String(n) === p.get('recentc')),
    theme: pickOne(p, 'theme', THEMES),
    drinkers: pickNumber(p, 'drinkers', ...WHATIF_LIMITS.drinkers, true),
    gpp: pickNumber(p, 'gpp', ...WHATIF_LIMITS.gpp),
    inflow: pickNumber(p, 'inflow', ...WHATIF_LIMITS.inflow),
    bpd: pickNumber(p, 'bpd', ...WHATIF_LIMITS.bpd),
    dose: pickNumber(p, 'dose', ...WHATIF_LIMITS.dose),
    bag: pickOne(p, 'bag', lab.bags),
    roast: pickOne(p, 'roast', lab.roasts),
    process: pickOne(p, 'process', lab.processes),
    origin: pickOne(p, 'origin', lab.origins),
    roaster: pickOne(p, 'roaster', lab.roasters),
    grinder: pickOne(p, 'grinder', lab.grinders),
    dripper: pickOne(p, 'dripper', lab.drippers),
    filter: pickOne(p, 'filter', lab.filters),
    water: pickOne(p, 'water', lab.waters),
    brewDose: pickOne(p, 'brewDose', lab.doses),
    brewTemp: pickOne(p, 'brewTemp', lab.temps),
    tempBy: pickOne(p, 'tempBy', SLICES),
    ratioBy: pickOne(p, 'ratioBy', SLICES),
    doseBy: pickOne(p, 'doseBy', SLICES),
    timeBy: pickOne(p, 'timeBy', SLICES),
    bloomBy: pickOne(p, 'bloomBy', SLICES),
    grindBy: pickOne(p, 'grindBy', SLICES),
    ...(Object.fromEntries(EXACT_PARAMS.map((k) => [k, p.get(k)?.toLowerCase() === 'exact' ? 'exact' : undefined])) as Partial<Record<ExactParam, 'exact'>>),
    pairs: parsePairs(p.get('pairs')),
    card: parseCard(p.get('card')),
    retired: pickOne(p, 'retired', ['open']),
    gear: pickOne(p, 'gear', GEAR_KINDS)
  };
}

// Expanded recipe pairs: slug pairs "a--b", lowercased, deduped, in the given order; anything else is dropped.
// Either order is accepted: stored sorted, as WaterPair.slug is. A slug that names no current pair (another period) matches nothing and is harmless.
const PAIR = /^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]+(-[a-z0-9]+)*$/;
function parsePairs(v: string | null): string[] | undefined {
  const xs = [...new Set((v ?? '').toLowerCase().split(',').map((x) => x.trim()).filter((x) => PAIR.test(x)).map((x) => x.split('--').sort().join('--')))];
  return xs.length ? xs : undefined;
}

// The open trophy card on Gear: one "kind-slug" key, lowercased; anything else is dropped.
const CARD = /^(dripper|grinder|filter)-[a-z0-9]+(-[a-z0-9]+)*$/;
function parseCard(v: string | null): string | undefined {
  const x = (v ?? '').trim().toLowerCase();
  return CARD.test(x) ? x : undefined;
}

// The coffee page's Vs like coffees panel (gate P4) honors the insights Ratings and Brews params, and caffeine=all
// (a decaf coffee is otherwise left out). Its links build with insightsParams; nothing else is read.
export type LikeView = Pick<InsightsUrlState, 'ratings' | 'dial' | 'caffeine'>;
export function parseLikeView(p: URLSearchParams): LikeView {
  const { ratings, dial, caffeine } = parseInsightsUrl(p, []);
  return { ...(ratings && { ratings }), ...(dial && { dial }), ...(caffeine === 'all' && { caffeine }) };
}

export function insightsParams(s: InsightsUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.range) p.set('range', s.range);
  if (s.compare !== undefined) p.set('compare', String(s.compare));
  if (s.ratings) p.set('ratings', s.ratings);
  if (s.dial === 'all') p.set('dial', 'all');
  if (s.avg) p.set('avg', s.avg);
  if (s.people) p.set('people', s.people);
  if (s.tab) p.set('tab', s.tab);
  if (s.rank) p.set('rank', s.rank);
  if (s.open?.length) p.set('open', s.open.join(','));
  if (s.views && Object.keys(s.views).length) p.set('views', viewsText(s.views));
  if (s.measure) p.set('measure', s.measure);
  if (s.unit) p.set('unit', s.unit);
  if (s.by) p.set('by', s.by);
  if (s.agg === 'total') p.set('agg', 'total');
  if (s.brewer) p.set('brewer', s.brewer);
  if (s.kinds) p.set('kinds', s.kinds.join(','));
  if (s.caffeine) p.set('caffeine', s.caffeine);
  if (s.top) p.set('top', String(s.top));
  if (s.topc) p.set('topc', String(s.topc));
  if (s.recent) p.set('recent', String(s.recent));
  if (s.recentc) p.set('recentc', String(s.recentc));
  if (s.theme) p.set('theme', s.theme);
  for (const k of ['drinkers', 'gpp', 'inflow', 'bpd', 'dose'] as const) if (s[k] !== undefined) p.set(k, String(s[k]));
  for (const k of ['bag', 'roast', 'process', 'origin', 'roaster', 'grinder', ...BREW_FILTER_KEYS, ...BY_PARAMS, ...EXACT_PARAMS] as const) if (s[k]) p.set(k, s[k]!);
  if (s.pairs?.length) p.set('pairs', s.pairs.join(','));
  if (s.card) p.set('card', s.card);
  if (s.retired) p.set('retired', s.retired);
  if (s.gear) p.set('gear', s.gear);
  return p;
}

// A finding's in-page link keeps the page-wide view it was computed on (Period, Compare, People, Ratings,
// Brews, Caffeine, Coffees filter), so the board shows the same figure and the remembered view survives the click.
// The link's own params win; links off /insights are left alone.
const PAGE_WIDE = ['range', 'compare', 'people', 'ratings', 'dial', 'caffeine', 'roast', 'process', 'origin', 'roaster', ...BREW_FILTER_KEYS] as const;
// A /coffees list link instead takes the page's Coffees filter (`coffees`, as /coffees filters); its own column wins.
export function withPageWide(href: string, s: InsightsUrlState, coffees: Filter[] = []): string {
  const u = new URL(href, 'http://x');
  if (u.origin === 'http://x' && u.pathname === '/coffees') {
    const own = fromParams(u.searchParams);
    return `/coffees?${toParams({ ...own, filters: own.filters.reduce(upsertFilter, coffees) })}${u.hash}`;
  }
  if (u.origin !== 'http://x' || u.pathname !== '/insights') return href;
  const p = insightsParams(s), out = new URLSearchParams();
  for (const k of PAGE_WIDE) if (p.has(k)) out.set(k, p.get(k)!);
  for (const [k, v] of u.searchParams) out.set(k, v);
  return `/insights?${out}${u.hash}`;
}

// The Coffees filter as one phrase for empty lines and chips ("Washed · Light"), '' when none is set.
export const coffeeNote = (s: Pick<InsightsUrlState, 'roast' | 'process' | 'origin' | 'roaster' | 'caffeine'>): string =>
  [s.caffeine === 'decaf' && 'Decaf', s.process, s.roast, s.origin, s.roaster].filter(Boolean).join(' · ');
// A tab's empty line naming the Coffees filter (spec Part 3): "No rated brews matching Washed · Light in this period."
// Every tab's empty line says "... in this period"; the phrase goes right before it.
export const emptyLine = (text: string, note: string): string =>
  note ? text.replace(/ in this period(.*?)\.?$/, ` matching ${note} in this period$1.`) : text;

// Which brew filters each tab offers (spec table); the rest don't apply there (a muted chip; they still ride the URL and links).
export const BREW_FILTERS_ON: Record<Tab, readonly BrewFilterKey[]> = {
  overview: BREW_FILTER_KEYS, leaderboards: BREW_FILTER_KEYS, insights: BREW_FILTER_KEYS,
  habits: ['dripper', 'brewDose'], consumption: ['dripper', 'brewDose'], records: ['dripper', 'water', 'brewDose'],
  milestones: [], sweetspots: [], brewing: ['dripper', 'filter', 'water'],
  water: ['dripper', 'filter', 'brewDose', 'brewTemp'], gear: ['water', 'brewDose', 'brewTemp']
};
// Gear's Dripper and Filter selects pick trophy cards, so they are offered there but filter nothing (activeBrewFilters).
export const GEAR_PICKS: readonly BrewFilterKey[] = ['dripper', 'filter'];
export const brewSelectsOn = (tab: Tab): readonly BrewFilterKey[] => (tab === 'gear' ? [...GEAR_PICKS, ...BREW_FILTERS_ON.gear] : BREW_FILTERS_ON[tab]);
export const activeBrewFilters = (s: InsightsView): BrewFilters =>
  Object.fromEntries(BREW_FILTERS_ON[s.tab].filter((k) => s[k]).map((k) => [k, s[k]]));
// The note under a figure that counts whole bags: brew filters can't narrow it. `items` names the figures.
export const wholeNote = (keys: readonly BrewFilterKey[], items?: readonly string[]): string => {
  const names = keys.map((k) => BREW_FILTER_LABEL[k].toLowerCase()).join(' and ');
  const rest = `the ${names} ${keys.length > 1 ? "filters don't" : "filter doesn't"} apply.`;
  return items?.length ? `${items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0]} ${items.length > 1 ? 'count' : 'counts'} whole bags: ${rest}` : `Whole bags: ${rest}`;
};

// Reset: every choice back to default (bare URL), keeping only a non-default tab.
export const resetInsights = (s: InsightsUrlState): InsightsUrlState =>
  s.tab && s.tab !== DEFAULTS.tab ? { tab: s.tab } : {};

// A board's rows, plural (the singular drops the s).
export const BOARD_NOUN: Record<Board, string> = {
  roasters: 'roasters', coffees: 'coffees', origins: 'origins', process: 'process groups', roast: 'roast levels',
  water: 'waters', dripper: 'drippers', filter: 'filters', grinder: 'grinders'
};
const count = (n: number, plural: string) => `${n} ${n === 1 ? plural.slice(0, -1) : plural}`;
// The See all note (gate 3): what the Score/Ratings/Brews settings hide on this tab. Rows the boards would gain
// and in-period rated brews left out.
// `why`: the settings that hid the brews; `rowsBy`: the settings that hid each board's rows (avg = Score's confident cutoff).
export type RowWhy = 'avg' | 'ratings' | 'dial';
export type Hidden = { rows: Partial<Record<Board, number>>; rowsBy?: Partial<Record<Board, RowWhy[]>>; brews: number; why?: ('ratings' | 'dial')[] };
const WHY = { avg: 'too few bags or brews', ratings: 'before calibration', dial: 'while dialing in' };
// "a or b"; with an item that holds an "or" itself, commas keep it readable: "a or b, c, or d".
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.some((x) => x.includes(' or ')) ? `${xs.slice(0, -1).join(', ')}, or ${xs.at(-1)}` : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
// The tip's board rows before "+N more": with the brews row a data tip's 1–4 rows (ui-rules 36), short enough to fit
// the band under the sticky bar at 1003×333 (rule 39). A single leftover board shows instead of "+1 more".
const HIDDEN_ROWS = 2;
// One short line (user, gate P4): "75 rows and 703 brews" + "hidden by your settings", whose tip lists each board's
// count ("Roasters 23"), then the brews', then the reasons once. null when nothing is hidden.
export function hiddenNote(h: Hidden): { lead: string; tip: { title: string; rows: [string, string][]; note?: string } } | null {
  const rows = Object.entries(h.rows) as [Board, number][];
  const n = rows.reduce((t, [, r]) => t + r, 0);
  if (!n && !h.brews) return null;
  const k = rows.length <= HIDDEN_ROWS + 1 ? rows.length : HIDDEN_ROWS;
  const rest = rows.slice(k).reduce((t, [, r]) => t + r, 0);
  const why = (Object.keys(WHY) as RowWhy[]).filter((w) => rows.some(([b]) => h.rowsBy?.[b]?.includes(w)) || (h.brews && (h.why as RowWhy[] | undefined)?.includes(w)));
  return {
    lead: [n && count(n, 'rows'), h.brews && count(h.brews, 'brews')].filter(Boolean).join(' and '),
    tip: {
      title: 'Hidden by your settings',
      rows: [
        ...rows.slice(0, k).map(([b, r]): [string, string] => [`${BOARD_NOUN[b][0].toUpperCase()}${BOARD_NOUN[b].slice(1)}`, `${r}`]),
        ...(rest ? [[`+${rows.length - k} more`, `${rest}`] as [string, string]] : []),
        ...(h.brews ? [['Rated brews', `${h.brews}`] as [string, string]] : [])
      ],
      note: why.length ? `Why: ${list(why.map((w) => WHY[w]))}.` : undefined
    }
  };
}

// The tabs and modes whose views read ratings: the Ratings/Brews menu shows there, and so does the roast nudge.
export const ratingsMenuOn = (s: Pick<InsightsView, 'tab' | 'rank' | 'measure'>): boolean =>
  ['sweetspots', 'brewing', 'water', 'gear', 'records'].includes(s.tab) || (s.tab === 'leaderboards' && (s.rank === 'rating' || s.rank === 'like')) || (s.tab === 'habits' && s.measure === 'rating');

export function withDefaults(s: InsightsUrlState): InsightsView {
  return {
    range: s.range ?? DEFAULTS.range,
    compare: s.compare ?? DEFAULTS.compare,
    ratings: s.ratings ?? DEFAULTS.ratings,
    avg: s.avg,
    people: s.people ?? DEFAULTS.people,
    tab: s.tab ?? DEFAULTS.tab,
    rank: s.rank ?? DEFAULTS.rank,
    open: s.open,
    views: s.views,
    measure: s.measure ?? DEFAULTS.measure,
    unit: s.unit ?? DEFAULTS.unit,
    by: s.by,
    agg: s.agg ?? DEFAULTS.agg,
    dial: s.dial ?? DEFAULTS.dial,
    brewer: s.brewer,
    kinds: s.kinds,
    caffeine: s.caffeine,
    top: s.top,
    topc: s.topc,
    recent: s.recent,
    recentc: s.recentc,
    theme: s.theme,
    drinkers: s.drinkers,
    gpp: s.gpp,
    inflow: s.inflow,
    bpd: s.bpd,
    dose: s.dose,
    bag: s.bag, roast: s.roast, process: s.process, origin: s.origin, roaster: s.roaster, grinder: s.grinder,
    dripper: s.dripper, filter: s.filter, water: s.water, brewDose: s.brewDose, brewTemp: s.brewTemp,
    tempBy: s.tempBy, ratioBy: s.ratioBy, doseBy: s.doseBy, timeBy: s.timeBy, bloomBy: s.bloomBy, grindBy: s.grindBy,
    temp: s.temp, ratio: s.ratio, dosing: s.dosing, time: s.time, bloom: s.bloom, grind: s.grind, pairs: s.pairs, card: s.card, retired: s.retired, gear: s.gear
  };
}

// A window's dates for a legend: "Mar 1 – Apr 9"; the year joins the end when it isn't this
// year, and both ends when the window spans years.
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const weekday = (d: string): number => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function windowLabel(p: { start: string | null; end: string }, today: string): string {
  if (!p.start) return 'All time';
  const f = (d: string, year: boolean) => `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}${year ? `, ${d.slice(0, 4)}` : ''}`;
  const spans = p.start.slice(0, 4) !== p.end.slice(0, 4);
  if (p.start === p.end) return f(p.start, spans || p.end.slice(0, 4) !== today.slice(0, 4));
  return `${f(p.start, spans)} – ${f(p.end, spans || p.end.slice(0, 4) !== today.slice(0, 4))}`;
}

// Chart legend names: the Period dropdown's label, and the Compare dropdown's label for the
// compared window (`menu`: that range's compareOptions options); custom windows use their dates.
export function periodLabel(range: string, period: { start: string | null; end: string }, today: string): string {
  return isCustom(range) ? windowLabel(period, today) : (RANGE_LABELS as Record<string, string>)[range] ?? range;
}
export function compareLabel(
  compare: number | string | undefined, menu: readonly { value: string; label: string }[],
  prev: { start: string | null; end: string } | null, today: string
): string {
  if (!prev) return '';
  if (isCustom(compare)) return windowLabel(prev, today);
  return menu.find((o) => o.value === String(compare))?.label ?? windowLabel(prev, today);
}
