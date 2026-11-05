import { describe, expect, it } from 'vitest';
import { pairHeight } from './fitPairs';

describe('pairHeight', () => {
  it('the taller natural height when it is within 2× the shorter (or the 20rem floor)', () => {
    expect(pairHeight(300, 500, 320)).toBe(500);
    expect(pairHeight(500, 300, 320)).toBe(500);
    expect(pairHeight(100, 300, 320)).toBe(300); // under the floor: no scroll
  });
  it('capped at 2× the shorter (or the floor): the taller card scrolls inside', () => {
    expect(pairHeight(300, 1200, 320)).toBe(600);
    expect(pairHeight(100, 900, 320)).toBe(320);
  });
  it('equal cards stay as they are', () => expect(pairHeight(400, 400, 320)).toBe(400));
  it('the cap counts only the stretchable part (rows at most 2×): headings and padding stay put', () => {
    expect(pairHeight(400, 1200, 320, 250, 1100)).toBe(650);
    expect(pairHeight(1200, 400, 320, 1100, 250)).toBe(650);
    expect(pairHeight(150, 900, 320, 60, 800)).toBe(320); // the floor still holds
  });
});
