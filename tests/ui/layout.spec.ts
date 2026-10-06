import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkLayout } from './checkLayout';

interface Seed {
  slugs: { long: string; linked: string; frozen: string; decaf: string } & Record<GramsKey, string>;
  names: { long: string; everyAction: string } & Record<GramsKey, string>;
}
// Seeded open coffees with a linked bean, and their bag text (checkLayout rule 6
// asserts each stays on one line).
const GRAMS = { big: '2kg (2kg left)', under: '999g (999g left)', part: '1.5kg (1.2kg left)' };
type GramsKey = keyof typeof GRAMS;
const GRAMS_KEYS = Object.keys(GRAMS) as GramsKey[];
// Read lazily: .ui-test/seed.json only exists once the web server has started.
let cached: Seed | undefined;
const seed = (): Seed => (cached ??= JSON.parse(readFileSync('.ui-test/seed.json', 'utf8')));

interface State {
  name: string;
  path: (s: Seed) => string;
  act?: (page: Page, s: Seed) => Promise<void>;
}

// Stats → Not yet tracked → Link on the bean row containing `text`.
async function showPicker(page: Page, text: string) {
  const row = page.locator('.compact-row-wrap, tbody tr').filter({ hasText: text }).first();
  await row.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Coffee to link/ })).toBeVisible();
}
async function openPicker(page: Page, text: string) {
  await showPicker(page, text);
  await page.getByRole('button', { name: /^Coffee to link/ }).click();
  await expect(page.getByRole('listbox')).toBeFocused(); // never the search box (phone keyboard)
}

// Twins: the meta line stays on one line and "Bag N" is its own line below it,
// in the closed button and in every Top match option.
async function expectBagOnOwnLine(page: Page) {
  const bad = await page.evaluate(() => {
    const lines = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
    };
    const boxes = [document.querySelector('.lp-btn')!, ...document.querySelectorAll('[role="group"] [role="option"]')]
      .filter((el) => el.closest('[role="group"]')?.textContent?.startsWith('Top match') ?? true);
    return boxes.flatMap((box) => {
      const [meta, twin] = box.querySelectorAll('.lp-m');
      if (!twin || !/^Added \d{4}-\d\d-\d\d · Bag \d+$/.test(twin.textContent!)) return ['no twin line'];
      if (lines(meta) !== 1) return [`meta wraps: ${meta.textContent}`];
      if (twin.getBoundingClientRect().top < meta.getBoundingClientRect().bottom - 1) return ['twin line not below meta'];
      return [];
    });
  });
  expect(bad).toEqual([]);
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
  {
    name: 'on-deck',
    path: () => '/on-deck',
    act: async (page) => {
      for (const text of Object.values(GRAMS)) await expect(page.getByText(text, { exact: true })).toBeVisible();
    }
  },
  {
    // An expanded compact row shows the whole name, wrapped, not an ellipsis.
    name: 'coffees-compact-long-expanded',
    path: () => '/coffees?status=open&view=compact',
    act: async (page: Page, s: Seed) => {
      const row = page.getByRole('button', { name: new RegExp(s.names.long.slice(0, 20)) });
      await row.click();
      const title = row.locator('.compact-row-title');
      await expect(title).toContainText(s.names.long);
      expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  },
  ...GRAMS_KEYS.flatMap((k) => [
    {
      name: `coffees-compact-grams-${k}`,
      path: () => '/coffees?status=open&view=compact',
      act: async (page: Page, s: Seed) => {
        await page.getByRole('button', { name: new RegExp(s.names[k]) }).click();
        await expect(page.getByText(GRAMS[k]).first()).toBeVisible();
      }
    },
    {
      name: `coffee-grams-${k}`,
      path: (s: Seed) => `/coffees/${s.slugs[k]}`,
      act: async (page: Page) => {
        await expect(page.getByText(GRAMS[k], { exact: true })).toBeVisible();
      }
    }
  ]),
  { name: 'subscriptions-compact', path: () => '/subscriptions?view=compact' },
  { name: 'subscriptions-list', path: () => '/subscriptions?view=list' },
  {
    // Closed, after a keyboard pick (nothing is submitted): ↓ + Enter takes the
    // second twin; Esc closes without changing it. Focus returns to the button.
    name: 'stats-link-picker',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      const button = page.getByRole('button', { name: /^Coffee to link/ });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(/Bag 2$/);
      await button.click();
      await page.keyboard.press('End');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(/Bag 2$/);
    }
  },
  {
    name: 'stats-link-picker-open',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      const top = page.getByRole('group', { name: 'Top match' }).getByRole('option');
      await expect(top).toHaveCount(2); // the seeded twins
      await expect(top.first()).toHaveAttribute('aria-selected', 'true');
      if (page.viewportSize()!.width === 360) await expectBagOnOwnLine(page);
    }
  },
  {
    name: 'stats-link-picker-search',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      await page.getByRole('searchbox', { name: 'Search coffees' }).fill('ethiopia');
      await expect(page.getByRole('group', { name: 'Top match' })).toHaveCount(0);
      await expect(page.getByRole('option').first()).toBeVisible();
    }
  },
  {
    name: 'stats-link-picker-long',
    path: () => '/stats?tab=bq',
    act: (page, s) => openPicker(page, s.names.long.slice(0, 20))
  },
  {
    name: 'coffee-linked',
    path: (s) => `/coffees/${s.slugs.linked}`,
    act: async (page) => {
      await expect(page.getByText(/Bean Conqueror: .* · 8 brews/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible();
    }
  },
  { name: 'stats-general', path: () => '/stats' },
  ...(['overview', 'favorites', 'brewing', 'economics'] as const).map((tab) => ({
    name: `stats-${tab}`,
    path: () => `/stats?tab=bq&bc=${tab}`
  })),
  { name: 'coffees-bc-yes', path: () => '/coffees?status=all&view=list&bc=yes' },
  { name: 'coffees-bc-no', path: () => '/coffees?status=all&view=compact&bc=no' },
  {
    name: 'coffees-filter-editor',
    path: () => '/coffees?status=all&view=compact',
    act: async (page) => {
      await page.getByRole('button', { name: '+ Filter' }).click();
      await expect(page.getByRole('radiogroup', { name: 'In Bean Conqueror' })).toBeVisible();
    }
  },
  {
    // Moonwake has a seeded default and no own image: the form previews it.
    name: 'coffee-edit-roaster-default-preview',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByText('Roaster default', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Set as roaster default' })).toBeDisabled();
    }
  },
  {
    // The image row with all three buttons, then marked: the button is the cue.
    // Nothing is saved (shared DB); Discard changes closes the form unsaved.
    name: 'coffee-edit-set-roaster-default',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await expect(page.getByText('Roaster default', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      const marked = page.getByRole('button', { name: 'Will be set as default' });
      await expect(marked).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveValue('1');
    }
  },
  {
    // Discard is the undo: reopening the form after Discard changes shows no mark.
    name: 'coffee-edit-roaster-default-discarded',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      await page.getByRole('button', { name: 'Discard changes' }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveCount(0);
      await expect(page.getByText('Roaster default', { exact: true })).toBeVisible();
    }
  },
  {
    // Clearing the image by typing drops the mark; retyping must not revive it.
    name: 'coffee-edit-roaster-default-cleared-by-typing',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      await page.locator('#image_url').fill('');
      await page.locator('#image_url').fill('https://img.example/other.png');
      const btn = page.getByRole('button', { name: 'Set as roaster default' });
      await expect(btn).toBeEnabled();
      await expect(btn).not.toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveCount(0);
    }
  }
];

// Known failures: the list view's table is crushed at tablet width and needs a
// redesign (docs/backlog/list-view-tablet-width.md). test.fail() makes a fix
// show up as "unexpectedly passed", so these entries flag themselves. Nothing
// else gets listed here.
const KNOWN_FAILURES = new Set([
  ...['w768', 'phone-landscape'].flatMap((w) => [`coffees-list-${w}`, `coffees-inline-edit-pending-${w}`, `coffees-bc-yes-${w}`])
]);

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

// Public cards (signed out) with only a roaster default show it, alt "<roaster> logo".
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('coffees-cards-public-roaster-default', async ({ page }, info) => {
    await page.goto('/coffees?status=all&view=cards', { waitUntil: 'networkidle' });
    const img = page.getByRole('img', { name: 'Moonwake logo', exact: true });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: `.ui-test/screenshots/coffees-cards-public-${info.project.name}.png`, fullPage: true });
    await checkLayout(page);
  });
});
