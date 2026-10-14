// Changed files -> which test:ui route tags to run (npm run test:changed). Shared or unknown
// paths run everything: the full suite is still the gate before every push.
export type Scope = { kind: 'full'; reason: string } | { kind: 'tags'; tags: string[] } | { kind: 'none' };
const NO_UI = [/^docs\//, /\.md$/, /\.test\.ts$/, /^AppsScript\//, /^deploy\//, /^\.claude\//];
const ROUTES: [RegExp, string][] = [
  [/^src\/routes\/(coffees|insights|stats|on-deck|subscriptions|login)\//, '@$1'],
  [/^src\/lib\/server\/insights\//, '@insights'],
  [/^src\/lib\/insightsUrl\.ts$/, '@insights']
];
export function scopeFor(files: string[]): Scope {
  const tags = new Set<string>();
  for (const f of files) {
    if (NO_UI.some((re) => re.test(f))) continue;
    const route = ROUTES.find(([re]) => re.test(f));
    if (!route) return { kind: 'full', reason: `${f} is shared or unmapped` };
    const [re, tag] = route;
    tags.add(re.exec(f)![0].replace(re, tag)); // '@$1' -> '@coffees'
  }
  return tags.size ? { kind: 'tags', tags: [...tags].sort() } : { kind: 'none' };
}
