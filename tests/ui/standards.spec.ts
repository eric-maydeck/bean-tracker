import { test, expect, type Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { gotoReady } from './ready';
import { ALL_VIEWPORTS } from './viewports';
import { checkLayout } from './checkLayout';

// The coffee form's data-standards check (#76): add, edit, clone and Fill from URL.
// Saves for real, so it runs after the other specs (playwright.config.ts) and deletes its rows.
const ROASTER = 'Std Test Roaster';
const STILL = 'Still'; // seeded below so a typed "STILL" proposes the site's spelling
const EDIT = 'Std Edit Me';
const PIXEL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c2185b"/></svg>');

const db = <T>(fn: (d: DatabaseSync) => T): T => {
  const d = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
  try { return fn(d); } finally { d.close(); }
};
const row = (name: string) => () => db((d) => d.prepare(`SELECT * FROM coffees WHERE coffee_name = ?`).get(name) as Record<string, unknown> | undefined);
const wipe = () => db((d) => d.prepare(`DELETE FROM coffees WHERE roaster IN (?, ?)`).run(ROASTER, STILL));

test.beforeAll(() => {
  wipe();
  db((d) => {
    const ins = d.prepare(`INSERT INTO coffees (roaster, coffee_name, slug, status, variety, elevation, cost, amount_g, roast_date, created_at, updated_at)
      VALUES (?, ?, ?, 'backlog', ?, ?, 20, 250, '2026-01-01', '2026-01-01', '2026-01-01')`);
    ins.run(STILL, 'Std Still Seed', 'std-still-seed', null, null);
    ins.run(ROASTER, EDIT, 'std-edit-me', 'SL34 / SL28', '1800m'); // stored non-standard values: only a change prompts
  });
});
test.afterAll(wipe);

async function openAdd(page: Page) {
  await gotoReady(page, '/coffees');
  await page.getByRole('button', { name: '+ Add Coffee' }).click();
  await page.locator('#roaster').fill(ROASTER);
}
const fillBag = async (page: Page, name: string, { cost = '20', amount = '250', date = '2026-02-01' } = {}) => {
  await page.locator('#coffee_name').fill(name);
  await page.locator('#cost').fill(cost);
  await page.locator('#amount_g').fill(amount);
  await page.locator('#roast_date').fill(date);
};
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true }).first().click();
const dialog = (page: Page) => page.locator('dialog.sd-dialog[open]');
const dsave = (page: Page) => dialog(page).getByRole('button', { name: 'Save', exact: true });

test('add: variety row blocks Save until decided; Reject keeps the typed value', { tag: '@coffees' }, async ({ page }) => {
  await openAdd(page);
  await fillBag(page, 'Std Variety');
  await page.locator('#variety').fill('SL34 / SL28');
  await save(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dsave(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(dsave(page)).toHaveAttribute('title', /Variety/);
  await dialog(page).getByRole('group', { name: 'Variety' }).getByRole('button', { name: 'Reject' }).click();
  await dsave(page).click();
  await expect.poll(() => row('Std Variety')()?.variety).toBe('SL34 / SL28');
});

test('add: a format-only elevation change never opens the dialog', { tag: '@coffees' }, async ({ page }) => {
  await openAdd(page);
  await fillBag(page, 'Std Elevation');
  await page.locator('#elevation').fill('1800m');
  await save(page);
  await expect.poll(() => row('Std Elevation')()?.elevation).toBe('1,800 masl');
  await expect(dialog(page)).toHaveCount(0);
});

test('add: blank cost asks, Leave blank saves it blank', { tag: '@coffees' }, async ({ page }) => {
  await openAdd(page);
  await fillBag(page, 'Std No Cost', { cost: '' });
  await save(page);
  await expect(dsave(page)).toHaveAttribute('aria-disabled', 'true');
  await dialog(page).getByRole('button', { name: 'Leave blank' }).click();
  await dsave(page).click();
  await expect.poll(() => row('Std No Cost')()?.coffee_name).toBe('Std No Cost');
  expect(row('Std No Cost')()?.cost).toBeNull();
});

test('add: an unconvertible harvest blocks Save; Cancel keeps the form', { tag: '@coffees' }, async ({ page }) => {
  await openAdd(page);
  await fillBag(page, 'Std Harvest');
  await page.locator('#harvest_time').fill('new crop');
  await save(page);
  await expect(dialog(page)).toContainText(`can't be converted`);
  await expect(dsave(page)).toHaveAttribute('aria-disabled', 'true');
  await dsave(page).click({ force: true });
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('#harvest_time')).toHaveValue('new crop');
  expect(row('Std Harvest')()).toBeUndefined();
});

test('edit: changing only the name never prompts about stored values', { tag: '@coffees' }, async ({ page }) => {
  await gotoReady(page, '/coffees?status=all&view=cards');
  await page.locator('.card').filter({ hasText: EDIT }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#coffee_name').fill('Std Edited');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect.poll(() => row('Std Edited')()?.variety).toBe('SL34 / SL28');
  await expect(dialog(page)).toHaveCount(0);
  db((d) => d.prepare(`UPDATE coffees SET coffee_name = ? WHERE coffee_name = 'Std Edited'`).run(EDIT));
});

test('clone: only fields changed from the source are checked', { tag: '@coffees' }, async ({ page }) => {
  await gotoReady(page, '/coffees?status=all&view=cards');
  await page.locator('.card').filter({ hasText: EDIT }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#variety')).toHaveValue('SL34 / SL28');
  await page.locator('#coffee_name').fill('Std Clone'); // typed in the edit form, carried into the clone
  await page.locator('form:has(#slug)').getByRole('button', { name: 'Clone', exact: true }).click();
  await expect(page.locator('#add-coffee #variety')).toHaveValue('SL34 / SL28');
  await page.locator('#add-coffee #roaster').fill(ROASTER);
  await page.locator('#add-coffee').getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => row('Std Clone')()?.variety).toBe('SL34 / SL28');
  await expect(dialog(page)).toHaveCount(0);
});

test('roaster: STILL proposes Still; Reject warns with a See coffees link', { tag: '@coffees' }, async ({ page }) => {
  await openAdd(page);
  await page.locator('#roaster').fill('STILL');
  await fillBag(page, 'Std Roaster');
  await save(page);
  const rejectRoaster = dialog(page).getByRole('group', { name: 'Roaster' }).getByRole('button', { name: 'Reject' });
  await rejectRoaster.click();
  const warn = dialog(page).getByText(/already saved as "Still"/);
  await expect(warn).toBeVisible();
  await expect(warn.getByRole('link', { name: 'See coffees' })).toHaveAttribute('href', /^\/coffees\?.*roaster=Still/);
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  expect(row('Std Roaster')()).toBeUndefined();
});

test.describe('fill from URL', { tag: '@coffees' }, () => {
  const URL_ = 'https://example.test/products/std';
  async function setup(page: Page) {
    await page.route('**/api/coffees/fill-from-url', (route) =>
      route.fulfill({ json: { fields: { producer: 'Hacienda Mock', image_url: PIXEL }, notes: ['Mock note'], beanBase: null, variants: [], selected: null } }));
    await openAdd(page);
    await page.locator('#producer').fill('Finca Typed');
    await page.locator('#product_url').fill(URL_);
    await page.getByRole('button', { name: 'Fill from page' }).click();
    await expect(dialog(page)).toBeVisible();
  }

  test('Cancel discards the whole fill and keeps the URL', async ({ page }) => {
    await setup(page);
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('#producer')).toHaveValue('Finca Typed');
    await expect(page.locator('#image_url')).toHaveValue('');
    await expect(page.locator('img.image-preview')).toHaveCount(0);
    await expect(page.getByText('Mock note')).toHaveCount(0);
    await expect(page.locator('#product_url')).toHaveValue(URL_);
  });

  test('Approve applies the fill', async ({ page }) => {
    await setup(page);
    await dialog(page).getByRole('button', { name: 'Approve all' }).click();
    await dsave(page).click();
    await expect(page.locator('#producer')).toHaveValue('Hacienda Mock');
    await expect(page.locator('img.image-preview')).toBeVisible();
    await expect(page.getByText('Mock note')).toBeVisible();
  });
});

test('open dialog passes checkLayout at phone and desktop sizes', { tag: '@coffees' }, async ({ page }) => {
  for (const v of ALL_VIEWPORTS.filter((v) => ['phone-portrait', 'phone-landscape', 'w1280'].includes(v.name))) {
    await page.setViewportSize(v.viewport);
    await openAdd(page);
    await page.locator('#roaster').fill('STILL');
    await fillBag(page, 'Std Layout', { cost: '' });
    await page.locator('#variety').fill('SL34 / SL28');
    await page.locator('#harvest_time').fill('new crop');
    await save(page);
    await expect(dialog(page)).toBeVisible();
    await checkLayout(page);
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  }
});
