import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES } from '#lib/pick/rules.ts';
import { freshToday } from '#lib/pick/today.ts';
import { loadProfiles, loadRules, loadToday, saveProfiles, saveToday } from './store';

afterEach(() => vi.unstubAllGlobals());

describe('pick store', () => {
  it('survives a localStorage that throws', () => {
    const boom = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
    expect(loadToday(false, null, '2026-11-18')).toEqual(freshToday('2026-11-18'));
    expect(() => saveToday(false, freshToday('2026-11-18'))).not.toThrow();
    expect(loadRules(false, null)).toEqual(DEFAULT_RULES);
  });

  it('falls back to defaults on garbage from the server', () => {
    expect(loadRules(true, 'garbage')).toEqual(DEFAULT_RULES);
    expect(loadRules(true, null)).toEqual(DEFAULT_RULES);
  });

  it('saveProfiles rejects when the server says no', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    await expect(saveProfiles(true, { A: DEFAULT_RULES })).rejects.toThrow();
  });

  it('loadProfiles: admin migrates the old saved copy; a blocked localStorage gives none', () => {
    expect(loadProfiles(true, null, { sort: 'name' }).Saved.sort).toBe('name');
    const boom = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
    expect(loadProfiles(false, null, null)).toEqual({});
    expect(() => saveProfiles(false, {})).not.toThrow();
  });
});
