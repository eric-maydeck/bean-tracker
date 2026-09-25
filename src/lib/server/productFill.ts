import type { ProductData } from './productParse';
import { COUNTRY_NAMES } from '../countryFlags';

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
