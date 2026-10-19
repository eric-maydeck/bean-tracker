// The strength badges' words and their one-line explanations (stats.ts: solid = |z| >= 2, hint = |z| >= 1.5, where
// z = gap ÷ its standard error, the "margin of error" here; not gap ÷ brew-to-brew spread: stats audit 2026-10-17).
// `early`: Sweet spots only, a lead under Possible (no test behind it yet).
export type Badge = 'solid' | 'hint' | 'early';
export const STRENGTH: Record<Badge, string> = { solid: 'Likely', hint: 'Possible', early: 'Early' };
export const STRENGTH_WHY: Record<Badge, string> = {
  solid: "The gap is at least twice its margin of error: about 95% sure it isn't chance.",
  hint: 'The gap is 1.5 to 2 times its margin of error: about 87% sure, so it could still be chance.',
  early: 'Ahead so far, but under 1.5 times its margin of error: too little data to call it.'
};
