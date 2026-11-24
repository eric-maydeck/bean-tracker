// /recipes view state: which item's brew list is open, and the hidden-structures view.
import { pickOne } from './pageUrlState';

export type RecipesItem = { recipe: number } | { key: string };
export interface RecipesView {
  brews?: RecipesItem;
  order?: 'top';
  view?: 'hidden';
  brewnow?: string; // a saved recipe slug; the server checks it exists
  // The Brew now picker's own state; only meaningful (parsed, written) while brewnow is set.
  bnq?: string; // search text
  bnsort?: BnSort; // absent = urgency
  bndir?: 'asc' | 'desc'; // absent = the sort's own default direction
  bnstatus?: 'backlog'; // absent = open coffees
}

export const BN_SORTS = ['urgency', 'brews', 'rating', 'name', 'roaster', 'grams'] as const;
export type BnSort = (typeof BN_SORTS)[number];
// Each option's own starting direction: how much / how good first, names and amounts A to Z.
export const BN_DEFAULT_DIR: Record<BnSort, 'asc' | 'desc'> = { urgency: 'desc', brews: 'desc', rating: 'desc', name: 'asc', roaster: 'asc', grams: 'asc' };

// Wider than 12 pours / 2-digit ratio: detector keys are not capped (controller ruling 2).
const KEY = /^\d+b-[fs]{1,40}-(\d{1,3}|x)$/;

export function parseRecipesView(p: URLSearchParams): RecipesView {
  const out: RecipesView = {};
  const b = p.get('brews')?.toLowerCase() ?? '';
  if (/^r[1-9]\d{0,8}$/.test(b)) out.brews = { recipe: Number(b.slice(1)) };
  else if (b[0] === 's' && KEY.test(b.slice(1))) out.brews = { key: b.slice(1) };
  const order = pickOne(p, 'order', ['top'] as const);
  if (order) out.order = order;
  const view = pickOne(p, 'view', ['hidden'] as const);
  if (view) out.view = view;
  const bn = p.get('brewnow')?.toLowerCase() ?? '';
  if (/^[a-z0-9-]{1,80}$/.test(bn)) {
    out.brewnow = bn;
    const q = p.get('bnq')?.trim().slice(0, 100);
    if (q) out.bnq = q;
    const sort = pickOne(p, 'bnsort', BN_SORTS);
    if (sort) out.bnsort = sort;
    const dir = pickOne(p, 'bndir', ['asc', 'desc'] as const);
    if (dir) out.bndir = dir;
    const status = pickOne(p, 'bnstatus', ['backlog'] as const);
    if (status) out.bnstatus = status;
  }
  return out;
}

export function itemParam(i: RecipesItem): string {
  return 'recipe' in i ? `r${i.recipe}` : `s${i.key}`;
}

export function recipesParams(v: RecipesView): URLSearchParams {
  const p = new URLSearchParams();
  if (v.brews) p.set('brews', itemParam(v.brews));
  if (v.order && v.brews) p.set('order', v.order);
  if (v.view) p.set('view', v.view);
  if (v.brewnow) {
    p.set('brewnow', v.brewnow);
    if (v.bnstatus) p.set('bnstatus', v.bnstatus);
    if (v.bnq) p.set('bnq', v.bnq);
    if (v.bnsort && v.bnsort !== 'urgency') p.set('bnsort', v.bnsort);
    if (v.bndir && v.bndir !== BN_DEFAULT_DIR[v.bnsort ?? 'urgency']) p.set('bndir', v.bndir);
  }
  return p;
}
