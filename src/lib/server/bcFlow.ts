// Compact per-brew weight series from a Bean Conqueror flow profile (see docs/gotchas/bean-conqueror.md).
export const FLOW_FORMAT = 1;
export const FLOW_STEP_MS = 50;
// A bucket takes its sample farthest from the interpolated grid value only when that sample is more
// than this far away (20 g, in 0.1 g units); otherwise the interpolated value. See the README.
const SPIKE_DEV = 200;
const PER_S = 1000 / FLOW_STEP_MS;
export const MAX_FLOW_POINTS = 3600 * PER_S; // 1 h

export interface CompactFlow {
  v: 1;
  stepMs: 50;
  /** w[0] = first point in decigrams, w[i] = delta from point i-1 (integers). */
  w: number[];
}

const num = (x: unknown): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * brew_time is "<second>.<index within that second>" (NOT a decimal): '0.8','0.9','0.10','0.11' are
 * the 4 samples of second 0, at 0, .25, .5, .75. Samples are ranked in file order (the index number is
 * not used). The `timestamp` field is ignored.
 */
export function flowSamples(weight: unknown): { t: number[]; g: number[] } {
  const bySec = new Map<number, number[]>();
  for (const s of Array.isArray(weight) ? weight : []) {
    const m = /^(\d+)\.(\d+)$/.exec(String((s as { brew_time?: unknown })?.brew_time ?? ''));
    const g = num((s as { actual_smoothed_weight?: unknown })?.actual_smoothed_weight);
    if (!m || g === null) continue;
    const sec = Number(m[1]);
    if (!bySec.has(sec)) bySec.set(sec, []);
    bySec.get(sec)!.push(g);
  }
  const t: number[] = [];
  const g: number[] = [];
  for (const sec of [...bySec.keys()].sort((a, b) => a - b)) {
    const l = bySec.get(sec)!;
    l.forEach((v, k) => {
      t.push(sec + k / l.length);
      g.push(v);
    });
  }
  return { t, g };
}

/**
 * 0.05 s grid from t=0. Each point is the raw curve linearly interpolated at the grid time (no time
 * bias on ramps), except that a bucket holding a sample > 20 g away from that keeps the farthest one, so
 * one-sample swirl/shake spikes and tare snaps survive. Rounded to 0.1 g, delta-coded.
 */
export function compactFlow(brewFlow: unknown): CompactFlow | null {
  const { t, g } = flowSamples((brewFlow as { weight?: unknown })?.weight);
  if (!t.length) return null;
  const n = Math.min(Math.floor(t[t.length - 1] * PER_S + 1e-9) + 1, MAX_FLOW_POINTS);
  const pts: number[] = [];
  let k = 0;
  let j = 0;
  for (let b = 0; b < n; b++) {
    const T = b / PER_S;
    while (j + 1 < t.length && t[j + 1] <= T) j++;
    let at = g[j];
    if (T > t[j] && j + 1 < t.length) at += ((T - t[j]) / (t[j + 1] - t[j])) * (g[j + 1] - g[j]);
    const v0 = Math.round(at * 10);
    let far = v0;
    for (; k < t.length && Math.floor(t[k] * PER_S + 1e-9) <= b; k++) {
      const d = Math.round(g[k] * 10);
      if (Math.abs(d - v0) > Math.abs(far - v0)) far = d;
    }
    pts.push(Math.abs(far - v0) > SPIKE_DEV ? far : v0);
  }
  return { v: 1, stepMs: 50, w: pts.map((p, i) => (i ? p - pts[i - 1] : p)) };
}

export function expandFlow(c: CompactFlow): { t: number[]; g: number[] } {
  let acc = 0;
  const g = c.w.map((d) => (acc += d) / 10);
  return { t: g.map((_, i) => i / PER_S), g };
}
