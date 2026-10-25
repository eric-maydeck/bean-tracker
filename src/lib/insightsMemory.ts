import { CHOICE_TTL_MS } from './rememberedChoice';

// /insights remembers its whole view state per browser for 12 h since last use (spec 2026-10-15 Part 3),
// versioned like coffeeViewState.ts: bump VERSION if the stored shape changes. Stored as the URL's query;
// restoring navigates to it, so the server parser stays the one gate for bad values.
export const INSIGHTS_STORAGE_KEY = 'bean-tracker-insights-view-state';
const VERSION = 2;

export function loadInsightsState(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as { version?: unknown; params?: unknown; lastUsed?: unknown } | null;
    if (!s || typeof s !== 'object' || s.version !== VERSION || typeof s.lastUsed !== 'number') return null;
    return now - s.lastUsed <= CHOICE_TTL_MS && typeof s.params === 'string' && s.params ? s.params : null;
  } catch {
    return null;
  }
}

export const serializeInsightsState = (params: string, now: number): string =>
  JSON.stringify({ version: VERSION, params, lastUsed: now });

// An open card dialog or a chart= link target is never remembered: a bare /insights visit must not reopen or scroll to it.
export const withoutDeepLinks = (qs: string): string => {
  const p = new URLSearchParams(qs);
  p.delete('card');
  p.delete('chart');
  return p.toString();
};
