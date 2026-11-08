import { test, expect } from '@playwright/test';
import { gotoReady } from './ready';
import { DatabaseSync } from 'node:sqlite';
import { createCoffee } from '../../src/lib/server/coffees';

// Link picker speed with ~300 linkable coffees.
// Runs after every layout check (playwright.config.ts dependencies), so the
// extra coffees it adds to the shared DB never show up in their screenshots.
const RUNS = 7;
// keystroke: one frame at 60Hz (16.7ms; each sample waits for a frame, so a 60Hz runner can't read lower).
const BUDGET = { open: 100, keystroke: 17 };
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
let ids: number[] = [];

test.beforeAll(() => {
  // The server writes in the background; wait on a lock instead of failing.
  const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
  for (let i = 0; i < 300; i++) {
    ids.push(createCoffee(db, {
      roaster: `Perf Roaster ${i % 25}`, coffee_name: `Perf Coffee ${i} Washed Gesha Lot`, origin: 'Ethiopia',
      roast_level: 'Light', processing: 'Washed', amount_g: 250, cost: 20, roast_date: '2026-09-01',
      frozen_start_date: null, frozen_end_date: null, rest_days_low: 7, rest_days_high: 21, image_url: null,
      status: i % 3 ? 'archive' : 'backlog'
    }).id);
  }
  db.close();
});

test.afterAll(() => {
  const db = new DatabaseSync('.ui-test/ui.db', { timeout: 5000 });
  db.prepare(`DELETE FROM coffees WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
  db.close();
  ids = [];
});

test('link picker opens and filters within budget', { tag: '@stats' }, async ({ page }) => {
  test.skip(process.env.UI_PROFILE === 'background', 'wall-clock budget needs performance cores');
  await gotoReady(page, '/account?untracked=all');
  const row = page.locator('.triage-row').filter({ hasText: 'Kenya Kiambu' }).first();
  await row.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Coffee to link/ })).toBeVisible();

  const r = await page.evaluate(async ({ runs }) => {
    const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
    const btn = document.querySelector<HTMLButtonElement>('.lp-btn')!;
    const open: number[] = [];
    const key: number[] = [];
    let options = 0;
    let focusOnSearch = false;
    for (let run = 0; run < runs; run++) {
      let t = performance.now();
      btn.click();
      await frame();
      document.querySelector('[role="listbox"]')!.getBoundingClientRect(); // include layout
      open.push(performance.now() - t);
      options = Math.max(options, document.querySelectorAll('[role="option"]').length);
      const search = document.querySelector<HTMLInputElement>('.lp-search')!;
      focusOnSearch ||= document.activeElement === search;
      for (const ch of 'perf coffee 12') {
        search.value += ch;
        t = performance.now();
        search.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        document.querySelector('[role="listbox"]')!.getBoundingClientRect();
        key.push(performance.now() - t);
      }
      btn.click(); // close
      await frame();
    }
    return { open, key, options, focusOnSearch };
  }, { runs: RUNS });

  const result = {
    options: r.options,
    openMedianMs: +median(r.open).toFixed(1),
    keystrokeMedianMs: +median(r.key).toFixed(1),
    keystrokeMaxMs: +Math.max(...r.key).toFixed(1)
  };
  test.info().annotations.push({ type: 'link picker perf', description: JSON.stringify(result) });
  expect(r.options).toBeGreaterThanOrEqual(300);
  expect(r.focusOnSearch, 'opening must not focus the search box').toBe(false);
  expect(result.openMedianMs).toBeLessThan(BUDGET.open);
  expect(result.keystrokeMedianMs).toBeLessThan(BUDGET.keystroke);
});
