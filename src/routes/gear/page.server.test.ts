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
});
