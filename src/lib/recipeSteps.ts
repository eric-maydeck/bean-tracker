import { mmss, recipeSpeed, type RecipeDef, type RecipePour } from './recipes';

/** `alt`: the time if every ranged wait so far ran to its maximum (null for exact steps). */
export interface StepLine { time: string; low: boolean; text: string; alt: string | null }

function words(p: RecipePour, anySpeed: boolean): string {
  const speed = anySpeed ? null : p.rateGps ? `${p.rateGps[0]}–${p.rateGps[1]} g/s pour` : `${recipeSpeed(p)} pour`;
  const inner = [speed, p.agitation && `${p.agitation} agitation`, p.tool].filter(Boolean).join(', ');
  return `${p.bloom ? 'bloom' : 'pour'}${inner ? ` (${inner})` : ''}${p.swirlAfter ? ', swirl' : ''}`;
}

/** One line per pour; times are cumulative trigger targets (after a `low` step: "Low +m:ss"). */
export function recipeSteps(def: RecipeDef): StepLine[] {
  let anchor = 0; // seconds since the last absolute time
  let sinceLow: number | null = null; // seconds since the last `low` step, when that is the anchor
  let extra = 0; // seconds the ranged waits since the anchor add at their maximum
  let ranged = 0; // how many of them
  return def.pours.map((p, i) => {
    const t = p.trigger;
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
        alt = `Or ${pre}${mmss(base + t.targetS + extra)} with ${ranged === 1 ? `a ${t.maxS} s ${noun}` : `${t.maxS} s ${noun}s`}`;
      }
    } else if (p.startS != null) {
      anchor = Math.round(p.startS);
      sinceLow = null;
      extra = ranged = 0;
      time = mmss(anchor);
    }
    return { time, low: t?.kind === 'low', text: words(p, def.anySpeed), alt };
  });
}

export const stepsText = (def: RecipeDef): string =>
  recipeSteps(def).map((s) => (s.time ? `${s.time} - ${s.text}` : s.text)).join('\n');

export function tempNotesLine(def: RecipeDef): string | null {
  const parts = [def.tempC != null ? `${def.tempC} °C` : null, def.notes].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
