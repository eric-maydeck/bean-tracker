export function cellText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function cellNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function cellBoolean(value: unknown): boolean {
  return value === true;
}

// Some real-world exports (observed in Bean Conqueror's xlsx export) store
// date/timestamp cells as formatted text — "MM/DD/YYYY" or
// "MM/DD/YYYY HH:mm:ss" — rather than native Excel date serials, so
// ExcelJS hands back a plain string instead of a Date. This parses that
// specific text format; it never matches ISO-formatted strings
// ("YYYY-MM-DD"), which callers rely on rejecting (see excelHelpers tests).
function parseSlashFormattedDate(
  value: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, monthStr, dayStr, yearStr, hourStr, minuteStr, secondStr] = match;
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
    hour: hourStr ? Number(hourStr) : 0,
    minute: minuteStr ? Number(minuteStr) : 0,
    second: secondStr ? Number(secondStr) : 0
  };
}

export function excelSerialToISODate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const parsed = parseSlashFormattedDate(value);
    if (!parsed) return null;
    return `${String(parsed.year).padStart(4, '0')}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
  }
  return null;
}

export function excelSerialToISOTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = parseSlashFormattedDate(value);
    if (!parsed) return null;
    const date = new Date(
      Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second)
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}
