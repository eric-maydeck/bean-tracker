import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeCard } from '#lib/linkPreview.ts';
import { signPreviewUrls } from '#lib/server/previewCard.ts';
import { GET } from './+server';

const get = (q: string) => GET({ url: new URL(`http://x/preview.png?${q}`) } as never);

describe('/preview.png', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    vi.stubEnv('PREVIEW_CARDS', '1');
  });

  it('404s everything while the PREVIEW_CARDS flag is off', async () => {
    vi.stubEnv('PREVIEW_CARDS', '');
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'A', label: 'B' })}">`);
    await expect(get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'))).rejects.toMatchObject({ status: 404 });
  });

  it('draws a signed card: 1200×630, cacheable', async () => {
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Kamwangi AA', label: 'Señor Roaster' })}">`);
    const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });

  it('draws a card with a pour timeline: 1200×630', async () => {
    const timeline = { pours: [{ startS: 0, durationS: 10, grams: 50, kind: 'bloom' as const }, { startS: 40, durationS: 20, grams: 150, kind: 'slow' as const }], swirls: [5], totalS: 90, windows: [{ startS: 0, targetS: 40, bloom: 0 }] };
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Floral', label: 'Recipes', timeline })}">`);
    const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([res.headers.get('content-type'), meta.width, meta.height]).toEqual(['image/png', 1200, 630]);
  });

  it.each([
    ['bars', { kind: 'bars' as const, rows: [['Sey', '8.7', 1], ['A very long roaster name that will not fit on one line at all', '8.0', 0.7]] as [string, string, number][] }],
    ['tile', { kind: 'tile' as const, value: '9.2', holder: 'Test Roaster · Lab Bag 3', date: '2026-08-01' }],
    ['grid', { kind: 'grid' as const, tiles: [['Best bag', '9.2'], ['Best day', '$9.30 / 100g']] as [string, string][] }],
    ['vbars', { kind: 'vbars' as const, stacked: true, series: [['Light', 0], ['Medium', 3], ['Other', 17]].map(([label, color], i) => ({ label: label as string, color: color as number, values: [10 + i, 20, 30, 15, 5, 25, 40, 12].map((v) => Math.round((v + i * 5) / 2.5)) })) }],
    ['lines', { kind: 'lines' as const, series: [{ label: 'Brewed', color: 14, values: [10, 40, null, 80, 60, 100] }, { label: 'Bought', color: 16, values: [30, 30, 50, 20, 90, 70] }] }]
  ])('draws a Stats card with a %s thumbnail: 1200×630', async (_n, thumb) => {
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Roasters', label: 'Stats · All time', thumb })}">`);
    const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([res.headers.get('content-type'), meta.width, meta.height]).toEqual(['image/png', 1200, 630]);
  });

  it('draws a coffee card with its saved photo, and the card without it when the file is gone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pc-'));
    vi.stubEnv('DB_PATH', join(dir, 'db.sqlite'));
    const file = `${'b'.repeat(64)}.webp`;
    mkdirSync(join(dir, 'images', 'coffees'), { recursive: true });
    writeFileSync(join(dir, 'images', 'coffees', file), await sharp({ create: { width: 300, height: 500, channels: 3, background: '#336699' } }).webp({ lossless: true }).toBuffer());
    const png = async (name: string) => {
      const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Kamwangi AA', label: 'Sey', coffee: { photo: { src: `/img/coffees/${name}`, fill: '#e6ddd2' } } })}">`);
      const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
      return sharp(Buffer.from(await res.arrayBuffer()));
    };
    // The photo's blue shows in the right-hand box; with no file, that spot is the cream background.
    const at = async (img: ReturnType<typeof sharp>) => [...(await img.extract({ left: 928, top: 240, width: 1, height: 1 }).raw().toBuffer())].slice(0, 3);
    expect(await at(await png(file))).toEqual([0x33, 0x66, 0x99]);
    expect(await at(await png(`${'c'.repeat(64)}.webp`))).toEqual([0xfa, 0xf7, 0xf2]);
    rmSync(dir, { recursive: true });
  });

  it('404s unsigned or tampered text', async () => {
    const c = encodeCard({ big: 'Anything', label: '' });
    await expect(get(`c=${c}`)).rejects.toMatchObject({ status: 404 });
    await expect(get(`c=${c}&s=${'a'.repeat(22)}`)).rejects.toMatchObject({ status: 404 });
  });
});
