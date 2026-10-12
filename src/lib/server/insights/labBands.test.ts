import { describe, it, expect } from 'vitest';
import { bandOf, mineralOf, REST_LABELS, type LabVar } from './labBands';
import { MIXED_FILTER, type BrewFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null,
  dripper: null, filter: null, water: null, waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null,
  bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const label = (v: LabVar, o: Partial<BrewFact>, grinder?: string | null) => bandOf(v, brew(o), grinder)?.label ?? null;

describe('bandOf', () => {
  it('temp bands: every edge', () => {
    expect([89.9, 90, 92.9, 93, 94.9, 95, 99].map((t) => label('temp', { tempC: t }))).toEqual(
      ['< 90 °C', '90–92 °C', '90–92 °C', '93–94 °C', '93–94 °C', '95+ °C', '95+ °C']);
  });
  it('exact temps: whole °C, half degrees round', () => {
    expect([91, 93.5, 85].map((t) => label('tempExact', { tempC: t }))).toEqual(['91 °C', '94 °C', '85 °C']);
    expect(bandOf('tempExact', brew({ tempC: 88 }))!.order).toBe(88);
  });
  it('ratio, dose, GH: every edge', () => {
    expect([15.4, 15.5, 16.5, 17.5].map((r) => label('ratio', { ratio: r }))).toEqual(['< 1:15.5', '1:15.5–16.5', '1:16.5–17.5', '1:17.5+']);
    expect([15.9, 16, 18, 20].map((d) => label('dose', { dose: d }))).toEqual(['< 16 g', '16–18 g', '18–20 g', '20+ g']);
    const gh = (g: number) => label('gh', { waterProfile: { calcium: 1, magnesium: null, sodium: null, potassium: null, chloride: null, sulfate: null, gh: g, kh: 0 } });
    expect([29.9, 30, 60, 90].map(gh)).toEqual(['0–30 ppm', '30–60 ppm', '60–90 ppm', '90+ ppm']);
  });
  it('brew time: 15 s bands, open ends', () => {
    expect([89, 90, 104, 105, 284, 285, 400].map((s) => label('time', { brewTimeSeconds: s }))).toEqual(
      ['< 1:30', '1:30–1:44', '1:30–1:44', '1:45–1:59', '4:30–4:44', '4:45+', '4:45+']);
  });
  it('rest: every edge, negatives excluded', () => {
    expect([0, 21, 22, 30, 31, 45, 46, 60, 61, 90, 91].map((d) => label('rest', { restDays: d }))).toEqual(
      ['0–21 d', '0–21 d', '22–30 d', '22–30 d', '31–45 d', '31–45 d', '46–60 d', '46–60 d', '61–90 d', '61–90 d', '91+ d']);
    expect(label('rest', { restDays: -2 })).toBeNull();
    expect(REST_LABELS).toHaveLength(6);
  });
  it('bloom: each value; brew number 1…9, 10+', () => {
    expect(label('bloom', { bloomSeconds: 45 })).toBe('45 s');
    expect([1, 9, 10, 31].map((i) => label('brewNo', { brewIndex: i }))).toEqual(['#1', '#9', '#10+', '#10+']);
    expect(label('brewNo', { brewIndex: 0 })).toBeNull();
  });
  it('zeros / not entered are excluded', () => {
    const none = brew({});
    for (const v of ['temp', 'tempExact', 'ratio', 'dose', 'time', 'bloom', 'rest', 'water', 'dripper', 'filter', 'gh'] as const)
      expect(bandOf(v, none)).toBeNull();
    expect(label('dose', { dose: 0 })).toBeNull();
  });
  it('grind never mixed across grinders', () => {
    expect(label('grind', { grinder: 'A4Z', grind: '1.4.0' }, 'A4Z')).toBe('1.4.0');
    expect(label('grind', { grinder: 'ZP6', grind: '6.2' }, 'A4Z')).toBeNull();
    expect(label('grind', { grinder: null, grind: '1.4.0' }, null)).toBeNull();
    expect(label('grind', { grinder: 'A4Z', grind: '1..4' }, 'A4Z')).toBeNull(); // malformed
    expect(bandOf('grind', brew({ grinder: 'A4Z', grind: '1.4.0' }), 'A4Z')!.order).toBeLessThan(
      bandOf('grind', brew({ grinder: 'A4Z', grind: '1.4.5' }), 'A4Z')!.order);
  });
  it('categorical: water, dripper, filter; the mixed filter is excluded', () => {
    expect(label('water', { water: 'Lotus' })).toBe('Lotus');
    expect(label('dripper', { dripper: 'V60' })).toBe('V60');
    expect(label('filter', { filter: MIXED_FILTER })).toBeNull();
  });
});

describe('mineralOf', () => {
  const w = { calcium: 10, magnesium: 15, sodium: 0, potassium: 7.5, chloride: null, sulfate: 20.04, gh: 86.7, kh: 9.6 };
  it('mg/L to 0.1, hardness whole ppm, ratios to 0.01; 0 is a real value', () => {
    const m = (k: Parameters<typeof mineralOf>[0]) => mineralOf(k, brew({ waterProfile: w }));
    expect([m('calcium'), m('sulfate'), m('sodium'), m('gh'), m('kh'), m('mgca'), m('mgk')]).toEqual([10, 20, 0, 87, 10, 1.5, 2]);
    expect(m('chloride')).toBeNull();
  });
  it('ratios need a non-zero denominator; no profile → null', () => {
    expect(mineralOf('mgca', brew({ waterProfile: { ...w, calcium: 0 } }))).toBeNull();
    expect(mineralOf('calcium', brew({}))).toBeNull();
  });
});
