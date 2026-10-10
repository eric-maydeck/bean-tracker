import { BC_TIME_ZONE } from '../beanConquerorJson';

// Insights count days in the user's zone (Mountain Time). Dates here are
// local 'YYYY-MM-DD' strings, compared as strings.
export const INSIGHTS_TIME_ZONE = BC_TIME_ZONE;

// beanconqueror_*.bc_created_at is ALREADY America/Denver local wall time
// with a misleading trailing 'Z' (the xlsx import stored it that way, verified
// 1345/1345 brews against Bean Conqueror's unix timestamps; the JSON import
// keeps the format via bcTimestamp()). So read it as-is: no zone conversion.
export const bcLocalTime = (stored: string): string => stored.slice(0, 16);

// The zone is only needed for "now": today's date in local, DST-aware.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: INSIGHTS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const localToday = (now = new Date()): string => dayFmt.format(now); // en-CA → YYYY-MM-DD

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: string, n: number): string => fromMs(toMs(d) + n * DAY);
export const daysBetween = (a: string, b: string): number => Math.round((toMs(b) - toMs(a)) / DAY);

export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(y, m - 1 + n, Math.min(day, lastDay)));
}

export interface Period {
  start: string | null; // null = all time
  end: string;
}

const MONTHS: Record<string, number> = { '3m': 3, '6m': 6, '12m': 12, '3y': 36 };

// Rolling windows end on `today`, inclusive. A range string that isn't a
// rolling one is a calendar year (the URL parser only lets valid ones through).
export function periodBounds(range: string, today: string): Period {
  if (range === '1w') return { start: addDays(today, -6), end: today };
  if (range === '1m') return { start: addDays(today, -29), end: today };
  if (range in MONTHS) return { start: addDays(addMonths(today, -MONTHS[range]), 1), end: today };
  if (range === 'ytd') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (range === 'all') return { start: null, end: today };
  return { start: `${range}-01-01`, end: `${range}-12-31` };
}

// The same-length window `n` periods before `p`; n years back for a calendar
// year; the same span n years back for YTD; none for all time. Rolling windows
// step back one at a time so they stay back to back across month-end clamping.
export function previousPeriod(range: string, p: Period, n = 1): Period | null {
  if (p.start === null) return null;
  if (range === 'ytd') return { start: `${Number(p.start.slice(0, 4)) - n}-01-01`, end: addMonths(p.end, -12 * n) };
  if (/^\d{4}$/.test(range)) return periodBounds(String(Number(range) - n), p.end);
  let q = p;
  for (let i = 0; i < n; i++) q = periodBounds(range, addDays(q.start!, -1));
  return q;
}

export const inPeriod = (date: string, p: Period): boolean => (p.start === null || date >= p.start) && date <= p.end;

export function yearsSince(firstDate: string | null, today: string): number[] {
  const last = Number(today.slice(0, 4));
  const first = firstDate ? Number(firstDate.slice(0, 4)) : last;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
