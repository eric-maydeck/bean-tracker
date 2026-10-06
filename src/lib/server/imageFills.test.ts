import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { createDb } from './db';
import { computeFill, getImageFill, setImageFill, fetchImageFill, missingFillUrls, queueFillMissing } from './imageFills';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { setRoasterImage } from './roasterImages';
import { FillError } from './productFetch';
import { LIGHT_BACKDROP, DARK_BACKDROP, NEUTRAL_BACKDROP } from '../imageBackdrop';

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const solid = (width: number, height: number, background: string) =>
  sharp({ create: { width, height, channels: 4, background } }).png().toBuffer();
// A transparent 64×64 canvas with an opaque 32×32 square in the middle (a logo glyph).
const glyph = (color: string) =>
  sharp({ create: { width: 64, height: 64, channels: 4, background: CLEAR } })
    .composite([{ input: { create: { width: 32, height: 32, channels: 4, background: color } }, left: 16, top: 16 }])
    .png()
    .toBuffer();

describe('computeFill', () => {
  it('opaque image: the border color', async () => {
    expect(await computeFill(await solid(40, 40, '#6b4f3a'))).toBe('#6b4f3a');
  });

  it('non-square image: the border color', async () => {
    expect(await computeFill(await solid(200, 50, '#a0b0c0'))).toBe('#a0b0c0');
  });

  it('samples the border, not the middle', async () => {
    const framed = await sharp({ create: { width: 120, height: 40, channels: 3, background: '#ffffff' } })
      .composite([{ input: { create: { width: 60, height: 20, channels: 3, background: '#000000' } }, left: 30, top: 10 }])
      .png()
      .toBuffer();
    expect(await computeFill(framed)).toBe('#ffffff');
  });

  it('transparent image with a dark glyph: the light backdrop', async () => {
    expect(await computeFill(await glyph('#1a1a1a'))).toBe(LIGHT_BACKDROP);
  });

  it('transparent image with a light glyph: the dark backdrop', async () => {
    expect(await computeFill(await glyph('#f5f5f5'))).toBe(DARK_BACKDROP);
  });

  it('fully transparent image: the neutral backdrop', async () => {
    expect(await computeFill(await sharp({ create: { width: 8, height: 8, channels: 4, background: CLEAR } }).png().toBuffer()))
      .toBe(NEUTRAL_BACKDROP);
  });

  it('reads SVG', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#6b4f3a"/></svg>';
    expect(await computeFill(Buffer.from(svg))).toBe('#6b4f3a');
  });

  it('reads GIF (first frame)', async () => {
    expect(await computeFill(await sharp({ create: { width: 16, height: 16, channels: 3, background: '#336699' } }).gif().toBuffer()))
      .toBe('#336699');
  });

  it('rejects bytes that are not an image', async () => {
    await expect(computeFill(Buffer.from('<html>not an image</html>'))).rejects.toThrow();
  });
});

describe('image_fills cache', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('is null until set, and an upsert replaces it', () => {
    expect(getImageFill(db, 'https://img.example/a.png')).toBeNull();
    setImageFill(db, 'https://img.example/a.png', '#111111');
    setImageFill(db, 'https://img.example/a.png', '#222222');
    expect(getImageFill(db, 'https://img.example/a.png')).toBe('#222222');
  });

  it('keys by the exact URL', () => {
    setImageFill(db, 'https://img.example/a.png', '#111111');
    expect(getImageFill(db, 'https://img.example/A.png')).toBeNull();
  });
});

describe('fetching fills', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = createDb(':memory:');
  });
  const input = (over: Partial<NewCoffeeInput>): NewCoffeeInput => ({
    roaster: 'Sey', coffee_name: 'A', origin: null, roast_level: null, processing: null, amount_g: null, cost: null,
    roast_date: null, frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
    image_url: null, ...over
  });
  const ok = (body: Buffer) => vi.fn(async () => ({ status: 200, body }));

  it('computes, caches, then answers from the cache without fetching', async () => {
    const fetchBytes = ok(await solid(10, 10, '#123456'));
    expect(await fetchImageFill(db, 'https://img.example/f1.png', fetchBytes)).toBe('#123456');
    expect(getImageFill(db, 'https://img.example/f1.png')).toBe('#123456');
    expect(await fetchImageFill(db, 'https://img.example/f1.png', fetchBytes)).toBe('#123456');
    expect(fetchBytes).toHaveBeenCalledTimes(1);
  });

  it('a non-200 or a non-image is a FillError and caches nothing', async () => {
    const notFound = vi.fn(async () => ({ status: 404, body: Buffer.alloc(0) }));
    await expect(fetchImageFill(db, 'https://img.example/f2.png', notFound)).rejects.toThrow(
      new FillError('The image answered with HTTP 404')
    );
    await expect(fetchImageFill(db, 'https://img.example/f3.png', ok(Buffer.from('<html></html>')))).rejects.toThrow(
      new FillError("Couldn't read that as an image")
    );
    expect(getImageFill(db, 'https://img.example/f2.png')).toBeNull();
    expect(getImageFill(db, 'https://img.example/f3.png')).toBeNull();
  });

  it('missingFillUrls: displayed http(s) URLs with no fill, once each', () => {
    createCoffee(db, input({ coffee_name: 'A', image_url: 'https://img.example/bag.png' }));
    createCoffee(db, input({ coffee_name: 'B', image_url: 'https://img.example/bag.png' }));
    createCoffee(db, input({ coffee_name: 'C', image_url: 'data:image/png;base64,AAAA' }));
    createCoffee(db, input({ coffee_name: 'D', image_url: 'https://img.example/done.png' }));
    setRoasterImage(db, 'Norml', 'https://img.example/logo.png');
    setImageFill(db, 'https://img.example/done.png', '#000000');
    expect(missingFillUrls(db).sort()).toEqual(['https://img.example/bag.png', 'https://img.example/logo.png']);
  });

  it('queueFillMissing: fills what it can, logs and skips a failure, and never refetches it in this process', async () => {
    createCoffee(db, input({ coffee_name: 'A', image_url: 'https://img.example/q-bad.png' }));
    createCoffee(db, input({ coffee_name: 'B', image_url: 'https://img.example/q-good.png' }));
    const good = await solid(8, 8, '#abcdef');
    const fetchBytes = vi.fn(async (url: string) =>
      url.endsWith('q-bad.png') ? { status: 404, body: Buffer.alloc(0) } : { status: 200, body: good }
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await queueFillMissing(db, fetchBytes);
    expect(getImageFill(db, 'https://img.example/q-good.png')).toBe('#abcdef');
    expect(getImageFill(db, 'https://img.example/q-bad.png')).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    await queueFillMissing(db, fetchBytes);
    expect(fetchBytes).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it('queueFillMissing: a call during a run shares it and goes round again for URLs saved meanwhile', async () => {
    const body = await solid(8, 8, '#010203');
    createCoffee(db, input({ coffee_name: 'A', image_url: 'https://img.example/r-first.png' }));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchBytes = vi.fn(async () => {
      await gate;
      return { status: 200, body };
    });
    const run = queueFillMissing(db, fetchBytes);
    createCoffee(db, input({ coffee_name: 'B', image_url: 'https://img.example/r-second.png' }));
    expect(queueFillMissing(db, fetchBytes)).toBe(run);
    release();
    await run;
    expect(getImageFill(db, 'https://img.example/r-first.png')).toBe('#010203');
    expect(getImageFill(db, 'https://img.example/r-second.png')).toBe('#010203');
  });
});
