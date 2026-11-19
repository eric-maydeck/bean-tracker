import { describe, expect, it } from 'vitest';
import { pourShapes, type ChartTimeline } from './pourShapes';

const t: ChartTimeline = {
  pours: [{ startS: 0, durationS: 10, grams: 50, kind: 'bloom' }, { startS: 40, durationS: 20, grams: 150, kind: 'slow' }],
  swirls: [0, 100], totalS: 100, windows: [{ startS: 0, targetS: 40, bloom: 0, pour: 0 }, { startS: 50, targetS: 50, bloom: 1, pour: 1 }]
};

describe('pourShapes', () => {
  it('matches the numbers PourTimeline drew before the extraction (W 1000, H 64)', () => {
    const g = pourShapes(t, 1000, 64);
    expect(g.total).toBe(100);
    expect(g.shapes).toEqual([
      { kind: 'bloom', points: '0,63 0,63 100,48 100,63', hold: { x0: 100, x1: 400, y: 48 } },
      { kind: 'slow', points: '400,63 400,48 600,3 600,63', hold: { x0: 600, x1: 1000, y: 3 } }
    ]);
    expect(g.windows).toEqual([{ x0: 0, x1: 400, bloom: 0, pour: 0 }]); // an empty window is dropped
    expect(g.swirls).toEqual([6, 994]); // clamped inside the box
  });
});
