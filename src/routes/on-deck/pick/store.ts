import { DEFAULT_RULES, parseRules } from '#lib/pick/rules.ts';
import { parseProfiles, type Profiles } from '#lib/pick/profiles.ts';
import { freshToday, todayFor } from '#lib/pick/today.ts';
import type { PickRules, PickToday } from '#lib/pick/types.ts';

type RulesKey = 'pick.rules.last';

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

/** Named rule profiles. The old single saved copy shows up as a profile named "Saved" until profiles are first saved. */
export function loadProfiles(admin: boolean, serverProfiles: unknown, serverSaved: unknown): Profiles {
  return admin ? parseProfiles(serverProfiles, serverSaved) : parseProfiles(read('pick.profiles'), read('pick.rules.saved'));
}

/** Writes the whole map; rejects when the server refuses. */
export async function saveProfiles(admin: boolean, profiles: Profiles): Promise<void> {
  if (admin) await put('pick.profiles', profiles);
  else write('pick.profiles', profiles);
}

/** The remembered profile name next to the last rules (a raw value: `restoreSelected` decides whether it still holds). */
export const loadSelected = (admin: boolean, serverValue: unknown): unknown => (admin ? serverValue : read('pick.profile.selected'));

export async function saveSelected(admin: boolean, name: string): Promise<void> {
  if (admin) await put('pick.profile.selected', name);
  else write('pick.profile.selected', name);
}

// Custom coffees (#137): everything lives in this browser for everyone (admin too); the site keys and /api/pick are never touched.
export const loadCustomRules = (): PickRules => parseRules(read('pick.custom.rules'));
export const saveCustomRules = (r: PickRules): void => write('pick.custom.rules', r);
export function loadCustomToday(date: string): PickToday {
  try {
    return todayFor(read('pick.custom.today'), date);
  } catch {
    return freshToday(date);
  }
}
export const saveCustomToday = (t: PickToday): void => write('pick.custom.today', t);
export function loadList(): string[] {
  const v = read('pick.custom.list');
  return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : [];
}
export const saveList = (names: string[]): void => write('pick.custom.list', names);
