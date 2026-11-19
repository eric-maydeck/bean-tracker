import { describe, expect, it } from 'vitest';
import { seededRandom } from './random';

const seq = (s: string) => {
  const r = seededRandom(s);
  return [r(), r(), r()];
};

describe('seededRandom', () => {
  it('repeats for equal seeds', () => expect(seq('a')).toEqual(seq('a')));
  it('differs for different seeds', () => expect(seq('a')).not.toEqual(seq('b')));
  it('stays in [0,1)', () => seq('a').forEach((x) => expect(x >= 0 && x < 1).toBe(true)));
});
