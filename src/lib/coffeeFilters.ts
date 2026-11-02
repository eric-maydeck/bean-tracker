// Coffees page filters: pure logic, no Svelte. The components in
// src/lib/components/Filter*.svelte stay thin; everything testable is here.
import type { CoffeeWithComputed } from './server/urgency';

export type ColumnKey =
  | 'roaster'
  | 'coffee_name'
  | 'origin'
  | 'producer'
  | 'variety'
  | 'processing'
  | 'roast_level'
  | 'decaf'
  | 'frozen'
  | 'bc'
  | 'cost_per_gram'
  | 'amount_g'
  | 'roast_date'
  | 'frozen_start_date'
  | 'frozen_end_date'
  | 'rest_window'
  | 'urgency'
  | 'age'
  | 'rest_state'
  | 'subscription';

export type ColumnKind = 'text' | 'bool' | 'number' | 'date' | 'window' | 'plan';

export interface Column {
  key: ColumnKey;
  label: string; // full name: editor heading and chip title
  short: string; // chip name
  kind: ColumnKind;
  unit?: string; // shown in parens in the filter editor only, e.g. "Weight (g)"
}

export const COLUMNS: readonly Column[] = [
  { key: 'roaster', label: 'Roaster', short: 'Roaster', kind: 'text' },
  { key: 'coffee_name', label: 'Coffee name', short: 'Name', kind: 'text' },
  { key: 'origin', label: 'Origin', short: 'Origin', kind: 'text' },
  { key: 'producer', label: 'Producer', short: 'Producer', kind: 'text' },
  { key: 'variety', label: 'Variety', short: 'Variety', kind: 'text' },
  { key: 'processing', label: 'Processing', short: 'Process', kind: 'text' },
  { key: 'roast_level', label: 'Roast level', short: 'Roast', kind: 'text' },
  { key: 'decaf', label: 'Decaf', short: 'Decaf', kind: 'bool' },
  { key: 'frozen', label: 'Frozen', short: 'Frozen', kind: 'bool' },
  { key: 'bc', label: 'In Bean Conqueror', short: 'In BQ', kind: 'bool' },
  { key: 'cost_per_gram', label: 'Cost/g', short: 'Cost/g', kind: 'number' },
  { key: 'amount_g', label: 'Weight', short: 'Weight', kind: 'number', unit: 'g' },
  { key: 'roast_date', label: 'Roast date', short: 'Roasted', kind: 'date' },
  { key: 'frozen_start_date', label: 'Frozen date', short: 'Frozen on', kind: 'date' },
  { key: 'frozen_end_date', label: 'Unfrozen date', short: 'Thawed', kind: 'date' },
  { key: 'rest_window', label: 'Rest window', short: 'Rest', kind: 'window' },
  { key: 'urgency', label: 'Urgency', short: 'Urgency', kind: 'number' },
  // Days since roast minus freezer days (an open freeze stops the count): the On hand age profile's age.
  { key: 'age', label: 'Age', short: 'Age', kind: 'number', unit: 'days' },
  // Open and backlog bags against the roaster's rest window, on that same age.
  { key: 'rest_state', label: 'Rest state', short: 'Rest state', kind: 'text' },
  { key: 'subscription', label: 'Subscription', short: 'Plan', kind: 'plan' }
];

export function column(key: ColumnKey): Column {
  return COLUMNS.find((c) => c.key === key)!;
}

export type QuickFilterKey = 'decaf' | 'frozen' | 'bc';

// A quick filter's three segments: "All" (null = no filter) plus the two
// bool values, in display order. `chipTitle` only exists for the two real
// values -- "All" never has a chip. The component and chip text both read
// from here so the wording only lives in one place.
export interface QuickFilterSegment {
  value: boolean | null;
  label: string;
  chipTitle?: string;
}

export interface QuickFilter {
  column: QuickFilterKey;
  switchLabel: string; // the switch's visible/aria label, e.g. "Caffeinated"
  chipLabel?: string; // short form for the active-filter chip when switchLabel is long
  segments: readonly [QuickFilterSegment, QuickFilterSegment, QuickFilterSegment];
}

export const QUICK_FILTERS: readonly QuickFilter[] = [
  {
    column: 'decaf',
    switchLabel: 'Caffeinated',
    segments: [
      { value: null, label: 'All' },
      { value: false, label: 'Caffeinated only', chipTitle: 'Showing caffeinated coffees only' },
      { value: true, label: 'Decaf only', chipTitle: 'Showing decaf coffees only' }
    ]
  },
  {
    column: 'frozen',
    switchLabel: 'Frozen',
    segments: [
      { value: null, label: 'All' },
      { value: true, label: 'Frozen only', chipTitle: 'Showing frozen coffees only' },
      { value: false, label: 'Not frozen', chipTitle: 'Showing coffees not in the freezer' }
    ]
  },
  {
    column: 'bc',
    switchLabel: 'In Bean Conqueror',
    chipLabel: 'BQ', // Bean Conqueror's own abbreviation
    segments: [
      { value: null, label: 'All' },
      { value: true, label: 'Yes', chipTitle: 'Showing coffees in Bean Conqueror' },
      { value: false, label: 'No', chipTitle: 'Showing coffees not in Bean Conqueror' }
    ]
  }
];

export function quickFilter(key: QuickFilterKey): QuickFilter {
  return QUICK_FILTERS.find((q) => q.column === key)!;
}

function quickFilterSegment(key: QuickFilterKey, value: boolean): QuickFilterSegment {
  return quickFilter(key).segments.find((s) => s.value === value)!;
}

// The Subscription filter's value: any plan, no plan, or one plan by id.
export type PlanValue = 'any' | 'none' | number;
export interface PlanOption {
  id: number;
  label: string;
}

// A Subscription filter naming a plan that no longer exists (a deleted plan in an old URL or remembered view) would
// show a blank select and match nothing: it is dropped, so the select reads its default and the URL loses the param.
export const withoutStalePlans = <S extends { filters: Filter[] }>(s: S, plans: readonly PlanOption[]): S =>
  s.filters.some((f) => f.mode === 'plan' && typeof f.value === 'number' && !plans.some((p) => p.id === f.value))
    ? { ...s, filters: s.filters.filter((f) => !(f.mode === 'plan' && typeof f.value === 'number' && !plans.some((p) => p.id === f.value))) }
    : s;

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
  | { column: ColumnKey; mode: 'overlaps'; a: string; b: string }
  | { column: ColumnKey; mode: 'plan'; value: PlanValue };

type TextKey = 'roaster' | 'coffee_name' | 'origin' | 'producer' | 'variety' | 'processing' | 'roast_level' | 'rest_state';
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
  if (key === 'age') return c.days_since_roast;
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

function boolValue(c: CoffeeWithComputed, key: ColumnKey): boolean {
  if (key === 'decaf') return c.decaf === 1;
  if (key === 'bc') return c.in_bean_conqueror === 1;
  return isFrozen(c);
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
      return boolValue(c, f.column) === f.value;
    case 'plan':
      return f.value === 'any' ? c.subscription_id != null : f.value === 'none' ? c.subscription_id == null : c.subscription_id === f.value;
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
    case 'plan':
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

// Chips show formatted values, not the raw typed string (e.g. `.1` -> `$0.10`).
const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3
});

function num(key: ColumnKey, typed: string): string {
  const v = Number(typed);
  if (key === 'cost_per_gram') return CURRENCY.format(v);
  if (key === 'amount_g') return `${Math.round(v)}g`; // whole grams, matching the comparison precision
  if (key === 'age') return `${Math.round(v)}d`;
  return `${Math.round(v)}`; // urgency: whole number
}

const valueNames = (values: (string | null)[]) => values.map((v) => v ?? '(none)');

// A preview line names a quick filter by its value alone ("Not frozen"); the value says it all.
export const previewChip = (f: Filter, plans?: readonly PlanOption[]): string =>
  f.mode === 'bool' ? quickFilterSegment(f.column as QuickFilterKey, f.value).label : chipLabel(f, plans);

export const PLAN_ANY = 'Any plan';
export const PLAN_NONE = 'No plan';
// `plans` names a plan by id; an id with no match (a deleted plan) reads "Plan".
export const planName = (v: PlanValue, plans: readonly PlanOption[] = []): string =>
  v === 'any' ? PLAN_ANY : v === 'none' ? PLAN_NONE : (plans.find((p) => p.id === v)?.label ?? 'Plan');

export function chipLabel(f: Filter, plans?: readonly PlanOption[]): string {
  if (f.mode === 'plan') return `${column(f.column).short}: ${planName(f.value, plans)}`;
  if (f.mode === 'bool') {
    const qf = quickFilter(f.column as QuickFilterKey);
    return `${qf.chipLabel ?? qf.switchLabel}: ${quickFilterSegment(f.column as QuickFilterKey, f.value).label}`;
  }
  return `${column(f.column).short}: ${chipValue(f)}`;
}

function chipValue(f: Exclude<Filter, { mode: 'bool' | 'plan' }>): string {
  switch (f.mode) {
    case 'any': {
      const names = valueNames(f.values);
      return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    }
    case 'contains':
      return `*${f.text}*`;
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

export function chipTitle(f: Filter, plans?: readonly PlanOption[]): string {
  if (f.mode === 'plan') return `Subscription: ${planName(f.value, plans)}`;
  if (f.mode === 'bool') return quickFilterSegment(f.column as QuickFilterKey, f.value).chipTitle!;
  const name = column(f.column).label;
  switch (f.mode) {
    case 'any':
      return `${name} is any of ${valueNames(f.values).join(', ')}`;
    case 'contains':
      return `${name} contains "${f.text}"`;
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

const KNOWN_COLUMNS = new Set<unknown>(COLUMNS.map((c) => c.key));

// A saved or linked entry only has a known `column`, never that its `mode` and fields
// still fit that column's kind (e.g. old data, a hand-edited value, a future
// version's shape). Loading a mismatched entry crashed applyFilters/chipLabel
// (e.g. `{column:'origin',mode:'range'}` reading `.a`), so every shape is
// checked here rather than trusted from a known column alone.
function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

export function isValidFilter(f: unknown): f is Filter {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return false;
  const o = f as Record<string, unknown>;
  if (!KNOWN_COLUMNS.has(o.column)) return false;
  const kind = column(o.column as ColumnKey).kind;
  switch (o.mode) {
    case 'any':
      return kind === 'text' && Array.isArray(o.values) && o.values.every(isStringOrNull);
    case 'contains':
      return kind === 'text' && typeof o.text === 'string';
    case 'bool':
      return kind === 'bool' && typeof o.value === 'boolean';
    case 'range':
      return (
        (kind === 'number' || kind === 'date') &&
        typeof o.op === 'string' &&
        (OPS as readonly string[]).includes(o.op) &&
        typeof o.a === 'string' &&
        typeof o.b === 'string'
      );
    case 'includes':
      return kind === 'window' && typeof o.a === 'string';
    case 'overlaps':
      return kind === 'window' && typeof o.a === 'string' && typeof o.b === 'string';
    case 'plan':
      return kind === 'plan' && (o.value === 'any' || o.value === 'none' || (Number.isInteger(o.value) && (o.value as number) > 0));
    default:
      return false;
  }
}
