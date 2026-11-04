import type { BrewFact } from '$lib/server/insights/facts';
import { addDays } from '$lib/server/insights/time';
import type { YearCtx } from './year';

let id = 0;
export const brew = (o: Partial<BrewFact> & { at: string }): BrewFact => {
  const { at, ...rest } = o;
  return {
    id: ++id, coffeeId: 1, localTime: at, localDate: at.slice(0, 10), backfilled: false, dose: 18, rating: 8,
    roaster: 'R', origin: null, processGroup: null, roastLevel: null, decaf: false, brewer: null, brewerType: 'pourover',
    waterG: 290, ratio: null, grind: null, dripper: null, filter: null, grinder: null, water: null, waterProfile: null,
    restDays: null, costPerBrew: null, brewTimeSeconds: null, bloomSeconds: null, hasNote: false, tempC: null, brewIndex: 0, ...rest
  } as unknown as BrewFact;
};
export const ctx = (brews: BrewFact[], o: Partial<YearCtx> = {}) =>
  ({ year: 2026, period: { start: '2026-01-01', end: '2026-12-31' }, today: '2027-02-01', preview: false, everyBrew: brews, bags: [], brews, scored: brews, size: 2, ...o }) as unknown as YearCtx;
export const days = (from: string, n: number, hh = '09') => Array.from({ length: n }, (_, i) => brew({ at: `${addDays(from, i)}T${hh}:15` }));
