// Shopify store search on the roaster's own site (spec "Server").
import { safeFetch } from '../../productFetch';
import type { CandidatePage, FetchPage, Provider, SuggestQuery } from '../types';

type SuggestJson = { resources?: { results?: { products?: { title?: unknown; url?: unknown }[] } } };

async function query(site: string, term: string, signal: AbortSignal, fetchPage: FetchPage): Promise<CandidatePage[]> {
  const url = new URL('/search/suggest.json', site);
  url.searchParams.set('q', term);
  url.searchParams.set('resources[type]', 'product');
  try {
    const res = await fetchPage(url.href, signal);
    if (res.status !== 200) return [];
    const products = (JSON.parse(res.body) as SuggestJson).resources?.results?.products;
    return (Array.isArray(products) ? products : []).flatMap((p) => {
      if (typeof p?.url !== 'string' || typeof p.title !== 'string') return [];
      const page = new URL(p.url, res.finalUrl);
      page.search = ''; // drop Shopify's _pos/_psq tracking
      return [{ url: page.href, title: p.title, provider: 'shopify' }];
    });
  } catch {
    return []; // not Shopify, refused, timed out: nothing from this site
  }
}

export async function searchShopify(q: SuggestQuery, signal: AbortSignal, fetchPage: FetchPage = safeFetch): Promise<CandidatePage[]> {
  if (!q.site) return [];
  if (q.origin) {
    const found = await query(q.site, `${q.name} ${q.origin}`, signal, fetchPage);
    if (found.length) return found;
  }
  return query(q.site, q.name, signal, fetchPage);
}

export const shopify: Provider = {
  name: 'shopify',
  available: (q) => q.site !== null,
  search: (q, signal) => searchShopify(q, signal)
};
