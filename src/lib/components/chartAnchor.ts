// Where a chart tip points (Chart.svelte): at the hovered mark, never the chart's top.
export type Hit = { datasetIndex: number; dataIndex: number; element?: { getProps?: (k: string[], final: boolean) => Record<string, number> } };
export type Anchor = { x: number; y: number; h: number; w?: number; beside?: boolean };
type Area = { top: number; bottom: number; left?: number; right?: number };
type Mode = { type: 'bar' | 'doughnut' | 'line'; vertical: boolean; stacked: boolean; sticky: boolean; pointerX: number };

const PROPS = ['x', 'y', 'base', 'width', 'height'];
const barProps = (d: Hit) => d.element?.getProps?.(PROPS, true);

// A vertical bar (or stack segment): the strip is the bar, so the tip sits just above its top; a sticky stacked tip sits beside the
// segment; a horizontal bar: beside its end (sticky: above it at the pointer's x); a line's point: at the pointer's height.
// A bar chart with a line overlay hands over the line's point first (it has no `base`): the first hit with a bar's geometry
// decides, else the caret position.
export function anchorOf(m: Mode, tooltip: { caretX: number; caretY: number; dataPoints?: Hit[] }, area: Area): Anchor {
  if (m.type === 'bar') {
    for (const d of tooltip.dataPoints ?? []) {
      const p = barProps(d);
      if (!p || ![p.x, p.y, p.base].every(Number.isFinite)) continue;
      if (m.vertical && m.stacked && m.sticky) return { x: p.x - p.width / 2, y: (p.y + p.base) / 2, h: 1, w: p.width, beside: true };
      if (m.vertical) return { x: p.x, y: Math.min(p.y, p.base), h: Math.abs(p.base - p.y) || 1 };
      if (m.sticky) return { x: Math.min(Math.max(m.pointerX, area.left ?? 0), area.right ?? m.pointerX), y: p.y - p.height / 2, h: p.height };
      return { x: p.x, y: p.y, h: 1, beside: true };
    }
    return { x: tooltip.caretX, y: tooltip.caretY, h: 1 };
  }
  if (m.type === 'line') return { x: tooltip.caretX, y: tooltip.caretY, h: 1 };
  return { x: tooltip.caretX, y: area.top, h: area.bottom - area.top };
}
