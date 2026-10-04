import { test as setup } from '@playwright/test';

setup('sign in as admin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#password').fill('test');
  await page.locator('#password').press('Enter');
  await page.waitForURL('**/coffees');
  await page.context().storageState({ path: '.ui-test/admin.json' });
});
