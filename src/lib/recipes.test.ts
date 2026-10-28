import { describe, expect, it } from 'vitest';
import type { Pour, PourReading } from './pours';
import {
  convertAmounts, describeRecipe, draftFromReadings, matchBrew, noteTag, parseRecipeDef, parseRecipeInput, recipeTimeline,
  type Recipe, type RecipeDef, type RecipePour
} from './recipes';

const rp = (speed: 'fast' | 'slow', bloom = false, extra: Partial<RecipePour> = {}): RecipePour => ({
  bloom, grams: 50, share: null, speed, rateGps: null, agitation: null, tool: null, swirlAfter: false,
  startS: null, durationS: null, ...extra
});
const def = (pat: string, over: Partial<RecipeDef> = {}): RecipeDef => {
  const pours = [...pat].map((c, i) => rp(c === 'F' || c === 'B' ? 'fast' : 'slow', c === 'B' && i < 3));
  return {
    v: 1, pours, pourCount: { min: pours.length, max: pours.length }, bloomHoldS: 30, bloomHoldTolS: 5,
    ratio: { target: 16.7, tol: 0.7 }, tempC: null, totalS: null, notes: null, dripper: null, anySpeed: false, ...over
  };
};
const recipe = (id: number, name: string, d: RecipeDef, tags: string[] = []): Recipe => ({ id, name, tags, def: d });
const pour = (speed: 'fast' | 'slow', bloom = false): Pour => ({
  startS: 0, durationS: 10, grams: 50, avgGps: speed === 'fast' ? 16 : 5, peakGps: 20, speed, bloom, contactS: 30
});
// pattern letters: B = bloom (fast), F, S
const reading = (pat: string, over: Partial<PourReading> = {}): PourReading => {
  const pours = [...pat].map((c) => pour(c === 'S' ? 'slow' : 'fast', c === 'B'));
  const blooms = pours.filter((p) => p.bloom).length;
  return {
    v: 1, pours, swirls: [], tares: [], bloomCount: blooms, bloomHoldS: blooms ? 30 : null, immersion: false,
    totalS: 150, drawdownS: null, scaleWaterG: 300, ratio: 16.7, ratioSource: 'logged', lowConfidence: false,
    pattern: pat.replace(/B/g, 'F'), structureKey: 'k', ...over
  };
};
const brew = (r: PourReading | null, notes: string | null = null, tempC: number | null = null) => ({ notes, reading: r, tempC });

describe('parseRecipeDef', () => {
  const ok = () => JSON.parse(JSON.stringify(def('BFFS')));
  it('round-trips a valid def and drops extra keys', () => {
    const d = ok();
    expect(parseRecipeDef(d)).toEqual({ def: d });
    const r = parseRecipeDef({ ...d, extra: 1, pours: d.pours.map((p: object) => ({ ...p, x: 1 })) }) as { def: RecipeDef };
    expect(r.def).toEqual(d);
  });
  it.each([
    ['Add at least one pour', (d: any) => (d.pours = [], d.pourCount = { min: 1, max: 1 })],
    ['Blooms come first', (d: any) => (d.pours = [d.pours[1], d.pours[0], d.pours[2], d.pours[3]])],
    ['Blooms come first', (d: any) => (d.pours = Array.from({ length: 4 }, () => ({ ...d.pours[0] })), d.pourCount = { min: 4, max: 4 })],
    ['Pour count range must include the pours listed', (d: any) => (d.pourCount = { min: 1, max: 3 })],
    ['Pour count range must include the pours listed', (d: any) => (d.pourCount = { min: 0, max: 4 })],
    ['Ratio must be between 1:5 and 1:30', (d: any) => (d.ratio.target = 31)],
    ['Ratio must be between 1:5 and 1:30', (d: any) => (d.ratio.tol = 0.05)],
    ['Temperature must be 60-100 °C', (d: any) => (d.tempC = 101)],
    ['Invalid recipe', (d: any) => (d.pours[0].speed = 'medium')],
    ['Invalid recipe', (d: any) => (d.pours[0].grams = -1)],
    ['Invalid recipe', (d: any) => (d.pours[0].tool = 'x'.repeat(41))],
    ['Invalid recipe', (d: any) => (d.v = 2)]
  ])('%s', (error, mutate) => {
    const d = ok();
    mutate(d);
    expect(parseRecipeDef(d)).toEqual({ error });
  });
  it('rejects non-objects', () => expect(parseRecipeDef('x')).toEqual({ error: 'Invalid recipe' }));
});

describe('parseRecipeDef dripper fields', () => {
  const { dripper: _d, anySpeed: _a, ...old } = def('BFFS');
  it('defaults them for an old def and accepts good values', () => {
    expect(parseRecipeDef(old)).toMatchObject({ def: { dripper: null, anySpeed: false } });
    expect(parseRecipeDef({ ...old, dripper: 'Gabi', anySpeed: true })).toMatchObject({ def: { dripper: 'Gabi', anySpeed: true } });
  });
  it('rejects bad values', () => {
    expect(parseRecipeDef({ ...old, dripper: 5 })).toEqual({ error: 'Invalid recipe' });
    expect(parseRecipeDef({ ...old, anySpeed: 'yes' })).toEqual({ error: 'Invalid recipe' });
  });
  it('describes them', () => {
    expect(describeRecipe(def('BFFS', { dripper: 'Gabi', anySpeed: true }))).toBe('30 s bloom + 3 pours · ~1:16.7 · any pour speed · Gabi only');
  });
});

describe('parseRecipeInput', () => {
  it('trims and splits', () =>
    expect(parseRecipeInput(' R1 ', ' a, b ,,c')).toEqual({ name: 'R1', tags: ['a', 'b', 'c'] }));
  it('needs a name', () => expect(parseRecipeInput('  ', '')).toEqual({ error: 'Name the recipe' }));
});

describe('noteTag', () => {
  const rs = [recipe(1, 'BBS', def('BFFS')), recipe(2, 'BB', def('BFF')), recipe(3, 'R3', def('BFS'), ['2 yeets, 1 MD', 'md'])];
  it('whole word, case-insensitive', () => {
    expect(noteTag('BBS.', rs)?.id).toBe(1);
    expect(noteTag('bbs, go finer', rs)?.id).toBe(1);
    expect(noteTag('BBSX', rs)).toBeNull();
    expect(noteTag('xBBS', rs)).toBeNull();
  });
  it('BB does not tag BBS.', () => expect(noteTag('BBS.', [rs[1]])).toBeNull());
  it('tag phrases with punctuation', () => expect(noteTag('2 yeets, 1 MD. nice', rs)?.id).toBe(3));
  it('earliest in the note wins', () => expect(noteTag('md then bbs', rs)?.id).toBe(3));
  it('no note', () => expect(noteTag(null, rs)).toBeNull());
});

describe('matchBrew', () => {
  const r1 = recipe(1, 'R1', def('BFFS'));
  const on = (dripper: string, r: PourReading | null = reading('BFFS')) => ({ ...brew(r), dripper });
  it('a dripper-tied recipe ignores other drippers', () => {
    const tied = recipe(1, 'Gabi', def('BFFS', { dripper: 'Gabi' }));
    expect(matchBrew(on('Gabi'), [tied])).toMatchObject({ how: 'match' });
    expect(matchBrew(on('V60'), [tied])).toBeNull();
    expect(matchBrew(brew(reading('BFFS')), [tied])).toBeNull();
  });
  it('anySpeed matches any pattern at the same bloom count and ratio', () => {
    const any = recipe(1, 'Any', def('BFFS', { anySpeed: true }));
    expect(matchBrew(brew(reading('BFFS')), [any])).toMatchObject({ how: 'match' });
    expect(matchBrew(brew(reading('BSSF')), [any])).toMatchObject({ how: 'match', diffs: [] });
    expect(matchBrew(brew(reading('FFFS')), [any])).toBeNull(); // no bloom
    expect(matchBrew(brew(reading('BBFS')), [any])).toBeNull(); // two blooms
    expect(matchBrew(brew(reading('BSSF', { ratio: 18 })), [any])).toBeNull();
    expect(matchBrew(brew(reading('BSSFS')), [any])).toMatchObject({ how: 'modified' }); // pour count still only modifies
  });
  it('a locked dripper matches only its own recipes', () => {
    const anyR = recipe(1, 'Any', def('BFFS'));
    const tied = recipe(2, 'Gabi', def('BFFS', { dripper: 'Gabi' }));
    const locked = new Set(['Gabi']);
    expect(matchBrew(on('Gabi'), [anyR], locked)).toBeNull();
    expect(matchBrew(on('Gabi'), [anyR, tied], locked)).toMatchObject({ recipeId: 2 });
    expect(matchBrew(on('Gabi'), [anyR])).toMatchObject({ recipeId: 1 }); // unlocked
    expect(matchBrew(on('V60'), [anyR], locked)).toMatchObject({ recipeId: 1 });
  });
  it('exact pattern + ratio is a match', () => {
    const m = matchBrew(brew(reading('BFFS')), [r1])!;
    expect(m).toMatchObject({ recipeId: 1, how: 'match', diffs: [] });
  });
  it('pourCount range absorbs an extra pour; a fixed count is modified', () => {
    const wide = recipe(1, 'R1', def('BFFF', { pourCount: { min: 4, max: 5 } }));
    expect(matchBrew(brew(reading('BFFFF')), [wide])).toMatchObject({ how: 'match' });
    const fixed = recipe(1, 'R1', def('BFFF', { pourCount: { min: 4, max: 4 } }));
    expect(matchBrew(brew(reading('BFFFF')), [fixed])).toMatchObject({
      how: 'modified', diffs: [{ text: '5 pours', modified: true }]
    });
  });
  it('bloom hold and count differences are modified', () => {
    const m = matchBrew(brew(reading('BFFS', { bloomHoldS: 30 })), [recipe(1, 'R1', def('BFFS', { bloomHoldS: 20 }))])!;
    expect(m).toMatchObject({ how: 'modified', diffs: [{ text: '30 s bloom', modified: true }] });
    const two = reading('BBFS', { bloomHoldS: 30 });
    expect(matchBrew(brew(two), [r1])!.diffs).toContainEqual({ text: 'two blooms', modified: true });
    expect(matchBrew(brew(reading('BFFS', { bloomHoldS: 30 })), [recipe(1, 'R', def('BBFS'))])!.diffs)
      .toContainEqual({ text: '1 bloom', modified: true });
  });
  it('two blooms of 30 s vs a 20 s recipe', () => {
    const m = matchBrew(brew(reading('BBFS')), [recipe(1, 'R1', def('BBFS', { bloomHoldS: 20 }))])!;
    expect(m.diffs).toEqual([{ text: '30 s blooms', modified: true }]);
  });
  it('different fast/slow pattern is null', () => {
    expect(matchBrew(brew(reading('FFSS')), [recipe(1, 'R', def('FFFS'))])).toBeNull();
  });
  it('ratio null or out of tolerance is null', () => {
    expect(matchBrew(brew(reading('BFFS', { ratio: null })), [r1])).toBeNull();
    expect(matchBrew(brew(reading('BFFS', { ratio: 18 })), [r1])).toBeNull();
  });
  it('no reading is null', () => expect(matchBrew(brew(null), [r1])).toBeNull());
  it('temp and total differences are shown only', () => {
    const r = recipe(1, 'R1', def('BFFS', { tempC: 91, totalS: 160 }));
    const m = matchBrew(brew(reading('BFFS', { totalS: 190 }), null, 92.5), [r])!;
    expect(m.how).toBe('match');
    expect(m.diffs).toEqual([
      { text: '92.5 °C vs 91 °C', modified: false },
      { text: '3:10 total vs 2:40', modified: false }
    ]);
    expect(matchBrew(brew(reading('BFFS'), null, 91.5), [r])!.diffs).toEqual([]);
  });
  it('closest ratio wins; ties go to the lower id', () => {
    const a = recipe(1, 'R1', def('BFFS', { ratio: { target: 17.2, tol: 1 } }));
    const b = recipe(2, 'R2', def('BFFS', { ratio: { target: 16.8, tol: 1 } }));
    expect(matchBrew(brew(reading('BFFS')), [a, b])!.recipeId).toBe(2);
    expect(matchBrew(brew(reading('BFFS')), [b, { ...b, id: 0 }])!.recipeId).toBe(0);
  });
  it('a note tag beats a closer match and works without a reading', () => {
    const tagged = recipe(2, 'R2', def('BFS'));
    const m = matchBrew(brew(reading('BFFS'), 'R2 today'), [r1, tagged])!;
    expect(m).toMatchObject({ recipeId: 2, how: 'logged', distance: 0 });
    expect(matchBrew(brew(null, 'R2'), [tagged])).toMatchObject({ how: 'logged', diffs: [] });
  });
  it('a pour with only a rate range aligns by its midpoint', () => {
    const rate = recipe(1, 'R1', {
      ...def('F'), pours: [rp('slow', false, { rateGps: [14, 20] })]
    });
    expect(matchBrew(brew(reading('F')), [rate])).not.toBeNull();
  });
});

describe('describeRecipe', () => {
  it('bloom + fast pours with a count range', () => {
    const d = def('BFFF', { pourCount: { min: 4, max: 5 }, ratio: { target: 16.7, tol: 0.7 }, totalS: 150 });
    expect(describeRecipe(d)).toBe('30 s bloom + 3-4 fast pours · ~1:16.7 · 2:30 total');
  });
  it('fast pours stay fast pours whatever the rate, and a swirl follows the pours', () => {
    const d = def('BFF');
    d.pours[0].swirlAfter = true;
    d.pours[2].rateGps = [20, 25];
    expect(describeRecipe(d)).toBe('30 s bloom + 2 fast pours · swirl after bloom · ~1:16.7');
  });
});

describe('draftFromReadings + recipeTimeline', () => {
  it('takes medians and the pattern', () => {
    const rs = [reading('BFFS', { ratio: 16.4 }), reading('BFFS', { ratio: 16.8 }), reading('BFFS', { ratio: 17, swirls: [{ atS: 5, afterPour: 0 }] })];
    const d = draftFromReadings(rs, [92, 92, null]);
    expect(d.pours.map((p) => p.speed)).toEqual(['fast', 'fast', 'fast', 'slow']);
    expect(d.pours[0].bloom).toBe(true);
    expect(d).toMatchObject({
      pourCount: { min: 4, max: 4 }, bloomHoldS: 30, bloomHoldTolS: 5, ratio: { target: 16.8, tol: 0.7 }, tempC: 92
    });
    expect(d.pours[0].swirlAfter).toBe(false);
    expect(parseRecipeDef(d)).toEqual({ def: d });
    expect(recipeTimeline(d).pours).toHaveLength(4);
  });
});

describe('convertAmounts', () => {
  const pour = (grams: number | null, share: number | null = null) =>
    ({ bloom: false, grams, share, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: null, durationS: null }) as const;
  it('g to % sums to 100 and % to g restores the grams from the remembered total', () => {
    const a = convertAmounts([pour(60), pour(120), pour(120)], '%', null);
    expect(a.totalG).toBe(300);
    expect(a.pours.map((p) => p.share)).toEqual([0.2, 0.4, 0.4]);
    expect(a.pours.every((p) => p.grams == null)).toBe(true);
    const thirds = convertAmounts([pour(100), pour(100), pour(100)], '%', null).pours.map((p) => p.share!);
    expect(+thirds.reduce((x, y) => x + y, 0).toFixed(3)).toBe(1);
    const b = convertAmounts(a.pours, 'g', a.totalG);
    expect(b.pours.map((p) => p.grams)).toEqual([60, 120, 120]);
    expect(b.pours.every((p) => p.share == null)).toBe(true);
  });
  it('% to g with no remembered total keeps shares and invents no grams', () => {
    const b = convertAmounts([pour(null, 0.25), pour(null, 0.75)], 'g', null);
    expect(b.pours.map((p) => [p.grams, p.share])).toEqual([[null, 0.25], [null, 0.75]]);
  });
});

describe('editor-facing recipe edge cases', () => {
  const base = def('BFS');
  it('describes an unknown ratio and three blooms honestly', () => {
    expect(describeRecipe({ ...base, ratio: { target: null, tol: 0.7 } })).toContain('ratio unknown');
    expect(describeRecipe({ ...base, ratio: { target: null, tol: 0.7 } })).not.toContain('~1:');
    const three = { ...base, bloomHoldS: 20, pours: [rp('fast', true), rp('fast', true), rp('fast', true), rp('slow')], pourCount: { min: 4, max: 4 } };
    expect(describeRecipe(three)).toMatch(/^Three 20 s blooms/);
  });
  it('draws a % recipe in proportion, not flat', () => {
    const tl = recipeTimeline({ ...base, pours: [rp('fast', false, { grams: null, share: 0.25 }), rp('slow', false, { grams: null, share: 0.75 })] });
    expect(tl.pours.map((p) => p.grams)).toEqual([25, 75]);
  });
  it('rejects a fractional pour count', () => {
    expect(parseRecipeDef({ ...base, pourCount: { min: 1.5, max: 3 } })).toHaveProperty('error');
    expect(parseRecipeDef({ ...base, pourCount: { min: 1, max: 2.5 } })).toHaveProperty('error');
  });
});
