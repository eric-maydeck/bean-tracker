import { mmss, recipeSpeed, type RecipeDef, type RecipePour } from './recipes';

export interface StepLine { time: string; low: boolean; text: string }

function words(p: RecipePour, anySpeed: boolean): string {
  const speed = p.rateGps ? `${p.rateGps[0]}–${p.rateGps[1]} g/s pour` : anySpeed ? null : `${recipeSpeed(p)} pour`;
  const inner = [speed, p.agitation && `${p.agitation} agitation`, p.tool].filter(Boolean).join(', ');
  return `${p.bloom ? 'bloom' : 'pour'}${inner ? ` (${inner})` : ''}${p.swirlAfter ? ', swirl' : ''}`;
}

/** One line per pour; times are cumulative trigger targets (after a `low` step: "Low +m:ss"). */
export function recipeSteps(def: RecipeDef): StepLine[] {
  let anchor = 0; // seconds since the last absolute time
  let sinceLow: number | null = null; // seconds since the last `low` step, when that is the anchor
  return def.pours.map((p, i) => {
    const t = p.trigger;
    let time = '';
    if (i === 0) time = mmss(0);
    else if (t?.kind === 'low') {
      time = 'Low';
      sinceLow = 0;
    } else if (t) {
      const base = sinceLow ?? anchor;
      const at = mmss(base + t.targetS);
      const win = t.maxS > t.targetS ? ` (–${mmss(base + t.maxS)})` : '';
      if (sinceLow == null) anchor = base + t.targetS;
      else sinceLow = base + t.targetS;
      time = (sinceLow == null ? '' : 'Low +') + at + win;
    } else if (p.startS != null) {
      anchor = Math.round(p.startS);
      sinceLow = null;
      time = mmss(anchor);
    }
    return { time, low: t?.kind === 'low', text: words(p, def.anySpeed) };
  });
}

export const stepsText = (def: RecipeDef): string =>
  recipeSteps(def).map((s) => (s.time ? `${s.time} - ${s.text}` : s.text)).join('\n');

export function tempNotesLine(def: RecipeDef): string | null {
  const parts = [def.tempC != null ? `${def.tempC} °C` : null, def.notes].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
