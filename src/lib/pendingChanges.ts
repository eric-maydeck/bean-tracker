// Mutates the passed-in Map directly rather than returning a new one —
// this is the idiomatic Svelte 5 pattern for the SvelteMap case: a
// component declares `pending = $state(new SvelteMap<number, PendingChange>())`
// and calling `.set()`/`.delete()` on that Map (which these functions do
// internally) triggers reactivity on its own. Plain `$state(new Map())`
// does NOT provide reactivity for in-place Map mutations in Svelte 5 —
// `$state()`'s proxy only wraps plain objects/arrays, not built-in
// Map/Set — so callers needing reactivity should wrap with `SvelteMap`
// from `svelte/reactivity` instead of a plain `Map`. No
// `pending = pendingWithChange(pending, ...)` reassignment dance needed
// at call sites either way.

import type { CoffeeRow } from './types';

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
  // Clicking the same status action again un-stages it (Spec Decision 4 /
  // Non-goals): rather than requiring "Discard changes", which would throw
  // away every other row's pending work too, a repeat click just removes
  // this one staged action.
  if (existing.statusAction === statusAction) {
    if (existing.fields) {
      pending.set(id, { fields: existing.fields });
    } else {
      pending.delete(id);
    }
    return;
  }
  const next: PendingChange = { statusAction };
  // Staging 'delete' drops any staged field edit for the same entry —
  // editing fields on a coffee you're about to delete doesn't make sense,
  // and a stale/invalid staged field edit would otherwise block the delete
  // with a confusing validation error. Only applies when this is a
  // genuinely new stage (not the un-stage case handled above).
  if (statusAction !== 'delete' && existing.fields) {
    next.fields = existing.fields;
  }
  pending.set(id, next);
}

export function clearPending(pending: Map<number, PendingChange>, id: number): void {
  pending.delete(id);
}

export function hasPending(pending: Map<number, PendingChange>): boolean {
  return pending.size > 0;
}

// The merge intentionally produces a value whose fields may be strings
// where CoffeeRow expects numbers (pendingFields comes from captured
// FormData) — safe here because CoffeeForm only ever interpolates these
// into <input value=...> attributes, which stringifies regardless.
export function mergeStagedCoffee(coffee: CoffeeRow, pendingFields: Record<string, string> | undefined): CoffeeRow {
  if (!pendingFields) return coffee;
  return {
    ...coffee,
    ...pendingFields,
    // FormData omits an unchecked checkbox entirely and represents a
    // checked one as the string "on" — convert back to the 0/1 integer
    // CoffeeForm's `checked={coffee?.decaf === 1}` comparison expects.
    // Presence of the key (regardless of its exact string value) means
    // it was checked when staged; absence means it was unchecked.
    decaf: pendingFields.decaf != null ? 1 : 0
  } as CoffeeRow;
}
