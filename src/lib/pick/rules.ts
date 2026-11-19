import type { Category, CritMode, Fill, Iteration, Over20, PickRules, SortGroup, SortRule } from './types';

const CATEGORIES: Category[] = ['open', 'backlog', 'frozen'];
const GROUPS: SortGroup[] = ['open', 'backlog', 'frozen', 'decaf'];
const SORTS: SortRule[] = ['urgency-desc', 'urgency-asc', 'name', 'category'];
const ITERATIONS: Iteration[] = ['asc', 'desc', 'evens', 'odds', 'random'];
const FILLS: Fill[] = ['wrap', 'snake', 'shuffle', 'cross'];
const MODES: CritMode[] = ['spot', 'specific'];
const OVER20: Over20[] = ['first20', 'byHand'];

export const DEFAULT_RULES: PickRules = {
  v: 1,
  categories: ['open', 'backlog'],
  includeDecaf: false,
  includeFrozenDecaf: false,
  sort: 'urgency-desc',
  categoryOrder: ['open', 'backlog', 'frozen', 'decaf'],
  over20: 'first20',
  excluded: [],
  critSuccessOn: true,
  critSuccessMode: 'spot',
  critSuccess: [],
  critFailOn: true,
  critFailMode: 'spot',
  critFail: [],
  highestIsCrit: true,
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
  const critFail = ids(r.critFail).filter((id) => !critSuccess.includes(id));
  // Rules saved before crit modes: a non-empty id list meant specific coffees; an empty one gets the new defaults.
  const modeOf = (x: unknown, list: number[]) => oneOf(x, MODES, list.length ? 'specific' : 'spot');
  return {
    v: 1,
    categories: cats,
    includeDecaf: bool(r.includeDecaf, DEFAULT_RULES.includeDecaf),
    // the old field was the inverse (skipFrozenDecaf); keep saved rules working
    includeFrozenDecaf: typeof r.includeFrozenDecaf === 'boolean' ? r.includeFrozenDecaf : typeof r.skipFrozenDecaf === 'boolean' ? !r.skipFrozenDecaf : DEFAULT_RULES.includeFrozenDecaf,
    sort: oneOf(r.sort, SORTS, DEFAULT_RULES.sort),
    categoryOrder: orderOk ? (order as SortGroup[]) : [...DEFAULT_RULES.categoryOrder],
    over20: oneOf(r.over20, OVER20, DEFAULT_RULES.over20),
    excluded: ids(r.excluded),
    critSuccessOn: bool(r.critSuccessOn, true),
    critSuccessMode: modeOf(r.critSuccessMode, critSuccess),
    critSuccess,
    critFailOn: bool(r.critFailOn, true),
    critFailMode: modeOf(r.critFailMode, critFail),
    critFail,
    highestIsCrit: bool(r.highestIsCrit, true),
    fillEnds: bool(r.fillEnds, DEFAULT_RULES.fillEnds),
    iteration: oneOf(r.iteration, ITERATIONS, DEFAULT_RULES.iteration),
    fill: oneOf(r.fill, FILLS, DEFAULT_RULES.fill),
    repeats: bool(r.repeats, DEFAULT_RULES.repeats)
  };
}

/** Every rule field changes the pool or the board. */
export function rulesDiffer(a: PickRules, b: PickRules): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
