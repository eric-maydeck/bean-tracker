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

export interface InsightsUrlState {
  range?: string; // a RANGES value or a calendar year ("2026")
  compare?: boolean;
  ratings?: Ratings;
  avg?: Avg;
}

export const DEFAULTS: Required<InsightsUrlState> = {
  range: '12m',
  compare: false,
  ratings: 'settled',
  avg: 'adjusted'
};

// `years`: the calendar years on offer (first brew year → this year).
export function parseInsightsUrl(p: URLSearchParams, years: readonly number[]): InsightsUrlState {
  const compare = pickOne(p, 'compare', ['1', '0'] as const);
  return {
    range: pickOne(p, 'range', [...RANGES, ...years.map(String)]),
    compare: compare === undefined ? undefined : compare === '1',
    ratings: pickOne(p, 'ratings', RATINGS),
    avg: pickOne(p, 'avg', AVGS)
  };
}

export function insightsParams(s: InsightsUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.range) p.set('range', s.range);
  if (s.compare !== undefined) p.set('compare', s.compare ? '1' : '0');
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
