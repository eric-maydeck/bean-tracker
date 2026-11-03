import type { DatabaseSync } from 'node:sqlite';
import { getHouseholdSize } from '$lib/server/db';
import type { People } from '$lib/insightsUrl';
import { recapHref, recapYears } from '$lib/recapsUrl';
import { fmtInt } from '$lib/recapFormat';
import { md, POOL } from './pool';
import { personality } from './traits';
import { coverTone, order, select, tonesFor } from './select';
import { brewYears, freezeIds, frozenIds } from './store';
import type { Slide, Tone } from './types';
import { loadYear } from './year';

export interface Recap {
  year: number; preview: boolean; span: { from: string; to: string };
  slides: Slide[]; // facts in order, personality last (poster is rendered from these)
  cover: { title: string; sub: string; tone: Tone }; // the title slide: not a fact, no poster tile
  poster: { title: string; sub: string; footer: string };
  householdSize: number;
}

export function recap(db: DatabaseSync, year: number, o: { today: string; preview: boolean; people?: People; freeze?: false }): Recap | null {
  const householdSize = getHouseholdSize(db);
  const y = loadYear(db, year, o.today, o.preview, o.people === 'person' ? householdSize : 1);
  if (!y) return null;
  const facts = POOL.map((f) => f.run(y)).filter((r) => r !== null);
  const frozen = frozenIds(db, year);
  const fresh = frozen ? null : order(select(facts), year);
  // A racing first open may have frozen first: freezeIds returns what's stored.
  const ids = frozen ?? (o.preview || o.freeze === false ? fresh! : freezeIds(db, year, fresh!));
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
    cover: { title: `${year} in coffee`, sub: `${md(from)} to ${md(to)}`, tone: coverTone(year) },
    poster: {
      title: `${year} in coffee`,
      sub: `${slides.length} things your brewing said this year, ${md(from)} to ${md(to)}.`,
      footer: `Picked from ${fmtInt(y.brews.length)} brews across ${fmtInt(bags)} bags and ${fmtInt(roasters)} roasters.`
    }
  };
}

export interface RecapTileData { year: number; href: string; tone: Tone; preview: boolean; headlines: { big: string; label: string }[] }

// The Recaps tab/index years: open years newest first; an admin also gets the current year as a preview.
const tileYears = (db: DatabaseSync, today: string, isAdmin: boolean, period?: { start: string | null; end: string }): { year: number; preview: boolean }[] => {
  const ys = brewYears(db), cur = Number(today.slice(0, 4));
  return [...(isAdmin && ys.includes(cur) ? [{ year: cur, preview: true }] : []), ...recapYears(ys, today).map((year) => ({ year, preview: false }))]
    .filter(({ year }) => !period || (`${year}-12-31` >= (period.start ?? '') && `${year}-01-01` <= period.end)) // the year overlaps the Period
    .sort((a, b) => b.year - a.year);
};
export const hasRecaps = (db: DatabaseSync, today: string, isAdmin: boolean): boolean => tileYears(db, today, isAdmin).length > 0;

// A public viewer never gets a preview year. Tiles never freeze a year's ids (they read the frozen ones, else the would-be pick).
export function recapTiles(db: DatabaseSync, today: string, isAdmin: boolean, period?: { start: string | null; end: string }): RecapTileData[] {
  return tileYears(db, today, isAdmin, period).flatMap(({ year, preview }) => {
    const r = recap(db, year, { today, preview, freeze: false });
    // Total first, then the next fact(s) in the reel's order: 3 headlines (the personality slide only fills a short recap).
    return r ? [{ year, preview, tone: r.cover.tone,
      href: recapHref(year, preview ? { preview: true } : {}), headlines: r.slides.slice(0, 3).map((s) => s.card) }] : [];
  });
}
