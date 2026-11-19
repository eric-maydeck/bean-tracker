import type { PickCoffee, WheelSlice } from './types';

export const CRIT_RATIO = 0.3;
const TAU = Math.PI * 2;

/** Radians, first a0 = 0, last a1 = 2pi. Success sits after the first floor(n/2) coffees, fail last. */
export function wheelSlices(pool: PickCoffee[], hasSuccess: boolean, hasFail: boolean): WheelSlice[] {
  const parts: { kind: WheelSlice['kind']; coffeeId?: number; w: number }[] = pool.map((c) => ({ kind: 'coffee', coffeeId: c.id, w: 1 }));
  if (hasSuccess) parts.splice(Math.floor(pool.length / 2), 0, { kind: 'success', w: CRIT_RATIO });
  if (hasFail) parts.push({ kind: 'fail', w: CRIT_RATIO });
  const total = parts.reduce((t, p) => t + p.w, 0);
  let acc = 0;
  return parts.map((p, i) => {
    const a0 = acc;
    acc += (p.w / total) * TAU;
    const s: WheelSlice = { kind: p.kind, a0, a1: i === parts.length - 1 ? TAU : acc };
    if (p.coffeeId !== undefined) s.coffeeId = p.coffeeId;
    return s;
  });
}

/** The slice whose [a0, a1) holds the angle (wrapped into [0, 2pi)). */
export function sliceAt(slices: WheelSlice[], angle: number): WheelSlice {
  const a = ((angle % TAU) + TAU) % TAU;
  return slices.find((s) => a >= s.a0 && a < s.a1) ?? slices[slices.length - 1];
}
