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
