import type { DatabaseSync } from 'node:sqlite';
import { describeRecipe, recipeTimeline } from '#lib/recipes.ts';
import { recipeSlugs } from '#lib/recipeSlug.ts';
import { hasStepAmounts, recipeSteps, type StepAmounts, type StepLine } from '#lib/recipeSteps.ts';
import type { Timeline } from '#lib/pours.ts';
import { listRecipes } from '../recipes';
import type { BrewRow } from './load';

// The one place Brew now reads a saved recipe.
export interface BrewRecipe {
  id: number; slug: string; name: string; description: string; notes: string | null; timeline: Timeline;
  tempC: number | null; ratios: number[]; drippers: string[]; hasAmounts: boolean;
}

export function loadBrewRecipes(db: DatabaseSync): BrewRecipe[] {
  const all = listRecipes(db);
  const slugs = recipeSlugs(all);
  return all.map(({ id, name, def }) => ({
    id, slug: slugs.get(id)!, name, description: describeRecipe(def), notes: def.notes, timeline: recipeTimeline(def),
    tempC: def.tempC, ratios: def.ratio.targets, drippers: def.drippers, hasAmounts: hasStepAmounts(def)
  }));
}

export const fitsDripper = (r: BrewRecipe, dripper: string | null): boolean =>
  r.drippers.length === 0 || (dripper != null && r.drippers.includes(dripper));

export function brewSteps(db: DatabaseSync, id: number, water: StepAmounts | null): StepLine[] {
  const r = listRecipes(db).find((x) => x.id === id);
  return r ? recipeSteps(r.def, water ?? undefined) : [];
}

/** Picker order: fitting recipes first (by position in `rank`, then matched brews in `rows`, then name), then the rest the same way. */
export function orderRecipes(recipes: BrewRecipe[], rank: number[], rows: BrewRow[], dripper: string | null): BrewRecipe[] {
  const pos = (id: number) => { const i = rank.indexOf(id); return i < 0 ? Infinity : i; };
  const brews = (id: number) => rows.filter((r) => r.recipeId === id).length;
  return [...recipes].sort((a, b) =>
    Number(fitsDripper(b, dripper)) - Number(fitsDripper(a, dripper)) ||
    (pos(a.id) === pos(b.id) ? 0 : pos(a.id) < pos(b.id) ? -1 : 1) ||
    brews(b.id) - brews(a.id) || a.name.localeCompare(b.name));
}

export function suggestedRecipe(recipes: BrewRecipe[], rank: number[], rows: BrewRow[], dripper: string | null): BrewRecipe | null {
  const first = orderRecipes(recipes, rank, rows, dripper)[0];
  return first && fitsDripper(first, dripper) ? first : null;
}
