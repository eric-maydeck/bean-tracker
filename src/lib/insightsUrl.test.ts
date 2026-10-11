import { describe, it, expect } from 'vitest';
import {
  parseInsightsUrl, insightsParams, resetInsights, withDefaults, DEFAULTS, compareOptions, isCustom, keepCompare, customRange,
  parsePeople, parseRange, BOARDS, BAG_BOARDS, BYS, windowLabel, periodLabel, compareLabel
} from './insightsUrl';
import { compareFits } from '$lib/server/insights/time';

const YEARS = [2026];
const parse = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS);

describe('parseInsightsUrl', () => {
  it('nothing explicit by default', () => expect(parse('')).toEqual({}));
  it('reads every param', () =>
    expect(parse('range=12m&compare=1&ratings=all&avg=raw')).toEqual({
      range: '12m',
      compare: 1,
      ratings: 'all',
      avg: 'raw'
    }));
  it('is case-insensitive', () =>
    expect(parse('range=YTD&ratings=All&avg=RAW')).toEqual({
      range: 'ytd',
      ratings: 'all',
      avg: 'raw'
    }));
  it('reads an offered calendar year', () => expect(parse('range=2026').range).toBe('2026'));
  it('ignores a year outside the offered ones', () =>
    expect(parse('range=2019').range).toBeUndefined());
  it('reads every avg mode, old avg=adjusted links included', () => {
    for (const a of ['raw', 'min3', 'k2', 'adjusted', 'best', 'best-k2', 'best-k5', 'dial-k2', 'dial-k5']) expect(parse(`avg=${a.toUpperCase()}`).avg).toBe(a);
    expect(insightsParams({ avg: 'raw' }).toString()).toBe('avg=raw'); // explicit default kept
  });
  it('reads the old ratings=settled as current', () => expect(parse('ratings=Settled').ratings).toBe('current'));
  it('ignores bad values', () =>
    expect(parse('range=5y&compare=yes&ratings=none&avg=median')).toEqual({
      range: undefined,
      compare: undefined,
      ratings: undefined,
      avg: undefined
    }));
  it('compare=0 is an explicit off', () => expect(parse('compare=0').compare).toBe(0));
  it('compare=N reads N periods back within the range limit', () => {
    expect(parse('compare=2').compare).toBe(2); // 12m: up to 2
    expect(parse('compare=3').compare).toBeUndefined();
    expect(parse('range=1w&compare=4').compare).toBe(4);
    expect(parse('range=1w&compare=5').compare).toBeUndefined();
    expect(parse('range=1m&compare=6').compare).toBe(6);
    expect(parse('range=3y&compare=2').compare).toBeUndefined();
  });
  it('compare is ignored when not a whole number', () => {
    expect(parse('compare=-1').compare).toBeUndefined();
    expect(parse('compare=1.5').compare).toBeUndefined();
    expect(parse('compare=').compare).toBeUndefined();
  });
  it('all time has nothing to compare to (compare=0 still reads)', () => {
    expect(parse('range=all&compare=1').compare).toBeUndefined();
    expect(parse('range=all&compare=0').compare).toBe(0);
  });
  it('ytd and calendar years reach back to the first brew year', () => {
    const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), [2024, 2025, 2026]);
    expect(p('range=ytd&compare=2').compare).toBe(2);
    expect(p('range=ytd&compare=3').compare).toBeUndefined();
    expect(p('range=2025&compare=1').compare).toBe(1);
    expect(p('range=2025&compare=2').compare).toBeUndefined();
    expect(p('range=2024&compare=1').compare).toBeUndefined();
  });
});

describe('compare skips years without brews', () => {
  const Y = [2023, 2024, 2025, 2026];
  const BREW_YEARS = [2023, 2025, 2026]; // no brews in 2024
  it('lists only years with brews; value is still years back', () => {
    expect(compareOptions('ytd', Y, BREW_YEARS)).toEqual([
      { label: 'Earlier years', options: [{ value: '1', label: '2025 YTD' }, { value: '3', label: '2023 YTD' }] }
    ]);
    expect(compareOptions('2026', Y, BREW_YEARS)).toEqual([
      { label: 'Earlier years', options: [{ value: '1', label: '2025' }, { value: '3', label: '2023' }] }
    ]);
  });
  it('the parser drops a gap year', () => {
    const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), Y, BREW_YEARS).compare;
    expect(p('range=ytd&compare=2')).toBeUndefined();
    expect(p('range=ytd&compare=3')).toBe(3);
    expect(p('range=2026&compare=2')).toBeUndefined();
  });
});

describe('compareOptions', () => {
  const Y = [2024, 2025, 2026];
  const labels = (r: string) => compareOptions(r, Y).flatMap((g) => g.options).map((o) => `${o.value}:${o.label}`);
  it('weeks', () => expect(labels('1w')).toEqual(['1:Previous week', '2:2 weeks ago', '3:3 weeks ago', '4:4 weeks ago']));
  it('months', () => expect(labels('1m')).toHaveLength(6));
  it('3 months', () =>
    expect(labels('3m')).toEqual(['1:Previous 3 months', '2:6–9 months ago', '3:9–12 months ago', '4:12–15 months ago']));
  it('6 months', () => expect(labels('6m')).toEqual(['1:Previous 6 months', '2:12–18 months ago']));
  it('12 months', () => expect(labels('12m')).toEqual(['1:Previous 12 months', '2:2 years ago']));
  it('3 years', () => expect(labels('3y')).toEqual(['1:Previous 3 years']));
  it('ytd', () => expect(labels('ytd')).toEqual(['1:2025 YTD', '2:2024 YTD']));
  it('calendar year', () => expect(labels('2026')).toEqual(['1:2025', '2:2024']));
  it('all', () => expect(labels('all')).toEqual([]));
});

describe('insightsParams', () => {
  it('writes nothing for nothing explicit', () =>
    expect(insightsParams({}).toString()).toBe(''));
  it('round-trips in a fixed order', () => {
    const q = 'range=1w&compare=1&ratings=all&avg=raw';
    expect(insightsParams(parse('avg=raw&ratings=all&compare=1&range=1w')).toString()).toBe(q);
  });
  it('omits the default Score (best-k2) but keeps an explicit min3', () => {
    expect(insightsParams({}).toString()).toBe('');
    expect(insightsParams({ avg: 'min3' }).toString()).toBe('avg=min3');
    expect(parse('avg=MIN3').avg).toBe('min3');
  });
  it('writes compare=0 when explicitly off', () =>
    expect(insightsParams({ compare: 0 }).toString()).toBe('compare=0'));
  it('writes compare=N', () => expect(insightsParams({ compare: 2 }).toString()).toBe('compare=2'));
});

describe('withDefaults', () => {
  it('fills the defaults', () =>
    expect(withDefaults({})).toEqual({
      range: '12m',
      compare: 0,
      ratings: 'current',
      avg: 'best-k2',
      people: 'household',
      tab: 'overview',
      rank: 'rating',
      measure: 'brews',
      unit: 'grams',
      agg: 'average'
    }));
  it('keeps explicit values', () => expect(withDefaults({ range: 'all' }).range).toBe('all'));
  it('DEFAULTS match the spec', () =>
    expect(DEFAULTS).toEqual({
      range: '12m', compare: 0, ratings: 'current', avg: 'best-k2', people: 'household', tab: 'overview', rank: 'rating',
      measure: 'brews', unit: 'grams', agg: 'average'
    }));
});

describe('longer and custom compare', () => {
  const T = '2026-10-10';
  const Y = [2024, 2025, 2026];
  const fits = compareFits('2024-03-01', T); // tracking began 2024-03-01
  const menu = (r: string) => compareOptions(r, Y, Y, fits).map((g) => `${g.label}: ${g.options.map((o) => o.value).join(' ')}`);
  const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), Y, Y, fits).compare;

  it('rolling ranges offer each longer, fully tracked length, then All before', () => {
    expect(menu('1w')).toEqual(['Same length: 1 2 3 4', 'Longer: 1m 3m 6m 12m before']); // 3y starts 2023-10
    expect(menu('3m')).toEqual(['Same length: 1 2 3 4', 'Longer: 6m 12m before']);
    expect(menu('12m')).toEqual(['Same length: 1 2', 'Longer: before']);
    expect(menu('3y')).toEqual(['Same length: 1']); // nothing tracked before 2023-10-11
  });
  it('labels', () =>
    expect(compareOptions('1w', Y, Y, fits)[1].options.map((o) => o.label)).toEqual([
      'Previous month', 'Previous 3 months', 'Previous 6 months', 'Previous 12 months', 'All before'
    ]));
  it('YTD and calendar years: All before only; all time: nothing', () => {
    expect(menu('ytd')).toEqual(['Earlier years: 1 2', 'Longer: before']);
    expect(menu('2024')).toEqual([]); // no earlier brew year, nothing tracked before 2024-01-01
    expect(menu('all')).toEqual([]);
  });
  it('without a fits check no longer window is offered', () =>
    expect(compareOptions('1w', Y).map((g) => g.label)).toEqual(['Same length']));

  it('reads an offered longer window, case-insensitively', () => {
    expect(p('range=1w&compare=3M')).toBe('3m');
    expect(p('range=1w&compare=Before')).toBe('before');
    expect(p('compare=before')).toBe('before'); // default range 12m
  });
  it('ignores a longer window the range does not offer', () => {
    expect(p('range=1w&compare=3y')).toBeUndefined(); // starts before the first brew
    expect(p('range=3m&compare=1m')).toBeUndefined(); // shorter
    expect(p('range=3m&compare=3m')).toBeUndefined(); // same length is compare=1
    expect(p('range=1w&compare=1w')).toBeUndefined();
    expect(p('range=all&compare=before')).toBeUndefined();
    expect(p('compare=6m')).toBeUndefined(); // 12m: only 3y is longer
  });
  it('old compare=N links keep their meaning', () => {
    expect(p('range=12m&compare=1')).toBe(1);
    expect(p('range=1w&compare=4')).toBe(4);
    expect(p('compare=0')).toBe(0);
  });
  it('reads a custom range on any range, including all time', () => {
    expect(p('range=1w&compare=2026-09-01..2026-09-15')).toBe('2026-09-01..2026-09-15');
    expect(p('range=all&compare=2024-03-01..2026-10-10')).toBe('2024-03-01..2026-10-10');
    expect(p('range=1w&compare=2019-01-01..2019-01-31')).toBe('2019-01-01..2019-01-31'); // before tracking: valid
  });
  it.each([
    '2026-09-15..2026-09-01', // mis-ordered
    '2026-09-01..2026-10-11', // future
    '2026-02-30..2026-03-01',
    '2026-9-1..2026-9-15',
    '2026-09-01',
    '2026-09-01...2026-09-15'
  ])('ignores the custom range %s', (c) => expect(p(`range=1w&compare=${c}`)).toBeUndefined());
  it('writes longer and custom values', () => {
    expect(insightsParams({ range: '1w', compare: 'before' }).toString()).toBe('range=1w&compare=before');
    expect(insightsParams({ compare: '2026-09-01..2026-09-15' }).toString()).toBe('compare=2026-09-01..2026-09-15');
  });
  it('isCustom', () => {
    expect(isCustom('2026-09-01..2026-09-15')).toBe(true);
    expect(isCustom('3m')).toBe(false);
    expect(isCustom(2)).toBe(false);
    expect(isCustom(undefined)).toBe(false);
  });
});

describe('keepCompare (Period changed)', () => {
  it('keeps an offered same-length depth', () => expect(keepCompare(2, ['1', '2', '3m'])).toBe(2));
  it('falls back to the nearest shallower depth', () => expect(keepCompare(4, ['1', '2', 'before'])).toBe(2));
  it('turns off with no shallower depth', () => expect(keepCompare(2, ['before'])).toBeUndefined());
  it('keeps an offered longer window', () => expect(keepCompare('3m', ['1', '3m'])).toBe('3m'));
  it('turns off a longer window the new range lacks', () => expect(keepCompare('1m', ['1', '2', '6m'])).toBeUndefined());
  it('keeps a custom range', () => expect(keepCompare('2026-09-01..2026-09-15', [])).toBe('2026-09-01..2026-09-15'));
  it('leaves off and unset alone', () => {
    expect(keepCompare(0, [])).toBe(0);
    expect(keepCompare(undefined, [])).toBeUndefined();
  });
});

describe('customRange (Apply is enabled only for a usable range)', () => {
  const T = '2026-10-10';
  it('both dates, in order, ending by today', () => {
    expect(customRange('2026-09-01', '2026-09-15', T)).toBe('2026-09-01..2026-09-15');
    expect(customRange('2026-10-10', '2026-10-10', T)).toBe('2026-10-10..2026-10-10');
  });
  it.each([
    ['', '2026-09-15'],
    ['2026-09-01', ''],
    ['2026-09-15', '2026-09-01'], // wrong order
    ['2026-09-01', '2026-10-11'] // after today
  ])('null for %s..%s', (a, b) => expect(customRange(a, b, T)).toBeNull());
});

describe('people', () => {
  const two = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS, YEARS, undefined, 2);
  it('reads person and household, any case', () => {
    expect(two('people=person').people).toBe('person');
    expect(two('people=PERSON').people).toBe('person');
    expect(two('people=Household').people).toBe('household');
  });
  it('ignores a bad value', () => expect(two('people=couple').people).toBeUndefined());
  it('a household of one drops it (the default size is 1)', () => expect(parse('people=person').people).toBeUndefined());
  it('writes it only when explicit; default household', () => {
    expect(insightsParams({ people: 'person' }).toString()).toBe('people=person');
    expect(insightsParams({}).toString()).toBe('');
    expect(withDefaults({}).people).toBe('household');
  });
});

describe('shared readers (/insights and /stats)', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('parsePeople: only above one person', () => {
    expect(parsePeople(q('people=person'), 2)).toBe('person');
    expect(parsePeople(q('people=person'), 1)).toBeUndefined();
    expect(parsePeople(q('people=nobody'), 3)).toBeUndefined();
    expect(parsePeople(q(''), 2)).toBeUndefined();
  });
  it('parseRange: rolling, ytd, all and offered years, any case; nothing else', () => {
    expect(parseRange(q('range=1M'), [2026])).toBe('1m');
    expect(parseRange(q('range=all'), [2026])).toBe('all');
    expect(parseRange(q('range=2025'), [2025, 2026])).toBe('2025');
    expect(parseRange(q('range=2024'), [2025, 2026])).toBeUndefined();
    expect(parseRange(q('range=5y'), [2026])).toBeUndefined();
    expect(parseRange(q(''), [2026])).toBeUndefined();
  });
});

describe('leaderboards params', () => {
  it('reads tab, rank and open, case-insensitively', () =>
    expect(parse('tab=Leaderboards&rank=GRAMS&open=Roasters')).toMatchObject({
      tab: 'leaderboards', rank: 'grams', open: 'roasters'
    }));
  it('keeps an explicit default tab', () => expect(parse('tab=overview').tab).toBe('overview'));
  it('keeps rank and open on other tabs, so a choice survives a tab switch', () => {
    expect(parse('tab=overview&rank=grams&open=roasters')).toMatchObject({ rank: 'grams', open: 'roasters' });
    expect(parse('rank=grams').rank).toBe('grams');
  });
  it('ignores bad values', () => {
    const s = parse('tab=leaderboards&rank=median&open=cats');
    expect(s).toMatchObject({ tab: 'leaderboards' });
    expect(s.rank).toBeUndefined();
    expect(s.open).toBeUndefined();
    expect(parse('tab=charts').tab).toBeUndefined();
  });
  it('round-trips', () =>
    expect(insightsParams(parse('tab=leaderboards&rank=ppg&open=water')).toString()).toBe('tab=leaderboards&rank=ppg&open=water'));
  it('defaults: overview, rating, nothing open', () =>
    expect(withDefaults({})).toMatchObject({ tab: 'overview', rank: 'rating', open: undefined }));
  it('spend and $/g apply to bag boards only', () =>
    expect(BOARDS.filter((b) => !BAG_BOARDS.includes(b))).toEqual(['water', 'dripper', 'filter', 'grinder']));
});

describe('habits and consumption params', () => {
  it('reads measure, unit and by on any tab (sticky across tab switches)', () => {
    expect(parse('tab=Habits&measure=GRAMS')).toMatchObject({ tab: 'habits', measure: 'grams' });
    expect(parse('tab=consumption&measure=grams').measure).toBe('grams');
    expect(parse('measure=grams').measure).toBe('grams');
    expect(parse('tab=consumption&unit=Bags&by=WEEK')).toMatchObject({ tab: 'consumption', unit: 'bags', by: 'week' });
    expect(parse('tab=habits&unit=bags&by=week')).toMatchObject({ unit: 'bags', by: 'week' });
  });
  it('keeps explicit defaults', () =>
    expect(parse('tab=habits&measure=brews').measure).toBe('brews'));
  it('ignores bad values', () => {
    const s = parse('tab=consumption&unit=kg&by=year');
    expect(s.unit).toBeUndefined();
    expect(s.by).toBeUndefined();
    expect(parse('tab=habits&measure=cups').measure).toBeUndefined();
  });
  it("drops a by that doesn't fit the range", () => {
    const fits = (range: string, by: string) => !(range === 'all' && by === 'day');
    const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS, YEARS, undefined, 1, fits);
    expect(p('tab=consumption&range=all&by=day').by).toBeUndefined();
    expect(p('tab=consumption&range=all&by=week').by).toBe('week');
    expect(p('tab=habits&range=all&by=day').by).toBeUndefined();
  });
  it('round-trips', () => {
    expect(insightsParams(parse('tab=habits&measure=rating')).toString()).toBe('tab=habits&measure=rating');
    expect(insightsParams(parse('tab=consumption&unit=bags&by=month')).toString()).toBe('tab=consumption&unit=bags&by=month');
  });
  it('agg: only total is explicit; average is the default and never in the URL', () => {
    expect(parse('tab=consumption&agg=Total').agg).toBe('total');
    expect(parse('tab=habits&agg=total').agg).toBe('total'); // sticky across tabs
    expect(parse('agg=average').agg).toBeUndefined();
    expect(parse('agg=sum').agg).toBeUndefined();
    expect(insightsParams(parse('tab=consumption&agg=total')).toString()).toBe('tab=consumption&agg=total');
    expect(withDefaults({}).agg).toBe('average');
    expect(withDefaults({ agg: 'total' }).agg).toBe('total');
  });
  it('defaults: brews, grams, by auto', () => {
    expect(withDefaults({})).toMatchObject({ measure: 'brews', unit: 'grams' });
    expect(withDefaults({}).by).toBeUndefined();
    expect(BYS).toEqual(['day', 'week', 'month']);
  });
});

describe('custom Period (range=YYYY-MM-DD..YYYY-MM-DD)', () => {
  const T = '2026-10-10';
  const fits = compareFits('2020-01-01', T);
  const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS, YEARS, fits, 1, () => true, T);
  it('reads a valid span, kept explicit; a later end is kept (clamped server-side)', () => {
    expect(p('range=2026-03-01..2026-05-31').range).toBe('2026-03-01..2026-05-31');
    expect(p('range=2026-10-01..2027-01-01').range).toBe('2026-10-01..2027-01-01');
    expect(p('range=2026-10-10..2026-10-10').range).toBe('2026-10-10..2026-10-10');
  });
  it.each(['2026-05-31..2026-03-01', '2026-02-30..2026-03-05', '2026-10-11..2026-10-20', '2026-3-1..2026-5-31', 'x..y'])(
    'ignores %s', (r) => expect(p(`range=${r}`).range).toBeUndefined());
  it('round-trips through the URL', () =>
    expect(insightsParams(p('range=2026-03-01..2026-05-31')).toString()).toBe('range=2026-03-01..2026-05-31'));
  it('/stats parseRange ignores it', () =>
    expect(parseRange(new URLSearchParams('range=2026-03-01..2026-05-31'), YEARS)).toBeUndefined());
  it('compare menu: Previous period, plus All before when it fits', () => {
    const o = compareOptions('2026-03-01..2026-05-31', YEARS, YEARS, fits);
    expect(o).toEqual([
      { label: 'Same length', options: [{ value: '1', label: 'Previous period' }] },
      { label: 'Longer', options: [{ value: 'before', label: 'All before' }] }
    ]);
    expect(p('range=2026-03-01..2026-05-31&compare=1').compare).toBe(1);
    expect(p('range=2026-03-01..2026-05-31&compare=2').compare).toBeUndefined();
    expect(p('range=2026-03-01..2026-05-31&compare=3m').compare).toBeUndefined();
  });
});

describe('windowLabel', () => {
  const today = '2026-10-11';
  it('this year: no year', () => expect(windowLabel({ start: '2026-03-01', end: '2026-04-09' }, today)).toBe('Mar 1 – Apr 9'));
  it('another year: year on the end', () =>
    expect(windowLabel({ start: '2025-03-01', end: '2025-04-09' }, today)).toBe('Mar 1 – Apr 9, 2025'));
  it('spanning years: year on both', () =>
    expect(windowLabel({ start: '2025-12-20', end: '2026-01-09' }, today)).toBe('Dec 20, 2025 – Jan 9, 2026'));
  it('one day', () => expect(windowLabel({ start: '2026-03-01', end: '2026-03-01' }, today)).toBe('Mar 1'));
});

describe('legend labels', () => {
  const today = '2026-10-11';
  const P = { start: '2026-03-01', end: '2026-04-09' };
  const menu = [{ value: '1', label: 'Previous 12 months' }, { value: '2', label: '2 years ago' }];
  it('period: preset, year, custom', () => {
    expect(periodLabel('12m', P, today)).toBe('Last 12 months');
    expect(periodLabel('ytd', P, today)).toBe('Year to date');
    expect(periodLabel('2025', P, today)).toBe('2025');
    expect(periodLabel('2026-03-01..2026-04-09', P, today)).toBe('Mar 1 – Apr 9');
  });
  it('compare: menu label, custom dates, none', () => {
    expect(compareLabel(1, menu, P, today)).toBe('Previous 12 months');
    expect(compareLabel(2, menu, P, today)).toBe('2 years ago');
    expect(compareLabel('2026-03-01..2026-04-09', menu, P, today)).toBe('Mar 1 – Apr 9');
    expect(compareLabel(1, menu, null, today)).toBe('');
    expect(compareLabel(9, menu, P, today)).toBe('Mar 1 – Apr 9');
  });
});

describe('sticky tab choices and reset', () => {
  it('an off-tab choice survives parse and serialize', () =>
    expect(insightsParams(parse('tab=overview&measure=grams&unit=bags&rank=ppg')).toString()).toBe('tab=overview&rank=ppg&measure=grams&unit=bags'));
  it('reset clears everything but a non-default tab', () => {
    expect(resetInsights(parse('range=1w&compare=1&tab=habits&measure=grams'))).toEqual({ tab: 'habits' });
    expect(resetInsights(parse('range=1w&tab=overview&unit=bags'))).toEqual({});
    expect(resetInsights({})).toEqual({});
  });
});
