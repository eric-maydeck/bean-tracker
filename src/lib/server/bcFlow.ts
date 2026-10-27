// Compact per-brew weight series from a Bean Conqueror flow profile (see docs/gotchas/bean-conqueror.md).
export const FLOW_FORMAT = 1;
export const FLOW_STEP_MS = 100;
export const MAX_FLOW_POINTS = 36_000; // 1 h

export interface CompactFlow {
  v: 1;
  stepMs: 100;
  /** w[0] = first point in decigrams, w[i] = delta from point i-1 (integers). */
  w: number[];
}

const num = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * brew_time is "<second>.<index within that second>" (NOT a decimal): '0.8','0.9','0.10','0.11' are
 * the 4 samples of second 0, at 0, .25, .5, .75. The `timestamp` field is ignored.
 */
export function flowSamples(weight: unknown): { t: number[]; g: number[] } {
  const bySec = new Map<number, { i: number; g: number }[]>();
  for (const s of Array.isArray(weight) ? weight : []) {
    const m = /^(\d+)\.(\d+)$/.exec(String((s as { brew_time?: unknown })?.brew_time ?? ''));
    const g = num((s as { actual_smoothed_weight?: unknown })?.actual_smoothed_weight);
    if (!m || g === null) continue;
    const sec = Number(m[1]);
    if (!bySec.has(sec)) bySec.set(sec, []);
    bySec.get(sec)!.push({ i: Number(m[2]), g });
  }
  const t: number[] = [];
  const g: number[] = [];
  for (const sec of [...bySec.keys()].sort((a, b) => a - b)) {
    const l = bySec.get(sec)!.sort((a, b) => a.i - b.i);
    l.forEach((s, k) => {
      t.push(sec + k / l.length);
      g.push(s.g);
    });
  }
  return { t, g };
}

/**
 * 0.1 s buckets from t=0; each holds the sample farthest from the previous bucket's value (keeps
 * one-sample swirl/shake spikes); empty buckets repeat the previous value. Rounded to 0.1 g, delta-coded.
 */
export function compactFlow(brewFlow: unknown): CompactFlow | null {
  const { t, g } = flowSamples((brewFlow as { weight?: unknown })?.weight);
  if (!t.length) return null;
  const n = Math.min(Math.floor(t[t.length - 1] * 10 + 1e-9) + 1, MAX_FLOW_POINTS);
  const pts: number[] = [];
  let prev = Math.round(g[0] * 10);
  let k = 0;
  for (let b = 0; b < n; b++) {
    let best: number | null = null;
    for (; k < t.length && Math.floor(t[k] * 10 + 1e-9) <= b; k++) {
      const d = Math.round(g[k] * 10);
      if (best === null || Math.abs(d - prev) > Math.abs(best - prev)) best = d;
    }
    if (best !== null) prev = best;
    pts.push(prev);
  }
  return { v: 1, stepMs: 100, w: pts.map((p, i) => (i ? p - pts[i - 1] : p)) };
}

export function expandFlow(c: CompactFlow): { t: number[]; g: number[] } {
  let acc = 0;
  const g = c.w.map((d) => (acc += d) / 10);
  return { t: g.map((_, i) => i * 0.1), g };
}
