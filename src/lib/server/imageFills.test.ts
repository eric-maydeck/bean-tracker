import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { computeFill } from './imageFills';
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
