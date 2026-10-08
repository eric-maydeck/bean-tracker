// "Fill from page" for the Add subscription form (and edit mode): turns a
// subscription's product page into subscription fields. Reuses the coffee
// fill's parsing (productParse/productFill); only bag counts and the renewal
// day are subscription-specific.
import type { ProductData } from './productParse';
import { cleanName, findRoaster, formatMoney, parseGrams, stripSiteSuffix, toUsd, type UsdRates } from './productFill';
import type { FillHistoryRow } from './coffees';
import type { SubscriptionFillVariant } from '../subscriptionView';

const WEIGHT = String.raw`(\d+(?:[.,]\d+)?\s*(?:kg|kilos?|grams?|gr|g|ounces?|oz|lbs?))(?![a-wyz])`;
const NOT_TOTAL = String.raw`(?!\s*\)?\s*total)`;
const BAG = String.raw`(?:bags?|tins?)`;
// [pattern, index of the count group, index of the weight group (0 = none)]
const BAG_PATTERNS: [RegExp, number, number][] = [
  [new RegExp(String.raw`\b(\d+)\s*[x×]\s*${WEIGHT}${NOT_TOTAL}`, 'gi'), 1, 2], // 3x 100g, 4x125g
  [new RegExp(String.raw`${WEIGHT}\s*[x×]\s*(\d+)\b`, 'gi'), 2, 1], // (20gx8)
  [new RegExp(String.raw`\b(\d+)\s*${BAG}\s*[,:–-]?\s*${WEIGHT}${NOT_TOTAL}`, 'gi'), 1, 2], // 2 bags, 250g
  [new RegExp(String.raw`\b(\d+)\s*${BAG}\b`, 'gi'), 1, 0] // 4 bag
];

interface BagMatch {
  index: number;
  bags: number;
  gramsPerBag: number | null;
}

function bagMatches(text: string): BagMatch[] {
  const out: BagMatch[] = [];
  for (const [re, countAt, weightAt] of BAG_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const bags = Number(m[countAt]);
      if (bags > 0) out.push({ index: m.index, bags, gramsPerBag: weightAt ? parseGrams(m[weightAt]) : null });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

// A bag count next to a per-bag weight, either order ("3x 100g", "2 bags,
// 250g", "(20gx8)"), or a bare count ("4 bag"). A weight alone is never taken
// as per-bag: on these pages it's usually the total ("– 120g (4.23oz)").
// With `count`, a match for that many bags wins (Shoebox's description lists
// both "2x125g" and "4x125g").
export function parseBags(text: string, count?: number): { bags: number | null; gramsPerBag: number | null } {
  const all = bagMatches(text);
  const m =
    (count != null ? all.find((x) => x.bags === count && x.gramsPerBag != null) : undefined) ??
    all.find((x) => x.gramsPerBag != null) ??
    all[0];
  return { bags: m?.bags ?? null, gramsPerBag: m?.gramsPerBag ?? null };
}

// "renew on the 10th", "Renewal on the 1st", "billed the 5th", "billed by the 14th".
export function parseRenewalDay(text: string): number | null {
  const m = /\b(?:renew(?:s|al|ing)?|bill(?:ed|ing)?)(?:\s+\w+){0,3}?\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text);
  const day = m ? Number(m[1]) : null;
  return day != null && day >= 1 && day <= 31 ? day : null;
}

export interface SubscriptionFillFields {
  roaster_service?: string;
  subscription_name?: string;
  price?: number;
  bag_count?: number;
  amount_per_bag_g?: number;
  renewal_day?: number;
}
export interface SubscriptionFill {
  fields: SubscriptionFillFields;
  variants: SubscriptionFillVariant[];
  selected: number | null;
  notes: string[];
}
export interface SubscriptionFillContext {
  url: string;
  // Existing subscriptions (subscription_url as product_url) and coffees,
  // so a known site keeps the user's spelling of the roaster.
  history: Pick<FillHistoryRow, 'roaster' | 'product_url'>[];
  rates: UsdRates | null;
}

export function buildSubscriptionFill(p: ProductData, ctx: SubscriptionFillContext): SubscriptionFill {
  const currency = p.currency ?? 'USD';
  const roaster = findRoaster(p, ctx.url, ctx.history);
  // Variant label first, then the title, then the description.
  const bagsFor = (label: string) => {
    let { bags, gramsPerBag } = parseBags(label);
    for (const text of [p.title ?? '', p.description]) {
      if (bags != null && gramsPerBag != null) break;
      const found = parseBags(text, bags ?? undefined);
      bags ??= found.bags;
      gramsPerBag ??= found.gramsPerBag;
    }
    return { bags, gramsPerBag };
  };
  const variants: SubscriptionFillVariant[] = p.variants.map((v) => ({
    label: v.label,
    price: toUsd(v.price, currency, ctx.rates),
    originalPrice: currency === 'USD' ? null : `${formatMoney(v.price, currency)} ${currency}`,
    ...bagsFor(v.label)
  }));
  const variantId = Number(new URL(ctx.url).searchParams.get('variant'));
  const preferred = variantId ? p.variants.findIndex((v) => v.id === variantId) : -1;
  const selected = variants.length === 1 ? 0 : preferred >= 0 ? preferred : null;
  const chosen = selected != null ? variants[selected] : null;

  const fields: SubscriptionFillFields = {};
  const put = <K extends keyof SubscriptionFillFields>(key: K, value: SubscriptionFillFields[K] | null | undefined) => {
    if (value != null && value !== '') fields[key] = value;
  };
  put('roaster_service', roaster);
  const bare = p.title ? stripSiteSuffix(p.title, [roaster, p.vendor, p.siteName, p.brand]) : null;
  // "(20gx8)" is bag info, not part of the name.
  put('subscription_name', bare ? cleanName(bare.replace(/\([^)]*\)/g, (m) => (parseBags(m).bags ? ' ' : m))) : null);
  if (chosen) {
    put('price', chosen.price);
    put('bag_count', chosen.bags);
    put('amount_per_bag_g', chosen.gramsPerBag);
  } else if (!variants.length) {
    const { bags, gramsPerBag } = bagsFor('');
    put('bag_count', bags);
    put('amount_per_bag_g', gramsPerBag);
  }
  put('renewal_day', parseRenewalDay(p.description));

  const notes = [`Filled ${Object.keys(fields).length} fields`];
  if (fields.renewal_day == null) notes.push('renewal day not found');
  if (!p.currency && variants.length) notes.push('currency not stated on the page, assumed USD');
  if (currency !== 'USD' && variants.length) {
    const original = chosen?.originalPrice ?? variants[0].originalPrice;
    if (!ctx.rates?.rates[currency]) notes.push(`${original} — couldn't convert to USD, price left blank`);
    else if (chosen?.price != null) notes.push(`${original} → ${formatMoney(chosen.price, 'USD')} USD (rate ${ctx.rates.date})`);
    else notes.push(`prices converted from ${currency} (rate ${ctx.rates.date})`);
  }
  if (variants.length > 1 && selected == null) notes.push('pick an option below');

  return {
    fields,
    variants: variants.length > 1 ? variants : [],
    selected: variants.length > 1 ? selected : null,
    notes
  };
}
