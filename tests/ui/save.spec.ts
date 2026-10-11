import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { VIEWPORTS } from './viewports';
import { checkLayout, expectStatRowsFull } from './checkLayout';

// Saves for real, so it runs last (playwright.config.ts: after perf, which runs
// after every layout check) and puts the DB back afterwards.
const NAME = 'Colombia Pink Bourbon'; // Hydrangea, archived, no image, no default
const LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c2185b"/></svg>');

const A = 'Ethiopia Bensa Bombe';
const B = 'Rwanda Gitega Natural';
const read = (sql: string, ...args: string[]) => () => {
  const db = new DatabaseSync('.ui-test/ui.db');
  try { return db.prepare(sql).get(...args); } finally { db.close(); }
};
let aProcessing: { processing: string | null };
test.beforeAll(() => {
  aProcessing = read(`SELECT processing FROM coffees WHERE coffee_name = ?`, A)() as typeof aProcessing;
});

test.afterAll(() => {
  const db = new DatabaseSync('.ui-test/ui.db');
  db.prepare(`DELETE FROM roaster_images WHERE roaster = 'Hydrangea'`).run();
  db.prepare(`UPDATE coffees SET processing = ? WHERE coffee_name = ?`).run(aProcessing.processing, A);
  db.prepare(`DELETE FROM app_meta WHERE key = 'household_size'`).run();
  db.close();
});

test('cards: inline edit, Set as roaster default, Save writes the default', async ({ page }) => {
  await page.goto('/coffees?status=all&view=cards', { waitUntil: 'networkidle' });
  await page.locator('.card').filter({ hasText: NAME }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image_url').fill(LOGO);
  await page.getByRole('button', { name: 'Set as roaster default' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Hydrangea logo', exact: true })).toBeVisible();
  await expect.poll(read(`SELECT image_url FROM roaster_images WHERE roaster = 'Hydrangea'`)).toEqual({ image_url: LOGO });
  await expect.poll(read(`SELECT image_url FROM coffees WHERE coffee_name = ?`, NAME)).toEqual({ image_url: null });
});

test('cards: two inline edits open, Save on A writes A and leaves B open', async ({ page }) => {
  await page.goto('/coffees?status=all&view=cards', { waitUntil: 'networkidle' });
  for (const [name, probe] of [[A, 'a'], [B, 'b']]) {
    const card = page.locator('.card').filter({ hasText: name });
    await card.evaluate((el, p) => (el.dataset.probe = p), probe); // the card element survives the form swap
    await card.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator(`[data-probe="${probe}"] #processing`).fill(`Typed ${probe}`);
  }
  await page.locator('[data-probe="a"]').getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(read(`SELECT processing FROM coffees WHERE coffee_name = ?`, A)).toEqual({ processing: 'Typed a' });
  await expect(page.locator('[data-probe="a"] form')).toHaveCount(0);
  await expect(page.locator('[data-probe="b"] #processing')).toHaveValue('Typed b');
  await page.locator('[data-probe="b"]').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('form #processing')).toHaveCount(0);
  await expect.poll(read(`SELECT processing FROM coffees WHERE coffee_name = ?`, B)).not.toEqual({ processing: 'Typed b' });
});

// The layout workers share the DB and never save, so a household of one is checked here:
// Save size 1 through the form, then both pages at every viewport size (width x height;
// no DPR/touch emulation). The switch and every "per person" are gone, even from a shared
// people=person link, and nothing leaves empty space.
test('household of one hides the people switch everywhere', async ({ page }) => {
  // Saving from a held ?people=person view, without reloading, drops back to the household view.
  await page.goto('/stats?people=person', { waitUntil: 'networkidle' });
  await expect(page.getByRole('group', { name: 'People' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit household size' }).click();
  await page.getByLabel('Household size').fill('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(read(`SELECT value FROM app_meta WHERE key = 'household_size'`)).toEqual({ value: '1' });
  await expect(page.getByRole('group', { name: 'People' })).toHaveCount(0);
  await expect(page.getByText(/per person/i)).toHaveCount(0);
  expect(page.url()).not.toContain('people=');
  for (const v of VIEWPORTS) {
    await page.setViewportSize(v.viewport);
    for (const path of ['/insights?people=person', '/stats?people=person', '/stats?tab=bq&people=person']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('group', { name: 'People' })).toHaveCount(0);
      await expect(page.getByText(/per person/i)).toHaveCount(0);
      if (path.startsWith('/insights')) await expectStatRowsFull(page);
      const name = path.replace(/\W+/g, '-');
      await page.screenshot({ path: `.ui-test/screenshots/household-of-one${name}-${v.name}.png`, fullPage: true });
      await checkLayout(page);
    }
  }
});
