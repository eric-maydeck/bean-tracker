import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES } from '#lib/pick/rules.ts';
import { freshToday } from '#lib/pick/today.ts';
import { loadCustomRules, loadCustomToday, loadList, saveCustomRules, saveCustomToday, saveList, loadProfiles, loadRules, loadSelected, loadToday, saveProfiles, saveSelected, saveToday } from './store';

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

  it('the selected profile: admin through the server, visitor through localStorage, never throws', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(loadSelected(true, 'Mine')).toBe('Mine');
    expect(loadSelected(false, 'ignored')).toBeNull();
    await saveSelected(false, 'Mine');
    expect(loadSelected(false, null)).toBe('Mine');
    expect(fetchMock).not.toHaveBeenCalled();
    await saveSelected(true, 'Other');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ key: 'pick.profile.selected', value: 'Other' });
    const boom = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom });
    expect(loadSelected(false, null)).toBeNull();
    await expect(saveSelected(false, 'x')).resolves.toBeUndefined();
  });

  it('custom mode keeps to its own keys, never the site keys or the server', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    saveList(['A', 'B']);
    saveCustomRules({ ...DEFAULT_RULES, sort: 'name' });
    saveCustomToday({ ...freshToday('2026-11-19'), out: [-5] });
    expect(loadList()).toEqual(['A', 'B']);
    expect(loadCustomRules()?.sort).toBe('name');
    expect(loadCustomToday('2026-11-19').out).toEqual([-5]);
    expect(loadCustomToday('2026-11-20').out).toEqual([]);
    expect([...mem.keys()].sort()).toEqual(['pick.custom.list', 'pick.custom.rules', 'pick.custom.today']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corrupt or blocked custom values fall back to defaults', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{nope', setItem: () => {} });
    expect(loadList()).toEqual([]);
    expect(loadCustomRules()).toBeNull(); // unreadable = never set: the size-based defaults apply
    expect(loadCustomToday('2026-11-19')).toEqual(freshToday('2026-11-19'));
    vi.stubGlobal('localStorage', { getItem: () => '{"a":1}', setItem: () => { throw new Error('x'); } });
    expect(loadList()).toEqual([]);
    expect(() => saveList(['x'])).not.toThrow();
  });
});
