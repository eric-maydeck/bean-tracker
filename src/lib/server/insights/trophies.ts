import type { DatabaseSync } from 'node:sqlite';
import { GEAR_KINDS, topSpecs, type GearKind, type GearValues } from '#lib/gear.ts';
import { backdrop } from '#lib/imageBackdrop.ts';
import { wallToInstant } from '#lib/localDate.ts';
import type { GearDetail } from '#lib/server/gearDetails.ts';
import { pooled, type Sample } from '#lib/sample.ts';
import { gearSlugs } from '#lib/slugify.ts';
import type { BrewFact } from './facts';
import { loadToolKinds, readGear, splitTools } from '../brewGear';
import { countsForRating } from './ratings';
import { daysBetween, inPeriod, type Period } from './time';
import type { Ratings } from '#lib/insightsUrl.ts';
import { statsLink } from '#lib/gearUrl.ts';
import type { LabOptions } from './lab';

export const RETIRED_AFTER_DAYS = 90;

// Archived names per kind (Bean Conqueror's archive flag), plus `added`: `${kind}\0${name}` -> the earliest Bean Conqueror
// created date (a wall-time 'YYYY-MM-DD...') of the gear's rows, the day we added that gear (a brew can predate it).
export type GearArchive = Record<GearKind, Set<string>> & { added?: Map<string, string>; adjustable?: Set<string>; tools?: Set<string> };
// adjustable: grinder names where any row has Bean Conqueror's adjustable-speed flag.

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
  const adjustable = new Set<string>();
  for (const r of db.prepare(`SELECT name, bc_archived AS a, bc_created_at AS c, has_adjustable_speed AS s FROM beanconqueror_grinders`).all() as { name: string; a: number; c: string | null; s: number }[]) {
    note('grinder', r.name, !!r.a, r.c);
    if (r.s && r.name) adjustable.add(r.name);
  }
  const kinds = loadToolKinds(db);
  for (const r of db.prepare(`SELECT m.name, m.preparation_tools AS tools, m.bc_archived AS a, m.bc_created_at AS c, (SELECT group_concat(t.name, char(31)) FROM beanconqueror_method_tools t WHERE t.method_id = m.id) AS mtools FROM beanconqueror_methods m`).all() as { name: string; tools: string | null; a: number; c: string | null; mtools: string | null }[]) {
    const mtools = splitTools(r.mtools);
    const { dripper, filter } = readGear(r.name, mtools, [], kinds, r.tools);
    note('dripper', dripper, !!r.a, r.c);
    note('filter', filter, !!r.a, r.c);
  }
  // Tool rows: archived when every row of the name is, under the tool's kind.
  for (const r of db.prepare(`SELECT name, archived AS a, bc_created_at AS c FROM beanconqueror_method_tools`).all() as { name: string; a: number; c: string | null }[]) {
    const name = splitTools(r.name)[0];
    if (name) note(kinds.get(name) === 'accessory' ? 'accessory' : 'filter', name, !!r.a, r.c);
  }
  const tools = new Set(kinds.keys());
  const out: GearArchive = { dripper: new Set(), grinder: new Set(), filter: new Set(), accessory: new Set(), added, adjustable, tools };
  for (const [k, v] of all) if (v) { const [kind, name] = k.split('\0'); out[kind as GearKind].add(name); }
  return out;
}

export interface Trophy {
  key: string; kind: GearKind; name: string; brews: number; grams: number;
  rating: number | null; best: number | null; sample: Sample; bags: number; days: number;
  firstUsed: string; lastUsed: string; favorite: { name: string; brews: number } | null;
  archived: boolean; retired: boolean; adjustableSpeed: boolean; // grinders only
  tool: boolean; // a Bean Conqueror tool (a filter or accessory): its Kind can be switched
  // Stored details (exact kind + name match); the picture is our copy, else the original URL, on its backdrop.
  values: GearValues; imageUrl: string | null; image: { src: string; fill: string } | null;
  // ISO instants (the page formats them in the browser's zone). Added: the earlier of Bean Conqueror's created time and the lifetime first brew
  // (both local wall time, converted); Updated: the stored row's last save.
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
      for (const name of kind === 'accessory' ? b.accessories ?? [] : [b[kind]]) {
        if (!name) continue;
        const k = `${kind}\0${name}`;
        if (!groups.has(k)) groups.set(k, { kind, name, all: [], xs: [] });
        const g = groups.get(k)!;
        g.all.push(b);
        if (inPeriod(b.localDate, period)) g.xs.push(b);
      }
    }
  const slugs = new Map(GEAR_KINDS.map((k) => [k, gearSlugs([...groups.values()].filter((g) => g.kind === k).map((g) => g.name))] as const));
  const withKind = (kind: GearKind) => (kind === 'dripper' ? 'filter' : 'dripper') as 'filter' | 'dripper'; // accessories pair with a dripper
  const out = [...groups.values()].filter((g) => g.xs.length).map(({ kind, name, all, xs }): Trophy => {
    const ratedXs = xs.filter((b) => ratingOf(b) !== null);
    const dates = xs.map((b) => b.localDate).sort();
    const life = all.map((b) => b.localDate).sort();
    const firstBrew = all.map((b) => b.localTime).sort()[0]; // 'YYYY-MM-DDTHH:mm'
    const partners = new Map<string, number[]>();
    for (const b of xs) {
      const p = b[withKind(kind)];
      if (!p) continue;
      if (!partners.has(p)) partners.set(p, []);
      const r = ratingOf(b);
      if (r !== null) partners.get(p)!.push(r);
    }
    const count = new Map<string, number>();
    for (const b of xs) { const p = b[withKind(kind)]; if (p) count.set(p, (count.get(p) ?? 0) + 1); }
    const fav = [...count].sort(([an, ac], [bn, bc]) =>
      bc - ac || (mean(partners.get(bn)!) ?? -1) - (mean(partners.get(an)!) ?? -1) || an.localeCompare(bn))[0];
    const archived = archive[kind].has(name), lastUsed = life.at(-1)!;
    const rs = ratedXs.map((b) => ratingOf(b)!);
    const sizedXs = xs.filter(sized);
    const ratedBags = new Set(sizedXs.map((b) => b.coffeeId).filter((c) => c != null)).size;
    const det = stored.get(`${kind}\0${name}`), src = det ? det.imageCopy ?? det.imageUrl : null;
    return {
      key: `${kind}-${slugs.get(kind)!.get(name)}`, kind, name, brews: xs.length,
      grams: xs.reduce((s, b) => s + (b.dose ?? 0), 0),
      rating: mean(rs), best: rs.length ? Math.max(...rs) : null,
      sample: pooled(ratedBags, sizedXs.length, rs.length),
      bags: new Set(xs.map((b) => b.coffeeId).filter((c) => c != null)).size,
      days: new Set(dates).size, firstUsed: life[0], lastUsed,
      favorite: fav ? { name: fav[0], brews: fav[1] } : null,
      values: det?.values ?? {}, imageUrl: det?.imageUrl ?? null, image: src ? { src, fill: backdrop(det!.imageFill) } : null,
      added: [archive.added?.get(`${kind}\0${name}`), firstBrew].filter((d): d is string => !!d).map(wallToInstant).sort()[0], updatedAt: det?.updatedAt ?? null,
      archived, tool: !!archive.tools?.has(name) && (kind === 'filter' || kind === 'accessory'), adjustableSpeed: kind === 'grinder' && !!archive.adjustable?.has(name), retired: archived || daysBetween(lastUsed, today) > RETIRED_AFTER_DAYS
    };
  });
  const order = (k: GearKind) => GEAR_KINDS.indexOf(k);
  return out.sort((a, b) => order(a.kind) - order(b.kind) || b.brews - a.brews || a.name.localeCompare(b.name));
}

// The Stats Gear tab's "Your gear" panel: every non-retired piece of gear, in showcase order, with what its card and tip show
// (photo or null, figures, up to 2 filled-in specs). Null when there is none.
export interface GearPanelCard {
  key: string; name: string; kind: GearKind; image: { src: string; fill: string } | null;
  rating: number | null; brews: number; grams: number; specs: [string, string][];
}
export function gearPanel(trophies: readonly Trophy[]): GearPanelCard[] | null {
  const cards = trophies.filter((t) => !t.retired && t.kind !== 'accessory').map((t) => ({
    key: t.key, name: t.name, kind: t.kind, image: t.image, rating: t.rating, brews: t.brews, grams: t.grams, specs: topSpecs(t, 2)
  }));
  return cards.length ? cards : null;
}

// The Stats link of every card, keyed by trophy key. A card exists only for gear with brews, and Stats' pickers list every brewed
// dripper, filter and grinder; a grinder's slug is the lab's own (the card's key slug if the lab lacks it).
export function statsLinks(trophies: readonly Trophy[], lab: LabOptions): Record<string, string> {
  return Object.fromEntries(trophies.map((t) => {
    const slug = t.kind === 'grinder' && lab.grinders.find((x) => x.name === t.name)?.slug;
    return [t.key, statsLink(slug ? { kind: 'grinder', key: `grinder-${slug}`, name: t.name } : t)];
  }));
}
