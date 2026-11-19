import { pickOne } from '#lib/pageUrlState.ts';

// /on-deck view state: `show` (All/Caffeinated/Decaf) and `view` (Currently open is the default,
// so only `next`/`pick` are explicit; `game` rides along only with pick).
export const VIEWS = ['open', 'next', 'pick'] as const;
export type OnDeckView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<OnDeckView, string> = { open: 'Currently open', next: 'Next up', pick: 'Pick for me' };

export const parseOnDeckView = (p: URLSearchParams): 'next' | 'pick' | undefined => pickOne(p, 'view', ['next', 'pick']);
export const parseGame = (p: URLSearchParams): 'd20' | undefined => pickOne(p, 'game', ['d20']);

export function onDeckParams(s: { show?: string; view?: 'next' | 'pick'; game?: 'd20' }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.show) p.set('show', s.show);
  if (s.view) p.set('view', s.view);
  if (s.view === 'pick' && s.game) p.set('game', s.game);
  return p;
}
