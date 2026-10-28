import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTE_WORDS, brewAgitation, noteAgitation, parseNoteWords, sequenceLabel, speedGuess,
  type Agitation, type NoteWord
} from './agitation';
import type { PourReading } from './pours';
import type { RecipeDef } from './recipes';

const pour = (avgGps: number, bloom = false) => ({ startS: 0, durationS: 10, grams: 50, avgGps, peakGps: avgGps, speed: 'slow' as const, bloom, contactS: 10 });
const reading = (...gps: number[]) => ({ pours: [pour(3, true), ...gps.map((g) => pour(g))] }) as unknown as PourReading;
const def = (...ag: (Agitation | null)[]) =>
  ({ pours: [{ bloom: true, agitation: null }, ...ag.map((agitation) => ({ bloom: false, agitation }))] }) as unknown as RecipeDef;
const b = (o: Partial<Parameters<typeof brewAgitation>[0]>) =>
  brewAgitation({ reading: null, how: null, recipe: null, notes: null, speedBlind: false, ...o }, DEFAULT_NOTE_WORDS);

describe('brewAgitation', () => {
  it('uniform recipe applies across pour counts', () =>
    expect(brewAgitation({ reading: reading(8, 8, 8), how: 'modified', recipe: def('low', 'low'), notes: null, speedBlind: true }, DEFAULT_NOTE_WORDS))
      .toEqual({ agitation: 'low', set: true, pours: ['low', 'low', 'low'] }));
  it('aligned recipe pours on match', () =>
    expect(b({ reading: reading(8, 8, 8), how: 'match', recipe: def('high', 'high', 'low') }))
      .toEqual({ agitation: 'mixed', set: true, pours: ['high', 'high', 'low'] }));
  it('match with an extra pour repeats the last recipe pour', () =>
    expect(b({ reading: reading(8, 8, 8), how: 'match', recipe: def('high', 'low') }).pours).toEqual(['high', 'low', 'low']));
  it('modified with another pour count falls to the note', () =>
    expect(b({ reading: reading(8, 8, 8), how: 'modified', recipe: def('high', 'low'), notes: 'Low agitation today.', speedBlind: true }))
      .toEqual({ agitation: 'low', set: true, pours: ['low', 'low', 'low'] }));
  it('then to the speed guess, inferred', () =>
    expect(b({ reading: reading(12, 8, 5) })).toEqual({ agitation: 'mixed', set: false, pours: ['high', 'medium', 'low'] }));
  it('a From speed pour is guessed, the brew is not set', () =>
    expect(b({ reading: reading(12, 12), how: 'match', recipe: def('high', null) })).toEqual({ agitation: 'high', set: false, pours: ['high', 'high'] }));
  it('speed-blind without recipe or note is unknown', () =>
    expect(b({ reading: reading(12, 12), speedBlind: true })).toEqual({ agitation: 'unknown', set: false, pours: [null, null] }));
  it('no reading and no recipe is unknown', () =>
    expect(b({})).toEqual({ agitation: 'unknown', set: false, pours: [] }));
  it('logged by note without a reading uses the recipe', () =>
    expect(b({ how: 'logged', recipe: def('medium', 'medium') })).toEqual({ agitation: 'medium', set: true, pours: ['medium'] }));
  it('a note with words for two agitations is mixed', () => {
    const words: NoteWord[] = [{ word: 'fast', agitation: 'high' }, { word: 'slow', agitation: 'low' }];
    expect(brewAgitation({ reading: reading(8, 8), how: null, recipe: null, notes: 'fast then slow', speedBlind: true }, words))
      .toMatchObject({ agitation: 'mixed', set: true });
  });
});

describe('helpers', () => {
  it('sequenceLabel collapses runs', () =>
    expect(sequenceLabel(['high', 'high', 'medium', 'low', 'low'])).toBe('High then Medium then Low'));
  it('speedGuess edges', () => expect([6, 6.01, 10, 10.01].map(speedGuess)).toEqual(['low', 'medium', 'medium', 'high']));
  it('note words are whole words, case-insensitive', () => {
    expect(noteAgitation('High Agitation!', DEFAULT_NOTE_WORDS)).toBe('high');
    expect(noteAgitation('highagitation', DEFAULT_NOTE_WORDS)).toBeNull();
    expect(noteAgitation('xhigh agitation', DEFAULT_NOTE_WORDS)).toBeNull();
  });
  it('parseNoteWords errors', () => {
    const w = (word: string) => ({ word, agitation: 'high' });
    expect(parseNoteWords([])).toEqual({ words: [] });
    expect(parseNoteWords([w('  hi  ')])).toEqual({ words: [{ word: 'hi', agitation: 'high' }] });
    expect(parseNoteWords([w(' ')])).toEqual({ error: 'Add a word or phrase' });
    expect(parseNoteWords([w('x'.repeat(41))])).toEqual({ error: 'Keep each word under 40 characters' });
    expect(parseNoteWords([w('Hi'), w('hi')])).toEqual({ error: 'Each word can be listed once' });
    expect(parseNoteWords(Array.from({ length: 21 }, (_, i) => w(`w${i}`)))).toEqual({ error: 'Up to 20 words' });
    expect(parseNoteWords('x')).toEqual({ error: 'Invalid words' });
    expect(parseNoteWords([{ word: 'a', agitation: 'wild' }])).toEqual({ error: 'Invalid words' });
  });
});
