import { describe, expect, it } from 'vitest';
import { clock12, hour12 } from './hours';

describe('hour12', () => {
  it('formats tight axis labels', () => {
    expect([0, 1, 6, 11, 12, 13, 18, 23].map((h) => hour12(h, true))).toEqual(['12a', '1a', '6a', '11a', '12p', '1p', '6p', '11p']);
  });
  it('formats tile and tooltip labels', () => {
    expect([0, 6, 12, 15, 23].map((h) => hour12(h))).toEqual(['12 AM', '6 AM', '12 PM', '3 PM', '11 PM']);
  });
});

describe('clock12', () => {
  it('formats minutes after midnight', () => {
    expect([0, 5, 365, 720, 1439].map(clock12)).toEqual(['12:00 AM', '12:05 AM', '6:05 AM', '12:00 PM', '11:59 PM']);
  });
});
