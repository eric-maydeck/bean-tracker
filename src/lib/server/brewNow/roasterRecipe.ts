// On-demand search for a roaster's published brew guide; one cached row per roaster (url NULL = none found).
import type { DatabaseSync } from 'node:sqlite';
import { searchTavilyText, tavilyAvailable } from '../imageSuggest/providers/tavily';
import { getRoasterWebsite } from '../roasterWebsites';

export interface RoasterRecipe { roaster: string; url: string | null; title: string | null; snippet: string | null; searchedAt: string }
export const SEARCH_UNAVAILABLE = "Search isn't available right now";

export function getRoasterRecipe(db: DatabaseSync, roaster: string): RoasterRecipe | null {
  const r = db.prepare(`SELECT roaster, url, title, snippet, searched_at AS searchedAt FROM roaster_recipes WHERE roaster = ?`).get(roaster.trim()) as RoasterRecipe | undefined;
  return r ?? null;
}

const LOOKS_LIKE_RECIPE = /\d\s*:\s*\d|\d\s*(g|grams?)\b|\b(recipe|brew guide|pour over)\b/i;

export async function findRoasterRecipe(
  db: DatabaseSync, roaster: string, now: Date, search = searchTavilyText
): Promise<RoasterRecipe | { error: string }> {
  if (tavilyAvailable(db, now) !== true) return { error: SEARCH_UNAVAILABLE };
  const site = getRoasterWebsite(db, roaster);
  let results;
  try {
    results = await search(`${roaster.trim()} brew guide recipe pour over`, site ? new URL(site).hostname : null, AbortSignal.timeout(10_000), db, now);
  } catch {
    return { error: SEARCH_UNAVAILABLE };
  }
  const hit = results.find((r) => LOOKS_LIKE_RECIPE.test(`${r.title} ${r.content}`));
  const row = { url: hit?.url ?? null, title: hit?.title ?? null, snippet: hit ? hit.content.slice(0, 280) : null, searchedAt: now.toISOString() };
  db.prepare(
    `INSERT INTO roaster_recipes (roaster, url, title, snippet, searched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(roaster) DO UPDATE SET url = excluded.url, title = excluded.title, snippet = excluded.snippet, searched_at = excluded.searched_at`
  ).run(roaster.trim(), row.url, row.title, row.snippet, row.searchedAt);
  return { roaster: roaster.trim(), ...row };
}
