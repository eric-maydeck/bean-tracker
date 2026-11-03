import { describe, it, expect } from 'vitest';
import { pooled, single, sampleTip, sampleField, TIP_TITLE, chipLabel, SAMPLE_HELP, withinNoise, scoredLine, hiddenLine, allShownLine } from './sample';
import { plainText } from './settingName';

describe('withinNoise', () => {
  it('rows whose spread is at most their mean SE\u00b2 are noise; a wider spread is not', () => {
    // values 7, 7.4: variance 0.08; SE 0.2 each → SE\u00b2 0.04 (not noise); SE 0.3 → 0.09 (noise).
    expect(withinNoise([{ value: 7, se: 0.2 }, { value: 7.4, se: 0.2 }])).toBe(false);
    expect(withinNoise([{ value: 7, se: 0.3 }, { value: 7.4, se: 0.3 }])).toBe(true);
  });
  it('needs 2 rows with an SE', () => {
    expect(withinNoise([{ value: 7, se: 1 }, { value: 9 }])).toBe(false);
    expect(withinNoise([])).toBe(false);
  });
});

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
    // Dial-in skipped: the chip says the row's (scored) count; the tip gives both; no scored when they match.
    expect(chipLabel(pooled(5, 8, 6))).toBe('Only 6 brews');
    expect(sampleTip(pooled(5, 8, 6)).rows).toEqual([['Bags', '5'], ['Rated brews', '8'], ['Brews scored once dialed', '6']]);
    expect(pooled(5, 8, 8)).not.toHaveProperty('scored');
    expect(SAMPLE_HELP).toBe('Only 2 bags: Low confidence: under 3 bags or 10 rated brews (4 for one coffee).');
  });
});

describe('scoredLine', () => {
  it('says both counts only when they differ', () => {
    expect(plainText(scoredLine(pooled(3, 12, 9))!)).toBe('12 rated brews, 9 scored once dialed'); // "once dialed" marked as a setting name
    expect(scoredLine(pooled(3, 12))).toBeNull();
    expect(scoredLine(undefined)).toBeNull();
  });
});

describe('fractional bag counts (settle shares)', () => {
  it('show one decimal in the tip and chip; whole stays whole', () => {
    const t = sampleTip(pooled(5 / 6, 5));
    expect(t.lines[0]).toContain('only 0.8 bags');
    expect(t.rows[0]).toEqual(['Bags', '0.8']);
    expect(chipLabel(pooled(5 / 6, 5))).toBe('Only 0.8 bags');
    expect(sampleTip(pooled(2, 5)).rows[0]).toEqual(['Bags', '2']);
  });
});

describe('hiddenLine', () => {
  it('one is singular, more are plural', () => {
    expect(hiddenLine('producers', '3+ bags', 1)).toEqual({ lead: 'Ranks producers with 3+ bags; 1 more is hidden. ', show: 'Show it' });
    expect(hiddenLine('producers', '3+ bags', 41)).toEqual({ lead: 'Ranks producers with 3+ bags; 41 more are hidden. ', show: 'Show them' });
  });
});

describe('allShownLine', () => {
  it('names the count, singular-safe, one space between sentences', () => {
    expect(allShownLine('producers', '3+ bags', 64)).toEqual({ lead: 'Showing all 64 producers, small samples marked. ', show: 'Show only 3+ bags again' });
    expect(allShownLine('producers', '3+ bags', 1).lead).toBe('Showing the only group, small sample marked. ');
  });
});
