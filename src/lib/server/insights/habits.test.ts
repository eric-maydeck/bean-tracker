import { describe, it, expect } from 'vitest';
import { habits, currentStreak, longestStreak, type HabitsCtx } from './habits';
import type { BrewFact } from './facts';

const brew = (localTime: string, o: Partial<BrewFact> = {}): BrewFact => ({
  id: 0, coffeeId: 1, localTime, localDate: localTime.slice(0, 10), backfilled: false, dose: 15, rating: null, roaster: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, dripper: null, filter: null, grinder: null, water: null,
  waterProfile: null, restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, ...o
});
// Mon 2026-09-07 … Sun 2026-09-20: two full weeks.
const P = { start: '2026-09-07', end: '2026-09-20' };
const ctx = (o: Partial<HabitsCtx> = {}): HabitsCtx => ({
  period: P, prev: null, measure: 'brews', ratings: 'all', size: 1, agg: 'total', dataStart: '2026-01-01', today: '2026-10-11', pace: false, ...o
});

describe('streaks', () => {
  const days = new Set(['2026-10-08', '2026-10-09', '2026-10-10']);
  it('current streak: an unbrewed today counts from yesterday', () => expect(currentStreak(days, '2026-10-11', '2026-10-11')).toBe(3));
  it('current streak: brewed today counts today', () =>
    expect(currentStreak(new Set([...days, '2026-10-11']), '2026-10-11', '2026-10-11')).toBe(4));
  it('current streak: a past end date counts back from it', () => expect(currentStreak(days, '2026-10-09', '2026-10-11')).toBe(2));
  it('current streak: a gap before a past end date is 0', () => expect(currentStreak(days, '2026-10-07', '2026-10-11')).toBe(0));
  it('longest streak with a gap inside', () =>
    expect(longestStreak(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05', '2026-09-06'])).toEqual({
      length: 3, from: '2026-09-04', to: '2026-09-06'
    }));
  it('longest streak of nothing', () => expect(longestStreak([])).toEqual({ length: 0, from: null, to: null }));
});

describe('habits', () => {
  const brews = [
    brew('2026-09-07T08:10', { rating: 8 }), // Mon
    brew('2026-09-07T08:40', { dose: 20, rating: 6 }), // Mon
    brew('2026-09-08T14:00', { backfilled: true }), // Tue, whole hour: out of hour chart and heatmap
    brew('2026-09-14T08:05'), // Mon
    brew('2026-09-21T09:00') // after the period
  ];

  it('tiles', () =>
    expect(habits(brews, ctx()).tiles).toEqual({
      activeDays: 3 / 14, brewDays: 3, trackedDays: 14, currentStreak: 0, longestStreak: 2,
      brewsPerBrewDay: 4 / 3, peakHour: 8, busiestWeekday: 0
    }));

  it('longest streak dates', () =>
    expect(habits(brews, ctx())).toMatchObject({ longestFrom: '2026-09-07', longestTo: '2026-09-08' }));

  it('hour chart skips back-filled brews and counts them', () => {
    const h = habits(brews, ctx());
    expect(h.byHour[8]).toBe(3);
    expect(h.byHour[14]).toBe(0);
    expect(h.backfilledLeftOut).toBe(1);
    expect(h.heatmap[1][14]).toBe(0);
    expect(h.heatmap[0][8]).toBe(3);
  });

  it('weekday: total ÷ occurrences in the tracked days', () => {
    const h = habits(brews, ctx({ agg: 'average' }));
    expect(h.byWeekday[0]).toBe(1.5); // 3 Monday brews over 2 Mondays
    expect(h.byWeekday[1]).toBe(0.5); // the back-filled brew still counts by date
    expect(h.byWeekday[2]).toBe(0);
    expect(h.busiestAvg).toBe(1.5); // the busiest weekday's average (Mon)
  });

  it('total: hour, weekday and heatmap sum; the tiles and busiest average stay per occurrence', () => {
    const h = habits(brews, ctx());
    expect(h.byWeekday[0]).toBe(3); // three Monday brews
    expect(h.heatmap[0][8]).toBe(3);
    expect(h.byHour[8]).toBe(3);
    expect(h.tiles.busiestWeekday).toBe(0);
    expect(h.busiestAvg).toBe(1.5);
  });

  it('average: hour per tracked day, heatmap cell per occurrence of its weekday', () => {
    const h = habits(brews, ctx({ agg: 'average' }));
    expect(h.byHour[8]).toBe(3 / 14);
    expect(h.heatmap[0][8]).toBe(1.5); // 3 Monday 8am brews over 2 Mondays
    expect(h.heatmap[1][14]).toBe(0);
    expect(h.calendar[0].value).toBe(2); // the calendar is per day already
    expect(h.tiles).toMatchObject({ peakHour: 8, busiestWeekday: 0, brewDays: 3 });
  });

  it('average with a compare: the previous hours are per its own tracked days, not paced', () => {
    const prev = { start: '2026-08-31', end: '2026-09-06' };
    const older = [brew('2026-08-31T10:15'), brew('2026-09-01T10:20'), ...brews];
    const h = habits(older, ctx({ prev, pace: true, agg: 'average' }));
    expect(h.compareHour![10]).toBe(2 / 7);
    expect(h.compareWeekday![0]).toBe(1);
  });

  it('rating ignores the Show choice', () => {
    const r = ctx({ measure: 'rating' });
    expect(habits(brews, { ...r, agg: 'average' }).byHour[8]).toBe(7);
    expect(habits(brews, r).byWeekday[0]).toBe(habits(brews, { ...r, agg: 'average' }).byWeekday[0]);
  });

  it('grams measure sums doses', () => expect(habits(brews, ctx({ measure: 'grams' })).byHour[8]).toBe(50));

  it('rating: means; peaks need 5 ratings, heatmap cells 3', () => {
    const h = habits(brews, ctx({ measure: 'rating' }));
    expect(h.byHour[8]).toBe(7);
    expect(h.byHour[9]).toBeNull();
    expect(h.tiles.peakHour).toBeNull(); // only 2 ratings at 08
    expect(h.heatmap[0][8]).toBeNull();
  });

  it('rating follows Current/All (Current drops brews before 2026-06-01)', () => {
    const early = [brew('2026-05-04T08:10', { rating: 2 }), brew('2026-05-04T08:20', { rating: 4 })];
    const c = ctx({ measure: 'rating', period: { start: '2026-05-04', end: '2026-05-10' } });
    expect(habits(early, { ...c, ratings: 'all' }).byHour[8]).toBe(3);
    expect(habits(early, { ...c, ratings: 'current' }).byHour[8]).toBeNull();
  });

  it('calendar: one entry per tracked day, 0 on a day without brews', () => {
    const cal = habits(brews, ctx()).calendar;
    expect(cal).toHaveLength(14);
    expect(cal[0]).toEqual({ date: '2026-09-07', value: 2 });
    expect(cal[2]).toEqual({ date: '2026-09-09', value: 0 });
  });

  it('per person: brews and grams ÷ size; streaks, active days unchanged', () => {
    const h = habits(brews, ctx({ size: 2 }));
    expect(h.byHour[8]).toBe(1.5);
    expect(h.tiles.brewsPerBrewDay).toBe(2 / 3);
    expect(h.tiles.activeDays).toBe(3 / 14);
    expect(h.tiles.longestStreak).toBe(2);
    expect(habits(brews, ctx({ size: 2, measure: 'rating' })).byHour[8]).toBe(7);
  });

  it('compare: paced hour series, paced weekday series, deltas and previous peaks', () => {
    const prev = { start: '2026-08-31', end: '2026-09-06' }; // one week before, 7 tracked days
    const older = [brew('2026-08-31T10:15'), brew('2026-09-01T10:20'), ...brews];
    const h = habits(older, ctx({ prev, pace: true }));
    expect(h.compareHour![10]).toBe(4); // 2 brews over 7 days, paced to 14
    expect(h.compareWeekday![0]).toBe(2); // 1 Monday brew over 7 days, paced to 14 like the hours
    expect(h.prevPeak).toEqual({ hour: 10, weekday: 0 });
    expect(h.deltas!.longestStreak).toMatchObject({ abs: 0 });
    expect(h.prevActive).toEqual({ brewDays: 2, trackedDays: 7 }); // the count behind the previous ratio
  });

  it('a period ending before today: streak at period end', () => {
    const h = habits(brews, ctx({ today: '2026-10-11' }));
    expect(h.streakAtEnd).toBe(true);
    expect(habits(brews, ctx({ period: { start: '2026-09-07', end: '2026-10-11' } })).streakAtEnd).toBe(false);
  });

  it('empty: nulls, zeros, no peaks', () => {
    const h = habits([], ctx({ dataStart: null }));
    expect(h.tiles).toMatchObject({ activeDays: null, brewDays: 0, brewsPerBrewDay: null, peakHour: null, busiestWeekday: null });
    expect(h.calendar).toEqual([]);
    expect(h.byWeekday.every((v) => v === null)).toBe(true);
  });
});
