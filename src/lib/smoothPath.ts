// A smooth path through the points (monotone cubic, ui-rules G5): tangents are the harmonic mean of the
// neighboring slopes (0 at a turn), so the curve never overshoots the data.
export function smooth(p: [number, number][]): string {
  const f = (x: number) => +x.toFixed(2);
  if (p.length < 3) return `M${p.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}`;
  const d = p.slice(1).map(([x, y], i) => (y - p[i][1]) / (x - p[i][0]));
  const m = p.map((_, i) => (i === 0 ? d[0] : i === p.length - 1 ? d[i - 1] : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i])));
  let s = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], h = (x1 - x0) / 3;
    s += `C${f(x0 + h)},${f(y0 + m[i - 1] * h)} ${f(x1 - h)},${f(y1 - m[i] * h)} ${f(x1)},${f(y1)}`;
  }
  return s;
}
