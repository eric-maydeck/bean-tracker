import { describe, it, expect } from 'vitest';
import { scopeFor } from './testScope.ts';

describe('scopeFor', () => {
  it('maps a route directory to its tag', () => {
    expect(scopeFor(['src/routes/insights/+page.svelte'])).toEqual({ kind: 'tags', tags: ['@insights'] });
    expect(scopeFor(['src/routes/coffees/[slug]/+page.svelte', 'src/lib/server/insights/habits.ts']))
      .toEqual({ kind: 'tags', tags: ['@coffees', '@insights', '@stats'] });
  });
  it('runs everything for shared or unknown paths', () => {
    for (const f of ['src/routes/+layout.svelte', 'src/lib/insightsUrl.ts', 'src/routes/login/+page.svelte', 'src/app.css', 'src/lib/components/Chart.svelte',
      'tests/ui/checkLayout.ts', 'playwright.config.ts', 'package.json', 'src/lib/somethingNew.ts'])
      expect(scopeFor([f]).kind, f).toBe('full');
  });
  it('skips UI tests for docs and unit tests only', () => {
    expect(scopeFor(['docs/HANDOFF.md', 'src/lib/server/insights/habits.test.ts'])).toEqual({ kind: 'none' });
  });
  it('treats an empty change list as none', () => {
    expect(scopeFor([])).toEqual({ kind: 'none' });
  });
});
