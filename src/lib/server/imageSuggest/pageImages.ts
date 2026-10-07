// Every image a fetched product page offers (spec "Server", pageImages.ts).
// Pure: index.ts fetches, this reads. Ranking is rankImages.ts.
import { resolveImageUrl, decodeEntities, metaTags, findLdProduct } from '../productParse';

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
