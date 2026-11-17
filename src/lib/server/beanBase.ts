import { formatOriginField } from '../originFormat.ts';
import { conciseProcess } from '../processGroups';
import { canonical, normalizeRoaster, type FillFields } from './productFill';

const BASE_URL = 'https://api.loffeelabs.com/api/v2';

export interface BeanBaseBean {
  id: number;
  roaster: string;
  'roast-name': string | null;
  link: string | null;
  origin: string | null;
  region: string | null;
  producer: string | null;
  variety: string | null;
  process: string | null;
  harvest: string | null;
  tasting: string | null;
  degree: string | null; // ignored: no consistent mapping to the site's roast levels
  'min-elev': number | null;
  'max-elev': number | null;
  date: string;
}

type Ctx = { roastLevels: string[]; origins: string[]; processing: string[] };
type CoffeeRef = { coffee_name: string; product_url: string | null };

export const beanBaseKey = (env: Record<string, string | undefined> = process.env): string | null =>
  env.LOFFEE_API_KEY?.trim() || null;

// ponytail: the API terms allow <= 2 req/s; a lookup makes one call, so no limiter here. The reconcile script paces itself.
export async function fetchBeanBase(path: string, key: string | null, fetcher: typeof fetch = fetch, timeoutMs = 5000): Promise<unknown> {
  if (!key) throw new Error('no Bean Base key');
  const res = await fetcher(BASE_URL + path, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`Bean Base ${res.status}`);
  return res.json();
}

const hostOf = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, '').toLowerCase() : null;
  } catch {
    return null;
  }
};

export function normalizeLink(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/collections\/[^/]+(?=\/products\/)/, '').replace(/\/+$/, '');
    return `${hostOf(url)}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function mapRoaster(siteRoaster: string, productUrl: string | null, beans: Pick<BeanBaseBean, 'roaster' | 'link'>[]): string | null {
  const n = normalizeRoaster(siteRoaster);
  const byName = n ? beans.find((b) => normalizeRoaster(b.roaster) === n) : undefined;
  if (byName) return byName.roaster;
  const host = hostOf(productUrl);
  return (host && beans.find((b) => hostOf(b.link) === host)?.roaster) || null;
}

const nameKey = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Link hits count under any roaster; the name fallback only looks at the beans passed in
// (the live lookup passes just the mapped roaster's beans).
export function matchBean(coffee: CoffeeRef, beans: BeanBaseBean[]): { bean: BeanBaseBean } | { miss: 'not-found' | 'ambiguous' } {
  if (coffee.product_url) {
    const link = normalizeLink(coffee.product_url);
    const hit = beans.find((b) => b.link && normalizeLink(b.link) === link);
    if (hit) return { bean: hit };
  }
  const name = nameKey(coffee.coffee_name);
  const hits = name ? beans.filter((b) => nameKey(b['roast-name']) === name) : [];
  return hits.length === 1 ? { bean: hits[0] } : { miss: hits.length ? 'ambiguous' : 'not-found' };
}

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/(?<=\d),(?=\d{3})/g, '').replace(/\bmasl\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

export function compareField(site: string | null, bb: string | null): 'fill' | 'same' | 'review' | 'keep' {
  const b = bb ? fold(bb) : '';
  if (!b) return 'keep';
  const s = site ? fold(site) : '';
  if (!s) return 'fill';
  if (s === b) return 'same';
  return ` ${b} `.includes(` ${s} `) ? 'review' : 'keep';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// Bean Base harvest is dirty: Excel serial, JS date string, or text. Unparseable = absent.
function harvest(v: string): string | null {
  const s = v.trim();
  if (/^\d{5}$/.test(s)) return monthYear(new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5));
  if (/GMT|^[A-Z][a-z]{2} [A-Z][a-z]{2} \d/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : monthYear(new Date(t));
  }
  return /[a-z0-9]/i.test(s) ? formatOriginField('harvest_time', s) : null;
}

export function beanBaseFields(bean: BeanBaseBean, ctx: Ctx): FillFields {
  const f: FillFields = {};
  const put = <K extends keyof FillFields>(k: K, v: FillFields[K] | null | undefined) => {
    if (v != null && v !== '') f[k] = v;
  };
  const text = (v: string | null) => v?.trim() || null;
  put('origin', text(bean.origin) && canonical(text(bean.origin)!, ctx.origins));
  put('processing', conciseProcess(text(bean.process) && canonical(text(bean.process)!, ctx.processing)));
  for (const k of ['region', 'producer', 'variety'] as const) put(k, text(bean[k]) && formatOriginField(k, text(bean[k])!));
  const lo = bean['min-elev'] || null;
  const hi = bean['max-elev'] || null;
  if (lo || hi) put('elevation', formatOriginField('elevation', `${lo && hi && lo !== hi ? `${lo}-${hi}` : (hi ?? lo)} masl`));
  put('harvest_time', bean.harvest && harvest(bean.harvest));
  put('tasting_notes', text(bean.tasting));
  return f;
}

// ponytail: no per-bean page found on loffeelabs.com (only /bean-base, /bean-base/search); credit links the site. Swap in a per-bean URL if one appears.
export const beanBaseCreditUrl = (_id: string): string => 'https://www.loffeelabs.com';

// ponytail: assumes GET /beans?roaster=<name> returns an array or { beans }, to be confirmed against the live API with the key.
export async function lookupBeanBase(
  roaster: string,
  coffee: CoffeeRef,
  ctx: Ctx,
  opts: { key?: string | null; fetcher?: typeof fetch } = {}
): Promise<{ id: string; fields: FillFields } | { miss: 'no-key' | 'roaster' | 'not-found' | 'ambiguous' | 'error' }> {
  const key = opts.key === undefined ? beanBaseKey() : opts.key;
  if (!key) return { miss: 'no-key' };
  try {
    const body = (await fetchBeanBase(`/beans?roaster=${encodeURIComponent(roaster)}`, key, opts.fetcher)) as BeanBaseBean[] | { beans: BeanBaseBean[] };
    const beans = Array.isArray(body) ? body : body.beans;
    if (!Array.isArray(beans)) return { miss: 'error' };
    const mapped = mapRoaster(roaster, coffee.product_url, beans);
    if (!mapped) return { miss: 'roaster' };
    const m = matchBean(coffee, beans.filter((b) => b.roaster === mapped));
    return 'bean' in m ? { id: String(m.bean.id), fields: beanBaseFields(m.bean, ctx) } : m;
  } catch {
    return { miss: 'error' };
  }
}
