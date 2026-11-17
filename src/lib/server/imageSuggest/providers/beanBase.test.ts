import { describe, it, expect, vi, afterEach } from 'vitest';
import { beanBase, searchBeanBasePages } from './beanBase';
import type { BeanBaseBean } from '../../beanBase';
import type { SuggestQuery } from '../types';

// Invented beans only (Bean Base data must never be stored in the repo).
const bean = (id: number, name: string, date: string, link: string | null): BeanBaseBean => ({
  id, roaster: 'Lume Coffee', 'roast-name': name, link, origin: null, region: null, producer: null, variety: null, process: null,
  harvest: null, tasting: null, degree: null, 'min-elev': null, 'max-elev': null, date, image: 'https://bb.test/never-used.jpg'
});
const BEANS = [
  bean(1, 'Kenya Kiambu', '2025-01-01', 'https://lume.test/products/kenya-kiambu'),
  bean(2, 'Huila Washed', '2025-06-01', 'https://lume.test/products/huila'),
  bean(3, 'Huila Washed Decaf', '2025-09-01', 'https://lume.test/products/huila-decaf'),
  bean(4, 'Huila Natural', '2025-12-01', null),
  bean(5, 'Other Lot', '2025-12-02', 'https://lume.test/products/other')
];
const ok = (body: unknown) => vi.fn(async (_u: unknown, _i?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));
const Q: SuggestQuery = { roaster: 'Lume Coffee', name: 'Huila Washed', origin: null, roastDate: null, site: null };

afterEach(() => vi.unstubAllEnvs());

describe('beanbase provider', () => {
  it('is unavailable without a key, without a roaster, and for gear (term set)', () => {
    vi.stubEnv('LOFFEE_API_KEY', '');
    expect(beanBase.available(Q)).toBe(false);
    vi.stubEnv('LOFFEE_API_KEY', 'k');
    expect(beanBase.available(Q)).toBe(true);
    expect(beanBase.available({ ...Q, roaster: ' ' })).toBe(false);
    expect(beanBase.available({ ...Q, term: 'dripper' })).toBe(false);
    expect(beanBase.available({ ...Q, productUrl: 'https://lume.test/p' })).toBe(false);
  });
  it('returns name-matching beans with a link, best first, as beanbase pages (never its images)', async () => {
    const pages = await searchBeanBasePages(Q, { key: 'k', fetcher: ok(BEANS) });
    expect(pages).toEqual([
      { url: 'https://lume.test/products/huila', title: 'Huila Washed', provider: 'beanbase' },
      { url: 'https://lume.test/products/huila-decaf', title: 'Huila Washed Decaf', provider: 'beanbase' }
    ]);
  });
  it('is empty on a roaster miss or no name match, and throws on a failed lookup', async () => {
    expect(await searchBeanBasePages({ ...Q, name: 'Zzz' }, { key: 'k', fetcher: ok(BEANS) })).toEqual([]);
    const miss = vi.fn(async (u: unknown) => new Response(JSON.stringify(String(u).includes('/roasters') ? ['Lume Coffee'] : []), { status: 200 }));
    expect(await searchBeanBasePages({ ...Q, roaster: 'Nope' }, { key: 'k', fetcher: miss })).toEqual([]);
    await expect(searchBeanBasePages(Q, { key: 'k', fetcher: vi.fn(async () => new Response('', { status: 500 })) })).rejects.toThrow();
  });
});
