import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// T3 / M-4: the first tint of a delta (|Δ| = 0.05, the theme's --div-floor mixed in oklab with --div-mid) reads
// clearly green or red: ≥ 10 OKLab ΔE×100 from the gray, both poles, light and both dark blocks.
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const all = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*([#0-9a-f.]+)`, 'gi'))].map((m) => m[1]);
const [low, mid, high, floor] = ['--div-low', '--div-mid', '--div-high', '--div-floor'].map(all);

describe('delta tint floor', () => {
  it('is defined in all three theme blocks', () => expect([low, mid, high, floor].every((x) => x.length === 3)).toBe(true));
  it('the first tint is ≥ 10 from the gray (a mix in oklab moves the floor share of the way)', () => {
    for (let t = 0; t < 3; t++)
      for (const pole of [low[t], high[t]]) {
        const d = 100 * Math.hypot(...oklab(pole).map((v, i) => v - oklab(mid[t])[i])) * +floor[t];
        expect(d, `${pole} at ${floor[t]} vs ${mid[t]}`).toBeGreaterThanOrEqual(10);
      }
  });
});
