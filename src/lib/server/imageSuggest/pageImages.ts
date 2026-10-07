// Every image a fetched product page offers (spec "Server", pageImages.ts).
// Pure: index.ts fetches, this reads. Ranking is rankImages.ts.
import { resolveImageUrl, decodeEntities, metaTags, findLdProduct, htmlToText } from '../productParse';

export interface PageImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

const size = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

function add(out: PageImage[], raw: unknown, base: string, alt = '', width: unknown = null, height: unknown = null) {
  if (typeof raw !== 'string' || !raw.trim()) return;
  const url = resolveImageUrl(raw.trim(), base);
  if (!url || !/^https?:\/\//i.test(url) || out.some((x) => x.url === url)) return;
  out.push({ url, alt, width: size(width), height: size(height) });
}

type ShopifyImage = { src?: unknown; alt?: unknown; width?: unknown; height?: unknown };

export function shopifyImages(json: unknown, finalUrl: string): PageImage[] {
  const images = (json as { product?: { images?: ShopifyImage[] } } | null)?.product?.images;
  const out: PageImage[] = [];
  for (const i of Array.isArray(images) ? images : []) {
    add(out, i?.src, finalUrl, typeof i?.alt === 'string' ? i.alt : '', i?.width, i?.height);
  }
  return out;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decodeEntities((m[1] ?? m[2] ?? m[3]).trim()) : null;
}

export function htmlImages(html: string, finalUrl: string): PageImage[] {
  const out: PageImage[] = [];
  for (const img of [findLdProduct(html)?.image].flat()) {
    if (img && typeof img === 'object') {
      const o = img as Record<string, unknown>;
      add(out, o.url ?? o.contentUrl, finalUrl, '', o.width, o.height);
    } else add(out, img, finalUrl);
  }
  add(out, metaTags(html)['og:image'], finalUrl);
  // ponytail: src only (not the largest srcset entry) and no lazy data-src;
  // add those when a real roaster page hides its bag art behind them.
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const width = size(attr(tag, 'width'));
    const height = size(attr(tag, 'height'));
    if (attr(tag, 'srcset') == null && !(width && height && width >= 300 && height >= 300)) continue;
    add(out, attr(tag, 'src'), finalUrl, attr(tag, 'alt') ?? '', width, height);
  }
  return out;
}

export interface PageDetails {
  published: string | null;
  excerpt: string | null;
}

const MAX_EXCERPT = 300;
const NOTES_CUE = /\b(tasting|notes|flavou?r|in the cup|cup profile)/i;

// Plain text of an HTML snippet, starting at the segment with the first
// tasting-notes cue, <=300 chars, cut on a word boundary with "…".
export function excerptOf(html: unknown): string | null {
  if (typeof html !== 'string') return null;
  // htmlToText puts block ends on their own lines. Shopify meta descriptions arrive
  // with them stripped ("PanamaRegion: Volcan"), so a capital label glued to a word
  // starts a new line too.
  // ponytail: heuristic, also splits a camelCase word right before a colon.
  let text = htmlToText(html).replace(/([a-z\d.])(?=[A-Z][a-z]+(?: [a-z]+){0,3}:)/g, '$1\n');
  const cue = text.search(NOTES_CUE);
  if (cue > 0) {
    const cuts = [...text.slice(0, cue).matchAll(/\n|[.!?]\s/g)];
    const last = cuts.at(-1);
    if (last) text = text.slice(last.index + last[0].length);
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_EXCERPT) return text || null;
  return text.slice(0, MAX_EXCERPT - 1).replace(/\s+\S*$/, '') + '…';
}

// The first 10 chars of an ISO-ish timestamp, when they form a real date.
function isoDate(v: unknown): string | null {
  const d = typeof v === 'string' ? v.trim().slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null;
}

export function shopifyDetails(json: unknown): PageDetails {
  const p = (json as { product?: { published_at?: unknown; created_at?: unknown; body_html?: unknown } } | null)?.product;
  return { published: isoDate(p?.published_at) ?? isoDate(p?.created_at), excerpt: excerptOf(p?.body_html) };
}

// First datePublished/releaseDate on any JSON-LD node (often the WebPage, not the Product).
function ldDate(html: string): string | null {
  for (const [, body] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const n = stack.shift();
      if (Array.isArray(n)) stack.push(...n);
      else if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        const d = isoDate(o.datePublished) ?? isoDate(o.releaseDate);
        if (d) return d;
        stack.push(...Object.values(o).filter((v) => v && typeof v === 'object'));
      }
    }
  }
  return null;
}

export function htmlDetails(html: string): PageDetails {
  const meta = metaTags(html);
  const ldDesc = findLdProduct(html)?.description;
  return {
    published: ldDate(html) ?? isoDate(meta['article:published_time']),
    excerpt: excerptOf(ldDesc) ?? excerptOf(meta['og:description']) ?? excerptOf(meta['description'])
  };
}
