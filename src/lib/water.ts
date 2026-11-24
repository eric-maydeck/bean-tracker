// Water hardness derived from minerals (mg/L), as ppm CaCO3. Spec:
// Derived values win over Bean Conqueror's stored GH/KH, which are a cross-check.
export interface WaterMinerals {
  calcium: number | null;
  magnesium: number | null;
  sodium: number | null;
  potassium: number | null;
  bicarbonate?: number | null;
}

export function generalHardness(w: WaterMinerals): number {
  return (w.calcium ?? 0) * 2.497 + (w.magnesium ?? 0) * 4.118;
}

// A stored bicarbonate is counted instead of deriving it from Na/K, never both.
export function carbonateHardness(w: WaterMinerals): number {
  if (w.bicarbonate) return (w.bicarbonate / 61.02) * 50.04;
  return ((w.sodium ?? 0) / 22.99 + (w.potassium ?? 0) / 39.1) * 50.04;
}

const MISMATCH_PPM = 2;

// Stored 0/null means "not entered" in Bean Conqueror, so it's never a mismatch.
export function hardnessMismatch(w: WaterMinerals & { storedGh: number | null; storedKh: number | null }): boolean {
  const off = (stored: number | null, derived: number) => !!stored && Math.abs(stored - derived) > MISMATCH_PPM;
  return off(w.storedGh, generalHardness(w)) || off(w.storedKh, carbonateHardness(w));
}

// #198: a water with no minerals, GH or KH is a blank form, unless its name or note says it's a
// zero-mineral water (distilled, RO, deionized, ZeroWater); then all-zero is its real profile.
const ZERO_WATER = /(?<![a-z])(distilled|deioni[sz]ed|di water|r\.?o\.?|reverse[\s-]*osmosis|zero\s*water)(?![a-z])/i;
export const isZeroWater = (name: string | null, note: string | null) => ZERO_WATER.test(`${name ?? ''} ${note ?? ''}`);
