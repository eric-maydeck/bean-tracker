import type { DatabaseSync } from 'node:sqlite';

const MAX_VALUES = 6;
const LISTS = {
  doses: { key: 'brew_now_doses', min: 5, max: 40, noun: 'dose', unit: ' g' },
  ratios: { key: 'brew_now_ratios', min: 10, max: 20, noun: 'ratio', unit: '' }
} as const;
type ListName = keyof typeof LISTS;
const DEFAULT_DOSES = [15, 18, 20];
const DEFAULT_RATIOS = [15, 16, 17];

// 1–6 numbers in range, comma/space separated; stored sorted and unique.
function parseList(name: ListName, raw: string): number[] | { error: string } {
  const { min, max, noun, unit } = LISTS[name];
  const parts = raw.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < min || n > max)) return { error: `Each ${noun} must be ${min}–${max}${unit}` };
  const list = [...new Set(parts)].sort((a, b) => a - b);
  if (list.length < 1 || list.length > MAX_VALUES) return { error: `Enter 1–${MAX_VALUES} ${noun}s` };
  return list;
}

export function parseBrewDoses(raw: string): { doses: number[] } | { error: string } {
  const p = parseList('doses', raw);
  return 'error' in p ? p : { doses: p };
}

export function parseBrewRatios(raw: string): { ratios: number[] } | { error: string } {
  const p = parseList('ratios', raw);
  return 'error' in p ? p : { ratios: p };
}

function stored(db: DatabaseSync, name: ListName): number[] | null {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(LISTS[name].key) as { value: string } | undefined;
  if (!row) return null;
  try {
    const p = parseList(name, JSON.parse(row.value).join(' '));
    return 'error' in p ? null : p;
  } catch {
    return null;
  }
}

function store(db: DatabaseSync, name: ListName, list: number[]): void {
  db.prepare(
    `INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(LISTS[name].key, JSON.stringify(list));
}

export const getBrewDoses = (db: DatabaseSync): number[] => stored(db, 'doses') ?? DEFAULT_DOSES;
export const setBrewDoses = (db: DatabaseSync, doses: number[]): void => store(db, 'doses', doses);

// The three ratios (water ÷ coffee, rounded to 0.5) of the most rated BQ brews in the last year.
function derivedRatios(db: DatabaseSync): number[] {
  const rows = db.prepare(
    `SELECT ROUND(water_amount_g / ground_coffee_g * 2) / 2 AS r FROM beanconqueror_brews
     WHERE rating > 0 AND ground_coffee_g > 0 AND water_amount_g > 0 AND bc_created_at >= date('now', '-365 days')
       AND r BETWEEN ? AND ?
     GROUP BY r ORDER BY COUNT(*) DESC, r LIMIT 3`
  ).all(LISTS.ratios.min, LISTS.ratios.max) as { r: number }[];
  return rows.length ? rows.map((x) => x.r).sort((a, b) => a - b) : DEFAULT_RATIOS;
}

// Derived live until the first edit stores the list.
export function getBrewRatios(db: DatabaseSync): { ratios: number[]; derived: boolean } {
  const s = stored(db, 'ratios');
  return s ? { ratios: s, derived: false } : { ratios: derivedRatios(db), derived: true };
}

// Add or remove one value; returns an error message, or undefined when saved.
export function editBrewList(db: DatabaseSync, name: ListName, op: 'add' | 'remove', raw: string): string | undefined {
  const n = Number(raw.trim());
  const current = name === 'doses' ? getBrewDoses(db) : getBrewRatios(db).ratios;
  if (op === 'remove') {
    const next = current.filter((x) => x !== n);
    if (!next.length) return 'Keep at least one';
    store(db, name, next);
    return;
  }
  if (!raw.trim() || !Number.isFinite(n)) return `Enter a ${LISTS[name].noun}`;
  if (!current.includes(n) && current.length >= MAX_VALUES) return `A list holds at most ${MAX_VALUES}`;
  const next = parseList(name, [...current, n].join(' '));
  if ('error' in next) return next.error;
  store(db, name, next);
}
