import type { Tab } from './insightsUrl';

export const parseYear = (s: string): number | null => (/^\d{4}$/.test(s) ? Number(s) : null);

// A year's recap opens Jan 1 of the next year; only years with brews. Newest first.
export const recapYears = (brewYears: readonly number[], today: string): number[] =>
  [...new Set(brewYears)].filter((y) => today >= `${y + 1}-01-01`).sort((a, b) => b - a);

export const SLIDE_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const POSTER_ID = 'poster';

export interface RecapUrlState { slide?: string; preview?: true }

// Slide membership is the page's check; this is shape only.
export function parseRecapUrl(p: URLSearchParams): RecapUrlState {
  const slide = (p.get('slide') ?? '').toLowerCase();
  return {
    ...(SLIDE_ID.test(slide) && { slide }),
    ...(p.get('preview') === '1' && { preview: true as const })
  };
}

export function seeMoreHref(year: number, tab: Tab, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (tab !== 'overview') q.set('tab', tab);
  q.set('range', String(year));
  q.set('caffeine', 'all');
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `/stats?${q}`;
}

export function recapHref(year: number, s: RecapUrlState): string {
  const q = new URLSearchParams();
  if (s.slide) q.set('slide', s.slide);
  if (s.preview) q.set('preview', '1');
  const qs = q.toString();
  return `/recaps/${year}${qs ? `?${qs}` : ''}`;
}
