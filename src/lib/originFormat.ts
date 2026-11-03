// One shared format for coffee origin text (elevation, harvest, variety, region).
// Values come from web pages and imports, so they are only ever treated as text:
// anything a rule cannot parse comes back trimmed and otherwise unchanged.
const DASH = '\\s*[-\u2013]\\s*';
const NUM = '\\d{1,3}(?:[.,]\\d{3})+|\\d+';

const num = (s: string) => Number(s.replace(/[.,]/g, ''));
const fmt = (n: number) => n.toLocaleString('en-US');

export function formatElevation(value: string): string {
  const v = value.trim();
  if (/\b(ft|feet|foot)\b/i.test(v)) return v;
  const m = new RegExp(
    `^(above\\s+|over\\s+|~\\s*|\\+\\s*|>\\s*)?(${NUM})(?:(?:${DASH}|\\s+to\\s+)(${NUM}))?\\s*(\\+)?\\s*` +
      `(masl|m\\.a\\.s\\.l\\.?|m|meters?|metres?|meters above sea level|metres above sea level)?\\s*(\\+)?$`,
    'i'
  ).exec(v);
  if (!m) return v;
  const [, pre = '', a, b, plus1, unit, plus2] = m;
  // A bare number is only a elevation when it carries a thousands separator or a range.
  if (!unit && !/[.,]/.test(a) && !b) return v;
  const above = /^(above|over|\+|>)/i.test(pre) || !!(plus1 || plus2);
  if (above && b) return v;
  const lead = above ? '>' : pre.startsWith('~') ? '~' : '';
  return `${lead}${fmt(num(a))}${b ? `-${fmt(num(b))}` : ''} masl`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const monthIdx = (s: string) => MONTHS.findIndex((x) => x.toLowerCase().startsWith(s.toLowerCase().slice(0, 3)));
const monthName = (s: string) => MONTHS[monthIdx(s)];
const DAY = '\\d{1,2}(?:st|nd|rd|th)?';

export function formatHarvest(value: string): string {
  const v = value.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(?:crop\s*)?(\d{2})\/(\d{2})$/i.exec(v))) return `20${m[1]}/${m[2]}`;
  if ((m = /^(\d{4})\s*[-\u2013]\s*(\d{4})$/.exec(v)) && +m[2] === +m[1] + 1) return `${m[1]}/${m[2].slice(2)}`;
  if ((m = /^semester\s+(\d{4})\s+(Q[1-4])$/i.exec(v))) return `${m[2].toUpperCase()} ${m[1]}`;
  if ((m = /^late\s+(\d{4})$/i.exec(v))) return `Late ${m[1]}`;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*[-\u2013]\s*\d{1,2}\/\d{1,2}\/\d{4})?$/.exec(v)) && +m[2] >= 1 && +m[2] <= 12) {
    return `${MONTHS[+m[2] - 1]} ${m[3]}`;
  }
  if ((m = new RegExp(`^${MON}${DASH}${MON}\\s+(\\d{4})/(\\d{2})$`, 'i').exec(v))) {
    const y = +m[3];
    return `${monthName(m[1])} ${y}-${monthName(m[2])} ${monthIdx(m[2]) < monthIdx(m[1]) ? y + 1 : y}`;
  }
  if ((m = new RegExp(`^${MON}(?:\\s+(\\d{4}))?${DASH}${MON}\\s+(\\d{4})$`, 'i').exec(v))) {
    return `${monthName(m[1])}${m[2] ? ` ${m[2]}` : ''}-${monthName(m[3])} ${m[4]}`;
  }
  if ((m = new RegExp(`^${MON}\\s+${DAY}(?:${DASH}${DAY})?,?\\s+(\\d{4})$`, 'i').exec(v))) return `${monthName(m[1])} ${m[2]}`;
  if ((m = new RegExp(`^${MON}\\s+(\\d{4})$`, 'i').exec(v))) return `${monthName(m[1])} ${m[2]}`;
  return v;
}

const WHOLE: Record<string, string> = {
  heirloom: 'Landrace',
  'ethiopian heirloom': 'Landrace',
  'heirloom ethiopian varieties': 'Landrace',
  'ethiopian landrace': 'Landrace',
  'ethiopian landrace (heirloom)': 'Landrace',
  'local bourbon cultivars': 'Bourbon',
  'local bourbon varietals': 'Bourbon',
  'sl-28': 'SL28',
  'sl-34': 'SL34',
  'sl-09': 'SL9',
  sl09: 'SL9',
  'ruiru-11': 'Ruiru 11',
  ruiru: 'Ruiru 11',
  ruiri: 'Ruiru 11',
  'mundo nuvo': 'Mundo Novo',
  // reviewed 2026-11-02, spec bean origin insights
  welicho: 'Wolisho',
  'field blend': 'Field blend',
  'mostly 74158': '74158',
  'bourbon sidra': 'Sidra',
  'bourbon aji': 'Ají',
  'bourbon ají': 'Ají',
  'typica mejorado': 'Mejorado',
  // genetic tests put Peru's Inca Gesha at SL9 (user, 2026-11-02)
  'inca gesha': 'SL9'
};

const varietyItem = (item: string): string => {
  // ponytail: ALL-CAPS words of 5+ letters only, so short codes like JARC stay.
  const s = /^[A-Z ]{5,}$/.test(item) ? item.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : item;
  const whole = WHOLE[s.toLowerCase()];
  if (whole) return whole;
  return s
    .replace(/\bgeisha\b/gi, 'Gesha')
    .replace(/\baji\b/gi, 'Ají')
    .replace(/^jarc\s+(\d+)$/i, '$1');
};

export function formatVariety(value: string): string {
  const v = value.trim().replace(/rosado\/pink bourbon/gi, 'Pink Bourbon');
  const items = v.split(/\s*(?:,|&|\s+and\s+|\s+\/\s+)\s*/i).filter(Boolean);
  return items.length ? [...new Set(items.map(varietyItem))].join(', ') : v;
}

// Only Gesha 1931 folds into Gesha; Orange Gesha stays its own row (Inca Gesha is stored as SL9).
export const varietyGroup = (token: string): string =>
  token.toLowerCase() === 'gesha 1931' ? 'Gesha' : token;

export const varietyGroups = (variety: string | null | undefined): string[] => [
  ...new Set((variety ?? '').split(',').map((t) => t.trim()).filter(Boolean).map(varietyGroup))
];

export const formatRegion = (value: string): string => value.trim().replace(/\s+[-\u2013]\s+/g, ', ');

// The broadest region part: the last comma part that isn't the country.
export function regionTop(region: string | null | undefined, country: string | null | undefined): string | null {
  const c = (country ?? '').trim().toLowerCase();
  const parts = (region ?? '').split(',').map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== c);
  return parts.at(-1) ?? null;
}

export function formatOriginField(field: string, value: string): string {
  switch (field) {
    case 'elevation': return formatElevation(value);
    case 'harvest_time': return formatHarvest(value);
    case 'variety': return formatVariety(value);
    case 'region': return formatRegion(value);
    default: return value;
  }
}
