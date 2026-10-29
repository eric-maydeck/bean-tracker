import type { CoffeeRow, SubscriptionRow } from './types';
import type { Drops, Mode } from './lotus';
import type { StatusTab } from './coffeeViewState';
import { formatBag, formatGrams } from './grams';
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
  c: Pick<CoffeeRow, 'roaster' | 'coffee_name' | 'origin' | 'processing' | 'amount_g' | 'roast_date' | 'grams_left'>,
  image: { src: string; alt: string } | null
): Preview {
  const details = join([
    c.origin?.trim() && originWithFlag(c.origin.trim()),
    c.processing?.trim(),
    c.amount_g != null && formatBag(c.amount_g, c.grams_left != null && c.grams_left < c.amount_g ? c.grams_left : null),
    c.roast_date && `Roasted ${c.roast_date}`
  ]);
  return { title: c.coffee_name, description: fitList([c.roaster, details].filter(Boolean), '\n', false), image };
}

export function waterPreview(w: { mode: Mode; recipe: string; ml: number; drops: Drops; gh: number; kh: number; target?: { gh: number; kh: number }; idealMl?: number }): Preview {
  const title = w.mode === 'recipe' ? `Water: ${w.recipe}` : w.mode === 'drops' ? 'Water: Custom drops' : 'Water: Custom target';
  const d = w.drops;
  const drops = (n: number) => `${n} drop${n === 1 ? '' : 's'}`;
  // What each value is aiming for, after it: the recipe's (its ideal mL, `idealMl`) or the typed-in target.
  const word = w.mode === 'recipe' ? 'recipe' : 'target';
  const aim = (n: number | undefined, unit: string) => (w.mode !== 'drops' && n != null ? ` (${word} ${f1(n)} ${unit})` : '');
  const lines = [
    'Lotus drop calculator',
    `Water: ${w.ml} mL${w.mode === 'recipe' ? aim(w.idealMl, 'mL') : ''}`,
    `Ca: ${drops(d.ca)}`, `Mg: ${drops(d.mg)}`, `Na: ${drops(d.na)}`, `K: ${drops(d.k)}`,
    `GH: ${f1(w.gh)} ppm${aim(w.target?.gh, 'ppm')}`, `KH: ${f1(w.kh)} ppm${aim(w.target?.kh, 'ppm')}`
  ];
  return { title, description: lines.join('\n') };
}

export function onDeckPreview(view: 'open' | 'next', show: 'all' | 'caffeinated' | 'decaf', coffees: Pick<CoffeeRow, 'coffee_name' | 'roaster'>[]): Preview {
  const title = join(['On Deck: ' + (view === 'open' ? 'Currently open' : 'Next up'), show === 'caffeinated' ? 'Caffeinated' : show === 'decaf' ? 'Decaf' : null]);
  const lines = coffees.map((c, i) => `${i + 1}. ${c.roaster} · ${c.coffee_name}`);
  return { title, description: lines.length ? fitList(lines, '\n', true) : view === 'open' ? 'Nothing open right now.' : 'Backlog is empty.' };
}

// One recipe's link preview: its pours and ratio, then how many brews matched and their average rating. No notes.
export function recipePreview(r: { name: string; description: string; n: number; avgRating: number | null; brewTime?: string | null }): Preview {
  const stats = join([plural(r.n, 'brew'), r.avgRating != null && `avg ${f1(r.avgRating)}`, r.brewTime && `brews took ${r.brewTime}`]);
  return { title: r.name, description: fitList([r.description, stats].filter(Boolean), '\n', false) };
}

export function recipesPreview(names: string[]): Preview {
  if (!names.length) return { title: 'Recipes', description: 'No saved recipes.' };
  return { title: 'Recipes', description: fitList([plural(names.length, 'recipe'), ...names], '\n', true) };
}

export function subscriptionsPreview(subs: Pick<SubscriptionRow, 'roaster_service' | 'subscription_name'>[]): Preview {
  if (!subs.length) return { title: 'Subscriptions', description: 'No subscriptions.' };
  const lines = subs.map((s) => join([s.roaster_service, s.subscription_name]));
  return { title: 'Subscriptions', description: fitList([plural(subs.length, 'subscription'), ...lines], '\n', true) };
}

const STATUS_LABEL: Record<StatusTab, string> = { backlog: 'Backlog', open: 'Open', archive: 'Archive', all: 'All' };

export function coffeesPreview(v: { count: number; grams: number; status: StatusTab[]; query: string; chips: string[] }): Preview {
  const q = v.query.trim();
  const lines = [v.status.map((s) => STATUS_LABEL[s]).join(' + '), join([...v.chips, q && `“${q}”`]), join([plural(v.count, 'coffee'), formatGrams(v.grams)])];
  return { title: 'Coffee Collection', description: fitList(lines.filter(Boolean), '\n', false) };
}

// ponytail: a per-host constant until multi-user; then the page owner's username / public name, per their preference.
export const ownerName = (host: string): string => (host.split(':')[0] === 'coffee.maydeck.net' ? 'Eric' : 'fuhnoo');

export function statsPreview(v: { tab: 'general' | 'bq'; owner: string; opened: number; unopened: number; onHandG: number; finished: number }): Preview {
  const numbers = join([`${v.opened} open`, `${v.unopened} unopened`, `${formatGrams(v.onHandG)} on hand`, `${v.finished} finished`]);
  return v.tab === 'bq'
    ? { title: 'Stats: Bean Conqueror', description: `${v.owner}'s Bean Conqueror stats\n${numbers}` }
    : { title: 'Stats: General', description: `${v.owner}'s collection totals\n${numbers}` };
}
