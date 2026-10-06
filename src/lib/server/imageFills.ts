// Backdrop fill behind contained coffee images (spec 2026-10-05 "Image fill
// and fit"). Server-only (sharp). Not imported by db.ts, so no .ts extensions.
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { LIGHT_BACKDROP, DARK_BACKDROP, NEUTRAL_BACKDROP } from '../imageBackdrop';

const SAMPLE = 64;
const OPAQUE = 128; // alpha at or above this counts as opaque
const hex2 = (n: number) => n.toString(16).padStart(2, '0');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// Border mostly opaque → the median border color. Mostly transparent → a
// backdrop contrasting with the foreground's mean luminance.
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
  if (solidBorder.length * 2 >= border.length) {
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
