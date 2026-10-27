import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compactFlow, expandFlow, flowSamples, MAX_FLOW_POINTS } from './bcFlow';
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
  it('keeps a one-sample 0.1 s spike', () => {
    const w = entries(
      Array.from({ length: 30 }, (_, i) => [
        `${Math.floor(i / 10)}.${i % 10}`,
        i === 14 ? 400 : 100
      ])
    );
    const c = expandFlow(compactFlow({ weight: w })!);
    expect(Math.max(...c.g)).toBe(400);
    expect(c.g[14]).toBe(400);
    expect(c.g[15]).toBe(100);
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
    it(`round-trips ${name}: each raw sample is within 0.05 g of its bucket, or the bucket kept a more extreme one`, () => {
      const raw = flowSamples(fixture(name).weight);
      const c = expandFlow(compactFlow(fixture(name))!);
      raw.t.forEach((t, i) => {
        const b = Math.floor(t * 10 + 1e-9);
        const prev = b ? c.g[b - 1] : raw.g[0];
        const ok =
          Math.abs(c.g[b] - raw.g[i]) <= 0.05 + 1e-9 ||
          Math.abs(c.g[b] - prev) >= Math.abs(raw.g[i] - prev) - 0.05 - 1e-9;
        expect(ok, `sample ${i} t=${t}`).toBe(true);
      });
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
