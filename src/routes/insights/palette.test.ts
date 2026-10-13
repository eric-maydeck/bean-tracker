import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Categorical colors (recipes, gear, line series): 7 hues x 3 tones = 21 slots, in the light theme and both copies
// of the dark one (media query and [data-theme='dark']), assigned in tiers:
// - slots 1-7: each hue once, every two >= 16 apart in OKLab (x100), so a page with <= 7 recipes gets 7 hues;
//   the light theme's tier 1 is the 7 DARK tones, the dark theme's the 7 LIGHT tones (slot n = hue n mod 7, same
//   hue in every theme); tier 2 flips the lightness, tier 3 is the mid-tones;
// - slots 8-14: the same hues in the opposite lightness tier (slot k+7 vs k: same hue, OKLab ΔL >= 0.25);
// - slots 15-21: each hue's mid-tone, ΔL >= 0.12 from both its light and its dark;
// - the 7 hues are >= 25° apart; any two slots within 30° of hue are lightness-apart (>= 0.12);
//   every two of all 21 are >= 10 apart; each is >= 9 from the muted "Other" and >= 8 from the card (visible);
//   its -ink variant is >= 4.5:1 on the card (a recipe name as text).
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
const dL = (a: string, b: string) => Math.abs(oklab(a)[0] - oklab(b)[0]);
const hue = (a: string) => (Math.atan2(oklab(a)[2], oklab(a)[1]) * 180) / Math.PI;
const dH = (a: string, b: string) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };
const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const all = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'gi'))].map((m) => m[1]);
const N = 21;
const themes = [0, 1, 2].map((t) => ({
  slots: Array.from({ length: N }, (_, i) => all(`--series-${i + 1}`)[t]),
  inks: Array.from({ length: N }, (_, i) => all(`--series-${i + 1}-ink`)[t]),
  other: all('--color-text-muted')[t],
  card: all('--color-surface')[t]
}));
const pairs = <T>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe('series palette', () => {
  it('has 21 slots and inks in each of the three theme blocks', () => {
    for (const t of themes) expect(t.slots.every(Boolean) && t.inks.every(Boolean) && !!t.other && !!t.card).toBe(true);
  });
  it('the first 7 slots (every hue once) are every two clearly distinct (≥ 16)', () => {
    for (const { slots } of themes) for (const [a, b] of pairs(slots.slice(0, 7))) expect(dE(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(16);
  });
  it('every theme cycles the hues in the same order; tier 1 is dark in the light theme, light in the dark', () => {
    const hues = themes.map(({ slots }) => slots.map(hue));
    for (const h of hues.slice(1)) h.forEach((x, i) => expect(Math.abs(x - hues[0][i]), `slot ${i + 1}`).toBeLessThan(25));
    themes.forEach(({ slots }, t) => {
      const tier = (n: number) => slots.slice(n * 7, n * 7 + 7).map((c) => oklab(c)[0]);
      const [a, b, m] = [tier(0), tier(1), tier(2)];
      for (let k = 0; k < 7; k++) {
        if (t === 0) expect(a[k], `light theme slot ${k + 1} is dark`).toBeLessThan(b[k]);
        else expect(a[k], `dark theme slot ${k + 1} is light`).toBeGreaterThan(b[k]);
        expect(m[k]).toBeGreaterThan(Math.min(a[k], b[k]));
        expect(m[k]).toBeLessThan(Math.max(a[k], b[k]));
      }
    });
  });
  it('tier 2 is each hue in the opposite lightness; tier 3 is the mid-tone between them', () => {
    for (const { slots } of themes)
      for (let k = 0; k < 7; k++) {
        const [first, second, mid] = [slots[k], slots[k + 7], slots[k + 14]];
        for (const x of [second, mid]) expect(dH(first, x), `hue ${first} vs ${x}`).toBeLessThan(25);
        expect(dL(first, second), `L ${first} vs ${second}`).toBeGreaterThanOrEqual(0.25);
        expect(dL(mid, first), `mid ${mid} vs ${first}`).toBeGreaterThanOrEqual(0.12);
        expect(dL(mid, second), `mid ${mid} vs ${second}`).toBeGreaterThanOrEqual(0.12);
        const [lo, hi] = [oklab(first)[0], oklab(second)[0]].sort((p, q) => p - q);
        expect(oklab(mid)[0], `mid ${mid} between`).toBeGreaterThan(lo);
        expect(oklab(mid)[0]).toBeLessThan(hi);
      }
  });
  it('different hues are >= 35° apart or differ in lightness; every two of all 21 stay apart', () => {
    for (const { slots } of themes)
      for (const [a, b] of pairs(slots)) {
        expect(dE(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(10);
        if (dH(a, b) < 30) expect(dL(a, b), `near hue ${a} vs ${b}`).toBeGreaterThanOrEqual(0.12);
      }
    for (const { slots } of themes) for (const [a, b] of pairs(slots.slice(0, 7))) expect(dH(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(25);
  });
  it('each slot is visible on the card and apart from Other; each ink reads as text (4.5:1)', () => {
    for (const { slots, inks, other, card } of themes)
      slots.forEach((s, i) => {
        expect(dE(s, other), `${s} vs Other`).toBeGreaterThanOrEqual(9);
        expect(dE(s, card), `${s} vs card`).toBeGreaterThanOrEqual(8);
        expect(contrast(inks[i], card), `ink ${inks[i]}`).toBeGreaterThanOrEqual(4.5);
      });
  });
});
