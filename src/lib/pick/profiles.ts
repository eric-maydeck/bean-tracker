import { parseRules, rulesDiffer } from './rules';
import type { PickRules } from './types';

export type Profiles = Record<string, PickRules>;

export const MAX_NAME = 40;

/** A profile name: trimmed, 1 to 40 characters. Returns the trimmed name, or null when it is not allowed. */
export function cleanName(raw: string): string | null {
  const n = raw.trim();
  return n.length >= 1 && n.length <= MAX_NAME && n !== '__proto__' ? n : null; // '__proto__' would set the map's prototype, not a key
}

/**
 * Stored profiles (never throws). With no profiles stored yet, the old single saved copy becomes a profile
 * named "Saved"; once `pick.profiles` exists the old copy is ignored.
 */
export function parseProfiles(raw: unknown, legacySaved: unknown = null): Profiles {
  if (raw === null || raw === undefined) return legacySaved == null ? {} : { Saved: parseRules(legacySaved) };
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Profiles = {};
  for (const [name, rules] of Object.entries(raw)) {
    const n = cleanName(name);
    if (n === name) out[n] = parseRules(rules);
  }
  return out;
}

/**
 * The profile that was selected last time, kept only while it still holds: the profile exists (not renamed or deleted) and
 * its saved rules equal the rules restored with it. Anything else (stale, garbage, not a string) is no selection.
 */
export function restoreSelected(stored: unknown, profiles: Profiles, rules: PickRules): string {
  return typeof stored === 'string' && Object.hasOwn(profiles, stored) && !rulesDiffer(profiles[stored], rules) ? stored : '';
}
