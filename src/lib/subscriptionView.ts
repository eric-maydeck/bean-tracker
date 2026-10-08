// Client-safe subscription helpers: the "Subscription page" link, its
// roaster warning, totals, and the staged Pause/Resume toggle.
import { hostMatchesRoaster } from './imageSuggest';
import type { PendingChange } from './pendingChanges';

export const BAD_SUBSCRIPTION_URL = 'Subscription page must be an http(s) URL';

// Empty -> null; otherwise an http(s) URL (trimmed) or an error.
export function parseSubscriptionUrl(raw: string | null | undefined): { url: string | null } | { error: string } {
  const url = (raw ?? '').trim();
  if (!url) return { url: null };
  try {
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') return { url };
  } catch {
    // fall through
  }
  return { error: BAD_SUBSCRIPTION_URL };
}

export function siteOrigin(url: string): string {
  return new URL(url).origin;
}

// Non-blocking hint under the field; null when there is nothing to say.
export function urlWarning(url: string, roaster: string): string | null {
  const parsed = parseSubscriptionUrl(url);
  if (!('url' in parsed) || !parsed.url || !roaster.trim()) return null;
  return hostMatchesRoaster(parsed.url, roaster) ? null : `⚠ doesn't look like ${roaster.trim()}'s site`;
}

type Totalable = { price: number | null; total_grams: number | null; paused: number };

// Paused subscriptions don't count; null when no active sub has a value.
export function subscriptionTotals(subs: Totalable[]): { price: number | null; grams: number | null } {
  const active = subs.filter((s) => !s.paused);
  const sum = (vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v != null);
    return present.length ? present.reduce((a, b) => a + b, 0) : null;
  };
  return { price: sum(active.map((s) => s.price)), grams: sum(active.map((s) => s.total_grams)) };
}

// Pause/Resume is a staged `paused` field change; a second click un-stages it.
export function togglePauseStage(pending: Map<number, PendingChange>, id: number, currentPaused: number): void {
  const existing = pending.get(id) ?? {};
  const fields = { ...existing.fields };
  if ('paused' in fields) delete fields.paused;
  else fields.paused = currentPaused ? '0' : '1';
  const next: PendingChange = { ...existing, fields };
  if (Object.keys(fields).length === 0) delete next.fields;
  if (next.fields || next.statusAction) pending.set(id, next);
  else pending.delete(id);
}

export function stagedPause(change: PendingChange | undefined): 'pause' | 'resume' | null {
  const p = change?.fields?.paused;
  return p === '1' ? 'pause' : p === '0' ? 'resume' : null;
}

// The one per-row pending badge: "Pending: delete" / "pause" / "resume" /
// "edited", or "pause, edited" when both are staged.
export function pendingLabel(change: PendingChange | undefined): string | null {
  if (!change) return null;
  if (change.statusAction === 'delete') return 'Pending: delete';
  const parts = [stagedPause(change), Object.keys(change.fields ?? {}).some((k) => k !== 'paused') ? 'edited' : null].filter(Boolean);
  return parts.length ? `Pending: ${parts.join(', ')}` : null;
}

// The Pause/Resume button names what a click would do now: the opposite of
// the effective (saved or staged) state.
export function pauseButtonLabel(savedPaused: number, change: PendingChange | undefined): 'Pause' | 'Resume' {
  return effectivePaused(savedPaused, change) ? 'Resume' : 'Pause';
}

// Paused once saved and staged state are combined (a staged pause/resume wins).
export function effectivePaused(savedPaused: number, change: PendingChange | undefined): boolean {
  const staged = stagedPause(change);
  return staged ? staged === 'pause' : !!savedPaused;
}

export function deleteButtonLabel(change: PendingChange | undefined): 'Delete' | 'Restore' {
  return change?.statusAction === 'delete' ? 'Restore' : 'Delete';
}

// The Bags / g/bag inputs' tooltip in the edit table.
export function totalGramsTitle(bags: string, gramsPerBag: string): string {
  const b = parseFloat(bags);
  const g = parseFloat(gramsPerBag);
  return Number.isFinite(b) && Number.isFinite(g) ? `Total: ${b * g} g` : 'Total: —';
}
