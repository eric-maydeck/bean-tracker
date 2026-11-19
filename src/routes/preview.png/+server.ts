import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cardPng, cardSvg } from '#lib/server/recaps/card.ts';
import { previewCardsOn, verifyCard } from '#lib/server/previewCard.ts';

// The link-preview image for pages that pass none (PreviewMeta): the page's own text, signed into the URL.
// ponytail: in-memory cache capped at 200 cards; move to the recap file cache if crawler traffic grows.
const cache = new Map<string, Buffer>();

export const GET: RequestHandler = async ({ url }) => {
  if (!previewCardsOn()) error(404, 'Not found');
  const c = url.searchParams.get('c');
  const card = verifyCard(c, url.searchParams.get('s'));
  if (!card) error(404, 'Not found');
  let png = cache.get(c!);
  if (!png) {
    png = await cardPng(await cardSvg({ ...card, year: 0, tone: 'brown', cover: true, page: true }));
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(c!, png);
  }
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
};
