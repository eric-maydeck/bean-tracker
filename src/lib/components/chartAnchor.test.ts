import { describe, expect, it } from 'vitest';
import { anchorOf, type Hit } from './chartAnchor';

const hit = (props: Record<string, number>): Hit => ({ datasetIndex: 0, dataIndex: 0, element: { getProps: () => props } });
const bar = hit({ x: 100, y: 40, base: 200, width: 30, height: 160 });
const linePoint = hit({ x: 100, y: 55 }); // a PointElement: no base
const tooltip = (dataPoints: Hit[]) => ({ caretX: 101, caretY: 57, dataPoints });
const area = { top: 10, bottom: 200, left: 20, right: 400 };
const vertical = { type: 'bar' as const, vertical: true, stacked: false, sticky: false, pointerX: 0 };

describe('anchorOf', () => {
  it('a vertical bar: the strip is the bar', () => {
    expect(anchorOf(vertical, tooltip([bar]), area)).toEqual({ x: 100, y: 40, h: 160 });
  });
  it('a bar chart with a line overlay: the line point (no base) is skipped, the bar decides', () => {
    expect(anchorOf(vertical, tooltip([linePoint, bar]), area)).toEqual({ x: 100, y: 40, h: 160 });
  });
  it('only a line point: the caret position, never NaN', () => {
    const a = anchorOf(vertical, tooltip([linePoint]), area);
    expect(a).toEqual({ x: 101, y: 57, h: 1 });
    expect(Object.values(a).every(Number.isFinite)).toBe(true);
  });
  it('a sticky horizontal bar sits above the bar at the pointer, clamped to the plot', () => {
    const h = hit({ x: 300, y: 60, base: 20, width: 280, height: 20 });
    expect(anchorOf({ ...vertical, vertical: false, sticky: true, pointerX: 900 }, tooltip([h]), area)).toEqual({ x: 400, y: 50, h: 20 });
  });
});
