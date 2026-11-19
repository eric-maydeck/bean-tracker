import { DEFAULT_RULES, parseRules } from '#lib/pick/rules.ts';
import { freshToday, todayFor } from '#lib/pick/today.ts';
import type { PickRules, PickToday } from '#lib/pick/types.ts';

type RulesKey = 'pick.rules.saved' | 'pick.rules.last';

const read = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: storage may be blocked; the game still works for this visit
  }
};

const put = async (key: string, value: unknown) => {
  const res = await fetch('/api/pick', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, value }), keepalive: true });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
};

/** Admins get the server's last-used rules; visitors the browser's. Never throws. */
export function loadRules(admin: boolean, serverLast: unknown): PickRules {
  return parseRules(admin ? serverLast : read('pick.rules.last'));
}

export async function saveRules(admin: boolean, key: RulesKey, r: PickRules): Promise<void> {
  if (admin) await put(key, r);
  else write(key, r);
}

export function loadToday(admin: boolean, serverToday: unknown, date: string): PickToday {
  try {
    return todayFor(admin ? serverToday : read('pick.today'), date);
  } catch {
    return freshToday(date);
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: PickToday | undefined;

/** Send the pending admin write now (leaving the page, Brew). */
export function flushToday(): void {
  clearTimeout(timer);
  if (!pending) return;
  const t = pending;
  pending = undefined;
  put('pick.today', t).catch(() => {});
}

/** Admins: debounced 300ms PUT. Visitors: localStorage at once. */
export function saveToday(admin: boolean, t: PickToday): void {
  if (!admin) return write('pick.today', t);
  pending = t;
  clearTimeout(timer);
  timer = setTimeout(flushToday, 300);
}

/** The saved rules, or null when none are saved. Throws when the server can't be reached. */
export async function fetchSaved(): Promise<PickRules | null> {
  const res = await fetch('/api/pick?key=pick.rules.saved');
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  const { value } = await res.json();
  return value == null ? null : parseRules(value);
}
