import { describe, expect, it, vi } from 'vitest';
import { BEANS } from './beanBase.fixtures';
import {
  beanBaseCreditUrl, beanBaseFields, beanBaseKey, compareField, fetchBeanBase, lookupBeanBase, mapRoaster, matchBean, normalizeLink
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
