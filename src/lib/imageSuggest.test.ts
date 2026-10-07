import { describe, it, expect } from 'vitest';
import { hostOf } from './imageSuggest';

describe('hostOf', () => {
  it('strips www and returns the hostname', () => expect(hostOf('https://www.lume.coffee/x')).toBe('lume.coffee'));
  it('returns empty for a non-URL', () => expect(hostOf('nope')).toBe(''));
});
