import { pickOne } from '$lib/pageUrlState';

// /on-deck view state: `show` (All/Caffeinated/Decaf) and `view` (Currently open is the default,
// so only `next` is ever explicit).
export const VIEWS = ['open', 'next'] as const;
export type OnDeckView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<OnDeckView, string> = { open: 'Currently open', next: 'Next up' };

export const parseOnDeckView = (p: URLSearchParams): 'next' | undefined => pickOne(p, 'view', ['next']);

export function onDeckParams(s: { show?: string; view?: 'next' }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.show) p.set('show', s.show);
  if (s.view) p.set('view', s.view);
  return p;
}
