export interface ProductVariant {
  id: number | null;
  label: string;
  price: number;
}

export interface ProductData {
  title: string | null;
  vendor: string | null;
  siteName: string | null;
  brand: string | null;
  tags: string[];
  description: string;
  attributes: Record<string, string>;
  image: string | null;
  currency: string | null;
  variants: ProductVariant[];
}

// ponytail: small named-entity table; unknown named entities pass through
// untouched. Add entries if a real page shows one.
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', deg: '°',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', egrave: 'è'
};

// Single pass, so "&amp;lt;" becomes "&lt;" (text), never "<".
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED[e] ?? match;
  });
}

// Tags are stripped before decoding, so an encoded "&lt;b&gt;" stays text.
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|dd|dt|td|th)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function labeledLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^([A-Za-z][A-Za-z /&]{0,30}?)\s*:\s*(\S.*)$/.exec(line);
    if (m) out[m[1].toLowerCase()] ??= m[2].trim();
  }
  return out;
}

// <tr><th>Process</th><td>Washed</td></tr> (WooCommerce attribute table) and
// <li><span>Process</span><span>Washed</span></li> (XLIII's theme).
const PAIR_ROW =
  /<(li|tr)\b[^>]*>\s*<(span|th|td|dt)\b[^>]*>([\s\S]{1,120}?)<\/\2>\s*<(span|td|dd)\b[^>]*>([\s\S]{0,400}?)<\/\4>\s*<\/\1>/gi;

function pairRows(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(PAIR_ROW)) {
    const label = htmlToText(m[3]).toLowerCase();
    const value = htmlToText(m[5]).replace(/\n/g, ', ');
    if (label && value && label.length <= 40) out[label] ??= value;
  }
  return out;
}

interface ShopifyJson {
  product?: {
    title?: string;
    vendor?: string;
    tags?: string | string[];
    body_html?: string | null;
    image?: { src?: string } | null;
    images?: { src?: string }[];
    variants?: { id?: number; title?: string; price?: string }[];
  };
}

export function parseShopifyProduct(json: unknown, meta: { name?: string; currency?: string } | null): ProductData {
  const p = (json as ShopifyJson)?.product;
  if (!p?.title) throw new Error('Not a Shopify product response');
  const bodyHtml = p.body_html ?? '';
  const description = htmlToText(bodyHtml);
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',');
  return {
    title: p.title.trim(),
    vendor: p.vendor?.trim() || null,
    siteName: meta?.name?.trim() || null,
    brand: null,
    tags: tags.map((t) => t.trim()).filter(Boolean),
    description,
    attributes: { ...labeledLines(description), ...pairRows(bodyHtml) },
    image: p.image?.src ?? p.images?.[0]?.src ?? null,
    currency: meta?.currency?.toUpperCase() ?? null,
    variants: (p.variants ?? [])
      .map((v) => ({
        id: typeof v.id === 'number' ? v.id : null,
        label: !v.title || v.title === 'Default Title' ? '' : v.title,
        price: Number(v.price)
      }))
      .filter((v) => Number.isFinite(v.price))
  };
}

function metaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (key && content) out[key] ??= decodeEntities(content[1] ?? content[2]);
  }
  return out;
}

type Ld = Record<string, unknown>;

function findLdProduct(html: string): Ld | null {
  for (const [, body] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === 'object') {
        const n = node as Ld;
        const type = n['@type'];
        if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return n;
        if (n['@graph']) stack.push(n['@graph']);
      }
    }
  }
  return null;
}

const ldString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? decodeEntities(v.trim()) : null);

function ldName(v: unknown): string | null {
  if (Array.isArray(v)) return ldName(v[0]);
  return ldString(v) ?? (v && typeof v === 'object' ? ldString((v as Ld).name) : null);
}

function ldImage(v: unknown): string | null {
  if (Array.isArray(v)) return ldImage(v[0]);
  return ldString(v) ?? (v && typeof v === 'object' ? (ldString((v as Ld).url) ?? ldString((v as Ld).contentUrl)) : null);
}

// ponytail: first offer only — multi-size JSON-LD offers aren't split into
// chips; add when a non-Shopify roaster with several sizes shows up.
function firstOffer(v: unknown): Ld | null {
  if (Array.isArray(v)) return firstOffer(v[0]);
  if (!v || typeof v !== 'object') return null;
  const o = v as Ld;
  return (o.offers ? firstOffer(o.offers) : null) ?? o;
}

export function parseHtmlProduct(html: string): ProductData | null {
  const meta = metaTags(html);
  const ld = findLdProduct(html);
  // A home/collection page has OG tags too — without a Product signal we'd
  // "fill" the shop name and logo. Refuse instead.
  if (!ld && !/product/i.test(meta['og:type'] ?? '')) return null;
  const offer = firstOffer(ld?.offers);
  const rawPrice = offer?.price ?? offer?.lowPrice ?? meta['product:price:amount'] ?? meta['og:price:amount'];
  const price = Number(String(rawPrice ?? '').replace(/,/g, ''));
  const description = htmlToText(ldString(ld?.description) ?? meta['og:description'] ?? '');
  const currency = ldString(offer?.priceCurrency) ?? meta['product:price:currency'] ?? meta['og:price:currency'] ?? null;
  return {
    title: ldString(ld?.name) ?? meta['og:title'] ?? null,
    vendor: null,
    siteName: meta['og:site_name'] ?? null,
    brand: ldName(ld?.brand),
    tags: [],
    description,
    attributes: { ...labeledLines(description), ...pairRows(html) },
    image: ldImage(ld?.image) ?? meta['og:image'] ?? null,
    currency: currency ? currency.toUpperCase() : null,
    variants: rawPrice != null && Number.isFinite(price) && price > 0 ? [{ id: null, label: '', price }] : []
  };
}
