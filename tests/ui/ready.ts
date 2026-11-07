import type { Page } from '@playwright/test';

// Replaces networkidle (~500ms quiet window per load). Page data is server-rendered and client
// fetches only happen on user action, so ready = hydrated + fonts + eager images
//.
export async function waitReady(page: Page) {
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute('data-hydrated') &&
    [...document.images].every((i) => i.complete || i.loading === 'lazy'));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
export async function gotoReady(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  await waitReady(page);
}
export async function reloadReady(page: Page) {
  await page.reload({ waitUntil: 'load' });
  await waitReady(page);
}
