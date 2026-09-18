import type { DatabaseSync } from 'node:sqlite';

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateBaseSlug(params: {
  roaster: string;
  coffeeName: string;
  roastDate: string | null;
  createdAt: string;
}): string {
  const year = params.roastDate ? params.roastDate.slice(0, 4) : params.createdAt.slice(0, 4);
  return slugify(`${year}-${params.roaster}-${params.coffeeName}`);
}

export function slugExists(db: DatabaseSync, slug: string, excludeId?: number): boolean {
  const row =
    excludeId != null
      ? db.prepare(`SELECT id FROM coffees WHERE slug = ? AND id != ?`).get(slug, excludeId)
      : db.prepare(`SELECT id FROM coffees WHERE slug = ?`).get(slug);
  return row != null;
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
