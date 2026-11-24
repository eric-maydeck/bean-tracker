import { describe, it, expect } from 'vitest';

// Own in-memory DB for this file (getDb is a DB_PATH-keyed singleton).
process.env.DB_PATH = ':memory:';

import { getDb } from '#lib/server/db.ts';
import { localToday } from '#lib/server/insights/time.ts';
import { loadFacts } from '#lib/server/insights/facts.ts';
import { trophyCase, gearArchive } from '#lib/server/insights/trophies.ts';
import { load } from './+page.server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = () => load({} as never) as any;

describe('/gear load', () => {
  it('an empty database has no trophies', () => {
    expect(run().trophies).toEqual([]);
  });

  it('returns the all-time trophies: brews match trophyCase with no period', () => {
    const db = getDb();
    const today = localToday();
    db.exec(`INSERT OR REPLACE INTO beanconqueror_methods (id, name, imported_at) VALUES ('m1', 'V60', '${today}')`);
    const ins = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, ground_coffee_g, rating, preparation_id, imported_at) VALUES (?, 15, 8, 'm1', ?)`);
    ins.run(`${today}T15:00:00.000Z`, today);
    ins.run('2020-01-01T15:00:00.000Z', today);
    const v60 = run().trophies.find((x: { key: string }) => x.key === 'dripper-v60');
    const all = trophyCase(loadFacts(db).brews, gearArchive(db), today).find((x) => x.key === 'dripper-v60')!;
    expect(v60.brews).toBe(2);
    expect(v60.brews).toBe(all.brews);
  });

  it('gives every card a Stats link, unrated grinders too', () => {
    const db = getDb();
    const today = localToday();
    db.exec(`INSERT OR REPLACE INTO beanconqueror_methods (id, name, imported_at) VALUES ('m9', 'Unrated Dripper', '${today}')`);
    db.exec(`INSERT OR REPLACE INTO beanconqueror_grinders (id, name, imported_at) VALUES ('g1', 'Rated Mill', '${today}'), ('g2', 'Unrated Mill', '${today}')`);
    const ins = db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, ground_coffee_g, rating, preparation_id, mill_id, imported_at) VALUES (?, 15, ?, ?, ?, ?)`);
    ins.run(`${today}T16:00:00.000Z`, null, 'm9', 'g2', today); // no rating
    ins.run(`${today}T16:00:01.000Z`, 8, 'm1', 'g1', today);
    const d = run();
    const key = (n: string) => d.trophies.find((x: { name: string }) => x.name === n).key;
    expect(d.statsLinks[key('Unrated Dripper')]).toBe('/stats?dripper=Unrated+Dripper');
    expect(d.statsLinks[key('Rated Mill')]).toBe('/stats?grinder=rated-mill');
    expect(d.statsLinks[key('Unrated Mill')]).toBe('/stats?grinder=unrated-mill');
  });

  it('doubleFilter counts brews with two filters ticked and links the first one\'s filter card; null when none', () => {
    const db = getDb();
    const today = localToday();
    expect(run().doubleFilter).toBeNull();
    db.exec(`INSERT OR REPLACE INTO beanconqueror_methods (id, name, imported_at) VALUES ('m30', 'Wave', '${today}')`);
    db.exec(`INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES ('ta', 'm30', 'Abaca'), ('tb', 'm30', 'Abaca+')`);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, ground_coffee_g, preparation_id, imported_at) VALUES ('bw1', ?, 15, 'm30', ?)`).run(`${today}T10:00:00.000Z`, today);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, ground_coffee_g, preparation_id, imported_at) VALUES ('bw2', ?, 15, 'm30', ?)`).run(`${today}T11:00:00.000Z`, today);
    // bw1 ticks both filters; bw2 only Abaca, so Abaca has a card to link to (a two-filter brew counts toward no filter card).
    db.exec(`INSERT INTO beanconqueror_brew_tools (brew_uuid, tool_uuid) VALUES ('bw1', 'ta'), ('bw1', 'tb'), ('bw2', 'ta')`);
    expect(run().doubleFilter).toEqual({ brews: 1, firstKey: 'filter-abaca' });
  });

  it('doubleFilter has no link when none of the two-filter brews\' filters has a card', () => {
    const db = getDb();
    db.exec(`DELETE FROM beanconqueror_brew_tools WHERE brew_uuid IN ('bw1', 'bw2')`);
    const today = localToday();
    db.exec(`INSERT OR REPLACE INTO beanconqueror_methods (id, name, imported_at) VALUES ('m31', 'Kalita', '${today}')`);
    db.exec(`INSERT INTO beanconqueror_method_tools (uuid, method_id, name) VALUES ('tc', 'm31', 'Zeta'), ('td', 'm31', 'Zeta+')`);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_uuid, bc_created_at, ground_coffee_g, preparation_id, imported_at) VALUES ('bw3', ?, 15, 'm31', ?)`).run(`${today}T12:00:00.000Z`, today);
    db.exec(`INSERT INTO beanconqueror_brew_tools (brew_uuid, tool_uuid) VALUES ('bw3', 'tc'), ('bw3', 'td')`);
    expect(run().doubleFilter).toEqual({ brews: 1, firstKey: null });
  });
});
