import type { CoffeeRow, SubscriptionRow } from './types';
import type { Drops, Mode } from './lotus';
import type { StatusTab } from './coffeeViewState';
import { formatGrams } from './grams';
import { usd } from './money';
import { originWithFlag } from './countryFlags';

export interface Preview { title: string; description: string; image?: { src: string; alt: string } | null }

export const DESCRIPTION_MAX = 300;

// A `/…` path gets the origin, an http(s) URL is kept, anything else (data: URIs) gives no image.
export function absoluteImage(src: string, origin: string): string | null {
  if (src.startsWith('/') && !src.startsWith('//')) return origin + src;
  return /^https?:\/\//i.test(src) ? src : null;
}

export const plural = (n: number, word: string): string => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

const f1 = (n: number) => n.toFixed(1).replace(/\.0$/, '');
const join = (parts: (string | null | undefined | false)[], sep = ' · ') => parts.filter(Boolean).join(sep);

export function fitList(items: string[], sep: string, more: boolean, max = DESCRIPTION_MAX): string {
  let text = '';
  for (let k = items.length; k >= 1; k--) {
    const dropped = items.length - k;
    text = items.slice(0, k).join(sep) + (more && dropped ? `${sep}…and ${dropped} more` : '');
    if (text.length <= max) return text;
  }
  return text.length > max ? text.slice(0, max - 1) + '…' : text; // lone first item over max
}

export function coffeePreview(
  c: Pick<CoffeeRow, 'roaster' | 'coffee_name' | 'origin' | 'processing' | 'amount_g' | 'roast_date'>,
  image: { src: string; alt: string } | null
): Preview {
  const details = join([
    c.origin?.trim() && originWithFlag(c.origin.trim()),
    c.processing?.trim(),
    c.amount_g != null && formatGrams(c.amount_g),
    c.roast_date && `Roasted ${c.roast_date}`
  ]);
  return { title: c.coffee_name, description: fitList([c.roaster, details].filter(Boolean), '\n', false), image };
}

export function waterPreview(w: { mode: Mode; recipe: string; ml: number; drops: Drops; gh: number; kh: number; target?: { gh: number; kh: number } }): Preview {
  const title = w.mode === 'recipe' ? `Water: ${w.recipe}` : w.mode === 'drops' ? 'Water: Custom drops' : 'Water: Custom target';
  const d = w.drops;
  const lines = [
    'Lotus drop calculator',
    w.mode === 'target' && w.target && `Target GH ${f1(w.target.gh)} · KH ${f1(w.target.kh)} ppm`,
    `${w.ml} mL: Ca ${d.ca} · Mg ${d.mg} · Na ${d.na} · K ${d.k} drops`,
    `GH ${f1(w.gh)} · KH ${f1(w.kh)} ppm`
  ].filter(Boolean) as string[];
  return { title, description: lines.join('\n') };
}

export function onDeckPreview(view: 'open' | 'next', show: 'all' | 'caffeinated' | 'decaf', coffees: Pick<CoffeeRow, 'coffee_name' | 'roaster'>[]): Preview {
  const title = join(['On Deck: ' + (view === 'open' ? 'Currently open' : 'Next up'), show === 'caffeinated' ? 'Caffeinated' : show === 'decaf' ? 'Decaf' : null]);
  const lines = coffees.map((c, i) => `${i + 1}. ${c.coffee_name} · ${c.roaster}`);
  return { title, description: lines.length ? fitList(lines, '\n', true) : view === 'open' ? 'Nothing open right now.' : 'Backlog is empty.' };
}

export function subscriptionsPreview(
  subs: (Pick<SubscriptionRow, 'roaster_service' | 'subscription_name' | 'price' | 'bag_count' | 'amount_per_bag_g' | 'paused'> & { next_renewal_date: string | null })[]
): Preview {
  if (!subs.length) return { title: 'Subscriptions', description: 'No subscriptions.' };
  const paused = subs.filter((s) => s.paused).length;
  const lines = subs.map((s) => join([
    s.subscription_name,
    s.roaster_service,
    s.bag_count != null && s.amount_per_bag_g != null && `${s.bag_count} × ${formatGrams(s.amount_per_bag_g)}`,
    s.price != null && usd(s.price),
    s.paused ? 'Paused' : s.next_renewal_date && `Renews ${s.next_renewal_date}`
  ]));
  return { title: 'Subscriptions', description: fitList([join([plural(subs.length, 'subscription'), paused > 0 && `${paused} paused`]), ...lines], '\n', true) };
}

const STATUS_LABEL: Record<StatusTab, string> = { backlog: 'Backlog', open: 'Open', archive: 'Archive', all: 'All' };

export function coffeesPreview(v: { count: number; status: StatusTab[]; query: string; chips: string[] }): Preview {
  const q = v.query.trim();
  const line = join([plural(v.count, 'coffee'), v.status.map((s) => STATUS_LABEL[s]).join(' + '), ...v.chips, q && `“${q}”`]);
  return { title: 'Coffee Collection', description: fitList([line], '\n', true) };
}

export function statsPreview(v: { tab: 'general' | 'bq'; opened: number; unopened: number; onHandG: number; finished: number }): Preview {
  return {
    title: v.tab === 'bq' ? 'Stats: Bean Conqueror' : 'Stats: General',
    description: join([`${v.opened} open`, `${v.unopened} unopened`, `${formatGrams(v.onHandG)} on hand`, `${v.finished} finished`])
  };
}
