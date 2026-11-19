import type { DatabaseSync } from 'node:sqlite';
import { parseProfiles } from '#lib/pick/profiles.ts';
import type { PickRules } from '#lib/pick/types.ts';
import { getUserKv } from './userKv.ts';

/**
 * One saved rules profile of `ownerId` by name (a shared link), or null. Exact name first; failing that, a case-insensitive
 * match when exactly one profile fits. Only that profile's rules leave here, never the map, the last-used rules or today's state.
 */
export function getSharedProfile(db: DatabaseSync, ownerId: string, name: string): { name: string; rules: PickRules } | null {
  const profiles = parseProfiles(getUserKv(db, ownerId, 'pick.profiles'), getUserKv(db, ownerId, 'pick.rules.saved'));
  if (Object.hasOwn(profiles, name)) return { name, rules: profiles[name] };
  const hits = Object.keys(profiles).filter((n) => n.toLowerCase() === name.toLowerCase());
  return hits.length === 1 ? { name: hits[0], rules: profiles[hits[0]] } : null;
}
