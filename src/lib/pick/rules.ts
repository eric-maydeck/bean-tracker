import type { Category, Fill, Iteration, Over20, PickRules, SortGroup, SortRule } from './types';

const CATEGORIES: Category[] = ['open', 'backlog', 'frozen'];
const GROUPS: SortGroup[] = ['open', 'backlog', 'frozen', 'decaf'];
const SORTS: SortRule[] = ['urgency-desc', 'urgency-asc', 'name', 'category'];
const ITERATIONS: Iteration[] = ['asc', 'desc', 'evens', 'odds', 'random'];
const FILLS: Fill[] = ['wrap', 'snake', 'shuffle', 'cross'];
const OVER20: Over20[] = ['first20', 'byHand'];

export const DEFAULT_RULES: PickRules = {
  v: 1,
  categories: ['open', 'backlog'],
  includeDecaf: false,
  skipFrozenDecaf: true,
  sort: 'urgency-desc',
  categoryOrder: ['open', 'backlog', 'frozen', 'decaf'],
  over20: 'first20',
  excluded: [],
  critSuccess: [],
  critFail: [],
  fillEnds: true,
  iteration: 'asc',
  fill: 'wrap',
  repeats: false
};

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});
const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
const oneOf = <T extends string>(x: unknown, all: T[], d: T): T => (all.includes(x as T) ? (x as T) : d);
const ids = (x: unknown): number[] => (Array.isArray(x) ? [...new Set(x.filter((n): n is number => Number.isInteger(n)))] : []);

/** Per-field fallback to DEFAULT_RULES; never throws. */
export function parseRules(raw: unknown): PickRules {
  const r = obj(raw);
  const cats = Array.isArray(r.categories)
    ? [...new Set(r.categories.filter((c): c is Category => CATEGORIES.includes(c as Category)))]
    : DEFAULT_RULES.categories;
  const order = Array.isArray(r.categoryOrder) ? r.categoryOrder : [];
  const orderOk = order.length === GROUPS.length && GROUPS.every((g) => order.includes(g));
  const critSuccess = ids(r.critSuccess);
  return {
    v: 1,
    categories: cats,
    includeDecaf: bool(r.includeDecaf, DEFAULT_RULES.includeDecaf),
    skipFrozenDecaf: bool(r.skipFrozenDecaf, DEFAULT_RULES.skipFrozenDecaf),
    sort: oneOf(r.sort, SORTS, DEFAULT_RULES.sort),
    categoryOrder: orderOk ? (order as SortGroup[]) : [...DEFAULT_RULES.categoryOrder],
    over20: oneOf(r.over20, OVER20, DEFAULT_RULES.over20),
    excluded: ids(r.excluded),
    critSuccess,
    critFail: ids(r.critFail).filter((id) => !critSuccess.includes(id)),
    fillEnds: bool(r.fillEnds, DEFAULT_RULES.fillEnds),
    iteration: oneOf(r.iteration, ITERATIONS, DEFAULT_RULES.iteration),
    fill: oneOf(r.fill, FILLS, DEFAULT_RULES.fill),
    repeats: bool(r.repeats, DEFAULT_RULES.repeats)
  };
}

/** Every rule field but `v` changes the pool or the board. */
export function rulesDiffer(a: PickRules, b: PickRules): boolean {
  return JSON.stringify({ ...a, v: 1 }) !== JSON.stringify({ ...b, v: 1 });
}
