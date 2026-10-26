import { describe, it, expect } from 'vitest';
import {
  parseInsightsUrl, insightsParams, boardAvg, EXACT_PARAM, resetInsights, withDefaults, DEFAULTS, compareOptions, isCustom, keepCompare, customRange,
  BREW_FILTERS_ON, activeBrewFilters, wholeNote, brewSelectsOn,
  parsePeople, parseRange, pickNumber, BOARDS, BAG_BOARDS, BYS, windowLabel, periodLabel, compareLabel, coffeeNote, emptyLine, type BrewerType, BREWER_TYPES, type LabValues, TABS, TAB_GROUPS, ratingsMenuOn, hiddenNote, phoneWords, withPageWide, parseLikeView
} from './insightsUrl';
import type { Filter } from '$lib/coffeeFilters';
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
    for (const a of ['raw', 'min3', 'k2', 'adjusted', 'best', 'best-k2', 'best-k5']) expect(parse(`avg=${a.toUpperCase()}`).avg).toBe(a);
    expect(insightsParams({ avg: 'raw' }).toString()).toBe('avg=raw'); // explicit default kept
  });
  it('avg: absent = per-board defaults (Coffees k2, others min3); an explicit value, min3 included, is every board\u2019s', () => {
    expect(parse('').avg).toBeUndefined();
    expect(insightsParams(parse('')).toString()).toBe('');
    expect(boardAvg('coffees', parse('').avg)).toBe('k2');
    expect(withDefaults(parse('')).avg).toBeUndefined(); // no one default to stand in for the per-board ones
    expect(boardAvg('roasters', parse('').avg)).toBe('min3');
    expect(insightsParams(parse('avg=min3')).toString()).toBe('avg=min3'); // explicit min3 stays: it changes Coffees
    for (const b of ['coffees', 'roasters'] as const) {
      expect(boardAvg(b, parse('avg=MIN3').avg)).toBe('min3');
      expect(boardAvg(b, parse('avg=raw').avg)).toBe('raw');
    }
  });
  it('maps the retired best-half scores to their nearest', () => {
    expect(parse('avg=dial-k2').avg).toBe('k2');
    expect(parse('avg=DIAL-K5').avg).toBe('adjusted');
    for (const v of ['constructor', '__proto__', 'toString']) expect(parse(`avg=${v}`).avg).toBeUndefined();
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
    expect(parse('range=12m&compare=2').compare).toBe(2); // 12m: up to 2
    expect(parse('range=12m&compare=3').compare).toBeUndefined();
    expect(parse('compare=1').compare).toBeUndefined(); // bare range = All time: nothing to compare with
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
  it('omits the default Score (min3) but keeps an explicit raw', () => {
    expect(insightsParams({}).toString()).toBe('');
    expect(insightsParams({ avg: 'raw' }).toString()).toBe('avg=raw');
    expect(parse('avg=MIN3').avg).toBe('min3');
  });
  it('writes compare=0 when explicitly off', () =>
    expect(insightsParams({ compare: 0 }).toString()).toBe('compare=0'));
  it('writes compare=N', () => expect(insightsParams({ compare: 2 }).toString()).toBe('compare=2'));
});

describe('withDefaults', () => {
  it('fills the defaults', () =>
    expect(withDefaults({})).toEqual({
      range: 'all', // bare URL = All time (user ruling 2026-10-17)
      compare: 0,
      ratings: 'current',
      people: 'household',
      tab: 'overview',
      rank: 'rating',
      measure: 'brews',
      unit: 'grams',
      agg: 'average',
      dial: 'dialed'
    }));
  it('keeps explicit values', () => expect(withDefaults({ range: 'all' }).range).toBe('all'));
  it('bare URL = All time; an explicit 12m stays in the URL', () => {
    expect(parse('').range).toBeUndefined();
    expect(withDefaults(parse('')).range).toBe('all');
    expect(insightsParams(parse('range=12M')).toString()).toBe('range=12m');
  });
  it('DEFAULTS match the spec', () =>
    expect(DEFAULTS).toEqual({
      range: 'all', compare: 0, ratings: 'current', people: 'household', tab: 'overview', rank: 'rating',
      measure: 'brews', unit: 'grams', agg: 'average', dial: 'dialed'
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
    expect(p('range=12m&compare=before')).toBe('before');
    expect(p('compare=before')).toBeUndefined(); // default range All time
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
    expect(parseRange(q(''), [2026]) ?? DEFAULTS.range).toBe('all'); // /stats' bare URL: All time
  });
});

describe('leaderboards params', () => {
  it('reads tab, rank and open, case-insensitively', () =>
    expect(parse('tab=Leaderboards&rank=GRAMS&open=Roasters')).toMatchObject({
      tab: 'leaderboards', rank: 'grams', open: ['roasters']
    }));
  it('keeps an explicit default tab', () => expect(parse('tab=overview').tab).toBe('overview'));
  it('rank=like', () => {
    expect(parse('rank=LIKE').rank).toBe('like');
    expect(insightsParams(parse('tab=leaderboards&rank=like&open=coffees')).toString()).toBe('tab=leaderboards&rank=like&open=coffees');
  });
  it('keeps rank and open on other tabs, so a choice survives a tab switch', () => {
    expect(parse('tab=overview&rank=grams&open=roasters')).toMatchObject({ rank: 'grams', open: ['roasters'] });
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
  it('open: a comma list in board order, case-insensitive, junk dropped; one value still parses; round trip', () => {
    expect(parse('open=water,Process,junk,water').open).toEqual(['process', 'water']);
    expect(parse('open=roasters').open).toEqual(['roasters']);
    expect(parse('open=junk').open).toBeUndefined();
    expect(insightsParams(parse('tab=leaderboards&open=water,process')).toString()).toBe('tab=leaderboards&open=process%2Cwater');
    expect(insightsParams({ open: [] }).toString()).toBe('');
  });
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
  it('agg=brewday (Per brew day) is explicit and round-trips', () => {
    expect(parse('tab=consumption&agg=BrewDay').agg).toBe('brewday');
    expect(insightsParams(parse('tab=consumption&agg=brewday')).toString()).toBe('tab=consumption&agg=brewday');
    expect(withDefaults({ agg: 'brewday' }).agg).toBe('brewday');
  });
  it('trend (Brewed over time measure), gearBy and gearView: only the non-default values, junk dropped, round-trip', () => {
    expect(parse('trend=brews').trend).toBe('brews');
    expect(parse('trend=Water').trend).toBe('water');
    expect(parse('trend=rating').trend).toBe('rating');
    expect(parse('trend=grams').trend).toBeUndefined();
    expect(parse('gearBy=grinder').gearBy).toBe('grinder');
    expect(parse('gearBy=dripper').gearBy).toBeUndefined();
    expect(parse('gearView=lines').gearView).toBe('lines');
    expect(parse('gearView=bars').gearView).toBeUndefined();
    expect(parse('waterView=lines').waterView).toBe('lines');
    expect(parse('waterView=lines').gearView).toBeUndefined(); // each chart keeps its own
    expect(parse('gearView=lines').waterView).toBeUndefined();
    for (const q of ['tab=consumption&trend=water', 'tab=gear&gearBy=grinder&gearView=lines', 'tab=water&waterView=lines'])
      expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(insightsParams(parse('')).toString()).toBe('');
    expect(withDefaults({}).trend).toBeUndefined();
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

describe('highlights params', () => {
  const parse = (q: string, types: readonly BrewerType[] = ['pourover', 'soup']) =>
    parseInsightsUrl(new URLSearchParams(q), [2026], [2026], () => false, 1, () => true, '2026-10-11', types);
  it('reads the new tabs', () => {
    expect(parse('tab=records').tab).toBe('records');
    expect(parse('tab=Milestones').tab).toBe('milestones');
  });
  it('brewer: only types present in the data', () => {
    expect(parse('brewer=soup').brewer).toBe('soup');
    expect(parse('brewer=espresso').brewer).toBeUndefined();
    expect(parse('brewer=nonsense').brewer).toBeUndefined();
  });
  it('kinds: comma list, allowed order, junk dropped', () => {
    expect(parse('kinds=bests,Firsts,junk').kinds).toEqual(['firsts', 'bests']);
    expect(parse('kinds=junk').kinds).toBeUndefined();
  });
  it('views: per-board Over time (+ wide), junk and the retired -bars dropped, board order, round trip', () => {
    expect(parse('views=water-time,Roast-TIME-wide,roasters-time,grinder-list,dripper-,filter-bars,process-time-wider,grinder-time-wide-x').views)
      .toEqual({ roast: 'wide', water: 'time' });
    expect(parse('views=roast-bars').views).toBeUndefined();
    expect(parse('views=junk').views).toBeUndefined();
    expect(parse('').views).toBeUndefined();
    expect(insightsParams(parse('views=water-time,roast-time-wide')).toString()).toBe('views=roast-time-wide%2Cwater-time');
    expect(insightsParams({ views: {} }).toString()).toBe('');
  });
  it('round-trips and omits defaults', () => {
    const s = parse('tab=records&brewer=soup&kinds=firsts,bests');
    expect(insightsParams(s).toString()).toBe('tab=records&brewer=soup&kinds=firsts%2Cbests');
    expect(insightsParams(parse('')).toString()).toBe('');
  });
  it('reset clears dial and the coffees filter (caffeine too), keeps a non-default tab', () =>
    expect(resetInsights(parse('tab=brewing&dial=all&range=1w&caffeine=all&roast=light'))).toEqual({ tab: 'brewing' }));
  it('reset keeps the tab only', () =>
    expect(resetInsights(parse('tab=records&brewer=soup&caffeine=decaf&top=20'))).toEqual({ tab: 'records' }));
  it('caffeine: absent = Caffeinated; decaf and all explicit, old caf and junk drop, sticky across tabs', () => {
    expect(parse('').caffeine).toBeUndefined();
    expect(parse('caffeine=Decaf').caffeine).toBe('decaf');
    expect(parse('caffeine=ALL').caffeine).toBe('all');
    expect(parse('caffeine=CAF').caffeine).toBeUndefined();
    expect(parse('caffeine=bogus').caffeine).toBeUndefined();
    expect(parse('tab=habits&caffeine=decaf').caffeine).toBe('decaf');
    expect(insightsParams(parse('tab=records&caffeine=decaf')).toString()).toBe('tab=records&caffeine=decaf');
    expect(insightsParams(parse('caffeine=caf')).toString()).toBe('');
  });
  it('coffeeNote names Decaf (not all) first, then the coffee fields', () => {
    expect(coffeeNote({ caffeine: 'decaf', process: 'Washed' })).toBe('Decaf · Washed');
    expect(coffeeNote({ caffeine: 'all' })).toBe('');
  });
  it('top: 20 or 50 expand the top brews; 10 is the bare URL', () => {
    expect(parse('top=20').top).toBe(20);
    expect(parse('top=50').top).toBe(50);
    expect(parse('top=10').top).toBeUndefined();
    expect(parse('top=30').top).toBeUndefined();
    expect(insightsParams(parse('tab=records&top=50')).toString()).toBe('tab=records&top=50');
  });
  it('topc: the top coffees likewise, separate from top', () => {
    expect(parse('topc=20').topc).toBe(20);
    expect(parse('topc=50&top=20')).toMatchObject({ topc: 50, top: 20 });
    expect(parse('topc=10').topc).toBeUndefined();
    expect(insightsParams(parse('tab=records&topc=50')).toString()).toBe('tab=records&topc=50');
    expect(insightsParams(parse('tab=records&top=20')).toString()).toBe('tab=records&top=20');
  });
  it('recent / recentc: 20 or 50 expand Overview\'s Recent lists; 10 is bare; separate from top', () => {
    expect(parse('recent=20').recent).toBe(20);
    expect(parse('recentc=50&recent=20')).toMatchObject({ recentc: 50, recent: 20 });
    expect(parse('recent=10').recent).toBeUndefined();
    expect(parse('recent=30&recentc=x')).toMatchObject({ recent: undefined, recentc: undefined });
    expect(parse('top=20').recent).toBeUndefined();
    expect(insightsParams(parse('recent=50&recentc=20')).toString()).toBe('recent=50&recentc=20');
    expect(resetInsights(parse('recent=20'))).toEqual({});
  });
});

describe('insights params', () => {
  it('tab, theme', () => {
    expect(parse('tab=Insights').tab).toBe('insights');
    expect(parse('theme=Money').theme).toBe('money');
    expect(parse('theme=x').theme).toBeUndefined();
  });
  it('drinkers: integer 1-20', () => {
    expect(parse('drinkers=2').drinkers).toBe(2);
    for (const v of ['0', 'abc', '21', '1.5', '']) expect(parse(`drinkers=${v}`).drinkers).toBeUndefined();
  });
  it('gpp, inflow, bpd, dose: decimals within bounds', () => {
    expect(parse('gpp=101.5').gpp).toBe(101.5);
    expect(parse('gpp=0').gpp).toBeUndefined();
    expect(parse('gpp=501').gpp).toBeUndefined();
    expect(parse('inflow=0').inflow).toBe(0);
    expect(parse('inflow=10001').inflow).toBeUndefined();
    expect(parse('bpd=2.5').bpd).toBe(2.5);
    expect(parse('bpd=0.4').bpd).toBeUndefined();
    expect(parse('dose=40').dose).toBe(40);
    expect(parse('dose=4').dose).toBeUndefined();
    expect(parse('dose=1e1').dose).toBeUndefined();
    expect(pickNumber(new URLSearchParams('x=-3'), 'x', -5, 5)).toBeUndefined();
  });
  it('round trips; reset clears them but keeps the tab', () => {
    const q = 'tab=insights&theme=gear&drinkers=3&gpp=80&inflow=0&bpd=2.5&dose=18';
    expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(insightsParams(withDefaults(parse(q)) as never).get('theme')).toBe('gear');
    expect(resetInsights(parse(q))).toEqual({ tab: 'insights' });
    expect(insightsParams({}).toString()).toBe('');
  });
});

describe('brewing lab params', () => {
  const LAB: LabValues = { bags: ['2026-sey-kiambu', '2025-old-bag'], roasts: ['Light', 'Ultralight'], processes: ['Natural', 'Washed'],
    origins: ['Kenya'], roasters: ['Sey', 'Moonwake'], grinders: ['a4z-femobook', 'zp6-1zpresso'],
    drippers: [], filters: [], waters: [], doses: [], temps: [] };
  const parse = (q: string) => parseInsightsUrl(new URLSearchParams(q), [2026], [2026], () => false, 1, () => true, '2026-10-12', BREWER_TYPES, LAB);
  it('reads the four tabs', () => {
    for (const t of ['sweetspots', 'brewing', 'water', 'gear']) expect(parse(`tab=${t.toUpperCase()}`).tab).toBe(t);
  });
  it('sweet spots picker: values from the data, canonical case; unknown dropped', () => {
    expect(parse('bag=2025-OLD-BAG&roast=ultralight&process=natural&origin=kenya&roaster=SEY')).toMatchObject(
      { bag: '2025-old-bag', roast: 'Ultralight', process: 'Natural', origin: 'Kenya', roaster: 'Sey' });
    expect(parse('bag=gone&roast=Medium&process=x&origin=Mars&roaster=Nobody')).toEqual(
      { bag: undefined, roast: undefined, process: undefined, origin: undefined, roaster: undefined });
  });
  it('grinder: a slug from the data; an explicit default is kept', () => {
    expect(parse('grinder=ZP6-1zpresso').grinder).toBe('zp6-1zpresso');
    expect(parse('grinder=a4z-femobook').grinder).toBe('a4z-femobook');
    expect(parse('grinder=virtuoso').grinder).toBeUndefined();
  });
  it('breakdowns: each *By param takes a slice; junk dropped', () => {
    expect(parse('tempBy=Roast&ratioBy=process&doseBy=origin&timeBy=roaster&bloomBy=roast&grindBy=process')).toMatchObject(
      { tempBy: 'roast', ratioBy: 'process', doseBy: 'origin', timeBy: 'roaster', bloomBy: 'roast', grindBy: 'process' });
    expect(parse('tempBy=altitude&grindBy=').tempBy).toBeUndefined();
  });
  it('temp: only exact (bands is the bare default)', () => {
    expect(parse('temp=EXACT').temp).toBe('exact');
    expect(parse('temp=bands').temp).toBeUndefined();
  });
  it('band/exact per chart: <var>=exact, case-insensitive, junk dropped; dose uses dosing= (dose= is What if)', () => {
    expect(parse('ratio=Exact&dosing=EXACT&time=exact&bloom=exact&grind=eXact')).toMatchObject(
      { ratio: 'exact', dosing: 'exact', time: 'exact', bloom: 'exact', grind: 'exact', temp: undefined });
    expect(parse('ratio=bands&dosing=1&time=&bloom=x&grind=exactly')).toMatchObject(
      { ratio: undefined, dosing: undefined, time: undefined, bloom: undefined, grind: undefined });
    expect(parse('dose=18&dosing=exact')).toMatchObject({ dose: 18, dosing: 'exact' }); // the two never collide
    expect(EXACT_PARAM).toEqual({ temp: 'temp', ratio: 'ratio', dose: 'dosing', time: 'time', bloom: 'bloom', grind: 'grind' });
  });
  it('band/exact picks are sticky through any tab and cleared by Reset', () => {
    const q = 'tab=overview&temp=exact&ratio=exact&dosing=exact&time=exact&bloom=exact&grind=exact';
    expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(withDefaults(parse(q))).toMatchObject({ temp: 'exact', ratio: 'exact', dosing: 'exact', time: 'exact', bloom: 'exact', grind: 'exact' });
    expect(resetInsights(parse(`${q.replace('overview', 'brewing')}`))).toEqual({ tab: 'brewing' });
  });
  it('pairs: expanded recipe pairs as "a--b" slugs, case-insensitive, deduped, junk dropped', () => {
    expect(parse('pairs=Lotus-mg-k-60-10--bottled-water,a--b,a--b').pairs).toEqual(['bottled-water--lotus-mg-k-60-10', 'a--b']);
    expect(parse('pairs=a-b,--b,a--,a---b,a b--c,all').pairs).toBeUndefined();
    expect(parse('pairs=').pairs).toBeUndefined();
  });
  it('pairs: either order parses to the same sorted slug', () => {
    expect(parse('pairs=b--a,a--b,c--b').pairs).toEqual(['a--b', 'b--c']);
  });
  it('pairs are sticky through any tab and cleared by Reset', () => {
    const q = 'tab=overview&pairs=a--b%2Cc--d';
    expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(withDefaults(parse(q)).pairs).toEqual(['a--b', 'c--d']);
    expect(resetInsights(parse('tab=water&pairs=a--b'))).toEqual({ tab: 'water' });
  });
  it('without lab values (other callers) every lab value is dropped', () =>
    expect(parseInsightsUrl(new URLSearchParams('bag=2025-old-bag&grinder=zp6-1zpresso'), [2026])).toEqual({}));
  it('round-trips in a fixed order, omits defaults; reset keeps the tab only', () => {
    const q = 'tab=brewing&bag=2025-old-bag&roast=Light&process=Natural&origin=Kenya&roaster=Sey&grinder=zp6-1zpresso&tempBy=roast&ratioBy=process&doseBy=origin&timeBy=roaster&bloomBy=roast&grindBy=process&temp=exact';
    expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(insightsParams(parse('tab=water')).toString()).toBe('tab=water');
    expect(resetInsights(parse(q))).toEqual({ tab: 'brewing' });
    expect(withDefaults(parse(q))).toMatchObject({
      bag: '2025-old-bag', roast: 'Light', process: 'Natural', origin: 'Kenya', roaster: 'Sey', grinder: 'zp6-1zpresso', temp: 'exact',
      tempBy: 'roast', ratioBy: 'process', doseBy: 'origin', timeBy: 'roaster', bloomBy: 'roast', grindBy: 'process'
    });
  });
});

describe('TAB_GROUPS', () => {
  it('lists every tab exactly once, in TABS order', () => {
    expect(TAB_GROUPS.flatMap((g) => g.tabs)).toEqual([...TABS]);
  });
});

describe('spend tab params', () => {
  it('tab and the view params: case-insensitive, junk dropped', () => {
    expect(parse('tab=SPEND').tab).toBe('spend');
    expect(parse('spendView=PPG').spendView).toBe('ppg');
    expect(parse('spendView=spend').spendView).toBeUndefined();
    expect(parse('spendSeries=ONEOFF').spendSeries).toBe('oneoff');
    expect(parse('spendSeries=split').spendSeries).toBeUndefined(); // the default is absent
    expect(parse('spendSeries=junk').spendSeries).toBeUndefined();
    expect(insightsParams({ tab: 'spend', spendSeries: 'all' }).get('spendSeries')).toBe('all');
    expect(insightsParams(withDefaults(parse('tab=spend'))).has('spendSeries')).toBe(false);
    expect(parse('rcSort=Rating').rcSort).toBe('rating');
    expect(parse('rcSort=foo').rcSort).toBeUndefined();
    expect(parse('rcDir=asc').rcDir).toBe('asc');
    expect(parse('rcDir=DESC').rcDir).toBe('desc');
    expect(parse('rcDir=up').rcDir).toBeUndefined();
    expect(parse('rcTop=20').rcTop).toBe(20);
    expect(parse('rcTop=50').rcTop).toBe(50);
    expect(parse('rcTop=10').rcTop).toBeUndefined();
  });
  it('round-trips, omitted when undefined, dropped by reset', () => {
    const q = 'tab=spend&spendView=ppg&spendSeries=all&rcSort=ppg&rcDir=asc&rcTop=50';
    expect(insightsParams(parse(q)).toString()).toBe(q);
    expect(withDefaults(parse(q))).toMatchObject({ spendView: 'ppg', spendSeries: 'all', rcSort: 'ppg', rcDir: 'asc', rcTop: 50 });
    expect(insightsParams({ tab: 'spend' }).toString()).toBe('tab=spend');
    expect(resetInsights({ tab: 'spend', rcSort: 'ppg', spendSeries: 'sub' })).toEqual({ tab: 'spend' });
  });
  it('On hand: tab, waitBy parsed case-insensitively, junk dropped, round-trips', () => {
    expect(parse('tab=OnHand').tab).toBe('onhand');
    expect(parse('waitBy=Origin').waitBy).toBe('origin');
    expect(parse('waitBy=junk').waitBy).toBeUndefined();
    expect(parse('waitBy=roaster').waitBy).toBe('roaster'); // the default is dropped by the page, not the parser
    expect(insightsParams(parse('tab=onhand&waitBy=process')).toString()).toBe('tab=onhand&waitBy=process');
    expect(resetInsights({ tab: 'onhand', waitBy: 'roast' })).toEqual({ tab: 'onhand' });
  });
  it('Spend group sits between Highlights and Lab; ratings menu on', () => {
    expect(TAB_GROUPS.map((g) => g.label)).toEqual(['Summary', 'Habits', 'Highlights', 'Spend', 'Lab']);
    expect(ratingsMenuOn({ tab: 'spend', rank: 'rating', measure: 'brews', trend: undefined })).toBe(true);
  });
});

describe('dial', () => {
  it('dial: only all (absent = Once dialed); junk and the default are dropped', () => {
    expect(parse('dial=ALL').dial).toBe('all');
    expect(parse('dial=dialed').dial).toBeUndefined();
    expect(parse('dial=yes').dial).toBeUndefined();
    expect(withDefaults(parse('')).dial).toBe('dialed');
  });
  it('round-trips after ratings, sticky across tabs', () => {
    expect(insightsParams(parse('ratings=all&dial=all&tab=habits')).toString()).toBe('ratings=all&dial=all&tab=habits');
  });
});

describe('coffees filter note', () => {
  it('names the set fields in process · roast · origin · roaster order', () => {
    expect(coffeeNote({ roast: 'Light', process: 'Washed' })).toBe('Washed · Light');
    expect(coffeeNote({})).toBe('');
  });
  it('emptyLine names the filter in each tab’s empty line', () => {
    expect(emptyLine('No rated brews in this period.', 'Washed · Light')).toBe('No rated brews matching Washed · Light in this period.');
    expect(emptyLine('No rated brews with gear recorded in this period.', 'Washed')).toBe('No rated brews with gear recorded matching Washed in this period.');
    expect(emptyLine('No brews in this period', 'Kenya')).toBe('No brews matching Kenya in this period.');
    expect(emptyLine('No findings in this period beyond the top stories.', 'Sey')).toBe('No findings matching Sey in this period beyond the top stories.');
    expect(emptyLine('No brews in this period.', '')).toBe('No brews in this period.');
  });
});

describe('ratingsMenuOn', () => {
  const on = (q: string) => ratingsMenuOn(withDefaults(parse(q)));
  it('the lab tabs and Records; Leaderboards by rating; Habits measuring rating', () => {
    expect(['tab=sweetspots', 'tab=brewing', 'tab=water', 'tab=gear', 'tab=records'].map(on)).toEqual([true, true, true, true, true]);
    expect(['tab=leaderboards&rank=rating', 'tab=leaderboards&rank=like', 'tab=habits&measure=rating'].map(on)).toEqual([true, true, true]);
    expect(['', 'tab=leaderboards&rank=brews', 'tab=habits&measure=brews', 'tab=consumption', 'tab=milestones'].map(on))
      .toEqual([false, false, false, false, false]);
  });
  it('Consumption shows it only while Brewed over time measures rating', () => {
    expect(on('tab=consumption&trend=rating')).toBe(true);
    expect(on('tab=consumption&trend=water')).toBe(false);
  });
});

describe('hiddenNote', () => {
  const both = ['ratings', 'dial'] as ('ratings' | 'dial')[];
  it('one short line: rows and brews, rows only, brews only, singular; nothing hidden → null (gate P4)', () => {
    expect(hiddenNote({ rows: { roasters: 40, roast: 35 }, brews: 703, why: both })!.lead).toBe('75 rows and 703 brews');
    expect(hiddenNote({ rows: { roasters: 40, roast: 35 }, brews: 703, why: both })!.short).toBe('75 rows, 703 brews');
    expect(hiddenNote({ rows: { roasters: 1 }, brews: 0 })!.short).toBe('1 row');
    expect(hiddenNote({ rows: { roasters: 1 }, brews: 0 })!.lead).toBe('1 row');
    expect(hiddenNote({ rows: {}, brews: 1, why: ['ratings'] })!.lead).toBe('1 brew');
    expect(hiddenNote({ rows: {}, brews: 0 })).toBeNull();
  });
  it('the tip: one row per board, the brews row, then the reasons once; boards past 2 fold into "+N more"', () => {
    expect(hiddenNote({ rows: { roasters: 42, roast: 12, origins: 2 }, rowsBy: { roasters: ['avg'], roast: ['avg', 'dial'] }, brews: 9, why: both })!.tip)
      .toEqual({ title: 'Hidden by your settings', rows: [['Roasters', '42'], ['Roast levels', '12'], ['Origins', '2'], ['Rated brews', '9']],
        note: 'Why: too few bags or brews, before calibration, or while dialing in.' });
    expect(hiddenNote({ rows: { process: 5 }, rowsBy: { process: ['avg'] }, brews: 0 })!.tip).toMatchObject({ rows: [['Process groups', '5']], note: 'Why: too few bags or brews.' });
    // A single leftover board shows instead of "+1 more"; two or more fold, their rows summed.
    const three = { roasters: 4, coffees: 3, origins: 2 };
    expect(hiddenNote({ rows: three, brews: 0 })!.tip.rows.map((r) => r[0])).toEqual(['Roasters', 'Coffees', 'Origins']);
    expect(hiddenNote({ rows: { ...three, water: 5 }, brews: 1 })!.tip.rows.slice(2)).toEqual([['+2 more', '7'], ['Rated brews', '1']]);
    expect(hiddenNote({ rows: { roasters: 1 }, brews: 0 })!.tip.note).toBeUndefined();
  });
});


describe('phoneWords', () => {
  it('abbreviates plural months and years only', () => {
    expect(phoneWords('Last 12 months')).toBe('Last 12 mo.');
    expect(phoneWords('Previous 3 years')).toBe('Prev. 3 yr.');
    expect(phoneWords('Last month')).toBe('Last month');
    expect(phoneWords('Year to date')).toBe('Year to date');
  });
});

describe('withPageWide (finding links)', () => {
  it('carries the Coffees filter into /coffees list links; the link\'s own column wins', () => {
    const f: Filter[] = [{ column: 'roaster', mode: 'any', values: ['Sey'] }, { column: 'decaf', mode: 'bool', value: true }];
    expect(withPageWide('/coffees?status=open', {}, f)).toBe('/coffees?status=open&roaster=Sey&decaf=true');
    expect(withPageWide('/coffees?status=all&roaster=Lume', {}, f)).toBe('/coffees?status=all&roaster=Lume&decaf=true');
    expect(withPageWide('/coffees?status=backlog&status=open', {}, [])).toBe('/coffees?status=backlog&status=open');
    expect(withPageWide('/coffees/x', {}, f)).toBe('/coffees/x');
  });
  const s = { range: 'all', compare: 1, ratings: 'all', dial: 'all', caffeine: 'decaf', roast: 'Light', roaster: 'Sey', tab: 'insights', theme: 'taste', avg: 'raw' } as const;
  it('carries the page-wide view under the link; its own params win; tab-local state stays behind', () => {
    const href = withPageWide('/insights?tab=leaderboards&rank=like&open=coffees&ratings=current', s);
    expect(Object.fromEntries(new URL(href, 'http://x').searchParams)).toEqual({
      range: 'all', compare: '1', ratings: 'current', dial: 'all', caffeine: 'decaf', roast: 'Light', roaster: 'Sey',
      tab: 'leaderboards', rank: 'like', open: 'coffees'
    });
    // The merged link parses back to the same view.
    expect(parseInsightsUrl(new URL(href, 'http://x').searchParams, YEARS)).toMatchObject({ range: 'all', caffeine: 'decaf', dial: 'all', tab: 'leaderboards', rank: 'like' });
  });
  it('defaults stay bare; other paths and #anchors are untouched', () => {
    expect(withPageWide('/insights?tab=consumption', {})).toBe('/insights?tab=consumption');
    expect(withPageWide('/coffees/x', s)).toBe('/coffees/x');
    expect(withPageWide('#insight-a', s)).toBe('#insight-a');
  });
});

describe('parseLikeView (coffee page Vs like coffees)', () => {
  const v = (q: string) => parseLikeView(new URLSearchParams(q));
  it('bare by default', () => expect(v('')).toEqual({}));
  it('reads ratings, dial=all and caffeine=all, case-insensitive', () =>
    expect(v('ratings=ALL&dial=All&caffeine=all')).toEqual({ ratings: 'all', dial: 'all', caffeine: 'all' }));
  it('keeps an explicit default', () => expect(v('ratings=current')).toEqual({ ratings: 'current' }));
  it('drops bad values, caffeine=decaf and other params', () => expect(v('ratings=x&dial=dialed&caffeine=decaf&tab=records')).toEqual({}));
  it('round-trips through insightsParams', () => expect(insightsParams(v('dial=all&ratings=all')).toString()).toBe('ratings=all&dial=all'));
});

describe('brew filters', () => {
  const lab: LabValues = { bags: [], roasts: [], processes: [], origins: [], roasters: [], grinders: [],
    drippers: ['V60', 'Origami'], filters: ['Cafec Abaca'], waters: ['Lotus 900'], doses: ['15', '18'], temps: ['93'] };
  const p = (q: string) => parseInsightsUrl(new URLSearchParams(q), YEARS, [], undefined, 2, undefined, '2026-06-01', BREWER_TYPES, lab);
  it('brew params: case-insensitive', () => {
    const s = p('dripper=v60&filter=CAFEC%20ABACA&water=lotus%20900&brewDose=18&brewTemp=93');
    expect(s).toMatchObject({ dripper: 'V60', filter: 'Cafec Abaca', water: 'Lotus 900', brewDose: '18', brewTemp: '93' });
  });
  it('brew params: unknown values drop', () => {
    const s = p('water=Mars&brewDose=99&brewTemp=hot&dripper=');
    for (const k of ['dripper', 'filter', 'water', 'brewDose', 'brewTemp'] as const) expect(s[k]).toBeUndefined();
  });
  it('brew params round-trip', () => {
    const q = 'dripper=V60&filter=Cafec+Abaca&water=Lotus+900&brewDose=18&brewTemp=93';
    const out = insightsParams(p(q));
    for (const [k, v] of new URLSearchParams(q)) expect(out.get(k)).toBe(v);
    expect(insightsParams({}).toString()).toBe('');
  });
  it("dose keeps What-if's meaning", () => expect(p('dose=12&brewDose=15')).toMatchObject({ dose: 12, brewDose: '15' }));
  it('withPageWide carries brew filters to /insights links, not /coffees', () => {
    expect(withPageWide('/insights?tab=gear', { dripper: 'V60' })).toContain('dripper=V60');
    expect(withPageWide('/coffees?view=list', { dripper: 'V60' })).not.toContain('dripper');
  });
  it('BREW_FILTERS_ON covers every tab', () => {
    expect(Object.keys(BREW_FILTERS_ON).sort()).toEqual([...TABS].sort());
    expect(BREW_FILTERS_ON.sweetspots).toEqual([]);
    expect(BREW_FILTERS_ON.milestones).toEqual([]);
    expect(BREW_FILTERS_ON.brewing).toEqual(['dripper', 'filter', 'water']);
    expect(BREW_FILTERS_ON.water).toEqual(['dripper', 'filter', 'brewDose', 'brewTemp']);
    expect(BREW_FILTERS_ON.gear).toEqual(['water', 'brewDose', 'brewTemp']);
    expect(BREW_FILTERS_ON.records).toEqual(['dripper', 'water', 'brewDose']);
    expect(BREW_FILTERS_ON.habits).toEqual(['dripper', 'brewDose']);
    expect(BREW_FILTERS_ON.consumption).toEqual(['dripper', 'brewDose']);
    for (const t of ['overview', 'leaderboards', 'insights'] as const) expect(BREW_FILTERS_ON[t]).toHaveLength(5);
  });
  it('activeBrewFilters keeps only offered ones', () =>
    expect(activeBrewFilters(withDefaults({ tab: 'gear', dripper: 'V60', water: 'Lotus 900' }))).toEqual({ water: 'Lotus 900' }));
  it('wholeNote', () => {
    expect(wholeNote(['dripper'])).toBe("Whole bags: the dripper filter doesn't apply.");
    expect(wholeNote(['dripper', 'water'])).toBe("Whole bags: the dripper and water filters don't apply.");
    expect(wholeNote(['dripper'], ['Time to clear'])).toBe("Time to clear counts whole bags: the dripper filter doesn't apply.");
    expect(wholeNote(['dripper'], ['Bought', 'Net', 'On hand'])).toBe("Bought, Net and On hand count whole bags: the dripper filter doesn't apply.");
    expect(wholeNote(['brewDose'], ['Spend', 'Bags finished'])).toBe("Spend and Bags finished count whole bags: the dose filter doesn't apply.");
  });
  it('resetInsights drops brew filters', () => expect(resetInsights({ tab: 'gear', water: 'x' })).toEqual({ tab: 'gear' }));
});

describe('gear trophy params', () => {
  it('card: one key, lowercased, junk dropped, absent = closed', () => {
    expect(parse('card=Grinder-ZP6').card).toBe('grinder-zp6');
    expect(parse('card=dripper-v60,grinder-zp6').card).toBeUndefined();
    expect(parse('card=bogus').card).toBeUndefined();
    expect(parse('card=').card).toBeUndefined();
    expect(parse('tab=gear').card).toBeUndefined();
  });
  it('gear kind toggle: case-insensitive, junk dropped, round-trips, reset clears', () => {
    expect(parse('gear=Grinder').gear).toBe('grinder');
    expect(parse('gear=water').gear).toBeUndefined();
    expect(parse('tab=gear').gear).toBeUndefined();
    expect(insightsParams({ tab: 'gear', gear: 'filter' }).toString()).toBe('tab=gear&gear=filter');
    expect(withDefaults(parse('tab=gear&gear=dripper'))).toMatchObject({ gear: 'dripper' });
    expect(resetInsights({ tab: 'gear', gear: 'filter' })).toEqual({ tab: 'gear' });
  });
  it('retired takes only open', () => {
    expect(parse('retired=OPEN').retired).toBe('open');
    expect(parse('retired=yes').retired).toBeUndefined();
  });
  it('round-trips and is bare when collapsed', () => {
    expect(insightsParams({ tab: 'gear', card: 'dripper-v60', retired: 'open' }).toString()).toBe('tab=gear&card=dripper-v60&retired=open');
    expect(insightsParams({ tab: 'gear' }).toString()).toBe('tab=gear');
    expect(withDefaults(parse('tab=gear&card=dripper-v60&retired=open'))).toMatchObject({ card: 'dripper-v60', retired: 'open' });
  });
  it('chart: one id, case kept, junk dropped, kept in the URL, dropped by reset', () => {
    expect(parse('chart=Leaderboard-Origins').chart).toBe('Leaderboard-Origins'); // case kept: tile ids are camelCase (record-oldestBrewed)
    expect(parse('chart=record-oldestBrewed').chart).toBe('record-oldestBrewed');
    expect(parse('chart=a b').chart).toBeUndefined();
    expect(parse('chart=').chart).toBeUndefined();
    expect(parse('chart=' + 'a'.repeat(101)).chart).toBeUndefined();
    expect(insightsParams(parse('tab=leaderboards&chart=leaderboard-origins')).toString()).toContain('chart=leaderboard-origins');
    expect(withDefaults(parse('chart=gear-eras')).chart).toBe('gear-eras');
    expect(resetInsights(parse('tab=records&chart=records-taste&range=1m'))).toEqual({ tab: 'records' });
  });
  it('reset drops card and retired', () => expect(resetInsights({ tab: 'gear', card: 'dripper-v60', retired: 'open' })).toEqual({ tab: 'gear' }));
  it('gear offers dripper and filter selects without filtering the lab', () => {
    expect(brewSelectsOn('gear')).toEqual(['dripper', 'filter', 'water', 'brewDose', 'brewTemp']);
    expect(brewSelectsOn('water')).toEqual(BREW_FILTERS_ON.water);
    expect(activeBrewFilters(withDefaults({ tab: 'gear', dripper: 'V60' }))).toEqual({});
  });
});
