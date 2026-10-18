// Keyword name colors (backlog: keyword name color): a coffee whose name contains a keyword (any case, any
// substring: "Skipper" matches on purpose) shows its name in that color everywhere. One line per keyword.
const RULES: { keyword: string; color: string }[] = [{ keyword: 'skip', color: 'var(--color-skip)' }];

export const nameColor = (name: string | null | undefined): string | undefined =>
  name ? RULES.find((r) => name.toLowerCase().includes(r.keyword))?.color : undefined;

// A run of text (a headline, a "Roaster · Name" label, a tip line) split into [text, color] runs: each whole
// occurrence of a colored coffee name from `names` (the root layout's `coloredNames`) gets that name's color;
// everything else stays uncolored. An occurrence must stand alone (no letter or digit right before or after it),
// so a name is never tinted inside a longer word.
// ponytail: matches the names anywhere in the text, so a roaster or origin spelled exactly like a colored coffee
// would be tinted too; send per-string names from the server if that ever happens.
export function nameRuns(text: string, names: readonly string[] = []): [string, string | undefined][] {
  const ns = names.filter((n) => n && text.includes(n)).sort((a, b) => b.length - a.length);
  if (!ns.length) return [[text, undefined]];
  const alt = ns.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return text
    .split(new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(?![\\p{L}\\p{N}])`, 'u'))
    .map((t, i): [string, string | undefined] => [t, i % 2 ? nameColor(t) : undefined])
    .filter(([t]) => t);
}
