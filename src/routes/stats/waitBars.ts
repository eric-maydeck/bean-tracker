import type { WaitWindow } from '#lib/server/insights/freshness.ts';

// Rating by wait: one bar per wait band, the axis floor a point under the lowest rated bar (as Habits' and Consumption's
// rating charts); null when no band is rated.
export function waitBars(w: WaitWindow): { labels: string[]; values: (number | null)[]; yMin?: number } | null {
  const rated = w.byWait.filter((x) => x.rating !== null);
  if (!rated.length) return null;
  return { labels: w.byWait.map((x) => x.label), values: w.byWait.map((x) => x.rating), yMin: Math.max(0, Math.floor(Math.min(...rated.map((x) => x.rating!))) - 1) };
}
