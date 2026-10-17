import { describe, expect, it } from 'vitest';
import { pooled } from '$lib/sample';
import { settleTip } from './settleTip';

describe('settleTip', () => {
  it('a full group: median, bags and the brews the measure read', () =>
    expect(settleTip({ label: 'Light', value: 3, bags: 5, brews: 30, sample: pooled(5, 30) })).toEqual({
      title: 'Light', rows: [['Median settle brew', '3'], ['Bags', '5'], ['Brews read (first 6 each)', '30']]
    }));
  it('a small group: its counts move into the Low confidence caveat (TipBody puts it last)', () => {
    const t = settleTip({ label: 'Natural', value: 4, bags: 2, brews: 12, sample: pooled(2, 12) });
    expect(t.rows).toEqual([['Median settle brew', '4']]);
    expect(t).toHaveProperty('sample.s.small', true);
  });
});
