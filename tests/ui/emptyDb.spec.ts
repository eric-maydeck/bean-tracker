import { test, expect, type Page } from '@playwright/test';
import { TABS } from '../../src/lib/insightsUrl';
import { waitReady } from './ready';

// Every page route on a brand-new empty database (second webServer in playwright.config.ts): signed out
// and signed in, nothing may crash or hit the error page. /api, /img, /s and /preview.png are not pages.
const PAGES = [
  '/', '/coffees', '/recaps', '/recipes', '/water', '/account', '/on-deck', '/subscriptions', '/insights', '/login',
  ...TABS.map((t) => `/stats?tab=${t}`)
];

async function visitAll(page: Page) {
  const errors: string[] = [];
  // Vite dev's cold dependency optimizing aborts module loads once (CI); a dev-server artifact, not an app crash.
  page.on('pageerror', (e) => { if (!/error loading dynamically imported module/.test(e.message)) errors.push(`pageerror: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !/downloadable font/.test(m.text())) errors.push(`console: ${m.text()}`); });
  for (const path of PAGES) {
    const res = await page.goto(path, { waitUntil: 'load' }); // a signed-out redirect is accepted: the final response counts
    expect(res?.status(), path).toBeLessThan(400);
    await waitReady(page); // hydrated before the next goto, or the interrupted module loads log errors
    await expect(page.locator('body'), path).not.toContainText(/Internal Error|Not found/i);
    await expect(page.locator('main, h1').first(), path).toBeVisible();
  }
  expect(errors).toEqual([]);
}

test('every page renders on an empty database, signed out', async ({ page }) => {
  await visitAll(page);
});

test('every page renders on an empty database, signed in', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#password').fill('test');
  await page.locator('#password').press('Enter');
  await page.waitForURL('**/coffees');
  await visitAll(page);
});
