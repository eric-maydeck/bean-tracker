import { describe, expect, it } from 'vitest';
import { boardTimeLines } from '../multiLine';
import { ERAS_THUMBS } from './eras';
import { leaderboardTimeThumb } from './leaderboards';
import type { ThumbCtx } from '../thumbTypes';

const row = (label: string, value: number, bags = 3) => ({ key: label, label, value, bags, brews: 9 }) as never;
const line = (label: string, values: (number | null)[]) => ({ label, values });
const sr = { by: 'month', labels: ['Jan', 'Feb', 'Mar'], titles: [], lines: [line('A', [1, 2, 3]), line('B', [3, 2, 1]), line('C', [2, 2, 2])] } as never;
const o = { board: 'dripper' as const, low: [], open: [], rank: 'rating' as const };
const rows = [row('A', 8), row('B', 7), row('C', 9)];

describe('boardTimeLines', () => {
  it('is null for the List (views unset) and for unranked boards', () => {
    expect(boardTimeLines(rows, sr, o)).toBeNull();
    expect(boardTimeLines(rows, sr, { ...o, views: { dripper: 'time' }, rank: 'spend' })).toBeNull();
  });
  it('time view draws the top size lines; open draws the whole pool', () => {
    const many = { ...(sr as object), lines: Array.from({ length: 7 }, (_, i) => line(`g${i}`, [1, 2, 3])) } as never;
    expect(boardTimeLines(rows, many, { ...o, views: { dripper: 'time' } })!.lines).toHaveLength(5);
    expect(boardTimeLines(rows, many, { ...o, views: { dripper: 'time' }, open: ['dripper'] })!.lines).toHaveLength(7);
  });
  it('Lowest first orders the lines lowest first', () => {
    const t = boardTimeLines(rows, sr, { ...o, views: { dripper: 'time' }, low: ['dripper'] })!;
    expect(t.lines.map((l) => l.label)).toEqual(['B', 'A', 'C']);
  });
});

const ctx = (data: object, s: object): ThumbCtx => ({ data, s, periodLabel: '', compareLabel: '', perPerson: false }) as never;
const eras = { x: ['a', 'b', 'c'], lines: [line('V60', [60, 50, 40]), line('Kalita', [40, 50, 60])], other: [] };

describe('eras thumbs', () => {
  it('gear default is stacked vbars; gearView=lines is lines; gearBy picks grinder eras', () => {
    const data = { gear: { eras, grinderEras: { ...eras, lines: [line('Comandante', [100, 100, 100]), line('Timemore', [0, 10, 20])] } } };
    expect(ERAS_THUMBS['gear-eras'](ctx(data, {}))!.thumb).toMatchObject({ kind: 'vbars', stacked: true });
    expect(ERAS_THUMBS['gear-eras'](ctx(data, { gearView: 'lines' }))!.thumb.kind).toBe('lines');
    const g = ERAS_THUMBS['gear-eras'](ctx(data, { gearBy: 'grinder' }))!;
    expect((g.thumb as { series: { label: string }[] }).series[0].label).toBe('Comandante');
    expect(g.title).toBe('Gear usage over time');
  });
  it('water uses pair colours and has no thumb without eras', () => {
    const data = { water: { eras, pairs: [{ a: 'Kalita', b: 'V60' }] } };
    const t = ERAS_THUMBS['water-eras'](ctx(data, { waterView: 'lines' }))!;
    expect(t.title).toBe('Water usage over time');
    expect(t.thumb.kind).toBe('lines');
    expect(ERAS_THUMBS['water-eras'](ctx({ water: { eras: null, pairs: [] } }, {}))).toBeNull();
  });
});

describe('leaderboard thumbs', () => {
  const data = { boards: { dripper: rows }, boardSeries: { dripper: sr } };
  it('leaderboard list view keeps bars (null here)', () => {
    expect(leaderboardTimeThumb(ctx(data, { rank: 'rating', low: [], open: [] }), 'dripper')).toBeNull();
  });
  it('time view draws lines titled by the board', () => {
    const t = leaderboardTimeThumb(ctx(data, { rank: 'rating', low: [], open: [], views: { dripper: 'time' } }), 'dripper')!;
    expect(t.title).toBe('Dripper');
    expect(t.thumb.kind).toBe('lines');
  });
});
