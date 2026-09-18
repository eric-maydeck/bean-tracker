/** Maps an urgency rating (-100..100, or 'Done') onto the app's fresh/warm/urgent color tokens. */
export function urgencyColorStyle(rating: number | 'Done'): string {
  if (rating === 'Done') return `color: var(--color-text-muted);`;

  const t = Math.max(0, Math.min(1, (rating + 100) / 200));
  if (t <= 0.5) {
    const pct = Math.round((t / 0.5) * 100);
    return `color: color-mix(in srgb, var(--color-warm) ${pct}%, var(--color-fresh)); font-weight: 600;`;
  }
  const pct = Math.round(((t - 0.5) / 0.5) * 100);
  return `color: color-mix(in srgb, var(--color-urgent) ${pct}%, var(--color-warm)); font-weight: 600;`;
}
