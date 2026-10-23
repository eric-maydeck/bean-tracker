import { describe, expect, it } from 'vitest';
import { seriesToken } from './chartColor';

describe('seriesToken', () => {
  it('1-3 series are light, medium, dark in order; 4+ take the palette by position', () => {
    expect([0, 1, 2].map((i) => seriesToken(i, 3))).toEqual(['--series-brown-1', '--series-brown-2', '--series-brown-3']);
    expect(seriesToken(0, 1)).toBe('--series-brown-1');
    expect([0, 1].map((i) => seriesToken(i, 2))).toEqual(['--series-brown-1', '--series-brown-3']); // light + dark
    expect([0, 1, 3].map((i) => seriesToken(i, 4))).toEqual(['--series-1', '--series-2', '--series-4']);
  });
});
