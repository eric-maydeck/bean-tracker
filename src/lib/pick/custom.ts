import { DEFAULT_RULES } from './rules';
import type { PickCoffee, PickRules } from './types';

export const MAX_COFFEES = 100;
export const MAX_NAME = 80;

/** Names from typed or pasted text: split on newlines and commas, trimmed, no blanks or case-insensitive repeats, 80 characters each, the first 100. `cut` = names were dropped for the cap. */
export function tidyList(text: string): { names: string[]; cut: boolean } {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const name = raw.trim().slice(0, MAX_NAME).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return { names: names.slice(0, MAX_COFFEES), cut: names.length > MAX_COFFEES };
}

/** A stable negative id from the name (FNV-1a), so out-for-today and crit choices survive edits to other lines. ponytail: 31 bits, two names can collide (about 1 in 2 billion per pair); they would then share an id. */
export function customId(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of name.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return -((h >>> 1) + 1);
}

/** A custom coffee is a name: open, not decaf, urgency by line (the first line the most urgent). */
export const customCoffees = (names: string[]): PickCoffee[] =>
  names.map((name, i) => ({ id: customId(name), slug: '', name, roaster: '', image: null, fill: null, category: 'open', decaf: false, urgency: names.length - i, origin: null, roastLevel: null, processing: null }));

/** Custom coffees have no categories or decaf: every one counts, and "by category" is just the list order. */
export const customRules = (r: PickRules): PickRules => ({ ...r, categories: ['open', 'backlog', 'frozen'], includeDecaf: true, includeFrozenDecaf: true, sort: r.sort === 'category' ? 'urgency-desc' : r.sort });

/** Custom mode's defaults: spot crits only with 5 or more coffees (on a shorter list they would take most of it out of regular play). */
export const customDefaults = (n: number): PickRules => ({ ...DEFAULT_RULES, critSuccessOn: n >= 5, critFailOn: n >= 5 });
