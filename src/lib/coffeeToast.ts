// The status toast after a /coffees (or coffee page) save: names the coffee, or counts a batch.
const PAST: Record<string, string> = {
  open: 'marked as open', unopen: 'marked as unopened', freeze: 'frozen', thaw: 'unfrozen',
  archive: 'archived', unarchive: 'unarchived', delete: 'deleted'
};

export function coffeeToast(changes: { id: number; statusAction?: string }[], nameOf: (id: number) => string): string | null {
  if (!changes.length) return null;
  const acts = new Set(changes.map((c) => c.statusAction ?? 'save'));
  const verb = (a: string) => PAST[a] ?? 'updated';
  if (changes.length === 1) {
    const a = changes[0].statusAction;
    return `Coffee "${nameOf(changes[0].id)}" ${a ? verb(a) : 'saved'}.`;
  }
  const only = acts.size === 1 ? [...acts][0] : null;
  return `${changes.length} coffees ${only && only !== 'save' ? verb(only).replace('marked as open', 'opened') : 'updated'}.`;
}

// What commit-batch reports for status actions: each coffee's state before and after, so Undo can restore it exactly.
export interface States { before: unknown[]; after: unknown[] }

// Undo is offered when the whole save was status actions other than delete (field edits and deletes get none).
export const undoable = (changes: { fields?: unknown; statusAction?: string }[]): boolean =>
  changes.length > 0 && changes.every((c) => !c.fields && !!c.statusAction && c.statusAction !== 'delete');

// Posts a status batch (a tile or row action); returns the states for its Undo. Throws a readable message on failure.
export async function commitChanges(changes: { id: number; statusAction: string }[]): Promise<States> {
  const res = await fetch('/api/coffees/commit-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes })
  });
  const body = (await res.json().catch(() => null)) as ({ success?: boolean; error?: string } & Partial<States>) | null;
  if (!body?.success) throw new Error(body?.error ?? 'Could not save that.');
  return { before: body.before ?? [], after: body.after ?? [] };
}

// Undo: restores the exact earlier state, but only while the coffees are still as the action left them.
export async function restoreStates(states: States): Promise<void> {
  const res = await fetch('/api/coffees/restore-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(states)
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!body?.success) throw new Error(body?.error ?? 'Could not undo that.');
}
