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
export const RATINGS = ['settled', 'all'] as const;
export type Ratings = (typeof RATINGS)[number];
export const AVGS = ['adjusted', 'raw'] as const;
export type Avg = (typeof AVGS)[number];
// compare=YYYY-MM-DD..YYYY-MM-DD: a custom window (checked by comparePeriod in time.ts).
export const CUSTOM_RANGE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

export interface InsightsUrlState {
  range?: string; // a RANGES value or a calendar year ("2026")
  compare?: number; // periods back; 0 = off
  ratings?: Ratings;
  avg?: Avg;
}

export const DEFAULTS: Required<InsightsUrlState> = {
  range: '12m',
  compare: 0,
  ratings: 'settled',
  avg: 'adjusted'
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
export function compareOptions(
  range: string, years: readonly number[], brewYears: readonly number[] = years
): { n: number; label: string }[] {
  if (range in ROLLING_COMPARE) return ROLLING_COMPARE[range].map((label, i) => ({ n: i + 1, label }));
  if (range === 'all') return [];
  const ytd = range === 'ytd';
  const year = ytd ? years[years.length - 1] : Number(range);
  return [...brewYears]
    .filter((y) => y < year)
    .reverse()
    .map((y) => ({ n: year - y, label: ytd ? `${y} YTD` : String(y) }));
}

// `years`: the calendar years on offer (first brew year → this year);
// `brewYears`: the ones that have brews (defaults to all of them).
export function parseInsightsUrl(
  p: URLSearchParams, years: readonly number[], brewYears: readonly number[] = years
): InsightsUrlState {
  const range = pickOne(p, 'range', [...RANGES, ...years.map(String)]);
  const c = p.get('compare');
  const n = c !== null && /^\d+$/.test(c) ? Number(c) : NaN;
  const ok = n === 0 || compareOptions(range ?? DEFAULTS.range, years, brewYears).some((o) => o.n === n);
  return {
    range,
    compare: ok ? n : undefined,
    ratings: pickOne(p, 'ratings', RATINGS),
    avg: pickOne(p, 'avg', AVGS)
  };
}

export function insightsParams(s: InsightsUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.range) p.set('range', s.range);
  if (s.compare !== undefined) p.set('compare', String(s.compare));
  if (s.ratings) p.set('ratings', s.ratings);
  if (s.avg) p.set('avg', s.avg);
  return p;
}

export function withDefaults(s: InsightsUrlState): Required<InsightsUrlState> {
  return {
    range: s.range ?? DEFAULTS.range,
    compare: s.compare ?? DEFAULTS.compare,
    ratings: s.ratings ?? DEFAULTS.ratings,
    avg: s.avg ?? DEFAULTS.avg
  };
}
