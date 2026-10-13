import { describe, expect, it } from 'vitest';
import { mainColorToken } from './chartColor';

describe('mainColorToken', () => {
  it('a lone series is brand brown; beside others it is series-1', () => {
    expect(mainColorToken(0)).toBe('--chart-color-1');
    expect(mainColorToken(2)).toBe('--series-1');
  });
});
