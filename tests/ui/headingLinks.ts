import { expect, type Page } from '@playwright/test';

// Every id is on an h2/h3 with a self link and a copy button; the page (loaded with #land) has `land` at the top;
// its copy button copies the current URL.
// `id` sits at the top of the viewport, or the page ended first so it could not get there.
export async function expectAtTop(page: Page, id: string): Promise<void> {
  await expect.poll(() =>
    page.evaluate((id) => {
      const t = document.getElementById(id)!.getBoundingClientRect().top;
      const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 4; // a few px of slack: scrollHeight rounds up
      return (t >= -1 && t <= 16) || (atEnd && t >= 0 && t < innerHeight);
    }, id), { message: `${id} at the top` }).toBe(true);
}

export async function expectHeadingLinks(page: Page, ids: string[], land: string): Promise<void> {
  for (const id of ids) {
    const h = page.locator(`:is(h2,h3)#${id}`);
    await expect(h, id).toHaveCount(1);
    await expect(h.locator('> a'), id).toHaveAttribute('href', new RegExp(`#${id}$`));
    await expect(h.locator('.copy-link'), id).toHaveCount(1);
  }
  await expectAtTop(page, land);

  await page.evaluate(() => {
    const w = window as unknown as { copies: string[] };
    w.copies = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void w.copies.push(t) }, configurable: true });
  });
  const heading = page.locator(`:is(h2,h3)#${land}`);
  const icon = heading.locator('.copy-link');
  if (await page.evaluate(() => matchMedia('(hover: none)').matches)) await icon.tap();
  else {
    await heading.hover();
    await icon.click();
  }
  await expect(page.locator('.toast', { hasText: 'Link copied' })).toBeVisible();
  const copies = await page.evaluate(() => (window as unknown as { copies: string[] }).copies);
  expect(copies).toEqual([page.url()]);
  expect(copies[0]).toMatch(new RegExp(`#${land}$`));
}
