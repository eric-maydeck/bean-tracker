import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodeCard } from '#lib/linkPreview.ts';
import { signPreviewUrls, verifyCard } from './previewCard';

const S = 'test-secret';
const sign = (c: string) => createHmac('sha256', S).update(`preview-card:${c}`).digest('base64url').slice(0, 22);
const raw = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const check = (v: unknown) => { const c = raw(v); return verifyCard(c, sign(c), S); };
const pour = [0, 10, 50, 0];

describe('verifyCard with a timeline', () => {
  const timeline = { pours: [{ startS: 0, durationS: 10, grams: 50, kind: 'bloom' as const }, { startS: 40, durationS: 20, grams: 150, kind: 'fast' as const }], swirls: [5], totalS: 90, windows: [{ startS: 0, targetS: 40, bloom: 0 }] };
  it('round-trips through encode, sign and verify', () => {
    const html = signPreviewUrls(`x/preview.png?c=${encodeCard({ big: 'A', label: 'B', timeline })}"`, S);
    const [, c, s] = html.match(/c=([\w-]+)&amp;s=([\w-]+)/)!;
    expect(verifyCard(c, s, S)).toEqual({ big: 'A', label: 'B', timeline });
  });
  it('text-only cards still verify', () => {
    expect(check(['A', 'B'])).toEqual({ big: 'A', label: 'B' });
  });
  it.each([
    ['not an array', 'x'],
    ['wrong length', [[pour], [], 90]],
    ['unknown kind', [[[0, 10, 50, 4]], [], 90, []]],
    ['fractional kind', [[[0, 10, 50, 1.5]], [], 90, []]],
    ['negative seconds', [[[-1, 10, 50, 0]], [], 90, []]],
    ['huge grams', [[[0, 10, 1e9, 0]], [], 90, []]],
    ['non-number', [[[0, '10', 50, 0]], [], 90, []]],
    ['null total', [[pour], [], null, []]],
    ['too many pours', [Array.from({ length: 61 }, () => pour), [], 90, []]],
    ['too many swirls', [[pour], Array.from({ length: 61 }, () => 1), 90, []]],
    ['bad window', [[pour], [], 90, [[0, 40]]]],
    ['bad swirl', [[pour], ['a'], 90, []]]
  ])('rejects %s', (_n, t) => {
    expect(check(['A', 'B', t])).toBeNull();
  });
});
