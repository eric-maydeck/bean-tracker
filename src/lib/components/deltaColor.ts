// A same-bag delta's color on one fixed scale for every lab chart (round 2, C1): |Δ| under 0.05 is plain
// gray (--div-mid), full green (--div-high, better) or red (--div-low, worse) from 0.5 rating points,
// linear in between (mixed in oklab, so the tint grows evenly). No per-chart max: a color means the same
// size of difference everywhere.
export const GRAY_BELOW = 0.05;
export const FULL_AT = 0.5;
export const deltaTone = (v: number): number => {
  const a = Math.abs(v);
  return a < GRAY_BELOW ? 0 : Math.min(1, (a - GRAY_BELOW) / (FULL_AT - GRAY_BELOW));
};
export function deltaColor(v: number | null): string {
  if (v === null) return 'transparent';
  const t = deltaTone(v);
  return t ? `color-mix(in oklab, var(${v < 0 ? '--div-low' : '--div-high'}) ${Math.round(100 * t)}%, var(--div-mid))` : 'var(--div-mid)';
}
