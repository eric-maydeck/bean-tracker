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
  it('neither side fits: the roomier side', () => {
    expect(tipPlace(box(190, 700), { w: 100, h: 700 }, view).y).toBe(60); // more room above: pinned under the bar
    expect(tipPlace(box(190, 100), { w: 100, h: 700 }, view).y).toBe(126); // more room below
  });
});
