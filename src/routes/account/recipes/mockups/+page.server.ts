import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { discoverGroups, listRecipes } from '$lib/server/recipes';
import { recipeTimeline } from '$lib/recipes';

// Temporary (Task 6 deletes it).
export const load: PageServerLoad = ({ locals }) => {
  if (!locals.isAdmin) redirect(303, '/login?redirectTo=%2Faccount%2Frecipes%2Fmockups');
  const db = getDb();
  const items = [
    ...listRecipes(db).slice(0, 1).map((r) => ({ name: r.name, timeline: recipeTimeline(r.def) })),
    ...discoverGroups(db).slice(0, 3).map((g) => ({ name: g.description, timeline: g.timeline }))
  ];
  return { items };
};
