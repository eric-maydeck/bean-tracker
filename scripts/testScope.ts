// Changed files -> which test:ui route tags to run (test:changed and the non-release pre-push gate).
// A src/ file's tags are the tagged routes that import it, transitively (import lines parsed here,
// no dependency). Reaching the root layout/hooks, an untagged route, or no route at all, or any
// file outside src/, runs everything. One narrowing: a file the insights page reaches only through tab components
// (src/routes/insights/<Tab>.svelte) runs just those tabs' states (@insights:<tab>, from each state's ?tab=).
// A tab state reached by clicking the View select from another tab's URL isn't matched; the release gate is.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

export type Scope = { kind: 'full'; reason: string } | { kind: 'tags'; tags: string[] } | { kind: 'none' };
const NO_UI = [/^docs\//, /\.md$/, /\.test\.ts$/, /^deploy\//, /^\.claude\//,
  /^src\/lib\/server\/fixtures\//];
// The test:ui tag is a state's first path segment (routeTag in tests/ui/layout.spec.ts).
const TAGGED = /^src\/routes\/(coffees|insights|stats|on-deck|subscriptions)\//;
// Shared by every route: the root layout/page, hooks, app.css, app.html.
const EVERY_ROUTE = /^src\/(routes\/\+|hooks|app\.)/;
const INSIGHTS_PAGE = 'src/routes/insights/+page.svelte';
const TAB = /^src\/routes\/insights\/(Leaderboards|Habits|Consumption|Records|Milestones|Insights|SweetSpots|Brewing|Water|Gear)\.svelte$/;
const EXTS = ['', '.ts', '.js', '.svelte', '/index.ts', '/index.js'];
// A '/api/...' string in a caller counts as importing that endpoint's +server.ts.
const API_CALL = /['"`](\/api\/[\w/-]+)/g;
const IMPORT = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

// Every file under src/ except unit tests (they import routes but aren't UI): path -> text.
export function srcFiles(dir = 'src'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const p = join(e.parentPath, e.name);
    if (e.isFile() && !/\.test\.ts$/.test(p)) out[p] = readFileSync(p, 'utf8');
  }
  return out;
}

// file -> the src files that import it directly ($lib/ and relative specifiers only).
function importers(sources: Record<string, string>) {
  const out = new Map<string, string[]>();
  for (const [file, text] of Object.entries(sources)) {
    for (const m of text.matchAll(IMPORT)) {
      const spec = m[1] ?? m[2];
      const base = spec.startsWith('$lib/') ? 'src/lib/' + spec.slice(5)
        : spec.startsWith('.') ? normalize(join(dirname(file), spec)) : null;
      const target = base === null ? undefined : EXTS.map((e) => base + e).find((p) => p in sources);
      if (target) out.set(target, [...(out.get(target) ?? []), file]);
    }
    for (const [, path] of text.matchAll(API_CALL)) {
      const target = `src/routes${path}/+server.ts`;
      if (target in sources) out.set(target, [...(out.get(target) ?? []), file]);
    }
  }
  return out;
}

export function scopeFor(files: string[], sources?: Record<string, string>): Scope {
  const full = (reason: string): Scope => ({ kind: 'full', reason });
  const tags = new Set<string>();
  let graph: Map<string, string[]> | undefined;
  for (const f of files) {
    if (NO_UI.some((re) => re.test(f))) continue;
    if (!f.startsWith('src/')) return full(`${f} is outside src/`);
    sources ??= srcFiles();
    if (!(f in sources)) return full(`${f} is deleted or unreadable`);
    graph ??= importers(sources);
    const reach = (skip?: (from: string, to: string) => boolean) => {
      const seen = new Set([f]);
      for (const x of seen) for (const y of graph!.get(x) ?? []) if (!skip?.(x, y)) seen.add(y); // Set iteration visits additions
      return seen;
    };
    const seen = reach();
    const viaTabs = !reach((from, to) => TAB.test(from) && to === INSIGHTS_PAGE).has(INSIGHTS_PAGE);
    // API endpoints only pass through to the pages that call them.
    const routes = [...seen].filter((p) => EVERY_ROUTE.test(p)
      || (p.startsWith('src/routes/') && !p.startsWith('src/routes/api/')));
    if (!routes.length) return full(`${f} reaches no route`);
    const tabs = routes.flatMap((r) => TAB.exec(r)?.[1].toLowerCase() ?? []);
    // Insights files that are entries (+page.server.ts ...) or not behind a tab keep the whole route.
    const narrow = viaTabs && tabs.length && !routes.some((r) => r.startsWith('src/routes/insights/+') && r !== INSIGHTS_PAGE);
    for (const r of routes) {
      const m = TAGGED.exec(r);
      if (!m) return full(`${f} reaches ${r}`);
      if (!(m[1] === 'insights' && narrow)) tags.add('@' + m[1]);
    }
    if (narrow) tabs.forEach((x) => tags.add('@insights:' + x));
  }
  return tags.size ? { kind: 'tags', tags: [...tags].sort() } : { kind: 'none' };
}
