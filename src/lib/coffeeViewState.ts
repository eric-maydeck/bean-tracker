import { pickMany } from './pageUrlState';
import { COLUMNS, isComplete, isValidFilter, normalizeFilter, upsertFilter, type ColumnKey, type Filter, type Op } from './coffeeFilters';

// The Coffees page's shareable view state. Only explicit choices are kept:
// an undefined field is "untouched" — the page applies its default and the
// URL leaves it out. Inline edit state (edit mode, pending edits, the Add
// form, the expanded row) deliberately has no field here, so it can never
// reach a URL.
export const STATUS_TABS = ['backlog', 'open', 'archive', 'all'] as const;
export type StatusTab = (typeof STATUS_TABS)[number];
export const STATUSES = ['backlog', 'open', 'archive'] as const;
export type Status = (typeof STATUSES)[number];
export const VIEWS = ['cards', 'list', 'compact'] as const;
export type CoffeeView = (typeof VIEWS)[number];
export const SORT_KEYS = [
  'roaster', 'coffee_name', 'origin', 'roast_level', 'decaf', 'processing', 'cost_per_gram', 'amount_g',
  'roast_date', 'frozen_start_date', 'frozen_end_date', 'rest_window', 'urgency', 'created_at', 'updated_at'
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export interface CoffeeViewState {
  // ['all'] or a non-empty subset of STATUSES in order; undefined = untouched (Backlog).
  status?: StatusTab[];
  // The selection before All was tapped, so All-off can restore it. Remembered
  // with the view state but never in the URL (toParams ignores it).
  prev?: Status[];
  query?: string;
  sort?: { key: SortKey; dir: SortDir };
  view?: CoffeeView;
  filters: Filter[];
}

const NONE = '(none)';
const RANGE_OP = /^(>=|<=|>|<|=)(.*)$/;

function oneOf<T extends string>(allowed: readonly T[], v: string | null): T | undefined {
  if (v === null) return undefined;
  const lower = v.toLowerCase();
  return allowed.find((a) => a === lower);
}

function escapeValue(v: string): string {
  return v === NONE || v.startsWith('~') || v.startsWith('\\') ? `\\${v}` : v;
}

function encodeFilter(f: Filter): string[] {
  switch (f.mode) {
    case 'any':
      return f.values.map((v) => (v === null ? NONE : escapeValue(v)));
    case 'contains':
      return [`~${f.text}`];
    case 'bool':
      // bc reads as a yes/no question in a URL; decaf/frozen keep true/false.
      return [f.column === 'bc' ? (f.value ? 'yes' : 'no') : String(f.value)];
    case 'range':
      return [f.op === 'between' ? `between:${f.a}..${f.b}` : `${f.op}${f.a}`];
    case 'includes':
      return [`includes:${f.a}`];
    case 'overlaps':
      return [`overlaps:${f.a}..${f.b}`];
  }
}

export function toParams(s: CoffeeViewState): URLSearchParams {
  const p = new URLSearchParams();
  for (const v of s.status ?? []) p.append('status', v);
  if (s.query) p.set('q', s.query);
  if (s.sort) p.set('sort', `${s.sort.key}.${s.sort.dir}`);
  if (s.view) p.set('view', s.view);
  for (const f of s.filters) for (const v of encodeFilter(f)) p.append(f.column, v);
  return p;
}

function splitPair(rest: string): [string, string] | null {
  const i = rest.indexOf('..');
  return i < 0 ? null : [rest.slice(0, i), rest.slice(i + 2)];
}

function withPrefix(v: string, prefix: string): string | null {
  return v.toLowerCase().startsWith(prefix) ? v.slice(prefix.length) : null;
}

function decodeFilter(key: ColumnKey, raw: string[], known: string[] | undefined): Filter | null {
  const kind = COLUMNS.find((c) => c.key === key)!.kind;
  const first = raw[0];
  switch (kind) {
    case 'text': {
      if (raw.length === 1 && first.startsWith('~')) return { column: key, mode: 'contains', text: first.slice(1) };
      const values = raw.map((v) => {
        if (v === NONE) return null;
        const plain = v.startsWith('\\') ? v.slice(1) : v;
        return known?.find((k) => k.toLowerCase() === plain.toLowerCase()) ?? plain;
      });
      return { column: key, mode: 'any', values };
    }
    case 'bool': {
      const b = oneOf(['true', 'false', 'yes', 'no'] as const, first);
      return b ? { column: key, mode: 'bool', value: b === 'true' || b === 'yes' } : null;
    }
    case 'number':
    case 'date': {
      const between = withPrefix(first, 'between:');
      if (between !== null) {
        const pair = splitPair(between);
        return pair ? { column: key, mode: 'range', op: 'between', a: pair[0], b: pair[1] } : null;
      }
      const m = RANGE_OP.exec(first);
      return m ? { column: key, mode: 'range', op: m[1] as Op, a: m[2], b: '' } : null;
    }
    case 'window': {
      const inc = withPrefix(first, 'includes:');
      if (inc !== null) return { column: key, mode: 'includes', a: inc };
      const ov = withPrefix(first, 'overlaps:');
      const pair = ov === null ? null : splitPair(ov);
      return pair ? { column: key, mode: 'overlaps', a: pair[0], b: pair[1] } : null;
    }
  }
}

export function fromParams(p: URLSearchParams, known: Partial<Record<ColumnKey, string[]>> = {}): CoffeeViewState {
  const s: CoffeeViewState = { filters: [] };
  const status = pickMany(p, 'status', STATUS_TABS);
  if (status) s.status = status.includes('all') ? ['all'] : status;
  const q = p.get('q');
  if (q) s.query = q;
  const view = oneOf(VIEWS, p.get('view'));
  if (view) s.view = view;
  const sort = p.get('sort');
  if (sort) {
    const dot = sort.lastIndexOf('.');
    const key = oneOf(SORT_KEYS, sort.slice(0, dot));
    const dir = oneOf(['asc', 'desc'] as const, sort.slice(dot + 1));
    if (dot > 0 && key && dir) s.sort = { key, dir };
  }
  for (const c of COLUMNS) {
    const raw = p.getAll(c.key);
    if (!raw.length) continue;
    const f = decodeFilter(c.key, raw, known[c.key]);
    if (f && isValidFilter(f)) {
      const n = normalizeFilter(f);
      if (isComplete(n)) s.filters = upsertFilter(s.filters, n);
    }
  }
  return s;
}

// Reset clears everything but the status selection (and its All-off restore).
export function resetView(s: CoffeeViewState): CoffeeViewState {
  return s.status ? { filters: [], status: s.status, ...(s.prev && { prev: s.prev }) } : { filters: [] };
}

// A tap on a status button. All is exclusive (off restores `prev`, else Backlog);
// the last lit status stays on.
export function toggleStatus(lit: StatusTab[], tapped: StatusTab, prev: Status[] | null): StatusTab[] {
  if (tapped === 'all') return lit[0] === 'all' ? (prev?.length ? prev : ['backlog']) : ['all'];
  const on = lit[0] === 'all' ? [] : lit;
  const next = on.includes(tapped) ? on.filter((x) => x !== tapped) : [...on, tapped];
  return next.length ? STATUS_TABS.filter((x) => next.includes(x)) : lit[0] === 'all' ? [tapped] : lit;
}

export function litStatuses(status: StatusTab[] | undefined): Status[] {
  return !status ? ['backlog'] : status[0] === 'all' ? [...STATUSES] : (status as Status[]);
}

export function isUntouched(s: CoffeeViewState): boolean {
  return !s.status && !s.query && !s.sort && !s.view && s.filters.length === 0;
}

// One key for all remembered Coffees view state, 12h since last use.
// Replaces the older per-field keys (deleted by the page on load). Bump the
// version if the stored shape changes: an unknown version is ignored.
export const VIEW_STORAGE_KEY = 'bean-tracker-coffee-view-state';
export const LEGACY_STORAGE_KEYS = [
  'bean-tracker-coffee-filters', 'bean-tracker-filter', 'bean-tracker-sort-key', 'bean-tracker-sort-dir', 'bean-tracker-view'
] as const;
export const VIEW_TTL_MS = 12 * 60 * 60 * 1000;
const VIEW_STATE_VERSION = 2;

export function loadViewState(raw: string | null, now: number): CoffeeViewState {
  const empty: CoffeeViewState = { filters: [] };
  if (!raw) return empty;
  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return empty;
  if (saved.version !== VIEW_STATE_VERSION) return empty;
  if (typeof saved.lastUsed !== 'number' || now - saved.lastUsed > VIEW_TTL_MS) return empty;
  // Re-validate through the URL codec so saved and linked state share one gate.
  const p = typeof saved.params === 'string' ? new URLSearchParams(saved.params) : new URLSearchParams();
  const out = fromParams(p);
  const prev = Array.isArray(saved.prev) ? STATUSES.filter((x) => (saved.prev as unknown[]).includes(x)) : [];
  if (out.status?.[0] === 'all' && prev.length) out.prev = prev;
  return out;
}

export function serializeViewState(s: CoffeeViewState, now: number): string {
  return JSON.stringify({ version: VIEW_STATE_VERSION, params: toParams(s).toString(), lastUsed: now, ...(s.prev && { prev: s.prev }) });
}
