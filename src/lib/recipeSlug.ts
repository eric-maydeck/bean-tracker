import { slugify } from './slugify';

// /recipes/<name-slug>: the recipe's name as a slug; the lowest id keeps the plain slug, a later recipe whose name
// slugs the same gets its id as a suffix (names are unique, but "A B" and "a-b" slug alike).
export function recipeSlugs(recipes: readonly { id: number; name: string }[]): Map<number, string> {
  const out = new Map<number, string>();
  const taken = new Set<string>();
  for (const r of [...recipes].sort((a, b) => a.id - b.id)) {
    const base = slugify(r.name) || 'recipe';
    const slug = taken.has(base) ? `${base}-${r.id}` : base;
    taken.add(slug);
    out.set(r.id, slug);
  }
  return out;
}

export const recipeHref = (slug: string) => `/recipes/${slug}`;

export function recipeIdBySlug(recipes: readonly { id: number; name: string }[], slug: string): number | null {
  for (const [id, s] of recipeSlugs(recipes)) if (s === slug) return id;
  return null;
}
