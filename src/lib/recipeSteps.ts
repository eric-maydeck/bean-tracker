import { pourName, swirlName } from './pours';
import { mmss, recipeShares, recipeSpeed, trigger, type RecipeDef, type RecipePour } from './recipes';

/** `alt`: the time if every ranged wait so far ran to its maximum (null for exact steps). */
export interface StepLine { time: string; low: boolean; text: string; alt: string | null }

/** Water on a step line: `total` = "to 150g" (running total), `pour` = "96g" (this pour only). */
export type StepAmounts = { total: number; mode: 'total' | 'pour' };

export const hasStepAmounts = (def: RecipeDef): boolean => recipeShares(def, def.pours.length) !== null;

function words(p: RecipePour, anySpeed: boolean, amount = ''): string {
  const speed = anySpeed ? null : p.rateGps ? `${p.rateGps[0]}–${p.rateGps[1]}g/s pour` : `${recipeSpeed(p)} pour`;
  const inner = [speed, p.agitation && `${p.agitation} agitation`, p.tool].filter(Boolean).join(', ');
  return `${p.bloom ? 'bloom' : 'pour'}${amount && ` ${amount}`}${inner ? ` (${inner})` : ''}${p.swirlAfter ? ', swirl' : ''}`;
}

/** One line per pour; times are cumulative trigger targets (after a `low` step: "Low +m:ss"). */
export function recipeSteps(def: RecipeDef, water?: StepAmounts): StepLine[] {
  const shares = water ? recipeShares(def, def.pours.length) : null;
  let cum = 0;
  let prev = 0; // rounded running total before this pour
  let anchor = 0; // seconds since the last absolute time
  let sinceLow: number | null = null; // seconds since the last `low` step, when that is the anchor
  let extra = 0; // seconds the ranged waits since the anchor add at their maximum
  let ranged = 0; // how many of them
  return def.pours.map((p, i) => {
    const t = trigger(def.pours, i);
    let time = '';
    let alt: string | null = null;
    if (i === 0) time = mmss(0);
    else if (t?.kind === 'low') {
      time = 'Low';
      sinceLow = 0;
      extra = ranged = 0;
    } else if (t) {
      const base = sinceLow ?? anchor;
      const at = mmss(base + t.targetS);
      if (t.maxS > t.targetS) {
        extra += t.maxS - t.targetS;
        ranged++;
      }
      if (sinceLow == null) anchor = base + t.targetS;
      else sinceLow = base + t.targetS;
      const pre = sinceLow == null ? '' : 'Low +';
      time = pre + at;
      if (extra) {
        const noun = def.pours[i - 1].bloom ? 'bloom' : 'pour';
        alt = `Or ${pre}${mmss(base + t.targetS + extra)} with ${t.maxS}s ${noun}s`;
      }
    } else if (p.startS != null) {
      anchor = Math.round(p.startS);
      sinceLow = null;
      extra = ranged = 0;
      time = mmss(anchor);
    }
    let amount = '';
    if (water && shares) {
      cum += shares[i];
      const target = Math.round(water.total * cum);
      amount = water.mode === 'total' ? `to ${target}g` : `${target - prev}g`;
      prev = target;
    }
    return { time, low: t?.kind === 'low', text: words(p, def.anySpeed, amount), alt };
  });
}

export const stepsText = (def: RecipeDef): string =>
  recipeSteps(def).map((s) => (s.time ? `${s.time} - ${s.text}` : s.text)).join('\n');

export function tempNotesLine(def: RecipeDef): string | null {
  const parts = [def.tempC != null ? `${def.tempC}°C` : null, def.notes].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Tooltip text for the recipe chart: each pour with its start and end ("Third pour (0:40–1:05)", "(0:40 → low)", "(low → end)"), and each swirl. */
export function recipeLabels(def: RecipeDef): { labels: string[]; swirlLabels: string[] } {
  const steps = recipeSteps(def).map((s) => (s.time === 'Low' ? 'low' : s.time.replace(/^Low \+/, 'low +')));
  const bloomIdx = def.pours.map((_, i) => def.pours.slice(0, i).filter((q) => q.bloom).length);
  const labels = def.pours.map((p, i) => {
    const start = steps[i];
    const next = i + 1 < steps.length ? steps[i + 1] : 'end';
    const span = !start ? '' : !next ? ` (${start})` : ` (${start} → ${next})`;
    return pourName(p.bloom, bloomIdx[i], i) + span;
  });
  const swirlLabels = def.pours.flatMap((p, i) => (p.swirlAfter ? [swirlName(p.bloom, bloomIdx[i], i)] : []));
  return { labels, swirlLabels };
}
