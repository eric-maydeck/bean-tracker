import { describe, it, expect } from 'vitest';
import { scopeFor } from './testScope.ts';

// A tiny src/ tree: the shared label is imported by a component insights and stats use.
const SRC = {
  'src/routes/+layout.svelte': `<script>import Icon from '$lib/components/Icon.svelte';</script>`,
  'src/app.css': '',
  'src/lib/components/Icon.svelte': '',
  'src/lib/components/Label.svelte': '',
  'src/lib/components/Tile.svelte': `<script>\n  import {\n    x\n  } from './Label.svelte';\n</script>`,
  'src/routes/stats/+page.svelte': `<script>import Tile from '$lib/components/Tile.svelte';import Water from './Water.svelte';import B from './Brewing.svelte';import Gear from './Gear.svelte';</script>`,
  'src/routes/stats/Water.svelte': `<script>import W from '$lib/water.ts';</script>`,
  'src/routes/stats/Gear.svelte': `<script>import W from '$lib/water.ts';</script>`,
  'src/lib/water.ts': '',
  'src/lib/gear.ts': '',
  'src/routes/stats/Brewing.svelte': `<script>import G from '$lib/gear.ts';</script>`,
  'src/routes/on-deck/+page.svelte': `<script>import Tile from '$lib/components/Tile.svelte';</script>`,
  'src/routes/coffees/+page.svelte': `<script>fetch('/api/coffees/save', {});</script>`,
  'src/routes/api/coffees/save/+server.ts': `import { save } from '$lib/server/coffees';`,
  'src/lib/server/coffees.ts': '',
  'src/routes/login/+page.svelte': `<script>import { v } from '$lib/util';</script>`,
  'src/lib/util.ts': `export { v } from './inner';`,
  'src/lib/inner.ts': '',
  'src/lib/orphan.ts': ''
};

describe('scopeFor', () => {
  it('maps a route file to its tag', () => {
    expect(scopeFor(['src/routes/stats/+page.svelte'], SRC)).toEqual({ kind: 'tags', tags: ['@stats'] });
  });
  it('follows importers transitively: a shared component pulls in every route using it', () => {
    // The known miss of the old path regex: a shared label failed insights-lab states at push.
    expect(scopeFor(['src/lib/components/Label.svelte'], SRC)).toEqual({ kind: 'tags', tags: ['@on-deck', '@stats'] });
  });
  it('narrows to the tabs a file is reached through, unless the page imports it directly', () => {
    expect(scopeFor(['src/routes/stats/Water.svelte'], SRC)).toEqual({ kind: 'tags', tags: ['@stats:water'] });
    expect(scopeFor(['src/lib/gear.ts'], SRC)).toEqual({ kind: 'tags', tags: ['@stats:brewing'] });
    expect(scopeFor(['src/lib/water.ts'], SRC)).toEqual({ kind: 'tags', tags: ['@stats:gear', '@stats:water'] });
    expect(scopeFor(['src/lib/components/Label.svelte'], SRC)).toEqual({ kind: 'tags', tags: ['@on-deck', '@stats'] });
  });
  it('follows /api/ calls from pages to their endpoints', () => {
    expect(scopeFor(['src/lib/server/coffees.ts'], SRC)).toEqual({ kind: 'tags', tags: ['@coffees'] });
  });
  it('runs everything for root files, untagged routes, orphans and non-src files', () => {
    for (const f of ['src/routes/+layout.svelte', 'src/app.css', 'src/lib/components/Icon.svelte', 'src/lib/inner.ts',
      'src/lib/orphan.ts', 'src/lib/gone.ts', 'tests/ui/checkLayout.ts', 'playwright.config.ts', 'package.json'])
      expect(scopeFor([f], SRC).kind, f).toBe('full');
  });
  it('skips UI tests for docs, unit tests and fixtures only', () => {
    expect(scopeFor(['docs/notes.md', 'src/lib/x.test.ts', 'src/lib/server/fixtures/a.json'], SRC)).toEqual({ kind: 'none' });
    expect(scopeFor([], SRC)).toEqual({ kind: 'none' });
  });
  it('reads the real src/ tree', () => {
    expect(scopeFor(['src/routes/stats/+page.svelte'])).toEqual({ kind: 'tags', tags: ['@stats'] });
    expect(scopeFor(['src/routes/+layout.svelte']).kind).toBe('full');
    expect(scopeFor(['src/routes/stats/SweetSpots.svelte'])).toEqual({ kind: 'tags', tags: ['@stats:sweetspots'] });
  });
});
