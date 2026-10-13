// A same-bag delta's color on one fixed scale for every lab chart (round 3, T3): |Δ| under 0.05 is plain
// gray (--div-mid); from 0.05 a clearly visible tint (FLOOR of the full color, so a small delta still reads
// green or red) that ramps to full green (--div-high, better) or red (--div-low, worse) at 0.4, mixed in
// oklab. No per-chart max: a color means the same size of difference everywhere.
export const GRAY_BELOW = 0.05;
export const FULL_AT = 0.4;
export const FLOOR = 0.33;
export const deltaTone = (v: number): number => {
  const a = Math.abs(v);
  return a < GRAY_BELOW ? 0 : FLOOR + (1 - FLOOR) * Math.min(1, (a - GRAY_BELOW) / (FULL_AT - GRAY_BELOW));
};
export function deltaColor(v: number | null): string {
  if (v === null) return 'transparent';
  const t = deltaTone(v);
  return t ? `color-mix(in oklab, var(${v < 0 ? '--div-low' : '--div-high'}) ${Math.round(100 * t)}%, var(--div-mid))` : 'var(--div-mid)';
}
// A signed delta as text (round 3, T4): green from +0.05, red from −0.05 (the scale's thresholds), else ink.
export const deltaInk = (v: number | null): 'better' | 'worse' | undefined =>
  v === null || Math.abs(v) < GRAY_BELOW ? undefined : v > 0 ? 'better' : 'worse';
