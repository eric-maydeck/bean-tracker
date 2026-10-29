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

const REVERSE: Record<string, string> = {
  open: 'unopen', unopen: 'open', freeze: 'thaw', thaw: 'freeze', archive: 'unarchive', unarchive: 'archive'
};

// The batch that undoes a save, or null when part of it can't be undone (field edits, deletes).
export function reverseChanges(changes: { id: number; fields?: unknown; statusAction?: string }[]): { id: number; statusAction: string }[] | null {
  if (!changes.length || changes.some((c) => c.fields || !c.statusAction || !REVERSE[c.statusAction])) return null;
  return changes.map((c) => ({ id: c.id, statusAction: REVERSE[c.statusAction!] }));
}

// Posts a status batch (a tile action or its reverse); throws with a readable message when it didn't apply.
export async function commitChanges(reversed: { id: number; statusAction: string }[]): Promise<void> {
  const res = await fetch('/api/coffees/commit-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes: reversed })
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!body?.success) throw new Error(body?.error ?? 'Could not undo that.');
}
export const undoChanges = commitChanges;
