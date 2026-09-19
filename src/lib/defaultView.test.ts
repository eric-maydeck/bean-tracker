import { describe, it, expect } from 'vitest';
import { defaultViewForWidth } from './defaultView';

describe('defaultViewForWidth', () => {
  it('returns compact under the 640px breakpoint', () => {
    expect(defaultViewForWidth(375)).toBe('compact');
    expect(defaultViewForWidth(639)).toBe('compact');
  });

  it('returns compact at exactly 640px, matching the inclusive CSS breakpoint', () => {
    expect(defaultViewForWidth(640)).toBe('compact');
  });

  it('returns list above the 640px breakpoint', () => {
    expect(defaultViewForWidth(641)).toBe('list');
    expect(defaultViewForWidth(1280)).toBe('list');
  });
});
