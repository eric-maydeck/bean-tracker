import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createDb } from './db';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { setRoasterImage } from './roasterImages';
import { imagesRoot, copyPath, storeImageCopy, missingCopies, COPY_FILE_RE } from './imageCopies';

const png = (w: number, h: number, background = '#6b4f3a') =>
  sharp({ create: { width: w, height: h, channels: 4, background } }).png().toBuffer();
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

let db: DatabaseSync;
let root: string;
beforeEach(() => {
  db = createDb(':memory:');
  root = mkdtempSync(join(tmpdir(), 'bt-images-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const input_ = (over: Partial<NewCoffeeInput>): NewCoffeeInput => ({
  roaster: 'Norml', coffee_name: 'A', origin: null, roast_level: null, processing: null, amount_g: null, cost: null,
  roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
  image_url: null, ...over
});
let n = 0; // distinct names → distinct slugs
const coffee = (over: Partial<NewCoffeeInput>) => createCoffee(db, input_({ coffee_name: `C${n++}`, ...over }));

describe('imagesRoot', () => {
  it('is images/ next to the DB', () => {
    expect(imagesRoot('/srv/data/bean-tracker.db')).toBe(join('/srv/data', 'images'));
    expect(imagesRoot('data/bean-tracker.db')).toBe(join('data', 'images'));
  });
});

describe('storeImageCopy', () => {
  it('names the file by the original bytes and writes a WebP within 800px', async () => {
    const bytes = await png(2000, 1000);
    const file = await storeImageCopy(db, root, 'https://x/a.png', 'coffees', bytes);
    expect(file).toBe(`${sha(bytes)}.webp`);
    expect(file).toMatch(COPY_FILE_RE);
    const meta = await sharp(copyPath(root, 'coffees', file)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(400);
  });

  it('never enlarges and keeps alpha', async () => {
    const bytes = await png(100, 50, '#00000000');
    const file = await storeImageCopy(db, root, 'https://x/s.png', 'roasters', bytes);
    const meta = await sharp(copyPath(root, 'roasters', file)).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([100, 50, true]);
  });

  it('stores under its kind folder and records the row', async () => {
    const file = await storeImageCopy(db, root, 'https://x/a.png', 'roasters', await png(10, 10));
    expect(readdirSync(join(root, 'roasters'))).toEqual([file]);
    expect(existsSync(join(root, 'coffees'))).toBe(false);
    expect(db.prepare(`SELECT url, kind, file FROM image_copies`).all()).toEqual([{ url: 'https://x/a.png', kind: 'roasters', file }]);
  });

  it('the same picture under two URLs is one file, two rows', async () => {
    const bytes = await png(10, 10);
    const a = await storeImageCopy(db, root, 'https://x/a.png', 'coffees', bytes);
    const b = await storeImageCopy(db, root, 'https://x/b.png', 'coffees', bytes);
    expect(a).toBe(b);
    expect(readdirSync(join(root, 'coffees'))).toEqual([a]);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM image_copies`).get()).toEqual({ n: 2 });
  });

  it('a new picture for the same URL repoints the row and keeps the old file', async () => {
    const old = await storeImageCopy(db, root, 'https://x/a.png', 'coffees', await png(10, 10, '#111111'));
    const neu = await storeImageCopy(db, root, 'https://x/a.png', 'coffees', await png(10, 10, '#eeeeee'));
    expect(neu).not.toBe(old);
    expect(readdirSync(join(root, 'coffees')).sort()).toEqual([old, neu].sort());
    expect(db.prepare(`SELECT file FROM image_copies WHERE url = ?`).get('https://x/a.png')).toEqual({ file: neu });
  });

  it('rejects bytes that are not an image and writes nothing', async () => {
    await expect(storeImageCopy(db, root, 'https://x/a.png', 'coffees', Buffer.from('not an image'))).rejects.toThrow();
    expect(existsSync(join(root, 'coffees'))).toBe(false);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM image_copies`).get()).toEqual({ n: 0 });
  });
});

describe('missingCopies', () => {
  it('lists displayed http(s) URLs per kind with no copy', () => {
    coffee({ image_url: 'https://x/bag.png' });
    coffee({ image_url: 'data:image/png;base64,AAAA' });
    coffee({ image_url: '' });
    setRoasterImage(db, 'Norml', 'https://x/logo.png');
    expect(missingCopies(db, root).sort((a, b) => a.url.localeCompare(b.url))).toEqual([
      { url: 'https://x/bag.png', kind: 'coffees' },
      { url: 'https://x/logo.png', kind: 'roasters' }
    ]);
  });

  it('a URL used both ways is missing once per kind', () => {
    coffee({ image_url: 'https://x/logo.png' });
    setRoasterImage(db, 'Norml', 'https://x/logo.png');
    expect(missingCopies(db, root).map((m) => m.kind).sort()).toEqual(['coffees', 'roasters']);
  });

  it('an existing copy is not missing, unless its file is gone', async () => {
    coffee({ image_url: 'https://x/bag.png' });
    const file = await storeImageCopy(db, root, 'https://x/bag.png', 'coffees', await png(10, 10));
    expect(missingCopies(db, root)).toEqual([]);
    unlinkSync(copyPath(root, 'coffees', file));
    expect(missingCopies(db, root)).toEqual([{ url: 'https://x/bag.png', kind: 'coffees' }]);
  });
});
