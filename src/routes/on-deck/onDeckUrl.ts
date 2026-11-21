import { pickOne } from '#lib/pageUrlState.ts';
import { cleanName } from '#lib/pick/profiles.ts';
import { DEFAULT_RULES, parseRules } from '#lib/pick/rules.ts';
import type { Game, PickRules } from '#lib/pick/types.ts';

// /on-deck view state: `show` (All/Caffeinated/Decaf) and `view` (Currently open is the default,
// so only `next`/`pick` are explicit; `game` (wheel or d20) rides along only with pick; none = the visitor's last game today).
export const VIEWS = ['open', 'next', 'pick'] as const;
export type OnDeckView = (typeof VIEWS)[number];
export const VIEW_LABEL: Record<OnDeckView, string> = { open: 'Currently open', next: 'Next up', pick: 'Pick for me' };

export const parseOnDeckView = (p: URLSearchParams): 'next' | 'pick' | undefined => pickOne(p, 'view', ['next', 'pick']);
export const parseGame = (p: URLSearchParams): Game | undefined => pickOne(p, 'game', ['wheel', 'd20']);

/** `coffees=custom`: play with the visitor's own list (kept in their browser, so never in a share link). Bare = the site's coffees. */
export const parseCoffees = (p: URLSearchParams): 'custom' | undefined => pickOne(p, 'coffees', ['custom']);

/** `roll=<n>`: the result a share link replays, 1-20 (a d20 face, or the wheel's slice number; whether it fits the board is checked where the board is known). */
export function parseRoll(p: URLSearchParams): number | undefined {
  const v = p.get('roll')?.trim();
  const n = v && /^\d+$/.test(v) ? Number(v) : 0;
  return n >= 1 && n <= 20 ? n : undefined;
}
/** `c=<coffee id>`: the coffee a shared crit result was (positive integer). Only meaningful with `roll`. */
export function parseCoffeeParam(p: URLSearchParams): number | undefined {
  const v = p.get('c')?.trim();
  const n = v && /^\d+$/.test(v) ? Number(v) : 0;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

/** `profile`: a saved rules profile's name, trimmed; empty or over 60 characters is ignored. Matching against the owner's names is the server's. */
export const MAX_PROFILE_PARAM = 60;
export function parseProfile(p: URLSearchParams): string | undefined {
  const v = p.get('profile')?.trim();
  return v && v.length <= MAX_PROFILE_PARAM ? v : undefined;
}
/** `rules=default`: play the default rules (a share of no profile). A separate param so a profile named "default" cannot collide. */
export const parseDefaultRules = (p: URLSearchParams): boolean => p.get('rules')?.toLowerCase() === 'default';

/**
 * `rules=<code>`: the rules themselves in the link (a visitor's localStorage profile), base64url of `{n: name, r: the fields that differ from the defaults}`.
 * Untrusted input: the character set and length are checked here, the content in `decodeRulesLink`. "default" is never a code.
 */
export const MAX_RULES_CODE = 2000;
export function parseRulesCode(p: URLSearchParams): string | undefined {
  const v = p.get('rules')?.trim();
  return v && v.length <= MAX_RULES_CODE && v.toLowerCase() !== 'default' && /^[A-Za-z0-9_-]+$/.test(v) ? v : undefined;
}
/** The code for a link, or null when it would be longer than the decoder accepts (the share then falls back to the default rules). */
export function encodeRulesLink(name: string, rules: PickRules): string | null {
  const diff = Object.fromEntries(Object.entries(rules).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((DEFAULT_RULES as unknown as Record<string, unknown>)[k])));
  let bin = '';
  new TextEncoder().encode(JSON.stringify({ n: name, r: diff })).forEach((b) => (bin += String.fromCharCode(b)));
  const code = btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return code.length <= MAX_RULES_CODE ? code : null;
}
/** The profile name and the validated rules (per-field fallback to the defaults) a code carries, or null when it cannot be read. */
export function decodeRulesLink(code: string): { name: string; rules: PickRules } | null {
  try {
    if (code.length > MAX_RULES_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    const bytes = Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
    const o: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const { n, r } = o as { n?: unknown; r?: unknown };
    const name = typeof n === 'string' ? cleanName(n) : null;
    if (!name || !r || typeof r !== 'object' || Array.isArray(r)) return null;
    return { name, rules: parseRules(r) };
  } catch {
    return null;
  }
}

export function onDeckParams(s: { show?: string; view?: 'next' | 'pick'; game?: Game; profile?: string; rulesCode?: string; defaultRules?: boolean; coffees?: 'custom'; roll?: number; c?: number }): URLSearchParams {
  const p = new URLSearchParams();
  if (s.show) p.set('show', s.show);
  if (s.view) p.set('view', s.view);
  if (s.view === 'pick' && s.game) p.set('game', s.game);
  if (s.view === 'pick' && s.coffees) p.set('coffees', s.coffees);
  if (s.view === 'pick' && s.profile) p.set('profile', s.profile);
  else if (s.view === 'pick' && s.rulesCode) p.set('rules', s.rulesCode);
  else if (s.view === 'pick' && s.defaultRules) p.set('rules', 'default'); // a profile wins, then a code
  if (s.view === 'pick' && s.roll) { p.set('roll', String(s.roll)); if (s.c) p.set('c', String(s.c)); } // the shared result (a crit's coffee)
  return p;
}
