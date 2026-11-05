// BQ wall times are stored in this zone, forever (bc_created_at, see server/insights/time.ts).
export const STORE_ZONE = 'America/Denver';

// The account's brewing zone: every day and hour line, server and client. The layout sends it and the
// client applies it, so both compute the same local dates.
// ponytail: one process-wide zone; per-request zone when there are several accounts
let zone = 'UTC';
export function setBrewingZone(z: string): void { zone = z; }
export const brewingZone = (): string => zone;

const dayFmts = new Map<string, Intl.DateTimeFormat>();

// A stored date as a calendar date in the brewing zone: a UTC ISO instant (opened_date, moved_date) converts;
// an imported date-only 'YYYY-MM-DD' (or anything unparseable) passes through. Not for
// bc_created_at (wall time in STORE_ZONE; use bcLocalTime).
export function localDate(value: string): string {
  const d = new Date(value);
  if (value.length === 10 || Number.isNaN(d.getTime())) return value;
  let f = dayFmts.get(zone);
  if (!f) dayFmts.set(zone, f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }));
  return f.format(d);
}

const stampFmts = new Map<string, Intl.DateTimeFormat>();
// An ISO instant as wall time 'YYYY-MM-DDTHH:mm:ss' in a zone (default: the brewing zone).
export function localStamp(iso: string, z: string = zone): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let f = stampFmts.get(z);
  if (!f) stampFmts.set(z, f = new Intl.DateTimeFormat('en-CA', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

// An ISO instant as wall time 'YYYY-MM-DDTHH:MM' in the brewing zone (same zone as localDate).
export const localDateTime = (iso: string): string => localStamp(iso).slice(0, 16);

// STORE_ZONE wall time ('YYYY-MM-DDTHH:mm[:ss...]', as Bean Conqueror's created dates and brew times are stored) as a real instant (ISO, UTC).
export function wallToInstant(wall: string): string {
  const t = Date.parse(`${wall.slice(0, 19).padEnd(19, ':00').slice(0, 19)}Z`); // the wall digits read as UTC
  if (Number.isNaN(t)) return wall;
  let at = t - (Date.parse(`${localStamp(new Date(t).toISOString(), STORE_ZONE)}Z`) - t);
  at = t - (Date.parse(`${localStamp(new Date(at).toISOString(), STORE_ZONE)}Z`) - at); // once more: the offset can differ across a DST edge
  return new Date(at).toISOString();
}

// How dates and times are written (Account > Time > Date format); the label shows 2026-10-22 8:05:23 PM in each.
export const DATE_FORMATS = ['iso12', 'iso24', 'us', 'eu'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const DEFAULT_DATE_FORMAT: DateFormat = 'iso12';
export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  iso12: '2026-10-22 8:05:23 PM', iso24: '2026-10-22 20:05:23', us: '10/22/2026, 8:05:23 PM', eu: '22/10/2026 20:05:23'
};
export const asDateFormat = (v: unknown): DateFormat => ((DATE_FORMATS as readonly unknown[]).includes(v) ? (v as DateFormat) : DEFAULT_DATE_FORMAT);

// 'YYYY-MM-DDTHH:mm[:ss]' wall time in a format (default "2026-10-22 8:05:23 PM"); `seconds` false drops them.
export function formatStamp(wall: string, format: DateFormat = DEFAULT_DATE_FORMAT, seconds = true): string {
  const [date, time = '00:00:00'] = wall.slice(0, 19).split('T');
  const [h, m, sec = '00'] = time.split(':');
  const hh = Number(h);
  const [y, mo, d] = date.split('-');
  const hm = (twelve: boolean) => `${twelve ? hh % 12 || 12 : h.padStart(2, '0')}:${m}${seconds ? `:${sec}` : ''}${twelve ? (hh < 12 ? ' AM' : ' PM') : ''}`;
  if (format === 'iso24') return `${date} ${hm(false)}`;
  if (format === 'us') return `${mo}/${d}/${y}, ${hm(true)}`;
  if (format === 'eu') return `${d}/${mo}/${y} ${hm(false)}`;
  return `${date} ${hm(true)}`;
}

// An instant as a stamp in a zone (default: the brewing zone, what the server renders; the page re-renders it in the browser's).
export const formatInstant = (iso: string, zone?: string, format?: DateFormat, seconds?: boolean): string => formatStamp(localStamp(iso, zone), format, seconds);
