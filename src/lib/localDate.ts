// The user's zone: Bean Conqueror's wall clock and every "today" (server and client). Client-safe.
export const HOME_TIME_ZONE = 'America/Denver';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: HOME_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// A stored date as a local calendar date: a UTC ISO instant (opened_date, moved_date) converts;
// an imported date-only 'YYYY-MM-DD' (or anything unparseable) passes through. Not for
// bc_created_at (already wall time).
export function localDate(value: string): string {
  const d = new Date(value);
  return value.length === 10 || Number.isNaN(d.getTime()) ? value : dayFmt.format(d);
}
