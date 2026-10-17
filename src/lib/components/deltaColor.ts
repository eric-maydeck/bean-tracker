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
// `d` decimals: 2 for brew-level deltas; 1 for gaps between bag means (SE 0.2+), likeGap.
export const signed = (x: number, d = 2) => (+Math.abs(x).toFixed(d) === 0 ? (0).toFixed(d) : (x > 0 ? '+' : '−') + Math.abs(x).toFixed(d));
// A coffee's gap to its like coffees: means of a few brews, so 1 decimal (stats audit 2026-10-17: precision).
export const likeGap = (x: number) => signed(x, 1);
// A lab chart's same-bag delta (stats re-review D): 2 decimals only when every shown row's bag-level SE (`ses`) is
// under 0.05, else 1 (a missing SE counts as over). Per chart, not per row: one chart never mixes decimals.
export const labDelta = (x: number, ses: readonly (number | null | undefined)[]) =>
  signed(x, ses.length && ses.every((s) => s != null && s < 0.05) ? 2 : 1);
