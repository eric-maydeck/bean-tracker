import { pickOne } from '#lib/pageUrlState.ts';

// /on-deck view state: `show` (All/Caffeinated/Decaf) and `view` (Currently open is the default,
// so only `next`/`pick` are explicit; `game` rides along only with pick).
export const VIEWS = ['open', 'next', 'pick'] as const;
export type OnDeckView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<OnDeckView, string> = { open: 'Currently open', next: 'Next up', pick: 'Pick for me' };

export const parseOnDeckView = (p: URLSearchParams): 'next' | 'pick' | undefined => pickOne(p, 'view', ['next', 'pick']);
export const parseGame = (p: URLSearchParams): 'd20' | undefined => pickOne(p, 'game', ['d20']);

/** `profile`: a saved rules profile's name, trimmed; empty or over 60 characters is ignored. Matching against the owner's names is the server's. */
export const MAX_PROFILE_PARAM = 60;
export function parseProfile(p: URLSearchParams): string | undefined {
  const v = p.get('profile')?.trim();
  return v && v.length <= MAX_PROFILE_PARAM ? v : undefined;
}
/** `rules=default`: play the default rules (a share of no profile). A separate param so a profile named "default" cannot collide. */
export const parseDefaultRules = (p: URLSearchParams): boolean => p.get('rules')?.toLowerCase() === 'default';

export function onDeckParams(s: { show?: string; view?: 'next' | 'pick'; game?: 'd20'; profile?: string; defaultRules?: boolean }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.show) p.set('show', s.show);
  if (s.view) p.set('view', s.view);
  if (s.view === 'pick' && s.game) p.set('game', s.game);
  if (s.view === 'pick' && s.profile) p.set('profile', s.profile);
  else if (s.view === 'pick' && s.defaultRules) p.set('rules', 'default'); // a profile wins
  return p;
}
