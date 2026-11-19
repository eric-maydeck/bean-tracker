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

describe('verifyCard with a thumbnail', () => {
  const bars = { kind: 'bars' as const, rows: [['Kenya', '8.1', 1], ['Peru', '7.0', 0.5]] as [string, string, number][] };
  const v = (vals: unknown) => [['A', 0, vals], ['B', 17, vals]];
  const chartThumbs = [
    { kind: 'vbars' as const, series: [{ label: 'A', color: 0, values: [0, 50, 100] }, { label: 'B', color: 17, values: [10, 20, 30] }] },
    { kind: 'vbars' as const, stacked: true, series: [{ label: 'A', color: 3, values: [0, 100] }] },
    { kind: 'lines' as const, series: [{ label: 'A', color: 2, values: [0, null, 100] }] },
    { kind: 'vbars' as const, series: [{ label: 'A', color: 2, values: [0, 50, 100], colors: [2, 16, 16] }], x: [[0, 'Mon'], [2, 'Wed']] as [number, string][], y: ['0g', '9g'] as [string, string], vals: ['0g', '5g', '9g'] },
    { kind: 'lines' as const, series: [{ label: 'A', color: 2, values: [0, 100] }], x: [[1, 'Nov']] as [number, string][], y: ['0', '9'] as [string, string] }
  ];
  const thumbs = [bars, { ...bars, plain: true }, { kind: 'tile' as const, value: '9.2', holder: 'Lab', date: '2026-08-01' }, { kind: 'tile' as const, value: '9.2', holder: 'Lab' }, { kind: 'grid' as const, tiles: [['Best bag', '9.2']] as [string, string][] }, ...chartThumbs];
  it.each(thumbs.map((t, i) => [`${t.kind} #${i}`, t] as const))('round-trips %s', (_n, thumb) => {
    const html = signPreviewUrls(`x/preview.png?c=${encodeCard({ big: 'A', label: 'B', thumb })}"`, S);
    const [, c, s] = html.match(/c=([\w-]+)&amp;s=([\w-]+)/)!;
    expect(verifyCard(c, s, S)).toEqual({ big: 'A', label: 'B', thumb });
  });
  it('keeps a timeline beside a thumbnail', () => {
    const timeline = { pours: [{ startS: 0, durationS: 10, grams: 50, kind: 'bloom' as const }], swirls: [], totalS: 90, windows: [] };
    const c = encodeCard({ big: 'A', label: 'B', timeline, thumb: bars });
    expect(verifyCard(c, sign(c), S)).toMatchObject({ timeline: { totalS: 90 }, thumb: bars });
  });
  const long = 'x'.repeat(81);
  it.each([
    ['unknown kind', ['pie', []]],
    ['not an array', 'bars'],
    ['no rows', ['bars', [], 0]],
    ['too many rows', ['bars', Array.from({ length: 6 }, () => ['a', '1', 0.5]), 0]],
    ['fraction over 1', ['bars', [['a', '1', 1.5]], 0]],
    ['negative fraction', ['bars', [['a', '1', -0.1]], 0]],
    ['long label', ['bars', [[long, '1', 0.5]], 0]],
    ['non-string value', ['bars', [['a', 1, 0.5]], 0]],
    ['short row', ['bars', [['a', '1']], 0]],
    ['long tile holder', ['tile', '1', long, '']],
    ['tile without date slot', ['tile', '1', 'a']],
    ['too many tiles', ['grid', Array.from({ length: 7 }, () => ['a', '1'])]],
    ['long tile label', ['grid', [[long, '1']]]],
    ['bad tile', ['grid', [['a']]]],
    ['4 series', ['vbars', [...v([1, 2]), ...v([1, 2])], 0]],
    ['41 points', ['lines', v(Array(41).fill(5))]],
    ['1 point', ['lines', v([5])]],
    ['ragged', ['lines', [['A', 0, [1, 2]], ['B', 1, [1, 2, 3]]]]],
    ['value 101', ['lines', v([1, 101])]],
    ['value -1', ['lines', v([-1, 1])]],
    ['fractional value', ['lines', v([1.5, 2])]],
    ['null in vbars', ['vbars', v([1, null]), 0]],
    ['colour out of range', ['lines', [['A', 18, [1, 2]]]]],
    ['long series label', ['lines', [[long, 0, [1, 2]]]]],
    ['missing series', ['lines']],
    ['series not an array', ['vbars', 'x', 0]],
    ['8 ticks', ['lines', v([1, 2, 3, 4, 5, 6, 7, 8]), Array.from({ length: 8 }, (_, i) => [i, 'a']), null]],
    ['13 bar ticks', ['vbars', v(Array(13).fill(1)), 0, Array.from({ length: 13 }, (_, i) => [i, 'a'])]],
    ['tick index out of range', ['lines', v([1, 2]), [[2, 'a']], null]],
    ['fractional tick index', ['lines', v([1, 2]), [[0.5, 'a']], null]],
    ['long tick text', ['lines', v([1, 2]), [[0, 'x'.repeat(13)]], null]],
    ['bad y', ['lines', v([1, 2]), null, ['a']]],
    ['long y', ['lines', v([1, 2]), null, ['a', 'x'.repeat(13)]]],
    ['vals on lines', ['lines', v([1, 2]), null, null, ['a', 'b']]],
    ['vals wrong length', ['vbars', v([1, 2]), 0, null, null, ['a']]],
    ['13 vals', ['vbars', v(Array(13).fill(1)), 0, null, null, Array(13).fill('a')]],
    ['colours wrong length', ['vbars', [['A', 0, [1, 2], [1]]], 0]],
    ['colour out of range', ['vbars', [['A', 0, [1, 2], [1, 18]]], 0]],
    ['colours on lines', ['lines', [['A', 0, [1, 2], [1, 1]]]]]
  ])('rejects %s', (_n, th) => {
    expect(check(['A', 'B', null, th])).toBeNull();
  });
});

describe('verifyCard with a coffee card', () => {
  const src = `/img/coffees/${'a'.repeat(64)}.webp`;
  it('round-trips a saved photo with its fill, after empty timeline and thumb slots', () => {
    const c = encodeCard({ big: 'A', label: 'B', coffee: { photo: { src, fill: '#e6ddd2' } } });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual(['A', 'B', null, null, [src, '#e6ddd2']]);
    expect(verifyCard(c, sign(c), S)).toEqual({ big: 'A', label: 'B', coffee: { photo: { src, fill: '#e6ddd2' } } });
  });
  it('round-trips a coffee card without a photo', () => {
    const c = encodeCard({ big: 'A', label: 'B', coffee: {} });
    expect(verifyCard(c, sign(c), S)).toEqual({ big: 'A', label: 'B', coffee: {} });
  });
  it.each([
    ['a remote URL', ['https://x.example/a.webp', '#e6ddd2']],
    ['a path out of the images folder', [`/img/coffees/../${'a'.repeat(64)}.webp`, '#e6ddd2']],
    ['another copy kind', [`/img/gear/${'a'.repeat(64)}.webp`, '#e6ddd2']],
    ['a fill that is not a hex colour', [src, 'red;x']],
    ['a wrong shape', [src]]
  ])('rejects %s', (_n, ph) => expect(check(['A', 'B', null, null, ph])).toBeNull());
});
