// Site-wide status toasts, rendered by Toast.svelte in the root layout. Several can show at once (newer below older).
// showToast('Coffee "X" marked as open.', { undo: () => reverse() }) adds an Undo button; the toast pauses on hover and focus.
export interface ToastItem {
  id: number;
  text: string;
  undo?: () => Promise<unknown> | unknown;
}

export const toasts = $state<ToastItem[]>([]);
let nextId = 1;

export function showToast(text: string, opts: { undo?: ToastItem['undo'] } = {}): number {
  const id = nextId++;
  toasts.push({ id, text, undo: opts.undo });
  return id;
}

export function dismissToast(id: number): void {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

// Runs a toast's reverse action, then swaps it for "Undone." (or the error text).
export async function undoToast(t: ToastItem): Promise<void> {
  dismissToast(t.id);
  try {
    await t.undo?.();
    showToast('Undone.');
  } catch (e) {
    showToast(e instanceof Error && e.message ? e.message : 'Could not undo that.');
  }
}
