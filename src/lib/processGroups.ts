// Processing labels are free text; insights group them by keyword, first
// matching rule wins (spec "Process groups"). Decaf is its own flag
// (coffees.decaf), so a decaf is grouped by its underlying method.
const RULES = [
  ['Co-ferment / Infused', (s: string) => /co-?ferment|thermal shock|tartaric|pink champagne|infused/.test(s)],
  ['Inoculated', (s: string) => /inoculated|yeast|lactobacillus|wild ferment/.test(s)],
  // "fermented" as a word, so "Washed (72 Hours Wet Fermentation …)" stays plain Washed
  ['Extended Ferment Washed', (s: string) => /\b(double|triple|extended) ferment|\bfermented\b/.test(s) && s.includes('washed')],
  ['Anaerobic Natural', (s: string) => /anaerobic|anoxic|bioreactor|carbonic/.test(s) && s.includes('natural')],
  ['Anaerobic Washed', (s: string) => /anaerobic|anoxic|tyox/.test(s) && s.includes('washed')],
  ['Honey', (s: string) => s.includes('honey')],
  ['Natural', (s: string) => s.includes('natural')],
  ['Washed', (s: string) => /washed|demucilaged/.test(s)]
] as const;

export type ProcessGroup = (typeof RULES)[number][0] | 'Other / Unknown';
export const PROCESS_GROUPS: readonly ProcessGroup[] = [...RULES.map(([g]) => g), 'Other / Unknown'];

export function processGroup(processing: string | null): ProcessGroup {
  const s = (processing ?? '').toLowerCase();
  return RULES.find(([, test]) => test(s))?.[0] ?? 'Other / Unknown';
}
