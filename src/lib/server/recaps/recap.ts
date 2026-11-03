import type { DatabaseSync } from 'node:sqlite';
import { getHouseholdSize } from '$lib/server/db';
import type { People } from '$lib/insightsUrl';
import { fmtInt } from '$lib/recapFormat';
import { md, POOL } from './pool';
import { personality } from './traits';
import { order, select, tonesFor } from './select';
import { freezeIds, frozenIds } from './store';
import type { Slide } from './types';
import { loadYear } from './year';

export interface Recap {
  year: number; preview: boolean; span: { from: string; to: string };
  slides: Slide[]; // facts in order, personality last (poster is rendered from these)
  cover: { title: string; sub: string }; // the title slide: not a fact, no poster tile
  poster: { title: string; sub: string; footer: string };
  householdSize: number;
}

export function recap(db: DatabaseSync, year: number, o: { today: string; preview: boolean; people?: People }): Recap | null {
  const householdSize = getHouseholdSize(db);
  const y = loadYear(db, year, o.today, o.preview, o.people === 'person' ? householdSize : 1);
  if (!y) return null;
  const facts = POOL.map((f) => f.run(y)).filter((r) => r !== null);
  const frozen = frozenIds(db, year);
  const fresh = frozen ? null : order(select(facts), year);
  // A racing first open may have frozen first: freezeIds returns what's stored.
  const ids = frozen ?? (o.preview ? fresh! : freezeIds(db, year, fresh!));
  const picked = ids.map((id) => facts.find((f) => f.id === id)).filter((f) => f !== undefined);
  const you = personality(y);
  const tones = tonesFor(picked.map((f) => f.id), year);
  const slides = [...picked, ...(you ? [you] : [])]
    .map(({ score: _score, ...s }) => ({ ...s, tone: tones[s.id] }) as Slide);
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
