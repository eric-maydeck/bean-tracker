import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compactFlow, expandFlow, flowSamples, FLOW_STEP_MS, MAX_FLOW_POINTS } from './bcFlow';
import { referenceReading } from './fixtures/bcflow/referenceDetector';

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
  it('returns null for no usable samples', () => {
    expect(compactFlow({ weight: [] })).toBeNull();
    expect(compactFlow({})).toBeNull();
    expect(compactFlow({ weight: entries([['0.0', 'x']]) })).toBeNull();
  });
  it('keeps a one-sample 0.1 s spike (two 0.05 s buckets)', () => {
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
    it(`round-trips ${name}: every raw sample is within 30 g of its bucket, nearly all within 0.5 g`, () => {
      const raw = flowSamples(fixture(name).weight);
      const c = expandFlow(compactFlow(fixture(name))!);
      let close = 0;
      raw.t.forEach((t, i) => {
        const err = Math.abs(c.g[Math.floor((t * 1000) / FLOW_STEP_MS + 1e-9)] - raw.g[i]);
        expect(err, `sample ${i} t=${t}`).toBeLessThanOrEqual(30);
        if (err <= 0.5) close++;
      });
      expect(close / raw.t.length).toBeGreaterThan(0.9);
    });
  }
});

describe('detection parity (compact vs raw)', () => {
  for (const name of ['bbs', 'bbj', 'bbf', '4sy', '5sy', 'swirl', 'tare']) {
    it(`detection on compact matches raw: ${name}`, () => {
      const raw = flowSamples(fixture(name).weight);
      const c = expandFlow(compactFlow(fixture(name))!);
      const a = referenceReading(raw.t, raw.g);
      const b = referenceReading(c.t, c.g);
      expect(b.pours.length).toBe(a.pours.length);
      b.pours.forEach((p, i) => {
        expect(Math.abs(p.start - a.pours[i].start)).toBeLessThanOrEqual(0.3);
        expect(Math.abs(p.grams - a.pours[i].grams)).toBeLessThanOrEqual(2);
      });
      expect(b.spikes.length).toBe(a.spikes.length);
      b.spikes.forEach((s, i) => expect(Math.abs(s - a.spikes[i])).toBeLessThanOrEqual(0.3));
      expect(b.tares.length).toBe(a.tares.length);
      b.tares.forEach((s, i) => expect(Math.abs(s - a.tares[i])).toBeLessThanOrEqual(0.3));
    });
  }
  it('the swirl fixture has a spike and the tare fixture a tare (parity is not vacuous)', () => {
    const r = (n: string) => {
      const s = flowSamples(fixture(n).weight);
      return referenceReading(s.t, s.g);
    };
    expect(r('swirl').spikes.length).toBeGreaterThanOrEqual(1);
    expect(r('tare').tares.length).toBeGreaterThanOrEqual(1);
    expect(r('bbs').pours.length).toBeGreaterThanOrEqual(1);
  });
});
