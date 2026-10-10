import { daysBetween } from './time';

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

// Belt and braces next to the coffee_corrections_2026_10_b migration: a
// future stray label still sorts on the roast_levels scale.
const ROAST_LEVEL_ALIASES: Record<string, string> = { 'Light/Med': 'Light/Medium', 'Med/Light': 'Medium/Light' };
export const normalizeRoastLevel = (level: string | null): string | null => (level ? (ROAST_LEVEL_ALIASES[level] ?? level) : null);

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
