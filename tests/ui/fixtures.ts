import { test as base, type BrowserContext, type Page } from '@playwright/test';

// One browser context per worker, a new page in it per test. A fresh context cold-loads every asset
// (~400 ms per test, measured 2026-10-24); a page in a warm context loads in ~20 ms. Pages are closed
// after every test, so routes, listeners, init scripts, emulated media and viewport changes can't leak;
// storage and cookies are context-wide and are reset by hand. A test whose storageState differs from
// the project's (the signed-out block) gets a context of its own, as before.
export const test = base.extend<{ page: Page }, { sharedContext: BrowserContext }>({
  sharedContext: [async ({ browser }, use, workerInfo) => {
    const { viewport, deviceScaleFactor, hasTouch, storageState, baseURL } = workerInfo.project.use;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch, storageState, baseURL });
    await use(ctx);
    await ctx.close();
  }, { scope: 'worker' }],
  page: async ({ sharedContext, browser, storageState, viewport, deviceScaleFactor, hasTouch, baseURL }, use, testInfo) => {
    if (storageState !== testInfo.project.use.storageState) {
      const ctx = await browser.newContext({ storageState, viewport, deviceScaleFactor, hasTouch, baseURL });
      await use(await ctx.newPage());
      await ctx.close();
      return;
    }
    const cookies = await sharedContext.cookies();
    const page = await sharedContext.newPage();
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ fullPage: true }).then((body) => testInfo.attach('screenshot', { body, contentType: 'image/png' })).catch(() => {});
    }
    // Clear the app's remembered views; a hung page (mid-navigation) is simply closed.
    await Promise.race([
      page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }),
      new Promise((r) => setTimeout(r, 2000))
    ]).catch(() => {});
    await page.close().catch(() => {});
    await sharedContext.clearCookies();
    await sharedContext.addCookies(cookies);
  }
});
