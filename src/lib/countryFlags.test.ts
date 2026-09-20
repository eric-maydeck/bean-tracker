import { describe, it, expect } from 'vitest';
import { originWithFlag } from './countryFlags';

describe('originWithFlag', () => {
  it('prefixes a known country with its flag', () => {
    expect(originWithFlag('Colombia')).toBe('🇨🇴 Colombia');
    expect(originWithFlag('Papua New Guinea')).toBe('🇵🇬 Papua New Guinea');
    expect(originWithFlag('Ethiopia')).toBe('🇪🇹 Ethiopia');
    expect(originWithFlag('Yemen')).toBe('🇾🇪 Yemen');
  });

  it('covers a country outside the current data, since the table is not limited to what has been entered so far', () => {
    expect(originWithFlag('Vietnam')).toBe('🇻🇳 Vietnam');
  });

  it('resolves common aliases to the same flag as the formal name', () => {
    expect(originWithFlag('USA')).toBe('🇺🇸 USA');
    expect(originWithFlag('United States')).toBe('🇺🇸 United States');
    expect(originWithFlag('UK')).toBe('🇬🇧 UK');
  });

  it('matches case-insensitively (lookup only) while preserving the original string in the output', () => {
    expect(originWithFlag('COLOMBIA')).toBe('🇨🇴 COLOMBIA');
  });

  it('matches after trimming for lookup purposes, even though the output keeps the original spacing', () => {
    expect(originWithFlag('  colombia  ')).toBe('🇨🇴   colombia  ');
  });

  it('passes an unmapped value through unchanged', () => {
    expect(originWithFlag('N/A')).toBe('N/A');
    expect(originWithFlag('Somewhere Unknown')).toBe('Somewhere Unknown');
  });
});
