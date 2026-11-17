import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ fetchProductData: vi.fn(), history: [] as { roaster: string; product_url: string | null }[] }));
vi.mock('$lib/server/db', () => ({ getDb: () => ({ prepare: () => ({ all: () => [] }) }) }));
vi.mock('$lib/server/coffees', () => ({ getFillHistory: () => h.history, getDistinctFieldValues: () => [] }));
vi.mock('$lib/server/roastLevels', () => ({ getRoastLevels: () => [{ roast_level: 'Light' }] }));
vi.mock('$lib/server/productFetch', async (orig) => ({ ...(await orig<object>()), fetchProductData: h.fetchProductData }));

import { POST } from './+server';
import { FillError } from '$lib/server/productFetch';

const URL_ = 'https://acme.example/products/lot-7';
const page = { title: 'Lot 7', vendor: 'Acme', siteName: null, brand: null, tags: [], description: '', attributes: { origin: 'Kenya' }, image: null, currency: 'USD', variants: [] };
const bean = { id: 9, roaster: 'Acme', 'roast-name': 'Lot 7', link: URL_, origin: 'Ethiopia', region: null, producer: 'Ana', variety: null, process: null, harvest: null, tasting: 'Peach', degree: null, 'min-elev': null, 'max-elev': null, date: '' };
const call = () => POST({ request: new Request('http://x', { method: 'POST', body: JSON.stringify({ url: URL_ }) }), locals: { isAdmin: true } } as Parameters<typeof POST>[0]);

describe('POST /api/coffees/fill-from-url with Bean Base', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.LOFFEE_API_KEY = 'k';
    h.history = [{ roaster: 'Acme', product_url: 'https://acme.example/products/other' }];
    h.fetchProductData.mockReset().mockResolvedValue(page);
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify([bean])));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    delete process.env.LOFFEE_API_KEY;
    vi.unstubAllGlobals();
  });

  it('page wins, Bean Base fills blanks and tasting notes', async () => {
    const body = await (await call()).json();
    expect(body.fields).toMatchObject({ origin: 'Kenya', producer: 'Ana', tasting_notes: 'Peach' });
    expect(body.beanBase).toEqual({ id: '9', url: expect.any(String), fields: ['producer', 'tasting_notes'] });
  });

  it.each([
    ['network error', () => fetchMock.mockRejectedValue(new Error('timeout'))],
    ['401', () => fetchMock.mockResolvedValue(new Response('no', { status: 401 }))],
    ['429', () => fetchMock.mockResolvedValue(new Response('no', { status: 429 }))],
    ['malformed JSON', () => fetchMock.mockResolvedValue(new Response('<html>'))]
  ])('Bean Base %s leaves the fill as page-only', async (_n, fail) => {
    fail();
    const body = await (await call()).json();
    expect(body.beanBase).toBeNull();
    expect(body.fields.origin).toBe('Kenya');
    expect(body.fields.tasting_notes).toBeUndefined();
  });

  it('page failure with a known roaster and a Bean Base match still answers', async () => {
    h.fetchProductData.mockRejectedValue(new FillError('nope'));
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).fields).toMatchObject({ roaster: 'Acme', origin: 'Ethiopia' });
  });

  it("page failure with no Bean Base match keeps today's error", async () => {
    h.fetchProductData.mockRejectedValue(new FillError('nope'));
    fetchMock.mockRejectedValue(new Error('down'));
    const res = await call();
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'nope' });
  });
});
