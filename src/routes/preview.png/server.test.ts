import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { encodeCard } from '#lib/linkPreview.ts';
import { signPreviewUrls } from '#lib/server/previewCard.ts';
import { GET } from './+server';

const get = (q: string) => GET({ url: new URL(`http://x/preview.png?${q}`) } as never);

describe('/preview.png', () => {
  beforeEach(() => vi.stubEnv('SESSION_SECRET', 'test-secret'));

  it('draws a signed card: 1200×630, cacheable', async () => {
    const html = signPreviewUrls(`<meta content="http://x/preview.png?c=${encodeCard({ big: 'Kamwangi AA', label: 'Señor Roaster' })}">`);
    const res = await get(html.match(/\?(.*)"/)![1].replace('&amp;', '&'));
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });

  it('404s unsigned or tampered text', async () => {
    const c = encodeCard({ big: 'Anything', label: '' });
    await expect(get(`c=${c}`)).rejects.toMatchObject({ status: 404 });
    await expect(get(`c=${c}&s=${'a'.repeat(22)}`)).rejects.toMatchObject({ status: 404 });
  });
});
