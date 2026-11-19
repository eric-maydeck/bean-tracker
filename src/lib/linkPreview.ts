import type { CoffeeRow, SubscriptionRow } from './types';
import { TIP_LABEL, type Drops, type Mode, type Tip } from './lotus';
import type { StatusTab } from './coffeeViewState';
import { formatBag, formatGrams } from './grams';
import { originWithFlag } from './countryFlags';
import { glue, unitGap } from './unitGap';
import { KINDS, type ChartTimeline } from './pourShapes';
import type { Recap } from './server/recaps/recap';

// `card`: the text of the default image card (/preview.png) when there's no image; else derived from the title.
// `thumb`: a small picture of a Stats view under the title (server/recaps/card.ts): top-5 bars (label, value, 0..1 length;
// `plain`: no medals, as Lowest first), one record tile (value, holder, date line), or a grid of up to 6 tiles (label, value).
export type Thumb =
  | { kind: 'bars'; rows: [string, string, number][]; plain?: boolean }
  | { kind: 'tile'; value: string; holder: string; date?: string }
  | { kind: 'grid'; tiles: [string, string][] };
// `coffee`: a coffee's card layout (name from the top, roaster at the bottom), with its saved photo on the right when there is one
// (a local /img/ copy only, never a remote URL) on its backdrop fill.
export interface Card { big: string; label: string; timeline?: ChartTimeline; thumb?: Thumb; coffee?: { photo?: { src: string; fill: string } } }
export const PHOTO_RE = /^\/img\/(coffees|roasters)\/[0-9a-f]{64}\.webp$/;
export interface Preview { title: string; description: string; image?: { src: string; alt: string } | null; card?: Card }

// "Stats: Roasters" -> big "Roasters", label "Stats"; a title without "Page: " is big alone.
export function previewCard(p: Preview): Card {
  if (p.card) return p.card;
  const i = p.title.indexOf(': ');
  return i < 0 ? { big: p.title, label: '' } : { big: p.title.slice(i + 2), label: p.title.slice(0, i) };
}

// base64url of [big, label, timeline?, thumb?, coffee? ([] or [photo src, fill])] (UTF-8; a missing field before a present one is null): no characters that need escaping in a URL or an HTML attribute. The server signs
// it (server/previewCard.ts). The timeline is compact: pours [startS, durationS, grams, kind index], swirls, totalS, windows [startS, targetS, bloom].
const r1 = (n: number) => Math.round(n * 10) / 10;
const wire = (t: ChartTimeline) => [
  t.pours.map((p) => [r1(p.startS), r1(p.durationS), r1(p.grams), KINDS.indexOf(p.kind)]),
  t.swirls.map(r1), r1(t.totalS), (t.windows ?? []).map((w) => [r1(w.startS), r1(w.targetS), w.bloom])
];
const wireThumb = (t: Thumb) => t.kind === 'bars' ? ['bars', t.rows.map(([l, v, f]) => [l, v, Math.round(f * 1000) / 1000]), t.plain ? 1 : 0]
  : t.kind === 'tile' ? ['tile', t.value, t.holder, t.date ?? ''] : ['grid', t.tiles];
export function encodeCard(c: Card): string {
  const a = [c.big, c.label, c.timeline?.pours.length ? wire(c.timeline) : null, c.thumb ? wireThumb(c.thumb) : null, c.coffee ? (c.coffee.photo ? [c.coffee.photo.src, c.coffee.photo.fill] : []) : null];
  while (a.at(-1) === null) a.pop();
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(a)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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
  image: { src: string; alt: string; fill?: string } | null,
  cards = false
): Preview {
  const details = join([
    c.origin?.trim() && originWithFlag(c.origin.trim()),
    c.processing?.trim(),
    c.amount_g != null && formatBag(c.amount_g, c.grams_left != null && c.grams_left < c.amount_g ? c.grams_left : null),
    c.roast_date && `Roasted ${c.roast_date}`
  ]);
  const card: Card = { big: c.coffee_name, label: c.roaster ?? '' };
  // PREVIEW_CARDS on: always the coffee card (no bare photo), with the saved photo when there's a local copy.
  if (cards) card.coffee = image?.fill && PHOTO_RE.test(image.src) ? { photo: { src: image.src, fill: image.fill } } : {};
  return { title: c.coffee_name, description: fitList([c.roaster, details].filter(Boolean), '\n', false), image: cards ? null : image, card };
}

export function waterPreview(w: { mode: Mode; tip: Tip; recipe: string; ml: number; drops: Drops; gh: number; kh: number; target?: { gh: number; kh: number }; idealMl?: number[] }): Preview {
  const title = w.mode === 'recipe' ? `Water: ${w.recipe}` : w.mode === 'drops' ? 'Water: Custom drops' : 'Water: Custom target';
  const d = w.drops;
  const drops = (n: number) => `${n} drop${n === 1 ? '' : 's'}`;
  // What each value is aiming for, after it: the recipe's (its ideal mLs, `idealMl`) or the typed-in target.
  const word = w.mode === 'recipe' ? 'recipe' : 'target';
  const aim = (n: number | undefined, unit: string) => (w.mode !== 'drops' && n != null ? ` (${word} ${f1(n)}${unit})` : '');
  const lines = [
    'Lotus drop calculator',
    `Water: ${w.ml}mL${w.mode === 'recipe' && w.idealMl ? ` (recipe ${w.idealMl.join('mL or ')}mL)` : ''}`,
    `Dropper: ${TIP_LABEL[w.tip]}`,
    `Ca: ${drops(d.ca)}`, `Mg: ${drops(d.mg)}`, `Na: ${drops(d.na)}`, `K: ${drops(d.k)}`,
    `GH: ${f1(w.gh)}ppm${aim(w.target?.gh, 'ppm')}`, `KH: ${f1(w.kh)}ppm${aim(w.target?.kh, 'ppm')}`
  ];
  return { title, description: lines.join('\n') };
}

export function onDeckPreview(view: 'open' | 'next', show: 'all' | 'caffeinated' | 'decaf', coffees: Pick<CoffeeRow, 'coffee_name' | 'roaster'>[]): Preview {
  const title = join(['On Deck: ' + (view === 'open' ? 'Currently open' : 'Next up'), show === 'caffeinated' ? 'Caffeinated' : show === 'decaf' ? 'Decaf' : null]);
  const lines = coffees.map((c, i) => `${i + 1}. ${c.roaster} · ${c.coffee_name}`);
  return { title, description: lines.length ? fitList(lines, '\n', true) : view === 'open' ? 'Nothing open right now.' : 'Backlog is empty.' };
}

// The budget is the project's documented one; adjust if Discord truncates.
export const RECIPE_PREVIEW_MAX = DESCRIPTION_MAX;

// One recipe's link preview: its one-liner, steps, temperature and notes, then how many brews matched and their average
// rating. The one-liner goes first when the lot is over the budget; still over, fitList cuts it.
export function recipePreview(r: { timeline?: ChartTimeline | null; name: string; description: string; steps: string; tempNotes: string | null; n: number; avgRating: number | null; brewTime?: string | null }): Preview {
  const stats = join([plural(r.n, 'brew'), r.avgRating != null && `avg ${f1(r.avgRating)}`, r.brewTime && `most brews took ${r.brewTime}`]);
  const rest = [r.steps, r.tempNotes, stats].filter(Boolean) as string[];
  const all = [r.description, ...rest].filter(Boolean).join('\n');
  return { title: r.name, description: all.length <= RECIPE_PREVIEW_MAX ? all : fitList(rest, '\n', false, RECIPE_PREVIEW_MAX), card: { big: r.name, label: 'Recipes', ...(r.timeline ? { timeline: r.timeline } : {}) } };
}

export function recipesPreview(names: string[]): Preview {
  if (!names.length) return { title: 'Recipes', description: 'No saved recipes.' };
  return { title: 'Recipes', description: fitList([plural(names.length, 'recipe'), ...names], '\n', true), card: { big: 'Recipes', label: plural(names.length, 'recipe') } };
}

export function subscriptionsPreview(subs: Pick<SubscriptionRow, 'roaster_service' | 'subscription_name'>[]): Preview {
  if (!subs.length) return { title: 'Subscriptions', description: 'No subscriptions.' };
  const lines = subs.map((s) => join([s.roaster_service, s.subscription_name]));
  return { title: 'Subscriptions', description: fitList([plural(subs.length, 'subscription'), ...lines], '\n', true), card: { big: 'Subscriptions', label: plural(subs.length, 'subscription') } };
}

const STATUS_LABEL: Record<StatusTab, string> = { backlog: 'Backlog', open: 'Open', archive: 'Archive', all: 'All' };

export function coffeesPreview(v: { count: number; grams: number; status: StatusTab[]; query: string; chips: string[] }): Preview {
  const q = v.query.trim();
  const lines = [v.status.map((s) => STATUS_LABEL[s]).join(' + '), join([...v.chips, q && `“${q}”`]), join([plural(v.count, 'coffee'), formatGrams(v.grams)])];
  return { title: 'Coffee Collection', description: fitList(lines.filter(Boolean), '\n', false), card: { big: 'Coffee Collection', label: plural(v.count, 'coffee') } };
}

// A recap link: the cover (bare URL, an unknown slide) or one slide, with its card image (server/recaps/card.ts).
// The card URL carries, for an admin's preview year, preview=1 (the card endpoint 404s it otherwise).
export function recapPreview(r: Recap, slideId: string | undefined): Preview {
  const s = r.slides.find((x) => x.id === slideId);
  const id = s ? s.id : slideId === 'poster' ? 'poster' : 'cover';
  const head = `${r.year} in coffee`;
  const title = !s ? head
    : s.roaster ? `${head} · ${s.lead} ${s.roaster} · ${s.big}`
    : `${head} · ${s.lead} ${glue(s.big)}${s.unit ? unitGap(s.unit) + s.unit : ''}`;
  const q = new URLSearchParams();
  if (r.preview) q.set('preview', '1');
  const qs = q.size ? `?${q}` : '';
  return {
    title,
    description: fitList([s ? s.context : `${r.poster.sub} ${r.poster.footer}`], ' ', false),
    image: { src: `/recaps/${r.year}/card/${id}.png${qs}`, alt: title }
  };
}
