import { COFFEE_ORIGIN_LABELS } from './types.ts';

// Shared by the standards check endpoint (server) and the review dialog (browser). #76
// choice: approve/reject. locked: format-only change, read-only, never opens the dialog alone.
// forced: locked, Now unformattable, Proposed formatted, read-only. blocked: locked and unformattable, gates Save.
// unconverted: rejectable but unparseable, info only, saves as typed. missing: blank key field, needs "Leave blank".
export type StdRowKind = 'choice' | 'locked' | 'forced' | 'blocked' | 'unconverted' | 'missing';
export interface StdRow {
  field: string; label: string;
  now: string | null; proposed: string | null;
  kind: StdRowKind;
  note?: string;          // review reason
  roasterCount?: number;  // coffees already saved under `proposed` (roaster rows only)
}
export const LOCKED_FIELDS = ['elevation', 'origin', 'cost', 'harvest_time'] as const;
export const MISSING_KEY_FIELDS = ['roast_date', 'cost', 'amount_g'] as const;

// Fields the server checks (standards.ts CHECKED): a non-blank form value in one of these is never overwritten by a fill without a dialog row.
export const CHECKED_FIELDS: readonly string[] = ['roaster', 'coffee_name', 'origin', 'roast_level', 'processing', 'cost', ...Object.keys(COFFEE_ORIGIN_LABELS)];

// The dialog lists rows in the form's own field order.
const FORM_ORDER = ['roaster', 'coffee_name', 'origin', 'region', 'producer', 'farm', 'variety', 'processing', 'elevation', 'harvest_time', 'certification', 'tasting_notes', 'roast_level', 'amount_g', 'cost', 'roast_date'];
export const inFormOrder = (rows: StdRow[]): StdRow[] =>
  [...rows].sort((a, b) => FORM_ORDER.indexOf(a.field) - FORM_ORDER.indexOf(b.field));

export type Decision = 'approve' | 'reject' | 'leave';

// Locked rows are format-only and never open the dialog on their own.
export const needsDialog = (rows: StdRow[]) => rows.some((r) => r.kind !== 'locked');

// Tooltip text for a blocked Save, or null when Save is allowed.
export function saveBlock(rows: StdRow[], d: Record<string, Decision>): string | null {
  const blocked = rows.filter((r) => r.kind === 'blocked');
  if (blocked.length) return blocked.map((r) => `${r.label} "${r.now ?? ''}" can't be converted: Cancel and fix it in the form`).join('. ');
  const labels = (kind: StdRowKind) => rows.filter((r) => r.kind === kind && !d[r.field]).map((r) => r.label).join(', ');
  const parts = [['Approve or reject', labels('choice')], ['Leave blank', labels('missing')]].filter(([, l]) => l).map(([t, l]) => `${t}: ${l}`);
  return parts.length ? parts.join('. ') : null;
}

// field -> value to write: approve/locked/forced take Proposed; reject/unconverted/blocked keep Now; missing is blank.
export function resolve(rows: StdRow[], d: Record<string, Decision>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const keepNow = r.kind === 'unconverted' || r.kind === 'blocked' || (r.kind === 'choice' && d[r.field] === 'reject');
    out[r.field] = r.kind === 'missing' ? '' : ((keepNow ? r.now : r.proposed) ?? '');
  }
  return out;
}
