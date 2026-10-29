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
