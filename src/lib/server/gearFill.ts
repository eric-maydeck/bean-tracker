import { KIND_FIELDS, parseGearValues, type GearKind, type GearValues } from '$lib/gear';
import type { ProductData } from './productParse';
import { stripSiteSuffix, toUsd, formatMoney, type UsdRates } from './productFill';

export interface GearFill { values: GearValues; imageUrl: string | null; notes: string[] }

// Turns a parsed product page into gear details. Every value is checked with parseGearValues, so the form never
// receives something the save would reject; a field that fails is simply left out.
export function buildGearFill(p: ProductData, ctx: { url: string; kind: GearKind; rates: UsdRates | null }): GearFill {
  const brand = p.brand ?? p.vendor ?? p.siteName;
  let model = p.title ? stripSiteSuffix(p.title, [brand, p.vendor, p.siteName]) : '';
  if (brand && model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) model = model.slice(brand.length).trim();
  const notes: string[] = [];
  const raw: Record<string, string | number> = { website: ctx.url };
  if (brand) raw.brand = brand;
  if (model) raw.model = model;
  const v = p.variants[0];
  if (v) {
    const currency = p.currency ?? 'USD';
    const usd = toUsd(v.price, currency, ctx.rates);
    if (usd != null) raw.cost = usd;
    else notes.push(`${formatMoney(v.price, currency)} ${currency} — couldn't convert to USD, cost left blank`);
  }
  const attrs = Object.entries(p.attributes);
  for (const f of KIND_FIELDS[ctx.kind]) {
    const hit = attrs.find(([k]) => f.aliases?.includes(k))?.[1];
    if (!hit) continue;
    if (f.type === 'number') { const n = /\d+(?:\.\d+)?/.exec(hit); if (n) raw[f.key] = Number(n[0]); }
    else if (f.type === 'select') { const o = f.options?.find((x) => x.toLowerCase() === hit.trim().toLowerCase()); if (o) raw[f.key] = o; }
    else raw[f.key] = hit;
  }
  const values: GearValues = {};
  for (const [key, val] of Object.entries(raw)) {
    const one = parseGearValues(ctx.kind, { [key]: val, ...(key === 'stepSize' && { adjustment: 'Stepped' }) }); // a step is only kept beside Stepped
    if ('values' in one && key in one.values) values[key] = one.values[key];
  }
  const final = parseGearValues(ctx.kind, values); // drops stepSize unless Stepped
  const out = 'values' in final ? final.values : values;
  notes.unshift(`Filled ${Object.keys(out).length} field${Object.keys(out).length === 1 ? '' : 's'}`);
  return { values: out, imageUrl: p.image, notes };
}
