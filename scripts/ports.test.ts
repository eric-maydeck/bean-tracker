import { describe, expect, it } from 'vitest';
import { PREVIEW_BASE, numFor, portFor, previewDbFor } from './ports.ts';

describe('ports', () => {
  it('portFor wraps at 100', () => {
    expect(portFor(7, 5173)).toBe(5180);
    expect(portFor(107, 5173)).toBe(5180);
    expect(portFor(0, 5200)).toBe(5200);
    expect(portFor(26, PREVIEW_BASE)).not.toBe(5199);
  });
  it('previewDbFor null is the default path', () => {
    expect(previewDbFor(null).endsWith('/.preview-data/prod-copy.db')).toBe(true);
  });
  it('previewDbFor issue adds the number', () => {
    expect(previewDbFor(12).endsWith('/.preview-data/prod-copy-12.db')).toBe(true);
  });
  it('numFor offsets p ids', () => {
    expect([numFor('142'), numFor('p12'), numFor('x'), numFor('')]).toEqual([142, 62, null, null]);
  });
});
