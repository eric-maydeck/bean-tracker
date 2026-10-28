// Pour agitation as a label, never a fact: from the recipe, the brew's note words, or pour speed.
import type { PourReading } from './pours';
import { hasWord, type Match, type RecipeDef } from './recipes';

export type Agitation = 'high' | 'medium' | 'low';
export type BrewAgitation = Agitation | 'mixed' | 'unknown';
export const AGITATION_LABEL: Record<BrewAgitation, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  mixed: 'Mixed',
  unknown: 'Unknown'
};

export interface NoteWord {
  word: string;
  agitation: Agitation;
}
export const DEFAULT_NOTE_WORDS: NoteWord[] = [
  { word: 'high agitation', agitation: 'high' },
  { word: 'low agitation', agitation: 'low' }
];
export const NOTE_WORDS_MAX = 20;
export const NOTE_WORD_LEN = 40;

export function parseNoteWords(input: unknown): { words: NoteWord[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Invalid words' };
  if (input.length > NOTE_WORDS_MAX) return { error: `Up to ${NOTE_WORDS_MAX} words` };
  const words: NoteWord[] = [];
  const seen = new Set<string>();
  for (const w of input) {
    if (!w || typeof w.word !== 'string' || !['high', 'medium', 'low'].includes(w.agitation))
      return { error: 'Invalid words' };
    const word = w.word.trim();
    if (!word) return { error: 'Add a word or phrase' };
    if (word.length > NOTE_WORD_LEN) return { error: `Keep each word under ${NOTE_WORD_LEN} characters` };
    if (seen.has(word.toLowerCase())) return { error: 'Each word can be listed once' };
    seen.add(word.toLowerCase());
    words.push({ word, agitation: w.agitation });
  }
  return { words };
}

export const speedGuess = (gps: number): Agitation => (gps <= 6 ? 'low' : gps <= 10 ? 'medium' : 'high');

/** Runs collapsed: High, High, Low -> "High then Low". */
export function sequenceLabel(pours: readonly Agitation[]): string {
  return pours
    .filter((a, i) => a !== pours[i - 1])
    .map((a) => AGITATION_LABEL[a])
    .join(' then ');
}

export function noteAgitation(note: string | null, words: readonly NoteWord[]): Agitation | 'mixed' | null {
  if (!note) return null;
  const found = new Set(words.filter((w) => hasWord(note, w.word) >= 0).map((w) => w.agitation));
  return found.size > 1 ? 'mixed' : ([...found][0] ?? null);
}

export interface AgitationInput {
  reading: PourReading | null;
  how: Match['how'] | null;
  recipe: RecipeDef | null;
  notes: string | null;
  speedBlind: boolean;
}

export function brewAgitation(
  b: AgitationInput,
  words: readonly NoteWord[]
): { agitation: BrewAgitation; set: boolean; pours: (Agitation | null)[] } {
  const brewPours = b.reading?.pours.filter((p) => !p.bloom) ?? [];
  const ra = b.recipe?.pours.filter((p) => !p.bloom).map((p) => p.agitation) ?? [];
  let pours: (Agitation | null)[] = [];
  if (ra.length && ra[0] && ra.every((a) => a === ra[0])) {
    pours = Array.from({ length: b.reading ? brewPours.length : 1 }, () => ra[0]);
    return { agitation: ra[0], set: true, pours };
  }
  const aligned = b.how === 'logged' || b.how === 'match' || (b.how === 'modified' && b.reading?.pours.length === b.recipe?.pours.length);
  if (aligned && ra.length)
    pours = b.reading ? brewPours.map((_, i) => ra[Math.min(i, ra.length - 1)]) : [...ra];
  else pours = brewPours.map(() => null);
  const note = noteAgitation(b.notes, words);
  if (note === 'mixed' && pours.length) return { agitation: 'mixed', set: true, pours };
  pours = pours.map((a) => a ?? (note as Agitation | null));
  let inferred = false;
  if (!b.speedBlind && b.reading)
    pours = pours.map((a, i) => {
      if (a) return a;
      inferred = true;
      return speedGuess(brewPours[i].avgGps);
    });
  if (!pours.length || pours.includes(null)) return { agitation: 'unknown', set: false, pours };
  const agitation = pours.every((a) => a === pours[0]) ? pours[0]! : 'mixed';
  return { agitation, set: !inferred, pours };
}
