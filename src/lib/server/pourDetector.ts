// Reads a brew's weight series into pours, blooms, swirls and tares. Every measure uses time windows
// over the linearly interpolated curve at a fixed 0.1 s step, never sample-to-sample, so the raw
// series and the compact 0.05 s one read alike (bcFlow.test.ts). Thresholds were set against the
// user's tagged brews: see fixtures/bcflow/README.md.
import {
  FAST_GPS,
  FAST_MIN_AVG_GPS,
  FAST_REL_AVG,
  structureKey,
  type Pour,
  type PourReading,
  type Swirl
} from '$lib/pours';

type Run = [number, number];
const SETTLE = 3;

const makeAt = (t: number[], g: number[]) => {
  const end = t[t.length - 1] ?? 0;
  return (x: number): number => {
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
};
const merge = (runs: Run[], gap: number) => {
  const out: Run[] = [];
  for (const r of runs) {
    const l = out[out.length - 1];
    if (l && r[0] - l[1] < gap) l[1] = Math.max(l[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
};

/**
 * Curve entries to |g| < 2 (or a zero crossing) after a running max >= 50; hits < 5 s apart merge. A
 * dip that comes back to within 20 g of its level 3 s earlier inside 10 s is the dripper being lifted and put
 * back, not a tare (a tare snap stays down).
 */
function findTares(t: number[], g: number[]): number[] {
  const tares: number[] = [];
  let max = -Infinity;
  for (let i = 0; i < t.length; i++) {
    max = Math.max(max, g[i]);
    if (max >= 50 && (Math.abs(g[i]) < 2 || (i > 0 && g[i - 1] * g[i] < 0))) {
      let k = i;
      while (k > 0 && t[k] > t[i] - 3) k--; // the level before the dip, not a spike's peak
      let back = false;
      for (let j = i; j < t.length && t[j] <= t[i] + 10 && !back; j++) back = g[j] >= g[k] - 20;
      if (!back && (!tares.length || t[i] - tares[tares.length - 1] >= 5)) tares.push(t[i]);
      max = -Infinity;
    }
  }
  return tares;
}

// A swing (up or down): a `min` g move within 0.3 s that falls back to within 20 g of its base
// within 10 s. Swirls use 40 g; the pour mask also takes 25 g swings.
const swingsOf = (t: number[], at: (x: number) => number, min: number): Run[] => {
  const end = t[t.length - 1] ?? 0;
  const xs: number[] = [];
  for (let i = 0; i * 0.1 <= end + 1e-9; i++) xs.push(i / 10);
  const hits: Run[] = [];
  for (const x of xs) {
    if (x + 2 > end) break; // the end of the series is the dripper being lifted
    if (Math.abs(at(x + 0.3) - at(x)) < min) continue;
    const base = at(x);
    for (let y = x + 0.3; y <= x + 10 && y <= end; y += 0.1) {
      if (Math.abs(at(y) - base) <= 20) {
        let on = x;
        while (Math.abs(at(on) - base) < 20) on += 0.05;
        hits.push([on, y]);
        break;
      }
    }
  }
  return merge(hits, 1);
};

export function readPours(
  t0: number[],
  g0: number[],
  logged: {
    waterG: number | null;
    doseG: number | null;
    brewTimeS: number | null;
  }
): PourReading {
  const end = t0[t0.length - 1] ?? 0;
  // tares: stitch each by adding the weight just before the snap to every later point
  // a tare snap does not come back; a lifted-and-replaced dripper does, so those dips are not tares
  const lifts = swingsOf(t0, makeAt(t0, g0), 40);
  const tares = findTares(t0, g0).filter((T) => !lifts.some((l) => T >= l[0] - 0.5 && T <= l[1]));
  const g = g0.slice();
  for (const T of tares) {
    const off = makeAt(t0, g)(T - 0.5);
    for (let i = 0; i < t0.length; i++) if (t0[i] >= T) g[i] += off;
  }
  const t = t0;
  const at = makeAt(t, g);
  const xs: number[] = [];
  for (let i = 0; i * 0.1 <= end + 1e-9; i++) xs.push(i / 10);

  const PRE = 0.5;
  const POST = 2;
  const swirlTimes = swingsOf(t, at, 40).map((s) => s[0]);
  // swings whose padded ends overlap (a dip then its recoil) bridge as one, not into each other (but
  // never into a span so long it would swallow a pour)
  const spans: Run[] = [];
  for (const sp of swingsOf(t, at, 25)) {
    const l = spans[spans.length - 1];
    if (l && sp[0] - l[1] < PRE + POST && sp[1] - l[0] <= 10) l[1] = Math.max(l[1], sp[1]);
    else spans.push([sp[0], sp[1]]);
  }
  const masked = (x: number) => {
    const s = spans.find((s) => x >= s[0] - PRE && x <= s[1] + POST);
    if (!s) return at(x);
    // a swing that starts as a slow dip would anchor the bridge too low (a phantom rise): take the
    // higher of the level 0.5 s and 2 s before
    const a = Math.max(at(s[0] - PRE), at(s[0] - 2));
    return a + ((x - (s[0] - PRE)) / (s[1] - s[0] + PRE + POST)) * (at(s[1] + POST) - a);
  };

  // pours: runs where the 1 s rise exceeds 0.8 g/s; merge < 2 s apart; keep >= 10 g
  const runs: Run[] = [];
  let cur: Run | null = null;
  const rise = (x: number) => masked(x + 1) - masked(x);
  for (const x of t.length ? xs : []) {
    if (x + 2 > end) break;
    if (rise(x) > 0.8) {
      if (cur) cur[1] = x + 1;
      else runs.push((cur = [x, x + 1]));
    } else cur = null;
  }
  const merged = merge(runs, 2);
  // grams are read SETTLE s after the run ends (or at the next run), once the impact overshoot of a
  // fast pour has died away
  // a rise that only climbs back to a level the brew already reached (a lifted dripper put back, a
  // dip recovering) is not new water
  let top = -Infinity;
  const topBefore = xs.map((x) => (top = Math.max(top, masked(x))));
  const raw = merged
    .map(([a, b], i) => {
      const to = Math.min(b + SETTLE, merged[i + 1]?.[0] ?? Infinity);
      return {
        a,
        b,
        grams: masked(to) - masked(a),
        fresh: masked(to) - (topBefore[Math.round(a * 10)] ?? 0)
      };
    })
    .filter((p) => p.grams >= 10 && (p.a < 1 || p.fresh >= 10))
    .map(({ a, b, grams }) => ({ a, b, grams }));

  // total time: logged, else the last >= 40 g drop in the final 5 s (dripper lifted), else the last point
  let totalS = end;
  if (logged.brewTimeS && logged.brewTimeS > 0) totalS = logged.brewTimeS;
  else for (const x of xs) if (x >= end - 5 && at(x + 0.3) - at(x) <= -40) totalS = x;

  const pours: Pour[] = raw.map((p, i) => {
    // each 1 s window overlaps its neighbours, so a run overstates the pour by ~1 s
    const durationS = Math.max(1, p.b - p.a - 1);
    let peak = 0;
    for (let x = p.a; x < p.b - 1 + 1e-9; x += 0.1) peak = Math.max(peak, rise(x));
    const avgGps = p.grams / durationS;
    return {
      startS: p.a,
      durationS,
      grams: p.grams,
      avgGps,
      peakGps: peak,
      speed: peak >= FAST_GPS && avgGps >= FAST_MIN_AVG_GPS ? 'fast' : 'slow',
      bloom: false,
      contactS: (raw[i + 1]?.a ?? totalS) - p.a
    };
  });

  // blooms (only with >= 2 pours): pour 0, and pour 1 when it matches pour 0 in grams and in time to next
  let bloomCount = 0;
  let bloomHoldS: number | null = null;
  let immersion = false;
  if (pours.length >= 2) {
    bloomCount = 1;
    const [p0, p1, p2] = pours;
    bloomHoldS = p1.startS - p0.startS;
    if (
      p2 &&
      Math.abs(p1.grams - p0.grams) <= 0.25 * p0.grams &&
      Math.abs(p2.startS - p1.startS - bloomHoldS) <= 0.3 * bloomHoldS
    )
      bloomCount = 2;
    immersion = bloomHoldS >= 90 && pours.length <= 2;
  }
  pours.slice(0, bloomCount).forEach((p) => (p.bloom = true));

  // within the brew: a fast pour that is both much slower and over 3x as long as the median of the
  // others is slow (blooms are left alone: a bloom is often a long gentle pour)
  const fast = pours.filter((p) => p.speed === 'fast');
  const later = fast.filter((p) => !p.bloom);
  if (fast.length >= 3) {
    const med = (a: number[]) => {
      const s = a.slice().sort((x, y) => x - y);
      return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    };
    for (const p of later) {
      const others = fast.filter((q) => q !== p);
      if (
        p.avgGps < FAST_REL_AVG * med(others.map((q) => q.avgGps)) &&
        p.durationS > 3 * med(others.map((q) => q.durationS))
      )
        p.speed = 'slow';
    }
  }

  const swirls: Swirl[] = swirlTimes.map((atS) => ({
    atS,
    afterPour: pours.filter((p) => p.startS < atS).length - 1
  }));

  const scaleWaterG = pours.reduce((s, p) => s + p.grams, 0);
  const { waterG, doseG } = logged;
  let ratio: number | null = null;
  let ratioSource: PourReading['ratioSource'] = null;
  if (doseG && doseG > 0) {
    if (waterG && waterG > 0) [ratio, ratioSource] = [waterG / doseG, 'logged'];
    else if (scaleWaterG > 0) [ratio, ratioSource] = [scaleWaterG / doseG, 'scale'];
  }
  const pattern = pours.map((p) => (p.speed === 'fast' ? 'F' : 'S')).join('');
  const lastEnd = pours.length
    ? pours[pours.length - 1].startS + pours[pours.length - 1].durationS
    : 0;
  return {
    v: 1,
    pours,
    swirls,
    tares,
    bloomCount,
    bloomHoldS,
    immersion,
    totalS,
    drawdownS: pours.length ? Math.max(0, totalS - lastEnd) : null,
    scaleWaterG,
    ratio,
    ratioSource,
    lowConfidence:
      !!waterG && waterG > 0 && Math.abs(scaleWaterG - waterG) > Math.max(15, 0.1 * waterG),
    pattern,
    structureKey: pours.length ? structureKey(bloomCount, pattern, ratio) : null
  };
}
