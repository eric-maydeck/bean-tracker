/**
 * Maps an urgency rating onto a vibrant low/mid/high gradient.
 * 0 is the low end (full green); anything at or below 0 clamps to that same green.
 * The gradient runs 0 -> 100 (green -> amber -> red); 'Done' is muted.
 */
export function urgencyColorStyle(rating: number | 'Done'): string {
  if (rating === 'Done') return `color: var(--color-text-muted);`;

  const t = Math.max(0, Math.min(1, rating / 100));
  if (t <= 0.5) {
    const pct = Math.round((t / 0.5) * 100);
    return `color: color-mix(in srgb, var(--color-urgency-mid) ${pct}%, var(--color-urgency-low)); font-weight: 600;`;
  }
  const pct = Math.round(((t - 0.5) / 0.5) * 100);
  return `color: color-mix(in srgb, var(--color-urgency-high) ${pct}%, var(--color-urgency-mid)); font-weight: 600;`;
}
