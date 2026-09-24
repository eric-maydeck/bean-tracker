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
