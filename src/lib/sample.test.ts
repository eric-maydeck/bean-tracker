import { describe, it, expect } from 'vitest';
import { pooled, single, sampleLabel, sampleRows, SAMPLE_HELP } from './sample';

describe('small-sample rule', () => {
  it('pooled: small under 3 bags or 10 brews (both edges)', () => {
    expect(pooled(2, 50).small).toBe(true);
    expect(pooled(3, 50).small).toBe(false);
    expect(pooled(8, 9).small).toBe(true);
    expect(pooled(8, 10).small).toBe(false);
    expect(pooled(3, 10)).toEqual({ bags: 3, brews: 10, small: false });
  });
  it('one bag: small under 4 rated brews', () => {
    expect(single(3)).toEqual({ bags: 1, brews: 3, small: true });
    expect(single(4).small).toBe(false);
  });
  it('label: the brews when they are what is short (or one bag), else few bags', () => {
    expect(sampleLabel(pooled(5, 7))).toBe('7 brews');
    expect(sampleLabel(pooled(2, 40))).toBe('few bags');
    expect(sampleLabel(single(3))).toBe('3 brews');
    expect(sampleLabel(single(1))).toBe('1 brew');
  });
  it('tip rows and the legend line', () => {
    expect(sampleRows(pooled(2, 7))).toEqual([['Bags', '2'], ['Brews', '7']]);
    expect(SAMPLE_HELP).toBe('Muted: few bags or brews (under 3 bags or 10 brews; one bag: under 4).');
  });
});
