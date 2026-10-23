import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoReady } from './ready';
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
  // The server writes in the background; wait on a lock instead of failing.
  const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
  try { return db.prepare(sql).get(...args); } finally { db.close(); }
};
let aProcessing: { processing: string | null };
test.beforeAll(() => {
  aProcessing = read(`SELECT processing FROM coffees WHERE coffee_name = ?`, A)() as typeof aProcessing;
});

test.afterAll(() => {
  const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
  db.prepare(`DELETE FROM roaster_images WHERE roaster = 'Hydrangea'`).run();
  db.prepare(`UPDATE coffees SET processing = ? WHERE coffee_name = ?`).run(aProcessing.processing, A);
  db.prepare(`DELETE FROM app_meta WHERE key = 'household_size'`).run();
  db.close();
});

test('cards: inline edit, Set as roaster default, Save writes the default', { tag: '@coffees' }, async ({ page }) => {
  await gotoReady(page, '/coffees?status=all&view=cards');
  await page.locator('.card').filter({ hasText: NAME }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#image_url').fill(LOGO);
  await page.getByRole('button', { name: 'Set as roaster default' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Hydrangea logo', exact: true })).toBeVisible();
  await expect.poll(read(`SELECT image_url FROM roaster_images WHERE roaster = 'Hydrangea'`)).toEqual({ image_url: LOGO });
  await expect.poll(read(`SELECT image_url FROM coffees WHERE coffee_name = ?`, NAME)).toEqual({ image_url: null });
});

test('cards: two inline edits open, Save on A writes A and leaves B open', { tag: '@coffees' }, async ({ page }) => {
  await gotoReady(page, '/coffees?status=all&view=cards');
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
test('household of one hides the people switch everywhere', { tag: ['@stats', '@insights'] }, async ({ page }) => {
  // Saving from a held ?people=person view, without reloading, drops back to the household view.
  await gotoReady(page, '/stats?people=person');
  await expect(page.getByRole('group', { name: 'People' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit household size' }).click();
  await page.getByLabel('Household size').fill('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(read(`SELECT value FROM app_meta WHERE key = 'household_size'`)).toEqual({ value: '1' });
  await expect(page.getByRole('group', { name: 'People' })).toHaveCount(0);
  await expect(page.getByText(/per person/i)).toHaveCount(0);
  expect(page.url()).not.toContain('people=');
  // Back to 2: the earlier per-person choice must not come back.
  await page.getByRole('button', { name: 'Edit household size' }).click();
  await page.getByLabel('Household size').fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(read(`SELECT value FROM app_meta WHERE key = 'household_size'`)).toEqual({ value: '2' });
  await expect(page.getByRole('button', { name: 'Household', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).not.toContain('people=');
  await page.getByRole('button', { name: 'Edit household size' }).click();
  await page.getByLabel('Household size').fill('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(read(`SELECT value FROM app_meta WHERE key = 'household_size'`)).toEqual({ value: '1' });
  for (const v of VIEWPORTS) {
    await page.setViewportSize(v.viewport);
    for (const path of ['/insights?people=person', '/stats?people=person', '/stats?tab=bq&people=person']) {
      await gotoReady(page, path);
      await expect(page.getByRole('group', { name: 'People' })).toHaveCount(0);
      await expect(page.getByText(/per person/i)).toHaveCount(0);
      if (path.startsWith('/insights')) await expectStatRowsFull(page);
      const name = path.replace(/\W+/g, '-');
      if (process.env.UI_SHOTS === 'all') {
        await page.screenshot({ path: `.ui-test/screenshots/household-of-one${name}-${v.name}.png`, fullPage: true });
      }
      await checkLayout(page);
    }
  }
});

// "Coffee added!" popup: real adds (deleted afterwards), the page clock paused
// once it shows, so its 3s (5s touch) / 2s / 400ms timings step exactly.
test.describe('coffee added popup', { tag: '@coffees' }, () => {
  test.afterAll(() => {
    const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
    db.prepare(`DELETE FROM coffees WHERE roaster = 'Popup Test Roaster'`).run();
    db.close();
  });

  let n = 0;
  async function add(page: Page) {
    await page.locator('#roaster').fill('Popup Test Roaster');
    await page.locator('#coffee_name').fill(`Popup Test ${++n}`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const toast = page.locator('.added-toast');
    await expect(toast).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now()));
    return toast;
  }
  // Headless Firefox reports `(hover: none)`; pin it so each test picks its timing.
  async function addOnList(page: Page, touch = false) {
    await page.addInitScript((touch) => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        q === '(hover: none)' ? ({ ...real(q), matches: touch } as MediaQueryList) : real(q);
    }, touch);
    await page.clock.install();
    await gotoReady(page, '/coffees');
    await page.getByRole('button', { name: '+ Add Coffee' }).click();
    return add(page);
  }
  const fading = (toast: Locator) => expect(toast).toHaveClass(/fading/);
  const notFading = (toast: Locator) => expect(toast).not.toHaveClass(/fading/);

  test('fades after 3s; hovering pauses and leaving resumes the rest', async ({ page }) => {
    let toast = await addOnList(page);
    await page.clock.runFor(2900);
    await notFading(toast);
    await page.clock.runFor(200);
    await fading(toast);
    await page.clock.runFor(400);
    await expect(toast).toHaveCount(0);

    await page.getByRole('button', { name: '+ Add Coffee' }).click();
    toast = await add(page);
    await page.clock.runFor(500);
    await toast.hover();
    await page.clock.runFor(5000);
    await notFading(toast);
    await page.mouse.move(0, 0);
    await page.clock.runFor(2300);
    await notFading(toast);
    await page.clock.runFor(300);
    await fading(toast);
    await page.clock.runFor(400);
    await expect(toast).toHaveCount(0);
  });

  test('touch screens get 5s', async ({ page }) => {
    const toast = await addOnList(page, true);
    await page.clock.runFor(4900);
    await notFading(toast);
    await page.clock.runFor(200);
    await fading(toast);
  });

  test('leaving late keeps at least 2s; hovering mid-fade snaps back', async ({ page }) => {
    const toast = await addOnList(page);
    await page.clock.runFor(2500);
    await toast.hover();
    await page.mouse.move(0, 0);
    await page.clock.runFor(1900);
    await notFading(toast);
    await page.clock.runFor(200);
    await fading(toast);
    await toast.hover();
    await notFading(toast);
    await expect(toast).toHaveCSS('opacity', '1');
    await page.mouse.move(0, 0);
    await page.clock.runFor(1900);
    await notFading(toast);
    await page.clock.runFor(200);
    await fading(toast);
    await page.clock.runFor(400);
    await expect(toast).toHaveCount(0);
  });

  test('+ Add Coffee on a coffee page stays there; Open goes to the new coffee', async ({ page }) => {
    const { slug: here } = read(`SELECT slug FROM coffees WHERE coffee_name = ?`, A)() as { slug: string };
    await page.clock.install();
    await gotoReady(page, `/coffees/${here}`);
    await page.getByRole('button', { name: '+ Add Coffee' }).click();
    await expect(page.getByRole('heading', { name: 'Add Coffee' })).toBeVisible();
    const toast = await add(page);
    await expect(page.locator('.modal')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/coffees/${here}$`));
    const { slug } = read(`SELECT slug FROM coffees WHERE coffee_name = ?`, `Popup Test ${n}`)() as { slug: string };
    await page.clock.resume(); // navigation waits on timers
    await toast.getByRole('link', { name: 'Open' }).click();
    await expect(page).toHaveURL(new RegExp(`/coffees/${slug}$`));
    await expect(page.getByRole('heading', { name: `Popup Test ${n}` })).toBeVisible();
    await expect(toast).toHaveCount(0);
  });
});

test('trophy card: Edit the grinder burr size, Save, the card shows it after reload', { tag: '@insights' }, async ({ page }) => {
  const restore = () => {
    const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
    db.prepare(`UPDATE gear_details SET fields = ?, created_at = ?, updated_at = ? WHERE kind = 'grinder' AND name = 'ZP6 Special'`).run(JSON.stringify({ brand: 'Timemore', burrSize: 64 }), '2026-09-02T12:00:00.000Z', '2026-09-02T12:00:00.000Z');
    db.close();
  };
  try {
    await gotoReady(page, '/insights?tab=gear&card=grinder-zp6-special');
    const dlg = page.locator('dialog.trophy-dialog');
    await dlg.getByRole('button', { name: 'Edit' }).click();
    await dlg.getByLabel('Burr size (mm)').fill('54');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.locator('form.gear-form')).toHaveCount(0);
    await expect(page).toHaveURL(/card=grinder-zp6-special$/);
    await page.reload();
    await expect(dlg.locator('.specs .stat', { hasText: 'Burr size' }).locator('.stat-value')).toHaveText('54 mm');
  } finally { restore(); }
});
