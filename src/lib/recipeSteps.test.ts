import { describe, expect, it } from 'vitest';
import type { RecipeDef, RecipePour, Trigger } from './recipes';
import { recipeSteps, stepsText, tempNotesLine } from './recipeSteps';

const rp = (over: Partial<RecipePour> = {}): RecipePour => ({
  bloom: false, grams: 50, share: null, speed: 'fast', rateGps: null, agitation: null, tool: null,
  swirlAfter: false, startS: null, durationS: null, trigger: null, ...over
});
const after = (t: number, m = t): Trigger => ({ kind: 'after', targetS: t, maxS: m });
const mk = (pours: RecipePour[], over: Partial<RecipeDef> = {}): RecipeDef => ({
  v: 1, pours, pourCount: { min: pours.length, max: pours.length }, bloomHoldS: null, bloomHoldTolS: 5,
  ratio: { targets: [16.7], tol: 0.5 }, tempC: null, totalS: null, notes: null, drippers: [], anySpeed: false,
  equalSplit: false, ...over
});
const hi = { agitation: 'high' as const };

describe('recipeSteps', () => {
  it("the user's format", () => {
    const d = mk([
      rp({ bloom: true, ...hi, swirlAfter: true }),
      rp({ bloom: true, ...hi, trigger: after(20) }),
      rp({ ...hi, trigger: after(20) }),
      rp({ speed: 'slow', agitation: 'low', trigger: { kind: 'low' } })
    ]);
    expect(stepsText(d)).toBe(
      [
        '0:00 - bloom (fast pour, high agitation), swirl',
        '0:20 - bloom (fast pour, high agitation)',
        '0:40 - pour (fast pour, high agitation)',
        'Low - pour (slow pour, low agitation)'
      ].join('\n')
    );
    expect(recipeSteps(d)[3].low).toBe(true);
  });
  it('window shows latitude', () => {
    expect(recipeSteps(mk([rp(), rp({ trigger: after(20, 30) })]))[1].time).toBe('0:20 (–0:30)');
  });
  it('timed step after low', () => {
    const d = mk([rp(), rp({ trigger: { kind: 'low' } }), rp({ trigger: after(20) }), rp({ trigger: after(20) })]);
    expect(recipeSteps(d).map((s) => s.time)).toEqual(['0:00', 'Low', 'Low +0:20', 'Low +0:40']);
  });
  it('legacy pours use startS', () => {
    const d = mk([rp({ startS: 0.3 }), rp({ startS: 29.6 }), rp({ startS: 60.4 })]);
    expect(recipeSteps(d).map((s) => s.time)).toEqual(['0:00', '0:30', '1:00']);
    expect(recipeSteps(mk([rp(), rp()])).map((s) => s.time)).toEqual(['0:00', '']);
    expect(stepsText(mk([rp(), rp()]))).toBe('0:00 - pour (fast pour)\npour (fast pour)');
  });
  it('range, tool, anySpeed', () => {
    const t = (p: Partial<RecipePour>, o: Partial<RecipeDef> = {}) => recipeSteps(mk([rp(p)], o))[0].text;
    expect(t({ rateGps: [3, 8] })).toBe('pour (3–8 g/s pour)');
    expect(t({ speed: 'slow', agitation: 'low', tool: 'melodrip' })).toBe('pour (slow pour, low agitation, melodrip)');
    expect(t({ agitation: 'high' }, { anySpeed: true })).toBe('pour (high agitation)');
    expect(t({}, { anySpeed: true })).toBe('pour');
    expect(t({ rateGps: [3, 8] }, { anySpeed: true })).toBe('pour');
  });
  it('legacy startS right after a low step resets the low anchor', () => {
    const d = mk([rp(), rp({ trigger: { kind: 'low' } }), rp({ startS: 90 }), rp({ trigger: after(20) })]);
    expect(recipeSteps(d).map((s) => s.time)).toEqual(['0:00', 'Low', '1:30', '1:50']);
  });
});

describe('tempNotesLine', () => {
  it('joins temperature and notes', () => {
    expect(tempNotesLine(mk([rp()], { tempC: 93, notes: '2 yeet blooms' }))).toBe('93 °C · 2 yeet blooms');
    expect(tempNotesLine(mk([rp()], { tempC: 93 }))).toBe('93 °C');
    expect(tempNotesLine(mk([rp()], { notes: 'hi' }))).toBe('hi');
    expect(tempNotesLine(mk([rp()]))).toBeNull();
    expect(tempNotesLine(mk([rp()], { tempC: 91.5 }))).toBe('91.5 °C');
  });
});
