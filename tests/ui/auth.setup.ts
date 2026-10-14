import { test as setup } from '@playwright/test';
import { gotoReady } from './ready';

setup('sign in as admin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#password').fill('test');
  await page.locator('#password').press('Enter');
  await page.waitForURL('**/coffees');
  await page.context().storageState({ path: '.ui-test/admin.json' });
});

// Signed-out context of its own (no storageState). The query is added by
// replaceState, as the app's own view-state code does, so this also checks the
// link reads location rather than the stale page.url.
setup('sign in returns to the page you were on', async ({ page }) => {
  await gotoReady(page, '/coffees?status=all&view=list');
  const coffee = await page.locator('a[href^="/coffees/"]').first().getAttribute('href');
  await gotoReady(page, coffee!);
  await page.evaluate(() => history.replaceState(history.state, '', `${location.pathname}?from=test`));
  await page.locator('.site-nav').getByRole('link', { name: 'Sign in' }).click();
  await page.locator('#password').fill('test');
  await page.locator('#password').press('Enter');
  await page.waitForURL((url) => url.pathname + url.search === `${coffee}?from=test`);
});
