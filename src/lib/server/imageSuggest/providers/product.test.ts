import { describe, it, expect } from 'vitest';
import { product } from './product';
import type { SuggestQuery } from '../types';

const Q: SuggestQuery = { roaster: 'Lume', name: 'Kiambu', origin: null, roastDate: null, site: null };
const signal = new AbortController().signal;

describe('product provider', () => {
  it('is unavailable without a product url', () => {
    expect(product.available(Q)).toBe(false);
    expect(product.available({ ...Q, productUrl: null })).toBe(false);
  });
  it('offers the product page itself, titled with the coffee name', async () => {
    const q = { ...Q, productUrl: 'https://lume.test/products/kiambu' };
    expect(product.available(q)).toBe(true);
    expect(await product.search(q, signal)).toEqual([{ url: 'https://lume.test/products/kiambu', title: 'Kiambu', provider: 'product' }]);
  });
});
