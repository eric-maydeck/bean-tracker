import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Categorical colors (recipes, gear, line series, chart series): 7 hues x 2 tones = 14 slots, in the light theme and
// both copies of the dark one (media query and [data-theme='dark']). Slot n = hue n mod 7, tier floor(n/7); each
// hue's mid is its pastel's color, clearly deeper (ΔL >= 0.17). Tier order is theme-aware: the light theme cycles
// the 7 mids before any pastel, the dark theme the 7 pastels before any mid, so a page with <= 7 recipes gets 7
// hues. Tier 1 is as distinct as the tone allows (mids >= 16 apart, pastels >= 8); every two slots are >= 8
// apart; hues stay put across themes; "Other" is a neutral gray >= 10 from every slot; each slot is visible on the
// card (>= 7, pastels outlined) and its -ink variant is >= 4.5:1 on it.
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
const N = 14;
const themes = [0, 1, 2].map((t) => ({
  slots: Array.from({ length: N }, (_, i) => all(`--series-${i + 1}`)[t]),
  inks: Array.from({ length: N }, (_, i) => all(`--series-${i + 1}-ink`)[t]),
  other: all('--series-other')[t],
  card: all('--color-surface')[t]
}));
const pairs = <T>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe('series palette', () => {
  it('has 14 slots, inks and a gray Other in each of the three theme blocks', () => {
    for (const t of themes) expect(t.slots.every(Boolean) && t.inks.every(Boolean) && !!t.other && !!t.card).toBe(true);
  });
  it('each theme cycles all 7 hues in its first tier, then the other tone, same hues in every theme', () => {
    const hues = themes.map(({ slots }) => slots.map(hue));
    themes.forEach(({ slots }, t) => {
      const [a, b] = [slots.slice(0, 7).map((c) => oklab(c)[0]), slots.slice(7).map((c) => oklab(c)[0])];
      for (let k = 0; k < 7; k++) {
        expect(dH(slots[k], slots[k + 7]), `slot ${k + 1} vs ${k + 8}`).toBeLessThan(25);
        expect(Math.abs(a[k] - b[k]), `slot ${k + 1} vs ${k + 8}`).toBeGreaterThanOrEqual(0.17);
        // light theme: mids (the deeper) first; dark theme: pastels first
        if (t === 0) expect(a[k]).toBeLessThan(b[k]);
        else expect(a[k]).toBeGreaterThan(b[k]);
        expect(Math.abs(hues[t][k] - hues[0][k]), `hue of slot ${k + 1}`).toBeLessThan(25);
      }
    });
  });
  it('tier 1 is as distinct as its tone allows; every two slots stay apart; near hues differ in lightness', () => {
    themes.forEach(({ slots }, t) => {
      for (const [a, b] of pairs(slots.slice(0, 7))) expect(dE(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(t === 0 ? 16 : 8);
      for (const [a, b] of pairs(slots)) {
        expect(dE(a, b), `${a} vs ${b}`).toBeGreaterThanOrEqual(8);
        if (dH(a, b) < 30) expect(dL(a, b), `near hue ${a} vs ${b}`).toBeGreaterThanOrEqual(0.17);
      }
    });
  });
  it('Other is a neutral gray apart from every slot; each slot is visible on the card; each ink reads as text (4.5:1)', () => {
    for (const { slots, inks, other, card } of themes) {
      expect(Math.hypot(oklab(other)[1], oklab(other)[2]) * 100, 'Other is neutral').toBeLessThan(2);
      slots.forEach((s, i) => {
        expect(dE(s, other), `${s} vs Other`).toBeGreaterThanOrEqual(10);
        expect(dE(s, card), `${s} vs card`).toBeGreaterThanOrEqual(7);
        expect(contrast(inks[i], card), `ink ${inks[i]}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});
