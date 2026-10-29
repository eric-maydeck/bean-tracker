import { describe, it, expect } from 'vitest';
import { bqImportHref, bqImportRequested, editHref, editRequested } from './bqImportUrl';

describe('bq import url', () => {
  it('round-trips and ignores other values', () => {
    expect(bqImportRequested(new URL('http://x' + bqImportHref('a-b')).searchParams)).toBe(true);
    for (const q of ['', '?bq=1', '?bq=']) expect(bqImportRequested(new URL('http://x/c' + q).searchParams)).toBe(false);
  });
});

describe('edit url', () => {
  it('round-trips and ignores other values', () => {
    expect(editRequested(new URL('http://x' + editHref('a-b')).searchParams)).toBe(true);
    for (const q of ['', '?edit=0', '?edit=']) expect(editRequested(new URL('http://x/c' + q).searchParams)).toBe(false);
  });
});
