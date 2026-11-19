import { describe, it, expect } from 'vitest';
import { ONHAND_THUMBS } from './onhand';
import type { ThumbCtx } from '../thumbTypes';

const split = (n: number) => ({ before: [n, 0, 2], inside: [0, n, 1], past: [1, 1, n], noWindow: [0, 0, 0] });
const onHand = (over: object = {}) => ({
  tiles: { bagsWaiting: 3 },
  onHandG: 1000,
  runway: { days: 20 }, runwayAll: { days: 40 },
  age: { labels: ['a', 'b', 'c'], bags: split(1), grams: split(200) },
  states: { open: { bags: 1, grams: 50 }, waiting: { bags: 2, grams: 400 }, frozen: { bags: 0, grams: 0 } },
  waiting: { by: {
    roaster: [{ label: 'Roast A', grams: 600, bags: 2, href: null }, { label: 'Roast B', grams: 300, bags: 1, href: null }],
    origin: [{ label: 'Peru', grams: 900, bags: 3, href: null }], process: [], roast: [], caffeine: []
  } },
  ...over
});
const ctx = (s: object = {}, o: object = onHand()): ThumbCtx =>
  ({ data: { onHand: o, today: '2026-09-25' }, s: { range: 'all', unit: 'grams', ...s }, periodLabel: 'All time', compareLabel: '', perPerson: false }) as unknown as ThumbCtx;
const rows = (r: { title: string; thumb: any } | null) => r!.thumb.rows;

describe('ONHAND_THUMBS', () => {
  it('onhand-age: stacked vbars, first 2 + Other', () => {
    const r = ONHAND_THUMBS['onhand-age'](ctx())!;
    expect(r.title).toBe('Age profile');
    expect(r.thumb).toMatchObject({ kind: 'vbars', stacked: true });
    expect((r.thumb as any).series.map((s: any) => s.label)).toEqual(['Before rest window', 'In rest window', 'Other']);
  });
  it('onhand-age follows unit and is null without ages', () => {
    expect(ONHAND_THUMBS['onhand-age'](ctx({ unit: 'bags' }))).not.toBeNull();
    expect(ONHAND_THUMBS['onhand-age'](ctx({}, onHand({ age: { labels: ['a', 'b'], bags: { before: [0, 0], inside: [0, 0], past: [0, 0], noWindow: [0, 0] }, grams: { before: [0, 0], inside: [0, 0], past: [0, 0], noWindow: [0, 0] } } })))).toBeNull();
  });
  it('onhand-bag-states: plain bars with formatted values, per unit', () => {
    const g = ONHAND_THUMBS['onhand-bag-states'](ctx())!;
    expect(g.title).toBe('Bag states');
    expect(g.thumb).toMatchObject({ kind: 'bars', plain: true });
    expect(rows(g)[1]).toEqual(['Unopened', '400g', 1]);
    expect(rows(ONHAND_THUMBS['onhand-bag-states'](ctx({ unit: 'bags' })))[1][1]).toBe('2 bags');
  });
  it('onhand-waiting: top 5 bars labelled with bags, follows waitBy, null when nothing waits', () => {
    const r = ONHAND_THUMBS['onhand-waiting'](ctx())!;
    expect(r.title).toBe("What's waiting");
    expect(rows(r)[0]).toEqual(['Roast A (2)', '600g', 1]);
    expect(rows(ONHAND_THUMBS['onhand-waiting'](ctx({ waitBy: 'origin' })))[0][0]).toBe('Peru (3)');
    expect(ONHAND_THUMBS['onhand-waiting'](ctx({}, onHand({ tiles: { bagsWaiting: 0 } })))).toBeNull();
  });
  it('onhand-runway-at-your-pace: 1 line for all time, 2 otherwise, null with no pace', () => {
    const one = ONHAND_THUMBS['onhand-runway-at-your-pace'](ctx())!;
    expect(one.title).toBe('Runway at your pace');
    expect((one.thumb as any).series).toHaveLength(1);
    const two = ONHAND_THUMBS['onhand-runway-at-your-pace']({ ...ctx({ range: '12m' }), periodLabel: 'Last 12 months' })!;
    expect((two.thumb as any).series).toHaveLength(2);
    expect(ONHAND_THUMBS['onhand-runway-at-your-pace'](ctx({}, onHand({ runwayAll: { days: null } })))).toBeNull();
  });
  it('is null when On hand is not loaded', () => {
    const c = ctx();
    c.data = { ...c.data, onHand: null } as never;
    for (const f of Object.values(ONHAND_THUMBS)) expect(f(c)).toBeNull();
  });
});
