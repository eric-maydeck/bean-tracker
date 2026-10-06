// Our own copies of displayed images (spec 2026-10-06-local-image-copies-design.md).
// Content-addressed files under images/<kind>/ next to the DB, plus the
// image_copies table. Written only by the background run in imageFills.ts.
// Server-only (sharp, fs). Not imported by db.ts, so no .ts extensions.
import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export const COPY_KINDS = ['coffees', 'roasters'] as const;
export type CopyKind = (typeof COPY_KINDS)[number];
export const COPY_FILE_RE = /^[0-9a-f]{64}\.webp$/;
const MAX_SIDE = 800;

export function imagesRoot(dbPath = process.env.DB_PATH ?? 'data/bean-tracker.db'): string {
  return join(dirname(dbPath), 'images');
}

export function copyPath(root: string, kind: CopyKind, file: string): string {
  return join(root, kind, file);
}

// Named by the original bytes (stable across sharp upgrades), so the same
// picture is one file and a changed picture is a new one: files never change.
export async function storeImageCopy(
  db: DatabaseSync,
  root: string,
  url: string,
  kind: CopyKind,
  bytes: Buffer
): Promise<string> {
  const file = `${createHash('sha256').update(bytes).digest('hex')}.webp`;
  const path = copyPath(root, kind, file);
  if (!existsSync(path)) {
    const webp = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp()
      .toBuffer();
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, webp);
    renameSync(tmp, path);
  }
  db.prepare(
    `INSERT INTO image_copies (url, kind, file) VALUES (?, ?, ?)
     ON CONFLICT(url, kind) DO UPDATE SET file = excluded.file`
  ).run(url, kind, file);
  return file;
}

// Displayed http(s) URLs per kind whose copy is missing: no row, or a row
// whose file is gone (e.g. a DB restored without its images).
export function missingCopies(db: DatabaseSync, root: string): { url: string; kind: CopyKind }[] {
  const rows = db
    .prepare(
      `SELECT u.url, u.kind, ic.file FROM (
         SELECT image_url AS url, 'coffees' AS kind FROM coffees WHERE image_url != ''
         UNION SELECT image_url, 'roasters' FROM roaster_images
       ) u LEFT JOIN image_copies ic ON ic.url = u.url AND ic.kind = u.kind
       WHERE u.url LIKE 'http://%' OR u.url LIKE 'https://%'`
    )
    .all() as { url: string; kind: CopyKind; file: string | null }[];
  return rows
    .filter((r) => !r.file || !existsSync(copyPath(root, r.kind, r.file)))
    .map(({ url, kind }) => ({ url, kind }));
}
