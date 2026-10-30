import { describe, it, expect } from 'vitest';
import { generalHardness, carbonateHardness, hardnessMismatch } from './water';

// The user's Lotus profiles (spec table, 2026-10-09): mg/L in, ppm as CaCO3 out.
const PROFILES = [
  { name: 'Mg/K 60/10', ca: 0, mg: 14.6, na: 0, k: 7.8, gh: 60, kh: 10 },
  { name: 'Holy Water', ca: 0, mg: 14.6, na: 0, k: 15.6, gh: 60, kh: 20 },
  { name: 'Ultralight (Mg + K)', ca: 0, mg: 9.7, na: 0, k: 7.8, gh: 40, kh: 10 },
  { name: 'Light and Bright', ca: 24.0, mg: 0, na: 0, k: 19.6, gh: 60, kh: 25 },
  { name: 'Reddit Bright and Juicy mod', ca: 12.0, mg: 9.7, na: 4.6, k: 3.9, gh: 70, kh: 15 },
  { name: 'Bright and Juicy', ca: 16.0, mg: 9.7, na: 4.6, k: 7.8, gh: 80, kh: 20 },
  { name: 'Ultralight (Mg + Ca + K)', ca: 8.0, mg: 4.9, na: 0, k: 7.8, gh: 40, kh: 10 },
  { name: 'Substance', ca: 24.0, mg: 7.3, na: 0, k: 31.3, gh: 90, kh: 40 }
];

describe('generalHardness / carbonateHardness', () => {
  for (const p of PROFILES) {
    it(`${p.name} → ${p.gh}/${p.kh}`, () => {
      const w = { calcium: p.ca, magnesium: p.mg, sodium: p.na, potassium: p.k };
      expect(generalHardness(w)).toBeCloseTo(p.gh, 0); // within 0.5ppm
      expect(carbonateHardness(w)).toBeCloseTo(p.kh, 0);
    });
  }

  it('treats missing minerals as 0', () => {
    const w = { calcium: null, magnesium: null, sodium: null, potassium: null };
    expect(generalHardness(w)).toBe(0);
    expect(carbonateHardness(w)).toBe(0);
  });

  it('counts a stored bicarbonate instead of Na/K, never both', () => {
    // One Na-bicarbonate drop in 900 mL: Na 2.30, HCO3 6.10 → +5 ppm KH, not 10.
    const w = { calcium: 0, magnesium: 0, sodium: 2.3, potassium: 0, bicarbonate: 6.1 };
    expect(carbonateHardness(w)).toBeCloseTo(5, 0);
  });
});

describe('hardnessMismatch', () => {
  const reddit = { calcium: 12, magnesium: 9.7, sodium: 4.6, potassium: 3.9 };
  it('flags stored GH/KH more than 2ppm off the derived values', () => {
    expect(hardnessMismatch({ ...reddit, storedGh: 63, storedKh: 14 })).toBe(true);
    // Ultralight (Mg + K) stores KH 20; derived is 10.
    expect(hardnessMismatch({ calcium: 0, magnesium: 9.7, sodium: 0, potassium: 7.8, storedGh: 41, storedKh: 20 })).toBe(true);
  });
  it('accepts values within 2ppm', () => {
    expect(hardnessMismatch({ calcium: 0, magnesium: 14.6, sodium: 0, potassium: 7.8, storedGh: 60, storedKh: 10 })).toBe(false);
    expect(hardnessMismatch({ ...reddit, storedGh: 71.9, storedKh: 13.1 })).toBe(false);
  });
  it('never flags a stored 0 or null (Bean Conqueror: not entered)', () => {
    expect(hardnessMismatch({ ...reddit, storedGh: 0, storedKh: null })).toBe(false);
  });
});
