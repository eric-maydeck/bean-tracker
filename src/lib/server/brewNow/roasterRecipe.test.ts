import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '../db';
import { stubConfig, unstubConfig } from '../testConfig';
import { findRoasterRecipe, getRoasterRecipe, SEARCH_UNAVAILABLE } from './roasterRecipe';
import { searchTavilyText, tavilyCallsInWindow } from '../imageSuggest/providers/tavily';

const NOW = new Date('2026-10-28T12:00:00Z');
const R = (url: string, title: string, content: string) => ({ url, title, content });
let db: DatabaseSync;
beforeEach(() => { db = createDb(':memory:'); vi.stubEnv('TAVILY_API_KEY', 'k'); stubConfig(''); });
afterEach(() => { unstubConfig(); vi.unstubAllGlobals(); });

describe('findRoasterRecipe', () => {
  it('stores the first recipe-looking result with a 280-char snippet', async () => {
    const search = vi.fn(async () => [R('https://a/x', 'About us', 'We roast coffee.'), R('https://a/guide', 'Brew guide', 'Use 15g to 250g. ' + 'x'.repeat(400))]);
    const r = await findRoasterRecipe(db, 'Acme', NOW, search);
    expect(r).toMatchObject({ roaster: 'Acme', url: 'https://a/guide', title: 'Brew guide', searchedAt: NOW.toISOString() });
    expect((r as { snippet: string }).snippet).toHaveLength(280);
    expect(getRoasterRecipe(db, 'acme')).toEqual(r);
  });
  it('stores a none-found row', async () => {
    const r = await findRoasterRecipe(db, 'Acme', NOW, async () => [R('https://a/x', 'About', 'Nothing here')]);
    expect(r).toMatchObject({ url: null, title: null, snippet: null });
    expect(getRoasterRecipe(db, 'Acme')?.url).toBeNull();
  });
  it('quota exhausted or no key: error, nothing stored, no search', async () => {
    const search = vi.fn(async () => []);
    vi.stubEnv('TAVILY_API_KEY', '');
    expect(await findRoasterRecipe(db, 'Acme', NOW, search)).toEqual({ error: SEARCH_UNAVAILABLE });
    vi.stubEnv('TAVILY_API_KEY', 'k'); stubConfig('tavily:\n  monthlyLimit: 1\n');
    db.prepare(`INSERT INTO search_usage (provider, at) VALUES ('tavily', ?)`).run(NOW.toISOString());
    expect(await findRoasterRecipe(db, 'Acme', NOW, search)).toEqual({ error: SEARCH_UNAVAILABLE });
    expect(search).not.toHaveBeenCalled();
    expect(getRoasterRecipe(db, 'Acme')).toBeNull();
  });
  it('a failing search is an error, nothing stored', async () => {
    expect(await findRoasterRecipe(db, 'Acme', NOW, async () => { throw new Error('boom'); })).toEqual({ error: SEARCH_UNAVAILABLE });
    expect(getRoasterRecipe(db, 'Acme')).toBeNull();
  });
  it('passes the roaster site host when known', async () => {
    db.prepare(`INSERT INTO roaster_websites (roaster, url) VALUES ('Acme', 'https://www.acme.com')`).run();
    const search = vi.fn(async (..._a: unknown[]) => []);
    await findRoasterRecipe(db, 'acme', NOW, search as never);
    expect(search.mock.calls[0][1]).toBe('www.acme.com');
    await findRoasterRecipe(db, 'Other', NOW, search as never);
    expect(search.mock.calls[1][1]).toBeNull();
  });
});

describe('searchTavilyText', () => {
  it('returns content and records usage', async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify({ results: [{ url: 'https://a/g', title: 'T', content: 'C' }, { url: 'ftp://x', title: 'no' }] })));
    vi.stubGlobal('fetch', f);
    expect(await searchTavilyText('q', 'a.com', new AbortController().signal, db, NOW)).toEqual([{ url: 'https://a/g', title: 'T', content: 'C' }]);
    expect(JSON.parse(f.mock.calls[0][1]!.body as string).include_domains).toEqual(['a.com']);
    expect(tavilyCallsInWindow(db, NOW)).toBe(1);
  });
});
