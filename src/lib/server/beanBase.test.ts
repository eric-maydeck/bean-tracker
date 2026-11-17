import { describe, expect, it, vi } from 'vitest';
import { BEANS } from './beanBase.fixtures';
import {
  type BeanBaseBean, beanBaseCreditUrl, beanBaseFields, searchBeanBase, beanBaseKey, compareField, fetchBeanBase, lookupBeanBase, mapRoaster, matchBean, normalizeLink
} from './beanBase';

const ctx = { roastLevels: ['Light'], origins: ['Colombia'], processing: ['Washed'] };
const ok = (body: unknown) => vi.fn(async (_u: unknown, _i?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));

describe('normalizeLink', () => {
  it('folds variants, collection paths, scheme, www and trailing slash', () => {
    const a = normalizeLink('https://www.r.com/collections/all/products/x?variant=1');
    expect(a).toBe(normalizeLink('http://r.com/products/x/'));
    expect(a).toBe('r.com/products/x');
  });
});

describe('mapRoaster', () => {
  it('maps by normalised name, then by product host, else null', () => {
    expect(mapRoaster('Example Roasters Co.', null, BEANS)).toBe('Example Roasters');
    expect(mapRoaster('Unknown', 'https://www.fake.example.org/products/z', BEANS)).toBe('Fake Bean Co');
    expect(mapRoaster('Unknown', 'https://nope.test/p', BEANS)).toBeNull();
    expect(mapRoaster('Unknown', null, BEANS)).toBeNull();
  });
});

describe('matchBean', () => {
  it('link match wins, even under another roaster', () => {
    const r = matchBean({ coffee_name: 'Collab Lot', product_url: 'https://example.com/collections/x/products/huila-washed?v=2' }, BEANS);
    expect(r).toEqual({ bean: BEANS[0] });
    expect(matchBean({ coffee_name: 'x', product_url: 'https://example.com/products/collab-lot' }, BEANS)).toEqual({ bean: BEANS[4] });
  });
  it('name fallback needs exactly one hit', () => {
    expect(matchBean({ coffee_name: 'kenya  kiambu', product_url: null }, BEANS)).toEqual({ bean: BEANS[1] });
    expect(matchBean({ coffee_name: 'Twin', product_url: null }, BEANS)).toEqual({ miss: 'ambiguous' });
    expect(matchBean({ coffee_name: 'Nothing', product_url: null }, BEANS)).toEqual({ miss: 'not-found' });
  });
});

describe('beanBaseFields', () => {
  it('maps the observed shape', () => {
    expect(beanBaseFields(BEANS[0], ctx)).toEqual({
      origin: 'Colombia', processing: 'Washed', region: 'Acevedo, Huila', producer: 'Juan Pena', variety: 'Caturra',
      elevation: '1,700-1,900 masl', harvest_time: 'December 2025', tasting_notes: 'Peach, Jasmine, Honey'
    });
  });
  it('single elevation, JS-date harvest, no roast_level, blanks absent', () => {
    const f = beanBaseFields(BEANS[1], ctx);
    expect(f.elevation).toBe('1,800 masl');
    expect(f.harvest_time).toBe('January 2025');
    expect(f).not.toHaveProperty('roast_level');
    expect(f).not.toHaveProperty('producer');
  });
  it('keeps plain harvest text, drops garbage', () => {
    expect(beanBaseFields(BEANS[2], ctx).harvest_time).toBe('March 2025');
    expect(beanBaseFields(BEANS[3], ctx)).not.toHaveProperty('harvest_time');
  });
});

describe('compareField', () => {
  it.each([
    [null, 'Huila', 'fill'],
    ['Juan Peña', 'Juan Pena', 'same'],
    ['1800', '1,800 masl', 'same'],
    ['Bourbon', 'Yellow Bourbon', 'review'],
    ['Acevedo, Huila', 'Huila', 'keep'],
    ['x', null, 'keep']
  ] as const)('%s vs %s -> %s', (s, b, want) => expect(compareField(s, b)).toBe(want));
});

describe('lookupBeanBase', () => {
  const coffee = { coffee_name: 'Huila Washed', product_url: 'https://example.com/products/huila-washed' };
  it('no key: no fetch', async () => {
    const fetcher = vi.fn();
    expect(await lookupBeanBase('Example Roasters', coffee, ctx, { key: null, fetcher })).toEqual({ miss: 'no-key' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('error never throws', async () => {
    const fetcher = vi.fn(async () => { throw new Error('boom'); });
    expect(await lookupBeanBase('Example Roasters', coffee, ctx, { key: 'k', fetcher })).toEqual({ miss: 'error' });
    const bad = vi.fn(async () => new Response('nope', { status: 200 }));
    expect(await lookupBeanBase('Example Roasters', coffee, ctx, { key: 'k', fetcher: bad })).toEqual({ miss: 'error' });
  });
  it('sends Bearer key and returns id string and fields', async () => {
    const fetcher = ok({ beans: BEANS });
    const r = await lookupBeanBase('Example Roasters', coffee, ctx, { key: 'secret', fetcher });
    expect(r).toMatchObject({ id: '101', fields: { origin: 'Colombia' } });
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
  });
  it('unmapped roaster and not-found', async () => {
    expect(await lookupBeanBase('Zzz', { coffee_name: 'a', product_url: null }, ctx, { key: 'k', fetcher: ok({ beans: BEANS }) })).toEqual({ miss: 'roaster' });
    expect(await lookupBeanBase('Example Roasters', { coffee_name: 'a', product_url: null }, ctx, { key: 'k', fetcher: ok({ beans: BEANS }) })).toEqual({ miss: 'not-found' });
  });
});

describe('misc', () => {
  it('key and fetch errors', async () => {
    expect(beanBaseKey({ LOFFEE_API_KEY: 'k' })).toBe('k');
    expect(beanBaseKey({})).toBeNull();
    await expect(fetchBeanBase('/x', null)).rejects.toThrow();
    await expect(fetchBeanBase('/x', 'k', vi.fn(async () => new Response('', { status: 429 })))).rejects.toThrow();
  });
  it('credit url', () => expect(beanBaseCreditUrl('101')).toBe('https://www.loffeelabs.com'));
});

describe('searchBeanBase', () => {
  const mk = (id: number, name: string, date: string, extra: Partial<BeanBaseBean> = {}): BeanBaseBean => ({
    ...BEANS[0], id, 'roast-name': name, date, link: null, ...extra
  });
  const lume = [
    mk(1, 'Kenya Kiambu', '2025-01-01'),
    mk(2, 'Huila Washed', '2025-06-01', { image: 'https://img.test/a.jpg', soldout: true }),
    mk(3, 'Huila Washed Decaf', '2025-03-01'),
    mk(4, 'Ethiopia Huila Blend', '2025-09-01'),
    mk(5, 'Other', '2025-12-01')
  ].map((b) => ({ ...b, roaster: 'Lume Coffee' }));
  const router = (beans: unknown, roasters: unknown) =>
    vi.fn(async (u: unknown) => new Response(JSON.stringify(String(u).includes('/roasters') ? roasters : beans), { status: 200 }));

  it('no key and failures', async () => {
    expect(await searchBeanBase('Lume', 'x', ctx, { key: null })).toEqual({ status: 'no-key' });
    const bad = vi.fn(async () => new Response('', { status: 500 }));
    expect(await searchBeanBase('Lume', 'x', ctx, { key: 'k', fetcher: bad })).toEqual({ status: 'failed' });
    expect(await searchBeanBase('Lume', 'x', ctx, { key: 'k', fetcher: ok({ nope: 1 }) })).toEqual({ status: 'failed' });
  });
  it('roaster miss returns the closest names, best first, max 5', async () => {
    const names = ['Lume Coffee', 'Zebra Roasters', 'Lumen Brew', 'Big Sur Coffee', 'Sur Roasters', 'Big Sun', 'Big Sur Roasters', 'Big Sir'];
    const r = await searchBeanBase('Big Sur', 'x', ctx, { key: 'k', fetcher: router([], { roasters: names }) });
    expect(r).toMatchObject({ status: 'roaster' });
    const closest = (r as { closest: string[] }).closest;
    expect(closest.length).toBeLessThanOrEqual(5);
    expect(closest.slice(0, 2).sort()).toEqual(['Big Sur Coffee', 'Big Sur Roasters']);
    expect(closest).not.toContain('Zebra Roasters');
  });
  it('orders name matches first (exact, containing, shared word), then newest', async () => {
    const r = await searchBeanBase('lume coffee', 'Huila Washed', ctx, { key: 'k', fetcher: router(lume, []) });
    expect(r).toMatchObject({ status: 'ok', roaster: 'Lume Coffee' });
    const beans = (r as { beans: { id: string; image: string | null; soldout: boolean }[] }).beans;
    expect(beans.map((b) => b.id)).toEqual(['2', '3', '4', '5', '1']);
    expect(beans[0]).toMatchObject({ image: 'https://img.test/a.jpg', soldout: true });
    expect(beans[1]).toMatchObject({ image: null, soldout: false });
  });
  it('blank name lists all, newest first, with the fill fields', async () => {
    const r = await searchBeanBase('Lume Coffee', '  ', ctx, { key: 'k', fetcher: router(lume, []) });
    expect((r as { beans: { id: string }[] }).beans.map((b) => b.id)).toEqual(['5', '4', '2', '3', '1']);
    expect((r as { beans: { fields: unknown }[] }).beans[0].fields).toEqual(beanBaseFields(lume[4], ctx));
  });
});
