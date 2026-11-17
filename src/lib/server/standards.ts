// Coffee data standards (docs/data-standards.md, #21/#76): one stored form per field. Pure: no DB except applyDataStandards.
// Rule G4: a value we can't parse confidently is returned unchanged with `review` set, never guessed.
import type { DatabaseSync } from 'node:sqlite';
import { COFFEE_ORIGIN_LABELS } from '../types.ts';
import { CHECKED_FIELDS, LOCKED_FIELDS, MISSING_KEY_FIELDS, type StdRow } from '../standardsDialog.ts';

export type StdField =
  | 'elevation' | 'producer' | 'variety' | 'processing' | 'region' | 'harvest_time'
  | 'roast_level' | 'origin' | 'tasting_notes' | 'certification';
type Std = { value: string | null; review?: string };

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const PLACEHOLDER = /^(n\/a|\?+|-|null|undefined)$/i; // never store these words as a value
const naturalCmp = new Intl.Collator('en', { numeric: true }).compare;
const dedupe = (xs: string[]) => xs.filter((x, i) => xs.findIndex((y) => fold(y) === fold(x)) === i);
const splitList = (v: string) => v.split(/\s*(?:,|;|\/)\s*|\s+(?:and|&|-|–)\s+/i).map((s) => s.trim()).filter(Boolean);
const titleCase = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Alias tables: lowercase key -> canonical. Seeded from the prod tally (2026-11).
const VARIETY_ALIAS: Record<string, string> = {
  'selectdion 9': 'Selection 9',
  landraces: 'Landrace', 'ethiopian landraces': 'Landrace', 'landrace varieties': 'Landrace',
  'jarc 74158': '74158', 'primarily jarc 74158': '74158', 'jarc 74158 (walega)': '74158',
  'gesha inca': 'SL9 (Inca Gesha)', 'inca gesha': 'SL9 (Inca Gesha)', // one variety (user, 2026-11-16)
  // carried over from originFormat.ts WHOLE (the retired formatVariety)
  heirloom: 'Landrace', 'ethiopian heirloom': 'Landrace', 'heirloom ethiopian varieties': 'Landrace',
  'ethiopian landrace': 'Landrace', 'ethiopian landrace (heirloom)': 'Landrace',
  'local bourbon cultivars': 'Bourbon', 'local bourbon varietals': 'Bourbon',
  sl09: 'SL9', 'ruiru-11': 'Ruiru 11', ruiru: 'Ruiru 11', ruiri: 'Ruiru 11', 'mundo nuvo': 'Mundo Novo',
  welicho: 'Wolisho', 'field blend': 'Field blend', 'mostly 74158': '74158', 'bourbon sidra': 'Sidra',
  'bourbon aji': 'Ají', 'bourbon ají': 'Ají', 'typica mejorado': 'Mejorado'
};
const PROCESSING_ALIAS: Record<string, string> = {
  'fully washed': 'Washed',
  'tyoxidator washed': 'Tyoxy Washed',
  'red fruits co-ferment': 'Red Fruits Co-Ferment',
  // decaf with more than a base method (user, 2026-11-16)
  'sugarcane (ea) decaffeinated, thermal shock washed anaerobic': 'EA Decaf Thermal Shock Anaerobic Washed',
  'red fruits co-ferment decaf': 'EA Decaf Red Fruits Co-Ferment'
};
const NOTE_ALIAS: Record<string, string> = {
  canteloupe: 'Cantaloupe', 'rooibus tea': 'Rooibos Tea', 'naval orange': 'Navel Orange', 'lemon-lime': 'Lemon Lime', 'sencha tea': 'Sencha'
};
const ROAST_RANK = ['hyperlight', 'ultralight', 'nordic', 'nordic light', 'light', 'medium', 'dark'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const month = (s: string) => {
  const t = s.toLowerCase().replace(/\.$/, '');
  return t.length >= 3 ? MONTHS.find((m) => m.toLowerCase().startsWith(t)) : undefined;
};

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function elevation(v: string): Std {
  // `+` means "and above" (user, 2026-11-16: `2,000+ masl` over `>2,000 masl`); a leading `>` converts to it.
  const m = /^(~?)((?:>|above\s+|over\s+)?)\s*(\d[\d,]*)(\+?)\s*(?:[-–]\s*(~?)((?:>|above\s+|over\s+)?)\s*(\d[\d,]*)(\+?))?\s*(?:masl|meters|metres|m)?$/i.exec(v);
  if (!m) return { value: v, review: 'elevation not a number or range' };
  const num = (s: string) => String(Number(s.replace(/,/g, ''))).replace(/\B(?=(\d{3})+$)/g, ',');
  const side = (t: string, gt: string, n: string, plus: string) => `${t}${num(n)}${gt || plus ? '+' : ''}`;
  return { value: `${side(m[1], m[2], m[3], m[4])}${m[7] ? ` - ${side(m[5], m[6], m[7], m[8])}` : ''} masl` };
}

function harvest(v: string): Std {
  const bad = (reason: string): Std => ({ value: v, review: reason });
  let m = /^(\d{4})(?:\/(\d{2}))?(?:\s+new crop)?$/i.exec(v);
  if (m) return { value: m[2] ? `${m[1]}/${m[2]}` : m[1] };
  if ((m = /^q([1-4])\s+(\d{4})$/i.exec(v))) return { value: `Q${m[1]} ${m[2]}` };
  if ((m = /^(early|mid|late)\s+(\d{4})$/i.exec(v))) return { value: `${titleCase(m[1].toLowerCase())} ${m[2]}` };
  const sides = v.split(/\s*[-–]\s*/).map((s) => /^([A-Za-z.]+)(?:\s+(\d{4}))?$/.exec(s.trim()));
  if (sides.length > 2 || sides.some((s) => !s || !month(s[1]))) return bad('harvest not a recognised form');
  const [a, b] = sides as RegExpExecArray[];
  if (!b) return a[2] ? { value: `${month(a[1])} ${a[2]}` } : bad('harvest has no year');
  const ya = a[2] ?? b[2];
  if (!ya || !b[2]) return bad('harvest range has no year');
  return { value: `${month(a[1])} ${ya} - ${month(b[1])} ${b[2]}` };
}

function roast(v: string): Std {
  const parts = v.split(/\s*\/\s*/).map((p) => p.toLowerCase().replace(/\s+/g, ' '));
  if (parts.some((p) => !ROAST_RANK.includes(p))) return { value: v, review: 'unknown roast level' };
  return { value: parts.sort((a, b) => ROAST_RANK.indexOf(a) - ROAST_RANK.indexOf(b)).map(titleCase).join('/') };
}

function processing(v: string): Std {
  if (PROCESSING_ALIAS[v.toLowerCase()]) return { value: PROCESSING_ALIAS[v.toLowerCase()] };
  if (/^EA Decaf /.test(v)) return { value: v };
  const d = /^(.*?)\b(?:EA\s+)?Decaf(?:feinated)?\b(.*)$/i.exec(v);
  if (d) {
    const base = `${d[1]} ${d[2]}`.trim();
    const hit = ['Washed', 'Natural', 'Honey'].find((b) => b.toLowerCase() === base.toLowerCase());
    return hit ? { value: `EA Decaf ${hit}` } : { value: v, review: 'decaf processing does not map to EA Decaf <Washed|Natural|Honey>' };
  }
  return { value: PROCESSING_ALIAS[v.toLowerCase()] ?? v };
}

function variety(v: string): Std {
  // ponytail: ALL-CAPS items of 5+ letters are title-cased (short codes like JARC stay).
  const item = (s: string) => {
    const t = /^[A-Z ]{5,}$/.test(s) ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
    const alias = VARIETY_ALIAS[t.toLowerCase()];
    return alias ?? t.replace(/\bgeisha\b/gi, 'Gesha').replace(/\baji\b/gi, 'Ají').replace(/^jarc\s+(\d+)$/i, '$1');
  };
  let items = splitList(v.replace(/rosado\/pink bourbon/gi, 'Pink Bourbon'))
    .map((s) => s.replace(/\bSL-(\d+)/gi, 'SL$1')).map((s) => VARIETY_ALIAS[s.toLowerCase()] ?? item(s));
  if (items.includes('SL9 (Inca Gesha)')) items = items.filter((s) => s !== 'SL9');
  return { value: dedupe(items).sort(naturalCmp).join(', ') };
}

function producer(v: string): Std {
  let s = v.trim();
  const by = / by (.+)$/i.exec(s);
  if (by && !s.includes('(')) s = `${by[1]} (${s.slice(0, by.index)})`;
  else if (!s.includes('(')) {
    const parts = s.split(/\s*(?:,| \/\/ | \/ | - )\s*/);
    if (parts.length > 2) return { value: v, review: 'producer has more than two parts' };
    if (parts.length === 2) s = `${parts[0]} (${parts[1]})`;
  }
  s = s.replace(/^(?:Mr|Mrs|Ms)\.?\s+/, '') // roaster marketing, not the name (user, 2026-11-16)
    .replace(/\bFcs\b/g, 'FCS').replace(/\bAka\b/g, 'aka')
    .replace(/(^|\s)(['"])(\p{Ll})/gu, (_, a, q, c) => a + q + c.toUpperCase()); // 'pikudo' -> 'Pikudo'
  return { value: s.replace(/\s+and\s+/gi, ' & ') };
}

const FARM_WORD = /^(?:fincas?|hacienda|granja|estate)\b|farm$/i;
export function splitProducerFarm(
  producer: string, farm: string | null, knownFarms: string[]
): { producer: string; farm: string } | { review: string } | null {
  if (farm?.trim()) return null;
  const m = /^(.*)(\s-\s|,\s|\s\/\s|\s\/\/\s)(.+)$/.exec(producer);
  if (!m) return null;
  const tail = m[3].trim();
  const known = knownFarms.find((k) => fold(k) === fold(tail));
  if (known || FARM_WORD.test(tail)) return { producer: m[1].trim(), farm: known ?? tail };
  return m[2] === ' - ' ? { review: `producer split at " - " but "${tail}" is not a farm` } : null;
}

export function standardizeField(field: StdField, value: string | null, site?: string | null): Std {
  const v = value?.trim() ?? '';
  if (!v || PLACEHOLDER.test(v)) return { value: null };
  let r: Std;
  switch (field) {
    case 'elevation': r = elevation(v); break;
    case 'harvest_time': r = harvest(v); break;
    case 'roast_level': r = roast(v); break;
    case 'processing': r = processing(v); break;
    case 'variety': r = variety(v); break;
    case 'producer': r = producer(v); break;
    case 'region': r = { value: dedupe(splitList(v)).join(', ') }; break;
    case 'certification': r = { value: dedupe(splitList(v)).join(', ') }; break;
    case 'tasting_notes': r = { value: dedupe(v.split(/\s*[,;]\s*/).filter(Boolean).map(titleCase).map((n) => NOTE_ALIAS[n.toLowerCase()] ?? n)).join(', ') }; break;
    case 'origin': r = v.includes('/') ? { value: v, review: 'origin lists more than one country' } : { value: v }; break;
  }
  if (site && !r.review) {
    const s = standardizeField(field, site); // G1: the site's spelling wins on a case/accent-only difference
    if (s.value && !s.review && r.value && fold(s.value) === fold(r.value)) return { value: s.value };
  }
  return r;
}

// G1 across the whole site: a value matching a site spelling ignoring case/accents takes that spelling,
// and the accented spelling wins when the site has both (user, 2026-11-16).
const VOCAB_FIELDS = ['producer', 'farm', 'variety', 'region'];
export type Vocab = Map<string, string>;
const accents = (s: string) => s.length - s.normalize('NFD').replace(/\p{M}/gu, '').length;
export function buildVocab(rows: Record<string, unknown>[]): Vocab {
  const v: Vocab = new Map();
  for (const r of rows) for (const f of VOCAB_FIELDS) {
    if (typeof r[f] !== 'string') continue;
    for (const raw of (f === 'producer' || f === 'farm' ? [r[f] as string] : (r[f] as string).split(', '))) {
      const item = raw.trim(), k = `${f}:${fold(item)}`, cur = v.get(k);
      if (item && (!cur || accents(item.normalize('NFD')) > accents(cur.normalize('NFD')))) v.set(k, item);
    }
  }
  return v;
}
export function useVocab(field: string, value: string | null, vocab?: Vocab): string | null {
  if (!value || !vocab || !VOCAB_FIELDS.includes(field)) return value;
  // only to add accents: the vocab holds unconverted rows too, so it must not undo casing rules (`Aka` -> `aka`)
  const one = (x: string) => {
    const v = vocab.get(`${field}:${fold(x)}`);
    return v && accents(v.normalize('NFD')) > accents(x.normalize('NFD')) ? v : x;
  };
  return field === 'producer' || field === 'farm' ? one(value) : value.split(', ').map(one).join(', ');
}

// Bean Base drops accents ("Narino"); when the product page spells an item with more accents, take the page's spelling.
export function accentsFrom(value: string, text: string): string {
  const words = text.match(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu) ?? [];
  const one = (item: string) => {
    const n = item.split(/\s+/).length, f = fold(item);
    for (let i = 0; i + n <= words.length; i++) {
      const run = words.slice(i, i + n).join(' ');
      if (fold(run) === f && accents(run.normalize('NFD')) > accents(item.normalize('NFD'))) return run;
    }
    return item;
  };
  const whole = one(value);
  return whole !== value ? whole : value.split(', ').map(one).join(', ');
}

const FIELDS: StdField[] = ['origin', 'roast_level', 'processing', 'variety', 'region', 'elevation', 'harvest_time', 'certification', 'tasting_notes', 'producer'];
type Row = Record<string, unknown> & { id?: number };
export type Change = { field: string; from: unknown; to: unknown };
export type Review = { field: string; value: string; reason: string };

export function standardizeCoffee(row: Row, knownFarms: string[], vocab?: Vocab): { changes: Change[]; review: Review[] } {
  const changes: Change[] = [];
  const review: Review[] = [];
  const set = (field: string, to: unknown) => {
    const from = row[field] ?? null;
    if (to !== from) changes.push({ field, from, to });
  };
  const str = (f: string) => (typeof row[f] === 'string' ? (row[f] as string) : null);
  if (typeof row.cost === 'number') set('cost', roundCents(row.cost));
  for (const f of FIELDS) {
    if (!(f in row)) continue;
    let v = str(f);
    if (f === 'producer' && v && 'farm' in row) {
      const sp = splitProducerFarm(v, str('farm'), knownFarms);
      if (sp && 'review' in sp) { review.push({ field: f, value: v, reason: sp.review }); continue; }
      if (sp) { set('farm', sp.farm); v = sp.producer; }
    }
    let r = standardizeField(f, v);
    if (!r.review) r = { value: useVocab(f, r.value, vocab) };
    if (f === 'region' && r.value && str('origin')) { // no country in Region: Origin holds it
      const o = fold(standardizeField('origin', str('origin')).value ?? '');
      r = { value: r.value.split(', ').filter((x) => fold(x) !== o).join(', ') || null };
    }
    if (r.review) review.push({ field: f, value: v ?? '', reason: r.review });
    else set(f, r.value);
  }
  return { changes, review };
}

export function applyDataStandards(db: DatabaseSync, marker: string): { changes: number; review: number } | null {
  if (!db.prepare(`SELECT 1 FROM coffees LIMIT 1`).get()) return null;
  if (db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(marker)) return null;
  const rows = db.prepare(`SELECT * FROM coffees`).all() as Row[];
  const farms = [...new Set(rows.map((r) => (typeof r.farm === 'string' ? r.farm.trim() : '')).filter(Boolean))];
  const vocab = buildVocab(rows);
  let changes = 0, reviews = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const r = standardizeCoffee(row, farms, vocab);
      for (const c of r.changes) { // c.field comes from the fixed FIELDS list or cost/farm, never user input
        db.prepare(`UPDATE coffees SET ${c.field} = ? WHERE id = ?`).run(c.to as string | number | null, row.id as number);
        changes++;
      }
      for (const x of r.review) { reviews++; console.log(`data standards review: coffee ${row.id} ${x.field} "${x.value}": ${x.reason}`); }
    }
    db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(marker, new Date().toISOString());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  console.log(`data standards ${marker}: ${changes} changes, ${reviews} for review`);
  return { changes, review: reviews };
}

// --- Entry-point check (#76): what would the dialog show for this form / fill? ---
export type ProposeInput =
  | { mode: 'save'; values: Record<string, string>; fields: string[] }
  | { mode: 'fill'; values: Record<string, string>; incoming: Record<string, string> };

const LABELS: Record<string, string> = {
  ...COFFEE_ORIGIN_LABELS, roaster: 'Roaster', coffee_name: 'Coffee name', origin: 'Origin', roast_level: 'Roast level',
  processing: 'Processing', cost: 'Cost', amount_g: 'Weight', roast_date: 'Roast date'
};
const REJECTABLE = ['producer', 'farm', 'variety', 'processing', 'roast_level', 'region', 'certification', 'tasting_notes'];
// only these fields are checked; anything else a form or fill sends (image_url, amount_g, ...) is ignored
const isLocked = (f: string) => (LOCKED_FIELDS as readonly string[]).includes(f);

// A formatLocked result as text: blank for null, never the word "null".
const text = (r: { value: string | number | null }) => (r.value === null ? '' : String(r.value));

export function formatLocked(field: string, value: string | number | null): { value: string | number | null; ok: boolean } {
  const t = value === null ? '' : String(value).trim();
  if (!t) return { value: null, ok: true };
  if (field === 'cost') {
    const n = t.replace(/^\$/, '');
    return /^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(n) ? { value: roundCents(Number(n.replace(/,/g, ''))), ok: true } : { value: t, ok: false };
  }
  const r = standardizeField(field as StdField, t);
  return r.review ? { value: t, ok: false } : { value: r.value, ok: true }; // a placeholder (n/a, -) is null here: proposed blank, not blocked
}

export function proposeStandards(db: DatabaseSync, input: ProposeInput): StdRow[] {
  const coffees = db.prepare(`SELECT roaster, producer, farm, variety, region FROM coffees`).all() as Record<string, unknown>[];
  const vocab = buildVocab(coffees);
  const farms = [...new Set(coffees.map((c) => (typeof c.farm === 'string' ? c.farm.trim() : '')).filter(Boolean))];
  const roasters = new Map<string, { name: string; n: number }>(); // fold -> spelling (accented wins) + count under that exact name
  const perName = new Map<string, number>();
  for (const c of coffees) perName.set(c.roaster as string, (perName.get(c.roaster as string) ?? 0) + 1);
  for (const [name, n] of perName) {
    const cur = roasters.get(fold(name));
    if (!cur || accents(name.normalize('NFD')) > accents(cur.name.normalize('NFD'))) roasters.set(fold(name), { name, n });
  }

  const rows: StdRow[] = [];
  const val = (f: string) => (input.values[f] ?? '').trim();
  const add = (field: string, now: string | null, proposed: string | null, kind: StdRow['kind'], extra: Partial<StdRow> = {}) =>
    rows.push({ field, label: LABELS[field] ?? field, now, proposed, kind, ...extra });
  const roasterRow = (now: string | null, typed: string) => {
    const site = roasters.get(fold(typed));
    const proposed = site?.name ?? typed;
    if (proposed !== now) add('roaster', now, proposed, 'choice', { roasterCount: perName.get(proposed) ?? 0 });
  };

  if (input.mode === 'save') {
    for (const f of MISSING_KEY_FIELDS) if (!val(f)) add(f, null, null, 'missing');
    for (const f of input.fields.filter((x) => CHECKED_FIELDS.includes(x))) {
      const v = val(f);
      if (!v) continue;
      if (f === 'roaster') roasterRow(v, v);
      else if (isLocked(f)) {
        const r = formatLocked(f, v);
        if (!r.ok) add(f, v, null, 'blocked', { note: `${LABELS[f]} can't be converted` });
        else if (r.value === null) add(f, v, null, 'missing'); // a placeholder: leave it blank, same as an empty key field
        else if (text(r) !== v) add(f, v, text(r), 'locked');
      } else if (REJECTABLE.includes(f)) {
        let pv = v;
        if (f === 'producer') {
          const sp = splitProducerFarm(v, val('farm') || null, farms);
          if (sp && 'review' in sp) { add(f, v, null, 'unconverted', { note: sp.review }); continue; }
          if (sp) { pv = sp.producer; add('farm', null, useVocab('farm', sp.farm, vocab), 'choice'); }
        }
        const r = f === 'farm' ? { value: pv } as Std : standardizeField(f as StdField, pv);
        if (r.review) { add(f, v, null, 'unconverted', { note: r.review }); continue; }
        const proposed = useVocab(f, r.value, vocab);
        if (proposed !== v) add(f, v, proposed, 'choice');
      }
    }
    return rows;
  }

  for (const [f, raw] of Object.entries(input.incoming).filter(([k]) => CHECKED_FIELDS.includes(k))) {
    const inc = (raw ?? '').trim(), cur = val(f);
    if (!inc || !cur) continue;
    if (f === 'roaster') { roasterRow(cur, inc); continue; }
    if (isLocked(f)) {
      const a = formatLocked(f, cur), b = formatLocked(f, inc);
      if (!b.ok) continue; // an unformattable source value is never filled
      if (b.value === null) continue; // a placeholder source value is no value
      const bs = text(b);
      if (!a.ok) add(f, cur, bs, 'forced');
      else if (text(a) === bs) { if (cur !== bs) add(f, cur, bs, 'locked'); }
      else add(f, text(a), bs, 'choice');
    } else if (inc !== cur) add(f, cur, inc, 'choice');
  }
  return rows;
}
