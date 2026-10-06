import { pickOne } from '$lib/pageUrlState';

export const STATS_TABS = ['general', 'bq'] as const;
export type StatsTab = (typeof STATS_TABS)[number];
const BC_VALUES = ['overview', 'favorites', 'brewing', 'economics'] as const;

// undefined = nothing explicit (General). A valid legacy `bc=` with no
// `tab` opens Bean Conqueror so old shared links still land there.
export function parseStatsTab(p: URLSearchParams): StatsTab | undefined {
  return pickOne(p, 'tab', STATS_TABS) ?? (pickOne(p, 'bc', BC_VALUES) ? 'bq' : undefined);
}

// Bean Conqueror per-day tiles: "Per day" is the default, so only the
// non-default `avg=brew-day` ever appears in the URL.
export function parseBcAverage(p: URLSearchParams): 'brew-day' | undefined {
  return pickOne(p, 'avg', ['brew-day'] as const);
}
