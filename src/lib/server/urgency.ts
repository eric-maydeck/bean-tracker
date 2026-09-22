import type { CoffeeRow } from '../types';

export interface UrgencyInput {
  roast_date: string | null;
  frozen_start_date: string | null;
  frozen_end_date: string | null;
  rest_days_low: number | null;
  rest_days_high: number | null;
  drank: number;
}

export interface ComputedFields {
  cost_per_gram: number | null;
  days_since_roast: number | null;
  drink_after: string | null;
  drink_before: string | null;
  urgency_rating: number | 'Done';
}

export type CoffeeWithComputed = CoffeeRow & ComputedFields;

export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeCostPerGram(cost: number | null, amountG: number | null): number | null {
  if (cost == null || amountG == null || amountG === 0) return null;
  return cost / amountG;
}

export function computeDaysSinceRoast(input: UrgencyInput, today: Date): number | null {
  if (!input.roast_date) return null;
  const roastDate = parseDate(input.roast_date);
  if (!input.frozen_start_date) {
    return diffDays(today, roastDate);
  }
  const frozenStart = parseDate(input.frozen_start_date);
  if (!input.frozen_end_date) {
    return diffDays(frozenStart, roastDate);
  }
  const frozenEnd = parseDate(input.frozen_end_date);
  return diffDays(today, roastDate) - diffDays(frozenEnd, frozenStart);
}

export function computeDrinkAfter(input: UrgencyInput, today: Date): string | null {
  if (!input.roast_date || input.rest_days_low == null) return null;
  const roastDate = parseDate(input.roast_date);
  const origDrinkAfter = addDays(roastDate, input.rest_days_low);

  if (!input.frozen_start_date) {
    return formatDate(origDrinkAfter);
  }
  const frozenStart = parseDate(input.frozen_start_date);
  if (!input.frozen_end_date) {
    const remaining = Math.max(0, diffDays(origDrinkAfter, frozenStart));
    return formatDate(addDays(today, remaining));
  }
  const frozenEnd = parseDate(input.frozen_end_date);
  const frozenDays = diffDays(frozenEnd, frozenStart);
  const shifted = addDays(origDrinkAfter, frozenDays);
  return formatDate(shifted.getTime() > frozenEnd.getTime() ? shifted : frozenEnd);
}

export function computeDrinkBefore(input: UrgencyInput, today: Date): string | null {
  if (!input.roast_date || input.rest_days_high == null) return null;
  const roastDate = parseDate(input.roast_date);
  const origDrinkBefore = addDays(roastDate, input.rest_days_high + 7);

  if (!input.frozen_start_date) {
    return formatDate(origDrinkBefore);
  }
  const frozenStart = parseDate(input.frozen_start_date);
  if (!input.frozen_end_date) {
    const remaining = Math.max(0, diffDays(origDrinkBefore, frozenStart));
    return formatDate(addDays(today, remaining));
  }
  const frozenEnd = parseDate(input.frozen_end_date);
  const frozenDays = diffDays(frozenEnd, frozenStart);
  // Unlike drink_after, drink_before is unclamped per original spreadsheet formula (no floor constraint on deadline)
  return formatDate(addDays(origDrinkBefore, frozenDays));
}

export function computeUrgencyRating(input: UrgencyInput, today: Date): number | 'Done' {
  if (input.drank) return 'Done';
  if (!input.roast_date || input.rest_days_low == null || input.rest_days_high == null) {
    return -100;
  }

  const roastDate = parseDate(input.roast_date);
  const origDrinkAfter = addDays(roastDate, input.rest_days_low);
  const origDrinkBefore = addDays(roastDate, input.rest_days_high + 7);

  let effToday: Date;
  if (!input.frozen_start_date) {
    effToday = today;
  } else if (!input.frozen_end_date) {
    effToday = parseDate(input.frozen_start_date);
  } else {
    const frozenStart = parseDate(input.frozen_start_date);
    const frozenEnd = parseDate(input.frozen_end_date);
    effToday = addDays(today, -diffDays(frozenEnd, frozenStart));
  }

  if (diffDays(effToday, origDrinkAfter) < 0) {
    const rampDown = Math.min(diffDays(origDrinkAfter, roastDate), 130);
    const value = -100 * (diffDays(origDrinkAfter, effToday) / rampDown);
    return Math.max(-100, value);
  }

  const rampUp = Math.min(diffDays(origDrinkBefore, origDrinkAfter), 130);
  const value = 100 * (diffDays(effToday, origDrinkAfter) / rampUp);
  return Math.min(100, value);
}

export function withComputedFields(row: CoffeeRow, today: Date): CoffeeWithComputed {
  return {
    ...row,
    cost_per_gram: computeCostPerGram(row.cost, row.amount_g),
    days_since_roast: computeDaysSinceRoast(row, today),
    drink_after: computeDrinkAfter(row, today),
    drink_before: computeDrinkBefore(row, today),
    urgency_rating: computeUrgencyRating(row, today)
  };
}
