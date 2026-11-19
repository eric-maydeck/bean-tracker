import type { Timeline } from './pours';

// The geometry of a recipe's pour chart (PourTimeline.svelte and the link-preview card): cumulative water, x = time, y = water
// poured so far. Each pour is a filled segment rising from the level before it to the level after; between pours the level holds.
export interface ChartTimeline {
  pours: Timeline['pours'];
  swirls: number[];
  totalS: number;
  windows?: { startS: number; targetS: number; bloom: number; pour?: number }[];
}

// Pour kinds in their wire order (the card URL carries the index).
export const KINDS = ['bloom', 'fast', 'medium', 'slow'] as const;

export function pourShapes(timeline: ChartTimeline, W: number, H: number) {
  const total = Math.max(timeline.totalS, ...timeline.pours.map((p) => p.startS + p.durationS), ...(timeline.windows ?? []).map((w) => w.targetS), 1);
  const water = Math.max(timeline.pours.reduce((s, p) => s + p.grams, 0), 1);
  const x = (s: number) => (s / total) * W;
  const edge = (px: number) => Math.min(W - 6, Math.max(6, px)); // keep a swirl at either end inside the box
  const y = (g: number) => H - 1 - (g / water) * (H - 4);
  let level = 0;
  const shapes = timeline.pours.map((p, i) => {
    const x0 = x(p.startS);
    const x1 = Math.max(x0 + 4, x(p.startS + p.durationS));
    const before = level;
    level += p.grams;
    const next = timeline.pours[i + 1];
    const hold = { x0: x1, x1: next ? x(next.startS) : W, y: y(level) };
    return { kind: p.kind, points: `${x0},${H - 1} ${x0},${y(before)} ${x1},${y(level)} ${x1},${H - 1}`, hold: hold.x1 > hold.x0 ? hold : null };
  });
  const windows = (timeline.windows ?? []).map((w) => ({ x0: x(w.startS), x1: x(w.targetS), bloom: w.bloom, pour: w.pour ?? 0 })).filter((w) => w.x1 > w.x0);
  return { total, shapes, windows, swirls: timeline.swirls.map((s) => edge(x(s))) };
}
