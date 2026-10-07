import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { providers, suggest, UNCONFIGURED_NOTE } from './index';
import type { CandidatePage, FetchPage, Provider, SuggestQuery } from './types';

const Q: SuggestQuery = { roaster: 'Lume', name: 'Kiambu', origin: 'Kenya', roastDate: '2026-09-01', site: null };
const page = (n: number): CandidatePage => ({ url: `https://shop.example/p/${n}`, title: `Page ${n}`, provider: 'fake' });
const fake = (name: string, result: CandidatePage[] | Error, available: boolean | string = true): Provider => ({
  name,
  available: () => available,
  search: vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  })
});
// Each page offers n images (<img srcset> passes pageImages' filter).
const pages = (n = 1): FetchPage =>
  vi.fn(async (url: string) => ({
    status: 200,
    body: Array.from({ length: n }, (_, i) => `<img src="${url}/img-${i}.png" srcset="x 1x">`).join(''),
    finalUrl: url
  }));

afterEach(() => vi.unstubAllEnvs());

describe('providers', () => {
  const all = [fake('shopify', []), fake('tavily', [])];
  it('keeps config order, ignores unknown names, case and duplicates', () => {
    expect(providers('tavily,shopify', all).map((p) => p.name)).toEqual(['tavily', 'shopify']);
    expect(providers(' Bing , SHOPIFY,shopify', all).map((p) => p.name)).toEqual(['shopify']);
  });
  it('defaults to shopify,tavily', () => {
    vi.stubEnv('IMAGE_SUGGEST_PROVIDERS', '');
    expect(providers(undefined, all).map((p) => p.name)).toEqual(['shopify', 'tavily']);
  });
});

describe('suggest fill rule', () => {
  const run = (list: Provider[], fetchPage = pages()) => suggest(Q, { providers: list, fetchPage });
  it('a later provider is never called once 6 candidates exist', async () => {
    const b = fake('b', [page(9)]);
    const r = await run([fake('a', [page(1)]), b], pages(6));
    expect(r.candidates).toHaveLength(6);
    expect(b.search).not.toHaveBeenCalled();
  });
  it('a later provider fills the remaining slots; earlier candidates stay first', async () => {
    const fetchPage: FetchPage = async (url) => ({
      status: 200,
      body: Array.from({ length: url.endsWith('/1') ? 2 : 9 }, (_, i) => `<img src="${url}/i${i}.png" srcset="x 1x">`).join(''),
      finalUrl: url
    });
    const r = await run([fake('a', [page(1)]), fake('b', [page(2)])], fetchPage);
    expect(r.candidates).toHaveLength(6);
    expect(r.candidates.slice(0, 2).map((c) => c.pageUrl)).toEqual(['https://shop.example/p/1', 'https://shop.example/p/1']);
    expect(r.candidates.slice(2).every((c) => c.pageUrl.endsWith('/2'))).toBe(true);
  });
  it('an empty first provider: the second fills', async () => {
    const r = await run([fake('a', []), fake('b', [page(2)])], pages(3));
    expect(r.candidates).toHaveLength(3);
    expect(r.status).toBe('ok');
  });
  it('first throws, second ok: ok with the first’s note', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run([fake('a', new Error('boom')), fake('b', [page(2)])]);
    expect(r.status).toBe('ok');
    expect(r.notes).toEqual(['a unavailable (boom)']);
    log.mockRestore();
  });
  it('at most 5 pages per provider', async () => {
    const fetchPage = pages();
    await run([fake('a', [1, 2, 3, 4, 5, 6, 7].map(page))], fetchPage);
    expect(vi.mocked(fetchPage)).toHaveBeenCalledTimes(5);
  });
  const dated = (m: Record<string, string | null>): FetchPage => async (url) => ({
    status: 200,
    body: `${m[url.split('/').pop()!] ? `<meta property="article:published_time" content="${m[url.split('/').pop()!]}">` : ''}<img src="${url}/x.png" srcset="x 1x">`,
    finalUrl: url
  });
  const closest = (r: Awaited<ReturnType<typeof run>>) => r.candidates.map((c) => c.closest);
  it('closest is the final-list candidate dated nearest the roast date, not the top-ranked', async () => {
    const r = await run([fake('a', [{ ...page(1), title: 'Kiambu' }, page(2)])], dated({ 1: '2020-01-01', 2: '2026-08-30' }));
    expect(closest(r)).toEqual([false, true]);
  });
  it('closest skips an undated first candidate', async () => {
    expect(closest(await run([fake('a', [{ ...page(1), title: 'Kiambu' }, page(2)])], dated({ 1: null, 2: '2026-08-30' })))).toEqual([false, true]);
  });
  it('no roast date: nothing is closest', async () => {
    const r = await suggest({ ...Q, roastDate: null }, { providers: [fake('a', [page(1)])], fetchPage: dated({ 1: '2026-08-30' }) });
    expect(closest(r)).toEqual([false]);
  });
  it('a page repeated within one provider is fetched once', async () => {
    const fetchPage = pages();
    await run([fake('a', [page(1), page(1), page(2)])], fetchPage);
    expect(vi.mocked(fetchPage)).toHaveBeenCalledTimes(2);
  });
});

describe('suggest', () => {
  const run = (list: Provider[], fetchPage = pages(), signal?: AbortSignal) => suggest(Q, { providers: list, fetchPage, signal });

  it('ok: candidates from pages in provider order', async () => {
    const r = await run([fake('a', [page(1)]), fake('b', [page(2)])]);
    expect(r.status).toBe('ok');
    expect(r.candidates.map((c) => c.pageUrl)).toEqual(['https://shop.example/p/1', 'https://shop.example/p/2']);
    expect(r.notes).toEqual([]);
  });

  it('skips an unavailable provider without calling it; an unavailable note is kept', async () => {
    const off = fake('off', [page(9)], false);
    const budget = fake('tavily', [page(8)], 'tavily monthly budget used');
    const r = await run([off, budget, fake('b', [page(2)])]);
    expect(off.search).not.toHaveBeenCalled();
    expect(budget.search).not.toHaveBeenCalled();
    expect(r.candidates.map((c) => c.pageUrl)).toEqual(['https://shop.example/p/2']);
    expect(r.notes).toEqual(['tavily monthly budget used']);
  });

  it('a throwing provider is skipped with a note; the rest still run', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run([fake('a', new Error('rate limited')), fake('b', [page(2)])]);
    expect(r.status).toBe('ok');
    expect(r.notes).toEqual(['a unavailable (rate limited)']);
    log.mockRestore();
  });

  it('dedupes pages by URL across providers', async () => {
    const fetchPage = pages();
    await run([fake('a', [page(1), page(2)]), fake('b', [page(2), page(3)])], fetchPage);
    expect(vi.mocked(fetchPage).mock.calls.map(([u]) => u)).toEqual([1, 2, 3].map((n) => `https://shop.example/p/${n}`));
  });

  it('returns at most 6 candidates', async () => {
    expect((await run([fake('a', [page(1)])], pages(9))).candidates).toHaveLength(6);
  });

  it('a page that fails to fetch is skipped', async () => {
    const fetchPage: FetchPage = vi.fn(async (url: string) => {
      if (url.endsWith('/1')) throw new Error('ECONNRESET');
      return { status: 200, body: `<img src="${url}/x.png" srcset="x 1x">`, finalUrl: url };
    });
    expect((await run([fake('a', [page(1), page(2)])], fetchPage)).candidates.map((c) => c.pageUrl)).toEqual(['https://shop.example/p/2']);
  });

  it('a Shopify product page is read through its .json (captured page; bag art ranks first)', async () => {
    const json = readFileSync(new URL('../fixtures/product-pages/ordinary-faf.json', import.meta.url), 'utf8');
    const url = 'https://shop.ordinarycoffeeroasters.com/products/faf-coffee-brazil-anaerobic-natural-catuai';
    const fetchPage: FetchPage = vi.fn(async (u: string) => ({ status: u.endsWith('.json') ? 200 : 404, body: json, finalUrl: u }));
    const r = await run([fake('shopify', [{ url, title: 'FAF', provider: 'shopify' }])], fetchPage);
    expect(vi.mocked(fetchPage).mock.calls[0][0]).toBe(`${url}.json`);
    expect(r.candidates[0].image).toContain('Same_white_pouch_design');
  });

  it('a candidate carries its page’s published date and excerpt', async () => {
    const fetchPage: FetchPage = async (url) => ({
      status: 200,
      body: `<meta property="article:published_time" content="2026-08-20"><meta name="description" content="Jammy"><img src="${url}/x.png" srcset="x 1x">`,
      finalUrl: url
    });
    const r = await run([fake('a', [page(1)])], fetchPage);
    expect(r.candidates[0]).toMatchObject({ published: '2026-08-20', excerpt: 'Jammy', closest: true });
  });

  it('empty: providers ran but nothing usable', async () => {
    expect(await run([fake('a', [])])).toEqual({ status: 'empty', site: null, candidates: [], notes: [] });
  });

  it('failed: every provider that ran threw', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run([fake('a', new Error('HTTP 503')), fake('b', new Error('bad API key'))]);
    expect(r).toEqual({ status: 'failed', site: null, candidates: [], notes: ['a unavailable (HTTP 503)', 'b unavailable (bad API key)'] });
    log.mockRestore();
  });

  it('unconfigured: no provider available', async () => {
    expect(await run([fake('a', [], false)])).toEqual({ status: 'unconfigured', site: null, candidates: [], notes: [UNCONFIGURED_NOTE] });
  });

  it('the overall signal stops a hanging provider', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hang: Provider = {
      name: 'hang',
      available: () => true,
      search: (_q, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
    };
    const r = await run([hang], pages(), AbortSignal.timeout(20));
    expect(r.status).toBe('failed');
    expect(r.notes[0]).toMatch(/^hang unavailable/);
    log.mockRestore();
  });
});
