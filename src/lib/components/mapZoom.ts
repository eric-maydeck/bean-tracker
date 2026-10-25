// Pure zoom/pan math for WorldMap. A View is `<g transform="translate(x y) scale(k)">` in viewBox units; `vis` is the
// part of the viewBox the `xMidYMid slice` SVG shows, `vb` the whole world.
export type Box = { x: number; y: number; w: number; h: number };
export type View = { k: number; x: number; y: number };
export const MAX_ZOOM = 8, STEP = 2;
export const WHOLE: View = { k: 1, x: 0, y: 0 };

export function visibleBox(width: number, height: number, vb: Box): Box {
  const s = Math.max(width / vb.w, height / vb.h);
  const [w, h] = [width / s, height / s];
  return { x: vb.x + (vb.w - w) / 2, y: vb.y + (vb.h - h) / 2, w, h };
}

// The scaled world always covers the visible box.
export function clampView(v: View, vis: Box, vb: Box): View {
  const c = (t: number, lo: number, size: number, vbSize: number) => Math.min(lo, Math.max(lo + size - vbSize * v.k, t));
  return { k: v.k, x: c(v.x, vis.x, vis.w, vb.w), y: c(v.y, vis.y, vis.h, vb.h) };
}

// Zoom by `factor` keeping the viewBox point (cx, cy) fixed on screen.
export function zoomAbout(v: View, factor: number, cx: number, cy: number, vis: Box, vb: Box): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor)), f = k / v.k;
  return clampView({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }, vis, vb);
}

export const panBy = (v: View, dx: number, dy: number, vis: Box, vb: Box): View => clampView({ ...v, x: v.x + dx, y: v.y + dy }, vis, vb);
