import { formatOriginField } from '../originFormat.ts';
import { conciseProcess } from '../processGroups';
import { words } from './imageSuggest/rankImages';
import { canonical, normalizeRoaster, type FillFields } from './productFill';

// /beans lists only a roaster's current beans unless historical=true; both callers share this (limit 1000 is the plan cap).
const ALL_BEANS = '&limit=1000&historical=true';
// The docs say api.loffeelabs.com, but that host doesn't resolve (checked 2026-11-17); the API is served from www.
const BASE_URL = 'https://www.loffeelabs.com/api/v2';

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
  image?: string | null;
  soldout?: boolean | number | string | null;
  available?: boolean | number | string | null;
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
  if (!res.ok) throw new Error(`Bean Base ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`.trim());
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
    const body = (await fetchBeanBase(`/beans?roaster=${encodeURIComponent(roaster)}${ALL_BEANS}`, key, opts.fetcher)) as BeanBaseBean[] | { data?: BeanBaseBean[]; beans?: BeanBaseBean[] };
    const beans = Array.isArray(body) ? body : (body.data ?? body.beans);
    if (!Array.isArray(beans)) return { miss: 'error' };
    const mapped = mapRoaster(roaster, coffee.product_url, beans);
    if (!mapped) return { miss: 'roaster' };
    const m = matchBean(coffee, beans.filter((b) => b.roaster === mapped));
    return 'bean' in m ? { id: String(m.bean.id), fields: beanBaseFields(m.bean, ctx) } : m;
  } catch {
    return { miss: 'error' };
  }
}

export type BeanCard = {
  id: string; name: string; image: string | null; soldout: boolean; date: string; link: string | null; closest: boolean; fields: FillFields;
};
export type BeanSearch =
  | { status: 'no-key' | 'failed' }
  | { status: 'roaster'; closest: string[] }
  | { status: 'ok'; roaster: string; beans: BeanCard[]; fallback?: boolean };

// ponytail: shared words, then containment/prefix, then edit distance. A one-word typo that shares no word
// with the real name ranks by edit distance alone; upgrade to trigram similarity if misses show up.
function closestRoasters(typed: string, names: string[], n = 5): string[] {
  const t = normalizeRoaster(typed);
  const tw = new Set(t.split(' ').filter(Boolean));
  const edit = (a: string, b: string) => {
    let row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row = next;
    }
    return row[b.length];
  };
  const score = (name: string) => {
    const k = normalizeRoaster(name);
    const shared = k.split(' ').filter((w) => tw.has(w)).length;
    const near = t && k && (k.includes(t) || t.includes(k) || k.startsWith(t.slice(0, 3))) ? 1 : 0;
    return [shared, near, -edit(t, k)];
  };
  return [...new Set(names)]
    .map((name) => ({ name, s: score(name) }))
    .filter((x) => x.s[0] > 0 || x.s[1] > 0 || -x.s[2] <= Math.max(2, Math.floor(t.length / 3)))
    .sort((a, b) => b.s[0] - a.s[0] || b.s[1] - a.s[1] || b.s[2] - a.s[2] || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((x) => x.name);
}

// ponytail: image/soldout types are undocumented; a truthy soldout counts as sold out. limit 1000 is the
// Developer plan's cap, enough for one roaster's whole list; no paging.
type SearchOpts = { key?: string | null; fetcher?: typeof fetch; roastDate?: string | null; productUrl?: string | null };
type Ranked = { b: BeanBaseBean; match: number; days: number };

// Logs only the response's top-level keys (never bean data or the key), so a changed API shape shows in the server log.
function shapeFail(path: string, got: unknown): { status: 'failed' } {
  console.error(`bean base search: unexpected ${path} response`, got && typeof got === 'object' ? Object.keys(got).slice(0, 10) : typeof got);
  return { status: 'failed' };
}

// The roaster's beans in image Suggest's order: product link, exact name, coffee-name words,
// nearest the roast date (undated last), newest. Shared by the search dialog and the image provider.
export async function rankedBeans(
  roaster: string,
  coffeeName: string,
  opts: SearchOpts = {}
): Promise<{ status: 'no-key' | 'failed' } | { status: 'roaster'; closest: string[] } | { status: 'ok'; roaster: string; ranked: Ranked[]; fallback?: boolean }> {
  const key = opts.key === undefined ? beanBaseKey() : opts.key;
  if (!key) return { status: 'no-key' };
  try {
    const list = (body: unknown, k: string) => (Array.isArray(body) ? body : (body as Record<string, unknown> | null)?.data ?? (body as Record<string, unknown> | null)?.[k]);
    // ponytail: fetchBeanBase builds its own timeout signal, so a caller's abort signal isn't passed through.
    const getBeans = async (extra: string) => {
      const body = await fetchBeanBase(`/beans?roaster=${encodeURIComponent(roaster)}${extra}${ALL_BEANS}`, key, opts.fetcher);
      return { body, beans: list(body, 'beans') as BeanBaseBean[] };
    };
    // The coffee name goes to the API's full-text search; none found (or no name) falls back to the roaster's whole list.
    const term = coffeeName.trim();
    let fallback = false;
    let got = term ? await getBeans(`&search=${encodeURIComponent(term)}`) : null;
    if (got && !Array.isArray(got.beans)) return shapeFail('/beans', got.body);
    if (got && !mapRoaster(roaster, null, got.beans)) [got, fallback] = [null, true];
    got ??= await getBeans('');
    const { body, beans } = got;
    if (!Array.isArray(beans)) return shapeFail('/beans', body);
    const mapped = mapRoaster(roaster, null, beans);
    if (!mapped) {
      const rBody = await fetchBeanBase('/roasters?flat=true', key, opts.fetcher);
      const names = list(rBody, 'roasters');
      if (!Array.isArray(names)) return shapeFail('/roasters', rBody);
      return { status: 'roaster', closest: closestRoasters(roaster, names.filter((x): x is string => typeof x === 'string')) };
    }
    const nameWords = [...new Set(words(coffeeName))];
    const nameKeyTyped = nameKey(coffeeName);
    const link = opts.productUrl ? normalizeLink(opts.productUrl) : null;
    const roastMs = opts.roastDate ? Date.parse(opts.roastDate) : NaN;
    const scored = beans
      .filter((b) => b.roaster === mapped)
      .map((b) => {
        const t = new Set(words(b['roast-name'] ?? ''));
        const ms = Date.parse(b.date);
        return {
          b,
          link: link && b.link && normalizeLink(b.link) === link ? 1 : 0,
          exact: nameKeyTyped && nameKey(b['roast-name']) === nameKeyTyped ? 1 : 0,
          match: nameWords.filter((w) => t.has(w)).length,
          days: Number.isNaN(ms) || Number.isNaN(roastMs) ? Infinity : Math.abs(ms - roastMs),
          ms: Number.isNaN(ms) ? 0 : ms
        };
      })
      .sort((a, b) => b.link - a.link || b.exact - a.exact || b.match - a.match || (a.days === b.days ? 0 : a.days < b.days ? -1 : 1) || b.ms - a.ms);
    return { status: 'ok', roaster: mapped, ranked: scored, ...(fallback && { fallback }) };
  } catch (err) {
    console.error('bean base search failed:', err instanceof Error ? err.message : String(err));
    return { status: 'failed' };
  }
}

export async function searchBeanBase(roaster: string, coffeeName: string, ctx: Ctx, opts: SearchOpts = {}): Promise<BeanSearch> {
  const r = await rankedBeans(roaster, coffeeName, opts);
  if (r.status !== 'ok') return r;
  // closest: the one bean dated nearest the roast date (ties: earlier in the list), as in image Suggest.
  let best = -1;
  let bestDays = Infinity;
  r.ranked.forEach((x, i) => {
    if (x.days < bestDays) [best, bestDays] = [i, x.days];
  });
  const beans = r.ranked.map(({ b }, i): BeanCard => ({
    id: String(b.id), name: b['roast-name']?.trim() || 'Unnamed', image: b.image?.trim() || null, soldout: !!b.soldout,
    date: b.date, link: b.link, closest: i === best, fields: beanBaseFields(b, ctx)
  }));
  return { status: 'ok', roaster: r.roaster, beans, ...(r.fallback && { fallback: true }) };
}
