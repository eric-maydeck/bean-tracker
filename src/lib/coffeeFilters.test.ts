import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  normalizeFilter,
  isFrozen,
  valueCounts,
  isComplete,
  upsertFilter,
  chipLabel,
  chipTitle,
  QUICK_FILTERS,
  quickFilter,
  type Filter,
  type Op
} from './coffeeFilters';
import type { CoffeeWithComputed } from './server/urgency';

let nextId = 1;
function coffee(over: Partial<CoffeeWithComputed> = {}): CoffeeWithComputed {
  const id = nextId++;
  return {
    id,
    roaster: 'Sey',
    coffee_name: `Coffee ${id}`,
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 250,
    cost: 20,
    roast_date: '2026-09-10',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 7,
    rest_days_high: 14,
    image_url: null,
    product_url: null,
    slug: `coffee-${id}`,
    opened_date: null,
    drank: 0,
    status: 'backlog',
    moved_date: null,
    decaf: 0,
    in_bean_conqueror: 0,
    created_at: '2026-09-01',
    updated_at: '2026-09-01',
    cost_per_gram: 0.08,
    days_since_roast: 10,
    drink_after: '2026-10-01',
    drink_before: '2026-10-10',
    urgency_rating: 50,
    ...over
  };
}

const range = (column: Filter['column'], op: Op, a: string, b = ''): Filter => ({ column, mode: 'range', op, a, b });

describe('applyFilters', () => {
  it('returns the input unchanged when there are no filters', () => {
    const list = [coffee(), coffee()];
    expect(applyFilters(list, [])).toEqual(list);
  });

  it('Is any of: values within one filter combine with OR', () => {
    const eth = coffee({ origin: 'Ethiopia' });
    const ken = coffee({ origin: 'Kenya' });
    const col = coffee({ origin: 'Colombia' });
    expect(applyFilters([eth, ken, col], [{ column: 'origin', mode: 'any', values: ['Ethiopia', 'Kenya'] }])).toEqual([eth, ken]);
  });

  it('Is any of: (none) selects coffees missing that value', () => {
    const none = coffee({ origin: null });
    const eth = coffee({ origin: 'Ethiopia' });
    expect(applyFilters([none, eth], [{ column: 'origin', mode: 'any', values: [null] }])).toEqual([none]);
    expect(applyFilters([none, eth], [{ column: 'origin', mode: 'any', values: ['Ethiopia'] }])).toEqual([eth]);
  });

  it('blank strings count as missing', () => {
    const blank = coffee({ origin: '' });
    expect(applyFilters([blank], [{ column: 'origin', mode: 'any', values: [null] }])).toEqual([blank]);
    expect(applyFilters([blank], [{ column: 'origin', mode: 'contains', text: '' }])).toEqual([]);
  });

  it('Contains is a case-insensitive substring match and skips missing values', () => {
    const washed = coffee({ processing: 'Washed' });
    const double = coffee({ processing: 'Double WASHED' });
    const natural = coffee({ processing: 'Natural' });
    const missing = coffee({ processing: null });
    expect(
      applyFilters([washed, double, natural, missing], [{ column: 'processing', mode: 'contains', text: 'washed' }])
    ).toEqual([washed, double]);
  });

  it('text filters read the right field for every text column', () => {
    const c = coffee({ roaster: 'Onyx', coffee_name: 'Geometry', roast_level: 'Medium' });
    expect(applyFilters([c], [{ column: 'roaster', mode: 'any', values: ['Onyx'] }])).toEqual([c]);
    expect(applyFilters([c], [{ column: 'coffee_name', mode: 'contains', text: 'geo' }])).toEqual([c]);
    expect(applyFilters([c], [{ column: 'roast_level', mode: 'any', values: ['Medium'] }])).toEqual([c]);
  });

  it('Decaf Yes/No', () => {
    const decaf = coffee({ decaf: 1 });
    const regular = coffee({ decaf: 0 });
    expect(applyFilters([decaf, regular], [{ column: 'decaf', mode: 'bool', value: true }])).toEqual([decaf]);
    expect(applyFilters([decaf, regular], [{ column: 'decaf', mode: 'bool', value: false }])).toEqual([regular]);
  });

  it('Frozen Yes/No uses "frozen start set, no frozen end"', () => {
    const frozen = coffee({ frozen_start_date: '2026-09-01' });
    const thawed = coffee({ frozen_start_date: '2026-09-01', frozen_end_date: '2026-09-05' });
    const never = coffee();
    expect(isFrozen(frozen)).toBe(true);
    expect(isFrozen(thawed)).toBe(false);
    expect(applyFilters([frozen, thawed, never], [{ column: 'frozen', mode: 'bool', value: true }])).toEqual([frozen]);
    expect(applyFilters([frozen, thawed, never], [{ column: 'frozen', mode: 'bool', value: false }])).toEqual([thawed, never]);
  });

  it.each([
    ['>', '250', false],
    ['>', '249', true],
    ['>=', '250', true],
    ['=', '250', true],
    ['=', '251', false],
    ['<=', '250', true],
    ['<', '250', false],
    ['<', '251', true]
  ] as const)('Weight %s %s -> %s for a 250g bag', (op, a, expected) => {
    const c = coffee({ amount_g: 250 });
    expect(applyFilters([c], [range('amount_g', op, a)])).toEqual(expected ? [c] : []);
  });

  it('between is inclusive at both ends', () => {
    const low = coffee({ amount_g: 200 });
    const high = coffee({ amount_g: 300 });
    const out = coffee({ amount_g: 301 });
    expect(applyFilters([low, high, out], [range('amount_g', 'between', '200', '300')])).toEqual([low, high]);
  });

  it('cost/g compares at displayed precision', () => {
    const shownAsDime = coffee({ cost_per_gram: 0.0996 }); // displays $0.100
    const shown085 = coffee({ cost_per_gram: 0.08504 }); // displays $0.085
    expect(applyFilters([shownAsDime], [range('cost_per_gram', '<', '0.100')])).toEqual([]);
    expect(applyFilters([shownAsDime], [range('cost_per_gram', '=', '0.1')])).toEqual([shownAsDime]);
    expect(applyFilters([shownAsDime], [range('cost_per_gram', '<=', '0.10')])).toEqual([shownAsDime]);
    expect(applyFilters([shown085], [range('cost_per_gram', '=', '0.085')])).toEqual([shown085]);
    expect(applyFilters([shown085], [range('cost_per_gram', '=', '0.0849')])).toEqual([shown085]);
  });

  it('weight and urgency compare as whole numbers', () => {
    const u = coffee({ urgency_rating: 39.6, amount_g: 249.6 }); // displays 40 / 250
    expect(applyFilters([u], [range('urgency', '=', '40')])).toEqual([u]);
    expect(applyFilters([u], [range('urgency', '<', '40')])).toEqual([]);
    expect(applyFilters([u], [range('urgency', '>', '39')])).toEqual([u]);
    expect(applyFilters([u], [range('amount_g', '=', '250')])).toEqual([u]);
  });

  it("'Done' urgency never matches", () => {
    const done = coffee({ urgency_rating: 'Done' });
    expect(applyFilters([done], [range('urgency', '>=', '-1000')])).toEqual([]);
    expect(applyFilters([done], [range('urgency', 'between', '-1000', '1000')])).toEqual([]);
  });

  it('missing numbers never match', () => {
    const c = coffee({ cost_per_gram: null, amount_g: null });
    expect(applyFilters([c], [range('cost_per_gram', '>=', '0')])).toEqual([]);
    expect(applyFilters([c], [range('amount_g', '<=', '100000')])).toEqual([]);
  });

  it.each([
    ['>', '2026-09-10', false],
    ['>', '2026-09-09', true],
    ['>=', '2026-09-10', true],
    ['=', '2026-09-10', true],
    ['<=', '2026-09-10', true],
    ['<', '2026-09-10', false],
    ['<', '2026-09-11', true]
  ] as const)('Roast date %s %s -> %s for 2026-09-10', (op, a, expected) => {
    const c = coffee({ roast_date: '2026-09-10' });
    expect(applyFilters([c], [range('roast_date', op, a)])).toEqual(expected ? [c] : []);
  });

  it('date between is inclusive; missing dates never match', () => {
    const first = coffee({ roast_date: '2026-09-01' });
    const last = coffee({ roast_date: '2026-09-15' });
    const none = coffee({ roast_date: null });
    expect(applyFilters([first, last, none], [range('roast_date', 'between', '2026-09-01', '2026-09-15')])).toEqual([
      first,
      last
    ]);
  });

  it('frozen and unfrozen date columns read their own fields', () => {
    const c = coffee({ frozen_start_date: '2026-09-02', frozen_end_date: '2026-09-20' });
    expect(applyFilters([c], [range('frozen_start_date', '=', '2026-09-02')])).toEqual([c]);
    expect(applyFilters([c], [range('frozen_end_date', '=', '2026-09-20')])).toEqual([c]);
    expect(applyFilters([coffee()], [range('frozen_end_date', '<=', '2030-01-01')])).toEqual([]);
  });

  it('rest window includes a date, end days counting', () => {
    const c = coffee({ drink_after: '2026-10-01', drink_before: '2026-10-10' });
    const inc = (a: string): Filter => ({ column: 'rest_window', mode: 'includes', a });
    expect(applyFilters([c], [inc('2026-10-01')])).toEqual([c]);
    expect(applyFilters([c], [inc('2026-10-10')])).toEqual([c]);
    expect(applyFilters([c], [inc('2026-09-30')])).toEqual([]);
    expect(applyFilters([c], [inc('2026-10-11')])).toEqual([]);
  });

  it('rest window overlaps a range, end days counting', () => {
    const c = coffee({ drink_after: '2026-10-01', drink_before: '2026-10-10' });
    const ov = (a: string, b: string): Filter => ({ column: 'rest_window', mode: 'overlaps', a, b });
    expect(applyFilters([c], [ov('2026-09-20', '2026-10-01')])).toEqual([c]);
    expect(applyFilters([c], [ov('2026-10-10', '2026-10-20')])).toEqual([c]);
    expect(applyFilters([c], [ov('2026-10-03', '2026-10-04')])).toEqual([c]);
    expect(applyFilters([c], [ov('2026-09-20', '2026-09-30')])).toEqual([]);
    expect(applyFilters([c], [ov('2026-10-11', '2026-10-20')])).toEqual([]);
  });

  it('rest window needs both dates', () => {
    const c = coffee({ drink_after: '2026-10-01', drink_before: null });
    expect(applyFilters([c], [{ column: 'rest_window', mode: 'includes', a: '2026-10-01' }])).toEqual([]);
    expect(applyFilters([c], [{ column: 'rest_window', mode: 'overlaps', a: '2026-01-01', b: '2026-12-31' }])).toEqual([]);
  });

  it('different columns combine with AND', () => {
    const match = coffee({ origin: 'Kenya', decaf: 0 });
    const peru = coffee({ origin: 'Peru', decaf: 0 });
    const decaf = coffee({ origin: 'Kenya', decaf: 1 });
    const filters: Filter[] = [
      { column: 'origin', mode: 'any', values: ['Kenya', 'Peru'] },
      { column: 'decaf', mode: 'bool', value: false },
      { column: 'processing', mode: 'contains', text: 'wash' }
    ];
    expect(applyFilters([match, peru, decaf], filters)).toEqual([match, peru]);
    expect(applyFilters([match, peru, decaf], [...filters, range('amount_g', '=', '250')])).toEqual([
      match,
      peru
    ]);
    expect(
      applyFilters([match, peru], [{ column: 'origin', mode: 'any', values: ['Kenya'] }, filters[1]])
    ).toEqual([match]);
  });
});

describe('normalizeFilter', () => {
  it('swaps a reversed date between and overlaps', () => {
    expect(normalizeFilter(range('roast_date', 'between', '2026-09-15', '2026-09-01'))).toEqual(
      range('roast_date', 'between', '2026-09-01', '2026-09-15')
    );
    expect(normalizeFilter({ column: 'rest_window', mode: 'overlaps', a: '2026-10-10', b: '2026-10-01' })).toEqual({
      column: 'rest_window',
      mode: 'overlaps',
      a: '2026-10-01',
      b: '2026-10-10'
    });
  });

  it('normalizeFilter swaps numerically, not as text', () => {
    expect(normalizeFilter(range('amount_g', 'between', '300', '200'))).toEqual(range('amount_g', 'between', '200', '300'));
    expect(normalizeFilter(range('amount_g', 'between', '90', '100'))).toEqual(range('amount_g', 'between', '90', '100'));
  });

  it('a swapped between still matches inclusively', () => {
    const c = coffee({ amount_g: 300 });
    expect(applyFilters([c], [normalizeFilter(range('amount_g', 'between', '300', '200'))])).toEqual([c]);
  });

  it('trims Contains text', () => {
    expect(normalizeFilter({ column: 'origin', mode: 'contains', text: '  kenya ' })).toEqual({
      column: 'origin',
      mode: 'contains',
      text: 'kenya'
    });
  });
});

describe('valueCounts', () => {
  it('counts values, sorts case-insensitively, puts (none) last', () => {
    const list = [
      coffee({ origin: 'kenya' }),
      coffee({ origin: 'Ethiopia' }),
      coffee({ origin: 'Ethiopia' }),
      coffee({ origin: null }),
      coffee({ origin: 'Brazil' })
    ];
    expect(valueCounts(list, 'origin')).toEqual([
      { value: 'Brazil', count: 1 },
      { value: 'Ethiopia', count: 2 },
      { value: 'kenya', count: 1 },
      { value: null, count: 1 }
    ]);
  });

  it('omits (none) when nothing is missing', () => {
    expect(valueCounts([coffee({ origin: 'Kenya' })], 'origin')).toEqual([{ value: 'Kenya', count: 1 }]);
  });

  it('valueCounts folds blank strings into (none)', () => {
    expect(valueCounts([coffee({ origin: '' }), coffee({ origin: null })], 'origin')).toEqual([{ value: null, count: 2 }]);
  });

  it('valueCounts keeps selected values missing from the list', () => {
    expect(valueCounts([coffee({ origin: 'Kenya' })], 'origin', ['Peru', null, 'Kenya'])).toEqual([
      { value: 'Kenya', count: 1 },
      { value: 'Peru', count: 0 },
      { value: null, count: 0 }
    ]);
  });
});

describe('isComplete', () => {
  it('requires a value for every kind', () => {
    expect(isComplete({ column: 'origin', mode: 'any', values: [] })).toBe(false);
    expect(isComplete({ column: 'origin', mode: 'any', values: [null] })).toBe(true);
    expect(isComplete({ column: 'origin', mode: 'contains', text: '   ' })).toBe(false);
    expect(isComplete({ column: 'origin', mode: 'contains', text: 'ke' })).toBe(true);
    expect(isComplete({ column: 'decaf', mode: 'bool', value: false })).toBe(true);
    expect(isComplete(range('amount_g', '>', ''))).toBe(false);
    expect(isComplete(range('amount_g', '>', '0'))).toBe(true);
    expect(isComplete(range('amount_g', 'between', '1', ''))).toBe(false);
    expect(isComplete(range('amount_g', 'between', '1', '2'))).toBe(true);
    expect(isComplete({ column: 'rest_window', mode: 'includes', a: '' })).toBe(false);
    expect(isComplete({ column: 'rest_window', mode: 'overlaps', a: '2026-10-01', b: '' })).toBe(false);
    expect(isComplete({ column: 'rest_window', mode: 'overlaps', a: '2026-10-01', b: '2026-10-02' })).toBe(true);
  });
});

describe('upsertFilter', () => {
  it('replaces the same column in place, otherwise appends', () => {
    const origin: Filter = { column: 'origin', mode: 'any', values: ['Kenya'] };
    const decaf: Filter = { column: 'decaf', mode: 'bool', value: false };
    const origin2: Filter = { column: 'origin', mode: 'contains', text: 'ken' };
    expect(upsertFilter([origin], decaf)).toEqual([origin, decaf]);
    expect(upsertFilter([origin, decaf], origin2)).toEqual([origin2, decaf]);
  });
});

describe('QUICK_FILTERS', () => {
  it('Caffeinated (decaf) and Frozen switches: "All" first, then both bool values, matching column labels', () => {
    expect(quickFilter('decaf').switchLabel).toBe('Caffeinated');
    expect(quickFilter('decaf').segments.map((s) => [s.value, s.label])).toEqual([
      [null, 'All'],
      [false, 'Caffeinated only'],
      [true, 'Decaf only']
    ]);
    expect(quickFilter('frozen').switchLabel).toBe('Frozen');
    expect(quickFilter('frozen').segments.map((s) => [s.value, s.label])).toEqual([
      [null, 'All'],
      [true, 'Frozen only'],
      [false, 'Not frozen']
    ]);
    // "All" never has a chip.
    for (const qf of QUICK_FILTERS) expect(qf.segments[0].chipTitle).toBeUndefined();
  });
});

describe('chipLabel', () => {
  it.each<[Filter, string]>([
    [{ column: 'origin', mode: 'any', values: ['Ethiopia', 'Kenya'] }, 'Origin: Ethiopia, Kenya'],
    [{ column: 'origin', mode: 'any', values: ['Ethiopia', 'Kenya', 'Peru', 'Brazil', null] }, 'Origin: Ethiopia, Kenya +3'],
    [{ column: 'origin', mode: 'any', values: [null] }, 'Origin: (none)'],
    [{ column: 'processing', mode: 'contains', text: 'washed' }, 'Process: *washed*'],
    [{ column: 'processing', mode: 'any', values: ['Washed'] }, 'Process: Washed'],
    [{ column: 'coffee_name', mode: 'contains', text: 'guji' }, 'Name: *guji*'],
    [{ column: 'roast_level', mode: 'any', values: ['Light'] }, 'Roast: Light'],
    [{ column: 'roaster', mode: 'any', values: ['Sey'] }, 'Roaster: Sey'],
    [{ column: 'decaf', mode: 'bool', value: false }, 'Caffeinated: Caffeinated only'],
    [{ column: 'decaf', mode: 'bool', value: true }, 'Caffeinated: Decaf only'],
    [{ column: 'frozen', mode: 'bool', value: true }, 'Frozen: Frozen only'],
    [{ column: 'frozen', mode: 'bool', value: false }, 'Frozen: Not frozen'],
    [range('urgency', '>', '40'), 'Urgency: > 40'],
    [range('cost_per_gram', '<=', '0.10'), 'Cost/g: ≤ $0.10'],
    [range('amount_g', '=', '250'), 'Weight: 250g'],
    [range('amount_g', '>=', '250'), 'Weight: ≥ 250g'],
    [range('amount_g', '<', '250'), 'Weight: < 250g'],
    [range('amount_g', 'between', '200', '300'), 'Weight: 200g–300g'],
    [range('roast_date', '>=', '2026-09-01'), 'Roasted: ≥ 09/01/26'],
    [range('roast_date', '=', '2026-09-01'), 'Roasted: 09/01/26'],
    [range('roast_date', 'between', '2026-09-01', '2026-09-15'), 'Roasted: 09/01–09/15/26'],
    [range('roast_date', 'between', '2025-12-20', '2026-01-05'), 'Roasted: 12/20/25–01/05/26'],
    [range('frozen_start_date', '>', '2026-09-01'), 'Frozen on: > 09/01/26'],
    [range('frozen_end_date', '<', '2026-09-01'), 'Thawed: < 09/01/26'],
    [{ column: 'rest_window', mode: 'includes', a: '2026-10-01' }, 'Rest: 10/01/26'],
    [{ column: 'rest_window', mode: 'overlaps', a: '2026-10-01', b: '2026-10-10' }, 'Rest: 10/01–10/10/26'],
    // Chip values are formatted, not shown as typed (real-phone feedback: `.1` typed for
    // cost/g rendered as "> $.1" instead of "> $0.10").
    [range('cost_per_gram', '>', '.1'), 'Cost/g: > $0.10'],
    [range('cost_per_gram', '=', '0.085'), 'Cost/g: $0.085'],
    [range('amount_g', '>', '250.4'), 'Weight: > 250g'],
    [range('amount_g', 'between', '250.0', '300.4'), 'Weight: 250g–300g'],
    [range('urgency', '=', '40.0'), 'Urgency: 40']
  ])('%j -> %s', (f, expected) => {
    expect(chipLabel(f)).toBe(expected);
  });
});

describe('chipTitle', () => {
  it.each<[Filter, string]>([
    [{ column: 'processing', mode: 'contains', text: 'washed' }, 'Processing contains "washed"'],
    [{ column: 'origin', mode: 'any', values: ['Ethiopia', 'Kenya', 'Peru', null] }, 'Origin is any of Ethiopia, Kenya, Peru, (none)'],
    [{ column: 'decaf', mode: 'bool', value: false }, 'Showing caffeinated coffees only'],
    [{ column: 'decaf', mode: 'bool', value: true }, 'Showing decaf coffees only'],
    [{ column: 'frozen', mode: 'bool', value: true }, 'Showing frozen coffees only'],
    [{ column: 'frozen', mode: 'bool', value: false }, 'Showing coffees not in the freezer'],
    [range('cost_per_gram', '<=', '0.10'), 'Cost/g at most $0.10'],
    [range('amount_g', '=', '250'), 'Weight equals 250g'],
    [range('urgency', '>', '40'), 'Urgency greater than 40'],
    [range('urgency', 'between', '20', '40'), 'Urgency between 20 and 40'],
    [range('roast_date', '>=', '2026-09-01'), 'Roast date on or after Sep 1, 2026'],
    [range('roast_date', 'between', '2026-09-01', '2026-09-15'), 'Roast date between Sep 1 – Sep 15, 2026'],
    [range('cost_per_gram', '>', '.1'), 'Cost/g greater than $0.10'],
    [range('cost_per_gram', '=', '0.085'), 'Cost/g equals $0.085'],
    [range('amount_g', '>', '250.4'), 'Weight greater than 250g'],
    [range('amount_g', 'between', '250.0', '300.4'), 'Weight between 250g and 300g'],
    [range('urgency', '=', '40.0'), 'Urgency equals 40'],
    [{ column: 'rest_window', mode: 'includes', a: '2026-10-01' }, 'Rest window includes Oct 1, 2026'],
    [{ column: 'rest_window', mode: 'overlaps', a: '2026-10-01', b: '2026-10-10' }, 'Rest window overlaps Oct 1 – Oct 10, 2026'],
    [
      { column: 'rest_window', mode: 'overlaps', a: '2025-12-20', b: '2026-01-05' },
      'Rest window overlaps Dec 20, 2025 – Jan 5, 2026'
    ]
  ])('%j -> %s', (f, expected) => {
    expect(chipTitle(f)).toBe(expected);
  });
});

describe('In Bean Conqueror quick filter', () => {
  it('Yes/No reads in_bean_conqueror', () => {
    const linked = coffee({ in_bean_conqueror: 1 });
    const unlinked = coffee({ in_bean_conqueror: 0 });
    expect(applyFilters([linked, unlinked], [{ column: 'bc', mode: 'bool', value: true }])).toEqual([linked]);
    expect(applyFilters([linked, unlinked], [{ column: 'bc', mode: 'bool', value: false }])).toEqual([unlinked]);
  });
  it('is the third quick filter: All / Yes / No', () => {
    expect(QUICK_FILTERS.map((q) => q.column)).toEqual(['decaf', 'frozen', 'bc']);
    expect(quickFilter('bc').switchLabel).toBe('In Bean Conqueror');
    expect(quickFilter('bc').segments.map((s) => [s.value, s.label])).toEqual([[null, 'All'], [true, 'Yes'], [false, 'No']]);
    expect(chipLabel({ column: 'bc', mode: 'bool', value: true })).toBe('In Bean Conqueror: Yes');
    expect(chipTitle({ column: 'bc', mode: 'bool', value: false })).toBe('Showing coffees not in Bean Conqueror');
  });
});
