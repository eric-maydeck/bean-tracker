import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';

// Saves for real, so it runs last (playwright.config.ts: after perf, which runs
// after every layout check) and puts the DB back afterwards.
const NAME = 'Colombia Pink Bourbon'; // Hydrangea, archived, no image, no default
const LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c2185b"/></svg>');

test.afterAll(() => {
  const db = new DatabaseSync('.ui-test/ui.db');
  db.prepare(`DELETE FROM roaster_images WHERE roaster = 'Hydrangea'`).run();
  db.close();
});

test('cards: inline edit, Set as roaster default, Save writes the default', async ({ page }) => {
  await page.goto('/coffees?status=all&view=cards', { waitUntil: 'networkidle' });
  await page.locator('.card').filter({ hasText: NAME }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image_url').fill(LOGO);
  await page.getByRole('button', { name: 'Set as roaster default' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Hydrangea logo', exact: true })).toBeVisible();
  const db = new DatabaseSync('.ui-test/ui.db');
  expect(db.prepare(`SELECT image_url FROM roaster_images WHERE roaster = 'Hydrangea'`).get()).toEqual({ image_url: LOGO });
  expect(db.prepare(`SELECT image_url FROM coffees WHERE coffee_name = ?`).get(NAME)).toEqual({ image_url: null });
  db.close();
});
