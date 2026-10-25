import { describe, expect, it } from 'vitest';
import { WHOLE, clampView, panBy, visibleBox, zoomAbout } from './mapZoom';

const vb = { x: 0, y: 0, w: 957, h: 420 };
const narrow = visibleBox(300, 300, vb);

describe('mapZoom', () => {
  it('visibleBox is the slice crop', () => {
    expect(visibleBox(957, 420, vb)).toEqual(vb);
    expect(narrow).toEqual({ x: 268.5, y: 0, w: 420, h: 420 });
  });
  it('clampView keeps the world covering the visible box', () => {
    expect(clampView(WHOLE, vb, vb)).toEqual(WHOLE);
    expect(clampView({ k: 1, x: 50, y: 0 }, vb, vb)).toEqual(WHOLE);
    expect(clampView({ k: 1, x: 200, y: 0 }, narrow, vb).x).toBe(200);
    expect(clampView({ k: 1, x: 300, y: 0 }, narrow, vb).x).toBe(268.5);
    expect(clampView({ k: 1, x: -300, y: 0 }, narrow, vb).x).toBe(-268.5);
  });
  it('zoomAbout fixes the point and clamps k', () => {
    expect(zoomAbout(WHOLE, 2, 478.5, 210, vb, vb)).toEqual({ k: 2, x: -478.5, y: -210 });
    expect(zoomAbout(WHOLE, 100, 478.5, 210, vb, vb).k).toBe(8);
    expect(zoomAbout({ k: 2, x: -478.5, y: -210 }, 0.1, 478.5, 210, vb, vb)).toEqual(WHOLE);
  });
  it('panBy clamps', () => {
    expect(panBy(WHOLE, 30, 0, vb, vb)).toEqual(WHOLE);
    expect(panBy({ k: 2, x: -478.5, y: -210 }, 1000, 0, vb, vb).x).toBe(0);
  });
});
