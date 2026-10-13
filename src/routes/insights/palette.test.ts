import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Categorical colors stay apart (round 3): recipes, gear and line series share the 7 --series slots, every two
// ≥ 20 apart in OKLab (×100; pink beside purple read as one), each ≥ 12 from the muted "Other", in the light theme
// and both copies of the dark one (media query and [data-theme='dark']).
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a: string, b: string) => 100 * Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
const all = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'gi'))].map((m) => m[1]);
const themes = [0, 1, 2].map((t) => ({ slots: Array.from({ length: 7 }, (_, i) => i + 1).map((n) => all(`--series-${n}`)[t]), other: all('--color-text-muted')[t] }));

describe('series palette', () => {
  it('has seven slots in each of the three theme blocks', () => {
    for (const t of themes) expect(t.slots.every(Boolean) && !!t.other).toBe(true);
  });
  it('every two slots are clearly distinct, and each from Other', () => {
    for (const { slots, other } of themes) {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) expect(dE(slots[i], slots[j]), `${slots[i]} vs ${slots[j]}`).toBeGreaterThanOrEqual(20);
        expect(dE(slots[i], other), `${slots[i]} vs Other ${other}`).toBeGreaterThanOrEqual(12);
      }
    }
  });
});
