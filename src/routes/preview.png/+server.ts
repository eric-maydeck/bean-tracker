import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cardPng, cardSvg, PHOTO_H, PHOTO_W } from '#lib/server/recaps/card.ts';
import { previewCardsOn, verifyCard } from '#lib/server/previewCard.ts';
import { imagesRoot } from '#lib/server/imageCopies.ts';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { join } from 'node:path';

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
    // A coffee's saved photo: the local copy (PHOTO_RE-checked, so a path under the images folder); gone from disk, the card without it.
    const p = card.coffee?.photo;
    const photo = p && await readFile(join(imagesRoot(), p.src.slice('/img/'.length)))
      .then((b) => sharp(b).resize(PHOTO_W, PHOTO_H, { fit: 'inside' }).png().toBuffer())
      .then((b) => ({ src: `data:image/png;base64,${b.toString('base64')}`, fill: p.fill }), () => undefined);
    png = await cardPng(await cardSvg({ ...card, coffee: card.coffee && { photo }, year: 0, cover: true, page: true }));
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(c!, png);
  }
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } });
};
