// A stored UTC ISO timestamp's date part (clock times go through Stamp.svelte).
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}
