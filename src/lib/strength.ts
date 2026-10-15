// The strength badges' words and their one-line explanations (stats.ts: solid = |z| >= 2, hint = |z| >= 1.5).
export type Badge = 'solid' | 'hint';
export const STRENGTH: Record<Badge, string> = { solid: 'Likely', hint: 'Possible' };
export const STRENGTH_WHY: Record<Badge, string> = {
  solid: 'The gap is at least 2× normal brew-to-brew noise, so probably real.',
  hint: 'The gap is 1.5 to 2× normal brew-to-brew noise; could still be chance.'
};
