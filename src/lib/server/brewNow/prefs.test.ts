import { describe, it, expect } from 'vitest';
import { createDb } from '../db';
import { getBrewDoses, getBrewRatios, editBrewList, parseBrewDoses, parseBrewRatios, setBrewDoses } from './prefs';

describe('parseBrewDoses', () => {
  it('sorts, dedupes, accepts commas and spaces', () => expect(parseBrewDoses('18, 15 20')).toEqual({ doses: [15, 18, 20] }));
  it('rejects out of range, empty, and too many', () => {
    for (const bad of ['3', '', '41', '1,2,3,4,5,6,7', 'abc']) expect('error' in parseBrewDoses(bad)).toBe(true);
  });
  it('accepts six values', () => expect(parseBrewDoses('10 11 12 13 14 15')).toEqual({ doses: [10, 11, 12, 13, 14, 15] }));
});

describe('parseBrewRatios', () => {
  it('sorts and dedupes', () => expect(parseBrewRatios('16 15.5 16')).toEqual({ ratios: [15.5, 16] }));
  it('rejects outside 10–20, empty, and more than six', () => {
    for (const bad of ['9', '21', '', '10 11 12 13 14 15 16', 'x']) expect('error' in parseBrewRatios(bad)).toBe(true);
  });
});

describe('brew doses storage', () => {
  it('defaults, then round-trips', () => {
    const db = createDb(':memory:');
    expect(getBrewDoses(db)).toEqual([15, 18, 20]);
    setBrewDoses(db, [16, 22]);
    expect(getBrewDoses(db)).toEqual([16, 22]);
  });
});

function brew(db: ReturnType<typeof createDb>, id: number, at: string, dose: number, water: number, rating: number) {
  db.prepare(
    `INSERT INTO beanconqueror_brews (id, bc_uuid, bc_created_at, imported_at, ground_coffee_g, water_amount_g, rating)
     VALUES (?, ?, ?, 'x', ?, ?, ?)`
  ).run(id, `u${id}`, at, dose, water, rating);
}
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

describe('brew ratios', () => {
  it('falls back to 15, 16, 17 with no brews', () =>
    expect(getBrewRatios(createDb(':memory:'))).toEqual({ ratios: [15, 16, 17], derived: true }));

  it('derives the top three rounded ratios from rated brews in the last year', () => {
    const db = createDb(':memory:');
    let id = 1;
    for (const [dose, water, n] of [[18, 288, 4], [20, 300, 3], [15, 255, 2], [18, 306, 1]] as const)
      for (let i = 0; i < n; i++) brew(db, id++, daysAgo(10), dose, water, 8); // 16, 15, 17, 17
    brew(db, id++, daysAgo(10), 20, 360, 0); // unrated: ignored
    brew(db, id++, daysAgo(400), 20, 380, 9); // too old: ignored
    expect(getBrewRatios(db)).toEqual({ ratios: [15, 16, 17], derived: true });
    brew(db, id++, daysAgo(5), 20, 330, 9); // 16.5, one brew: fourth place, cut
    expect(getBrewRatios(db).ratios).toHaveLength(3);
  });

  it('the first edit stores the full derived list; later edits change only the stored list', () => {
    const db = createDb(':memory:');
    expect(editBrewList(db, 'ratios', 'add', '16.5')).toBeUndefined();
    expect(getBrewRatios(db)).toEqual({ ratios: [15, 16, 16.5, 17], derived: false });
    brew(db, 1, daysAgo(1), 20, 360, 9);
    expect(getBrewRatios(db).ratios).toEqual([15, 16, 16.5, 17]);
    expect(editBrewList(db, 'ratios', 'remove', '15')).toBeUndefined();
    expect(getBrewRatios(db).ratios).toEqual([16, 16.5, 17]);
  });
});

describe('editBrewList', () => {
  it('adds and removes doses', () => {
    const db = createDb(':memory:');
    expect(editBrewList(db, 'doses', 'add', '22')).toBeUndefined();
    expect(getBrewDoses(db)).toEqual([15, 18, 20, 22]);
    expect(editBrewList(db, 'doses', 'remove', '18')).toBeUndefined();
    expect(getBrewDoses(db)).toEqual([15, 20, 22]);
  });
  it('reports bad values, a seventh value and an emptied list without saving', () => {
    const db = createDb(':memory:');
    expect(editBrewList(db, 'doses', 'add', '3')).toMatch(/5–40/);
    expect(editBrewList(db, 'ratios', 'add', '25')).toMatch(/10–20/);
    for (const d of ['21', '22', '23']) editBrewList(db, 'doses', 'add', d);
    expect(editBrewList(db, 'doses', 'add', '24')).toMatch(/at most 6/);
    setBrewDoses(db, [18]);
    expect(editBrewList(db, 'doses', 'remove', '18')).toMatch(/at least one/);
    expect(getBrewDoses(db)).toEqual([18]);
  });
});
