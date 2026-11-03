import type { DatabaseSync } from 'node:sqlite';
import { getHouseholdSize } from '$lib/server/db';
import type { People } from '$lib/insightsUrl';
import { fmtInt } from '$lib/recapFormat';
import { md, POOL } from './pool';
import { personality } from './traits';
import type { Slide, Tone } from './types';
import { loadYear } from './year';

export interface Recap {
  year: number; preview: boolean; span: { from: string; to: string };
  slides: Slide[]; // facts in order, personality last (poster is rendered from these)
  cover: { title: string; sub: string }; // the title slide: not a fact, no poster tile
  poster: { title: string; sub: string; footer: string };
  householdSize: number;
}

// The mockup's tone per fact id. Ids it has no card for (producer ...) fall back to ink until Part 2 re-tones.
export const DEFAULT_TONES: Record<string, Tone> = {
  total: 'espresso', streak: 'red', hour: 'sun', decaf: 'plum', roaster: 'brown', origin: 'green',
  turn: 'blue', recipe: 'teal', ratio: 'amber', rest: 'violet', record: 'gold', price: 'ink', you: 'cream'
};

export function recap(db: DatabaseSync, year: number, o: { today: string; preview: boolean; people?: People }): Recap | null {
  const householdSize = getHouseholdSize(db);
  const y = loadYear(db, year, o.today, o.preview, o.people === 'person' ? householdSize : 1);
  if (!y) return null;
  const slides = [...POOL.map((f) => f.run(y)), personality(y)]
    .filter((r) => r !== null)
    .map(({ score: _score, ...s }) => ({ ...s, tone: DEFAULT_TONES[s.id] ?? 'ink' }) as Slide);
  const from = y.brews[0].localDate, to = y.brews.at(-1)!.localDate;
  const roasters = new Set(y.brews.map((b) => b.roaster)).size;
  const bags = new Set(y.brews.map((b) => b.coffeeId)).size;
  return {
    year, preview: o.preview, span: { from, to }, slides, householdSize,
    cover: { title: `${year} in coffee`, sub: `${md(from)} to ${md(to)}` },
    poster: {
      title: `${year} in coffee`,
      sub: `${slides.length} things your brewing said this year, ${md(from)} to ${md(to)}.`,
      footer: `Picked from ${fmtInt(y.brews.length)} brews across ${fmtInt(bags)} bags and ${fmtInt(roasters)} roasters.`
    }
  };
}
