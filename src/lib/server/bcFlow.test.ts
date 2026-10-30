import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compactFlow, expandFlow, flowSamples, FLOW_STEP_MS, MAX_FLOW_POINTS } from './bcFlow';
import { readPours } from './pourDetector';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/bcflow/${name}.json`, import.meta.url), 'utf8'));
const entries = (pairs: [string, unknown][]) =>
  pairs.map(([bt, w]) => ({ brew_time: bt, actual_smoothed_weight: w }));

describe('flowSamples', () => {
  it('reads brew_time as second + index within that second', () => {
    const w = ['0.8', '0.9', '0.10', '0.11', '1.0', '1.1'].map((bt, i) => ({
      brew_time: bt,
      actual_smoothed_weight: i
    }));
    expect(flowSamples(w).t).toEqual([0, 0.25, 0.5, 0.75, 1, 1.5]);
  });
  it('drops non-numeric samples and keeps negatives', () => {
    const s = flowSamples(
      entries([
        ['0.0', 'x'],
        ['0.1', -3],
        ['bad', 1],
        ['1.0', null],
        ['1.1', '2.5']
      ])
    );
    expect(s.g).toEqual([-3, 2.5]);
  });
});

describe('compactFlow', () => {
  it('ranks samples within a second by file order, not by the index number', () => {
    const w = entries([
      ['0.3', 1],
      ['0.1', 2],
      ['0.2', 3]
    ]);
    const s = flowSamples(w);
    expect(s.g).toEqual([1, 2, 3]);
    expect(s.t).toEqual([0, 1 / 3, 2 / 3]);
  });
  it('expandFlow(compactFlow) is exact to 0.1g, with negative deltas', () => {
    const vals = [0, 1.26, 1.24, -3.55, -3.5, 10.04, 0.01];
    const w = entries(vals.map((v, i) => [`${i}.0`, v]));
    const c = expandFlow(compactFlow({ weight: w })!);
    const at = (s: number) => c.g[Math.round((s * 1000) / FLOW_STEP_MS)];
    vals.forEach((v, i) => expect(at(i)).toBeCloseTo(Math.round(v * 10) / 10, 9));
  });
  it('returns null for no usable samples', () => {
    expect(compactFlow({ weight: [] })).toBeNull();
    expect(compactFlow({})).toBeNull();
    expect(compactFlow({ weight: entries([['0.0', 'x']]) })).toBeNull();
  });
  it('keeps a one-sample 0.1s spike (bucket 29 is interpolated, not repeated)', () => {
    const w = entries(
      Array.from({ length: 30 }, (_, i) => [
        `${Math.floor(i / 10)}.${i % 10}`,
        i === 14 ? 400 : 100
      ])
    );
    const c = expandFlow(compactFlow({ weight: w })!);
    expect(Math.max(...c.g)).toBe(400);
    const per = 1000 / FLOW_STEP_MS;
    expect(c.g[Math.round(1.4 * per)]).toBe(400);
    expect(c.g[Math.round(1.5 * per)]).toBe(100);
    // the neighbouring bucket is the interpolation between spike and flat, not a repeat of 400
    expect(c.g[Math.round(1.4 * per) + 1]).toBeLessThan(400);
  });
  it('caps at MAX_FLOW_POINTS', () => {
    const c = compactFlow({
      weight: entries([
        ['0.0', 1],
        ['4000.0', 2]
      ])
    })!;
    expect(c.w.length).toBe(MAX_FLOW_POINTS);
  });
  for (const name of ['bbs', 'swirl', 'tare']) {
    it(`${name}: a raw sample is never more than the 20g override bound from its bucket`, () => {
      const raw = flowSamples(fixture(name).weight);
      const c = expandFlow(compactFlow(fixture(name))!);
      let close = 0;
      raw.t.forEach((t, i) => {
        const err = Math.abs(c.g[Math.floor((t * 1000) / FLOW_STEP_MS + 1e-9)] - raw.g[i]);
        expect(err, `sample ${i} t=${t}`).toBeLessThanOrEqual(20);
        if (err <= 0.5) close++;
      });
      expect(close / raw.t.length).toBeGreaterThan(0.9);
    });
  }
});

const LOGGED: Record<string, [number, number, number]> = {
  bbs: [295.3, 18, 117],
  bbj: [244.7, 15.8, 96],
  bbf: [324, 18, 130],
  '4sy': [303.3, 18.1, 88],
  '5sy': [304, 20.2, 70],
  swirl: [272, 18.1, 114],
  tare: [325.8, 18.1, 125]
};
const logged = (n: string) => {
  const [waterG, doseG, brewTimeS] = LOGGED[n];
  return { waterG, doseG, brewTimeS };
};

describe('detection parity (compact vs raw)', () => {
  for (const name of Object.keys(LOGGED)) {
    it(`detection on compact matches raw: ${name}`, () => {
      const raw = flowSamples(fixture(name).weight);
      const c = expandFlow(compactFlow(fixture(name))!);
      const a = readPours(raw.t, raw.g, logged(name));
      const b = readPours(c.t, c.g, logged(name));
      expect(b.pattern).toBe(a.pattern);
      b.pours.forEach((p, i) => {
        expect(Math.abs(p.startS - a.pours[i].startS)).toBeLessThanOrEqual(0.3);
        expect(Math.abs(p.grams - a.pours[i].grams)).toBeLessThanOrEqual(2);
      });
      expect(b.swirls.length).toBe(a.swirls.length);
      expect(b.tares.length).toBe(a.tares.length);
      b.tares.forEach((s, i) => expect(Math.abs(s - a.tares[i])).toBeLessThanOrEqual(0.3));
    });
  }
  it('the swirl fixture has a swirl and the tare fixture a tare (parity is not vacuous)', () => {
    const r = (n: string) => {
      const s = flowSamples(fixture(n).weight);
      return readPours(s.t, s.g, logged(n));
    };
    expect(r('swirl').swirls.length).toBeGreaterThanOrEqual(1);
    expect(r('tare').tares.length).toBeGreaterThanOrEqual(1);
    expect(r('bbs').pours.length).toBeGreaterThanOrEqual(1);
  });
});
