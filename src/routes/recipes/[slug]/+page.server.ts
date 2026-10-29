import type { PageServerLoad } from './$types';
import { actions as base, _loadRecipes } from '../+page.server';

export const load: PageServerLoad = (event) => _loadRecipes(event, event.params.slug);
// The forms post to the page they are on (?/saveRecipe), so this route carries the same actions.
export const actions = base;
