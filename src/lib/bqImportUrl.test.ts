import { describe, it, expect } from 'vitest';
import { bqImportHref, bqImportRequested } from './bqImportUrl';

describe('bq import url', () => {
  it('round-trips and ignores other values', () => {
    expect(bqImportRequested(new URL('http://x' + bqImportHref('a-b')).searchParams)).toBe(true);
    for (const q of ['', '?bq=1', '?bq=']) expect(bqImportRequested(new URL('http://x/c' + q).searchParams)).toBe(false);
  });
});
