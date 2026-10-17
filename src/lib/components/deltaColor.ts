// A same-bag delta's color on one fixed scale for every lab chart (round 3, T3): |Δ| under 0.05 is plain
// gray (--div-mid); from 0.05 a clearly visible tint that ramps to full green (--div-high, better) or red
// (--div-low, worse) at 0.4, mixed in oklab. The tint starts at the theme's floor (--div-floor, app.css: set so
// the first tint is ≥ 10 OKLab ΔE×100 from the gray in each theme; divFloor.test.ts). No per-chart max: a color
// means the same size of difference everywhere.
export const GRAY_BELOW = 0.05;
export const FULL_AT = 0.4;
// The ramp past the floor, 0 at 0.05 … 1 at 0.4; null under 0.05 (plain gray).
export const deltaRamp = (v: number): number | null => {
  const a = Math.abs(v);
  return a < GRAY_BELOW ? null : Math.min(1, (a - GRAY_BELOW) / (FULL_AT - GRAY_BELOW));
};
export function deltaColor(v: number | null): string {
  if (v === null) return 'transparent';
  const r = deltaRamp(v);
  if (r === null) return 'var(--div-mid)';
  const k = +r.toFixed(3);
  return `color-mix(in oklab, var(${v < 0 ? '--div-low' : '--div-high'}) calc((var(--div-floor) + (1 - var(--div-floor)) * ${k}) * 100%), var(--div-mid))`;
}
// A signed delta as text (round 3, T4): its class, green from +0.05, red from −0.05 (the scale's thresholds), else ink.
export const deltaInk = (v: number | null): 'ink-better' | 'ink-worse' | '' =>
  v === null || Math.abs(v) < GRAY_BELOW ? '' : v > 0 ? 'ink-better' : 'ink-worse';

// The lab's number format: a true minus, and a value that rounds to 0 reads "0.00" (never "−0.00" or "+0.00").
export const signed = (x: number) => (Math.abs(x) < 0.005 ? '0.00' : (x > 0 ? '+' : '−') + Math.abs(x).toFixed(2));
