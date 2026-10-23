import type { DatabaseSync } from 'node:sqlite';
import { GEAR_KINDS, type GearKind, type GearValues } from '$lib/gear';
import { backdrop } from '$lib/imageBackdrop';
import type { GearDetail } from '$lib/server/gearDetails';
import { pooled, type Sample } from '$lib/sample';
import { slugify } from '$lib/server/slug';
import { MIXED_FILTER, parseMethod, type BrewFact } from './facts';
import { countsForRating } from './ratings';
import { daysBetween, inPeriod, type Period } from './time';
import type { Ratings } from '$lib/insightsUrl';

export const RETIRED_AFTER_DAYS = 90;

// Archived names per kind (Bean Conqueror's archive flag), plus `added`: `${kind}\0${name}` -> the earliest Bean Conqueror
// created date (a wall-time 'YYYY-MM-DD...') of the gear's rows, the day we added that gear.
export type GearArchive = Record<GearKind, Set<string>> & { added?: Map<string, string> };

// A grinder is archived when every row of that name is; a dripper/filter when every method parsing to it is.
export function gearArchive(db: DatabaseSync): GearArchive {
  const all = new Map<string, boolean>(); // `${kind}\0${name}` -> every row archived so far
  const added = new Map<string, string>();
  const note = (kind: GearKind, name: string | null, archived: boolean, created: string | null) => {
    if (!name) return;
    const k = `${kind}\0${name}`;
    all.set(k, (all.get(k) ?? true) && archived);
    if (created && (!added.has(k) || created < added.get(k)!)) added.set(k, created);
  };
  for (const r of db.prepare(`SELECT name, bc_archived AS a, bc_created_at AS c FROM beanconqueror_grinders`).all() as { name: string; a: number; c: string | null }[])
    note('grinder', r.name, !!r.a, r.c);
  for (const r of db.prepare(`SELECT name, preparation_tools AS tools, bc_archived AS a, bc_created_at AS c FROM beanconqueror_methods`).all() as { name: string; tools: string | null; a: number; c: string | null }[]) {
    const { dripper, filter } = parseMethod(r.name, r.tools);
    note('dripper', dripper, !!r.a, r.c);
    note('filter', filter, !!r.a, r.c);
  }
  const out: GearArchive = { dripper: new Set(), grinder: new Set(), filter: new Set(), added };
  for (const [k, v] of all) if (v) { const [kind, name] = k.split('\0'); out[kind as GearKind].add(name); }
  return out;
}

export interface Trophy {
  key: string; kind: GearKind; name: string; brews: number; grams: number;
  rating: number | null; best: number | null; sample: Sample; bags: number; days: number;
  firstUsed: string; lastUsed: string; favorite: { name: string; brews: number } | null;
  archived: boolean; retired: boolean;
  // Stored details (exact kind + name match); the picture is our copy, else the original URL, on its backdrop.
  values: GearValues; imageUrl: string | null; image: { src: string; fill: string } | null;
  // Added: the day the gear was added (Bean Conqueror's created date, else its first brew, lifetime); Updated: the stored row's last save.
  added: string; updatedAt: string | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// What a card reads. Period scopes every count (brews, grams, bags, days, favorite) and the ratings; the Ratings and
// Brews switches reach only the ratings: `scored` is the brews with Once dialed applied (or the same brews),
// `ratings` the Calibrated / All cutoff (countsForRating). First/last used and Retired are lifetime. Coffees
// filters and the other brew filters never apply. Defaults: all time, every raw rating.
export interface TrophyScope { period?: Period; ratings?: Ratings; scored?: readonly BrewFact[] }

// One card per dripper, grinder and filter with a brew in the Period.
export function trophyCase(brews: readonly BrewFact[], archive: GearArchive, today: string, scope: TrophyScope = {}, details: readonly GearDetail[] = []): Trophy[] {
  const stored = new Map(details.map((d) => [`${d.kind}\0${d.name}`, d] as const));
  const period = scope.period ?? { start: null, end: today }, ratings = scope.ratings ?? 'all';
  const scoredRating = new Map((scope.scored ?? brews).map((b) => [b.id, b] as const));
  // A brew's rating for the cards: its scored copy's, if it counts under the Ratings setting.
  const ratingOf = (b: BrewFact): number | null => {
    const sb = scoredRating.get(b.id);
    return sb && countsForRating(sb, ratings) && sb.rating! > 0 ? sb.rating! : null;
  };
  // The sample counts rated brews before the dial-in skip (`rating ?? dialRating`, as bagSizes and the boards: user ruling
  // 2026-10-17), so Once dialed never knocks a card under the pooled rule; the average itself skips them.
  const sized = (b: BrewFact): boolean => {
    const sb = scoredRating.get(b.id);
    const r = sb ? (sb.rating ?? sb.dialRating ?? null) : null;
    return r !== null && r > 0 && countsForRating({ ...sb!, rating: r }, ratings);
  };
  const groups = new Map<string, { kind: GearKind; name: string; all: BrewFact[]; xs: BrewFact[] }>();
  for (const b of brews)
    for (const kind of GEAR_KINDS) {
      const name = b[kind];
      if (!name || name === MIXED_FILTER) continue;
      const k = `${kind}\0${name}`;
      if (!groups.has(k)) groups.set(k, { kind, name, all: [], xs: [] });
      const g = groups.get(k)!;
      g.all.push(b);
      if (inPeriod(b.localDate, period)) g.xs.push(b);
    }
  const withKind = (kind: GearKind) => (kind === 'dripper' ? 'filter' : 'dripper') as 'filter' | 'dripper';
  const out = [...groups.values()].filter((g) => g.xs.length).map(({ kind, name, all, xs }): Trophy => {
    const ratedXs = xs.filter((b) => ratingOf(b) !== null);
    const dates = xs.map((b) => b.localDate).sort();
    const life = all.map((b) => b.localDate).sort();
    const partners = new Map<string, number[]>();
    for (const b of xs) {
      const p = b[withKind(kind)];
      if (!p || p === MIXED_FILTER) continue;
      if (!partners.has(p)) partners.set(p, []);
      const r = ratingOf(b);
      if (r !== null) partners.get(p)!.push(r);
    }
    const count = new Map<string, number>();
    for (const b of xs) { const p = b[withKind(kind)]; if (p && p !== MIXED_FILTER) count.set(p, (count.get(p) ?? 0) + 1); }
    const fav = [...count].sort(([an, ac], [bn, bc]) =>
      bc - ac || (mean(partners.get(bn)!) ?? -1) - (mean(partners.get(an)!) ?? -1) || an.localeCompare(bn))[0];
    const archived = archive[kind].has(name), lastUsed = life.at(-1)!;
    const rs = ratedXs.map((b) => ratingOf(b)!);
    const sizedXs = xs.filter(sized);
    const ratedBags = new Set(sizedXs.map((b) => b.coffeeId).filter((c) => c != null)).size;
    const det = stored.get(`${kind}\0${name}`), src = det ? det.imageCopy ?? det.imageUrl : null;
    return {
      key: `${kind}-${slugify(name)}`, kind, name, brews: xs.length,
      grams: xs.reduce((s, b) => s + (b.dose ?? 0), 0),
      rating: mean(rs), best: rs.length ? Math.max(...rs) : null,
      sample: pooled(ratedBags, sizedXs.length, rs.length),
      bags: new Set(xs.map((b) => b.coffeeId).filter((c) => c != null)).size,
      days: new Set(dates).size, firstUsed: life[0], lastUsed,
      favorite: fav ? { name: fav[0], brews: fav[1] } : null,
      values: det?.values ?? {}, imageUrl: det?.imageUrl ?? null, image: src ? { src, fill: backdrop(det!.imageFill) } : null,
      added: archive.added?.get(`${kind}\0${name}`)?.slice(0, 10) ?? life[0], updatedAt: det?.updatedAt ?? null,
      archived, retired: archived || daysBetween(lastUsed, today) > RETIRED_AFTER_DAYS
    };
  });
  const order = (k: GearKind) => GEAR_KINDS.indexOf(k);
  return out.sort((a, b) => order(a.kind) - order(b.kind) || b.brews - a.brews || a.name.localeCompare(b.name));
}
