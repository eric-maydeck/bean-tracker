// The app's zone (the user's): Bean Conqueror's wall clock, every "today" and every displayed
// date, server and client. Client-safe, so both import this one constant.
export const APP_TIME_ZONE = 'America/Denver';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// A stored date as a local calendar date: a UTC ISO instant (opened_date, moved_date) converts;
// an imported date-only 'YYYY-MM-DD' (or anything unparseable) passes through. Not for
// bc_created_at (already wall time).
export function localDate(value: string): string {
  const d = new Date(value);
  return value.length === 10 || Number.isNaN(d.getTime()) ? value : dayFmt.format(d);
}

const stampFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
// A UTC ISO instant as local wall time 'YYYY-MM-DDTHH:mm:ss' (the shape Bean Conqueror's created dates already have).
export function localStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(stampFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

// 'YYYY-MM-DDTHH:mm[:ss]' wall time as "2026-10-22 8:05:23 PM" (12-hour, no leading zero, seconds).
export function formatStamp(wall: string): string {
  const [date, time = '00:00:00'] = wall.slice(0, 19).split('T');
  const [h, m, sec = '00'] = time.split(':');
  const hh = Number(h);
  return `${date} ${hh % 12 || 12}:${m}:${sec} ${hh < 12 ? 'AM' : 'PM'}`;
}
