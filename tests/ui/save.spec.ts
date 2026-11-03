import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoReady } from './ready';
import { DatabaseSync } from 'node:sqlite';
import { VIEWPORTS } from './viewports';
import { checkLayout, expectStatRowsFull, expectTipInView } from './checkLayout';

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
    await expect(dlg.locator('.specs .stat', { hasText: 'Burr size' }).locator('.stat-value')).toHaveText('54mm');
  } finally { restore(); }
});

test('trophy card: unreadable text in a number field blocks Save and saves nothing', { tag: '@insights' }, async ({ page }) => {
  await gotoReady(page, '/insights?tab=gear&card=grinder-zp6-special');
  const dlg = page.locator('dialog.trophy-dialog');
  await dlg.getByRole('button', { name: 'Edit' }).click();
  const posts: string[] = [];
  page.on('request', (r) => r.url().endsWith('/api/gear') && posts.push(r.url()));
  await dlg.getByLabel('Burr size (mm)').pressSequentially('2e'); // "e" alone is not a number
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg.getByRole('alert')).toHaveText('Burr size must be a number');
  expect(posts).toHaveLength(0);
});

// Favorite grind's other-bag link: a twin of El Dorado (same roaster + name) with a
// 9.8 on the ZP6, added here and removed after (the seed has no same-name pair). The tip is sticky (ui-rules 54).
test.describe('favorite grind: other bag', () => {
  const TWIN = 'favgrind-twin';
  const ELDORADO = '/coffees/2026-the-picky-chemist-el-dorado-double-ferment-gesha';
  test.beforeAll(() => {
    const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
    const at = '2026-08-01T00:00:00.000Z';
    db.prepare(`INSERT INTO coffees (roaster, coffee_name, roast_date, slug, status, created_at, updated_at) VALUES ('The Picky Chemist', 'El Dorado Double Ferment Gesha', '2026-08-01', ?, 'archive', ?, ?)`).run(TWIN, at, at);
    const id = (db.prepare(`SELECT id FROM coffees WHERE slug = ?`).get(TWIN) as { id: number }).id;
    db.prepare(`INSERT INTO beanconqueror_beans (id, name, roaster, imported_at, coffee_id) VALUES ('bean-fave-twin', 'El Dorado Double Ferment Gesha', 'The Picky Chemist', ?, ?)`).run(at, id);
    db.prepare(`INSERT INTO beanconqueror_brews (bc_created_at, bean_id, preparation_id, mill_id, grind_setting, rating, imported_at) VALUES ('2026-08-10T08:00:00.000Z', 'bean-fave-twin', 'm1', 'g1', '4.2', 9.8, ?)`).run(at);
    db.close();
  });
  test.afterAll(() => {
    const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
    db.prepare(`DELETE FROM beanconqueror_brews WHERE bean_id = 'bean-fave-twin'`).run();
    db.prepare(`DELETE FROM beanconqueror_beans WHERE id = 'bean-fave-twin'`).run();
    db.prepare(`DELETE FROM coffees WHERE slug = ?`).run(TWIN);
    db.close();
  });
  const anchor = (page: Page) => page.locator('[data-testid="favorite-grind"] .fg-other');
  const label = /^Higher-rated bag$/;

  {
    test(`tap-tip-favorite-grind: a tap opens and pins it, a tap elsewhere closes it, See coffee goes to the bag`, async ({ page }) => {
      await gotoReady(page, ELDORADO);
      const a = anchor(page), tip = page.locator('.cell-tip:popover-open');
      await expect(a).toHaveText(label);
      expect(await a.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return r.getClientRects().length; }), 'one line of text').toBe(1);
      await checkLayout(page);
      await a.tap();
      await expect(tip).toBeVisible();
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).toHaveText('Another bag of the same coffee');
      await expect(tip.locator('dt')).toHaveText(['Grind setting', 'Rating', 'Roasted', 'Dripper', 'Brewed']);
      await expect(tip.locator('dd')).toHaveText(['4.2', '9.8', '2026-08-01', 'V60', '2026-08-10']);
      await expect(a.locator('xpath=ancestor::*[contains(@class, "data")]'), 'inline in the data line').toHaveCount(1);
      expect(await page.locator('[data-testid="favorite-grind"] li .seg').last().evaluate((e) => e.querySelector('.fg-other') !== null), 'the last segment').toBe(true);
      await page.waitForTimeout(700);
      await expect(tip, 'still open a moment after the tap').toBeVisible();
      await page.locator('.timing h2').tap();
      await expect(tip, 'a tap elsewhere closes it').toBeHidden();
      await a.tap();
      await tip.getByRole('link', { name: 'See coffee' }).tap();
      await expect(page).toHaveURL(new RegExp(`/coffees/${TWIN}$`));
    });
  }

  test.describe('mouse', () => {
    test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });
    test('hover opens, the mouse can cross onto the tip, a click pins it, Escape or a click elsewhere closes it', async ({ page }) => {
      await gotoReady(page, ELDORADO);
      const a = anchor(page), tip = page.locator('.cell-tip:popover-open');
      await a.hover();
      await expect(tip).toBeVisible();
      await expectTipInView(page, tip);
      const t = (await tip.boundingBox())!;
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 5 });
      await page.waitForTimeout(300);
      await expect(tip, 'stays open while over the tip').toBeVisible();
      await page.mouse.move(1, 1);
      await expect(tip, 'closes when the pointer leaves both').toBeHidden();
      await a.click();
      await page.mouse.move(1, 1);
      await page.waitForTimeout(300);
      await expect(tip, 'a click pins it').toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tip).toBeHidden();
      await a.focus();
      await page.keyboard.press('Enter');
      await expect(tip, 'Enter pins it').toBeVisible();
      await page.mouse.click(1, 1);
      await expect(tip, 'a click elsewhere closes it').toBeHidden();
    });
  });
});

test.describe('recipes', { tag: '@account' }, () => {
  test.afterAll(() => {
    const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
    db.prepare(`DELETE FROM recipes WHERE name = 'Test joocy'`).run();
    db.prepare(`DELETE FROM app_meta WHERE key = 'agitation_note_words'`).run();
    db.prepare(`DELETE FROM brew_recipe_matches WHERE recipe_id NOT IN (SELECT id FROM recipes)`).run(); // the app's rematchBrews, for a test that died midway
    db.close();
  });

  test('recipes-save-edit-delete: name a group, edit its tags, delete it', async ({ page }) => {
    const mine = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Your recipes', level: 2 }) });
    const found = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Found in your brews', level: 2 }) });
    const joocy = mine.locator('li.item').filter({ hasText: 'Test joocy' });
    await gotoReady(page, '/recipes');
    const bbj = found.locator('li.item').filter({ hasText: 'Mostly' }).nth(1); // bbs is first, bbj second
    const before = await found.locator('li.item').count();
    await bbj.getByRole('button', { name: 'Name & save' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Test joocy');
    await page.locator('form:has(input[name="tags"])').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(joocy).toHaveCount(1);
    await expect(found.locator('li.item')).toHaveCount(before - 1);
    // The 10 bbj brews are all accounted for: logged from notes + look like it (the seed has no bbj notes tagged "Test joocy").
    await expect(joocy).toContainText('0 from notes · 10 look like it');
    await joocy.getByRole('button', { name: 'Edit', exact: true }).click();
    const pourCount = await page.locator('fieldset.pour').count();
    await page.getByLabel('Note tags', { exact: true }).fill('TJ');
    const drippers = page.locator('fieldset.drippers');
    await expect(drippers).toContainText('Any dripper');
    await expect(page.getByLabel(/only match its recipes/)).toHaveCount(0); // a lock shows only for a ticked dripper
    await drippers.getByRole('checkbox').first().check();
    await expect(page.getByLabel(/Brews on .+ only match its recipes/)).toHaveCount(1);
    await drippers.getByRole('checkbox').first().uncheck();
    await page.getByLabel("Pour speed doesn't matter").check();
    await expect(page.getByTestId('editor-description')).toContainText('any pour speed');
    await page.getByRole('button', { name: 'Add pour' }).click(); // the pour-count range widens, so Save still validates
    await page.locator('form:has(input[name="tags"])').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByLabel('Note tags', { exact: true })).toHaveCount(0);
    await page.reload();
    await joocy.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Note tags', { exact: true })).toHaveValue('TJ');
    await expect(page.locator('fieldset.pour')).toHaveCount(pourCount + 1);
    await expect(page.getByLabel("Pour speed doesn't matter")).toBeChecked();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await joocy.getByRole('button', { name: 'Delete', exact: true }).click();
    const confirm = joocy.locator('form.panel');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(joocy).toHaveCount(1);
    await joocy.getByRole('button', { name: 'Delete', exact: true }).click();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(joocy).toHaveCount(0);
    await expect(found.locator('li.item')).toHaveCount(before);
  });

  test('recipes-slug-page-rename-delete: renaming goes to the new slug, deleting to /recipes, never a 404', async ({ page }) => {
    const found = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Found in your brews', level: 2 }) });
    await gotoReady(page, '/recipes');
    await found.locator('li.item').first().getByRole('button', { name: 'Name & save' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Slug walk');
    await page.locator('form:has(input[name="tags"])').getByRole('button', { name: 'Save', exact: true }).click();
    await gotoReady(page, '/recipes/slug-walk');
    const item = page.locator('li.item').filter({ has: page.getByRole('heading', { name: 'Slug walk' }) });
    await item.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Slug walk two');
    await page.locator('form.editor').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/recipes\/slug-walk-two$/);
    await expect(page.getByRole('heading', { name: 'Slug walk two' })).toBeVisible();
    await expect(page.getByText('No such recipe')).toHaveCount(0);
    await page.locator('li.item').filter({ has: page.getByRole('heading', { name: 'Slug walk two' }) }).getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('form.panel').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByRole('heading', { name: 'Your recipes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slug walk two' })).toHaveCount(0);
  });

  test('recipes-note-words-save: add a word, save, see it after a reload; a duplicate is rejected', async ({ page }) => {
    const p = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Words in your notes', level: 2 }) });
    await gotoReady(page, '/recipes');
    await p.getByRole('button', { name: 'Add word' }).click();
    await p.getByLabel('Word or phrase').nth(2).fill('seed word');
    await p.getByLabel('Agitation').nth(2).selectOption('medium');
    await p.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(p.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    await page.reload();
    await expect(p.getByLabel('Word or phrase').nth(2)).toHaveValue('seed word');
    await expect(p.getByLabel('Agitation').nth(2)).toHaveValue('medium');
    await p.getByRole('button', { name: 'Add word' }).click();
    await p.getByLabel('Word or phrase').nth(3).fill('Seed Word');
    await p.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(p.getByRole('alert')).toHaveText('Each word can be listed once');
    // A word saved with stray spaces is trimmed, and Cancel goes away (the form matches what was saved).
    await page.reload();
    await p.getByRole('button', { name: 'Add word' }).click();
    await p.getByLabel('Word or phrase').nth(3).fill(' trimmed ');
    await p.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(p.getByLabel('Word or phrase').nth(3)).toHaveValue('trimmed');
    await expect(p.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  });
});

// The admin "recap ready" banner. ui-seed marks every open year seen, so delete the key to show it, then restore.
// Geometry at the run's viewports (phone portrait + landscape in the push gate); dismiss records it.
test('recap banner: geometry, dismiss records it', { tag: '@recaps' }, async ({ page }) => {
  const Y = new Date().getFullYear() - 1;
  const key = `recap_seen_${Y}`;
  const run = (sql: string) => { const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 }); try { db.prepare(sql).run(key); } finally { db.close(); } };
  run(`DELETE FROM app_meta WHERE key = ?`);
  try {
    const banner = page.locator('.recap-banner');
    for (const [width, height] of [[480, 909], [1003, 333]]) { // the phone, portrait and landscape
      await page.setViewportSize({ width, height });
      await gotoReady(page, '/coffees');
      await expect(banner).toContainText(`Your ${Y} recap is ready`);
      const b = (await banner.boundingBox())!;
      const m = (await page.locator('main').boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(m.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      // In flow, not floating: scrolls with the page (not fixed), and is the first thing in the content, above the heading.
      expect(await banner.evaluate((el) => getComputedStyle(el).position)).toBe('static');
      const h1 = (await page.locator('main h1').first().boundingBox())!;
      expect(b.y + b.height, 'above the first heading, no overlap').toBeLessThanOrEqual(h1.y + 0.5);
      expect(b.height).toBeLessThanOrEqual(height / 3);
      await checkLayout(page);
    }
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(banner).toHaveCount(0);
    await expect.poll(read(`SELECT value FROM app_meta WHERE key = ?`, key)).toEqual({ value: '1' });
    await page.reload();
    await expect(page.locator('.recap-banner')).toHaveCount(0);
    run(`DELETE FROM app_meta WHERE key = ?`); // unseen again: still no banner over the recap itself
    await gotoReady(page, `/recaps/${Y}`);
    await expect(page.locator('.recap-banner')).toHaveCount(0);
  } finally {
    run(`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, '1')`);
  }
});
