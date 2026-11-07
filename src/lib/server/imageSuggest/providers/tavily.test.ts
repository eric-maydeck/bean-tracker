import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '../../db';
import { stubConfig, unstubConfig } from '../../testConfig';
import { searchTavily, tavilyAvailable, tavilyCallsInWindow, recordTavilyCall, BUDGET_NOTE } from './tavily';
import type { SuggestQuery } from '../types';

// Hand-written to Tavily's documented response shape (no key when written);
// Task 12 may swap in a captured reply.
const REPLY = readFileSync(new URL('../../fixtures/product-pages/tavily-search.handwritten.json', import.meta.url), 'utf8');
const Q: SuggestQuery = { roaster: 'The Picky Chemist', name: 'Ethiopia Gesha Village Lot 26/136 Oma Honey', origin: null, roastDate: null, site: 'https://en.thepickychemist.com' };
const NOW = new Date('2026-10-06T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const signal = new AbortController().signal;
const ok = (body = REPLY) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(body));
const EMPTY = JSON.stringify({ results: [] });
const sent = (f: ReturnType<typeof ok>, call = 0) => JSON.parse(f.mock.calls[call][1]!.body as string);

let db: DatabaseSync;
beforeEach(() => {
  db = createDb(':memory:');
  vi.stubEnv('TAVILY_API_KEY', 'tvly-test');
  stubConfig('');
});
afterEach(() => {
  unstubConfig();
  vi.unstubAllGlobals();
});

describe('searchTavily', () => {
  it('basic search for the quoted name, restricted to the site host, bearer key; maps http(s) results', async () => {
    const f = ok();
    vi.stubGlobal('fetch', f);
    const pages = await searchTavily(Q, signal, db, NOW);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe('https://api.tavily.com/search');
    expect((f.mock.calls[0][1]!.headers as Record<string, string>).authorization).toBe('Bearer tvly-test');
    expect(sent(f)).toEqual({
      query: '"Ethiopia Gesha Village Lot 26/136 Oma Honey" The Picky Chemist coffee',
      search_depth: 'basic',
      max_results: 5,
      include_domains: ['en.thepickychemist.com']
    });
    expect(pages).toEqual([
      { url: 'https://en.thepickychemist.com/product-page/ethiopia-gesha-village-lot-26-136-oma-honey', title: 'Ethiopia Gesha Village Lot 26/136 Oma Honey | The Picky Chemist', provider: 'tavily' },
      { url: 'https://www.beanhoard.com/coffees/the-picky-chemist-gesha-village-oma-honey', title: 'The Picky Chemist Gesha Village Oma Honey - Bean Hoard', provider: 'tavily' }
    ]);
  });

  it('a term replaces coffee in the query', async () => {
    const f = ok();
    vi.stubGlobal('fetch', f);
    await searchTavily({ ...Q, term: 'pour over dripper' }, signal, db, NOW);
    expect(sent(f).query).toBe('"Ethiopia Gesha Village Lot 26/136 Oma Honey" The Picky Chemist pour over dripper');
  });

  it('no site: one open-web call', async () => {
    const f = ok();
    vi.stubGlobal('fetch', f);
    await searchTavily({ ...Q, site: null }, signal, db, NOW);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sent(f).include_domains).toBeUndefined();
  });

  it('site finds nothing: a second, open-web call, and never a third', async () => {
    const f = ok(EMPTY);
    vi.stubGlobal('fetch', f);
    expect(await searchTavily(Q, signal, db, NOW)).toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sent(f, 1).include_domains).toBeUndefined();
  });

  it('throws the reason for a non-OK reply', async () => {
    for (const [status, reason] of [[401, 'bad API key'], [429, 'rate limited'], [432, 'monthly limit reached'], [500, 'HTTP 500']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
      await expect(searchTavily(Q, signal, db, NOW)).rejects.toThrow(reason);
    }
  });
});

describe('Tavily budget', () => {
  it('is unavailable without a key', () => {
    vi.stubEnv('TAVILY_API_KEY', '');
    expect(tavilyAvailable(db, NOW)).toBe(false);
  });

  it('at the limit: unavailable with the note; rows older than 31 days don’t count', () => {
    stubConfig('tavily:\n  monthlyLimit: 3\n');
    const insert = db.prepare(`INSERT INTO search_usage (provider, at) VALUES ('tavily', ?)`);
    for (const d of [1, 10, 40]) insert.run(daysAgo(d));
    expect(tavilyCallsInWindow(db, NOW)).toBe(2);
    expect(tavilyAvailable(db, NOW)).toBe(true);
    insert.run(daysAgo(30));
    expect(tavilyAvailable(db, NOW)).toBe(BUDGET_NOTE);
  });

  it('defaults the limit to 1400', () => {
    const insert = db.prepare(`INSERT INTO search_usage (provider, at) VALUES ('tavily', ?)`);
    for (let i = 0; i < 1399; i++) insert.run(daysAgo(1));
    expect(tavilyAvailable(db, NOW)).toBe(true);
    insert.run(daysAgo(1));
    expect(tavilyAvailable(db, NOW)).toBe(BUDGET_NOTE);
  });

  it('a write prunes rows older than 31 days', () => {
    db.prepare(`INSERT INTO search_usage (provider, at) VALUES ('tavily', ?)`).run(daysAgo(40));
    recordTavilyCall(db, NOW);
    expect(db.prepare(`SELECT at FROM search_usage`).all()).toEqual([{ at: NOW.toISOString() }]);
  });

  it('every call is recorded before it is made, so a failed call still counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(searchTavily({ ...Q, site: null }, signal, db, NOW)).rejects.toThrow();
    expect(tavilyCallsInWindow(db, NOW)).toBe(1);
  });

  it('no second call when the first used the last credit', async () => {
    stubConfig('tavily:\n  monthlyLimit: 1\n');
    const f = ok(EMPTY);
    vi.stubGlobal('fetch', f);
    await searchTavily(Q, signal, db, NOW);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
