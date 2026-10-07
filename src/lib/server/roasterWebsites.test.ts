import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from './db';
import { createCoffee, type NewCoffeeInput } from './coffees';
import { toOrigin, setRoasterWebsite, getRoasterWebsite, backfillRoasterWebsites } from './roasterWebsites';

let db: DatabaseSync;
beforeEach(() => {
  db = createDb(':memory:');
});

const addCoffee = (roaster: string, product_url: string | null) =>
  createCoffee(db, {
    roaster, coffee_name: 'Kiambu', origin: null, roast_level: null, processing: null, amount_g: 250, cost: 20,
    roast_date: '2026-09-01', frozen_start_date: null, frozen_end_date: null, rest_days_low: null, rest_days_high: null,
    image_url: null, product_url
  } as NewCoffeeInput);

describe('toOrigin', () => {
  it('keeps only the origin of an http(s) URL', () => {
    expect(toOrigin('https://www.lume.coffee/products/kiambu?variant=1')).toBe('https://www.lume.coffee');
    expect(toOrigin('http://roaster.example/')).toBe('http://roaster.example');
  });
  it('adds https:// to a bare host and trims', () => {
    expect(toOrigin('  moonwake.coffee ')).toBe('https://moonwake.coffee');
    expect(toOrigin(' https://www.lume.coffee/shop ')).toBe('https://www.lume.coffee');
  });
  it('refuses empty, non-http and garbage', () => {
    for (const raw of [null, undefined, '', '  ', 'javascript:alert(1)', 'ftp://x.example', 'data:text/plain,hi', 'http://']) {
      expect(toOrigin(raw)).toBeNull();
    }
  });
});

describe('roaster websites', () => {
  it('upserts, matches case-insensitively, stores an origin', () => {
    expect(getRoasterWebsite(db, 'Lume')).toBeNull();
    setRoasterWebsite(db, 'Lume', 'https://lume.coffee/products/a');
    setRoasterWebsite(db, 'LUME', 'lumecoffee.com');
    expect(getRoasterWebsite(db, ' lume ')).toBe('https://lumecoffee.com');
  });
  it('throws on a value that is not a web address', () => {
    expect(() => setRoasterWebsite(db, 'Lume', 'javascript:alert(1)')).toThrow('Not a web address');
  });
});

describe('backfillRoasterWebsites', () => {
  it('takes the most common origin among the roaster’s product URLs', () => {
    addCoffee('Lume', 'https://lume.coffee/products/a');
    addCoffee('Lume', 'https://lume.coffee/products/b');
    addCoffee('Lume', 'https://www.beanhoard.example/lume-c');
    expect(backfillRoasterWebsites(db)).toBe(1);
    expect(getRoasterWebsite(db, 'Lume')).toBe('https://lume.coffee');
  });
  it('breaks a tie with the most recent coffee', () => {
    addCoffee('Lume', 'https://old.example/products/a');
    addCoffee('Lume', 'https://new.example/products/b');
    backfillRoasterWebsites(db);
    expect(getRoasterWebsite(db, 'Lume')).toBe('https://new.example');
  });
  it('groups roaster names case-insensitively into one row', () => {
    addCoffee('norml', 'https://normlppl.coffee/products/a');
    addCoffee('Norml', 'https://normlppl.coffee/products/b');
    expect(backfillRoasterWebsites(db)).toBe(1);
    expect(getRoasterWebsite(db, 'NORML')).toBe('https://normlppl.coffee');
  });
  it('never overwrites an existing row, and is idempotent', () => {
    setRoasterWebsite(db, 'Lume', 'https://lumecoffee.com');
    addCoffee('Lume', 'https://lume.coffee/products/a');
    addCoffee('Sey', 'https://seycoffee.com/products/a');
    expect(backfillRoasterWebsites(db)).toBe(1);
    expect(backfillRoasterWebsites(db)).toBe(0);
    expect(getRoasterWebsite(db, 'Lume')).toBe('https://lumecoffee.com');
  });
  it('skips coffees with no or an unusable product URL', () => {
    addCoffee('Lume', null);
    addCoffee('Sey', 'not a url');
    expect(backfillRoasterWebsites(db)).toBe(0);
  });
});
