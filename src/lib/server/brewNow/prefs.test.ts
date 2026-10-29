import { describe, it, expect } from 'vitest';
import { createDb } from '../db';
import { getBrewDoses, parseBrewDoses, setBrewDoses } from './prefs';

describe('parseBrewDoses', () => {
  it('sorts, dedupes, accepts commas and spaces', () => expect(parseBrewDoses('18, 15 20')).toEqual({ doses: [15, 18, 20] }));
  it('rejects out of range, empty, and too many', () => {
    for (const bad of ['3', '', '41', '1,2,3,4,5,6,7', 'abc']) expect('error' in parseBrewDoses(bad)).toBe(true);
  });
  it('accepts six values', () => expect(parseBrewDoses('10 11 12 13 14 15')).toEqual({ doses: [10, 11, 12, 13, 14, 15] }));
});

describe('brew doses storage', () => {
  it('defaults, then round-trips', () => {
    const db = createDb(':memory:');
    expect(getBrewDoses(db)).toEqual([15, 18, 20]);
    setBrewDoses(db, [16, 22]);
    expect(getBrewDoses(db)).toEqual([16, 22]);
  });
});
