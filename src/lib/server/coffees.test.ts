import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { setImageFill } from './imageFills';
import {
  createCoffee,
  updateCoffee,
  getBacklogCoffees,
  getOpenCoffees,
  getArchivedCoffees,
  getNonArchivedCoffees,
  getCoffeeById,
  getCoffeeBySlug,
  openCoffee,
  unopenCoffee,
  freezeCoffee,
  thawCoffee,
  archiveCoffee,
  restoreCoffee,
  deleteCoffee,
  getDistinctFieldValues,
  applyCoffeeFixes,
  type CoffeeFixBatch,
  type NewCoffeeInput
} from './coffees';
import { withComputedFields } from './urgency';
import { createSubscription } from './subscriptions';
import { setRoasterImage } from './roasterImages';

function sampleInput(overrides: Partial<NewCoffeeInput> = {}): NewCoffeeInput {
  return {
    roaster: 'Test Roasters',
    coffee_name: 'Sample Blend',
    origin: 'Ethiopia',
    roast_level: 'Light',
    processing: 'Washed',
    amount_g: 200,
    cost: 18,
    roast_date: '2026-01-01',
    frozen_start_date: null,
    frozen_end_date: null,
    rest_days_low: 10,
    rest_days_high: 20,
    image_url: null,
    ...overrides
  };
}

let db: DatabaseSync;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('createCoffee', () => {
  it('creates a coffee as backlog by default, with a generated slug', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(slug).toBe('2026-test-roasters-sample-blend');
    expect(getCoffeeById(db, id)?.slug).toBe(slug);
  });

  it('creates a coffee directly as open or archive when status is passed', () => {
    const { id } = createCoffee(db, { ...sampleInput(), status: 'archive' });
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.drank).toBe(1);
  });

  it('dedupes slugs for coffees with the same roaster/name/year', () => {
    const first = createCoffee(db, sampleInput());
    const second = createCoffee(db, sampleInput());
    expect(second.slug).toBe(`${first.slug}-2`);
  });

  it('defaults decaf to false when not specified', () => {
    const { id } = createCoffee(db, sampleInput());
    expect(getCoffeeById(db, id)?.decaf).toBe(0);
  });

  it('stores decaf as true when specified', () => {
    const { id } = createCoffee(db, { ...sampleInput(), decaf: true });
    expect(getCoffeeById(db, id)?.decaf).toBe(1);
  });
});

describe('getCoffeeBySlug', () => {
  it('returns the coffee with that slug', () => {
    const { slug } = createCoffee(db, sampleInput());
    expect(getCoffeeBySlug(db, slug)?.coffee_name).toBe('Sample Blend');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCoffeeBySlug(db, 'nope')).toBeUndefined();
  });
});

describe('createCoffee subscription_id', () => {
  it('stores the plan when sent, null otherwise', () => {
    const sub = createSubscription(db, { roaster_service: 'Sey', subscription_name: null, price: 30, bag_count: 1, amount_per_bag_g: 250, renewal_day: 1 });
    expect(getCoffeeById(db, createCoffee(db, sampleInput({ subscription_id: sub })).id)?.subscription_id).toBe(sub);
    expect(getCoffeeById(db, createCoffee(db, sampleInput()).id)?.subscription_id).toBeNull();
  });
});

describe('updateCoffee subscription_id', () => {
  it('sets it, keeps it when not sent, and clears it with null', () => {
    const sub = createSubscription(db, { roaster_service: 'Sey', subscription_name: null, price: 30, bag_count: 1, amount_per_bag_g: 250, renewal_day: 1 });
    const { id, slug } = createCoffee(db, sampleInput());
    updateCoffee(db, id, sampleInput({ subscription_id: sub }), slug);
    expect(getCoffeeById(db, id)?.subscription_id).toBe(sub);
    updateCoffee(db, id, sampleInput({ cost: 30 }), slug);
    expect(getCoffeeById(db, id)?.subscription_id).toBe(sub);
    updateCoffee(db, id, sampleInput({ subscription_id: null }), slug);
    expect(getCoffeeById(db, id)?.subscription_id).toBeNull();
  });
});

describe('updateCoffee', () => {
  it('overwrites the editable fields and the slug', () => {
    const { id } = createCoffee(db, sampleInput());
    updateCoffee(db, id, sampleInput({ coffee_name: 'Renamed Blend', cost: 22 }), 'custom-slug');
    const found = getCoffeeById(db, id);
    expect(found?.coffee_name).toBe('Renamed Blend');
    expect(found?.cost).toBe(22);
    expect(found?.slug).toBe('custom-slug');
  });

  it('updates decaf', () => {
    const { id, slug } = createCoffee(db, sampleInput());
    updateCoffee(db, id, { ...sampleInput(), decaf: true }, slug);
    expect(getCoffeeById(db, id)?.decaf).toBe(1);
  });
});

describe('status queries', () => {
  it('separates backlog, open, archive, and non-archived coffees', () => {
    createCoffee(db, sampleInput({ coffee_name: 'A' }));
    const { id: openId } = createCoffee(db, sampleInput({ coffee_name: 'B' }));
    openCoffee(db, openId);
    createCoffee(db, sampleInput({ coffee_name: 'C', status: 'archive' }));

    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(getOpenCoffees(db)).toHaveLength(1);
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getNonArchivedCoffees(db)).toHaveLength(2);
  });

  it('orders results by roaster then coffee name, case-insensitively', () => {
    createCoffee(db, sampleInput({ roaster: 'zeta roasters', coffee_name: 'Blend' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'Blend' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'apple' }));
    createCoffee(db, sampleInput({ roaster: 'Alpha Roasters', coffee_name: 'Banana' }));

    const names = getBacklogCoffees(db).map((c) => `${c.roaster}/${c.coffee_name}`);
    expect(names).toEqual([
      'Alpha Roasters/apple',
      'Alpha Roasters/Banana',
      'Alpha Roasters/Blend',
      'zeta roasters/Blend'
    ]);
  });
});

describe('deleteCoffee', () => {
  it('permanently removes the coffee', () => {
    const { id } = createCoffee(db, sampleInput());
    deleteCoffee(db, id);
    expect(getCoffeeById(db, id)).toBeUndefined();
    expect(getBacklogCoffees(db)).toHaveLength(0);
  });
});

describe('getDistinctFieldValues', () => {
  it('returns sorted, deduped, non-empty values for the given column', () => {
    createCoffee(db, sampleInput({ roaster: 'Shoebox' }));
    createCoffee(db, sampleInput({ roaster: 'Shoebox' }));
    createCoffee(db, sampleInput({ roaster: 'Lume' }));
    createCoffee(db, sampleInput({ roaster: 'Anchorhead', origin: null }));

    expect(getDistinctFieldValues(db, 'roaster')).toEqual(['Anchorhead', 'Lume', 'Shoebox']);
    expect(getDistinctFieldValues(db, 'origin')).toEqual(['Ethiopia']);
  });
});

describe('openCoffee', () => {
  it('moves backlog to open and sets opened_date', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.status).toBe('open');
    expect(found?.opened_date).not.toBeNull();
  });

  it('clears frozen_end_date to today if the coffee was frozen and not yet thawed', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
    openCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.frozen_start_date).not.toBeNull();
    expect(found?.frozen_end_date).not.toBeNull();
  });

  it('does not touch frozen_end_date if the coffee was never frozen', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
  });
});

describe('unopenCoffee', () => {
  it('moves an open coffee back to backlog and clears opened_date', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    unopenCoffee(db, id);
    const found = getCoffeeById(db, id);
    expect(found?.status).toBe('backlog');
    expect(found?.opened_date).toBeNull();
  });

  it('is a no-op on a coffee that is not open', () => {
    const { id } = createCoffee(db, sampleInput());
    unopenCoffee(db, id);
    expect(getCoffeeById(db, id)?.status).toBe('backlog');
  });
});

describe('freezeCoffee / thawCoffee', () => {
  it('sets frozen_start_date and frozen_end_date independently', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_start_date).not.toBeNull();
    expect(getCoffeeById(db, id)?.frozen_end_date).toBeNull();
    thawCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).not.toBeNull();
  });
});

describe("open/freeze/thaw record the local date, not UTC's", () => {
  afterEach(() => vi.useRealTimers());

  it('at 21:00 local (UTC already the next day) they record the local date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T03:00:00Z')); // 2026-10-13 21:00 MDT
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_start_date).toBe('2026-10-13');
    thawCoffee(db, id);
    expect(getCoffeeById(db, id)?.frozen_end_date).toBe('2026-10-13');
    const other = createCoffee(db, sampleInput({ coffee_name: 'Other' })).id;
    freezeCoffee(db, other);
    openCoffee(db, other); // thaws on open
    expect(getCoffeeById(db, other)?.frozen_end_date).toBe('2026-10-13');
  });
});

describe('archiveCoffee / restoreCoffee', () => {
  it('moves a coffee to archive and back to backlog', () => {
    const { id } = createCoffee(db, sampleInput());
    archiveCoffee(db, id);
    expect(getArchivedCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.moved_date).not.toBeNull();
    expect(getCoffeeById(db, id)?.drank).toBe(1);

    restoreCoffee(db, id);
    expect(getBacklogCoffees(db)).toHaveLength(1);
    expect(getCoffeeById(db, id)?.moved_date).toBeNull();
    expect(getCoffeeById(db, id)?.drank).toBe(0);
  });

  it('archives an open coffee directly', () => {
    const { id } = createCoffee(db, sampleInput());
    openCoffee(db, id);
    archiveCoffee(db, id);
    expect(getArchivedCoffees(db)).toHaveLength(1);
  });
});

describe('regression: frozen dates written by coffees.ts stay parseable by urgency.ts', () => {
  // urgency.ts's parseDate() splits on '-' expecting YYYY-MM-DD only; a full ISO
  // timestamp in frozen_start_date/frozen_end_date breaks it. These tests prove the
  // date format written by freeze/thaw/open round-trips through withComputedFields
  // without throwing.
  it('freezeCoffee writes a date-only frozen_start_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });

  it('thawCoffee writes a date-only frozen_end_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    thawCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });

  it('openCoffee auto-thaw writes a date-only frozen_end_date usable by withComputedFields', () => {
    const { id } = createCoffee(db, sampleInput());
    freezeCoffee(db, id);
    openCoffee(db, id);
    const row = getCoffeeById(db, id)!;
    expect(row.frozen_end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    let computed;
    expect(() => {
      computed = withComputedFields(row, new Date());
    }).not.toThrow();
    expect(computed!.urgency_rating === 'Done' || Number.isFinite(computed!.urgency_rating)).toBe(true);
  });
});

describe('product_url', () => {
  it('is stored on create, defaults to null, and is overwritten on update', () => {
    const { id, slug } = createCoffee(db, sampleInput({ product_url: 'https://a.coffee/products/x' }));
    expect(getCoffeeById(db, id)?.product_url).toBe('https://a.coffee/products/x');
    const { id: id2 } = createCoffee(db, sampleInput());
    expect(getCoffeeById(db, id2)?.product_url).toBeNull();
    updateCoffee(db, id, sampleInput({ product_url: 'https://b.coffee/products/y' }), slug);
    expect(getCoffeeById(db, id)?.product_url).toBe('https://b.coffee/products/y');
  });
});

describe('in_bean_conqueror on list rows', () => {
  it('is 1 only for coffees with a linked bean', () => {
    const db = createDb(':memory:');
    const a = createCoffee(db, sampleInput({ coffee_name: 'A' }));
    createCoffee(db, sampleInput({ coffee_name: 'B' }));
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b', 'A', 'x', ?)`).run(a.id);
    expect(getBacklogCoffees(db).map((c) => [c.coffee_name, c.in_bean_conqueror])).toEqual([['A', 1], ['B', 0]]);
  });
});

describe('roaster_image_url on list rows', () => {
  it("is the roaster's default, matched case-insensitively, on list and slug queries", () => {
    const { slug } = createCoffee(db, sampleInput({ roaster: 'norml', coffee_name: 'A' }));
    createCoffee(db, sampleInput({ roaster: 'Other', coffee_name: 'B' }));
    setRoasterImage(db, 'Norml', 'https://img.example/norml.png');
    expect(getBacklogCoffees(db).map((c) => [c.roaster, c.roaster_image_url])).toEqual([
      ['norml', 'https://img.example/norml.png'],
      ['Other', null]
    ]);
    expect(getCoffeeBySlug(db, slug)?.roaster_image_url).toBe('https://img.example/norml.png');
  });

  it('follows a changed default (live, not copied)', () => {
    createCoffee(db, sampleInput({ roaster: 'Norml', status: 'open' }));
    setRoasterImage(db, 'Norml', 'https://img.example/a.png');
    setRoasterImage(db, 'Norml', 'https://img.example/b.png');
    expect(getOpenCoffees(db)[0].roaster_image_url).toBe('https://img.example/b.png');
  });
});

describe('grams_left', () => {
  function setup(over: Partial<NewCoffeeInput> = {}, brews: number[] = [], link = true) {
    const { id, slug } = createCoffee(db, sampleInput({ amount_g: 250, status: 'open', ...over }));
    if (link) {
      db.prepare(`INSERT INTO beanconqueror_beans (id, name, imported_at, coffee_id) VALUES ('b', 'x', 'x', ?)`).run(id);
    }
    const brew = db.prepare(
      `INSERT INTO beanconqueror_brews (bc_created_at, bean_id, ground_coffee_g, imported_at) VALUES (?, 'b', ?, 'x')`
    );
    brews.forEach((g, i) => brew.run(`t${i}`, g));
    return getCoffeeBySlug(db, slug)?.grams_left;
  }

  it('is bag size minus brewed grams, rounded, on the coffee and list rows', () => {
    expect(setup({}, [18.2, 18.4])).toBe(213);
    expect(getOpenCoffees(db)[0].grams_left).toBe(213);
  });
  it('is the full bag when the linked bean has no brews', () => expect(setup()).toBe(250));
  it('floors at 0 when more was logged than the bag held', () => expect(setup({}, [200, 100])).toBe(0));
  it('is null when no bean is linked', () => expect(setup({}, [], false)).toBeNull());
  it('is null when the coffee is not open', () => expect(setup({ status: 'backlog' })).toBeNull());
  it('is null when the bag size is unknown', () => expect(setup({ amount_g: null })).toBeNull());
});

describe('save-time image dedupe', () => {
  const LOGO = 'https://img.example/norml.png';
  const image = (id: number) => getCoffeeById(db, id)?.image_url;
  beforeEach(() => setRoasterImage(db, 'Norml', LOGO));

  it("insert stores NULL when the image equals the roaster's default (trimmed, roaster case ignored)", () => {
    const { id } = createCoffee(db, sampleInput({ roaster: 'norml', image_url: `  ${LOGO} ` }));
    expect(image(id)).toBeNull();
  });

  it('insert keeps an image that differs, including only by URL case', () => {
    const a = createCoffee(db, sampleInput({ roaster: 'Norml', image_url: 'https://img.example/bag.png' }));
    const b = createCoffee(db, sampleInput({ roaster: 'Norml', image_url: LOGO.toUpperCase() }));
    expect(image(a.id)).toBe('https://img.example/bag.png');
    expect(image(b.id)).toBe(LOGO.toUpperCase());
  });

  it('update stores NULL for the default and keeps a different image', () => {
    const { id, slug } = createCoffee(db, sampleInput({ roaster: 'Norml' }));
    updateCoffee(db, id, sampleInput({ roaster: 'Norml', image_url: LOGO }), slug);
    expect(image(id)).toBeNull();
    updateCoffee(db, id, sampleInput({ roaster: 'Norml', image_url: 'https://img.example/bag.png' }), slug);
    expect(image(id)).toBe('https://img.example/bag.png');
  });

  it('stores the image unchanged when the roaster has no default', () => {
    const { id } = createCoffee(db, sampleInput({ roaster: 'Sey', image_url: LOGO }));
    expect(image(id)).toBe(LOGO);
  });
});

describe('image_fill on list rows', () => {
  it("is the displayed image's fill: its own, else the roaster default's", () => {
    const own = createCoffee(db, sampleInput({ roaster: 'Sey', coffee_name: 'A', image_url: 'https://img.example/bag.png' }));
    createCoffee(db, sampleInput({ roaster: 'Norml', coffee_name: 'B' }));
    createCoffee(db, sampleInput({ roaster: 'Other', coffee_name: 'C' }));
    setRoasterImage(db, 'Norml', 'https://img.example/logo.png');
    setRoasterImage(db, 'Sey', 'https://img.example/sey.png');
    setImageFill(db, 'https://img.example/bag.png', '#111111');
    setImageFill(db, 'https://img.example/logo.png', '#222222');
    setImageFill(db, 'https://img.example/sey.png', '#333333');
    expect(getBacklogCoffees(db).map((c) => [c.roaster, c.image_fill])).toEqual([
      ['Norml', '#222222'],
      ['Other', null],
      ['Sey', '#111111']
    ]);
    expect(getCoffeeBySlug(db, own.slug)?.image_fill).toBe('#111111');
  });

  it('is null while the displayed image has no fill yet', () => {
    createCoffee(db, sampleInput({ image_url: 'https://img.example/new.png', status: 'open' }));
    expect(getOpenCoffees(db)[0].image_fill).toBeNull();
  });
});

describe('image_copy', () => {
  const S = (over: Partial<NewCoffeeInput>) => createCoffee(db, sampleInput({ roaster: 'Norml', image_url: null, ...over })).slug;
  const copy = (url: string, kind: 'coffees' | 'roasters', file: string) =>
    db.prepare(`INSERT INTO image_copies (url, kind, file) VALUES (?, ?, ?)`).run(url, kind, file);

  it('own image with a copy -> /img/coffees/<file>', () => {
    const slug = S({ image_url: 'https://x/bag.png' });
    copy('https://x/bag.png', 'coffees', 'a.webp');
    expect(getCoffeeBySlug(db, slug)?.image_copy).toBe('/img/coffees/a.webp');
  });

  it('roaster default with a copy -> /img/roasters/<file>', () => {
    const slug = S({});
    setRoasterImage(db, 'Norml', 'https://x/logo.png');
    copy('https://x/logo.png', 'roasters', 'b.webp');
    expect(getCoffeeBySlug(db, slug)?.image_copy).toBe('/img/roasters/b.webp');
  });

  it("own image without a copy never borrows the roaster's copy", () => {
    const slug = S({ image_url: 'https://x/bag.png' });
    setRoasterImage(db, 'Norml', 'https://x/logo.png');
    copy('https://x/logo.png', 'roasters', 'b.webp');
    expect(getCoffeeBySlug(db, slug)?.image_copy).toBeNull();
  });

  it('a coffees-kind copy of the logo URL is not used for the roaster fallback', () => {
    const slug = S({});
    setRoasterImage(db, 'Norml', 'https://x/logo.png');
    copy('https://x/logo.png', 'coffees', 'c.webp');
    expect(getCoffeeBySlug(db, slug)?.image_copy).toBeNull();
  });
});

describe('applyCoffeeFixes (product page backfill)', () => {
  const M = 'product_page_backfill_test';
  const page = 'https://www.sey.coffee/products/kiambu';
  const bag = 'https://cdn.shopify.com/s/files/kiambu.jpg';
  const batch = (over: Partial<CoffeeFixBatch> = {}): CoffeeFixBatch => ({
    marker: M, fixes: [], websites: [], tavilyCalls: [], ...over
  });
  const marker = () => db.prepare(`SELECT 1 FROM app_meta WHERE key = ?`).get(M);
  const usage = () =>
    (db.prepare(`SELECT at FROM search_usage WHERE provider = 'tavily' ORDER BY at`).all() as { at: string }[]).map((r) => r.at);
  const sites = () => db.prepare(`SELECT roaster, url FROM roaster_websites ORDER BY roaster`).all();
  const add = () => createCoffee(db, sampleInput({ roaster: 'Sey', coffee_name: 'Kiambu' }));

  it('fills an empty product_url and image_url, keeps the slug, and sets the marker', () => {
    const { id, slug } = add();
    const r = applyCoffeeFixes(db, batch({ fixes: [
      { coffee_id: id, field: 'product_url', from: null, to: page },
      { coffee_id: id, field: 'image_url', from: null, to: bag }
    ] }));
    expect(r).toEqual({ fixed: 2, skipped: [], websites: 0, usage: 0 });
    expect(getCoffeeById(db, id)).toMatchObject({ product_url: page, image_url: bag, slug });
    expect(marker()).toBeTruthy();
  });

  it('fixes a roast_level to the roast_levels spelling, guarded by from', () => {
    const { id, slug } = add();
    db.prepare(`UPDATE coffees SET roast_level = 'Med/Light' WHERE id = ?`).run(id);
    const r = applyCoffeeFixes(db, batch({ fixes: [
      { coffee_id: id, roaster: 'Sey', field: 'roast_level', from: 'Med/Light', to: 'Medium/Light' },
      { coffee_id: id, roaster: 'Sey', field: 'roast_level', from: 'Light/Med', to: 'Light/Medium' }
    ] }));
    expect(r?.fixed).toBe(1);
    expect(r?.skipped[0]).toContain("roast_level is 'Medium/Light'");
    expect(getCoffeeById(db, id)).toMatchObject({ roast_level: 'Medium/Light', slug });
  });

  it('runs once: a second call with the same marker returns null and adds nothing', () => {
    const { id } = add();
    const b = batch({
      fixes: [{ coffee_id: id, field: 'product_url', from: null, to: page }],
      tavilyCalls: ['2026-10-07T10:00:00.000Z']
    });
    applyCoffeeFixes(db, b);
    db.prepare(`UPDATE coffees SET product_url = NULL WHERE id = ?`).run(id);
    expect(applyCoffeeFixes(db, b)).toBeNull();
    expect(getCoffeeById(db, id)?.product_url).toBeNull();
    expect(usage()).toHaveLength(1);
  });

  it('skips (not fatal) a fix whose field is no longer empty or whose coffee is gone; applies the rest', () => {
    const { id } = add();
    db.prepare(`UPDATE coffees SET product_url = 'https://mine.example/k' WHERE id = ?`).run(id);
    const r = applyCoffeeFixes(db, batch({ fixes: [
      { coffee_id: id, field: 'product_url', from: null, to: page },
      { coffee_id: id, field: 'image_url', from: null, to: bag },
      { coffee_id: 9999, field: 'product_url', from: null, to: page }
    ] }));
    expect(r?.fixed).toBe(1);
    expect(r?.skipped).toHaveLength(2);
    expect(r?.skipped[1]).toContain('coffee not found');
    expect(getCoffeeById(db, id)).toMatchObject({ product_url: 'https://mine.example/k', image_url: bag });
    expect(marker()).toBeTruthy();
  });

  it("skips a fix whose roaster differs: another DB's coffee with the same id isn't it", () => {
    const { id } = add();
    const r = applyCoffeeFixes(db, batch({ fixes: [
      { coffee_id: id, roaster: 'Ceto', field: 'product_url', from: null, to: page },
      { coffee_id: id, roaster: 'Sey', field: 'image_url', from: null, to: bag }
    ] }));
    expect(r?.fixed).toBe(1);
    expect(r?.skipped[0]).toContain("roaster is 'Sey'");
    expect(getCoffeeById(db, id)).toMatchObject({ product_url: null, image_url: bag });
  });

  it("matches '' and NULL exactly: from must be the stored empty value", () => {
    const a = add();
    const b = add();
    db.prepare(`UPDATE coffees SET product_url = '' WHERE id IN (?, ?)`).run(a.id, b.id);
    const r = applyCoffeeFixes(db, batch({ fixes: [
      { coffee_id: a.id, field: 'product_url', from: '', to: page },
      { coffee_id: b.id, field: 'product_url', from: null, to: page }
    ] }));
    expect(r?.fixed).toBe(1);
    expect(getCoffeeById(db, a.id)?.product_url).toBe(page);
    expect(getCoffeeById(db, b.id)?.product_url).toBe('');
  });

  it("stores NULL for an image equal to the roaster's default", () => {
    setRoasterImage(db, 'Sey', bag);
    const { id } = add();
    const r = applyCoffeeFixes(db, batch({ fixes: [{ coffee_id: id, field: 'image_url', from: null, to: bag }] }));
    expect(r?.fixed).toBe(1);
    expect(getCoffeeById(db, id)?.image_url).toBeNull();
  });

  it("stores a website's origin only when none is stored and the host looks like the roaster's", () => {
    add();
    const r = applyCoffeeFixes(db, batch({ websites: [
      { roaster: 'Sey', url: page },
      { roaster: 'Lume', url: 'https://reseller.example/products/lume-x' },
      { roaster: 'sey', url: 'https://sey.coffee/other' }
    ] }));
    expect(r?.websites).toBe(1);
    expect(sites()).toEqual([{ roaster: 'Sey', url: 'https://www.sey.coffee' }]);
  });

  it('never replaces a stored website (roaster case ignored)', () => {
    add();
    db.prepare(`INSERT INTO roaster_websites (roaster, url) VALUES ('sey', 'https://old.sey.coffee')`).run();
    expect(applyCoffeeFixes(db, batch({ websites: [{ roaster: 'Sey', url: page }] }))?.websites).toBe(0);
    expect(sites()).toEqual([{ roaster: 'sey', url: 'https://old.sey.coffee' }]);
  });

  it('adds one tavily search_usage row per recorded call', () => {
    add();
    const calls = ['2026-10-07T10:00:00.000Z', '2026-10-07T10:00:05.000Z'];
    expect(applyCoffeeFixes(db, batch({ tavilyCalls: calls }))?.usage).toBe(2);
    expect(usage()).toEqual(calls);
  });

  it('does nothing and sets no marker on a DB with no coffees', () => {
    expect(applyCoffeeFixes(db, batch({ tavilyCalls: ['2026-10-07T10:00:00.000Z'] }))).toBeNull();
    expect(marker()).toBeUndefined();
    expect(usage()).toEqual([]);
  });
});
