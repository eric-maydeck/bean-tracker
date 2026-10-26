import { describe, it, expect } from 'vitest';
import { sortRc, type RcRow } from './reportCard';

const r = (o: Partial<RcRow>): RcRow => ({ roaster: 'R', bags: 1, spent: 10, ppg: 0.1, rating: 8, like: 0, last: '2026-09-01', href: '', ...o });
const rows = [r({ roaster: 'B', bags: 2, rating: null }), r({ roaster: 'A', bags: 5, rating: 7 }), r({ roaster: 'C', bags: 2, rating: 9 })];

describe('sortRc', () => {
  it('defaults to bags descending, ties by name', () => expect(sortRc(rows).map((x) => x.roaster)).toEqual(['A', 'B', 'C']));
  it('rating ascending puts a missing rating last', () => expect(sortRc(rows, 'rating', 'asc').map((x) => x.roaster)).toEqual(['A', 'C', 'B']));
  it('rating descending also puts it last', () => expect(sortRc(rows, 'rating', 'desc').map((x) => x.roaster)).toEqual(['C', 'A', 'B']));
  it('roaster is A to Z by default', () => expect(sortRc(rows, 'roaster').map((x) => x.roaster)).toEqual(['A', 'B', 'C']));
  it('does not mutate', () => { const c = [...rows]; sortRc(rows, 'spent'); expect(rows).toEqual(c); });
});
