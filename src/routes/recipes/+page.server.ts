import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth';
import {
  MIN_GROUP, RecipeError, brewCount, brewsFor, deleteRecipe, discoverGroups, dismissStructure, getNoteWords, setNoteWords, listDrippers, listRecipes, lockedDrippers, matchedBy, saveRecipe,
  smallGroupCount, undismissStructure
} from '$lib/server/recipes';
import { describeRecipe, parseRecipeInput, parseRecipeDef, recipeTimeline } from '$lib/recipes';
import { describeReading, type PourReading } from '$lib/pours';
import { parseNoteWords } from '$lib/agitation';
import { parseRecipesView } from '$lib/recipesView';

export const load: PageServerLoad = ({ locals, url }) => {
  // Public read; structures found in brews, hidden ones and note words are the admin's workbench.
  const admin = locals.isAdmin;
  const db = getDb();
  const view = parseRecipesView(url.searchParams);
  if (!admin) {
    delete view.view;
    if (view.brews && 'key' in view.brews) delete view.brews;
  }

  const stats = new Map(
    (
      db
        .prepare(
          `SELECT x.recipe_id id,
                  SUM(x.how = 'logged') logged, SUM(x.how = 'match') matched, SUM(x.how = 'modified') modified,
                  AVG(CASE WHEN b.rating > 0 THEN b.rating END) avg, COUNT(*) n
           FROM brew_recipe_matches x JOIN beanconqueror_brews b ON b.id = x.brew_id GROUP BY x.recipe_id`
        )
        .all() as { id: number; logged: number; matched: number; modified: number; avg: number | null; n: number }[]
    ).map((r) => [r.id, r])
  );
  const recipes = listRecipes(db)
    .map((recipe) => {
      const s = stats.get(recipe.id);
      return {
        recipe,
        description: describeRecipe(recipe.def),
        timeline: recipeTimeline(recipe.def),
        counts: { logged: s?.logged ?? 0, match: s?.matched ?? 0, modified: s?.modified ?? 0 },
        avgRating: s?.avg ?? null,
        n: s?.n ?? 0
      };
    })
    .sort((a, b) => b.n - a.n || a.recipe.name.localeCompare(b.recipe.name));

  const t = db
    .prepare(
      `SELECT COUNT(CASE WHEN r.pour_count > 0 THEN 1 END) read,
              COUNT(CASE WHEN r.pour_count > 0 AND r.low_confidence = 1 THEN 1 END) low
       FROM brew_pour_readings r`
    )
    .get() as { read: number; low: number };
  const notesOnly = (
    db
      .prepare(
        `SELECT COUNT(*) n FROM brew_recipe_matches x JOIN beanconqueror_brews b ON b.id = x.brew_id
         LEFT JOIN brew_pour_readings r ON r.bc_uuid = b.bc_uuid
         WHERE x.how = 'logged' AND COALESCE(r.pour_count, 0) = 0`
      )
      .get() as { n: number }
  ).n;

  let hidden: { key: string; description: string; count: number; matchedBy: { name: string; count: number }[] }[] | null = null;
  if (admin && view.view === 'hidden') {
    hidden = (
      db
        .prepare(
          `SELECT d.structure_key key, COUNT(r.bc_uuid) count, MIN(r.reading) reading
           FROM dismissed_structures d LEFT JOIN brew_pour_readings r ON r.structure_key = d.structure_key
           GROUP BY d.structure_key ORDER BY count DESC, d.structure_key`
        )
        .all() as { key: string; count: number; reading: string | null }[]
    ).map((h) => ({
      key: h.key,
      count: h.count,
      description: h.reading ? describeReading(JSON.parse(h.reading) as PourReading) : h.key,
      matchedBy: matchedBy(db, h.key)
    }));
  }

  const groups = admin ? discoverGroups(db) : [];
  // A ?brews=s<key> that isn't listed as a group (too small, dismissed, matched by a recipe) still opens, in its own panel.
  let unlisted: { key: string; description: string; count: number } | null = null;
  const item = view.brews;
  if (item && 'key' in item && !groups.some((g) => g.key === item.key)) {
    const row = db
      .prepare(`SELECT reading FROM brew_pour_readings WHERE structure_key = ? AND pour_count > 0 LIMIT 1`)
      .get(item.key) as { reading: string } | undefined;
    if (row)
      unlisted = {
        key: item.key,
        description: describeReading(JSON.parse(row.reading) as PourReading),
        count: brewCount(db, item)
      };
  }

  return {
    recipes,
    groups,
    drippers: listDrippers(db),
    locked: lockedDrippers(db),
    unlisted,
    minGroup: MIN_GROUP,
    brewsTotal: view.brews ? brewCount(db, view.brews) : 0,
    smallGroups: admin ? smallGroupCount(db) : 0,
    hiddenCount: admin ? (db.prepare(`SELECT COUNT(*) n FROM dismissed_structures`).get() as { n: number }).n : 0,
    hidden,
    brews: view.brews ? brewsFor(db, view.brews, view.order) : null,
    view,
    noteWords: admin ? getNoteWords(db) : [],
    totals: { read: t.read, lowConfidence: t.low, notesOnly }
  };
};

const text = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' ? v : '';
};

export const actions: Actions = {
  saveRecipe: async ({ request, locals }) => {
    requireAdmin(locals);
    const f = await request.formData();
    let json: unknown;
    try {
      json = JSON.parse(text(f, 'definition'));
    } catch {
      return fail(400, { error: 'Invalid recipe' });
    }
    const input = parseRecipeInput(text(f, 'name'), text(f, 'tags'));
    if ('error' in input) return fail(400, { error: input.error });
    const parsed = parseRecipeDef(json);
    if ('error' in parsed) return fail(400, { error: parsed.error });
    const idText = text(f, 'id');
    const id = idText ? Number(idText) : undefined;
    if (id !== undefined && !Number.isInteger(id)) return fail(400, { error: 'Invalid recipe' });
    try {
      let locks: Record<string, boolean> | undefined;
      try {
        locks = JSON.parse(text(f, 'locks') || '{}');
      } catch {
        return fail(400, { error: 'Invalid recipe' });
      }
      return { saved: saveRecipe(getDb(), { id, name: input.name, tags: input.tags, def: parsed.def, locks }) };
    } catch (e) {
      if (e instanceof RecipeError) return fail(400, { error: e.message });
      throw e;
    }
  },
  deleteRecipe: async ({ request, locals }) => {
    requireAdmin(locals);
    const id = Number(text(await request.formData(), 'id'));
    if (!Number.isInteger(id)) return fail(400, { error: 'Invalid recipe' });
    deleteRecipe(getDb(), id);
    return { deleted: id };
  },
  dismiss: async ({ request, locals }) => {
    requireAdmin(locals);
    const key = text(await request.formData(), 'key');
    if (!key) return fail(400, { error: 'Invalid structure' });
    dismissStructure(getDb(), key);
    return { dismissed: key };
  },
  saveNoteWords: async ({ request, locals }) => {
    requireAdmin(locals);
    const f = await request.formData();
    const agit = f.getAll('agitation');
    const parsed = parseNoteWords(f.getAll('word').map((w, i) => ({ word: w, agitation: agit[i] })));
    if ('error' in parsed) return fail(400, { noteWordsError: parsed.error });
    setNoteWords(getDb(), parsed.words);
    return { noteWordsSaved: true };
  },
  undismiss: async ({ request, locals }) => {
    requireAdmin(locals);
    const key = text(await request.formData(), 'key');
    if (!key) return fail(400, { error: 'Invalid structure' });
    const db = getDb();
    undismissStructure(db, key);
    return { undismissed: key, now: matchedBy(db, key) };
  }
};
