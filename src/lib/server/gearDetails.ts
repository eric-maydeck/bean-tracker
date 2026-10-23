import type { DatabaseSync } from 'node:sqlite';
import type { GearKind, GearValues } from '$lib/gear';

export interface GearDetail {
  kind: GearKind; name: string; values: GearValues; imageUrl: string | null;
  imageCopy: string | null; imageFill: string | null; createdAt: string; updatedAt: string;
}

export function getGearDetails(db: DatabaseSync): GearDetail[] {
  const rows = db.prepare(
    `SELECT g.kind, g.name, g.fields, g.image_url AS imageUrl, g.created_at AS createdAt, g.updated_at AS updatedAt,
            (SELECT '/img/gear/' || ic.file FROM image_copies ic WHERE ic.url = g.image_url AND ic.kind = 'gear') AS imageCopy,
            (SELECT fill FROM image_fills f WHERE f.url = g.image_url) AS imageFill
     FROM gear_details g`
  ).all() as (Omit<GearDetail, 'values'> & { fields: string })[];
  return rows.map(({ fields, ...r }) => ({ ...r, values: JSON.parse(fields) as GearValues }));
}

// Upsert; nothing to store (no values, no image) removes the row. created_at is set once, updated_at on every save.
export function saveGearDetails(
  db: DatabaseSync, d: { kind: GearKind; name: string; values: GearValues; imageUrl: string | null }, now = new Date()
): void {
  if (!Object.keys(d.values).length && !d.imageUrl) {
    db.prepare(`DELETE FROM gear_details WHERE kind = ? AND name = ?`).run(d.kind, d.name);
    return;
  }
  const at = now.toISOString();
  db.prepare(
    `INSERT INTO gear_details (kind, name, fields, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind, name) DO UPDATE SET fields = excluded.fields, image_url = excluded.image_url, updated_at = excluded.updated_at`
  ).run(d.kind, d.name, JSON.stringify(d.values), d.imageUrl, at, at);
}
