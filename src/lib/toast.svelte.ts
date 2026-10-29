// One short status toast for the whole site (rendered once by Toast.svelte in the root layout).
// showToast('Coffee "X" marked as open.'): visible ~2 s, then fades. A repeat of the same text restarts it.
export const toast = $state<{ text: string | null; n: number }>({ text: null, n: 0 });
export function showToast(text: string): void {
  toast.text = text;
  toast.n++;
}
