// Stored timestamps are UTC ISO strings; shown as-is rather than converted
// to local time, so the server-rendered and hydrated output always match.
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatUpdated(iso: string | null): string {
  if (!iso) return 'no data yet';
  return `${formatDate(iso)} ${iso.slice(11, 16)} UTC`;
}
