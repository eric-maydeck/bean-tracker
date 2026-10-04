import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkLayout } from './checkLayout';

interface Seed {
  slugs: { long: string; linked: string; frozen: string; decaf: string };
  names: { long: string; everyAction: string };
}
// Read lazily: .ui-test/seed.json only exists once the web server has started.
let cached: Seed | undefined;
const seed = (): Seed => (cached ??= JSON.parse(readFileSync('.ui-test/seed.json', 'utf8')));

interface State {
  name: string;
  path: (s: Seed) => string;
  act?: (page: Page, s: Seed) => Promise<void>;
}

// Every page and state the layout rules apply to. Every UI change adds its
// states here (docs/ui-rules.md). Actions must not save anything: the
// workers share one DB.
export const STATES: State[] = [
  { name: 'coffees-compact', path: () => '/coffees?status=all&view=compact' },
  { name: 'coffees-list', path: () => '/coffees?status=all&view=list' },
  { name: 'coffees-cards', path: () => '/coffees?status=all&view=cards' },
  {
    name: 'coffees-inline-edit-pending',
    path: () => '/coffees?status=backlog&view=list',
    act: async (page, s) => {
      const row = page.getByRole('row', { name: new RegExp(s.names.everyAction) });
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      await row.getByRole('button', { name: 'Archive', exact: true }).click();
      await expect(page.getByText(/^Pending: /).first()).toBeVisible();
    }
  },
  { name: 'coffee-long', path: (s) => `/coffees/${s.slugs.long}` },
  { name: 'coffee-frozen', path: (s) => `/coffees/${s.slugs.frozen}` },
  { name: 'coffee-decaf', path: (s) => `/coffees/${s.slugs.decaf}` },
  { name: 'on-deck', path: () => '/on-deck' },
  { name: 'subscriptions-compact', path: () => '/subscriptions?view=compact' },
  { name: 'subscriptions-list', path: () => '/subscriptions?view=list' },
  {
    name: 'stats-link-picker',
    path: () => '/stats',
    act: async (page) => {
      await page.getByRole('button', { name: 'Link', exact: true }).first().click();
      await expect(page.getByRole('combobox', { name: /^Coffee to link/ })).toBeVisible();
    }
  },
  {
    name: 'coffee-linked',
    path: (s) => `/coffees/${s.slugs.linked}`,
    act: async (page) => {
      await expect(page.getByText(/Bean Conqueror: .* · 8 brews/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible();
    }
  },
  ...(['overview', 'favorites', 'brewing', 'economics'] as const).map((tab) => ({
    name: `stats-${tab}`,
    path: () => `/stats?bc=${tab}`
  }))
];

// Known failures: the list view's table is crushed at tablet width and needs a
// redesign (docs/backlog/list-view-tablet-width.md). test.fail() makes a fix
// show up as "unexpectedly passed", so these entries flag themselves. Nothing
// else gets listed here.
const KNOWN_FAILURES = new Set(['coffees-list-w768', 'coffees-inline-edit-pending-w768']);

for (const state of STATES) {
  test(state.name, async ({ page }, info) => {
    test.fail(
      KNOWN_FAILURES.has(`${state.name}-${info.project.name}`),
      'list view breaks at tablet widths: docs/backlog/list-view-tablet-width.md'
    );
    const s = seed();
    await page.goto(state.path(s), { waitUntil: 'networkidle' });
    if (state.act) await state.act(page, s);
    // Screenshot first, so a failing state still leaves a picture to look at.
    await page.screenshot({ path: `.ui-test/screenshots/${state.name}-${info.project.name}.png`, fullPage: true });
    await checkLayout(page);
  });
}
