import { describe, expect, it } from 'vitest';
import { latestMonths } from './calendarMonths';

const day = (date: string) => ({ date, value: 1 });
const span = (months: number) =>
  Array.from({ length: months }, (_, i) => {
    const y = 2024 + Math.floor(i / 12);
    return day(`${y}-${String((i % 12) + 1).padStart(2, '0')}-15`);
  });

describe('latestMonths', () => {
  it('keeps everything within the cap', () => expect(latestMonths(span(24))).toEqual({ days: span(24), cut: false }));
  it('cuts to the latest months, whole months only', () => {
    const r = latestMonths([day('2023-12-31'), ...span(24)]);
    expect(r.cut).toBe(true);
    expect(r.days).toEqual(span(24));
  });
});
