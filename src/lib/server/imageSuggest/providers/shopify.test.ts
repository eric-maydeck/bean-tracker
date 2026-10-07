import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { searchShopify, shopify } from './shopify';
import { FillError } from '../../productFetch';
import type { SuggestQuery } from '../types';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/product-pages/${name}`, import.meta.url), 'utf8');
const Q: SuggestQuery = { roaster: 'Anamorphic', name: 'Bnivaans', origin: 'Kenya', roastDate: null, site: 'https://anamorphiccoffee.com' };
const signal = new AbortController().signal;
// Captured replies by search term: "Bnivaans Kenya" finds nothing, "Bnivaans" finds two.
const fetchPage = vi.fn(async (url: string) => {
  const q = new URL(url).searchParams.get('q');
  return { status: 200, body: fixture(q === 'Bnivaans' ? 'anamorphic-suggest.json' : 'anamorphic-suggest-empty.json'), finalUrl: url };
});

describe('searchShopify', () => {
  it('queries the store’s suggest.json, retries with the bare name, returns clean page URLs', async () => {
    const pages = await searchShopify(Q, signal, fetchPage);
    const urls = fetchPage.mock.calls.map(([u]) => new URL(u));
    expect(urls.map((u) => [u.origin + u.pathname, u.searchParams.get('q'), u.searchParams.get('resources[type]')])).toEqual([
      ['https://anamorphiccoffee.com/search/suggest.json', 'Bnivaans Kenya', 'product'],
      ['https://anamorphiccoffee.com/search/suggest.json', 'Bnivaans', 'product']
    ]);
    expect(pages).toEqual([
      { url: 'https://anamorphiccoffee.com/products/bnivaans-aa', title: 'Bnivaans AA', provider: 'shopify' },
      { url: 'https://anamorphiccoffee.com/products/bnivaans-pb', title: 'Bnivaans PB', provider: 'shopify' }
    ]);
  });

  it('one query when there is no origin', async () => {
    const f = vi.fn(fetchPage);
    await searchShopify({ ...Q, origin: null }, signal, f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('a non-Shopify site (captured Wix 404) gives nothing', async () => {
    const f = vi.fn(async (url: string) => ({ status: 404, body: fixture('picky-chemist-suggest-404.html'), finalUrl: url }));
    expect(await searchShopify({ ...Q, site: 'https://en.thepickychemist.com' }, signal, f)).toEqual([]);
  });

  it('a refused or failing site gives nothing instead of throwing', async () => {
    const f = vi.fn(async () => {
      throw new FillError('Refused: that address is private or local');
    });
    expect(await searchShopify(Q, signal, f)).toEqual([]);
  });

  it('is unavailable without a site', () => {
    expect(shopify.available({ ...Q, site: null })).toBe(false);
    expect(shopify.available(Q)).toBe(true);
  });
});
