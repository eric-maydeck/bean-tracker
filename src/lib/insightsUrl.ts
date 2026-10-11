import { pickOne } from '$lib/pageUrlState';

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
export const RATINGS = ['current', 'all'] as const;
export type Ratings = (typeof RATINGS)[number];
// Rating boards' score: raw mean of bag means; min3 (the same, groups under 3 bags last); k2 / adjusted
// (shrunk toward the overall mean, K = 2 / 5 bags); best (highest single brew) and best-k2 / best-k5
// (best pulled toward the overall mean, K = 2 / 5 brews at that score); dial-k2 / dial-k5 (each bag's
// best half of brews, averaged across bags and shrunk, K = 2 / 5 bags).
export const AVGS = ['raw', 'min3', 'k2', 'adjusted', 'best', 'best-k2', 'best-k5', 'dial-k2', 'dial-k5'] as const;
export type Avg = (typeof AVGS)[number];
// One line to change the Score default.
export const DEFAULT_AVG: Avg = 'best-k2';
export const PEOPLE = ['household', 'person'] as const;
export type People = (typeof PEOPLE)[number];
export const TABS = ['overview', 'leaderboards', 'habits', 'consumption'] as const;
export type Tab = (typeof TABS)[number];
// Habits: one Measure for every chart. Consumption: grams or bags, bucketed by day/week/month
// (absent = auto from the tracked span, time.ts autoBy).
export const MEASURES = ['brews', 'grams', 'rating'] as const;
export type Measure = (typeof MEASURES)[number];
export const UNITS = ['grams', 'bags'] as const;
export type Unit = (typeof UNITS)[number];
export const BYS = ['day', 'week', 'month'] as const;
export type By = (typeof BYS)[number];
// Whether a `by` gives a readable chart for a range (time.ts byFits; this module is client-safe).
export type ByFits = (range: string, by: By) => boolean;
// Leaderboards: one Rank by for every board; `open` = the one board showing all its rows.
export const RANKS = ['rating', 'brews', 'grams', 'spend', 'ppg'] as const;
export type Rank = (typeof RANKS)[number];
export const BOARDS = ['roasters', 'coffees', 'origins', 'process', 'roast', 'water', 'dripper', 'filter', 'grinder'] as const;
export type Board = (typeof BOARDS)[number];
// Spend and $/g are per bag: only boards of bag attributes rank by them.
export const BAG_BOARDS: readonly Board[] = ['roasters', 'coffees', 'origins', 'process', 'roast'];
// Shared by /insights and /stats: the People switch's help text.
export const peopleHelp = (size: number): Record<People, string> => ({
  household: "Everyone's brews together.",
  person: `Totals and rates ÷ ${size}: an even split (Bean Conqueror doesn't record who brewed).`
});

// people=person splits totals evenly by household size; a household of one has nothing to
// split, so the param is dropped (a link from a 2-person household still opens cleanly).
export const parsePeople = (p: URLSearchParams, householdSize: number): People | undefined =>
  householdSize > 1 ? pickOne(p, 'people', PEOPLE) : undefined;

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
  open?: Board;
  measure?: Measure;
  unit?: Unit;
  by?: By;
}

export type InsightsView = Required<Omit<InsightsUrlState, 'open' | 'by'>> & { open?: Board; by?: By };

export const DEFAULTS: Required<Omit<InsightsUrlState, 'open' | 'by'>> = {
  range: '12m',
  compare: 0,
  ratings: 'current',
  avg: DEFAULT_AVG,
  people: 'household',
  tab: 'overview',
  rank: 'rating',
  measure: 'brews',
  unit: 'grams'
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
  householdSize = 1, byFits: ByFits = () => true, today = '9999-12-31'
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
    avg: pickOne(p, 'avg', AVGS),
    people: parsePeople(p, householdSize),
    tab,
    // rank and open belong to the leaderboards tab; elsewhere they're dropped.
    rank: tab === 'leaderboards' ? pickOne(p, 'rank', RANKS) : undefined,
    open: tab === 'leaderboards' ? pickOne(p, 'open', BOARDS) : undefined,
    // measure belongs to habits; unit and by to consumption (by only when it fits the range).
    measure: tab === 'habits' ? pickOne(p, 'measure', MEASURES) : undefined,
    unit: tab === 'consumption' ? pickOne(p, 'unit', UNITS) : undefined,
    by: tab === 'consumption' ? ((b) => (b && byFits(r, b) ? b : undefined))(pickOne(p, 'by', BYS)) : undefined
  };
}

export function insightsParams(s: InsightsUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.range) p.set('range', s.range);
  if (s.compare !== undefined) p.set('compare', String(s.compare));
  if (s.ratings) p.set('ratings', s.ratings);
  if (s.avg) p.set('avg', s.avg);
  if (s.people) p.set('people', s.people);
  if (s.tab) p.set('tab', s.tab);
  if (s.rank) p.set('rank', s.rank);
  if (s.open) p.set('open', s.open);
  if (s.measure) p.set('measure', s.measure);
  if (s.unit) p.set('unit', s.unit);
  if (s.by) p.set('by', s.by);
  return p;
}

export function withDefaults(s: InsightsUrlState): InsightsView {
  return {
    range: s.range ?? DEFAULTS.range,
    compare: s.compare ?? DEFAULTS.compare,
    ratings: s.ratings ?? DEFAULTS.ratings,
    avg: s.avg ?? DEFAULTS.avg,
    people: s.people ?? DEFAULTS.people,
    tab: s.tab ?? DEFAULTS.tab,
    rank: s.rank ?? DEFAULTS.rank,
    open: s.open,
    measure: s.measure ?? DEFAULTS.measure,
    unit: s.unit ?? DEFAULTS.unit,
    by: s.by
  };
}
