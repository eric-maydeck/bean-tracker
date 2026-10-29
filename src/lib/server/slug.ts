import type { DatabaseSync } from 'node:sqlite';
import { slugify } from '../slugify.ts';

export { slugify };

export function generateBaseSlug(params: {
  roaster: string;
  coffeeName: string;
  roastDate: string | null;
  createdAt: string;
}): string {
  const year = params.roastDate ? params.roastDate.slice(0, 4) : params.createdAt.slice(0, 4);
  return slugify(`${year}-${params.roaster}-${params.coffeeName}`);
}

// Live slugs and old (redirecting) slugs are both taken, except those that
// belong to `excludeId` itself: a coffee may rename back to an old slug.
// `IS NOT ?2` with ?2 = NULL matches every row, i.e. no exclusion.
export function slugExists(db: DatabaseSync, slug: string, excludeId?: number): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM coffees WHERE slug = ?1 AND id IS NOT ?2
       UNION ALL
       SELECT 1 FROM slug_redirects WHERE old_slug = ?1 AND coffee_id IS NOT ?2`
    )
    .get(slug, excludeId ?? null);
  return row != null;
}

// True when `slug` is exactly the auto-generated base, or that base with the
// numeric collision suffix uniqueSlug appends (`-2`, `-3`, …). Used to tell
// an auto-generated slug from one the user typed themselves, so identity
// edits only regenerate the former — a custom slug is never overwritten.
export function isAutoSlug(slug: string, base: string): boolean {
  if (slug === base) return true;
  if (!slug.startsWith(`${base}-`)) return false;
  const suffix = slug.slice(base.length + 1);
  return /^\d+$/.test(suffix) && Number(suffix) >= 2;
}

export function uniqueSlug(db: DatabaseSync, baseSlug: string, excludeId?: number): string {
  let candidate = baseSlug;
  let suffix = 2;
  while (slugExists(db, candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return candidate;
}
