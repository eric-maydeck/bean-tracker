import type { Multi } from '$lib/server/insights/insightGenerators';

// One shared y scale over a 100×40 box (2 units of padding top and bottom).
function frame(m: Multi) {
  const vs = m.lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  return { lo, hi, py: (v: number) => 38 - ((v - lo) / span) * 36 };
}

// The y range, and the 0 line's y when the range crosses zero.
export function scale(m: Multi) {
  const { lo, hi, py } = frame(m);
  return { lo, hi, zero: lo < 0 && hi > 0 ? py(0) : null };
}

// x of column i in the 100-wide box.
export const px = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);

// Multi-line chart: one shared y scale over a 100×40 box; a null breaks its line. "Other" is muted,
// every other line takes the next categorical slot in order (never cycled: the server caps lines at ~5).
export function lines(m: Multi) {
  const { py } = frame(m), n = m.x.length;
  let slot = 0;
  return m.lines.map((l) => {
    const runs: string[] = [];
    let run: string[] = [];
    l.values.forEach((v, i) => {
      if (v === null) { if (run.length) runs.push(run.join(' ')); run = []; return; }
      run.push(`${px(i, n)},${py(v).toFixed(2)}`);
      if (run.length === 1 && (l.values[i + 1] ?? null) === null) run.push(`${px(i, n) + 0.8},${py(v).toFixed(2)}`); // a lone point: a dash
    });
    if (run.length) runs.push(run.join(' '));
    return { label: l.label, runs, color: l.label === 'Other' ? 'var(--series-other)' : `var(--series-${(slot++ % 5) + 1})` };
  });
}
