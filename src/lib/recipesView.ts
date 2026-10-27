// /account/recipes view state: which item's brew list is open, and the hidden-structures view.
import { pickOne } from './pageUrlState';

export type RecipesItem = { recipe: number } | { key: string };
export interface RecipesView {
  brews?: RecipesItem;
  view?: 'hidden';
}

// Wider than 12 pours / 2-digit ratio: detector keys are not capped (controller ruling 2).
const KEY = /^\d+b-[fs]{1,40}-(\d{1,3}|x)$/;

export function parseRecipesView(p: URLSearchParams): RecipesView {
  const out: RecipesView = {};
  const b = p.get('brews')?.toLowerCase() ?? '';
  if (/^r[1-9]\d{0,8}$/.test(b)) out.brews = { recipe: Number(b.slice(1)) };
  else if (b[0] === 's' && KEY.test(b.slice(1))) out.brews = { key: b.slice(1) };
  const view = pickOne(p, 'view', ['hidden'] as const);
  if (view) out.view = view;
  return out;
}

export function itemParam(i: RecipesItem): string {
  return 'recipe' in i ? `r${i.recipe}` : `s${i.key}`;
}

export function recipesParams(v: RecipesView): URLSearchParams {
  const p = new URLSearchParams();
  if (v.brews) p.set('brews', itemParam(v.brews));
  if (v.view) p.set('view', v.view);
  return p;
}
