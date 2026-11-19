import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
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
    ['grid', { kind: 'grid' as const, tiles: [['Best bag', '9.2'], ['Best day', '$9.30 / 100g']] as [string, string][] }]
  ])('draws a Stats card with a %s thumbnail: 1200×630', async (_n, thumb) => {
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Roasters', label: 'Stats · All time', thumb })}">`);
    const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([res.headers.get('content-type'), meta.width, meta.height]).toEqual(['image/png', 1200, 630]);
  });

  it('404s unsigned or tampered text', async () => {
    const c = encodeCard({ big: 'Anything', label: '' });
    await expect(get(`c=${c}`)).rejects.toMatchObject({ status: 404 });
    await expect(get(`c=${c}&s=${'a'.repeat(22)}`)).rejects.toMatchObject({ status: 404 });
  });
});
