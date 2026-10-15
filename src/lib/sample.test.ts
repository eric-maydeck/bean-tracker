import { describe, it, expect } from 'vitest';
import { pooled, single, sampleTip, sampleField, TIP_TITLE, chipLabel, SAMPLE_HELP } from './sample';

describe('small-sample rule', () => {
  it('pooled: small under 3 bags or 10 brews (both edges)', () => {
    expect(pooled(2, 50).small).toBe(true);
    expect(pooled(3, 50).small).toBe(false);
    expect(pooled(8, 9).small).toBe(true);
    expect(pooled(8, 10).small).toBe(false);
    expect(pooled(3, 10)).toEqual({ bags: 3, brews: 10, small: false });
  });
  it('one bag: small under 4 rated brews', () => {
    expect(single(3)).toEqual({ bags: 1, brews: 3, small: true, one: true });
    expect(single(4).small).toBe(false);
  });
  it('tip: names bags when they are short, else brews; one coffee has its own threshold', () => {
    expect(sampleTip(pooled(2, 14))).toEqual({
      lines: ['Small sample: only 2 bags, so one bag can swing this. Needs 3+ bags and 10+ rated brews.'],
      rows: [['Bags', '2'], ['Rated brews', '14']]
    });
    expect(sampleTip(pooled(5, 7)).lines[0]).toBe('Small sample: only 7 rated brews, so one brew can swing this. Needs 3+ bags and 10+ rated brews.');
    expect(sampleTip(pooled(2, 7)).lines[0]).toContain('only 2 bags');
    expect(sampleTip(single(3))).toEqual({
      lines: ['Small sample: only 3 rated brews, so one brew can swing this. One coffee needs 4+.'],
      rows: [['Rated brews', '3']]
    });
    expect(sampleTip(single(1)).lines[0]).toContain('only 1 rated brew,');
    expect(sampleTip(pooled(1, 5), true)).toEqual({
      lines: ['Small sample: only 1 bag was brewed both this way and another way, so one bag can swing this. Needs 3+ such bags and 10+ rated brews in them.'],
      rows: [['Bags brewed both ways', '1'], ['Rated brews in them', '5']]
    });
    expect(sampleTip(pooled(5, 7), true).lines[0]).toContain('only 7 rated brews in bags brewed both this way and another way, so one brew can swing this');
  });
  it('no brews is no data, never a small sample', () => {
    expect(pooled(0, 0).small).toBe(false);
    expect(single(0).small).toBe(false);
    expect(sampleField(pooled(0, 0))).toEqual({});
    expect(sampleField(pooled(1, 2)).sample).toMatchObject({ s: { small: true } });
  });
  it('labels and legend line', () => {
    expect(TIP_TITLE).toBe('Low confidence');
    expect([chipLabel(pooled(2, 14)), chipLabel(pooled(5, 7)), chipLabel(single(3)), chipLabel(single(1)), chipLabel(pooled(1, 1))]).toEqual(['Only 2 bags', 'Only 7 brews', 'Only 3 brews', 'Only 1 brew', 'Only 1 bag']);
    expect(SAMPLE_HELP).toBe('Only 2 bags: low confidence, under 3 bags or 10 rated brews (one coffee: under 4), so one bag or brew can swing it.');
  });
});
