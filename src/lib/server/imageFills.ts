// Backdrop fill behind contained coffee images.
// The background run also stores local copies of the same images, from the same single download; Preview's fetchImageFill
// never does. Server-only (sharp). Not imported by db.ts, so no .ts extensions.
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { LIGHT_BACKDROP, DARK_BACKDROP, NEUTRAL_BACKDROP } from '../imageBackdrop';
import { FillError, safeFetchBytes } from './productFetch';
import { imagesRoot, storeImageCopy, missingCopies, type CopyKind } from './imageCopies';

const SAMPLE = 64;
const OPAQUE = 128; // alpha at or above this counts as opaque
const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// Border (nearly) all opaque → the median border color. Otherwise → a backdrop
// contrasting with the foreground's mean luminance. "Nearly" is three quarters:
// a solid background covers almost the whole edge (rounded corners lose a
// little), while a tightly cropped wordmark touching the edges leaves big gaps
// (~half the border) and must not be mistaken for a background.
export async function computeFill(bytes: Buffer): Promise<string> {
  // fit 'fill' stretches, so the sampled border is the image's own border.
  // sharp reads only the first frame of an animated image by default.
  const data = await sharp(bytes, { limitInputPixels: 40_000_000 })
    .resize(SAMPLE, SAMPLE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const opaque = (i: number) => data[i * 4 + 3] >= OPAQUE;
  const border: number[] = [];
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      if (x === 0 || y === 0 || x === SAMPLE - 1 || y === SAMPLE - 1) border.push(y * SAMPLE + x);
    }
  }
  const solidBorder = border.filter(opaque);
  if (solidBorder.length * 4 >= border.length * 3) {
    return '#' + [0, 1, 2].map((ch) => hex2(median(solidBorder.map((i) => data[i * 4 + ch])))).join('');
  }
  let sum = 0;
  let n = 0;
  for (let i = 0; i < SAMPLE * SAMPLE; i++) {
    if (!opaque(i)) continue;
    sum += 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    n++;
  }
  if (n === 0) return NEUTRAL_BACKDROP;
  return sum / n < 128 ? LIGHT_BACKDROP : DARK_BACKDROP;
}

export function getImageFill(db: DatabaseSync, url: string): string | null {
  const row = db.prepare(`SELECT fill FROM image_fills WHERE url = ?`).get(url) as { fill: string } | undefined;
  return row?.fill ?? null;
}

export function setImageFill(db: DatabaseSync, url: string, fill: string): void {
  db.prepare(
    `INSERT INTO image_fills (url, fill) VALUES (?, ?) ON CONFLICT(url) DO UPDATE SET fill = excluded.fill`
  ).run(url, fill);
}

export type FetchBytes = (url: string) => Promise<{ status: number; body: Buffer }>;

// The cached fill, else fetch (SSRF-guarded), compute and cache it. Failures a
// URL can cause are FillErrors with a message fit to show under the preview.
export async function fetchImageFill(db: DatabaseSync, url: string, fetchBytes: FetchBytes = safeFetchBytes): Promise<string> {
  const cached = getImageFill(db, url);
  if (cached) return cached;
  const res = await fetchBytes(url);
  if (res.status !== 200) throw new FillError(`The image answered with HTTP ${res.status}`);
  let fill: string;
  try {
    fill = await computeFill(res.body);
  } catch {
    throw new FillError("Couldn't read that as an image");
  }
  setImageFill(db, url, fill);
  return fill;
}

// Displayed http(s) image URLs with no fill yet: coffees' own images,
// roaster defaults and gear photos. data: URIs are never fetched (they show the neutral backdrop).
export function missingFillUrls(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT u.url FROM (
         SELECT image_url AS url FROM coffees WHERE image_url != ''
         UNION SELECT image_url FROM roaster_images
         UNION SELECT image_url FROM gear_details WHERE image_url != ''
       ) u LEFT JOIN image_fills f ON f.url = u.url
       WHERE f.url IS NULL AND (u.url LIKE 'http://%' OR u.url LIKE 'https://%')`
    )
    .all() as { url: string }[];
  return rows.map((r) => r.url);
}

// ponytail: in-memory skip list, so a failing URL is retried on the next boot
// only; persist failures with a timestamp if retrying needs to be smarter.
const failed = new Set<string>();
let running: Promise<void> | null = null;
let again = false;

// Everything a URL still needs from one download: its fill and/or its copies.
function pendingWork(db: DatabaseSync, root: string): Map<string, { fill: boolean; kinds: CopyKind[] }> {
  const work = new Map<string, { fill: boolean; kinds: CopyKind[] }>();
  const entry = (url: string) => work.get(url) ?? work.set(url, { fill: false, kinds: [] }).get(url)!;
  for (const url of missingFillUrls(db)) entry(url).fill = true;
  for (const { url, kind } of missingCopies(db, root)) entry(url).kinds.push(kind);
  return work;
}

async function processUrl(
  db: DatabaseSync,
  root: string,
  url: string,
  need: { fill: boolean; kinds: CopyKind[] },
  fetchBytes: FetchBytes
): Promise<void> {
  const res = await fetchBytes(url);
  if (res.status !== 200) throw new FillError(`The image answered with HTTP ${res.status}`);
  if (need.fill) {
    let fill: string;
    try {
      fill = await computeFill(res.body);
    } catch {
      throw new FillError("Couldn't read that as an image");
    }
    setImageFill(db, url, fill);
  }
  for (const kind of need.kinds) await storeImageCopy(db, root, url, kind, res.body);
}

// Fills and copies missing URLs one at a time, one download per URL. Callers
// never await it (a save or boot must not wait on the network); a call during
// a run makes that run go round once more, so a URL saved mid-run isn't
// missed. Never rejects. Returns the run, for tests.
export function queueFillMissing(
  db: DatabaseSync,
  fetchBytes: FetchBytes = safeFetchBytes,
  root: string = imagesRoot()
): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      for (const [url, need] of pendingWork(db, root)) {
        if (failed.has(url)) continue;
        try {
          await processUrl(db, root, url, need, fetchBytes);
        } catch (err) {
          failed.add(url);
          console.error(`image fill/copy failed for ${url}:`, err instanceof Error ? err.message : err);
        }
      }
    } while (again);
  })()
    .catch((err) => console.error('image fill run failed:', err))
    .finally(() => {
      running = null;
    });
  return running;
}
