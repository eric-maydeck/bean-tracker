// Coffees page filters: pure logic, no Svelte. The components in
// src/lib/components/Filter*.svelte stay thin; everything testable is here.
import type { CoffeeWithComputed } from './server/urgency';

export type ColumnKey =
  | 'roaster'
  | 'coffee_name'
  | 'origin'
  | 'processing'
  | 'roast_level'
  | 'decaf'
  | 'frozen'
  | 'cost_per_gram'
  | 'amount_g'
  | 'roast_date'
  | 'frozen_start_date'
  | 'frozen_end_date'
  | 'rest_window'
  | 'urgency';

export type ColumnKind = 'text' | 'bool' | 'number' | 'date' | 'window';

export interface Column {
  key: ColumnKey;
  label: string; // full name: editor heading and chip title
  short: string; // chip name
  kind: ColumnKind;
}

export const COLUMNS: readonly Column[] = [
  { key: 'roaster', label: 'Roaster', short: 'Roaster', kind: 'text' },
  { key: 'coffee_name', label: 'Coffee name', short: 'Name', kind: 'text' },
  { key: 'origin', label: 'Origin', short: 'Origin', kind: 'text' },
  { key: 'processing', label: 'Processing', short: 'Process', kind: 'text' },
  { key: 'roast_level', label: 'Roast level', short: 'Roast', kind: 'text' },
  { key: 'decaf', label: 'Decaf', short: 'Decaf', kind: 'bool' },
  { key: 'frozen', label: 'Frozen', short: 'Frozen', kind: 'bool' },
  { key: 'cost_per_gram', label: 'Cost/g', short: 'Cost/g', kind: 'number' },
  { key: 'amount_g', label: 'Weight', short: 'Weight', kind: 'number' },
  { key: 'roast_date', label: 'Roast date', short: 'Roasted', kind: 'date' },
  { key: 'frozen_start_date', label: 'Frozen date', short: 'Frozen on', kind: 'date' },
  { key: 'frozen_end_date', label: 'Unfrozen date', short: 'Thawed', kind: 'date' },
  { key: 'rest_window', label: 'Rest window', short: 'Rest', kind: 'window' },
  { key: 'urgency', label: 'Urgency', short: 'Urgency', kind: 'number' }
];

export function column(key: ColumnKey): Column {
  return COLUMNS.find((c) => c.key === key)!;
}

export type Op = '>' | '>=' | '=' | '<=' | '<' | 'between';
export const OPS: readonly Op[] = ['>', '>=', '=', '<=', '<', 'between'];
export const OP_LABELS: Record<Op, string> = { '>': '>', '>=': '≥', '=': '=', '<=': '≤', '<': '<', between: 'between' };
export const DATE_OP_LABELS: Record<Op, string> = {
  '>': 'after',
  '>=': 'on or after',
  '=': 'on',
  '<=': 'on or before',
  '<': 'before',
  between: 'between'
};

// `null` in `values` is the "(none)" entry. `a`/`b` hold what was typed
// (number-input or YYYY-MM-DD strings); `b` is '' unless between/overlaps.
export type Filter =
  | { column: ColumnKey; mode: 'any'; values: (string | null)[] }
  | { column: ColumnKey; mode: 'contains'; text: string }
  | { column: ColumnKey; mode: 'bool'; value: boolean }
  | { column: ColumnKey; mode: 'range'; op: Op; a: string; b: string }
  | { column: ColumnKey; mode: 'includes'; a: string }
  | { column: ColumnKey; mode: 'overlaps'; a: string; b: string };

type TextKey = 'roaster' | 'coffee_name' | 'origin' | 'processing' | 'roast_level';
type DateKey = 'roast_date' | 'frozen_start_date' | 'frozen_end_date';

export function isFrozen(c: Pick<CoffeeWithComputed, 'frozen_start_date' | 'frozen_end_date'>): boolean {
  return Boolean(c.frozen_start_date && !c.frozen_end_date);
}

// '' is treated like null: both are "(none)".
export function textValue(c: CoffeeWithComputed, key: ColumnKey): string | null {
  return c[key as TextKey] || null;
}

function numberValue(c: CoffeeWithComputed, key: ColumnKey): number | null {
  if (key === 'cost_per_gram') return c.cost_per_gram;
  if (key === 'amount_g') return c.amount_g;
  return typeof c.urgency_rating === 'number' ? c.urgency_rating : null; // 'Done' never matches
}

// Compare at the precision the Coffees page shows: cost/g as $0.085
// (toFixed(3)), weight and urgency as whole numbers.
function displayed(key: ColumnKey, v: number): number {
  return key === 'cost_per_gram' ? Number(v.toFixed(3)) : Math.round(v);
}

function compare<T extends number | string>(v: T, op: Op, a: T, b: T): boolean {
  switch (op) {
    case '>':
      return v > a;
    case '>=':
      return v >= a;
    case '=':
      return v === a;
    case '<=':
      return v <= a;
    case '<':
      return v < a;
    case 'between':
      return v >= a && v <= b;
  }
}

function matches(c: CoffeeWithComputed, f: Filter): boolean {
  switch (f.mode) {
    case 'any':
      return f.values.includes(textValue(c, f.column));
    case 'contains': {
      const v = textValue(c, f.column);
      return v !== null && v.toLowerCase().includes(f.text.toLowerCase());
    }
    case 'bool':
      return (f.column === 'decaf' ? c.decaf === 1 : isFrozen(c)) === f.value;
    case 'range': {
      if (column(f.column).kind === 'date') {
        const v = c[f.column as DateKey];
        return !!v && compare(v, f.op, f.a, f.b);
      }
      const v = numberValue(c, f.column);
      if (v === null) return false;
      const r = (x: number) => displayed(f.column, x);
      return compare(r(v), f.op, r(Number(f.a)), r(Number(f.b)));
    }
    case 'includes':
      return !!c.drink_after && !!c.drink_before && c.drink_after <= f.a && f.a <= c.drink_before;
    case 'overlaps':
      return !!c.drink_after && !!c.drink_before && c.drink_after <= f.b && c.drink_before >= f.a;
  }
}

export function applyFilters<T extends CoffeeWithComputed>(coffees: T[], filters: Filter[]): T[] {
  return filters.length ? coffees.filter((c) => filters.every((f) => matches(c, f))) : coffees;
}

// Run on Apply: From later than To is swapped rather than rejected.
export function normalizeFilter(f: Filter): Filter {
  if (f.mode === 'contains') return { ...f, text: f.text.trim() };
  if (f.mode === 'overlaps' && f.a > f.b) return { ...f, a: f.b, b: f.a };
  if (f.mode === 'range' && f.op === 'between') {
    const reversed = column(f.column).kind === 'date' ? f.a > f.b : Number(f.a) > Number(f.b);
    if (reversed) return { ...f, a: f.b, b: f.a };
  }
  return f;
}

export interface ValueCount {
  value: string | null;
  count: number;
}

// The "Is any of" list for the current status tab. `selected` values that
// no coffee in the tab has stay listed at 0 so they can still be unchecked.
export function valueCounts(
  coffees: CoffeeWithComputed[],
  key: ColumnKey,
  selected: (string | null)[] = []
): ValueCount[] {
  const counts = new Map<string | null, number>();
  for (const v of selected) counts.set(v, 0);
  for (const c of coffees) {
    const v = textValue(c, key);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((x, y) =>
      x.value === null ? 1 : y.value === null ? -1 : x.value.localeCompare(y.value, undefined, { sensitivity: 'base' })
    );
}

export function isComplete(f: Filter): boolean {
  switch (f.mode) {
    case 'any':
      return f.values.length > 0;
    case 'contains':
      return f.text.trim() !== '';
    case 'bool':
      return true;
    case 'range':
      return f.a !== '' && (f.op !== 'between' || f.b !== '');
    case 'includes':
      return f.a !== '';
    case 'overlaps':
      return f.a !== '' && f.b !== '';
  }
}

// One filter per column: re-applying a column replaces it where it sits.
export function upsertFilter(filters: Filter[], f: Filter): Filter[] {
  return filters.some((x) => x.column === f.column)
    ? filters.map((x) => (x.column === f.column ? f : x))
    : [...filters, f];
}

// Dates are split from the stored YYYY-MM-DD string: no Date, no timezone shift.
function mmddyy(d: string): string {
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y.slice(2)}`;
}

function shortRange(a: string, b: string): string {
  return a.slice(0, 4) === b.slice(0, 4) ? `${mmddyy(a).slice(0, 5)}–${mmddyy(b)}` : `${mmddyy(a)}–${mmddyy(b)}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function longDate(d: string, withYear = true): string {
  const [y, m, day] = d.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(day)}${withYear ? `, ${y}` : ''}`;
}

function longRange(a: string, b: string): string {
  return `${longDate(a, a.slice(0, 4) !== b.slice(0, 4))} – ${longDate(b)}`;
}

function num(key: ColumnKey, typed: string): string {
  if (key === 'cost_per_gram') return `$${typed}`;
  if (key === 'amount_g') return `${typed}g`;
  return typed;
}

const valueNames = (values: (string | null)[]) => values.map((v) => v ?? '(none)');

export function chipLabel(f: Filter): string {
  return `${column(f.column).short}: ${chipValue(f)}`;
}

function chipValue(f: Filter): string {
  switch (f.mode) {
    case 'any': {
      const names = valueNames(f.values);
      return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    }
    case 'contains':
      return `*${f.text}*`;
    case 'bool':
      return f.value ? 'Yes' : 'No';
    case 'includes':
      return mmddyy(f.a);
    case 'overlaps':
      return shortRange(f.a, f.b);
    case 'range': {
      const isDate = column(f.column).kind === 'date';
      if (f.op === 'between') return isDate ? shortRange(f.a, f.b) : `${num(f.column, f.a)}–${num(f.column, f.b)}`;
      const symbol = f.op === '=' ? '' : `${OP_LABELS[f.op]} `; // `=` is implied
      return symbol + (isDate ? mmddyy(f.a) : num(f.column, f.a));
    }
  }
}

const NUMBER_OP_WORDS: Record<Op, string> = {
  '>': 'greater than',
  '>=': 'at least',
  '=': 'equals',
  '<=': 'at most',
  '<': 'less than',
  between: 'between'
};

export function chipTitle(f: Filter): string {
  const name = column(f.column).label;
  switch (f.mode) {
    case 'any':
      return `${name} is any of ${valueNames(f.values).join(', ')}`;
    case 'contains':
      return `${name} contains "${f.text}"`;
    case 'bool':
      return `${name} is ${f.value ? 'Yes' : 'No'}`;
    case 'includes':
      return `${name} includes ${longDate(f.a)}`;
    case 'overlaps':
      return `${name} overlaps ${longRange(f.a, f.b)}`;
    case 'range':
      if (column(f.column).kind === 'date') {
        return f.op === 'between'
          ? `${name} between ${longRange(f.a, f.b)}`
          : `${name} ${DATE_OP_LABELS[f.op]} ${longDate(f.a)}`;
      }
      return f.op === 'between'
        ? `${name} between ${num(f.column, f.a)} and ${num(f.column, f.b)}`
        : `${name} ${NUMBER_OP_WORDS[f.op]} ${num(f.column, f.a)}`;
  }
}
