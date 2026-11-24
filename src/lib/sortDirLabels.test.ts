import { describe, expect, it } from 'vitest';
import { sortDirLabel, sortDirTip } from './sortDirLabels';

describe('sort direction captions', () => {
  it('name the sort in effect and what a tap does', () => {
    expect(sortDirLabel('desc')).toBe('Sort descending');
    expect(sortDirLabel('asc')).toBe('Sort ascending');
    expect(sortDirTip('desc')).toBe('Descending: tap for ascending');
    expect(sortDirTip('asc')).toBe('Ascending: tap for descending');
  });
});
