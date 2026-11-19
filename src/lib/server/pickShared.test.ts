import { describe, it, expect } from 'vitest';
import { createDb } from './db';
import { setUserKv } from './userKv';
import { getSharedProfile } from './pickShared';
import { DEFAULT_RULES } from '#lib/pick/rules.ts';

const db = () => {
  const d = createDb(':memory:');
  setUserKv(d, 'admin', 'pick.profiles', { Morning: { ...DEFAULT_RULES, sort: 'name' }, Night: { ...DEFAULT_RULES, includeDecaf: true }, night: { ...DEFAULT_RULES } });
  setUserKv(d, 'admin', 'pick.rules.last', { sort: 'name' });
  setUserKv(d, 'admin', 'pick.today', { out: [1] });
  return d;
};

describe('getSharedProfile', () => {
  it('returns one profile by name with its parsed rules', () => {
    expect(getSharedProfile(db(), 'admin', 'Morning')).toEqual({ name: 'Morning', rules: { ...DEFAULT_RULES, sort: 'name' } });
  });
  it('exact case wins; a lone case-insensitive match is accepted; an ambiguous one is not', () => {
    const d = db();
    expect(getSharedProfile(d, 'admin', 'Night')!.rules.includeDecaf).toBe(true);
    expect(getSharedProfile(d, 'admin', 'night')!.rules.includeDecaf).toBe(false);
    expect(getSharedProfile(d, 'admin', 'NIGHT')).toBeNull(); // two fit
    expect(getSharedProfile(d, 'admin', 'MORNING')!.name).toBe('Morning');
  });
  it('missing name, other owner, no profiles, bad JSON and prototype names are null', () => {
    const d = db();
    expect(getSharedProfile(d, 'admin', 'Nope')).toBeNull();
    expect(getSharedProfile(d, 'someone', 'Morning')).toBeNull();
    expect(getSharedProfile(createDb(':memory:'), 'admin', 'Morning')).toBeNull();
    expect(getSharedProfile(d, 'admin', '__proto__')).toBeNull();
    expect(getSharedProfile(d, 'admin', 'constructor')).toBeNull();
    d.prepare(`UPDATE user_kv SET value = '{bad' WHERE key = 'pick.profiles'`).run();
    expect(getSharedProfile(d, 'admin', 'Morning')).toBeNull();
  });
  it('exposes only that profile: nothing of the map, last rules or today comes with it', () => {
    const got = getSharedProfile(db(), 'admin', 'Morning')!;
    expect(Object.keys(got).sort()).toEqual(['name', 'rules']);
    expect(JSON.stringify(got)).not.toContain('Night');
  });
  it('a legacy single saved copy is the profile "Saved"', () => {
    const d = createDb(':memory:');
    setUserKv(d, 'admin', 'pick.rules.saved', { sort: 'name' });
    expect(getSharedProfile(d, 'admin', 'Saved')!.rules.sort).toBe('name');
  });
});
