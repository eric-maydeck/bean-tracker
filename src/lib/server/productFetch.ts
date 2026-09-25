import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { parseShopifyProduct, parseHtmlProduct, type ProductData } from './productParse';

// Every message is shown verbatim under the Fill button.
export class FillError extends Error {}

export interface FetchedPage {
  status: number;
  body: string;
  finalUrl: string;
}

const MAX_REDIRECTS = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';

// NOTE: no ::ffff:0:0/96 rule — BlockList matches IPv4-mapped addresses
// against the IPv4 rules, so that subnet would block every IPv4 address.
// Mapped addresses are unwrapped explicitly in isBlockedAddress instead.
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 96], ['::1', 128], ['64:ff9b::', 96], ['2002::', 16], ['fec0::', 10],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

// ::ffff:a.b.c.d or ::ffff:XXXX:XXXX (the form the URL parser normalizes to).
function unwrapMappedIpv4(address: string): string | null {
  const m = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(address);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
}

export function isBlockedAddress(address: string): boolean {
  const v4 = unwrapMappedIpv4(address);
  if (v4) return blocked.check(v4, 'ipv4');
  const family = isIP(address);
  if (family === 0) return true;
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FillError("That doesn't look like a web address");
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FillError('Only http:// and https:// addresses can be filled from');
  }
  // Node skips the socket `lookup` hook for IP literals, so check them here.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && isBlockedAddress(host)) {
    throw new FillError('Refused: that address is private or local');
  }
  return url;
}

// Runs as the socket's DNS lookup, so the address validated is the one
// connected to (no resolve-then-fetch rebinding gap). Handles both callback
// shapes: Node calls with { all: true } when autoSelectFamily is on.
function safeLookup(
  hostname: string,
  options: LookupOptions,
  callback: (err: Error | null, address: string | LookupAddress[], family?: number) => void
): void {
  lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(new FillError(`Refused: ${hostname} points to a private or local address`), []);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

interface RawResponse {
  status: number;
  location: string | undefined;
  body: string;
}

function requestOnce(url: URL, signal: AbortSignal): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(
      url,
      {
        lookup: safeLookup as unknown as http.RequestOptions['lookup'],
        signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br'
        }
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location: res.headers.location, body: '' });
          return;
        }
        const enc = res.headers['content-encoding'];
        const stream =
          enc === 'br'
            ? res.pipe(zlib.createBrotliDecompress())
            : enc === 'gzip' || enc === 'deflate'
              ? res.pipe(zlib.createUnzip())
              : res;
        const chunks: Buffer[] = [];
        let size = 0;
        // Capped after decompression, so a compressed bomb can't slip past.
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            stream.destroy();
            reject(new FillError('That page is larger than 2 MB'));
          } else {
            chunks.push(chunk);
          }
        });
        stream.on('end', () => resolve({ status, location: undefined, body: Buffer.concat(chunks).toString('utf8') }));
        stream.on('error', reject);
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

// One timeout covers the whole redirect chain.
export async function safeFetch(rawUrl: string, signal: AbortSignal = AbortSignal.timeout(TIMEOUT_MS)): Promise<FetchedPage> {
  let url = checkUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestOnce(url, signal);
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = checkUrl(new URL(res.location, url).href);
      continue;
    }
    return { status: res.status, body: res.body, finalUrl: url.href };
  }
  throw new FillError('That page redirected too many times');
}

export function shopifyJsonUrl(url: URL): string | null {
  if (!/\/products\/[^/]+\/?$/.test(url.pathname)) return null;
  return `${url.origin}${url.pathname.replace(/(\.json)?\/?$/, '')}.json`;
}

// A malformed meta.json (wrong type, or not even an object) must not pass a
// non-string through to parseShopifyProduct, which would throw a non-FillError.
export function sanitizeShopifyMeta(meta: unknown): { name?: string; currency?: string } | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  return {
    name: typeof m.name === 'string' ? m.name : undefined,
    currency: typeof m.currency === 'string' ? m.currency : undefined
  };
}

async function fetchShopifyMeta(finalUrl: string): Promise<{ name?: string; currency?: string } | null> {
  try {
    const res = await safeFetch(new URL('/meta.json', finalUrl).href);
    return res.status === 200 ? sanitizeShopifyMeta(JSON.parse(res.body)) : null;
  } catch {
    return null;
  }
}

export async function fetchProductData(rawUrl: string): Promise<ProductData> {
  const url = checkUrl(rawUrl);
  const jsonUrl = shopifyJsonUrl(url);
  if (jsonUrl) {
    try {
      const res = await safeFetch(jsonUrl);
      if (res.status === 200) {
        return parseShopifyProduct(JSON.parse(res.body), await fetchShopifyMeta(res.finalUrl));
      }
    } catch (err) {
      // A refused address stays refused; anything else (not JSON, not
      // Shopify after all) falls through to reading the HTML page.
      if (err instanceof FillError) throw err;
    }
  }
  const res = await safeFetch(url.href);
  if (res.status !== 200) throw new FillError(`The page answered with HTTP ${res.status}`);
  const product = parseHtmlProduct(res.body);
  if (!product) throw new FillError('No product data found on that page. Is it a single product page?');
  return product;
}
