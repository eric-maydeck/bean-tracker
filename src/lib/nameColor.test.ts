import { describe, expect, it } from 'vitest';
import { nameColor, nameRuns } from './nameColor';

describe('nameColor', () => {
  it('colors any name containing "skip", any case', () => {
    for (const n of ['Skip', 'Skipper Lot', 'the SKIP blend', 'Gesha skip']) expect(nameColor(n)).toBe('var(--color-skip)');
    for (const n of ['Kihuyo', 'Ski Pass', '', null, undefined]) expect(nameColor(n)).toBeUndefined();
  });
});

describe('nameRuns', () => {
  const S = 'var(--color-skip)';
  it('colors whole occurrences of the listed names only', () => {
    expect(nameRuns('Botz Skipper Lot beats Kihuyo', ['Skipper Lot'])).toEqual([['Botz ', undefined], ['Skipper Lot', S], [' beats Kihuyo', undefined]]);
    expect(nameRuns('No names here', ['Skipper Lot'])).toEqual([['No names here', undefined]]);
    expect(nameRuns('Skipper Lot', ['Skipper Lot'])).toEqual([['Skipper Lot', S]]);
  });
  it('never tints a name inside a longer word, and prefers the longer name', () => {
    expect(nameRuns('Skipping Skip', ['Skip'])).toEqual([['Skipping ', undefined], ['Skip', S]]);
    expect(nameRuns('Skip Two (a+b)', ['Skip', 'Skip Two (a+b)'])).toEqual([['Skip Two (a+b)', S]]);
  });
});
