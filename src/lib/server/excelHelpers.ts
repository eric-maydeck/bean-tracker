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

export function excelSerialToISODate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function excelSerialToISOTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}
