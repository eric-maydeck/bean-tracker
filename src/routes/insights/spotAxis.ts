// Sweet spots' mini chart axis. It fits the solid bands (`fit`: their values); a band past its edge is an arrow: the
// flat shoulder sits at the edge, the point reaches `pad` beyond it, so a thin band never reads as tall as the tallest
// solid bar (and a thin band past a zero-height axis still gets a visible arrow).
export function spotAxis(ds: readonly number[], fit: readonly number[]) {
  const hi0 = Math.max(0, ...fit), lo0 = Math.min(0, ...fit), pad = 0.2 * (hi0 - lo0 || 1);
  const hi = hi0 + (ds.some((d) => d > hi0) ? pad : 0), lo = lo0 - (ds.some((d) => d < lo0) ? pad : 0);
  const shown = ds.map((d) => (d > hi0 ? hi : d < lo0 ? lo : d));
  // `sh`: the arrow taper as a percent of the bar's own height (0 when the bar isn't clipped).
  return { hi, lo, span: hi - lo || 1, shown, clip: ds.map((d) => d > hi0 || d < lo0), sh: shown.map((v, i) => (v === ds[i] ? 0 : (pad / Math.abs(v)) * 100)) };
}
// A signed value's ink by its shown sign (+ green, − red, 0 muted), the same on every Sweet spots line and tip.
export const inkOf = (t: string) => (t.startsWith('+') ? 'ink-better' : t.startsWith('−') ? 'ink-worse' : 'zero');
