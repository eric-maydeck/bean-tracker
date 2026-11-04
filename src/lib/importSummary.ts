import type { ImportChanges } from './server/beanconqueror';

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// Short lines for the Account page after a Bean Conqueror upload; zero parts are left out.
export function importSummary(c: ImportChanges): { headline: string | null; lines: string[] } {
  const lines: string[] = [];
  for (const [key, one] of [['brews', 'brew'], ['beans', 'bean'], ['waters', 'water']] as const) {
    const { new: n, updated: u } = c[key];
    const parts = [n && `${n} new ${n === 1 ? one : one + 's'}`, u && `${u}${n ? '' : ' ' + (u === 1 ? one : one + 's')} updated`].filter(Boolean);
    if (parts.length) lines.push(parts.join(', '));
  }
  if (c.autoLinked) lines.push(`${plural(c.autoLinked, 'bean')} linked to ${c.autoLinked === 1 ? 'its coffee' : 'their coffees'}`);
  const changed = lines.length > 0 || c.untracked.added > 0;
  if (c.untracked.total) {
    lines.push(`${plural(c.untracked.total, 'bean')} not tracked yet${c.untracked.added ? ` (${c.untracked.added} new)` : ''}`);
  }
  // A re-upload still reports the standing untracked count, after "Nothing changed."
  return { headline: changed ? null : 'Nothing changed.', lines };
}
