// One explicit per-browser choice (a layout, a filter toggle), remembered
// for 12h since last use — the same window as the Coffees view state.
// Pass ttlMs = Infinity for a choice kept until changed.
export const CHOICE_TTL_MS = 12 * 60 * 60 * 1000;

export function loadChoice<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  now: number,
  ttlMs = CHOICE_TTL_MS
): T | undefined {
  if (!raw) return undefined;
  try {
    const saved = JSON.parse(raw) as { value?: unknown; lastUsed?: unknown };
    if (typeof saved.lastUsed !== 'number' || now - saved.lastUsed > ttlMs) return undefined;
    return allowed.find((a) => a === saved.value);
  } catch {
    return undefined;
  }
}

export function serializeChoice(value: string, now: number): string {
  return JSON.stringify({ value, lastUsed: now });
}
