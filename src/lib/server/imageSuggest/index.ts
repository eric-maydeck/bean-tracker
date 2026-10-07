// Image Suggest: providers → candidate pages → images → ranked pick list
// (spec 2026-10-06-image-suggest-design.md "Server").
import { safeFetch, shopifyJsonUrl } from '../productFetch';
import { shopifyImages, htmlImages, shopifyDetails, htmlDetails, type PageDetails, type PageImage } from './pageImages';
import { rankImages } from './rankImages';
import { shopify } from './providers/shopify';
import { tavily } from './providers/tavily';
import type { Candidate, CandidatePage, FetchPage, Provider, SuggestQuery, SuggestResult } from './types';

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
type PageRead = { images: PageImage[]; details: PageDetails };
async function imagesOf(url: string, signal: AbortSignal, fetchPage: FetchPage): Promise<PageRead> {
  const jsonUrl = shopifyJsonUrl(new URL(url));
  if (jsonUrl) {
    try {
      const res = await fetchPage(jsonUrl, signal);
      if (res.status === 200) {
        const json = JSON.parse(res.body);
        return { images: shopifyImages(json, res.finalUrl), details: shopifyDetails(json) };
      }
    } catch {
      // not Shopify after all: read the HTML
    }
  }
  const res = await fetchPage(url, signal);
  return res.status === 200
    ? { images: htmlImages(res.body, res.finalUrl), details: htmlDetails(res.body) }
    : { images: [], details: { published: null, excerpt: null } };
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

  const candidates: Candidate[] = [];
  const seenPages = new Set<string>();
  let ran = 0;
  let failed = 0;
  for (const p of runnable) {
    if (candidates.length >= MAX_CANDIDATES) break;
    ran++;
    const pages: CandidatePage[] = [];
    try {
      for (const found of await p.search(q, signal)) {
        if (pages.length < MAX_PAGES && !seenPages.has(found.url)) pages.push(found);
      }
    } catch (err) {
      failed++;
      console.error(`image suggest: ${p.name} failed`, err);
      notes.push(`${p.name} unavailable (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    pages.forEach((x) => seenPages.add(x.url));
    const withImages = await Promise.all(
      pages.map(async (page) => ({
        page,
        ...(await imagesOf(page.url, AbortSignal.any([signal, AbortSignal.timeout(PAGE_MS)]), fetchPage).catch(
          (): PageRead => ({ images: [], details: { published: null, excerpt: null } })
        ))
      }))
    );
    // Ranked within this provider only: a later provider never displaces an earlier one's picks.
    for (const c of rankImages(withImages, q.roastDate, q.site, q.name)) {
      if (candidates.length < MAX_CANDIDATES && !candidates.some((x) => x.image === c.image)) candidates.push(c);
    }
  }
  if (failed === ran) return { status: 'failed', site: q.site, candidates: [], notes };
  // Each provider group flags its own closest; keep only the first.
  const first = candidates.findIndex((c) => c.closest);
  candidates.forEach((c, i) => (c.closest = i === first));
  return { status: candidates.length ? 'ok' : 'empty', site: q.site, candidates, notes };
}
