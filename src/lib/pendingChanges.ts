// Mutates the passed-in Map directly rather than returning a new one —
// this is the idiomatic Svelte 5 pattern: a component declares
// `pending = $state(new Map<number, PendingChange>())`, and calling
// `.set()`/`.delete()` on that Map (which these functions do internally)
// triggers reactivity on its own, since $state deeply proxies built-in
// Map/Set. No `pending = pendingWithChange(pending, ...)` reassignment
// dance needed at call sites.

export interface PendingChange {
  fields?: Record<string, string>;
  statusAction?: string;
}

export function stageFieldChange(
  pending: Map<number, PendingChange>,
  id: number,
  fields: Record<string, string>
): void {
  const existing = pending.get(id) ?? {};
  pending.set(id, { ...existing, fields });
}

export function stageStatusAction(
  pending: Map<number, PendingChange>,
  id: number,
  statusAction: string
): void {
  const existing = pending.get(id) ?? {};
  pending.set(id, { ...existing, statusAction });
}

export function clearPending(pending: Map<number, PendingChange>, id: number): void {
  pending.delete(id);
}

export function hasPending(pending: Map<number, PendingChange>): boolean {
  return pending.size > 0;
}
