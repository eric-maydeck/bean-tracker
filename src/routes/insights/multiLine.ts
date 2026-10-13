import type { Multi } from '$lib/server/insights/insightGenerators';

// One shared y scale over a 100×40 box (2 units of padding top and bottom).
function frame(m: Multi) {
  const vs = m.lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  const lo = vs.length ? Math.min(...vs) : 0, hi = vs.length ? Math.max(...vs) : 0, span = hi - lo || 1;
  return { lo, hi, py: (v: number) => 38 - ((v - lo) / span) * 36 };
}

// The y range, and the 0 line's y when the range crosses zero.
export function scale(m: Multi) {
  const { lo, hi, py } = frame(m);
  return { lo, hi, zero: lo < 0 && hi > 0 ? py(0) : null };
}

// x of column i in the 100-wide box.
export const px = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);

// Categorical slots in line order (never cycled: the server caps lines at ~5); "Other" is muted.
export function seriesColors(labels: string[]) {
  let slot = 0;
  return labels.map((l) => (l === 'Other' ? 'var(--series-other)' : `var(--series-${(slot++ % 5) + 1})`));
}

// Same bag, different water (ui-rules 42): each pair's two colors. A recipe keeps its usage-over-time color (its
// line's slot); one folded into "Other" there takes an unused slot (stable per recipe). The two of a pair are
// never the same: when the free slots run out, the partner takes the first slot its recipe doesn't use.
const SLOTS = [1, 2, 3, 4, 5].map((n) => `var(--series-${n})`);
export function pairColors(lines: string[], pairs: { a: string; b: string }[]) {
  const cs = seriesColors(lines);
  const c = new Map(lines.map((l, i) => [l, cs[i]]));
  const free = SLOTS.filter((v) => !cs.includes(v));
  const pool = free.length ? free : SLOTS;
  let k = 0;
  for (const p of pairs) for (const r of [p.a, p.b]) if (!c.has(r)) c.set(r, pool[k++ % pool.length]);
  return (p: { a: string; b: string }): [string, string] => {
    const a = c.get(p.a) ?? 'var(--series-other)', b = c.get(p.b) ?? 'var(--series-other)';
    return [a, a === b ? [...free, ...SLOTS].find((v) => v !== a)! : b];
  };
}

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

// Multi-line chart: one shared y scale over a 100×40 box; a null breaks its line. Each run is an SVG path.
export function lines(m: Multi) {
  const { py } = frame(m), n = m.x.length, colors = seriesColors(m.lines.map((l) => l.label));
  return m.lines.map((l, k) => {
    const runs: string[] = [];
    let run: [number, number][] = [];
    l.values.forEach((v, i) => {
      if (v === null) { if (run.length) runs.push(smooth(run)); run = []; return; }
      run.push([px(i, n), py(v)]);
      if (run.length === 1 && (l.values[i + 1] ?? null) === null) run.push([px(i, n) + 0.8, py(v)]); // a lone point: a dash
    });
    if (run.length) runs.push(smooth(run));
    return { label: l.label, runs, color: colors[k] };
  });
}
