import type { ProductData } from './productParse';
import { COUNTRY_NAMES } from '../countryFlags';
import type { FillHistoryRow } from './coffees';
import type { CoffeeRow } from '../types';
import { suggestRest } from '../coffeeFormFill';

export interface UsdRates {
  date: string;
  rates: Record<string, number>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const titleCase = (s: string) => (s.length <= 3 ? s.toUpperCase() : s.replace(/\b\w/g, (c) => c.toUpperCase()));

// Known values keep the user's spelling; otherwise the vocabulary entry is title-cased.
function canonical(value: string, known: string[]): string {
  return known.find((k) => k.toLowerCase() === value.toLowerCase()) ?? titleCase(value);
}

const UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|grams?|gr|g|ounces?|oz|lbs?)\b/i;

export function parseGrams(text: string): number | null {
  const m = UNIT_RE.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,(?=\d{3}$)/, '').replace(',', '.'));
  const unit = m[2].toLowerCase();
  const grams = unit.startsWith('k') ? n * 1000 : unit.startsWith('o') ? n * 28.3495 : unit.startsWith('l') ? n * 453.592 : n;
  return grams > 0 ? Math.round(grams) : null;
}

const SEP = '[-–/|,]';

export function cleanName(title: string): string {
  return title
    .replace(/[-–|,(]?\s*\broast(?:ed)?\b(?:\s+on)?\s*:?\s*\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\)?/gi, ' ')
    .replace(new RegExp(`\\(?\\s*${UNIT_RE.source}\\s*\\)?`, 'gi'), ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(new RegExp(`(${SEP})(\\s*${SEP})+`, 'g'), '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–/|,]+|[\s\-–/|,]+$/g, '')
    .trim();
}

// Earliest match in `text`; at the same position the longest term wins
// (alternation is sorted longest-first). Allows demonym endings so
// "Rwandan"/"Colombian"/"Brazilian" count.
function firstTerm(text: string, terms: string[], suffix = ''): string | null {
  if (!text || terms.length === 0) return null;
  const alts = [...terms].sort((a, b) => b.length - a.length).map(escapeRe).join('|');
  return new RegExp(`\\b(${alts})${suffix}\\b`, 'i').exec(text)?.[1] ?? null;
}

// ponytail: plain country list, so a farmer named "Chad" or "Jordan" in the
// description can false-match; labeled/tags/title are searched first, and
// the user reviews before saving.
export function findOrigin(p: ProductData, knownOrigins: string[]): string | null {
  const terms = [...new Set([...knownOrigins.map((o) => o.toLowerCase()), ...COUNTRY_NAMES])];
  const find = (text: string) => {
    const hit = firstTerm(text, terms, '(?:n|an|ian)?');
    return hit ? canonical(hit, knownOrigins) : null;
  };
  for (const label of ['country', 'origin', 'region']) {
    const hit = p.attributes[label] ? find(p.attributes[label]) : null;
    if (hit) return hit;
  }
  return find(p.tags.join(' , ')) ?? find(p.title ?? '') ?? find(p.description);
}

const BASE_PROCESSES = [
  'washed', 'fully washed', 'semi washed', 'natural', 'pulped natural', 'honey', 'black honey', 'red honey',
  'yellow honey', 'white honey', 'anaerobic', 'anaerobic natural', 'anaerobic washed', 'anaerobic honey',
  'carbonic maceration', 'double fermentation', 'thermal shock', 'wet hulled', 'co-ferment', 'experimental'
];

export function findProcessing(p: ProductData, knownProcessing: string[]): string | null {
  for (const label of ['process', 'processing', 'process method', 'processing method']) {
    const value = p.attributes[label];
    if (value) return canonical(value, knownProcessing);
  }
  const terms = [...new Set([...knownProcessing.map((v) => v.toLowerCase()), ...BASE_PROCESSES])].sort(
    (a, b) => b.length - a.length
  );
  for (const text of [p.tags.join(' , '), p.title ?? '', p.description]) {
    const hit = terms.find((t) => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
    if (hit) return canonical(hit, knownProcessing);
  }
  return null;
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

export function normalizeRoaster(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(the|coffees?|roasters?|roastery|roasting|co|company)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findRoaster(p: ProductData, url: string, history: FillHistoryRow[]): string | null {
  const host = hostOf(url);
  const byDomain = host ? history.find((r) => r.product_url && hostOf(r.product_url) === host) : undefined;
  if (byDomain) return byDomain.roaster;
  const names = [...new Set(history.map((r) => r.roaster))];
  for (const candidate of [p.vendor, p.siteName, p.brand]) {
    const n = candidate ? normalizeRoaster(candidate) : '';
    const hit = n ? names.find((r) => normalizeRoaster(r) === n) : undefined;
    if (hit) return hit;
  }
  return p.vendor?.trim() || p.siteName?.trim() || p.brand?.trim() || null;
}

// Drop the level name's own spaces/hyphens and allow an optional hyphen or
// space between any two of its remaining characters instead, so "Ultralight"
// also matches a page's "Ultra-Light"/"Ultra Light" and "Nordic Light" also
// matches "Nordic-Light" (and vice versa).
const flexPattern = (level: string) =>
  [...level].filter((c) => !/[\s-]/.test(c)).map(escapeRe).join('[\\s-]*');

// Whole phrase, and "Light" must not match inside "Medium/Light".
const phrase = (level: string) => new RegExp(`(?<![\\w/])${flexPattern(level)}(?![\\w/])`, 'i');

export function findRoastLevel(
  p: ProductData,
  levels: string[],
  roaster: string | null,
  history: FillHistoryRow[]
): { level: string; note?: string } | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of history) {
    if (!roaster || r.roaster !== roaster || !r.roast_level) continue;
    counts.set(r.roast_level, (counts.get(r.roast_level) ?? 0) + 1);
    total++;
  }
  // The page's own level name only wins when there's no history for this
  // roaster, or the user has used that level for them before — roasters'
  // words don't map onto the user's scale (XLIII "Extremely Light" is the
  // user's Ultralight/Hyperlight, not Light).
  const trusted = (l: string) => total === 0 || counts.has(l);

  const byLength = [...levels].sort((a, b) => b.length - a.length);
  const roastLabel = p.attributes['roast level'] ?? p.attributes['roast'] ?? p.attributes['roast profile'] ?? '';
  for (const text of [p.tags.join(' , '), roastLabel, p.title ?? '']) {
    const hit = byLength.find((l) => phrase(l).test(text));
    if (hit && trusted(hit)) return { level: hit };
  }
  // Descriptions are tasting notes ("light body", "green apple"), so only
  // an explicit "<level> roast" counts there.
  const described = byLength.find((l) => new RegExp(`${phrase(l).source}\\s+roast`, 'i').test(p.description));
  if (described && trusted(described)) return { level: described };

  const [level, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!level || !count) return null;
  const of = count === total ? `${count}` : `${count} of ${total}`;
  return { level, note: `roast level from ${of} ${roaster} coffees` };
}

export function pickVariant(
  grams: (number | null)[],
  preferred: number | null,
  roaster: string | null,
  history: FillHistoryRow[]
): number | null {
  if (preferred != null) return preferred;
  if (grams.length === 1) return 0;
  const inRange = grams.flatMap((g, i) => (g != null && g >= 50 && g <= 250 ? [{ g, i }] : []));
  if (inRange.length === 1) return inRange[0].i;
  if (inRange.length > 1 && roaster) {
    const bought = (g: number) => history.filter((r) => r.roaster === roaster && r.amount_g === g).length;
    const ranked = inRange.map(({ g, i }) => ({ i, n: bought(g) })).sort((a, b) => b.n - a.n);
    if (ranked[0].n > 0 && ranked[0].n !== ranked[1].n) return ranked[0].i;
  }
  return null;
}

export function toUsd(amount: number, currency: string, rates: UsdRates | null): number | null {
  if (currency === 'USD') return Math.round((amount + Number.EPSILON) * 100) / 100;
  const perUsd = rates?.rates[currency];
  if (!perUsd) return null;
  return Math.round(((amount / perUsd) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export type FillFields = Partial<
  Pick<
    CoffeeRow,
    | 'roaster'
    | 'coffee_name'
    | 'origin'
    | 'processing'
    | 'roast_level'
    | 'amount_g'
    | 'cost'
    | 'image_url'
    | 'rest_days_low'
    | 'rest_days_high'
  >
>;
export interface FillVariant {
  label: string;
  grams: number | null;
  costUsd: number | null;
  originalPrice: string | null;
}
export interface FillSuccess {
  fields: FillFields;
  variants: FillVariant[];
  selected: number | null;
  notes: string[];
}
export type FillResult = FillSuccess | { error: string };
export interface FillContext {
  url: string;
  history: FillHistoryRow[];
  roastLevels: string[];
  origins: string[];
  processing: string[];
  rates: UsdRates | null;
}

export function buildFill(p: ProductData, ctx: FillContext): FillSuccess {
  const currency = p.currency ?? 'USD';
  const roaster = findRoaster(p, ctx.url, ctx.history);
  const pageGrams =
    parseGrams(p.title ?? '') ??
    parseGrams(p.attributes['net weight'] ?? p.attributes['weight'] ?? p.attributes['size'] ?? '');
  const variants: FillVariant[] = p.variants.map((v) => ({
    label: v.label,
    // The label's own weight text wins when present; otherwise Shopify's
    // numeric `grams` field (a per-variant value from the platform itself)
    // beats the whole-product pageGrams guess.
    grams: parseGrams(v.label) ?? v.grams ?? pageGrams,
    costUsd: toUsd(v.price, currency, ctx.rates),
    originalPrice: currency === 'USD' ? null : `${formatMoney(v.price, currency)} ${currency}`
  }));
  const variantId = Number(new URL(ctx.url).searchParams.get('variant'));
  const preferred = variantId ? p.variants.findIndex((v) => v.id === variantId) : -1;
  const selected = variants.length
    ? pickVariant(variants.map((v) => v.grams), preferred >= 0 ? preferred : null, roaster, ctx.history)
    : null;
  const chosen = selected != null ? variants[selected] : null;
  const roast = findRoastLevel(p, ctx.roastLevels, roaster, ctx.history);
  const rest = suggestRest(roaster, roast?.level ?? null, ctx.history);

  const fields: FillFields = {};
  const put = <K extends keyof FillFields>(key: K, value: FillFields[K] | null | undefined) => {
    if (value != null && value !== '') fields[key] = value;
  };
  put('roaster', roaster);
  put('coffee_name', p.title ? cleanName(p.title) : null);
  put('origin', findOrigin(p, ctx.origins));
  put('processing', findProcessing(p, ctx.processing));
  put('roast_level', roast?.level);
  put('rest_days_low', rest?.low);
  put('rest_days_high', rest?.high);
  put('image_url', p.image);
  if (chosen) {
    put('amount_g', chosen.grams);
    put('cost', chosen.costUsd);
  } else if (variants.length === 0) {
    put('amount_g', pageGrams);
  }

  const notes = [`Filled ${Object.keys(fields).length} fields`];
  if (!fields.origin) notes.push('origin not found');
  if (!fields.processing) notes.push('processing not found');
  if (roast?.note) notes.push(roast.note);
  else if (!roast) notes.push('roast level not found');
  if (rest) notes.push(rest.note);
  if (!p.currency && variants.length) notes.push('currency not stated on the page, assumed USD');
  if (currency !== 'USD' && variants.length) {
    const original = chosen?.originalPrice ?? variants[0].originalPrice;
    if (!ctx.rates?.rates[currency]) notes.push(`${original} — couldn't convert to USD, cost left blank`);
    else if (chosen?.costUsd != null) notes.push(`${original} → ${formatMoney(chosen.costUsd, 'USD')} USD (rate ${ctx.rates.date})`);
    else notes.push(`prices converted from ${currency} (rate ${ctx.rates.date})`);
  }
  if (variants.length > 1 && selected == null) notes.push('pick a bag size below');

  return { fields, variants: variants.length > 1 ? variants : [], selected: variants.length > 1 ? selected : null, notes };
}
