import { describe, it, expect } from 'vitest';
import { recipeFollow } from './recipeNav';

const ok = (data: object) => ({ type: 'success', status: 200, data }) as never;
describe('recipeFollow', () => {
  it('goes to the new slug after a rename and to /recipes after a delete of the focused recipe', () => {
    expect(recipeFollow(ok({ saved: 3, slug: 'new-name' }), 3)).toBe('/recipes/new-name');
    expect(recipeFollow(ok({ deleted: 3 }), 3)).toBe('/recipes');
  });
  it('stays for another recipe, no focus, or a failure', () => {
    expect(recipeFollow(ok({ saved: 4, slug: 'x' }), 3)).toBeNull();
    expect(recipeFollow(ok({ deleted: 4 }), 3)).toBeNull();
    expect(recipeFollow(ok({ saved: 3, slug: 'x' }), null)).toBeNull();
    expect(recipeFollow({ type: 'failure', status: 400, data: {} } as never, 3)).toBeNull();
  });
});
