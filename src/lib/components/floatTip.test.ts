import { describe, expect, it } from 'vitest';
import { tipPlace } from './floatTip';

const view = { w: 400, top: 60, bottom: 800 };
const box = (left: number, top: number, w = 20, h = 20) => ({ left, top, right: left + w, bottom: top + h });
describe('tipPlace', () => {
  it('above, centered on the anchor', () => expect(tipPlace(box(190, 300), { w: 100, h: 50 }, view)).toEqual({ x: 150, y: 244 }));
  it('below when the sticky bar leaves no room above', () => expect(tipPlace(box(190, 80), { w: 100, h: 50 }, view).y).toBe(106));
  it('clamped 8px inside the viewport at both edges', () => {
    expect(tipPlace(box(0, 300), { w: 200, h: 50 }, view).x).toBe(8);
    expect(tipPlace(box(390, 300), { w: 200, h: 50 }, view).x).toBe(192);
  });
  it('neither side fits: clamped into the band, over the anchor', () => {
    expect(tipPlace(box(190, 700), { w: 100, h: 700 }, view).y).toBe(60); // more room above: pinned under the bar
    expect(tipPlace(box(190, 100), { w: 100, h: 700 }, view).y).toBe(100); // more room below: would pass the end
    expect(tipPlace(box(190, 300), { w: 100, h: 800 }, view).y).toBe(60); // taller than the band: top under the bar
  });
});

import { tipPlace as place } from './floatTip';
describe('tipPlace beside', () => {
  const view = { w: 1000, top: 0, bottom: 800 };
  it('sits to the right of the anchor, centered on it', () => {
    expect(place({ left: 300, right: 301, top: 100, bottom: 101 }, { w: 200, h: 60 }, view, 6, true)).toEqual({ x: 307, y: 70.5 });
  });
  it('flips left when the right has no room, and stays in the band', () => {
    const p = place({ left: 900, right: 901, top: 5, bottom: 6 }, { w: 200, h: 60 }, view, 6, true);
    expect(p.x).toBe(694);
    expect(p.y).toBe(0);
  });
});
