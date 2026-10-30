import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FAST_GPS,
  FAST_MIN_AVG_GPS,
  describeReading,
  structureKey,
  timelineOf,
  type PourReading
} from '$lib/pours';
import { compactFlow, expandFlow } from './bcFlow';
import { readPours } from './pourDetector';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/bcflow/${name}.json`, import.meta.url), 'utf8'));
// logged water, dose, brew time per fixture (fixtures/bcflow/README.md)
const LOGGED: Record<string, [number, number, number]> = {
  bbs: [295.3, 18, 117],
  bbj: [244.7, 15.8, 96],
  bbf: [324, 18, 130],
  '4sy': [303.3, 18.1, 88],
  '5sy': [304, 20.2, 70],
  swirl: [272, 18.1, 114],
  tare: [325.8, 18.1, 125],
  'bbs-30s': [335.7, 20.1, 120],
  'long-pour': [336.6, 20.2, 127]
};
const read = (name: string) => {
  const c = expandFlow(compactFlow(fixture(name))!);
  const [waterG, doseG, brewTimeS] = LOGGED[name];
  return readPours(c.t, c.g, { waterG, doseG, brewTimeS });
};
const NONE = { waterG: null, doseG: null, brewTimeS: null };
/** Synthetic series: (start s, grams, seconds) pours on a 0.1 s grid, ending 10 s after the last. */
const synth = (pours: [number, number, number][], end?: number) => {
  const last = Math.max(...pours.map((p) => p[0] + p[2]));
  const t: number[] = [];
  const g: number[] = [];
  for (let x = 0; x <= (end ?? last + 10) + 1e-9; x += 0.1) {
    t.push(x);
    g.push(
      pours.reduce((s, [a, grams, d]) => s + grams * Math.min(1, Math.max(0, (x - a) / d)), 0)
    );
  }
  return { t, g };
};

const EXPECT = {
  bbs: 'FFFS',
  bbj: 'FFFSS',
  bbf: 'FFFS',
  '4sy': 'FFFF',
  '5sy': 'FFFFF'
}; // test data only
for (const [name, pattern] of Object.entries(EXPECT))
  it(`reads ${name} as ${pattern}`, () => expect(read(name).pattern).toBe(pattern));

it('bbs has two ~20s blooms; 4sy one bloom', () => {
  const b = read('bbs');
  expect(b.bloomCount).toBe(2);
  expect(Math.abs(b.bloomHoldS! - 20)).toBeLessThanOrEqual(5);
  const s = read('4sy');
  expect(s.bloomCount).toBe(1);
  expect(s.bloomHoldS).not.toBeNull();
});
it('bbs-30s has two ~30s blooms; long-pour keeps its fast/slow pattern', () => {
  const b = read('bbs-30s');
  expect(b.bloomCount).toBe(2);
  expect(Math.abs(b.bloomHoldS! - 30)).toBeLessThanOrEqual(5);
  expect(read('long-pour').pattern).toBe('FFS');
});
it('bbs: a lifted dripper is a swirl, excluded from water, and not a tare', () => {
  const r = read('bbs');
  expect(r.tares).toEqual([]);
  expect(r.swirls.length).toBeGreaterThanOrEqual(1);
  expect(Math.abs(r.scaleWaterG - 295.3)).toBeLessThanOrEqual(15);
  expect(r.lowConfidence).toBe(false);
});
it('swirl fixture: swirl found; its log (272g, 52g on the scale) cannot reconcile', () => {
  const r = read('swirl');
  expect(r.swirls.length).toBeGreaterThanOrEqual(1);
  expect(r.lowConfidence).toBe(true);
});
it('tare fixture: one tare, stitched so the water adds up, not low confidence', () => {
  const r = read('tare');
  expect(r.tares).toHaveLength(1);
  expect(Math.abs(r.scaleWaterG - 325.8)).toBeLessThanOrEqual(15);
  expect(r.lowConfidence).toBe(false);
});
it('flat series: no pours, structureKey null, "no pours found"', () => {
  const t = Array.from({ length: 200 }, (_, i) => i / 10);
  const r = readPours(
    t,
    t.map(() => 0),
    NONE
  );
  expect(r.pours).toEqual([]);
  expect(r.structureKey).toBeNull();
  expect(r.drawdownS).toBeNull();
  expect(describeReading(r)).toBe('no pours found');
});
it('a slow pour ending in a swirl-like spike reads slow (peak is high, average is low)', () => {
  const s = synth([
    [2, 100, 6],
    [40, 15, 1],
    [41, 45, 40]
  ]);
  const r = readPours(s.t, s.g, NONE);
  expect(r.pours).toHaveLength(2);
  expect(r.pours[1].peakGps).toBeGreaterThanOrEqual(FAST_GPS);
  expect(r.pours[1].avgGps).toBeLessThan(FAST_MIN_AVG_GPS);
  expect(r.pattern).toBe('FS');
});
/** Piecewise-linear series through (time, grams) points, on a 0.1 s grid. */
const curve = (pts: [number, number][]) => {
  const t: number[] = [];
  const g: number[] = [];
  for (let x = 0; x <= pts[pts.length - 1][0] + 1e-9; x += 0.1) {
    const k = Math.max(
      1,
      pts.findIndex((p) => p[0] >= x - 1e-9)
    );
    const [x0, y0] = pts[k - 1];
    const [x1, y1] = pts[k];
    t.push(x);
    g.push(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return { t, g };
};
it('a dip that climbs back to the level already reached is not a pour', () => {
  const c = curve([
    [0, 0],
    [4, 60],
    [20, 60],
    [21, 40],
    [22, 40],
    [23, 60],
    [40, 60],
    [44, 120],
    [60, 120]
  ]);
  const r = readPours(c.t, c.g, NONE);
  expect(r.pours).toHaveLength(2);
  expect(r.pours[1].startS).toBeGreaterThan(38);
});
it('a slow-dip-then-recoil swirl does not stretch the pour before it', () => {
  const c = curve([
    [0, 0],
    [3.5, 62],
    [6.5, 62],
    [7.5, 40],
    [8.3, -120],
    [9.3, -250],
    [11, 44],
    [12, 134],
    [13, 68],
    [15, 62],
    [40, 62]
  ]);
  const r = readPours(c.t, c.g, NONE);
  expect(r.pours).toHaveLength(1);
  expect(r.pours[0].durationS).toBeLessThan(8);
  expect(r.pours[0].speed).toBe('fast');
});
it('a long pour far slower than the other fast pours reads slow even above the lines', () => {
  const s = synth([
    [2, 60, 4],
    [20, 60, 4],
    [40, 60, 4],
    [60, 15, 1],
    [61, 100, 18]
  ]);
  const r = readPours(s.t, s.g, NONE);
  const last = r.pours[r.pours.length - 1];
  expect(last.peakGps).toBeGreaterThanOrEqual(FAST_GPS);
  expect(last.avgGps).toBeGreaterThanOrEqual(FAST_MIN_AVG_GPS);
  expect(r.pattern).toBe('FFFS');
});
it('single pour: bloomCount 0', () => {
  const s = synth([[2, 100, 6]]);
  const r = readPours(s.t, s.g, NONE);
  expect(r.pours).toHaveLength(1);
  expect(r.bloomCount).toBe(0);
  expect(r.bloomHoldS).toBeNull();
});
it('long hold + 1 pour reads as immersion', () => {
  const s = synth([
    [2, 60, 5],
    [122, 150, 10]
  ]);
  const r = readPours(s.t, s.g, NONE);
  expect(r.immersion).toBe(true);
  expect(r.bloomCount).toBe(1);
  expect(read('bbs').immersion).toBe(false);
});
it('ratio: logged wins; water 0 → scale; no dose → null and key ends -x', () => {
  const s = synth([[2, 100, 6]]);
  const a = readPours(s.t, s.g, { waterG: 300, doseG: 20, brewTimeS: null });
  expect([a.ratio, a.ratioSource]).toEqual([15, 'logged']);
  const b = readPours(s.t, s.g, { waterG: 0, doseG: 20, brewTimeS: null });
  expect(b.ratioSource).toBe('scale');
  expect(b.ratio).toBeCloseTo(b.scaleWaterG / 20, 9);
  const c = readPours(s.t, s.g, { waterG: 300, doseG: null, brewTimeS: null });
  expect(c.ratio).toBeNull();
  expect(c.structureKey!.endsWith('-x')).toBe(true);
});
it('total time: logged wins, else the series end', () => {
  const s = synth([[2, 100, 6]]);
  expect(readPours(s.t, s.g, { ...NONE, brewTimeS: 90 }).totalS).toBe(90);
  expect(readPours(s.t, s.g, NONE).totalS).toBeCloseTo(s.t[s.t.length - 1], 6);
});
it('structureKey format', () => {
  expect(structureKey(2, 'FFFS', 16.8)).toBe('2b-fffs-17');
  expect(structureKey(0, 'S', null)).toBe('0b-s-x');
});

const base: PourReading = {
  v: 1,
  pours: [],
  swirls: [],
  tares: [],
  bloomCount: 2,
  bloomHoldS: 31,
  immersion: false,
  totalS: 150,
  drawdownS: 20,
  scaleWaterG: 300,
  ratio: 17.0,
  ratioSource: 'logged',
  lowConfidence: false,
  pattern: 'FFFS',
  structureKey: '2b-fffs-17'
};
const pour = (speed: 'fast' | 'slow', avgGps: number, bloom = false) => ({
  startS: 0,
  durationS: 5,
  grams: 50,
  avgGps,
  peakGps: avgGps,
  speed,
  bloom,
  contactS: 20
});
it('describeReading matches the spec example', () => {
  const r = {
    ...base,
    ratio: 17.3,
    pours: [pour('fast', 10, true), pour('fast', 10, true), pour('fast', 8), pour('slow', 4)]
  };
  expect(describeReading(r)).toBe(
    'Two 30s blooms + 1 fast pour + 1 slow pour · ~1:17.3 · 2:30 total'
  );
  const y = {
    ...base,
    bloomCount: 1,
    ratio: null,
    swirls: [
      { atS: 5, afterPour: 0 },
      { atS: 60, afterPour: 2 }
    ],
    immersion: true,
    lowConfidence: true,
    pours: [pour('fast', 15, true), pour('fast', 16), pour('fast', 15), pour('slow', 4)]
  };
  expect(describeReading(y)).toBe(
    '30s bloom + 2 fast pours + 1 slow pour · swirl after bloom, swirl after pour 3 · ratio unknown · 2:30 total · immersion · low confidence'
  );
  expect(
    describeReading({
      ...y,
      ratio: 17,
      swirls: [1, 2, 3, 4].map((a) => ({ atS: a, afterPour: 1 }))
    })
  ).toContain('4 swirls');
});
it('timelineOf marks blooms', () => {
  const tl = timelineOf({
    ...base,
    pours: [pour('fast', 10, true), pour('slow', 4)]
  });
  expect(tl.pours.map((p) => p.kind)).toEqual(['bloom', 'slow']);
  expect(tl.totalS).toBe(150);
});
