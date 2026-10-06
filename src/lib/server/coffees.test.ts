import { describe, it, expect, beforeEach } from 'vitest';
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
  type NewCoffeeInput
} from './coffees';
import { withComputedFields } from './urgency';
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
