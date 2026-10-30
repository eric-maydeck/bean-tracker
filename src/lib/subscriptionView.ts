import { usd } from '$lib/money';
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

// What a row has staged: ["delete"], or "pause" / "resume" and "edited" (both when both are staged).
export function pendingParts(change: PendingChange | undefined): string[] {
  if (!change) return [];
  if (change.statusAction === 'delete') return ['delete'];
  return [stagedPause(change), Object.keys(change.fields ?? {}).some((k) => k !== 'paused') ? 'edited' : null].filter((x): x is string => !!x);
}

// The one per-row pending badge: "Pending: delete" / "pause" / "resume" /
// "edited", or "pause, edited" when both are staged.
export function pendingLabel(change: PendingChange | undefined): string | null {
  const parts = pendingParts(change);
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

// The visible total under the edit table's Bags / g/bag inputs.
export function totalGramsText(bags: string, gramsPerBag: string): string {
  const b = parseFloat(bags);
  const g = parseFloat(gramsPerBag);
  return Number.isFinite(b) && Number.isFinite(g) ? `${b * g}g total` : '— g total';
}

// One option of a subscription page (POST /api/subscriptions/fill-from-url).
export interface SubscriptionFillVariant {
  label: string;
  price: number | null; // USD per shipment
  originalPrice: string | null; // e.g. "£42.00 GBP" when not USD
  bags: number | null;
  gramsPerBag: number | null;
}

// Which inputs a fill writes: the Add form fills only empty fields; editing a
// subscription overwrites what the page states, like the coffee form's Fill.
export function fillValues(
  current: (name: string) => string,
  found: Record<string, string | number>,
  onlyEmpty: boolean
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(found)) {
    const now = current(name).trim();
    if (now === String(value) || (onlyEmpty && now !== '')) continue;
    out[name] = String(value);
  }
  return out;
}

// Picking an option sets its price, bag count and g/bag.
export function variantValues(v: SubscriptionFillVariant): Record<string, number> {
  const out: Record<string, number> = {};
  if (v.price != null) out.price = v.price;
  if (v.bags != null) out.bag_count = v.bags;
  if (v.gramsPerBag != null) out.amount_per_bag_g = v.gramsPerBag;
  return out;
}

export function variantChipLabel(v: SubscriptionFillVariant, i: number): string {
  return `${v.label || `Option ${i + 1}`} · ${v.price != null ? usd(v.price) : v.originalPrice}`;
}
