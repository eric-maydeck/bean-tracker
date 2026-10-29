import { describe, it, expect } from 'vitest';
import { recipeSlugs, recipeIdBySlug, recipeHref } from './recipeSlug';

describe('recipeSlugs', () => {
  const rs = [{ id: 2, name: 'Beans Beans Floral' }, { id: 5, name: 'beans-beans-floral' }, { id: 1, name: 'Shoebox QC' }];
  it('slugs names; the lowest id keeps the plain slug on a clash', () => {
    expect([...recipeSlugs(rs)]).toEqual([[1, 'shoebox-qc'], [2, 'beans-beans-floral'], [5, 'beans-beans-floral-5']]);
  });
  it('finds a recipe by slug and builds the path', () => {
    expect(recipeIdBySlug(rs, 'beans-beans-floral-5')).toBe(5);
    expect(recipeIdBySlug(rs, 'nope')).toBeNull();
    expect(recipeHref('shoebox-qc')).toBe('/recipes/shoebox-qc');
  });
  it('drops apostrophes instead of splitting the word', () =>
    expect(recipeSlugs([{ id: 1, name: "Bean's Beans Standard" }, { id: 2, name: 'Beans’ Floral' }]).get(1)).toBe('beans-beans-standard'));
  it('falls back for a name with no letters', () => expect(recipeSlugs([{ id: 3, name: '!!' }]).get(3)).toBe('recipe'));
});
