import type { DatabaseSync } from 'node:sqlite';
import { processGroup, type ProcessGroup } from '$lib/processGroups';
import { generalHardness, carbonateHardness } from '$lib/water';
import type { BrewerType } from '$lib/insightsUrl';
import { bcLocalTime, daysBetween } from './time';

// Method names are "Dripper - Filter". Gabi Master A brews used Kalita,
// xBloom or Timemore 155 filters interchangeably (user, 2026-10-09), so its
// filter is MIXED_FILTER and filter comparisons leave it out.
export const MIXED_FILTER = '155 (mixed)';
const MIXED_FILTER_DRIPPERS = new Set(['Gabi Master A']);

export function parseMethod(name: string | null, tools: string | null): { dripper: string | null; filter: string | null } {
  if (!name) return { dripper: null, filter: null };
  if (MIXED_FILTER_DRIPPERS.has(name)) return { dripper: name, filter: MIXED_FILTER };
  const i = name.indexOf(' - ');
  if (i >= 0) return { dripper: name.slice(0, i).trim(), filter: name.slice(i + 3).trim() || null };
  return { dripper: name.trim(), filter: tools?.replace(/ filters$/i, '').trim() || null };
}

// Bean Conqueror's preparation style, except the OXO Rapid Brewer: styled ESPRESSO in BC but it
// brews soup (user, 2026-10-11).
const STYLE: Record<string, BrewerType> = { 'POUR OVER': 'pourover', ESPRESSO: 'espresso', 'FULL IMMERSION': 'immersion' };
export const brewerType = (name: string | null, style: string | null): BrewerType =>
  name && /oxo rapid brewer|\borb\b/i.test(name) ? 'soup' : (style && STYLE[style.toUpperCase()]) || 'other';

// A grind setting as numbers, for ordering within one grinder; malformed strings are skipped.
export function grindKey(grind: string | null): number[] | null {
  if (!grind || !/^\d+(\.\d+)*$/.test(grind.trim())) return null;
  return grind.trim().split('.').map(Number);
}

// Belt and braces next to the coffee_corrections_2026_10_b migration: a
// future stray label still sorts on the roast_levels scale.
const ROAST_LEVEL_ALIASES: Record<string, string> = { 'Light/Med': 'Light/Medium', 'Med/Light': 'Medium/Light' };
export const normalizeRoastLevel = (level: string | null): string | null => (level ? (ROAST_LEVEL_ALIASES[level] ?? level) : null);
// Every stored label that normalises to `level`: the level itself plus its aliases.
export const roastLevelLabels = (level: string): string[] => [
  level, ...Object.keys(ROAST_LEVEL_ALIASES).filter((a) => ROAST_LEVEL_ALIASES[a] === level)
];

// Days off roast at the brew, minus freezer days before it (an open freeze
// runs to the brew).
export function restDays(roastDate: string | null, frozenStart: string | null, frozenEnd: string | null, brewDate: string): number | null {
  if (!roastDate) return null;
  let rest = daysBetween(roastDate, brewDate);
  if (frozenStart && frozenStart < brewDate) {
    const end = frozenEnd && frozenEnd < brewDate ? frozenEnd : brewDate;
    rest -= Math.max(0, daysBetween(frozenStart, end));
  }
  return rest;
}

export const costPerBrew = (dose: number | null, cost: number | null, amountG: number | null): number | null =>
  dose && cost && amountG ? (dose * cost) / amountG : null;

// Bean Conqueror stores times as TEXT seconds, 0 when not entered.
export function seconds(text: string | null): number | null {
  const n = Number(text);
  return text && Number.isFinite(n) && n > 0 ? n : null;
}

export interface WaterProfile {
  calcium: number | null; magnesium: number | null; sodium: number | null; potassium: number | null;
  chloride: number | null; sulfate: number | null; gh: number; kh: number;
}
export interface BrewFact {
  id: number;
  coffeeId: number | null;
  localTime: string; // 'YYYY-MM-DDTHH:mm', Mountain Time
  localDate: string; // 'YYYY-MM-DD'
  backfilled: boolean; // stored on a whole hour (mm:ss 00:00): typed in later; hour charts skip it
  dose: number | null;
  rating: number | null;
  roaster: string | null;
  origin: string | null;
  processGroup: ProcessGroup;
  roastLevel: string | null;
  decaf: boolean;
  brewer: string | null; // full method name, e.g. "V60 - Cafec Abaca"
  brewerType: BrewerType;
  waterG: number | null; // water_amount_g; null when not entered
  ratio: number | null; // waterG / dose
  grind: string | null; // grind_setting, trimmed
  dripper: string | null;
  filter: string | null;
  grinder: string | null;
  water: string | null;
  waterProfile: WaterProfile | null;
  restDays: number | null;
  costPerBrew: number | null;
  brewTimeSeconds: number | null;
  bloomSeconds: number | null;
}
export interface BagFact {
  id: number;
  status: 'backlog' | 'open' | 'archive';
  purchaseDate: string | null; // = roast date
  cost: number | null;
  amountG: number | null;
  roaster: string;
  name: string;
  slug: string | null;
  processing: string | null; // raw label, for process-group links
  origin: string | null;
  processGroup: ProcessGroup;
  roastLevel: string | null;
  decaf: boolean;
  firstBrew: string | null; // local dates
  lastBrew: string | null;
}

interface BrewRow {
  id: number; bc_created_at: string; dose: number | null; rating: number | null; brew_time: string | null; bloom_time: string | null;
  method: string | null; tools: string | null; grinder: string | null; water: string | null; water_id: string | null;
  calcium: number | null; magnesium: number | null; sodium: number | null; potassium: number | null; chloride: number | null; sulfate: number | null;
  coffee_id: number | null; roaster: string | null; origin: string | null; processing: string | null; roast_level: string | null;
  decaf: number | null; roast_date: string | null; frozen_start_date: string | null; frozen_end_date: string | null;
  cost: number | null; amount_g: number | null; water_amount_g: number | null; grind_setting: string | null; style: string | null;
}

interface BagRow {
  id: number; status: BagFact['status']; roaster: string; coffee_name: string; slug: string | null; origin: string | null; processing: string | null;
  roast_level: string | null; decaf: number; roast_date: string | null; cost: number | null; amount_g: number | null;
}

// Every brew joined to its bean's coffee, method and water, plus every bag,
// loaded per request. Fine at today's size. If insights ever feel slow, see the
// performance note in docs/HANDOFF.md.
export function loadFacts(db: DatabaseSync): { brews: BrewFact[]; bags: BagFact[] } {
  const rows = db
    .prepare(
      `SELECT b.id, b.bc_created_at, b.ground_coffee_g AS dose, b.rating, b.brew_time, b.bloom_time,
              m.name AS method, m.preparation_tools AS tools, g.name AS grinder,
              COALESCE(w.name, b.water) AS water, w.id AS water_id,
              w.calcium, w.magnesium, w.sodium, w.potassium, w.chloride, w.sulfate,
              c.id AS coffee_id, c.roaster, c.origin, c.processing, c.roast_level, c.decaf, c.roast_date,
              c.frozen_start_date, c.frozen_end_date, c.cost, c.amount_g,
              b.water_amount_g, b.grind_setting, m.preparation_style AS style
       FROM beanconqueror_brews b
       LEFT JOIN beanconqueror_beans bean ON bean.id = b.bean_id
       LEFT JOIN coffees c ON c.id = bean.coffee_id
       LEFT JOIN beanconqueror_methods m ON m.id = b.preparation_id
       LEFT JOIN beanconqueror_grinders g ON g.id = b.mill_id
       LEFT JOIN beanconqueror_waters w ON w.id = b.water_id
       ORDER BY b.bc_created_at, b.id`
    )
    .all() as unknown as BrewRow[];

  const brews = rows.map((r): BrewFact => {
    // bc_created_at is local wall time despite its trailing 'Z' (see bcLocalTime).
    const localTime = bcLocalTime(r.bc_created_at);
    const localDate = localTime.slice(0, 10);
    const waterG = r.water_amount_g && r.water_amount_g > 0 ? r.water_amount_g : null;
    return {
      id: r.id,
      coffeeId: r.coffee_id,
      localTime,
      localDate,
      backfilled: r.bc_created_at.slice(14, 19) === '00:00',
      dose: r.dose,
      rating: r.rating,
      roaster: r.roaster,
      origin: r.origin,
      processGroup: processGroup(r.processing),
      roastLevel: normalizeRoastLevel(r.roast_level),
      decaf: r.decaf === 1,
      brewer: r.method,
      brewerType: brewerType(r.method, r.style),
      waterG,
      ratio: waterG && r.dose && r.dose > 0 ? waterG / r.dose : null,
      grind: r.grind_setting?.trim() || null,
      ...parseMethod(r.method, r.tools),
      grinder: r.grinder,
      water: r.water,
      waterProfile: r.water_id
        ? {
            calcium: r.calcium, magnesium: r.magnesium, sodium: r.sodium, potassium: r.potassium,
            chloride: r.chloride, sulfate: r.sulfate, gh: generalHardness(r), kh: carbonateHardness(r)
          }
        : null,
      restDays: restDays(r.roast_date, r.frozen_start_date, r.frozen_end_date, localDate),
      costPerBrew: costPerBrew(r.dose, r.cost, r.amount_g),
      brewTimeSeconds: seconds(r.brew_time),
      bloomSeconds: seconds(r.bloom_time)
    };
  });

  const span = new Map<number, { first: string; last: string }>();
  for (const b of brews) {
    if (b.coffeeId === null) continue;
    const s = span.get(b.coffeeId);
    if (s) s.last = b.localDate;
    else span.set(b.coffeeId, { first: b.localDate, last: b.localDate });
  }

  const bagRows = db
    .prepare(`SELECT id, status, roaster, coffee_name, slug, origin, processing, roast_level, decaf, roast_date, cost, amount_g FROM coffees`)
    .all() as unknown as BagRow[];
  const bags = bagRows.map((r): BagFact => ({
    id: r.id,
    status: r.status,
    purchaseDate: r.roast_date,
    cost: r.cost,
    amountG: r.amount_g,
    roaster: r.roaster,
    name: r.coffee_name,
    slug: r.slug,
    processing: r.processing,
    origin: r.origin,
    processGroup: processGroup(r.processing),
    roastLevel: normalizeRoastLevel(r.roast_level),
    decaf: r.decaf === 1,
    firstBrew: span.get(r.id)?.first ?? null,
    lastBrew: span.get(r.id)?.last ?? null
  }));

  return { brews, bags };
}
