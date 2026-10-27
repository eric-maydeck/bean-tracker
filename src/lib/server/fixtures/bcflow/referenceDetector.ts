// Test-only reference reading of a weight series. Every measure uses time windows over linearly
// interpolated weight (never sample-to-sample), so it agrees on the raw and the 0.05 s compact grids.
export function referenceReading(
  t: number[],
  g: number[]
): {
  pours: { start: number; grams: number }[];
  spikes: number[];
  tares: number[];
} {
  const end = t[t.length - 1] ?? 0;
  const at = (x: number): number => {
    if (x <= t[0]) return g[0];
    if (x >= end) return g[g.length - 1];
    let lo = 0;
    let hi = t.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (t[m] <= x) lo = m;
      else hi = m;
    }
    const f = t[hi] === t[lo] ? 0 : (x - t[lo]) / (t[hi] - t[lo]);
    return g[lo] + f * (g[hi] - g[lo]);
  };
  const xs: number[] = []; // evaluation times, a fixed 0.1 s step independent of the input grid
  for (let i = 0; i * 0.1 <= end + 1e-9; i++) xs.push(i / 10);
  const merge = (runs: [number, number][], gap: number) => {
    const out: [number, number][] = [];
    for (const r of runs) {
      const l = out[out.length - 1];
      if (l && r[0] - l[1] < gap) l[1] = Math.max(l[1], r[1]);
      else out.push([r[0], r[1]]);
    }
    return out;
  };

  // A swing (up or down, e.g. lifting or shaking the dripper): a `min` g move within 0.3 s that falls
  // back to within 20 g of its base within 10 s. Reported spikes use 40 g; the pour mask also takes
  // the smaller 25 g swings, which would otherwise read as pours.
  const swings = (min: number) => {
    const hits: [number, number][] = [];
    for (const x of xs) {
      if (x + 2 > end) break; // the end of the series is the dripper being lifted
      if (Math.abs(at(x + 0.3) - at(x)) < min) continue;
      const base = at(x);
      for (let y = x + 0.3; y <= x + 10 && y <= end; y += 0.1) {
        if (Math.abs(at(y) - base) <= 20) {
          // starts where the curve is first 20 g from its base (stable on a slow ramp)
          let on = x;
          while (Math.abs(at(on) - base) < 20) on += 0.05;
          hits.push([on, y]);
          break;
        }
      }
    }
    return merge(hits, 1);
  };
  const spikes = swings(40).map((s) => s[0]);
  const spans = swings(25);
  // a spike span, padded 0.5 s before and 2 s after (the overshoot decays), is replaced by a
  // straight line between its padded ends
  const PRE = 0.5;
  const POST = 2;
  const masked = (x: number) => {
    const s = spans.find((s) => x >= s[0] - PRE && x <= s[1] + POST);
    if (!s) return at(x);
    const a = at(s[0] - PRE);
    return a + ((x - (s[0] - PRE)) / (s[1] - s[0] + PRE + POST)) * (at(s[1] + POST) - a);
  };

  // pours: runs where the 1 s rise exceeds 0.8 g/s; merge < 2 s apart; keep >= 10 g
  const runs: [number, number][] = [];
  let cur: [number, number] | null = null;
  for (const x of xs) {
    if (x + 2 > end) break; // the end of the series is the dripper being lifted, not a pour
    if (masked(x + 1) - masked(x) > 0.8) {
      if (cur) cur[1] = x + 1;
      else runs.push((cur = [x, x + 1]));
    } else cur = null;
  }
  const pours = merge(runs, 2)
    .map(([a, b]) => ({ start: a, grams: masked(b) - masked(a) }))
    .filter((p) => p.grams >= 10);

  // tares: the piecewise-linear curve enters |g| < 2 after a running max >= 50 (exact entry time on
  // the curve, so a one-sample snap to 0 counts on any grid); the max resets after each hit, and hits < 5 s apart merge
  const tares: number[] = [];
  let max = -Infinity;
  for (let i = 0; i < t.length; i++) {
    max = Math.max(max, g[i]);
    if (max >= 50 && (Math.abs(g[i]) < 2 || (i > 0 && g[i - 1] * g[i] < 0))) {
      // a bounce back through zero within 5 s is the same tare
      if (!tares.length || t[i] - tares[tares.length - 1] >= 5) tares.push(t[i]);
      max = -Infinity;
    }
  }
  return { pours, spikes, tares };
}
