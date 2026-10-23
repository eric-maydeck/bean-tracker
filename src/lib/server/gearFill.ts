import { KIND_FIELDS, parseGearValues, type GearKind, type GearValues } from '$lib/gear';
import type { ProductData } from './productParse';
import { stripSiteSuffix, toUsd, formatMoney, type UsdRates } from './productFill';

export interface GearFill { values: GearValues; imageUrl: string | null; notes: string[] }

// Shopify vendors carry store/region tags ("Hario USA", "HarioWS"); strip them, never down to nothing, and leave
// an all-caps brand (DF64, SSP) alone.
export function cleanBrand(brand: string): string {
  if (brand === brand.toUpperCase()) return brand;
  let b = brand.trim(), prev;
  do {
    prev = b;
    const t = b.replace(/\s+(?:USA|US|Inc\.?|LLC|Ltd\.?|Co\.?|Store|Shop|Official|Japan|JP|EU|UK)$/i, '').replace(/(?<=[a-z])[A-Z]{2,3}$/, '');
    if (t) b = t;
  } while (b !== prev);
  return b;
}

// Prose cues for option fields that no labeled spec line filled ("its conical shape", "Porcelain", "lack of flow
// restriction"). The option mentioned first in the title, then the description, wins.
// ponytail: keyword regexes, not language understanding; add a cue when a real page misses one.
const CUES: Partial<Record<GearKind, Record<string, Record<string, RegExp>>>> = {
  dripper: {
    shape: { Conical: /\bconical\b|\bcone[- ]shaped\b/i, 'Flat bottom': /\bflat[- ]bottom/i, Wave: /\bwave\b/i },
    material: {
      Ceramic: /\bceramic|\bporcelain|\barita/i, Glass: /\bglass\b/i, Tritan: /\btritan\b/i,
      Plastic: /\bplastic\b|\bresin\b|\bpolypropylene\b/i, Metal: /\bstainless\b|\bcopper dripper\b/i
    },
    flow: {
      // "flow restriction" alone reads as Restricted below; the negated phrases come first in the same text.
      Open: /\b(?:no|lack of|without)\s+(?:a\s+)?flow restrict|\bunrestricted\b|\bopen flow\b/i,
      'Valve / immersion': /\bvalve\b|\bimmersion\b/i, Restricted: /\brestricted\b|\bflow[- ]restrict/i
    },
    size: { '01': /\b01\b/, '02': /\b02\b/, '03': /\b03\b/ }
  },
  filter: {
    material: { Paper: /\bpaper\b/i, Cloth: /\bcloth\b|\bflannel\b/i, Metal: /\bstainless\b|\bmetal\b/i },
    shape: { Cone: /\bcone\b|\bconical\b|\bV60\b/i, Wave: /\bwave\b/i, 'Flat-bottom basket': /\bbasket\b|\bflat[- ]bottom/i },
    fits: { '01': /\b01\b/, '02': /\b02\b/, '155': /\b155\b/, '185': /\b185\b/ }
  },
  grinder: {
    type: { Hand: /\bhand grinder\b|\bmanual\b/i, Electric: /\belectric\b|\bmotor\b/i },
    burrType: { Conical: /\bconical burr/i, Flat: /\bflat burr/i },
    burrCoating: {
      DLC: /\bDLC\b/, 'Red Speed': /\bred speed\b/i, 'Silver Knight': /\bsilver knight\b/i,
      'Titanium (TiN)': /\btitanium nitride\b|\bTiN\b/, 'Hardened steel': /\bhardened steel\b/i, 'Stainless steel': /\bstainless steel burr/i
    },
    adjustment: { Stepless: /\bstepless\b/i, Stepped: /\bstepped\b/i }
  }
};
// Number cues: the first capture group is the value. A V60 is named for its 60° cone.
const NUM_CUES: Partial<Record<GearKind, Record<string, RegExp[]>>> = {
  dripper: { coneAngle: [/(\d{2,3})\s*(?:°|-?\s*degrees?\b)/i, /\bV(60)\b/] },
  grinder: {
    burrSize: [/(\d{2,3})\s*mm\s+(?:conical |flat )?burrs?/i],
    stepSize: [/(\d+(?:\.\d+)?)\s*(?:µm|μm|microns?)\s*(?:per|\/)\s*(?:click|step)/i]
  }
};

function proseHit(cues: Record<string, RegExp>, texts: string[]): string | undefined {
  for (const t of texts) {
    let best: [number, string] | undefined;
    for (const [opt, re] of Object.entries(cues)) {
      const i = t.search(re);
      if (i >= 0 && (!best || i < best[0])) best = [i, opt];
    }
    if (best) return best[1];
  }
}

// Turns a parsed product page into gear details. Every value is checked with parseGearValues, so the form never
// receives something the save would reject; a field that fails is simply left out.
export function buildGearFill(p: ProductData, ctx: { url: string; kind: GearKind; rates: UsdRates | null }): GearFill {
  const rawBrand = p.brand ?? p.vendor ?? p.siteName;
  const brand = rawBrand && cleanBrand(rawBrand);
  let model = p.title ? stripSiteSuffix(p.title, [rawBrand, brand, p.vendor, p.siteName]) : '';
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
    // A field with options keeps only a match (a Size of "W108ｘD108" is dimensions, not a size code).
    else if (f.options) { const o = f.options?.find((x) => x.toLowerCase() === hit.trim().toLowerCase()); if (o) raw[f.key] = o; }
    else raw[f.key] = hit;
  }
  const texts = [p.title ?? '', p.description];
  for (const [key, cues] of Object.entries(CUES[ctx.kind] ?? {})) if (!(key in raw)) {
    const o = proseHit(cues, texts);
    if (o) raw[key] = o;
  }
  for (const [key, res] of Object.entries(NUM_CUES[ctx.kind] ?? {})) if (!(key in raw)) {
    for (const re of res) { const m = texts.map((t) => re.exec(t)).find(Boolean); if (m) { raw[key] = Number(m[1]); break; } }
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
