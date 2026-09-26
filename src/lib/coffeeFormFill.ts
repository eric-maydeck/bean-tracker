// Pure decisions behind CoffeeForm's fill UI. Client-safe (no $lib/server
// imports) so the component can use it; unit-tested because there's no
// component-test layer (HANDOFF).

import type { CoffeeRow } from './types';

export type RestHistoryRow = Pick<CoffeeRow, 'id' | 'roaster' | 'roast_level' | 'rest_days_low' | 'rest_days_high'>;
export interface RestSuggestion {
  low: number;
  high: number;
  note: string;
}

// After a failed fill the URL field goes back to what it held before that
// fill; the tried URL is offered for saving anyway unless it's the same.
export function afterFailedFill(
  tried: string,
  lastFilled: string | null,
  original: string
): { revertTo: string; offer: string | null } {
  const revertTo = lastFilled ?? original;
  return { revertTo, offer: tried !== revertTo ? tried : null };
}

// ponytail: fixed table for the light end the user buys; add a level here
// when it needs a default.
export const REST_DEFAULTS: Record<string, [number, number]> = {
  Hyperlight: [70, 365],
  Ultralight: [42, 150],
  'Nordic Light': [28, 120],
  Nordic: [28, 90],
  Light: [14, 60]
};

// 1) the most common complete (low, high) pair among this roaster's coffees
// at this level; a tie goes to the newest coffee's pair (highest id: ids are
// insertion order; sheet-imported rows' created_at was backfilled from Bean
// Conqueror/roast dates, so it's approximate); 2) else the level's default;
// 3) else null.
export function suggestRest(
  roaster: string | null,
  roastLevel: string | null,
  history: RestHistoryRow[]
): RestSuggestion | null {
  if (!roastLevel) return null;
  const same = roaster ? history.filter((r) => r.roaster === roaster && r.roast_level === roastLevel) : [];
  const pairs = new Map<string, { low: number; high: number; n: number; newest: number }>();
  for (const r of same) {
    if (r.rest_days_low == null || r.rest_days_high == null) continue;
    const key = `${r.rest_days_low}/${r.rest_days_high}`;
    const p = pairs.get(key) ?? { low: r.rest_days_low, high: r.rest_days_high, n: 0, newest: -Infinity };
    p.n++;
    p.newest = Math.max(p.newest, r.id);
    pairs.set(key, p);
  }
  const best = [...pairs.values()].sort((a, b) => b.n - a.n || b.newest - a.newest)[0];
  if (best) {
    const basis = best.n === same.length ? `your ${best.n}` : `${best.n} of your ${same.length}`;
    return {
      low: best.low,
      high: best.high,
      note: `Typical rest for ${roaster} ${roastLevel} coffees: ${best.low} to ${best.high} days (based on ${basis}).`
    };
  }
  const d = REST_DEFAULTS[roastLevel];
  return d ? { low: d[0], high: d[1], note: `Typical rest for ${roastLevel} coffees: ${d[0]} to ${d[1]} days.` } : null;
}

// A suggestion may only land on empty rest fields, or on fields still
// holding the previous suggestion untouched: typed or saved values win.
export function canReplaceRest(low: string, high: string, last: { low: number; high: number } | null): boolean {
  if (low.trim() === '' && high.trim() === '') return true;
  return last != null && low.trim() === String(last.low) && high.trim() === String(last.high);
}

// True when any field differs from the baseline snapshot — including a
// checkbox becoming present/absent (FormData omits an unchecked one
// entirely). Used to skip applying "no edits happened" as a pointless
// staged update.
export function fieldsChanged(current: Record<string, string>, baseline: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    if (current[key] !== baseline[key]) return true;
  }
  return false;
}
