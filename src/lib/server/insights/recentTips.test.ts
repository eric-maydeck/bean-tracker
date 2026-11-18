import { describe, it, expect } from 'vitest';
import { recent } from './overview';
import { cutNote } from './recentTips';
import type { BagFact, BrewFact } from './facts';

const brew = (o: Partial<BrewFact>): BrewFact => ({
  id: 0, coffeeId: 1, localTime: '', localDate: '2026-09-15', backfilled: false, dose: null, rating: null, roaster: null, origin: null,
  processGroup: 'Washed', roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover', waterG: null, ratio: null, grind: null, dripper: null, filter: null, water: null, waterProfile: null,
  restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, grinder: null, hasNote: false, brewIndex: 0, tempC: null, ...o
});
const bag = (o: Partial<BagFact>): BagFact => ({
  id: 1, status: 'open', purchaseDate: null, cost: null, amountG: null, roaster: 'Onyx', name: 'Kenya', slug: 'kenya', processing: null,
  origin: null, processGroup: 'Washed', roastLevel: null, decaf: false, firstBrew: null, lastBrew: null, bagRating: null, subscriptionId: null, ...o
});
const rows = (t: { rows?: string[][] }) => Object.fromEntries((t.rows ?? []).map(([l, v]) => [l, v]));

describe('recent tips', () => {
  const all = [
    brew({ id: 1, localTime: '2026-09-01T08:00', localDate: '2026-09-01', rating: 7, brewIndex: 1, restDays: 5 }),
    brew({ id: 2, localTime: '2026-09-02T08:00', localDate: '2026-09-02', rating: 9, brewIndex: 2 }),
    brew({
      id: 3, localTime: '2026-09-03T08:00', localDate: '2026-09-03', rating: 8, brewIndex: 3, restDays: 12, tempC: 91, grinder: 'Fellow Ode', grind: '5.2',
      rpm: 1100, dripper: 'V60', filter: 'Cafec', dose: 18, waterG: 300, ratio: 300 / 18, brewTimeSeconds: 185
    })
  ];
  const b = () => recent(all, [bag({})], 10, { all, extra: () => ({ brews: new Map([[3, { notes: 'x'.repeat(250), recipe: 'Hoffmann (modified)' }]]), bags: new Map() }) }).brews[0];

  it('carries the roaster and every known brew detail with units', () => {
    const r = b();
    expect(r.roaster).toBe('Onyx');
    expect(rows(r.tip)).toMatchObject({
      Roaster: 'Onyx', 'Age off roast': '12 days', 'Water temp': '91°C', Grinder: 'Fellow Ode', 'Grind setting': '5.2', 'Grinder RPM': '1100', Dripper: 'V60',
      Filter: 'Cafec', Coffee: '18g', Water: '300g', Ratio: '1:16.7', 'Brew time': '3:05', Brew: '3 of 3', Rank: '2nd best of 3', Recipe: 'Hoffmann (modified)'
    });
  });
  it('rating change vs the previous rated brew, signed with an ink class', () => {
    expect(b().tip.rows).toContainEqual(['Since previous brew', '−1.0', 'ink-worse']);
  });
  it('omits unknowns, and the change for a first brew', () => {
    const only = [brew({ id: 1, rating: 7, brewIndex: 1 })];
    const t = recent(only, [bag({})], 10, { all: only }).brews[0].tip;
    expect(Object.keys(rows(t))).toEqual(['Roaster', 'Brew']);
    expect(t.note).toBeUndefined();
  });
  it('cuts long notes at 200 chars with an ellipsis, collapsing whitespace', () => {
    expect(b().tip.note).toBe(`${'x'.repeat(200)}…`);
    expect(cutNote('a\n b')).toBe('a b');
  });
  it('a finished coffee tip: totals, cost, ages, best brew, averages, drippers, notes', () => {
    const done = bag({ status: 'archive', firstBrew: '2026-09-01', lastBrew: '2026-09-03', cost: 20, amountG: 250, purchaseDate: '2026-08-27', bagRating: 8.5, origin: 'Kenya', producer: 'Coop' });
    const withDose = all.map((x) => ({ ...x, dose: 15, dripper: 'V60' }));
    const t = recent(withDose, [done], 10, { all: withDose, dialIn: new Set([1]), extra: () => ({ brews: new Map(), bags: new Map([[1, { farm: 'Karimikui', notes: 'good' }]]) }) }).bags[0].tip;
    expect(rows(t)).toMatchObject({
      Roaster: 'Onyx', Origin: 'Kenya', Farm: 'Karimikui', Producer: 'Coop', Brews: '3', Consumed: '45g', Cost: '$20.00', 'Cost per gram': '$0.0800/g',
      'Age at first brew': '5 days', 'Age when finished': '12 days', 'Best brew': '9.0 on 2026-09-02', 'Coffee rating': '8.5', 'Average brew': '8.0',
      'Average once dialed in': '8.5', Drippers: 'V60'
    });
    expect(t.note).toBe('good');
  });
});
