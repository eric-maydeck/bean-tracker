// Client-safe What-if math (no server imports): the UI recomputes the runway as sliders move.
export interface WhatIf { drinkers: number; gpp: number; inflow: number; bpd: number; dose: number }
export const DAYS_PER_MONTH = 30.44;

const DAY = 86_400_000;
// Own date add: server/insights/time.ts pulls in server code, so it can't be imported client-side.
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// People × g/day, less incoming g/week. null when it never empties (or nothing is on hand).
export function runway(onHandG: number, w: WhatIf, today: string): { days: number | null; emptyOn: string | null } {
  const daily = w.drinkers * w.gpp - w.inflow / 7;
  if (!(daily > 0) || !(onHandG > 0)) return { days: null, emptyOn: null };
  const days = Math.ceil(+(onHandG / daily).toFixed(9)); // toFixed: float noise must not add a day
  return { days, emptyOn: plusDays(today, days) };
}

// Brews/day × dose × average $/g over an average month; null with no price.
export const spend = (w: Pick<WhatIf, 'bpd' | 'dose'>, avgPricePerG: number | null): number | null =>
  avgPricePerG === null ? null : w.bpd * w.dose * DAYS_PER_MONTH * avgPricePerG;
