// Image Suggest: providers → candidate pages → images → ranked pick list
// (spec 2026-10-06-image-suggest-design.md "Server").
import { safeFetch, shopifyJsonUrl } from '../productFetch';
import { shopifyImages, htmlImages, type PageImage } from './pageImages';
import { rankImages } from './rankImages';
import { shopify } from './providers/shopify';
import { tavily } from './providers/tavily';
import type { CandidatePage, FetchPage, Provider, SuggestQuery, SuggestResult } from './types';

export const DEFAULT_PROVIDERS = 'shopify,tavily';
export const UNCONFIGURED_NOTE = 'No roaster site to search and no web search key (TAVILY_API_KEY)';
const ALL: Provider[] = [shopify, tavily];
const MAX_PAGES = 5;
const MAX_CANDIDATES = 6;
const PAGE_MS = 10_000;
const TOTAL_MS = 20_000;

export function providers(list = process.env.IMAGE_SUGGEST_PROVIDERS || DEFAULT_PROVIDERS, all = ALL): Provider[] {
  const names = [...new Set(list.split(',').map((n) => n.trim().toLowerCase()))];
  return names.flatMap((n) => all.filter((p) => p.name === n));
}

// A Shopify product page via its .json (every image, with sizes), else its HTML.
async function imagesOf(url: string, signal: AbortSignal, fetchPage: FetchPage): Promise<PageImage[]> {
  const jsonUrl = shopifyJsonUrl(new URL(url));
  if (jsonUrl) {
    try {
      const res = await fetchPage(jsonUrl, signal);
      if (res.status === 200) return shopifyImages(JSON.parse(res.body), res.finalUrl);
    } catch {
      // not Shopify after all: read the HTML
    }
  }
  const res = await fetchPage(url, signal);
  return res.status === 200 ? htmlImages(res.body, res.finalUrl) : [];
}

export async function suggest(
  q: SuggestQuery,
  opts: { providers?: Provider[]; fetchPage?: FetchPage; signal?: AbortSignal } = {}
): Promise<SuggestResult> {
  const signal = opts.signal ?? AbortSignal.timeout(TOTAL_MS);
  const fetchPage = opts.fetchPage ?? safeFetch;
  const notes: string[] = [];
  const runnable = (opts.providers ?? providers()).filter((p) => {
    const a = p.available(q);
    if (typeof a === 'string') notes.push(a);
    return a === true;
  });
  if (!runnable.length) return { status: 'unconfigured', site: q.site, candidates: [], notes: notes.length ? notes : [UNCONFIGURED_NOTE] };

  const pages: CandidatePage[] = [];
  let ran = 0;
  let failed = 0;
  for (const p of runnable) {
    if (pages.length >= MAX_PAGES) break;
    ran++;
    try {
      for (const found of await p.search(q, signal)) {
        if (pages.length < MAX_PAGES && !pages.some((x) => x.url === found.url)) pages.push(found);
      }
    } catch (err) {
      failed++;
      console.error(`image suggest: ${p.name} failed`, err);
      notes.push(`${p.name} unavailable (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (failed === ran) return { status: 'failed', site: q.site, candidates: [], notes };

  const withImages = await Promise.all(
    pages.map(async (page) => ({
      page,
      images: await imagesOf(page.url, AbortSignal.any([signal, AbortSignal.timeout(PAGE_MS)]), fetchPage).catch(() => [])
    }))
  );
  const candidates = rankImages(withImages, q.roastDate, q.site).slice(0, MAX_CANDIDATES);
  return { status: candidates.length ? 'ok' : 'empty', site: q.site, candidates, notes };
}
