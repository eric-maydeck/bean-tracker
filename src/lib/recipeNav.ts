import type { ActionResult } from '@sveltejs/kit';

// After a recipe action on /recipes/<slug>: where to go so the page never re-loads a slug that no longer exists.
// A rename goes to the new slug, a delete to /recipes; anything else (another recipe, a failure) stays and updates.
export function recipeFollow(result: ActionResult, focusId: number | null): string | null {
  if (focusId == null || result.type !== 'success') return null;
  const d = result.data as { saved?: number; slug?: string; deleted?: number } | undefined;
  if (d?.deleted === focusId) return '/recipes';
  if (d?.saved === focusId && d.slug) return `/recipes/${d.slug}`;
  return null;
}
