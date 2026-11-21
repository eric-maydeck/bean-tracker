export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks left by NFD normalization
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// One unique slug per gear name, for keys and URL params. `+` reads as "plus" (Cafec Abaca+ is a different
// filter from Cafec Abaca); names that still slug alike (case, punctuation) take -2, -3 in code-point name order,
// since a duplicate key in a keyed {#each} crashes the page.
export function gearSlugs(names: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>(), taken = new Set<string>();
  for (const name of [...new Set(names)].sort()) {
    const base = slugify(name.replace(/\+/g, ' plus ')) || 'gear';
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    taken.add(slug);
    out.set(name, slug);
  }
  return out;
}
