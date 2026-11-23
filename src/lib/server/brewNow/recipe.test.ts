import { describe, it, expect } from 'vitest';
import { createDb } from '../db';
import { saveRecipe } from '../recipes';
import { withDefaults } from '#lib/recipes.ts';
import { recipeSlugs } from '#lib/recipeSlug.ts';
import { recipeSteps } from '#lib/recipeSteps.ts';
import type { BrewRow } from './load';
import { loadBrewRecipes, fitsDripper, brewSteps, orderRecipes, suggestedRecipe } from './recipe';

const pour = { bloom: false, grams: null, share: 0.5, speed: 'fast', rateGps: null, agitation: null, tool: null, swirlAfter: false,
  startS: null, durationS: null, length: null };
const def = (o: Record<string, unknown> = {}) => withDefaults({ v: 1, pours: [{ ...pour, bloom: true }, pour], pourCount: { min: 2, max: 2 }, ratio: { targets: [16], tol: 0.5 }, ...o });
const mk = () => {
  const db = createDb(':memory:');
  const add = (name: string, o: Record<string, unknown> = {}) => saveRecipe(db, { name, tags: [], def: def(o) });
  return { db, add };
};
const rows = (...ids: (number | null)[]) => ids.map((recipeId) => ({ recipeId }) as BrewRow);

describe('loadBrewRecipes', () => {
  it('maps the def', () => {
    const { db, add } = mk();
    const id = add('Rec A', { tempC: 93, notes: 'hi', drippers: ['V60 02'], ratio: { targets: [15, 16], tol: 0.5 } });
    const [r] = loadBrewRecipes(db);
    expect(r).toMatchObject({ id, slug: recipeSlugs([{ id, name: 'Rec A' }]).get(id), name: 'Rec A', notes: 'hi', tempC: 93,
      ratios: [15, 16], drippers: ['V60 02'], hasAmounts: true });
  });
});

describe('fitsDripper', () => {
  it('empty fits anything; a list fits only its members', () => {
    const { db, add } = mk();
    add('Any'); add('V60', { drippers: ['V60 02'] });
    const [any, v60] = loadBrewRecipes(db);
    expect(fitsDripper(any, null)).toBe(true);
    expect(fitsDripper(v60, 'V60 02')).toBe(true);
    expect(fitsDripper(v60, 'Other')).toBe(false);
    expect(fitsDripper(v60, null)).toBe(false);
  });
});

describe('ordering', () => {
  const setup = () => {
    const { db, add } = mk();
    const a = add('A'), b = add('B'), c = add('C', { drippers: ['Other'] });
    return { db, a, b, c, recipes: loadBrewRecipes(db) };
  };
  it('fitting first, then rank, then brews', () => {
    const { a, b, c, recipes } = setup();
    const r = rows(a, a, c, c, c, c, c);
    expect(orderRecipes(recipes, [b], r, 'V60 02').map((x) => x.id)).toEqual([b, a, c]);
    expect(suggestedRecipe(recipes, [b], r, 'V60 02')?.id).toBe(b);
    expect(suggestedRecipe(recipes, [], r, 'V60 02')?.id).toBe(a);
  });
  it('null when nothing fits or nothing exists', () => {
    const { db, add } = mk();
    expect(suggestedRecipe([], [], [], null)).toBeNull();
    add('Only', { drippers: ['X'] });
    expect(suggestedRecipe(loadBrewRecipes(db), [], [], 'Y')).toBeNull();
  });
});

describe('brewSteps', () => {
  it('plain lines, amounts when asked, [] for an unknown id', () => {
    const { db, add } = mk();
    const id = add('A');
    expect(brewSteps(db, id, null)).toEqual(recipeSteps(def()));
    expect(brewSteps(db, id, { total: 200, mode: 'total' })[1].text).toContain('to 200g');
    expect(brewSteps(db, 999, null)).toEqual([]);
  });
});
