import type { DatabaseSync } from 'node:sqlite';
import { deltaInk } from '$lib/components/deltaColor';
import { formatGrams } from '$lib/grams';
import { usd } from '$lib/money';
import { mmss } from '$lib/recipes';
import type { BagFact, BrewFact } from './facts';
import { mean } from './stats';

// The part of TipBody's Tip these use (server modules don't import .svelte files); assignable to it.
type TipRow = [string, string] | [string, string, string];
export type Tip = { title: string; rows?: TipRow[]; note?: string };

// What Recent's rating tips need beyond the facts: text the facts don't carry, read for the shown rows only.
export type RecentExtra = {
  brews: Map<number, { notes?: string; recipe?: string }>;
  bags: Map<number, { farm?: string; notes?: string }>;
};
// `all`: every brew (the tips compare within a coffee whatever the page filters); `dialIn`: dialInIds; `day`: the account's date format.
export type RecentCtx = {
  all?: readonly BrewFact[]; dialIn?: ReadonlySet<number>; day?: (iso: string) => string;
  extra?: (brewIds: number[], bagIds: number[]) => RecentExtra;
};

export function recentExtra(db: DatabaseSync, brewIds: number[], bagIds: number[]): RecentExtra {
  const marks = (ids: number[]) => ids.map(() => '?').join(',');
  const out: RecentExtra = { brews: new Map(), bags: new Map() };
  if (brewIds.length)
    for (const r of db.prepare(
      `SELECT b.id, b.notes, rec.name recipe, x.how FROM beanconqueror_brews b
       LEFT JOIN brew_recipe_matches x ON x.brew_id = b.id LEFT JOIN recipes rec ON rec.id = x.recipe_id WHERE b.id IN (${marks(brewIds)})`
    ).all(...brewIds) as { id: number; notes: string | null; recipe: string | null; how: string | null }[])
      out.brews.set(r.id, { notes: r.notes?.trim() || undefined, recipe: r.recipe ? r.recipe + (r.how === 'modified' ? ' (modified)' : '') : undefined });
  if (bagIds.length)
    for (const r of db.prepare(
      `SELECT c.id, c.farm, (SELECT group_concat(trim(notes), char(10)) FROM beanconqueror_beans WHERE coffee_id = c.id AND trim(COALESCE(notes, '')) <> '') notes
       FROM coffees c WHERE c.id IN (${marks(bagIds)})`
    ).all(...bagIds) as { id: number; farm: string | null; notes: string | null }[])
      out.bags.set(r.id, { farm: r.farm?.trim() || undefined, notes: r.notes || undefined });
  return out;
}

const NOTE_MAX = 200;
export const cutNote = (s: string): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > NOTE_MAX ? `${t.slice(0, NOTE_MAX).trimEnd()}…` : t;
};
const g1 = (n: number) => `${+n.toFixed(1)}g`;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
const r1 = (n: number) => n.toFixed(1);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
// Rows from [label, value] pairs, skipping the unknown ones.
const rows = (xs: (TipRow | false | null | undefined | '')[]): TipRow[] => xs.filter((x): x is TipRow => !!x);
const row = (l: string, v: string | number | null | undefined): TipRow | null => (v === null || v === undefined || v === '' ? null : [l, String(v)]);
const rated = (b: BrewFact) => b.rating !== null && b.rating > 0;

export function brewTip(b: BrewFact, name: string | null, bag: BagFact | undefined, ctx: RecentCtx, x: { notes?: string; recipe?: string } | undefined): Tip {
  const day = ctx.day ?? ((d: string) => d);
  const same = b.coffeeId === null ? [] : (ctx.all ?? []).filter((o) => o.coffeeId === b.coffeeId);
  const prev = same.filter((o) => rated(o) && o.localTime < b.localTime).at(-1);
  const delta = rated(b) && prev ? b.rating! - prev.rating! : null;
  const ratedAll = same.filter(rated);
  const place = rated(b) ? 1 + ratedAll.filter((o) => o.rating! > b.rating!).length : 0;
  return {
    title: name ?? 'No coffee linked',
    rows: rows([
      row('Roaster', b.roaster ?? bag?.roaster),
      row('Roast date', bag?.purchaseDate && day(bag.purchaseDate)),
      b.restDays !== null && b.restDays >= 0 ? ['Age off roast', days(b.restDays)] : null,
      b.tempC !== null ? ['Water temp', `${+b.tempC.toFixed(1)}°C`] : null,
      row('Grinder', b.grinder),
      row('Grind setting', b.grind),
      b.rpm ? ['Grinder RPM', `${Math.round(b.rpm)}`] : null,
      row('Dripper', b.dripper),
      row('Filter', b.filter),
      b.dose ? ['Coffee', g1(b.dose)] : null,
      b.waterG ? ['Water', g1(b.waterG)] : null,
      b.ratio ? ['Ratio', `1:${r1(b.ratio)}`] : null,
      b.brewTimeSeconds ? ['Brew time', mmss(b.brewTimeSeconds)] : null,
      b.brewIndex && same.length ? ['Brew', `${b.brewIndex} of ${same.length}`] : null,
      place && ratedAll.length > 1 ? ['Rank', place === 1 ? `Best of ${ratedAll.length}` : `${ord(place)} best of ${ratedAll.length}`] : null,
      delta !== null ? ['Since previous brew', `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${r1(Math.abs(delta))}`, deltaInk(delta)] : null,
      row('Recipe', x?.recipe)
    ]),
    note: x?.notes ? cutNote(x.notes) : undefined
  };
}

export function bagTip(g: BagFact, ctx: RecentCtx, x: { farm?: string; notes?: string } | undefined): Tip {
  const day = ctx.day ?? ((d: string) => d);
  const mine = (ctx.all ?? []).filter((o) => o.coffeeId === g.id);
  const rs = mine.filter(rated);
  const best = rs.reduce<BrewFact | null>((m, o) => (!m || o.rating! > m.rating! ? o : m), null);
  const dialed = rs.filter((o) => !ctx.dialIn?.has(o.id));
  const consumed = mine.reduce((s, o) => s + (o.dose ?? 0), 0);
  const rest = (o: BrewFact | undefined) => (o?.restDays != null && o.restDays >= 0 ? days(o.restDays) : null);
  const drippers = [...new Set(mine.flatMap((o) => o.dripper ?? []))];
  return {
    title: g.name,
    rows: rows([
      row('Roaster', g.roaster),
      row('Origin', g.origin),
      row('Farm', x?.farm),
      row('Producer', g.producer),
      mine.length ? ['Brews', String(mine.length)] : null,
      consumed ? ['Consumed', g1(consumed)] : null,
      g.cost ? ['Cost', usd(g.cost)] : null,
      g.cost && g.amountG ? ['Cost per 100 g', usd((g.cost / g.amountG) * 100)] : null,
      row('Roast date', g.purchaseDate && day(g.purchaseDate)),
      row('Age at first brew', rest(mine[0])),
      row('Age when finished', rest(mine.at(-1))),
      best ? ['Best brew', `${r1(best.rating!)} on ${day(best.localDate)}`] : null,
      g.bagRating ? ['Coffee rating', r1(g.bagRating)] : null,
      rs.length ? ['Average brew', r1(mean(rs.map((o) => o.rating!)))] : null,
      dialed.length && dialed.length < rs.length ? ['Average once dialed in', r1(mean(dialed.map((o) => o.rating!)))] : null,
      drippers.length ? ['Drippers', drippers.join(', ')] : null
    ]),
    note: x?.notes ? cutNote(x.notes) : undefined
  };
}
