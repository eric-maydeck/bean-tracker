import { describe, expect, it } from 'vitest';
import type { Pour, PourReading } from './pours';
import {
  middleHalf,
  fmtRange,
  convertAmounts, describeRecipe, draftFromReadings, controlsFlow, fitRecipe, flowNote, matchBrew, hasWord, noteTag, parseRecipeDef, parseRecipeInput, recipeTimeline, triggerWindows, withDefaults,
  type Recipe, type RecipeDef, type RecipePour, type Trigger
} from './recipes';

const rp = (speed: 'fast' | 'slow', bloom = false, extra: Partial<RecipePour> = {}): RecipePour => ({
  bloom, grams: 50, share: null, speed, rateGps: null, agitation: null, tool: null, swirlAfter: false,
  startS: null, durationS: null, trigger: null, ...extra
});
const def = (pat: string, over: Partial<RecipeDef> = {}): RecipeDef => {
  const pours = [...pat].map((c, i) => rp(c === 'F' || c === 'B' ? 'fast' : 'slow', c === 'B' && i < 3));
  return {
    v: 1, pours, pourCount: { min: pours.length, max: pours.length }, bloomHoldS: 30, bloomHoldTolS: 5,
    ratio: { targets: [16.7], tol: 0.7 }, tempC: null, totalS: null, notes: null, drippers: [], anySpeed: false,
    equalSplit: false, ...over
  };
};
const recipe = (id: number, name: string, d: RecipeDef, tags: string[] = []): Recipe => ({ id, name, tags, def: d });
const pour = (speed: 'fast' | 'slow', bloom = false): Pour => ({
  startS: 0, durationS: 10, grams: 50, avgGps: speed === 'fast' ? 16 : 5, peakGps: 20, speed, bloom, contactS: 30
});
// pattern letters: B = bloom (fast), F, S
const reading = (
  pat: string, over: Partial<PourReading> = {}, grams?: number[], starts?: number[]
): PourReading => {
  const pours = [...pat].map((c, i) => ({
    ...pour(c === 'S' ? 'slow' : 'fast', c === 'B'), ...(grams && { grams: grams[i] }), ...(starts && { startS: starts[i] })
  }));
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
    ['Ratio must be between 1:5 and 1:30', (d: any) => (d.ratio.targets = [31])],
    ['Ratio must be between 1:5 and 1:30', (d: any) => (d.ratio.tol = 0.05)],
    ['Trigger time must be at least its target', (d: any) => (d.pours[1].trigger = { kind: 'after', targetS: 30, maxS: 20 })],
    ['Trigger time must be at least its target', (d: any) => (d.pours[1].trigger = { kind: 'after', targetS: 0, maxS: 20 })],
    ['Trigger time must be at least its target', (d: any) => (d.pours[1].trigger = { kind: 'after', targetS: 20, maxS: 601 })],
    ['Invalid recipe', (d: any) => (d.pours[1].trigger = { kind: 'soon' })],
    ['Enter a trigger time', (d: any) => (d.pours[1].trigger = { kind: 'after', targetS: 20, maxS: null })],
    ['Enter a trigger time', (d: any) => (d.pours[1].trigger = { kind: 'after' })],
    ['Add a ratio', (d: any) => (d.ratio.targets = [])],
    ['Invalid recipe', (d: any) => (d.ratio.targets = [10, 11, 12, 13, 14, 15])],
    ['Invalid recipe', (d: any) => (d.equalSplit = 'yes')],
    ['Temperature must be 60-100 °C', (d: any) => (d.tempC = 101)],
    ['Invalid recipe', (d: any) => (d.pours[0].speed = 'medium')],
    ['Invalid recipe', (d: any) => (d.pours[0].agitation = 'extreme')],
    ['Invalid recipe', (d: any) => (d.pours[0].grams = -1)],
    ['Invalid recipe', (d: any) => (d.pours[0].tool = 'x'.repeat(41))],
    ['Invalid recipe', (d: any) => (d.v = 2)]
  ])('%s', (error, mutate) => {
    const d = ok();
    mutate(d);
    expect(parseRecipeDef(d)).toEqual({ error });
  });
  it('round-trips triggers, equal split and ratio targets', () => {
    const d = ok();
    d.pours[1].trigger = { kind: 'after', targetS: 20, maxS: 30 };
    d.pours[3].trigger = { kind: 'low' };
    d.equalSplit = true;
    d.ratio = { targets: [18, 15, 16.7, 15], tol: 0.5 };
    const r = (parseRecipeDef(d) as { def: RecipeDef }).def;
    expect(r.pours[1].trigger).toEqual({ kind: 'after', targetS: 20, maxS: 30 });
    expect(r.pours[3].trigger).toEqual({ kind: 'low' });
    expect(r.equalSplit).toBe(true);
    expect(r.ratio).toEqual({ targets: [15, 16.7, 18], tol: 0.5 });
  });
  it('accepts the old ratio shape', () => {
    const d = ok();
    d.ratio = { target: 16.7, tol: 0.7 };
    expect((parseRecipeDef(d) as { def: RecipeDef }).def.ratio).toEqual({ targets: [16.7], tol: 0.7 });
  });
  it("forces the first pour's trigger to null", () => {
    const d = ok();
    d.pours[0].trigger = { kind: 'low' };
    expect((parseRecipeDef(d) as { def: RecipeDef }).def.pours[0].trigger).toBeNull();
  });
  it('accepts medium agitation', () => {
    const d = ok();
    d.pours[0].agitation = 'medium';
    expect((parseRecipeDef(d) as { def: RecipeDef }).def.pours[0].agitation).toBe('medium');
  });
  it('rejects non-objects', () => expect(parseRecipeDef('x')).toEqual({ error: 'Invalid recipe' }));
});

describe('parseRecipeDef dripper fields', () => {
  const { drippers: _d, anySpeed: _a, ...old } = def('BFFS');
  it('defaults them for an old def and accepts good values', () => {
    expect(parseRecipeDef(old)).toMatchObject({ def: { drippers: [], anySpeed: false } });
    expect(parseRecipeDef({ ...old, drippers: ['Gabi', 'Orea'], anySpeed: true })).toMatchObject({ def: { drippers: ['Gabi', 'Orea'], anySpeed: true } });
  });
  it('rejects bad values', () => {
    expect(parseRecipeDef({ ...old, drippers: 'Gabi' })).toEqual({ error: 'Invalid recipe' });
    expect(parseRecipeDef({ ...old, drippers: [5] })).toEqual({ error: 'Invalid recipe' });
    expect(parseRecipeDef({ ...old, anySpeed: 'yes' })).toEqual({ error: 'Invalid recipe' });
  });
  it('describes them', () => {
    expect(describeRecipe(def('BFFS', { drippers: ['Gabi Master A', 'Orea'], anySpeed: true }))).toBe('30 s bloom + 3 pours · ~1:16.7 · any pour speed · on Gabi Master A or Orea');
  });
});

describe('parseRecipeInput', () => {
  it('trims and splits', () =>
    expect(parseRecipeInput(' R1 ', ' a, b ,,c')).toEqual({ name: 'R1', tags: ['a', 'b', 'c'] }));
  it('needs a name', () => expect(parseRecipeInput('  ', '')).toEqual({ error: 'Name the recipe' }));
});

describe('noteTag', () => {
  const rs = [recipe(1, 'BBS', def('BFFS')), recipe(2, 'BB', def('BFF')), recipe(3, 'R3', def('BFS'), ['2 yeets, 1 MD', 'md'])];
  const ids = (note: string | null, list: Recipe[] = rs) => noteTag(note, list).map((r) => r.id);
  it('whole word, case-insensitive', () => {
    expect(ids('BBS.')).toEqual([1]);
    expect(ids('bbs, go finer')).toEqual([1]);
    expect(ids('BBSX')).toEqual([]);
    expect(ids('xBBS')).toEqual([]);
  });
  it('BB does not tag BBS.', () => expect(ids('BBS.', [rs[1]])).toEqual([]));
  it('tag phrases with punctuation', () => expect(ids('2 yeets, 1 MD. nice')).toEqual([3]));
  it('earliest in the note wins', () => expect(ids('md then bbs')).toEqual([3]));
  it('no note', () => expect(ids(null)).toEqual([]));

  const fx = [
    recipe(1, 'BBS', def('BFFS')), recipe(2, 'BBF', def('BFFF')), recipe(3, 'Shoebox', def('BFS')),
    recipe(4, 'BBJ', def('BFFSS')), recipe(5, 'DYB', def('BFS'), ['1 long pour'])
  ];
  it('advice sentence is ignored', () => {
    expect(ids('Try BBF next time', fx)).toEqual([]);
    expect(ids('BBS. Try BBF next', fx)).toEqual([1]);
    expect(ids('Maybe try the Shoebox approach', fx)).toEqual([]);
  });
  it('a first-token hit always counts', () => {
    expect(ids('bbs, go finer', fx)).toEqual([1]);
    expect(ids('BBJ. Good, but probably better as a 4 shoey yeet', fx)).toEqual([4]);
  });
  it('mid-note tag without advice words', () => expect(ids('Nice. 2 yeets, 1 long pour', fx)).toEqual([5]));
  it('dotted grind stays one sentence', () => {
    expect(ids('1.1.0 BBS', fx)).toEqual([1]);
    expect(ids('Grind 1.1.0. BBS', fx)).toEqual([1]);
  });
  it('whole-word advice only', () => expect(ids('Nice, BBS ordinary', fx)).toEqual([1]));
  it('shared tag returns every carrier', () => {
    const sh = [recipe(1, 'A', def('BFS'), ['Shoebox']), recipe(2, 'B', def('BFS'), ['Shoebox']), recipe(3, 'C', def('BFS'))];
    expect(ids('Shoebox, fine', sh)).toEqual([1, 2]);
  });
  it('longest term at the same index wins', () => {
    const sh = [recipe(1, 'A', def('BFS'), ['Shoebox QC washed', 'Shoebox']), recipe(2, 'B', def('BFS'), ['Shoebox'])];
    expect(ids('Shoebox QC washed, nice', sh)).toEqual([1]);
  });
});

describe('matchBrew', () => {
  const r1 = recipe(1, 'R1', def('BFFS'));
  const on = (dripper: string, r: PourReading | null = reading('BFFS')) => ({ ...brew(r), dripper });
  it('a dripper-tied recipe ignores other drippers', () => {
    const tied = recipe(1, 'Gabi', def('BFFS', { drippers: ['Gabi'] }));
    expect(matchBrew(on('Gabi'), [tied])).toMatchObject({ how: 'match' });
    expect(matchBrew(on('V60'), [tied])).toBeNull();
    const two = recipe(1, 'Two', def('BFFS', { drippers: ['Gabi', 'Orea'] }));
    expect(matchBrew(on('Orea'), [two])).toMatchObject({ how: 'match' });
    expect(matchBrew(on('V60'), [two])).toBeNull();
    expect(matchBrew(brew(reading('BFFS')), [tied])).toBeNull();
  });
  it('anySpeed matches any pattern at the same bloom count and ratio', () => {
    const d = def('BFFS', { anySpeed: true });
    const any = recipe(1, 'Any', { ...d, pours: d.pours.map((p) => ({ ...p, grams: null })) }); // no amounts: shares skipped
    expect(matchBrew(brew(reading('BFFS')), [any])).toMatchObject({ how: 'match' });
    expect(matchBrew(brew(reading('BSSF')), [any])).toMatchObject({ how: 'match', diffs: [] });
    expect(matchBrew(brew(reading('FFFS')), [any])).toBeNull(); // no bloom
    expect(matchBrew(brew(reading('BBFS')), [any])).toBeNull(); // two blooms
    expect(matchBrew(brew(reading('BSSF', { ratio: 18 })), [any])).toBeNull();
    expect(matchBrew(brew(reading('BSSFS')), [any])).toBeNull(); // count outside the range is no match
  });
  it('a lock with no recipe tied to the dripper does nothing', () => {
    expect(matchBrew(on('Gabi'), [recipe(1, 'Any', def('BFFS'))], new Set(['Gabi']))).toMatchObject({ recipeId: 1 });
  });
  it('a locked dripper matches only its own recipes', () => {
    const anyR = recipe(1, 'Any', def('BFFS'));
    const tied = recipe(2, 'Gabi', def('BFFS', { drippers: ['Gabi'] }));
    const locked = new Set(['Gabi']);
    expect(matchBrew(on('Gabi'), [anyR, recipe(3, 'Gabi other', def('SSS', { drippers: ['Gabi'] }))], locked)).toBeNull();
    expect(matchBrew(on('Gabi'), [anyR, tied], locked)).toMatchObject({ recipeId: 2 });
    expect(matchBrew(on('Gabi'), [anyR])).toMatchObject({ recipeId: 1 }); // unlocked
    expect(matchBrew(on('V60'), [anyR], locked)).toMatchObject({ recipeId: 1 });
  });
  it('exact pattern + ratio is a match', () => {
    const m = matchBrew(brew(reading('BFFS')), [r1])!;
    expect(m).toMatchObject({ recipeId: 1, how: 'match', diffs: [] });
  });
  it('pourCount range absorbs an extra pour; a fixed count is no match', () => {
    const wide = recipe(1, 'R1', def('BFFF', { pourCount: { min: 4, max: 5 } }));
    expect(matchBrew(brew(reading('BFFFF')), [wide])).toMatchObject({ how: 'match' });
    const fixed = recipe(1, 'R1', def('BFFF', { pourCount: { min: 4, max: 4 } }));
    expect(matchBrew(brew(reading('BFFFF')), [fixed])).toBeNull();
  });
  it('bloom hold and count differences are modified', () => {
    const m = matchBrew(brew(reading('BFFS', { bloomHoldS: 30 })), [recipe(1, 'R1', def('BFFS', { bloomHoldS: 20 }))])!;
    expect(m).toMatchObject({ how: 'modified', diffs: [{ text: '30 s bloom', modified: true }] });
    const two = reading('BBFS', { bloomHoldS: 30 });
    expect(matchBrew(brew(two), [r1])!.diffs).not.toContainEqual({ text: 'two blooms', modified: true }); // shares apply
    const skip = def('BBFS', { pourCount: { min: 3, max: 4 } }); // 3 pours: shares skipped, bloom count diffs
    expect(matchBrew(brew(reading('BFF', { bloomHoldS: 30 })), [recipe(1, 'R', skip)])!.diffs)
      .toContainEqual({ text: '1 bloom', modified: true });
  });
  it('two blooms of 30 s vs a 20 s recipe', () => {
    const m = matchBrew(brew(reading('BBFS')), [recipe(1, 'R1', def('BBFS', { bloomHoldS: 20 }))])!;
    expect(m.diffs).toEqual([{ text: '30 s blooms', modified: true }]);
  });
  it('different fast/slow pattern is null', () => {
    const d = def('FFFS');
    expect(matchBrew(brew(reading('FFSS')), [recipe(1, 'R', { ...d, pours: d.pours.map((p) => ({ ...p, grams: null })) })])).toBeNull();
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
    const a = recipe(1, 'R1', def('BFFS', { ratio: { targets: [17.2], tol: 1 } }));
    const b = recipe(2, 'R2', def('BFFS', { ratio: { targets: [16.8], tol: 1 } }));
    expect(matchBrew(brew(reading('BFFS')), [a, b])!.recipeId).toBe(2);
    expect(matchBrew(brew(reading('BFFS')), [b, { ...b, id: 0 }])!.recipeId).toBe(0);
  });
  it('a note tag beats a closer match and works without a reading', () => {
    const tagged = recipe(2, 'R2', def('BFS'));
    const m = matchBrew(brew(reading('BFFS'), 'R2 today'), [r1, tagged])!;
    expect(m).toMatchObject({ recipeId: 2, how: 'logged', distance: 0 });
    expect(matchBrew(brew(null, 'R2'), [tagged])).toMatchObject({ how: 'logged', diffs: [] });
  });
  it('picks the closer carrier of a shared tag', () => {
    const washed = recipe(1, 'W', def('BFFS', { ratio: { targets: [16.7], tol: 0.5 }, tempC: 91.5 }), ['4SY']);
    const natural = recipe(2, 'N', def('BFFS', { ratio: { targets: [15.3], tol: 0.5 }, tempC: 85 }), ['4SY']);
    const r = reading('BFFS', { ratio: 15.3 });
    expect(matchBrew(brew(r, '4SY', 85), [washed, natural])).toMatchObject({ recipeId: 2, how: 'logged' });
    expect(matchBrew(brew(reading('BFFS', { ratio: 30 }), '4SY', 85), [washed, natural])!.recipeId).toBe(2);
    expect(matchBrew(brew(null, '4SY'), [washed, natural])!.recipeId).toBe(1);
  });
  it('a tagged brew without a usable ratio still reports its diffs', () => {
    const t = recipe(1, 'R1', def('BFS'));
    const m = matchBrew(brew(reading('BFFFF', { ratio: null }), 'R1'), [t])!;
    expect(m.diffs.map((d) => d.text)).toContain('5 pours');
  });
  it('a gate-failing logged brew carries its diffs', () => {
    const t = recipe(1, 'R1', def('BFS'));
    const m = matchBrew(brew(reading('BFFF'), 'R1'), [t])!;
    expect(m).toMatchObject({ recipeId: 1, how: 'logged' });
    expect(m.diffs.map((d) => d.text)).toContain('4 pours');
  });
  it('shared-tag ties go to the lower id', () => {
    const a = recipe(2, 'A', def('BFS'), ['T']), b = recipe(1, 'B', def('BFS'), ['T']);
    expect(matchBrew(brew(reading('BFS'), 'T'), [a, b])!.recipeId).toBe(1);
  });
  it('a pour with only a rate range aligns by its midpoint', () => {
    const rate = recipe(1, 'R1', {
      ...def('F'), pours: [rp('slow', false, { rateGps: [14, 20] })]
    });
    expect(matchBrew(brew(reading('F')), [rate])).not.toBeNull();
  });
});

describe('matchBrew shares and triggers', () => {
  const ctx = { recipes: [] as Recipe[], locked: new Set<string>() };
  const shared = (pat: string, shares: (number | null)[], over: Partial<RecipeDef> = {}, trig: Trigger[] = []) => {
    const d = def(pat, over);
    d.pours = d.pours.map((p, i) => ({ ...p, grams: null, share: shares[i] ?? null, trigger: trig[i] ?? null }));
    return d;
  };
  const g = (xs: number[]) => xs.map((x) => x * 300);
  const fit = (d: RecipeDef, r: PourReading, t: number | null = null) => fitRecipe(d, brew(r, null, t), ctx);
  const four = shared('BFFS', [0.205, 0.181, 0.302, 0.311]);
  it('shares within 6 pts match', () => {
    expect(fit(four, reading('BFFS', {}, g([0.25, 0.18, 0.27, 0.3]))).pass).toBe(true);
    const off = fit(four, reading('BFFS', {}, g([0.275, 0.18, 0.232, 0.313])));
    expect(off).toMatchObject({ pass: false, failed: 'shares' });
    expect(matchBrew(brew(reading('BFFS', {}, g([0.275, 0.18, 0.232, 0.313]))), [recipe(1, 'R', four)])).toBeNull();
  });
  it('consecutive low pours are one share', () => {
    const t: Trigger[] = [null, null, null, { kind: 'low' }, { kind: 'low' }];
    const bbj = shared('BFFFF', [0.209, 0.178, 0.192, 0.15, 0.278], {}, t);
    for (const s of [[0.209, 0.178, 0.192, 0.15, 0.278], [0.209, 0.178, 0.192, 0.21, 0.22]])
      expect(fit(bbj, reading('BFFFF', {}, g(s))).pass).toBe(true);
    expect(fit(bbj, reading('BFFFF', {}, g([0.209, 0.178, 0.192, 0.1, 0.22]))).failed).toBe('shares');
  });
  it('equal split uses 1/N', () => {
    const eq = shared('BFFF', [null, null, null, null], { equalSplit: true, pourCount: { min: 4, max: 5 } });
    expect(fit(eq, reading('BFFF', {}, g([0.25, 0.25, 0.25, 0.25]))).pass).toBe(true);
    expect(fit(eq, reading('BFFFF', {}, g([0.2, 0.2, 0.2, 0.2, 0.2]))).pass).toBe(true);
    expect(fit(eq, reading('BFFFF', {}, g([0.175, 0.175, 0.175, 0.175, 0.3]))).failed).toBe('shares');
  });
  it('equal split with more pours than listed checks only listed triggers', () => {
    const eq = shared('BFFF', [null, null, null, null], { equalSplit: true, pourCount: { min: 4, max: 5 } },
      [null, { kind: 'after', targetS: 30, maxS: 60 }]);
    const r = (gap: number) => reading('BFFFF', {}, g([0.2, 0.2, 0.2, 0.2, 0.2]), [0, gap, 70, 80, 90]);
    expect(fit(eq, r(40)).diffs).toEqual([]);
    expect(fit(eq, r(10)).diffs).toEqual([{ text: 'pour 2 after 10 s', modified: true }]);
  });
  it('count inside the range but not the listed pours skips shares', () => {
    const d = shared('BFF', [0.2, 0.4, 0.4], { pourCount: { min: 2, max: 4 } });
    expect(fit(d, reading('BF', {}, g([0.7, 0.3]))).pass).toBe(true);
  });
  it('no amounts skips shares', () => {
    const d = shared('BFFS', [null, null, null, null]);
    const f = fit(d, reading('BFFS', {}, g([0.4, 0.1, 0.2, 0.3])));
    expect(f.pass).toBe(true);
    expect(Number.isFinite(f.distance)).toBe(true);
  });
  it('bloom count is no gate when shares apply', () => {
    const f = fit(four, reading('BBFS', {}, g([0.205, 0.181, 0.302, 0.311])));
    expect(f).toMatchObject({ pass: true, how: 'match' });
    expect(f.diffs.map((x) => x.text)).not.toContain('two blooms');
  });
  it('speed exception', () => {
    const eq = shared('FFFF', [null, null, null, null], { equalSplit: true });
    expect(fit(eq, reading('SSSS', {}, g([0.25, 0.25, 0.25, 0.25])))).toMatchObject({
      pass: true, how: 'modified', diffs: [{ text: 'slow pours', modified: true }]
    });
    const none = shared('FFFF', [null, null, null, null]);
    expect(fit(none, reading('SSSS', {}, g([0.25, 0.25, 0.25, 0.25]))).failed).toBe('pattern');
  });
  it('trigger grace', () => {
    const d = shared('FF', [0.5, 0.5], {}, [null, { kind: 'after', targetS: 20, maxS: 30 }]);
    const gap = (s: number) => fit(d, reading('FF', {}, g([0.5, 0.5]), [3, 3 + s]));
    expect(gap(15)).toMatchObject({ how: 'match', diffs: [] });
    expect(gap(35)).toMatchObject({ how: 'match', diffs: [] });
    expect(gap(14)).toMatchObject({ how: 'modified', diffs: [{ text: 'pour 2 after 14 s', modified: true }] });
    expect(gap(36).how).toBe('modified');
    const low = shared('FF', [0.5, 0.5], {}, [null, { kind: 'low' }]);
    expect(fit(low, reading('FF', {}, g([0.5, 0.5]), [0, 99])).diffs).toEqual([]);
  });
  it('a speed mismatch outweighs a trigger miss when ranking equal splits', () => {
    const t: Trigger[] = [null, { kind: 'after', targetS: 20, maxS: 30 }, null, null, null];
    const fast = recipe(1, 'Fast', shared('FFFFF', Array(5).fill(null), { equalSplit: true, pourCount: { min: 5, max: 5 } }, t));
    const slow = recipe(2, 'Slow', shared('SSSSS', Array(5).fill(null), { equalSplit: true, pourCount: { min: 5, max: 5 } }));
    // pour 2 starts 60 s after pour 1 (misses the trigger on Fast); Slow would need a 1.0 speed diff.
    const b = brew(reading('FFFFF', {}, g([0.2, 0.2, 0.2, 0.2, 0.2]), [0, 60, 70, 80, 90]));
    expect(matchBrew(b, [slow, fast])!.recipeId).toBe(1);
    expect(fit(slow.def, b.reading!).distance - fit(fast.def, b.reading!).distance).toBeCloseTo(0.5);
  });
  describe('flow-controlling dripper', () => {
    const mk = (drippers: string[]) => {
      const d = def('BFFS', { drippers, pourCount: { min: 4, max: 4 }, ratio: { targets: [18], tol: 0.5 } });
      d.pours = d.pours.map((p, i) => ({ ...p, grams: null, share: 0.25, trigger: i ? { kind: 'after', targetS: 20, maxS: 30 } : null }));
      return d;
    };
    const any = mk(['Gabi Master A']);
    const b = (pat: string, over: Partial<PourReading> = {}, dripper: string | null = 'Gabi Master A') =>
      ({ ...brew(reading(pat, { ratio: 18, ...over }, undefined, [0, 100, 200, 300, 400])), dripper });
    const lock = { recipes: [] as Recipe[], locked: new Set<string>() };
    it.each(['BF', 'BFF', 'BFFFF', 'FFF', 'BBFS', 'SSS'])('matches %s on the dripper', (pat) => {
      expect(fitRecipe(any, b(pat), lock)).toMatchObject({ pass: true, how: 'match', diffs: [] });
    });
    it('a wrong ratio or other dripper fails', () => {
      expect(fitRecipe(any, b('BFF', { ratio: 16 }), lock).failed).toBe('ratio');
      expect(fitRecipe(any, b('BFF', {}, 'Orea'), lock).failed).toBe('dripper');
    });
    it('listing another dripper too keeps the normal rules', () => {
      expect(fitRecipe(mk(['Gabi Master A', 'Orea']), b('BFF'), lock).failed).toBe('count');
      expect(controlsFlow(mk(['Gabi Master A']))).toBe(true);
      expect(controlsFlow(mk([]))).toBe(false);
      expect(flowNote(['Gabi Master A'])).toBe("Gabi Master A controls the flow: pour amounts, pour count and speed don't matter.");
      expect(flowNote(['Gabi Master A', 'Orea'])).toBeNull();
    });
  });
  it('temperature', () => {
    const d = def('FF', { tempC: 91.5 });
    const t = (c: number | null) => fit(d, reading('FF'), c);
    expect(t(93)).toMatchObject({ how: 'match', diffs: [{ text: '93 °C vs 91.5 °C', modified: false }] });
    expect(t(94)).toMatchObject({ how: 'modified' });
    expect(t(null).diffs).toEqual([]);
    expect(t(0).diffs).toEqual([]);
  });
  it('distance prefers the closer temperature', () => {
    const a = recipe(1, 'A', def('FF', { tempC: 91.5 }));
    const b = recipe(2, 'B', def('FF', { tempC: 85 }));
    expect(matchBrew(brew(reading('FF'), null, 86), [a, b])!.recipeId).toBe(2);
  });
  it('ratio list', () => {
    const d = def('FF', { ratio: { targets: [15, 16.7, 18], tol: 0.5 } });
    expect(fit(d, reading('FF', { ratio: 15.4 })).pass).toBe(true);
    expect(fit(d, reading('FF', { ratio: 18.3 })).pass).toBe(true);
    expect(fit(d, reading('FF', { ratio: 17.3 }))).toMatchObject({ pass: false, failed: 'ratio' });
  });
});

describe('withDefaults', () => {
  it('reads a legacy def', () => {
    const { equalSplit, drippers, anySpeed, ...legacy } = def('BFS') as any;
    legacy.pours = legacy.pours.map(({ trigger, ...p }: any) => p);
    legacy.ratio = { target: 16.7, tol: 0.7 };
    const d = withDefaults(legacy);
    expect(d).toMatchObject({ equalSplit: false, drippers: [], anySpeed: false, ratio: { targets: [16.7], tol: 0.7 } });
    expect(d.pours.every((p) => p.trigger === null)).toBe(true);
  });
});

describe('describeRecipe', () => {
  it('lists several ratios', () => {
    expect(describeRecipe(def('BFS', { ratio: { targets: [15, 16.7, 18], tol: 0.7 } }))).toContain('~1:15, 16.7 or 18');
  });
  it('bloom + fast pours with a count range', () => {
    const d = def('BFFF', { pourCount: { min: 4, max: 5 }, ratio: { targets: [16.7], tol: 0.7 }, totalS: 150 });
    expect(describeRecipe(d)).toBe('30 s bloom + 3-4 fast pours · ~1:16.7');
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
      pourCount: { min: 4, max: 4 }, bloomHoldS: 30, bloomHoldTolS: 5, ratio: { targets: [16.8], tol: 0.5 }, tempC: 92, equalSplit: false
    });
    expect(d.pours.every((p) => p.trigger === null)).toBe(true);
    expect(d.pours[0].swirlAfter).toBe(false);
    expect(parseRecipeDef(d)).toEqual({ def: d });
    expect(recipeTimeline(d).pours).toHaveLength(4);
  });
});

describe('recipeTimeline triggers', () => {
  const after = (t: number, m: number): Trigger => ({ kind: 'after', targetS: t, maxS: m });
  const timed = (trigs: Trigger[], starts: (number | null)[]) =>
    def('FFFF', { pours: trigs.map((trigger, i) => rp('fast', false, { trigger, startS: starts[i], durationS: 5 })) });
  it('places timed pours from the previous start and draws their windows', () => {
    const tl = recipeTimeline(timed([null, after(20, 30), after(20, 30), { kind: 'low' }], [0.3, null, null, 90]));
    expect(tl.pours.map((p) => p.startS)).toEqual([0.3, 20.3, 40.3, 90]);
    expect(tl.windows).toEqual([{ fromS: 20.3, toS: 30.3 }, { fromS: 40.3, toS: 50.3 }]);
  });
  it('legacy triggers leave the chain unchanged and draw no windows', () => {
    const tl = recipeTimeline(timed([null, null, null, null], [null, null, 12, null]));
    expect(tl.pours.map((p) => p.startS)).toEqual([0, 5, 12, 17]);
    expect(tl.windows).toEqual([]);
  });
  it('triggerWindows skips low/legacy steps and steps past the starts given', () => {
    const d = timed([null, after(20, 30), { kind: 'low' }, after(10, 10)], [0, null, null, null]);
    expect(triggerWindows(d, [0, 25, 60])).toEqual([{ fromS: 20, toS: 30 }]);
    expect(triggerWindows(d, [0, 25, 60, 70])).toEqual([{ fromS: 20, toS: 30 }, { fromS: 70, toS: 70 }]);
  });
});

describe('convertAmounts', () => {
  const pour = (grams: number | null, share: number | null = null) =>
    ({ bloom: false, grams, share, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: null, durationS: null, trigger: null }) as const;
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
    expect(describeRecipe({ ...base, ratio: { targets: [], tol: 0.7 } })).toContain('ratio unknown');
    expect(describeRecipe({ ...base, ratio: { targets: [], tol: 0.7 } })).not.toContain('~1:');
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

describe('hasWord', () => {
  it('finds whole words only', () => {
    expect(hasWord('BBS.', 'bbs')).toBe(0);
    expect(hasWord('xBBS', 'BBS')).toBe(-1);
  });
});

describe('middleHalf', () => {
  it('is the middle 50% of timed brews, and nothing for fewer than four', () => {
    expect(middleHalf([100, 160, 170, 180, 190, 400])).toEqual({ lo: 163, hi: 188, n: 6 });
    expect(middleHalf([0, 150, 160, 170])).toBeNull();
    expect(fmtRange({ lo: 155, hi: 185 })).toBe('2:35–3:05');
  });
});
