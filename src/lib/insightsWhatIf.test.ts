import { describe, it, expect } from 'vitest';
import { runway } from './insightsWhatIf';

const w = { drinkers: 1, gpp: 100, inflow: 0, bpd: 0, dose: 0 };
describe('runway', () => {
  it('people × g/day against inflow', () => {
    expect(runway(10400, { ...w, gpp: 101 }, '2026-10-11')).toEqual({ days: 103, emptyOn: '2027-01-22' });
    expect(runway(10400, { ...w, drinkers: 2, gpp: 50 }, '2026-10-11').days).toBe(104);
    expect(runway(10400, { ...w, inflow: 700 }, '2026-10-11')).toEqual({ days: null, emptyOn: null });
  });
  it('null, not NaN, for zero drinkers, zero rate or nothing on hand', () => {
    const none = { days: null, emptyOn: null };
    expect(runway(10400, { ...w, drinkers: 0 }, '2026-10-11')).toEqual(none);
    expect(runway(10400, { ...w, gpp: 0 }, '2026-10-11')).toEqual(none);
    expect(runway(0, w, '2026-10-11')).toEqual(none);
  });
});
