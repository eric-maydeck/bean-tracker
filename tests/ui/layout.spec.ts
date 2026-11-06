import { expect, request, type Page, type Locator, type Route } from '@playwright/test';
import { test } from './fixtures';
import { gotoReady, reloadReady } from './ready';
import { readFileSync } from 'node:fs';
import { truncate, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { stringify } from 'devalue';
import { join } from 'node:path';
import { INSIGHTS_TABS, iso, expectRectsClose, controlRects, scrollPastBar, expectShortRow, expandBar, expectPullTab, pinnedBottomOf, anchorGap, tapBackToTop, expectAtTopFolded, cbarAct, isPhone, expectSpacerMatchesBody, outerHeight } from './collapsibleBar';
import { glue } from '../../src/lib/unitGap';
import { fieldsFor } from '../../src/lib/gear';
import { checkLayout, expectGridRowsFull, expectInnerScroll, expectPairsFilled, expectStatRowsFull, expectTipInView, expectTipsFormatted, expectNoTitleTips, expectColumnsFilled, expectDataTip, expectLabelsOutsidePlot } from './checkLayout';

interface Seed {
  slugs: { long: string; linked: string; frozen: string; decaf: string; wide: string; lab: string; labTwo: string; sey: string; skip: string; brew: string; brewNew: string } & Record<GramsKey, string>;
  names: { long: string; everyAction: string } & Record<GramsKey, string>;
  recipes: { bbsKey: string; bbjKey: string; bbfKey: string; recipeId: number };
}
// Seeded open coffees with a linked bean, and their bag text (checkLayout rule 6
// asserts each stays on one line).
// A stubbed successful Bean Conqueror import (layout states never write).
const stubImport = (page: Page) => page.route('**/account?/importBeanConqueror', (route) => route.fulfill({ json: {
  type: 'success', status: 200,
  data: stringify({ success: true, changes: {
    beans: { new: 0, updated: 0 }, brews: { new: 0, updated: 0 }, waters: { new: 1, updated: 0 },
    autoLinked: 0, untracked: { total: 2, added: 1 }
  } })
} }));

const GRAMS = { big: '2kg (2kg left)', under: '999g (999g left)', part: '1.5kg (1.1kg left)' };
type GramsKey = keyof typeof GRAMS;
const GRAMS_KEYS = Object.keys(GRAMS) as GramsKey[];
// Read lazily: .ui-test/seed.json only exists once the web server has started.
let cached: Seed | undefined;
const seed = (): Seed => (cached ??= JSON.parse(readFileSync('.ui-test/seed.json', 'utf8')));

// the local calendar year, as scripts/ui-seed.ts computes the seeded years.
const recapYear = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric' }).format(new Date()));
// Every Recaps tile: its year, 2-3 headline numbers with labels, tone background, inside the page; same order as `years`.
async function expectRecapTiles(page: Page, years: string[]) {
  const tiles = page.locator('.recap-tile');
  await expect(tiles).toHaveCount(years.length);
  for (const [i, y] of years.entries()) {
    const t = tiles.nth(i);
    await expect(t.locator('h2')).toHaveText(y);
    const n = await t.locator('li').count();
    expect(n, `${y} headlines`).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
    for (const li of await t.locator('li').all()) for (const part of [li.locator('b'), li.locator('> span')]) expect((await part.textContent())!.trim()).not.toBe('');
    expect((await t.boundingBox())!.height, `${y} tile is a poster, not a row`).toBeGreaterThan(180);
  }
}

interface State {
  name: string;
  path: (s: Seed) => string;
  act?: (page: Page, s: Seed) => Promise<void>;
  // 'two' (tagged @two): phone-portrait + w1280 only (TWO_VIEWPORTS, playwright.config.ts). Only for a state whose
  // assertions are all width-independent (tip text, URL sync, labels) and whose path an 'all' state also loads.
  viewports?: 'all' | 'two';
  /** Reloads the page dozens of times (insights-rail: 36 loads at w1280): triple the 30 s timeout, which the `background` profile's slow loads overrun. */
  slow?: boolean;
}

// The gear edit form's grid (wide dialogs): Save/Cancel fill the cell after the last field, Preview/Discard share their row and
// Image URL sits on the row above. Measured on the dripper's 10 fields (Size + Learn from similar gear? fill the last row, the buttons sit on the row below).
async function expectEditAligned(page: Page) {
  const dlg = page.locator('dialog.trophy-dialog');
  const bx = async (l: Locator) => (await l.boundingBox())!;
  const [flow, size, mat] = [await bx(dlg.getByLabel('Flow', { exact: true })), await bx(dlg.getByLabel('Size', { exact: true })), await bx(dlg.getByLabel('Material', { exact: true }))];
  const [save, cancel] = [await bx(dlg.getByRole('button', { name: 'Save' })), await bx(dlg.getByRole('button', { name: 'Cancel' }))];
  expect(Math.abs(save.x - flow.x), 'Save left = Flow input left').toBeLessThan(1.5);
  expect(Math.abs(cancel.x + cancel.width - (flow.x + flow.width)), 'Cancel right = Flow input right').toBeLessThan(1.5);
  const [prev, disc] = [await bx(dlg.getByRole('button', { name: 'Preview' })), await bx(dlg.getByRole('button', { name: 'Discard image' }))];
  expect(Math.abs(save.y - prev.y), 'Save top = Preview top').toBeLessThan(2);
  expect(Math.abs(cancel.y - prev.y)).toBeLessThan(2);
  expect(save.y, 'buttons below the last field row').toBeGreaterThan(size.y + size.height);
  const url = await bx(dlg.getByLabel('Image URL'));
  expect(Math.abs(url.y - size.y), 'Image URL input top = Size input top').toBeLessThan(2);
  expect(Math.abs((await bx(dlg.getByText('Image URL', { exact: true }))).y - (await bx(dlg.getByText('Size', { exact: true }).first())).y), 'labels level').toBeLessThan(2);
  expect(Math.abs(prev.x - url.x)).toBeLessThan(1.5);
  expect(Math.abs(disc.x + disc.width - (url.x + url.width))).toBeLessThan(1.5);
  // Compact: label to input ~4px, field to field ~10-12px, inputs at the site's normal height.
  expect(size.height).toBeLessThan(42);
  expect(size.y - mat.y, 'row pitch (label + input + gap)').toBeLessThan(74);
  const lbl = await bx(dlg.getByText('Size', { exact: true }).first());
  expect(size.y - (lbl.y + lbl.height), 'label to input').toBeLessThan(7);
}

// Account → Not yet tracked → Link on the bean row containing `text`.
// A row's action buttons' boxes relative to the row, so scrolling the table
// doesn't count as moving them.
function buttonBoxes(scope: Locator) {
  return scope.evaluate((el) => {
    const o = el.getBoundingClientRect();
    return [...el.querySelectorAll('.sub-actions .button')].map((b) => {
      const r = b.getBoundingClientRect();
      return [r.left - o.left, r.top - o.top, r.width, r.height].map(Math.round);
    });
  });
}

// Back to top never covers a Show more / Show less button after the scroll lands: when it shows, the button ends above it.
async function expectClearOfBackToTop(page: Page, button: Locator) {
  await page.waitForTimeout(300);
  const btt = page.getByRole('button', { name: 'Back to top' });
  if (!(await btt.count())) return;
  const [a, b] = await Promise.all([btt.boundingBox(), button.boundingBox()]);
  const overlap = a!.x < b!.x + b!.width && a!.x + a!.width > b!.x && a!.y < b!.y + b!.height && a!.y + a!.height > b!.y;
  expect(overlap, `Back to top ${JSON.stringify(a)} over the button ${JSON.stringify(b)}`).toBe(false);
}
// A sticky filter bar: pinned at the top after scrolling, one short row in phone landscape,
// and a panel scrolled into view starts below it (scroll-padding-top), not under it.
// Every delta / pace / sub line on the page: right shape, sentence for screen readers, one line, no ellipsis.
async function expectDeltasFit(page: Page) {
  const bad = await page.locator('.stat-item .insights-delta').evaluateAll((els) =>
    els.flatMap((e) => {
      const el = e as HTMLElement;
      const shown = el.querySelector('[aria-hidden]')?.textContent?.trim() ?? el.textContent?.trim() ?? '';
      const said = el.querySelector('.sr-only')?.textContent ?? '';
      const lines = Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '1'));
      const maxLines = el.classList.contains('ratio') ? 2 : 1;
      const shape = /^[▲▼] \S+ (from \S+( days \(\d+%\))?|\(\d+%\))$/.test(shown) || shown === 'No change' || /^was /.test(shown);
      const spoken = !el.querySelector('.sr-only') || shown === 'No change' || /^(Up|Down) \d+( points?)?%? (from|vs) /.test(said);
      return shape && spoken && el.scrollWidth <= el.clientWidth + 1 && lines <= maxLines ? [] : [`${shown} | ${said}`];
    })
  );
  expect(bad).toEqual([]);
  await expectNoEllipsis(page);
}
// Every chip group (and its label): inside the viewport, one line per chip, nothing clipped.
async function expectChipsFit(page: Page, scope = 'main') {
  const bad = await page.locator(`${scope} .tab-group`).evaluateAll((gs) =>
    gs.flatMap((g) => {
      const r = g.getBoundingClientRect();
      const btns = [...g.querySelectorAll('button')];
      const wrapped = btns.some((b) => b.getBoundingClientRect().height > parseFloat(getComputedStyle(b).lineHeight || '20') * 1.8 + 12);
      const clipped = btns.some((b) => b.scrollWidth > b.clientWidth + 1);
      const out = r.right > innerWidth + 0.5 || r.left < -0.5;
      return wrapped || clipped || out ? [`${g.getAttribute('aria-label')} ${Math.round(r.left)}-${Math.round(r.right)}`] : [];
    })
  );
  expect(bad).toEqual([]);
}
// Every toggle group names itself with a small label and is a named role=group (the in-tile switch is named by its caption).
async function expectGroupsLabelled(page: Page) {
  const unnamed = await page.locator('.tab-group:not(.rating-switch):not(.filter-columns)').evaluateAll((gs) =>
    gs.filter((g) => !g.closest('dialog,.filter-editor') && !g.parentElement?.matches('.form-field') ||
      !g.parentElement!.querySelector(':scope > span')?.textContent?.trim() || g.getAttribute('role') !== 'group' || !g.getAttribute('aria-label')).map((g) => g.textContent?.trim().slice(0, 30))
  );
  expect(unnamed).toEqual([]);
  await expectChipsFit(page, 'body');
}
// Avg per day's Busiest day tile: a date value, its sub ("6 brews · 112g") on one unclipped line.
async function expectBusiestDay(page: Page) {
  const tile = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Busiest day$/ }) });
  await expect(tile).toHaveCount(1);
  await expect(tile.locator('.stat-value')).toHaveText(/^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
  const sub = tile.locator('.stat-unit');
  await expect(sub).toHaveText(/^\d+ brews? · \d+(\.\d+)?g$/);
  const lines = await sub.evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || '1'));
  expect(lines).toBeLessThan(1.6);
  await expectNoEllipsis(page);
}
async function expectNoEllipsis(page: Page) {
  const clipped = await page.locator('.stat-item .stat-unit, .stat-item .insights-pace').evaluateAll((els) =>
    els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent)
  );
  expect(clipped).toEqual([]);
}

// T4 (ui-rules 29): a signed vs-usual delta shown as text is green from +0.05, red from −0.05, ink between
// (thin rows too; neutral is never green or red). Checks every board delta, polarity bar value and tagged delta (.delta-text) on the page.
// Small-sample chips: one line, inside their row and the viewport, and the sub line they sit beside is never cut off.
async function expectSampleChips(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const chip of document.querySelectorAll('.sample-note .sample-chip')) {
      const c = chip.getBoundingClientRect(), row = chip.closest('.board-row, tr, li')!.getBoundingClientRect();
      if (c.height > 1.8 * parseFloat(getComputedStyle(chip).fontSize)) out.push('chip wraps');
      if (c.right > row.right + 1 || c.right > innerWidth) out.push('chip overflows its row');
      const sub = chip.closest('.who-line')?.querySelector('small');
      if (sub && sub.scrollWidth > sub.clientWidth + 1) out.push(`sub line cut off: ${sub.textContent}`);
    }
    return out;
  });
  expect(bad).toEqual([]);
}
async function expectDeltaInk(page: Page) {
  const bad = await page.evaluate(() => {
    const probe = document.createElement('span');
    document.body.append(probe);
    const ink = (v: string) => ((probe.style.color = v), getComputedStyle(probe).color);
    const [better, worse] = [ink('color-mix(in srgb, var(--div-high-ink) 85%, var(--color-text))'), ink('color-mix(in srgb, var(--div-low-ink) 85%, var(--color-text))')]; // app.css .ink-better / .ink-worse
    probe.remove();
    const els = [...document.querySelectorAll<HTMLElement>('.lab-rows .board-row .val, .delta-bars:not(.direction) .bar-row .bar-value, .delta-text, .like-line > span')];
    return els.flatMap((e) => {
      const m = /^([+−])(\d+\.\d+)/.exec(e.textContent!.trim());
      if (!m) return [];
      const v = (m[1] === '−' ? -1 : 1) * +m[2], got = getComputedStyle(e).color;
      // A shown "±0.05" may round from just under 0.05: either color passes there. Neutral: never green or red.
      if (Math.abs(Math.abs(v) - 0.05) < 0.006) return [];
      const ok = Math.abs(v) < 0.05 ? got !== better && got !== worse : got === (v > 0 ? better : worse);
      return ok ? [] : [`${e.textContent!.trim()}: ${got}`];
    });
  });
  expect(bad).toEqual([]);
}

// The Ratings / Brews menu in the sticky bar: opens its popover (a no-op where the pair is inline, as on Overview).
async function openSwitches(page: Page) {
  const menu = page.locator('.filter-bar').getByRole('button', { name: /^Ratings and brews/ });
  if (await menu.count()) await menu.click();
  return menu;
}

// A small bar's amber corner fold: top right on a horizontal bar pointing left (its flat axis end, clear of a
// "keeps going" tip), top left everywhere else (user, 2026-10-17). Read from the fold layer's position and direction.
async function expectFoldCorners(page: Page) {
  expect(await page.locator('main .bar.small-sample-mark').count(), 'no small-sample bar to check').toBeGreaterThan(0);
  const bad = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('main .bar.small-sample-mark')].flatMap((e) => {
    const cs = getComputedStyle(e), track = e.parentElement!.getBoundingClientRect(), r = e.getBoundingClientRect();
    const horizontal = !!e.closest('.delta-bars');
    if (horizontal && r.width <= 2) return []; // a hairline bar has no direction to read (its fold may sit on either side)
    const left = horizontal && Math.abs(r.right - (track.left + track.width / 2)) < 1.5 && r.width > 2; // ends at the 0 line
    const atRight = /^(100%|right)/.test(cs.backgroundPositionX.split(',')[0].trim()) && /to left bottom|to bottom left/.test(cs.backgroundImage);
    return left === atRight ? [] : [`${e.closest('[data-section]')?.getAttribute('data-section')}: fold at ${atRight ? 'right' : 'left'}, bar points ${left ? 'left' : 'right/up'}`];
  }));
  expect(bad).toEqual([]);
}
// Two animation frames: what a scroll or resize needs to land its layout (a fixed sleep guessed at it).
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// Jump to chips live in the bar's block (.cbar, once the page has one) and every chip's #id exists on the page.
async function expectChipsInBar(page: Page, links: Locator) {
  if (await page.locator('.cbar').count()) await expect(page.locator('.cbar .board-jump a')).toHaveCount(await links.count());
  expect(await links.evaluateAll((as) => as.filter((a) => !document.getElementById(a.getAttribute('href')!.slice(1))).map((a) => a.getAttribute('href')))).toEqual([]);
}
// Height of the active tab's own controls row inside the sticky bar (0 when the tab has none).
const tabRowHeight = (bar: Locator) =>
  bar.evaluate((el) => { const r = el.querySelector('.tab-controls')?.getBoundingClientRect().height; return r ? r + parseFloat(getComputedStyle(el).rowGap) : 0; });
// A phone on a page with the collapsible bar (.cbar): what is pinned is the short row, not the full bar.
const phoneBar = async (page: Page) => isPhone(page) && (await page.locator('.cbar').count()) > 0;
async function expectStickyBar(page: Page, bar: Locator) {
  // Room to scroll on pages shorter than the viewport.
  await page.evaluate(() => (document.documentElement.style.paddingBottom = '200vh'));
  const target = page.locator('section.chart-panel').nth(1);
  await target.evaluate((el) => el.scrollIntoView());
  await frames(page);
  if (await phoneBar(page)) {
    // The target can sit right under the block (phone landscape, first board): the block's tail is still on
    // screen, so no short row yet; the target must just not be covered by it.
    const cbarBottom = (await page.locator('.cbar').boundingBox())!;
    if (cbarBottom.y + cbarBottom.height > 0 && !(await page.locator('.cbar-mini').count())) {
      expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(cbarBottom.y + cbarBottom.height - 1);
      return;
    }
    await expectShortRow(page);
    const mini = (await page.locator('.cbar-mini').boundingBox())!;
    expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(mini.y + mini.height - 1);
    return;
  }
  const b = (await bar.boundingBox())!;
  const tabRow = await tabRowHeight(bar);
  expect(Math.abs(b.y)).toBeLessThanOrEqual(1);
  // Phone landscape: one short controls row, plus (when filters are set) the one-line chips row (gate r2 A3), at most
  // 44px (a phone tap target's height).
  if (page.viewportSize()!.height <= 450) expect(b.height - tabRow).toBeLessThanOrEqual(60 + ((await bar.locator('.coffee-chips').count()) ? 44 : 0));
  expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
}

// Leaderboard cards on one grid row (same top) are the same height (an expanded one is exempt). A stacked card
// has its own row: it only keeps the Show all footer's space when it has the button (no blank footer, I2).
async function expectEqualBoardHeights(page: Page) {
  const bands = await page.locator('.board-band').evaluateAll((bands) =>
    bands.map((band) => [...band.querySelectorAll(':scope > .board:not(.open)')].map((b) => [Math.round(b.getBoundingClientRect().top), b.getBoundingClientRect().height]))
  );
  expect(bands).toHaveLength(4); // so the loop below can't pass vacuously
  for (const band of bands) for (const [top, h] of band) for (const [t2, h2] of band) if (Math.abs(top - t2) <= 1) expect(Math.abs(h - h2)).toBeLessThanOrEqual(1);
  const blank = await page.locator('.board-foot:not(:has(button))').count();
  expect(blank, 'no empty Show all footers').toBe(0);
}

// Under spend/ppg each gear/water board is an empty card with its one line, no shorter than a populated row-mate.
async function expectEmptyGearCards(page: Page) {
  for (const b of ['water', 'dripper', 'filter', 'grinder']) {
    await expect(page.locator(`[data-board="${b}"]`)).toContainText(/Not ranked by .+: it's per bag\./);
  }
  const rows = await page.locator('.board-band').evaluateAll((bands) =>
    bands.map((band) => [...band.querySelectorAll(':scope > .board')].map((b) => ({
      top: Math.round(b.getBoundingClientRect().top), h: b.getBoundingClientRect().height, empty: b.classList.contains('fill')
    }))));
  for (const band of rows) for (const e of band.filter((x) => x.empty))
    for (const o of band) if (!o.empty && Math.abs(o.top - e.top) <= 1) expect(e.h).toBeGreaterThanOrEqual(o.h - 1);
  await expect(page.locator('.chart-note', { hasText: 'is per bag' })).toHaveCount(0);
}

// Desktop edit table: every input and button in a row shares one vertical
// center (±1px).
async function expectRowLevel(row: Locator) {
  const centers = await row.evaluate((tr) =>
    [...tr.querySelectorAll('.inline-input, .sub-actions .button')].map((el) => {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    })
  );
  for (const c of centers) expect(Math.abs(c - centers[0]), 'vertical center').toBeLessThanOrEqual(1);
}

// A badge/warning sits clearly below its neighbor: no overlap, >= 4px gap.
async function expectClearlyBelow(upper: Locator, lower: Locator) {
  const [u, l] = [(await upper.boundingBox())!, (await lower.boundingBox())!];
  const intersects = u.x < l.x + l.width && l.x < u.x + u.width && u.y < l.y + l.height && l.y < u.y + u.height;
  expect(intersects, 'overlaps its neighbor').toBe(false);
  expect(l.y - (u.y + u.height), 'gap below neighbor').toBeGreaterThanOrEqual(4);
}

// The add form's Subscription page input spans its field grid.
// A URL row (input + Fill from page) spans its field grid: the input starts at
// the grid's left edge, the button ends at its right, and on one line they
// share top and height.
async function expectUrlRowSpans(grid: Locator) {
  const geo = await grid.evaluate((el) => {
    const r = (q: Element) => q.getBoundingClientRect();
    const g = r(el);
    const input = r(el.querySelector('input[name="subscription_url"]')!);
    const button = r(el.querySelector('.url-field .inline-row .button')!);
    return { g: [g.left, g.right], input: [input.left, input.top, input.height], button: [button.right, button.top, button.height] };
  });
  expect(Math.abs(geo.input[0] - geo.g[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(geo.button[0] - geo.g[1])).toBeLessThanOrEqual(1);
  if (Math.abs(geo.input[1] - geo.button[1]) < geo.input[2]) {
    expect(Math.abs(geo.input[1] - geo.button[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(geo.input[2] - geo.button[2])).toBeLessThanOrEqual(1);
  }
}
const expectAddUrlFullWidth = (page: Page) => expectUrlRowSpans(page.locator('form[action="?/create"] .form-grid'));

// A stubbed Fill from page (the UI test server never hits the internet): H&S's
// four options, the longest chip labels of the six live subscriptions.
const SUB_FILL = {
  fields: { roaster_service: 'H&S Coffee Roasters', subscription_name: "Roaster's Choice Subscription", renewal_day: 10 },
  variants: [
    { label: '1 bag, 125g (4.4oz)', price: 16, originalPrice: null, bags: 1, gramsPerBag: 125 },
    { label: '2 bags, 125g (4.4oz) each', price: 32, originalPrice: null, bags: 2, gramsPerBag: 125 },
    { label: '1 bag, 250g (8.8oz)', price: 28, originalPrice: null, bags: 1, gramsPerBag: 250 },
    { label: '2 bags, 250g (8.8oz) each', price: 56, originalPrice: null, bags: 2, gramsPerBag: 250 }
  ],
  selected: null,
  notes: ['Filled 3 fields', 'pick an option below']
};
// Fails the state if anything but the stubbed fill is POSTed (shared DB).
function stubSubFill(page: Page, body: object, status = 200) {
  const posts: string[] = [];
  page.on('request', (r) => r.method() === 'POST' && !r.url().includes('/api/subscriptions/fill-from-url') && posts.push(r.url()));
  return page.route('**/api/subscriptions/fill-from-url', (route) => route.fulfill({ status, json: body })).then(() => posts);
}

async function showPicker(page: Page, text: string) {
  const row = page.locator('.triage-row').filter({ hasText: text }).first();
  await row.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Coffee to link/ })).toBeVisible();
}
async function openPicker(page: Page, text: string) {
  await showPicker(page, text);
  await page.getByRole('button', { name: /^Coffee to link/ }).click();
  await expect(page.getByRole('listbox')).toBeFocused(); // never the search box (phone keyboard)
}

// Twins: the meta line stays on one line and "Bag N" is its own line below it,
// in the closed button and in every Top match option.
async function expectBagOnOwnLine(page: Page) {
  const bad = await page.evaluate(() => {
    const lines = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size;
    };
    const boxes = [document.querySelector('.lp-btn')!, ...document.querySelectorAll('[role="group"] [role="option"]')]
      .filter((el) => el.closest('[role="group"]')?.textContent?.startsWith('Top match') ?? true);
    return boxes.flatMap((box) => {
      const [meta, twin] = box.querySelectorAll('.lp-m');
      if (!twin || !/^Added \d{4}-\d\d-\d\d · Bag \d+$/.test(twin.textContent!)) return ['no twin line'];
      if (lines(meta) !== 1) return [`meta wraps: ${meta.textContent}`];
      if (twin.getBoundingClientRect().top < meta.getBoundingClientRect().bottom - 1) return ['twin line not below meta'];
      return [];
    });
  });
  expect(bad).toEqual([]);
}

// User feedback 2026-10-06: fields that share a row of the coffee form line up.
// Each .form-grid cell's first input/select (a cell's top = its grid row) must
// have the same top as the others in that row (a longer label pushed one down).
async function expectFieldRowsAligned(page: Page) {
  const rows = await page.locator('form .form-grid').evaluate((grid) => {
    const byRow = new Map<number, [string, number][]>();
    for (const cell of [...grid.children].flatMap((g) => (g.matches('.form-group') ? [...g.children] : [g]))) {
      const input = [...cell.querySelectorAll('input:not([type="checkbox"]):not([type="hidden"]), select')].find((i) => (i as HTMLElement).offsetParent);
      if (!input) continue;
      const key = Math.round(cell.getBoundingClientRect().top);
      byRow.set(key, [...(byRow.get(key) ?? []), [input.id || (input as HTMLInputElement).name, input.getBoundingClientRect().top]]);
    }
    return [...byRow.values()].filter((r) => r.length > 1);
  });
  for (const r of rows) {
    const tops = r.map(([, t]) => t);
    expect(Math.max(...tops) - Math.min(...tops), `inputs in one row not aligned: ${JSON.stringify(r)}`).toBeLessThanOrEqual(1);
  }
}

type View = 'cards' | 'list' | 'compact';
// A row's own Edit on /coffees (solo edit: Save + Cancel scoped to that coffee).
async function openSoloEdit(page: Page, view: View, name: string) {
  if (view === 'list') {
    await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Edit', exact: true }).click();
    return;
  }
  const item = page.locator(view === 'cards' ? '.card' : '.compact-row-wrap').filter({ hasText: name });
  if (view === 'compact') await item.locator('.compact-row').click();
  await item.getByRole('button', { name: 'Edit', exact: true }).click();
}

// ui-rules 19. After "Set as roaster default", Save and Cancel are below the
// form's image row and within a screen of it: reachable by scrolling down from where the
// user just tapped, not missing (Cards bug) or above, off-screen (List bug).
async function expectActionsUnderForm(page: Page) {
  await page.locator('#image_url').fill('https://img.example/pink-bourbon.png');
  await page.getByRole('button', { name: 'Set as roaster default' }).click();
  const marked = page.getByRole('button', { name: 'Will be set as default' });
  for (const name of ['Save', 'Cancel']) {
    const b = page.getByRole('button', { name, exact: true });
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeInViewport();
    const [m, r] = [(await marked.boundingBox())!, (await b.boundingBox())!];
    expect(r.y).toBeGreaterThan(m.y);
    // The image group moved to the top of the form, so measure from the form's last field: nothing big sits between.
    const lastField = page.locator('form').filter({ has: marked }).locator('input:visible, select:visible').last();
    const last = (await lastField.boundingBox())!;
    expect(r.y - (last.y + last.height)).toBeLessThan(page.viewportSize()!.height);
  }
  // ui-rules 23: the action icons start at the form's left edge, like its own buttons
  // (user report 2026-10-06: compact's sat 4px in).
  // (Measured at sideways-scroll start: List's action row is sticky.)
  const formEl = page.locator('form').filter({ has: marked });
  await formEl.evaluate((f) => { for (let e: Element | null = f; e; e = e.parentElement) e.scrollLeft = 0; });
  const save = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!;
  const form = (await formEl.boundingBox())!;
  expect(Math.abs(save.x - form.x)).toBeLessThan(1);
  // ui-rules 20: the action row is one line (every button at the same top)
  // whenever its buttons fit the container; same in every view.
  const row = await page.getByRole('button', { name: 'Save', exact: true }).evaluate((save) => {
    const stack = save.closest('.action-stack')!;
    const bs = [...stack.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
    return { tops: [...new Set(bs.map((b) => Math.round(b.top)))], total: bs.reduce((a, b) => a + b.width, 0), room: stack.closest('.action-buttons')!.getBoundingClientRect().width };
  });
  if (row.total <= row.room) expect(row.tops, `action row split across lines (buttons ${row.total}px of ${row.room}px)`).toHaveLength(1);
}

// ui-rules 21 and 22. The full action row (Everyaction coffee: save, cancel,
// delete, box, freeze, archive) is inside the viewport, and its gaps above
// (from the form) and below (to the item's edge) match Compact's, in every view.
const ACTION_GAP = { above: 16, belowMin: 12, belowMax: 18 }; // Compact/Cards, px (Compact 13, Cards 17)
async function expectActionRow(page: Page) {
  const m = await page.getByRole('button', { name: 'Save', exact: true }).evaluate((save) => {
    const wrap = save.closest('.action-buttons')!;
    const bs = [...wrap.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
    const item = wrap.closest('.card, .compact-row-wrap, tr')!.getBoundingClientRect();
    const top = Math.min(...bs.map((b) => b.top));
    const bottom = Math.max(...bs.map((b) => b.bottom));
    return {
      n: bs.length,
      right: Math.max(...bs.map((b) => b.right)),
      left: Math.min(...bs.map((b) => b.left)),
      itemLeft: item.left,
      itemRight: item.right,
      perLine: [...Map.groupBy(bs, (b) => Math.round(b.top)).values()].map((l) => l.length),
      widths: bs.map((b) => b.width),
      above: top - wrap.previousElementSibling!.getBoundingClientRect().bottom,
      below: item.bottom - bottom,
      minW: Math.min(...bs.map((b) => b.width)),
      minH: Math.min(...bs.map((b) => b.height))
    };
  });
  const vw = page.viewportSize()!.width;
  expect(m.n).toBe(6);
  expect(m.right, 'an action button spills past the right edge').toBeLessThanOrEqual(vw);
  expect(m.left).toBeGreaterThanOrEqual(0);
  // ...and inside its own card/row: a desktop card is narrower than the viewport,
  // so an overflowing row spills into the next card while still in the viewport.
  expect(m.right, 'an action button spills past its card/row').toBeLessThanOrEqual(m.itemRight + 0.5);
  expect(m.left, 'an action button spills past its card/row').toBeGreaterThanOrEqual(m.itemLeft - 0.5);
  // A row too wide for a narrow card wraps as two equal rows of three, not 5 + 1
  // with a stretched last icon (user decision 2026-10-06).
  if (m.perLine.length > 1) {
    expect(m.perLine, 'wrapped action row is not 3 + 3').toEqual([3, 3]);
    expect(Math.max(...m.widths) - Math.min(...m.widths), `unequal icon widths ${m.widths}`).toBeLessThanOrEqual(1);
  }
  expect(m.minW, `narrowest action button ${m.minW}px, under the 44px tap target`).toBeGreaterThanOrEqual(44);
  expect(m.minH, `shortest action button ${m.minH}px, under the 44px tap target`).toBeGreaterThanOrEqual(44);
  expect(Math.abs(m.above - ACTION_GAP.above), `gap above ${m.above}`).toBeLessThanOrEqual(2);
  expect(m.below, `gap below ${m.below}`).toBeGreaterThanOrEqual(ACTION_GAP.belowMin);
  expect(m.below, `gap below ${m.below}`).toBeLessThanOrEqual(ACTION_GAP.belowMax);
  // List: the row is also inside the sideways-scrolling table's visible box,
  // with the table scrolled fully left (as opened) and fully right (where the
  // Edit button is), not clipped by .table-scroll at either end.
  const clipped = await page.getByRole('button', { name: 'Save', exact: true }).evaluate((save) => {
    const scroller = save.closest('.table-scroll');
    if (!scroller) return [];
    const out: string[] = [];
    for (const end of [0, scroller.scrollWidth]) {
      scroller.scrollLeft = end;
      const box = scroller.getBoundingClientRect();
      for (const b of save.closest('.action-buttons')!.querySelectorAll('button')) {
        const r = b.getBoundingClientRect();
        if (r.left < box.left - 0.5 || r.right > box.right + 0.5) {
          out.push(`${b.getAttribute('aria-label') ?? b.textContent?.trim()} ${r.left.toFixed(1)}–${r.right.toFixed(1)} outside ${box.left}–${box.right} at scrollLeft ${scroller.scrollLeft}`);
        }
      }
    }
    return out;
  });
  expect(clipped, 'action buttons clipped by the table scroller').toEqual([]);
}

// Contained, never cropped, on its fill (spec "Image fill and fit").
const WIDE_FILL = 'rgb(242, 193, 78)'; // seeded #f2c14e
const NEUTRAL = 'rgb(230, 221, 210)'; // NEUTRAL_BACKDROP #e6ddd2
async function expectContained(img: Locator, background?: string) {
  const s = await img.evaluate((el) => ({ fit: getComputedStyle(el).objectFit, bg: getComputedStyle(el).backgroundColor }));
  expect(s.fit).toBe('contain');
  if (background) expect(s.bg).toBe(background);
  else expect(s.bg).not.toBe('rgba(0, 0, 0, 0)');
}

// Image Suggest: the endpoint is stubbed (no network, nothing saved). Moonwake
// (frozen seed coffee) has a roaster and a name and no product URL.
const svg = (w: number, h: number, fill: string) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`);
const SITE = 'https://moonwake.example';
const BEANHOARD = 'https://www.beanhoard.example/coffees/moonwake-ethiopia-bensa-bombe-anaerobic-natural-lot-7';
const EXCERPT =
  'Tasting notes: peach, jasmine and bergamot up front, then a long honeyed finish with a little cacao; washed station ' +
  'lot from the 2026 harvest, roasted light for filter brewing. Grown by smallholders around Bensa at 2,100 m, cherries ' +
  'sorted twice, fermented 72 hours in sealed tanks, dried on raised beds for three weeks before…';
const SUGGEST_OK = {
  status: 'ok', site: SITE, storedSite: SITE, notes: ['tavily unavailable (rate limited)'],
  candidates: [
    { image: svg(64, 64, '#6b4f3a'), pageUrl: `${SITE}/products/bensa-bombe`, pageTitle: 'Ethiopia Bensa Bombe', provider: 'shopify', published: '2026-09-20', excerpt: EXCERPT, closest: true },
    { image: svg(160, 40, '#f2c14e'), pageUrl: `${SITE}/products/bensa-bombe`, pageTitle: 'Ethiopia Bensa Bombe', provider: 'shopify', published: '2026-09-20', excerpt: EXCERPT, closest: false },
    { image: svg(40, 160, '#4a7c59'), pageUrl: BEANHOARD, pageTitle: 'Moonwake Coffee Roasters — Ethiopia Bensa Bombe Anaerobic Natural Lot 7 (2026 harvest)', provider: 'tavily', published: null, excerpt: 'Anaerobic natural lot.', closest: false },
    { image: svg(64, 64, '#2e6f9e'), pageUrl: `${SITE}/products/bensa-bombe-espresso`, pageTitle: 'Bensa Bombe Espresso', provider: 'shopify', published: '2025-11-02', excerpt: null, closest: false },
    { image: svg(64, 48, '#c0392b'), pageUrl: `${SITE}/products/bensa-bombe-espresso`, pageTitle: 'Bensa Bombe Espresso', provider: 'shopify', published: '2025-11-02', excerpt: null, closest: false },
    { image: svg(48, 64, '#7b4fa0'), pageUrl: `${SITE}/collections/archive/products/bensa-2025`, pageTitle: 'Bensa Bombe 2025', provider: 'shopify', published: null, excerpt: null, closest: false }
  ]
};
// No stored site: a pick on the roaster's own host stages it (pickCandidate).
const SUGGEST_UNSTORED = { ...SUGGEST_OK, storedSite: null };
const reply = (body: object, status = 200) => (route: Route) => route.fulfill({ status, json: body });
// Opens Edit on the Moonwake coffee and presses Suggest: the results dialog
// opens. A null reply leaves the request hanging (the "Searching…" state).
async function openSuggest(page: Page, handler: ((route: Route) => Promise<void>) | null, processing?: string) {
  await page.route('**/api/coffees/image-suggest', (route) => (handler ? handler(route) : undefined));
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  if (processing !== undefined) await page.locator('#processing').fill(processing);
  await page.getByRole('button', { name: 'Suggest', exact: true }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  // Opening never focuses a text input (the phone keyboard would pop).
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
}
const dlg = (page: Page) => page.locator('dialog[open]');
// The dialog sits inside the viewport, scrolls only vertically, and its
// header and footer buttons are fully on screen (checkLayout covers the page).
async function expectDialogInViewport(page: Page) {
  const problems = await dlg(page).evaluate((d) => {
    const out: string[] = [];
    const inside = (r: DOMRect) => r.left >= -0.5 && r.top >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
    if (!inside(d.getBoundingClientRect())) out.push('dialog leaves the viewport');
    for (const el of [d, ...d.querySelectorAll('*')]) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') out.push(`scrolls sideways: ${el.className}`);
    }
    for (const b of d.querySelectorAll('header button, footer button')) {
      if (!inside(b.getBoundingClientRect())) out.push(`button off screen: ${b.textContent || b.getAttribute('aria-label')}`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

// Answers the Add form's ?/create with a made-up success, so the "Coffee added!"
// popup shows without saving (the workers share one DB); hovering keeps it up.
async function fakeAdd(page: Page, slug: string) {
  await page.route(/\?\/create$/, (route) =>
    route.fulfill({ json: { type: 'success', status: 200, data: JSON.stringify([{ success: 1, id: 2, slug: 3 }, true, 0, slug]) } }));
  await page.locator('#roaster').fill('Popup Roaster');
  await page.locator('#coffee_name').fill('Popup Coffee');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const toast = page.locator('.added-toast');
  await expect(toast).toContainText('Coffee added!');
  await toast.hover();
  await expect(toast).toHaveCSS('opacity', '1'); // fade-in done, for the screenshot
  await expect(toast.getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/coffees/${slug}`);
}

// A value bar turns accent on hover (mouse only). Headless Firefox can report (hover: none), where the
// rule can't apply; then check the rule is there.
async function expectBarHover(page: Page) {
  const row = page.locator('.board-row.bar').first();
  const bar = () => row.evaluate((e) => getComputedStyle(e, '::before').backgroundColor);
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    const before = await bar();
    await row.hover();
    await expect.poll(bar).not.toBe(before);
    // The row's text turns ink over the deeper bar (accent link and muted subtext would fall under 4.5:1).
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    await expect.poll(() => row.locator('.who *').evaluateAll((els, c) => els.filter((e) => !e.closest('[popover]') && getComputedStyle(e).color !== c).map((e) => e.outerHTML.slice(0, 80)), ink)).toEqual([]);
    return;
  }
  const found = await page.evaluate(() => [...document.styleSheets].some((sh) => {
    let rules: CSSRule[] = [];
    try { rules = [...sh.cssRules]; } catch { /* cross-origin (fonts) */ }
    return rules.some((r) => r instanceof CSSMediaRule && r.conditionText === '(hover: hover)' && r.cssText.includes('.board-row.bar:hover::before'));
  }));
  expect(found).toBe(true);
  expect(await row.evaluate((e) => getComputedStyle(e, '::before').transitionProperty)).toBe('background-color');
}

// UTC calendar days back: never after the insights "today" (local is behind UTC).
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// Every page and state the layout rules apply to. Every UI change adds its
// states here (docs/ui-rules.md). Actions must not save anything: the
// workers share one DB.
// Gate 3: a panel holding only an empty line (whole-tab .hl-empty, a board's empty note) is short: its blank
// area is the line's own padding, not a chart's or a band's height (text may wrap to 3 lines at 360).
async function expectShortEmpty(page: Page) {
  const tall = await page.locator('section.chart-panel:has(> .hl-empty), .board:has(.board-note:not(.fill))').evaluateAll((ps) =>
    ps.filter((p) => {
      const note = p.querySelector('.hl-empty, .board-note')!;
      const lines = note.getBoundingClientRect().height / parseFloat(getComputedStyle(note).lineHeight);
      // Nothing blank below the note: the panel ends within its padding of the note's bottom (M4).
      const slack = p.getBoundingClientRect().bottom - note.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom);
      return lines > 5 || p.getBoundingClientRect().height > 200 || slack > 2;
    }).map((p) => `${p.className} ${Math.round(p.getBoundingClientRect().height)}px`));
  expect(tall, 'empty panels one short line').toEqual([]);
}

// Control-bar row gaps by visible ink (U2); source of the in-page function evaluated by insights-bar-gaps.
const BAR_GAPS = `() => { const cx=document.createElement('canvas').getContext('2d'); const bar=document.querySelector('.insights-controls'); const rows=[];
 const vis = (el) => { // visible extent: label text range top; controls (select/button/chip) border box
  let top=Infinity,bottom=-Infinity;
  for (const n of el.querySelectorAll('span:not(.badge), select, button, .filter-chip')) {
   if (n.tagName==='SPAN' && ((n.closest('button') && !n.classList.contains('tip-text')) || n.querySelector('button'))) continue;
   if (n.classList.contains('mode-tip-button')) continue; // its tap padding is not ink; the label's .tip-text is measured instead
   let r; if (n.tagName==='SPAN') { const g=document.createRange(); g.selectNodeContents(n); r=g.getBoundingClientRect(); if(r.height){ const cs=getComputedStyle(n); cx.font=cs.font; const m=cx.measureText(n.textContent.trim()); const content=m.fontBoundingBoxAscent+m.fontBoundingBoxDescent; const base=r.top+(r.height-content)/2+m.fontBoundingBoxAscent; top=Math.min(top,base-m.actualBoundingBoxAscent);} continue; }
   r=n.getBoundingClientRect(); if(!r.height) continue; top=Math.min(top,r.top); bottom=Math.max(bottom,r.bottom); }
  return {top,bottom}; };
 for (const el of bar.children) { const r=el.getBoundingClientRect(); if(!r.height) continue; const v=vis(el); const k=rows.find(x=>Math.abs(x.bt-r.top)<4);
  if(k){k.top=Math.min(k.top,v.top);k.bottom=Math.max(k.bottom,v.bottom)} else rows.push({bt:r.top,top:v.top,bottom:v.bottom}); }
 return rows.slice(1).map((r,i)=>Math.round((r.top-rows[i].bottom)*10)/10); }`;

// Each Right now tile link sits inside its tile box.
async function expectLinksInTiles(page: Page, links: Locator) {
  const out = await links.evaluateAll((as) => as.map((a) => {
    const l = a.getBoundingClientRect(), t = a.closest('.stat-item')!.getBoundingClientRect();
    return l.top >= t.top - 0.5 && l.bottom <= t.bottom + 0.5 && l.left >= t.left - 0.5 && l.right <= t.right + 0.5;
  }));
  expect(out, 'every See link inside its tile').not.toContain(false);
}

// /coffees button row under the search box: Share is the last button (rightmost on its line, ui-rules 51); on a phone
// every line of buttons spans the search box exactly (left and right edges, ±1px), equal widths when the row is one line.
async function expectSearchRowButtons(page: Page, split33 = false) {
  const r = await page.evaluate(() => {
    const row = document.querySelector('.coffees-search-row')!;
    const box = row.querySelector('.search-input')!.getBoundingClientRect();
    const btns = [...row.querySelectorAll(':scope > .filter-anchor > .button, :scope > .button')].map((b) => ({ t: b.textContent!.trim(), r: b.getBoundingClientRect() }));
    const lines = new Map<number, typeof btns>();
    for (const b of btns) lines.set(Math.round(b.r.top), [...(lines.get(Math.round(b.r.top)) ?? []), b]);
    const last = btns[btns.length - 1];
    return {
      shareLast: last.t === 'Share' && btns.every((b) => b === last || b.r.top < last.r.top - 1 || b.r.left < last.r.left),
      phone: innerWidth <= 640,
      wide: innerWidth >= 480,
      lines: [...lines.values()].map((l) => ({
        left: Math.min(...l.map((b) => b.r.left)) - box.left, right: Math.max(...l.map((b) => b.r.right)) - box.right,
        widths: l.map((b) => b.r.width)
      }))
    };
  });
  expect(r.shareLast, 'Share is the last, rightmost button').toBe(true);
  if (!r.phone) return;
  if (split33) expect(r.lines.map((l) => l.widths.length), 'editing: three buttons and three').toEqual([3, 3]);
  for (const l of r.lines) {
    expect(Math.abs(l.left), 'button line left edge = search box left').toBeLessThanOrEqual(1);
    expect(Math.abs(l.right), 'button line right edge = search box right').toBeLessThanOrEqual(1);
    // Equal widths when the whole row fits one line from 480 up; narrower, a label's own width wins (lines still span).
    if (r.lines.length === 1 && r.wide) expect(Math.max(...l.widths) - Math.min(...l.widths), 'equal widths in a single-line row').toBeLessThanOrEqual(1);
  }
}

// The SSR head tags of `path`, read signed out through the request API and parsed in the page, so it holds in dev and prod builds.
async function previewTags(page: Page, path: string): Promise<Record<string, string>> {
  const ctx = await request.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const res = await ctx.get(path);
    expect(res.status()).toBe(200);
    const html = await res.text();
    return await page.evaluate((h) => {
      const out: Record<string, string> = {};
      for (const m of new DOMParser().parseFromString(h, 'text/html').head.querySelectorAll('meta[property], meta[name]'))
        out[m.getAttribute('property') ?? m.getAttribute('name')!] = m.getAttribute('content') ?? '';
      return out;
    }, html);
  } finally {
    await ctx.dispose();
  }
}

// A word never breaks mid-word, a value never parts from its unit, nothing is wider than its box (user, gate 2).
// Words: every word of the text in `sel` is one line box (one client rect). Units: a `.unit`'s line is its value's last line.
// Overflow: no .fit / .unit sticks out of its .big (or tile headline `b`). `fit` (a selector inside each match) is first
// rewritten to each of `words`, with --w set as the server does (and the dash glue applied), so long names are covered too.
// A selector matching nothing fails (a check that checks nothing).
async function expectNoMidWord(page: Page, sel: string, fit?: string, words: string[] = []) {
  const check = () => page.evaluate((sel) => {
    const bad: string[] = [];
    const els = [...document.querySelectorAll(sel)];
    if (!els.length) return ['matched no element'];
    for (const el of els) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.textContent ?? '';
        for (const m of t.matchAll(/[^\s\u00a0]+/g)) {
          const r = document.createRange();
          r.setStart(n, m.index!); r.setEnd(n, m.index! + m[0].length);
          const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4)));
          if (tops.size > 1) bad.push(`${m[0]} split (${(el as HTMLElement).className})`);
        }
      }
      // A number and a unit typed into the text itself ("22–30 d", "1,522 brews") stay on one line: the last two words of a .big.
      if (el.matches('.big, .big *, b')) {
        const txt = el.textContent ?? '';
        const m = /(\d[^\s\u00a0]*)[ \u00a0]+([A-Za-z%°]{1,6})\s*$/.exec(txt);
        if (m) {
          const nodes: { n: Node; start: number }[] = [];
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(), at = 0; n; n = w.nextNode()) { nodes.push({ n, start: at }); at += n.textContent!.length; }
          const at = (pos: number) => { const x = [...nodes].reverse().find((q) => q.start <= pos)!; return [x.n, pos - x.start] as const; };
          const rect = (from: number, to: number) => { const r = document.createRange(); r.setStart(...at(from)); r.setEnd(...at(to - 1)); r.setEnd(r.endContainer, r.endOffset + 1); return [...r.getClientRects()].filter((q) => q.width > 0); };
          const numStart = m.index, unitStart = m.index + m[0].length - m[0].trimStart().length + m[0].indexOf(m[2], m[1].length);
          const nr = rect(numStart, numStart + m[1].length).at(-1), ur = rect(unitStart, unitStart + m[2].length)[0];
          if (nr && ur && (ur.top + ur.height / 2 < nr.top || ur.top + ur.height / 2 > nr.bottom)) bad.push(`"${m[1]} ${m[2]}": unit on another line than its number`);
        }
      }
      const box = (el.closest('.big, b') ?? el) as HTMLElement;
      const fitEl = box.querySelector('.fit');
      if (fitEl && !box.classList.contains('names')) {
        const c = box.getBoundingClientRect();
        for (const u of box.querySelectorAll('.fit, .unit:not(.gap)')) if (u.getBoundingClientRect().right > c.right + 1) bad.push(`${u.className || 'fit'} wider than its box`);
        if (box.scrollWidth > box.clientWidth + 1) bad.push(`${box.className || box.tagName} overflows (${box.scrollWidth} > ${box.clientWidth})`);
        for (const u of box.querySelectorAll('.unit:not(.gap)')) {
          const v = document.createRange();
          v.setStart(fitEl, 0); v.setEndBefore(u);
          const last = [...v.getClientRects()].filter((x) => x.width > 0).at(-1);
          const ur = u.getBoundingClientRect();
          const mid = ur.top + ur.height / 2;
          if (last && (mid < last.top || mid > last.bottom)) bad.push(`unit "${u.textContent}" on another line than its value`);
        }
      }
    }
    return bad;
  }, sel);
  expect(await check(), `${sel}: words split across lines`).toEqual([]);
  if (!fit) return;
  for (const word of words) {
    await page.evaluate(([fit, word, glued]) => {
      const el = document.querySelector(fit) as HTMLElement;
      el.textContent = glued;
      el.style.setProperty('--w', String(Math.max(...word.split(/\s+/).map((x) => x.length))));
    }, [fit, word, glue(word)]);
    expect(await check(), `${sel} with "${word}"`).toEqual([]);
  }
}
// Chart value labels never touch a mark or each other (user, gate 2): every SVG <text> box in the recap charts is clear of
// the other texts, of bars/circles (boxes), and of every line/polyline (sampled along its stroke).
async function expectChartLabelsClear(page: Page, scope = '.slide, .tile') {
  const found = await page.evaluate((scope) => {
    const out: string[] = [];
    let charts = 0;
    for (const svg of document.querySelectorAll(`:is(${scope}) svg.viz`)) {
      charts++;
      // A text's box is its ink: the central 70% of the line box (ascender/descender slack is not ink).
      const texts = [...svg.querySelectorAll('text')].map((t) => { const b = (t as SVGGraphicsElement).getBBox(); return { t, b: { x: b.x, width: b.width, y: b.y + b.height * 0.15, height: b.height * 0.7 } as SVGRect }; }).filter((x) => x.b.width > 0);
      const hit = (a: DOMRect | SVGRect, b: DOMRect | SVGRect) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
      texts.forEach((a, i) => {
        for (const b of texts.slice(i + 1)) if (hit(a.b, b.b)) out.push(`"${a.t.textContent}" overlaps "${b.t.textContent}" (${svg.getAttribute('class')})`);
        for (const m of svg.querySelectorAll('rect, circle')) if (hit(a.b, (m as SVGGraphicsElement).getBBox())) out.push(`"${a.t.textContent}" overlaps a ${m.tagName} (${svg.getAttribute('class')})`);
        for (const l of svg.querySelectorAll('line, polyline')) {
          const g = l as unknown as SVGGeometryElement;
          const len = g.getTotalLength();
          for (let d = 0; d <= len; d += 2) {
            const p = g.getPointAtLength(d);
            if (p.x >= a.b.x && p.x <= a.b.x + a.b.width && p.y >= a.b.y && p.y <= a.b.y + a.b.height) { out.push(`"${a.t.textContent}" sits on a ${l.tagName} (${svg.getAttribute('class')})`); break; }
          }
        }
      });
    }
    return { out, charts };
  }, scope);
  expect(found.charts, 'no chart to check').toBeGreaterThan(0);
  expect(found.out).toEqual([]);
}
const LONG_NAMES = ['Origami', 'Kalita Wave 185', 'Hario Switch', 'Chemex Eight Cup Classic', 'Supercalifragilistic', '22–30d', '22-30d', '114–118d+'];

export const STATES: State[] = [
  // Year in review: /recaps/<Y> is the current local year's recap, an admin's ?preview=1; Y - 1 is the thin public seed year.
  { name: 'recaps-cover', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      const slide = page.locator('.recap-reel > section').first();
      const box = (await slide.boundingBox())!, vh = await page.evaluate(() => innerHeight);
      expect(Math.abs(box.height - vh), 'cover fills the viewport').toBeLessThanOrEqual(1);
      for (const sel of ['.big', '.context']) {
        const b = (await slide.locator(sel).boundingBox())!;
        expect(b.y, `${sel} inside the slide`).toBeGreaterThanOrEqual(box.y - 1);
        expect(b.y + b.height, `${sel} inside the slide`).toBeLessThanOrEqual(box.y + box.height + 1);
      }
      await expect(slide).toHaveAttribute('id', 'cover');
      await expect(slide.getByRole('link', { name: 'Bean Tracker' })).toBeVisible();
      await expect(slide.getByText('Swipe or tap to continue')).toBeVisible();
      await expect(slide.locator('.big')).toHaveText(`${recapYear()} in coffee`);
      // The home link and hint live on the cover only.
      await expect(page.getByRole('link', { name: 'Bean Tracker' })).toHaveCount(1);
      await expect(page.getByText('Swipe or tap to continue')).toHaveCount(1);
      await expect(page.locator('.bottom-tabs')).toBeHidden();
      await expect(page.locator('nav.site-nav')).toHaveCount(0);
      // Keyword-colored names and signed deltas take the slide's text color on a tone.
      await page.locator('.recap-reel > section.slide .context').first().evaluate((c) => {
        c.insertAdjacentHTML('beforeend', '<span class="coffee-name" id="probe-name" style="color:rgb(255,0,0)">x</span><span class="ink-better" id="probe-delta">+0.3</span>');
      });
      for (const id of ['probe-name', 'probe-delta']) {
        const [el, sl] = await page.locator(`#${id}`).evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e.closest('section')!).color]);
        expect(el, `${id} takes the slide text color`).toBe(sl);
      }
      const off = await page.locator('.recap-reel > section.slide').evaluateAll((sl) => sl.flatMap((s) => [...s.querySelectorAll('.coffee-name, .ink-better, .ink-worse')]
        .filter((e) => getComputedStyle(e).color !== getComputedStyle(s).color).map((e) => e.textContent)));
      expect(off, 'names/deltas off the slide text color').toEqual([]);
    } },
  // The top-left nav (Back, All recaps): 44px targets, clear of the progress segments, the Share button and the slide's text, on every slide.
  { name: 'recaps-nav', path: () => `/recaps/${recapYear() - 1}`,
    act: async (page) => {
      const links = page.locator('.recap-nav a');
      await expect(links).toHaveText(['Back', 'All recaps']);
      // Opened directly, an in-page navigation to a slide link (?slide=, a client navigation on the same route) is not an earlier in-app page: Back stays the plain
      // link to the Recaps tab, not history.back() (which would leave the site).
      const here = page.url();
      await page.evaluate(() => {
        const id = document.querySelector('.recap-reel > section:nth-of-type(2)')!.id;
        const a = Object.assign(document.createElement('a'), { href: `${location.pathname}?slide=${id}` });
        document.body.append(a); a.click(); a.remove();
      });
      await expect.poll(() => page.url()).toContain('slide=');
      await page.evaluate(() => { history.back = () => {}; }); // a hijacked Back would call this and go nowhere
      await links.first().click();
      await expect(page).toHaveURL(/\/stats\?tab=recaps/);
      await gotoReady(page, here);
      await expect(links.nth(1)).toHaveAttribute('href', '/stats?tab=recaps');
      const n = await page.locator('.recap-reel > section.slide').count();
      for (let i = 0; i <= n; i++) {
        await page.locator('.recap-progress button').nth(i).click();
        await expect(page.locator('.recap-progress button').nth(i)).toHaveAttribute('aria-current', 'true');
        // wait for the smooth scroll to settle on this slide
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.recap-reel > section')].some((s) => Math.abs(s.getBoundingClientRect().top) < 4))).toBe(true);
        const r = await page.evaluate(() => {
          const rect = (e: Element) => e.getBoundingClientRect();
          const navs = [...document.querySelectorAll('.recap-nav a')].map(rect);
          const prog = rect(document.querySelector('.recap-progress')!).bottom;
          const cur = [...document.querySelectorAll('.recap-reel > section')].find((s) => Math.abs(rect(s).top) < 4);
          const others = cur ? [...cur.querySelectorAll('.share-button, .lead, .big, .names, .inner > *, .page > header > *')].map(rect).filter((x) => x.width > 0) : [];
          const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          return { found: !!cur, sizes: navs.map((x) => [Math.round(x.width), Math.round(x.height)]), belowProgress: navs.every((x) => x.top >= prog - 1), apart: navs[0].right <= navs[1].left, hits: others.filter((o) => navs.some((nv) => hit(nv, o))).length, inView: navs.every((x) => x.left >= 0 && x.right <= innerWidth) };
        });
        for (const [w, h] of r.sizes) { expect(h, `slide ${i}: nav target height`).toBeGreaterThanOrEqual(44); expect(w).toBeGreaterThanOrEqual(44); }
        expect(r, `slide ${i}`).toMatchObject({ found: true, belowProgress: true, apart: true, hits: 0, inView: true });
      }
    } },
  // The per-person companion ("An average of 4 per person") under the big value of total, busiest-day and spend: one line, left-aligned
  // with the big, smaller than .sub, inside the slide, readable on its tone. The household-of-one absence is in save.spec.
  { name: 'recaps-each', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      await expect(page.locator('.people-switch'), 'the toggle is gone').toHaveCount(0);
      for (const id of ['total', 'busiest-day', 'spend']) {
        const slide = page.locator(`.slide[data-id="${id}"]`);
        await expect(slide, `the seed year has a ${id} slide`).toHaveCount(1);
        await slide.scrollIntoViewIfNeeded();
        await page.locator('.recap-reel').evaluate((reel, i) => { document.getElementById(i)!.scrollIntoView({ behavior: 'instant' }); }, id);
        await expect.poll(() => slide.evaluate((e) => Math.abs(e.getBoundingClientRect().top) < 4)).toBe(true);
        await expect(slide.locator('.each')).toHaveText(/^An average of \$?[\d,]+(\.\d\d)? per person$/);
        const r = await slide.evaluate((sl) => {
          const rc = (e: Element) => e.getBoundingClientRect();
          const each = sl.querySelector('.each span')!, big = sl.querySelector('.big')!, fit = sl.querySelector('.big .fit')!;
          const range = document.createRange(); range.selectNodeContents(each);
          const lines = new Set([...range.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 3))).size;
          const inner = rc(sl.querySelector('.inner')!), sub = sl.querySelector('.sub');
          const left = (e: Element) => { const rg = document.createRange(); rg.selectNodeContents(e); return rg.getBoundingClientRect().left; };
          return { lines, right: rc(each).right <= inner.right + 1 && rc(each).left >= inner.left - 1, below: rc(each).top >= rc(big).bottom - rc(big).height * 0.3,
            // the figure's first glyph and the line's sit on one left edge (the big has a small negative margin and glyph side bearing)
            dx: Math.abs(left(each) - left(fit)),
            fs: parseFloat(getComputedStyle(each).fontSize), subFs: sub ? parseFloat(getComputedStyle(sub).fontSize) : 99,
            ctxFs: parseFloat(getComputedStyle(sl.querySelector('.context')!).fontSize), gap: rc(each).top - rc(fit).bottom, over: each.scrollWidth > each.clientWidth + 1 };
        });
        expect(r, id).toMatchObject({ lines: 1, right: true, below: true, over: false });
        expect(r.fs, `${id}: the shrink-to-fit floor stays readable`).toBeGreaterThanOrEqual(12);
        expect(r.dx, `${id}: left-aligned with the big`).toBeLessThanOrEqual(8);
        expect(r.fs, `${id}: no bigger than .sub`).toBeLessThanOrEqual(r.subFs);
        expect(r.fs, `${id}: a headline over the context line`).toBeGreaterThan(r.ctxFs);
        expect(r.gap, `${id}: tight under the big value`).toBeLessThanOrEqual(r.fs * 0.9);
        const [fg, bg] = await slide.evaluate((sl) => [getComputedStyle(sl.querySelector('.each')!).color, getComputedStyle(sl).backgroundColor]);
        expect(fg, 'same text color as the slide').toBe(await slide.evaluate((sl) => getComputedStyle(sl).color));
        void bg;
      }
      await expectNoMidWord(page, '.slide .each');
    } },
  { name: 'recaps-chart-labels', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => { await expectChartLabelsClear(page); } },
  { name: 'recaps-no-midword', path: () => `/recaps/${recapYear() - 1}`,
    act: async (page) => {
      // The preview year has the most facts, the rest slide ("22–30d") among them: the same words/units/overflow check there.
      await page.goto(`/recaps/${recapYear()}?preview=1`);
      await reloadReady(page);
      await expect(page.locator('section.slide[data-id="rest"]'), 'the seed year has a rest slide').toHaveCount(1);
      await expectNoMidWord(page, '.slide .big, .slide .names, .slide .lead, .slide .sub, .slide .each, .slide .context, .tile .big, .tile .names, .tile .lead, .tile .sub, .tile .context, .hlist .k');
      await page.goto(`/recaps/${recapYear() - 1}`);
      await reloadReady(page);
      await expectNoMidWord(page, '.slide .big, .slide .names, .slide .lead, .slide .sub, .slide .each, .slide .context, .tile .big, .tile .names, .tile .lead, .tile .sub, .tile .context, .hlist .k');
      await expectNoMidWord(page, '.slide:not(.cover) .big:not(.names)', '.slide:not(.cover) .big:not(.names) .fit', LONG_NAMES);
      await expectNoMidWord(page, '.tile .big:not(.names)', '.tile .big:not(.names) .fit', LONG_NAMES);
    } },
  { name: 'recaps-slide-nav', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      const ids = await page.locator('.recap-reel > section').evaluateAll((els) => els.map((e) => e.id));
      expect(ids.length, 'cover, a second slide, a third and the poster').toBeGreaterThanOrEqual(4);
      const inView = (id: string) => expect.poll(async () => Math.abs((await page.locator(`#${id}`).boundingBox())!.y), { message: `${id} in view` }).toBeLessThan(2);
      const [w, h] = await page.evaluate(() => [innerWidth, innerHeight]);
      await page.mouse.click(w * 0.8, h - 10); // the cover's hint line: no link, button or viz under it
      await expect.poll(() => new URL(page.url()).hash).toBe(`#${ids[1]}`);
      await inView(ids[1]);
      expect(new URL(page.url()).search, 'preview stays, slide never appears').toBe('?preview=1');
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; }).toBe(`/recaps/${recapYear()}?preview=1`);
      await inView(ids[0]);
      await page.locator('.recap-progress button').nth(2).click();
      await inView(ids[2]);
      await expect.poll(() => new URL(page.url()).hash).toBe(`#${ids[2]}`);
    } },
  { name: 'recaps-slide-viz', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      const slides = page.locator('.recap-reel > section.slide');
      const n = await slides.count();
      expect(n).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < n; i++) {
        const sl = slides.nth(i);
        await sl.evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
        expect(await sl.evaluate((el) => el.scrollHeight - el.clientHeight), `slide ${i} (${await sl.getAttribute('id')}) content taller than the slide`).toBeLessThanOrEqual(0);
        // A word unit follows its number with a space (1,522 brews); a symbol unit does not.
        for (const bigEl of await sl.locator('.big:has(.unit)').all()) {
          const [txt, unit] = await bigEl.evaluate((e) => [e.textContent ?? '', [...e.querySelectorAll('.unit')].at(-1)!.textContent ?? '']);
          if (/^[A-Za-z]{2,}/.test(unit)) expect(txt, `slide ${i} word unit spaced`).toMatch(new RegExp(`\\S[ \u00a0]${unit}$`));
        }
        // A big value's unit never breaks mid-word: it sits on one line.
        for (const u of await sl.locator('.big .unit:not(.gap)').all()) expect(await u.evaluate((e) => e.getClientRects().length), `slide ${i} unit on one line`).toBe(1);
        const box = (await sl.boundingBox())!;
        for (const sel of ['.vizwrap', '.traits', '.big', '.context', 'a.more']) {
          for (const el of await sl.locator(sel).all()) {
            const b = (await el.boundingBox())!;
            expect(b.x, `slide ${i} ${sel} left`).toBeGreaterThanOrEqual(box.x - 1);
            expect(b.x + b.width, `slide ${i} ${sel} right`).toBeLessThanOrEqual(box.x + box.width + 1);
            expect(b.y, `slide ${i} ${sel} top`).toBeGreaterThanOrEqual(box.y - 1);
            expect(b.y + b.height, `slide ${i} ${sel} bottom`).toBeLessThanOrEqual(box.y + box.height + 1);
          }
        }
      }
    } },
  { name: 'recaps-prior-year', path: () => `/recaps/${recapYear() - 1}`,
    act: async (page) => {
      const slides = page.locator('.recap-reel > section');
      expect(await slides.count(), 'a slide plus the poster').toBeGreaterThanOrEqual(2);
      const bigs = await page.locator('.recap-reel > section.slide .big').allTextContents();
      expect(bigs.length).toBeGreaterThanOrEqual(1);
      for (const b of bigs) expect(b.trim(), 'every slide has a big value').not.toBe('');
      await expect(page.locator('.recap-reel > section.slide')).toHaveCount(bigs.length);
    } },
  // A slide's link preview: the SSR tags point at that slide's card, and the card is a PNG.
  { name: 'recaps-preview-tags', viewports: 'two', path: () => `/recaps/${recapYear() - 1}?slide=total`,
    act: async (page) => {
      const t = await previewTags(page, `/recaps/${recapYear() - 1}?slide=total`);
      expect(t['og:image']).toMatch(new RegExp(`/recaps/${recapYear() - 1}/card/total\\.png$`));
      expect(t['twitter:card']).toBe('summary_large_image');
      const ctx = await request.newContext({ baseURL: new URL(page.url()).origin });
      try {
        const res = await ctx.get(`/recaps/${recapYear() - 1}/card/total.png`);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toBe('image/png');
      } finally { await ctx.dispose(); }
    } },
  { name: 'recaps-unknown-slide', viewports: 'two', path: () => `/recaps/${recapYear() - 1}?slide=nope`,
    act: async (page) => {
      const ids = await page.locator('.recap-reel > section').evaluateAll((els) => els.map((e) => e.id));
      const inView = (id: string) => expect.poll(async () => Math.abs((await page.locator(`#${id}`).boundingBox())!.y), { message: `${id} in view` }).toBeLessThan(2);
      await inView(ids[0]);
      await page.goto(`/recaps/${recapYear() - 1}#nope`);
      await inView(ids[0]);
    } },
  { name: 'recaps-dark', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      await page.emulateMedia({ colorScheme: 'dark' }); // the layout reads the scheme at mount: reload
      await reloadReady(page);
      const r = await page.locator('.recap-reel > section').first().evaluate((el) => {
        const probe = document.createElement('div');
        probe.style.background = `var(--t-${(el as HTMLElement).dataset.tone})`;
        document.body.append(probe);
        const want = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { bg: getComputedStyle(el).backgroundColor, want, token: getComputedStyle(document.documentElement).getPropertyValue('--t-espresso').trim() };
      });
      expect(r.token, 'dark tone token').toBe('#3d2719');
      expect(r.bg).toBe(r.want);
    } },
  { name: 'recaps-see-more', viewports: 'two', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      const hrefs = await page.locator('a.more').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
      expect(hrefs.length).toBeGreaterThan(2);
      for (const h of hrefs) {
        const q = new URL(h).searchParams;
        expect([q.get('range'), q.get('caffeine')], h).toEqual([String(recapYear()), 'all']);
      }
    } },
  { name: 'recaps-share-path', viewports: 'two', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: { url: string }) => { ((window as unknown as { shared: string[] }).shared ??= []).push(d.url); } });
      });
      await reloadReady(page);
      const second = page.locator('.recap-reel > section.slide').nth(1);
      const id = await second.getAttribute('id');
      await second.getByRole('button', { name: 'Share' }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: string[] }).shared?.[0] ?? '')).toMatch(new RegExp(`/recaps/${recapYear()}\\?slide=${id}&preview=1$`));
    } },
  { name: 'recaps-poster', path: () => `/recaps/${recapYear()}?preview=1#poster`,
    act: async (page) => {
      await expect(page.locator('.recap-progress.solid')).toHaveCount(1);
      const facts = await page.locator('.recap-reel > section.slide:not(.cover)').count();
      await expect(page.locator('.recap-grid > article.tile')).toHaveCount(facts);
      await expectGridRowsFull(page, '.recap-grid', true); // a lone full-width tile is allowed; holes and ragged ends are not
      // The personality tile is the last tile and takes the grid's full width.
      const [youW, gridW] = await page.locator('.recap-grid').evaluate((g) => {
        const y = g.lastElementChild as HTMLElement, cs = getComputedStyle(g);
        return [y.getBoundingClientRect().width, g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)];
      });
      expect(await page.locator('.recap-grid > :last-child').getAttribute('data-id')).toBe('you');
      expect(Math.abs(youW - gridW), 'you tile spans the full grid width').toBeLessThanOrEqual(1);
    } },
  { name: 'recaps-best-bag-names', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      // Roaster over coffee: two lines, no wrapping, a long coffee name still fits its box (no ellipsis at 480+).
      const long = 'Finca El Paraíso Lychee Thermal Shock Natural';
      await expect(page.locator('.recap-reel > section.slide .names').first()).toBeAttached();
      const w = page.viewportSize()!.width;
      for (const sel of ['.recap-reel > section.slide .names', '.recap-grid .names']) {
        const r = await page.locator(sel).first().evaluate((box, long) => {
          const cn = box.querySelector('.cn') as HTMLElement;
          const rn = box.querySelector('.rn') as HTMLElement;
          const lines = (e: HTMLElement) => e.getClientRects().length;
          cn.textContent = long;
          box.style.setProperty('--cn', String(long.length));
          return { cnFits: cn.scrollWidth <= cn.clientWidth + 1, rnFits: rn.scrollWidth <= rn.clientWidth + 1,
            oneLine: cn.getBoundingClientRect().height < parseFloat(getComputedStyle(cn).fontSize) * 2, page: document.documentElement.scrollWidth <= innerWidth, lines: lines(cn) };
        }, long);
        expect(r.page, `${sel} page overflow`).toBe(true);
        expect(r.oneLine, `${sel} coffee name on one line`).toBe(true);
        expect(r.rnFits, `${sel} roaster fits`).toBe(true);
        if (w >= 480) expect(r.cnFits, `${sel} long name fits at ${w}`).toBe(true);
      }
    } },
  { name: 'recaps-turn-legend', path: () => `/recaps/${recapYear()}?preview=1`,
    act: async (page) => {
      // A legend swatch matches the segment it names (a.k.a. no white dot for a green bar).
      const bad = await page.locator('.recap-reel > section.slide .split').evaluateAll((splits) => splits.flatMap((sp) =>
        [...sp.querySelectorAll('.legend i.seg')].flatMap((i) => {
          const k = ['a', 'b', 'c'].find((c) => i.classList.contains(c));
          const seg = k && sp.querySelector(`.sbar .seg.${k}`);
          return seg && getComputedStyle(i).backgroundColor !== getComputedStyle(seg).backgroundColor ? [k] : [];
        })));
      expect(bad, 'legend swatches off their segment colour').toEqual([]);
    } },
  { name: 'recaps-poster-thin', path: () => `/recaps/${recapYear() - 1}#poster`,
    act: async (page) => {
      const facts = await page.locator('.recap-reel > section.slide:not(.cover)').count();
      await expect(page.locator('.recap-grid > article.tile')).toHaveCount(facts);
      await expectGridRowsFull(page, '.recap-grid', true); // a lone full-width tile is allowed; holes and ragged ends are not
      // The personality tile is the last tile and takes the grid's full width.
      const [youW, gridW] = await page.locator('.recap-grid').evaluate((g) => {
        const y = g.lastElementChild as HTMLElement, cs = getComputedStyle(g);
        return [y.getBoundingClientRect().width, g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)];
      });
      expect(await page.locator('.recap-grid > :last-child').getAttribute('data-id')).toBe('you');
      expect(Math.abs(youW - gridW), 'you tile spans the full grid width').toBeLessThanOrEqual(1);
    } },
  { name: 'recaps-poster-share', viewports: 'two', path: () => `/recaps/${recapYear() - 1}#poster`,
    act: async (page) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: { url: string }) => { ((window as unknown as { shared: string[] }).shared ??= []).push(d.url); } });
      });
      await reloadReady(page);
      await page.locator('#poster header').getByRole('button', { name: 'Share' }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { shared?: string[] }).shared?.[0] ?? '')).toMatch(new RegExp(`/recaps/${recapYear() - 1}\\?slide=poster$`));
    } },
  // Recaps tab and index: one tile per open year plus the admin's current-year preview (the thin seed has the prior year).
  { name: 'insights-recaps', path: () => '/stats?tab=recaps',
    act: async (page) => {
      await expectRecapTiles(page, [String(recapYear()), String(recapYear() - 1)]);
      await expect(page.locator('.recap-tile .badge')).toHaveText(['Preview']);
      await expectNoMidWord(page, '.recap-tile b', '.recap-tile b .fit', LONG_NAMES);
      const vp = page.viewportSize()!;
      const rail = page.locator('nav.insights-rail a');
      if (vp.width >= 1000 && vp.height >= 500) await expect(rail.last()).toHaveText('Recaps');
      else expect(await page.getByRole('combobox', { name: 'View' }).locator('option').allTextContents()).toContain('Recaps');
    } },
  // The Period picks the years: one year, and a range with none (an empty line naming it, not a blank panel).
  { name: 'insights-recaps-period', path: () => `/stats?tab=recaps&range=${recapYear() - 1}`,
    act: async (page) => {
      await expectRecapTiles(page, [String(recapYear() - 1)]);
      await expect(page.locator('.recap-tile .badge')).toHaveCount(0);
      await page.goto('/stats?tab=recaps&range=2015-01-01..2015-02-01');
      await expect(page.locator('.recap-tile')).toHaveCount(0);
      await expect(page.locator('.recaps-empty h2')).toContainText('No recaps in Jan 1, 2015');
      await expect(page.locator('.recaps-empty')).not.toContainText('sign in'); // signed in: no sign-in line
    } },
  { name: 'insights-recaps-tile-size', path: () => '/stats?tab=recaps',
    act: async (page) => {
      // Every tile is the same size whether the Period shows 1 or 2 of them, left-aligned, never stretched.
      const size = async () => (await page.locator('.recap-tile').evaluateAll((ts) => ts.map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.left)]; })));
      const two = await size();
      expect(new Set(two.map((t) => t[0])).size, 'equal widths').toBe(1);
      await page.goto(`/stats?tab=recaps&range=${recapYear() - 1}`);
      await expect(page.locator('.recap-tile')).toHaveCount(1);
      const one = await size();
      expect(one[0][0], '1 tile = the 2-tile width').toBe(two[0][0]);
      expect(one[0][1], 'left-aligned').toBe(two[0][1]);
    } },
  // /recaps is only a way to the Recaps tab: it redirects there and drops every other param.
  { name: 'recaps-index-redirect', path: () => '/recaps?range=2015&x=1',
    act: async (page) => {
      await expect(page).toHaveURL(/\/stats\?tab=recaps$/);
      await expectRecapTiles(page, [String(recapYear()), String(recapYear() - 1)]);
      await page.locator('.recap-tile').nth(1).click();
      await expect(page).toHaveURL(new RegExp(`/recaps/${recapYear() - 1}$`));
    } },
  { name: 'coffees-status-multi', viewports: 'two', path: () => '/coffees?status=backlog&status=open&view=cards',
    act: async (page) => {
      const pressed = async (n: string) => page.getByRole('button', { name: n }).first().getAttribute('aria-pressed');
      expect([await pressed('Backlog'), await pressed('Open'), await pressed('Archive'), await pressed('All')]).toEqual(['true', 'true', 'false', 'false']);
      await expect(page.locator('.badge', { hasText: /^Open$/ }).first()).toBeVisible();
      await expect(page.locator('.badge', { hasText: /^Archive$/ })).toHaveCount(0);
      // Backlog cards (no badge) sit beside the Open ones.
      expect(await page.locator('h2 a[href^="/coffees/"]').count()).toBeGreaterThan(await page.locator('.badge', { hasText: /^Open$/ }).count());
    } },
  { name: 'coffees-status-toggle', viewports: 'two', path: () => '/coffees?status=backlog&status=open&view=list',
    act: async (page) => {
      const tap = async (n: string) => {
        const btn = page.getByRole('button', { name: n }).first();
        await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const b = (await btn.boundingBox())!;
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      };
      const pressed = (n: string) => page.getByRole('button', { name: n }).first();
      await tap('All');
      await expect(page).toHaveURL(/status=all(&|$)/);
      await expect(pressed('All')).toHaveAttribute('aria-pressed', 'true');
      for (const n of ['Backlog', 'Open', 'Archive']) await expect(pressed(n)).toHaveAttribute('aria-pressed', 'false');
      await tap('All');
      await expect(page).toHaveURL(/status=backlog&status=open/);
      await tap('Open');
      await tap('Backlog'); // the last lit status stays on
      await expect(pressed('Backlog')).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/status=backlog(&|$)/);
      expect(page.url()).not.toContain('status=open');
    } },
  { name: 'coffees-status-remembered', viewports: 'two', path: () => '/coffees?status=backlog&status=open&view=list',
    act: async (page) => {
      await gotoReady(page, '/stats');
      await gotoReady(page, '/coffees');
      await expect(page).toHaveURL(/status=backlog&status=open/);
    } },
  // All-off restores the earlier selection even after leaving /coffees (kept in the remembered state, not the URL).
  { name: 'coffees-status-all-restore', viewports: 'two', path: () => '/coffees?status=archive&view=list',
    act: async (page) => {
      const tap = async (n: string) => {
        const btn = page.getByRole('button', { name: n }).first();
        await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const b = (await btn.boundingBox())!;
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      };
      await tap('All');
      await expect(page).toHaveURL(/status=all(&|$)/);
      await gotoReady(page, '/stats');
      await gotoReady(page, '/coffees');
      await expect(page).toHaveURL(/status=all(&|$)/);
      expect(page.url()).not.toContain('prev');
      await tap('All');
      await expect(page).toHaveURL(/status=archive(&|$)/);
      expect(page.url()).not.toContain('status=all');
    } },
  // /coffees Sort by: one state with the list headers; bare = Urgency, descending, nothing in the URL.
  { name: 'coffees-sort-by', viewports: 'two', path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const select = page.locator('select:visible', { has: page.locator('option[value=created_at]') });
      const titles = () => page.locator('h2 a[href^="/coffees/"]').allTextContents();
      await expect(select).toHaveValue('urgency');
      await expect(page.getByRole('button', { name: 'Sort descending' })).toBeVisible();
      expect(page.url()).not.toContain('sort=');
      await select.selectOption('created_at'); // keeps the current direction
      await expect(page).toHaveURL(/sort=created_at\.desc/);
      const newest = await titles();
      await page.getByRole('button', { name: 'Sort descending' }).click();
      await expect(page).toHaveURL(/sort=created_at\.asc/);
      await expect(page.getByRole('button', { name: 'Sort ascending' })).toBeVisible();
      expect(await titles()).not.toEqual(newest);
      await select.selectOption('updated_at');
      await expect(page).toHaveURL(/sort=updated_at\.asc/);
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(select).toHaveValue('urgency');
      await expect(page.getByRole('button', { name: 'Sort descending' })).toBeVisible();
      await expect.poll(() => page.url()).not.toContain('sort=');
    } },
  // The list headers and the dropdown are one state.
  { name: 'coffees-sort-by-list-header', viewports: 'two', path: () => '/coffees?status=all&view=list',
    act: async (page) => {
      await page.locator('.sort-button', { hasText: 'Roaster' }).click();
      await expect(page).toHaveURL(/sort=roaster\.asc/);
      await expect(page.locator('select:visible', { has: page.locator('option[value=created_at]') })).toHaveValue('roaster');
      await expect(page.getByRole('button', { name: 'Sort ascending' })).toBeVisible();
    } },
  { name: 'coffees-sort-by-url', viewports: 'two', path: () => '/coffees?status=all&view=compact&sort=Created_At.ASC',
    act: async (page) => {
      await expect(page.locator('select:visible', { has: page.locator('option[value=created_at]') })).toHaveValue('created_at');
      await expect(page.getByRole('button', { name: 'Sort ascending' })).toBeVisible();
    } },
  // Share last (rightmost) and the phone button row spanning the search box, viewing and editing (Save/Discard).
  { name: 'coffees-search-row-buttons', path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      await expectSearchRowButtons(page);
      await page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true }).click();
      // visible text: spaced words ("Save changes", never "Savechanges"), shortened on a phone portrait
      const short = page.viewportSize()!.width <= 640;
      await expect(page.getByRole('button', { name: 'Save changes' })).toHaveText(short ? 'Save' : 'Save changes', { useInnerText: true });
      await expect(page.getByRole('button', { name: 'Discard changes' })).toHaveText(short ? 'Discard' : 'Discard changes', { useInnerText: true });
      await expectSearchRowButtons(page, true);
    } },
  // The row under the search row: results far left, Add Coffee centered (signed in), Sort by far right (desktop);
  // phones: results left, Add right, Sort by beside View.
  { name: 'coffees-results-row', path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const row = page.locator('.add-sort-row');
      const [rb, res, add] = [(await row.boundingBox())!, (await row.locator('.results').boundingBox())!, (await row.locator('.add-coffee-button').boundingBox())!];
      expect(Math.abs(res.x - rb.x), 'results at the row start').toBeLessThanOrEqual(1);
      expect(res.y + res.height / 2, 'results and Add share a line').toBeGreaterThan(add.y - 1);
      expect(res.y + res.height / 2).toBeLessThan(add.y + add.height + 1);
      expect(res.x + res.width, 'results do not run into Add').toBeLessThanOrEqual(add.x);
      if (page.viewportSize()!.width <= 640) {
        if (page.viewportSize()!.width >= 480) expect(Math.abs(add.x + add.width / 2 - (rb.x + rb.width / 2)), 'Add centered').toBeLessThanOrEqual(1);
        expect(await row.locator('.sort-in-row').isVisible()).toBe(false);
      } else {
        const sort = (await row.locator('.sort-in-row').boundingBox())!;
        expect(Math.abs(sort.x + sort.width - (rb.x + rb.width)), 'Sort by at the row end').toBeLessThanOrEqual(1);
        expect(Math.abs(add.x + add.width / 2 - (rb.x + rb.width / 2)), 'Add centered').toBeLessThanOrEqual(1);
        expect(sort.x).toBeGreaterThanOrEqual(add.x + add.width);
      }
    } },
  // The control block under the h1 is pinned: desktop the full bar; phones (portrait and landscape) a short row with an
  // expand button, expanding pins the full bar over the page, and it folds back. Nothing here is in the URL.
  { name: 'coffees-bar-pinned', path: () => '/coffees?status=all&view=list',
    act: async (page) => {
      const [w, h] = [page.viewportSize()!.width, page.viewportSize()!.height];
      const phone = w <= 640 || h <= 450;
      const top = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      expect((await top('.cbar')).y, 'at the top the bar is in flow, below the h1').toBeGreaterThan(20);
      await expect(page.locator('.cbar-mini')).toHaveCount(0);
      if (w >= 480 && w <= 640) {
        // top of the page, portrait: no caret; Show runs edge to edge under the search box's edges; View grows next to Sort by
        await expect(page.locator('.cbar-toggle')).toHaveCount(0);
        const input = (await page.locator('.coffees-search-row .search-input').boundingBox())!;
        const shows = await Promise.all((await page.getByRole('group', { name: 'Show' }).getByRole('button').all()).map((x) => x.boundingBox()));
        expect(Math.abs(shows[0]!.x - input.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(shows[3]!.x + shows[3]!.width - (input.x + input.width)), 'Show right edge = search box right edge').toBeLessThanOrEqual(1);
        const view = (await page.locator('.view-field').boundingBox())!;
        const sort = (await page.locator('.sort-field:visible').boundingBox())!;
        expect(sort.x - (view.x + view.width), 'View grows to Sort by').toBeLessThanOrEqual(10);
      }
      // every control of the Show / View + Sort rows (the toolbar), as x, width, height
      // plus the results / Add / Sort by row: it looks the same expanded as in flow (the fold caret is a pull tab outside it)
      const rects = () => page.evaluate(() => [...document.querySelectorAll('.cbar .toolbar button, .cbar .toolbar select, .cbar .add-sort-row button, .cbar .add-sort-row select, .cbar .add-sort-row .results')]
        .filter((c) => (c as HTMLElement).offsetParent).map((c) => { const r = c.getBoundingClientRect(); return [r.x, r.width, r.height].map(Math.round); }));
      const inFlow = await rects();
      await page.evaluate(() => window.scrollTo(0, 1500));
      if (!phone) {
        await expect.poll(async () => Math.abs((await top('.cbar')).y)).toBeLessThanOrEqual(1);
        await expect(page.locator('.cbar-toggle')).toHaveCount(0);
        return;
      }
      const mini = page.locator('.cbar-mini');
      await expect(mini).toBeVisible();
      const m = (await mini.boundingBox())!;
      expect(Math.abs(m.y)).toBeLessThanOrEqual(1);
      expect(m.height, 'collapsed bar is one short row').toBeLessThanOrEqual(56);
      expect(m.x + m.width).toBeLessThanOrEqual(w + 1);
      const url = page.url();
      const rowY = () => page.locator('tbody tr').first().evaluate((el) => el.getBoundingClientRect().y);
      const rowBefore = await rowY();
      await mini.getByRole('button', { name: 'Show controls' }).click();
      await expect(mini).toHaveCount(0);
      const bar = page.locator('.cbar.overlay');
      await expect(bar).toBeVisible();
      const b = (await bar.boundingBox())!;
      expect(Math.abs(b.y)).toBeLessThanOrEqual(1);
      expect(b.y + b.height, 'expanded bar stays inside the viewport').toBeLessThanOrEqual(h + 1);
      expectRectsClose(await rects(), inFlow, 1);
      await expect(bar.locator('.add-sort-row .cbar-toggle')).toHaveCount(0);
      await expectPullTab(page);
      expect(Math.abs((await rowY()) - rowBefore), 'the page does not jump').toBeLessThanOrEqual(1);
      if (w >= 480 && w <= 640) {
        // portrait: Show's four buttons share one line and fill it; View and Sort by share one line
        const boxes = await Promise.all((await bar.getByRole('group', { name: 'Show' }).getByRole('button').all()).map((x) => x.boundingBox()));
        expect(boxes.length).toBe(4);
        for (const bx of boxes) {
          expect(Math.abs(bx!.y - boxes[0]!.y)).toBeLessThanOrEqual(1);
          expect(bx!.width).toBeGreaterThanOrEqual(44);
        }
        const view = (await bar.locator('.view-field').boundingBox())!;
        const sort = (await bar.locator('.sort-field:visible').boundingBox())!;
        expect(Math.abs(view.y - sort.y), 'View and Sort by on one line').toBeLessThanOrEqual(2);
      }
      await page.locator('.cbar-pull').click();
      await expect(page.locator('.cbar.overlay')).toHaveCount(0);
      await expect(mini).toBeVisible();
      await expect(page.getByRole('button', { name: 'Show controls' })).toBeFocused();
      expect(page.url().replace(/[?&]sort=[^&]*/, '')).toBe(url.replace(/[?&]sort=[^&]*/, ''));
      expect(page.url()).not.toMatch(/expand|collapse|bar/);
    } },
  // A scrolled-to inline-edit action row lands below the pinned bar (ui-rules 19, 21).
  ...(['cards', 'list', 'compact'] as const).map((view) => ({
    name: `coffees-bar-inline-edit-${view}`, viewports: 'two' as const,
    path: () => `/coffees?status=all&view=${view}`,
    act: async (page: Page) => {
      await openSoloEdit(page, view, 'Colombia Pink Bourbon');
      const save = page.getByRole('button', { name: 'Save', exact: true });
      await save.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await frames(page);
      const covered = await save.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !hit || !el.contains(hit);
      });
      expect(covered, 'Save is not under the pinned bar').toBe(false);
    } })),
  // Turning the phone while the bar is expanded: the pull tab stays hanging off the bar's bottom-right edge, clear of
  // everything (it is placed by CSS, nothing is measured).
  { name: 'coffees-bar-rotate', viewports: 'two', path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const [w, h] = [page.viewportSize()!.width, page.viewportSize()!.height];
      test.skip(!(w <= 640 || h <= 450), 'the collapse is a phone feature');
      const check = () => expectPullTab(page);
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.getByRole('button', { name: 'Show controls' }).click();
      await check();
      const turned = w <= 640 ? { width: 1003, height: 333 } : { width: 480, height: 909 }; // the test phone, both ways
      await page.setViewportSize(turned);
      await frames(page);
      await check();
      await page.setViewportSize({ width: w, height: h }); // and back
      await frames(page);
      await check();
    } },
  // Signed out portrait: the last row is as tall as with Add Coffee, so the caret has the same size and place.
  { name: 'coffees-bar-row-height', viewports: 'two', path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      test.skip(page.viewportSize()!.width > 640, 'portrait');
      const h = async () => (await page.locator('.add-sort-row').boundingBox())!.height;
      const withAdd = await h();
      await page.locator('.add-coffee-button').evaluate((e) => e.remove());
      expect(Math.abs((await h()) - withAdd), 'row height without the Add button').toBeLessThanOrEqual(1);
    } },
  { name: 'coffees-compact', path: () => '/coffees?status=all&view=compact' },
  { name: 'coffees-list', path: () => '/coffees?status=all&view=list' },
  {
    // Icon-only buttons name themselves in the site's label tip (ui-rules 36, 39): on mouse hover and keyboard focus,
    // never on a tap or click (which just acts).
    name: 'coffees-icon-label-tip',
    path: () => '/coffees?status=all&view=list',
    act: async (page: Page) => {
      const row = page.locator('tbody tr').first();
      const [edit, clone] = [row.getByRole('button', { name: 'Edit', exact: true }), row.getByRole('button', { name: 'Clone', exact: true })];
      const tip = page.locator('.cell-tip:popover-open');
      await edit.hover();
      await expectTipInView(page, tip);
      await expect(tip).toHaveText('Edit');
      await page.mouse.move(0, 0);
      await expect(tip).toHaveCount(0);
      // A touch pointer opens none; keyboard focus does (Shift+Tab from Clone lands on Edit, focus-visible).
      await clone.dispatchEvent('pointerenter', { pointerType: 'touch' });
      await expect(tip).toHaveCount(0);
      await clone.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(edit).toBeFocused();
      await expectTipInView(page, tip);
      await expect(tip).toHaveText('Edit');
      await page.keyboard.press('Escape');
      await expect(tip).toHaveCount(0);
      // A click acts (Clone opens the add form) and leaves no tip.
      await clone.click();
      await page.waitForTimeout(200);
      await expect(tip).toHaveCount(0);
    }
  },
  {
    // The list table's roast icons carry the level only as their tip (hover, tap, focus).
    name: 'coffees-list-roast-tip',
    path: () => '/coffees?status=all&view=list',
    act: async (page: Page) => {
      const beans = page.getByRole('button', { name: /^Roast level: / }).first();
      await beans.click();
      const tip = page.locator('.cell-tip:popover-open');
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).not.toBeEmpty();
    }
  },
  {
    name: 'coffees-refreshed', viewports: 'two',
    path: () => '/coffees?status=all&view=compact',
    act: async (page) => {
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Updated');
    }
  },
  {
    name: 'coffees-cards',
    path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const wide = page.locator('.card').filter({ hasText: 'Rwanda Gitega Natural' }).locator('img.card-thumb');
      expect(await wide.evaluate((el) => (el as HTMLImageElement).naturalWidth / (el as HTMLImageElement).naturalHeight)).toBe(4);
      await expectContained(wide, WIDE_FILL);
      await expectContained(page.getByRole('img', { name: 'Moonwake logo', exact: true }), NEUTRAL);
    }
  },
  {
    name: 'coffees-inline-edit-pending',
    path: () => '/coffees?status=backlog&view=list',
    act: async (page, s) => {
      const row = page.getByRole('row', { name: new RegExp(s.names.everyAction) });
      await row.getByRole('button', { name: 'Edit', exact: true }).click();
      // The open row's actions sit under its form (one Archive on the page).
      await page.getByRole('button', { name: 'Archive', exact: true }).click();
      await expect(page.getByText(/^Pending: /).first()).toBeVisible();
    }
  },
  {
    name: 'coffees-added-toast',
    path: () => '/coffees?status=all&view=compact',
    act: async (page, s) => {
      await page.getByRole('button', { name: '+ Add Coffee' }).click();
      await fakeAdd(page, s.slugs.long);
      await expect(page.locator('#add-coffee')).toHaveCount(0);
    }
  },
  {
    // Clone on the detail page stays put and shows the same popup as Add.
    name: 'coffee-clone-added-toast',
    path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page, s) => {
      await page.locator('.detail-clone').click();
      await fakeAdd(page, s.slugs.frozen);
      await expect(page.locator('.modal')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/coffees/${s.slugs.long}$`));
    }
  },
  {
    name: 'coffee-add-modal',
    path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page) => {
      await page.getByRole('button', { name: '+ Add Coffee' }).click();
      await expect(page.getByRole('heading', { name: 'Add Coffee' })).toBeVisible();
      await expect(page.locator('.modal #coffee_name')).toHaveValue('');
    }
  },
  {
    name: 'coffee-added-toast',
    path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page, s) => {
      await page.getByRole('button', { name: '+ Add Coffee' }).click();
      await fakeAdd(page, s.slugs.frozen);
      await expect(page.locator('.modal')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/coffees/${s.slugs.long}$`));
    }
  },
  // Admin edit mode: the bag's subscription plan; saved through the staged batch; the list's inline edit has none.
  { name: 'coffees-detail-subscription-select', viewports: 'two', path: (s) => `/coffees/${s.slugs.sey}`,
    act: async (page, s) => {
      await expect(page.locator('.stat', { hasText: 'Subscription' }).getByRole('link')).toHaveText('Sey · 1x250g');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const sel = page.getByLabel('Subscription', { exact: true });
      await expect(sel).toBeVisible();
      // Right under Cost, as a full-width row.
      const [c, f] = await Promise.all([page.locator('.field-cost').boundingBox(), page.locator('.field-subscription').boundingBox()]);
      expect(f!.y).toBeGreaterThan(c!.y);
      expect(f!.y - (c!.y + c!.height)).toBeLessThan(40);
      const g = await page.locator('.form-grid').boundingBox();
      expect(Math.abs(f!.width - g!.width)).toBeLessThan(2); // a full-width row: nothing beside it to leave empty
      await checkLayout(page);
      await expect(sel.locator('option')).toHaveText([
        'None', 'A Very Long Subscription Service Name That Keeps Going · Explorer Series: Two Rotating Single Origins Every Other Week · 2x250g', 'Ceto · Paused Monthly · 1x250g (paused)', 'Sey · 1x250g']);
      await expect(sel.locator('option:checked')).toHaveText('Sey · 1x250g');
      await expect(page.locator('#cost')).toHaveValue('22'); // opening edit on a linked bag leaves its cost alone
      await sel.selectOption({ label: 'Ceto · Paused Monthly · 1x250g (paused)' });
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByLabel('Subscription', { exact: true }).locator('option:checked')).toHaveText('Ceto · Paused Monthly · 1x250g (paused)');
      await page.getByLabel('Subscription', { exact: true }).selectOption({ label: 'None' });
      await expect(page.locator('#cost')).toHaveValue('22'); // no fill since this mount: None changes nothing
      await page.getByLabel('Subscription', { exact: true }).selectOption({ label: 'Sey · 1x250g' }); // restore for other states
      await page.locator('#cost').fill('22');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.goto('/coffees?view=list&status=all');
      await page.getByRole('row', { name: /Kenya Kiambu/ }).first().getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.locator('#coffee_name')).toBeVisible();
      await expect(page.getByLabel('Subscription', { exact: true })).toHaveCount(0);
    } },
  // Add and Clone: the select starts on None; picking a plan fills Cost with price / bags, still editable.
  { name: 'coffees-add-subscription', viewports: 'two', path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page) => {
      for (const open of [() => page.getByRole('button', { name: '+ Add Coffee' }).click(), () => page.locator('.detail-clone').click()]) {
        await open();
        const modal = page.locator('.modal');
        const sel = modal.getByLabel('Subscription', { exact: true });
        await expect(sel.locator('option:checked')).toHaveText('None');
        const [c, f, g] = await Promise.all([modal.locator('.field-cost').boundingBox(), modal.locator('.field-subscription').boundingBox(),
          modal.locator('.form-grid').boundingBox()]);
        expect(f!.y).toBeGreaterThan(c!.y);
        expect(f!.y - (c!.y + c!.height)).toBeLessThan(40);
        expect(Math.abs(f!.width - g!.width)).toBeLessThan(2);
        await checkLayout(page);
        const cost = modal.locator('#cost');
        const before = await cost.inputValue();
        await sel.selectOption({ label: 'A Very Long Subscription Service Name That Keeps Going · Explorer Series: Two Rotating Single Origins Every Other Week · 2x250g' });
        await expect(cost).toHaveValue('22.25');
        await cost.fill('23');
        await sel.selectOption({ label: 'None' });
        await expect(cost).toHaveValue('23'); // edited after the fill: left alone
        await sel.selectOption({ label: 'Sey · 1x250g' });
        await expect(cost).toHaveValue('30');
        expect(before).not.toBe('30');
        await sel.selectOption({ label: 'A Very Long Subscription Service Name That Keeps Going · Explorer Series: Two Rotating Single Origins Every Other Week · 2x250g' });
        await expect(cost).toHaveValue('22.25');
        await sel.selectOption({ label: 'None' });
        await expect(cost).toHaveValue('23'); // Sey -> Explorer -> None: back to the cost from before the first fill (23)
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).toHaveCount(0);
      }
    } },
  { name: 'coffee-detail-like', path: (s) => `/coffees/${s.slugs.lab}`,
    act: async (page) => {
      const panel = page.locator('[data-section="like"]');
      await expect(panel.getByRole('heading', { name: 'Vs like coffees' })).toBeVisible();
      await expect(panel).toContainText(/\d+(st|nd|rd|th) of \d+/);
      await expectGridRowsFull(page, '[data-section="like"] .stat-grid');
    } },
  // The coffee page's Origin and Bag sections and the edit form's groups share one order, so a field spotted on the
  // page sits at about the same place in the form. The seed fills the origin details on brewNew only (Brew Seed Fresh Lot).
  { name: 'form groups follow the page', path: (s) => `/coffees/${s.slugs.brewNew}`,
    act: async (page) => {
      const texts = (l: Locator) => l.evaluateAll((els) => els.map((e) => e.textContent!.trim()));
      const sections = await texts(page.locator('.detail-section[data-section] > h2'));
      const pageLabels = (id: string) => texts(page.locator(`[data-section="${id}"] .stat-label`));
      expect(sections.slice(0, 3)).toEqual(['Origin', 'Bag', 'Timing']);
      expect(await pageLabels('origin')).toEqual(['Type', 'Origin', 'Region', 'Producer', 'Farm', 'Variety', 'Processing', 'Elevation', 'Harvest', 'Certification']);
      expect(await pageLabels('bag')).toEqual(['Roast level', 'Amount', 'Cost', 'Cost/gram', 'Subscription', 'Urgency']);
      await expect(page.locator('[data-section="origin"] .stat', { hasText: 'Elevation' }).locator('.stat-value')).toHaveText('1900-2100m');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const box = (sel: string) => page.locator(sel).first().boundingBox().then((b) => b!);
      const groups = page.locator('.form-grid > .form-group');
      await expect(groups.locator('> legend')).toHaveText(['Origin', 'Bag', 'Timing']);
      // Origin: the page's ten, in its order (Amount (g) is the form's own label for the Bag's Amount).
      await expect(groups.nth(1).locator('label')).toHaveText(['Type', 'Origin', 'Region', 'Producer', 'Farm', 'Variety', 'Processing', 'Elevation', 'Harvest', 'Certification']);
      await expect(groups.nth(2).locator('label')).toHaveText(['Roast level', 'Amount (g)', 'Cost', 'Subscription']);
      await expect(groups.nth(3).locator('label')).toHaveText(['Roast date', 'Min rest', 'Max rest', 'Frozen start date', 'Frozen end date']);
      await expect(groups.nth(0).locator('label')).toHaveText(['Product page URL', 'Roaster', 'Coffee', 'Decaf', 'Image URL']);
      // Type: first in Origin, same box as the Origin input beneath it, Blend fills only a blank Origin.
      const [t, o] = await Promise.all([box('#blend'), box('#origin')]);
      expect(Math.abs(t.height - o.height), 'Type select as tall as Origin (phones: its 44px tap target)').toBeLessThanOrEqual(t.height >= 44 ? 3 : 1);
      expect(Math.abs(t.width - o.width), 'Type select as wide as Origin').toBeLessThanOrEqual(1);
      expect(t.y < o.y - 1 || (Math.abs(t.y - o.y) <= 1 && t.x < o.x), 'Type comes first').toBe(true);
      await page.locator('#blend').selectOption('1');
      await expect(page.locator('#origin'), 'a typed Origin stays').not.toHaveValue('Blend');
      await page.locator('#origin').fill('');
      await page.locator('#blend').selectOption('0');
      await page.locator('#blend').selectOption('1');
      await expect(page.locator('#origin')).toHaveValue('Blend');
      await page.locator('#blend').selectOption('0');
      await expect(page.locator('#origin'), 'switching back removes the fill').toHaveValue('');
      await page.locator('#blend').selectOption('1');
      await page.locator('#origin').fill('Blend of Kenya');
      await page.locator('#blend').selectOption('0');
      await expect(page.locator('#origin'), 'an edited fill stays').toHaveValue('Blend of Kenya');
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
      await expect(page.locator('#producer')).toHaveValue('Ana Maria Gutierrez');
      await expect(page.locator('#certification')).toHaveValue('Organic');
      // Top to bottom: top group, Origin, Bag, Timing, then the slug.
      const ys = await Promise.all(['#product_url', '#origin', '#roast_level', '#roast_date', '#slug'].map((q) => box(q).then((b) => b.y)));
      expect(ys, 'groups run top to bottom').toEqual([...ys].sort((x, y) => x - y));
      expect(await page.evaluate(() => !!document.activeElement?.closest('.form-group')), 'no autofocus').toBe(false);
    } },
  { name: 'coffee page with origin details', path: (s) => `/coffees/${s.slugs.brewNew}`,
    act: async (page) => {
      const origin = page.locator('[data-section="origin"] .stat');
      await expect(origin.locator('.stat-label')).toHaveText(['Type', 'Origin', 'Region', 'Producer', 'Farm', 'Variety', 'Processing', 'Elevation', 'Harvest', 'Certification']);
      await expect(origin.filter({ hasText: 'Elevation' }).locator('.stat-value')).toHaveText('1900-2100m');
      // Directly under the header: no larger gap than between the later sections.
      const h = await page.locator('.detail-header').boundingBox();
      const sec = await page.locator('[data-section="origin"]').boundingBox();
      expect(sec!.y - (h!.y + h!.height), 'gap under the header').toBeLessThan(40);
    } },
  { name: 'stats stay put with no details', path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page, s) => {
      const cols = (id: string) => page.locator(`[data-section="${id}"] .stat`).evaluateAll((els) =>
        els.map((e) => { const r = e.getBoundingClientRect(); return [e.querySelector('.stat-label')!.textContent, Math.round(r.x), Math.round(r.width)]; }));
      const none = await cols('bag');
      expect(none.length).toBe(6);
      expect((await cols('origin')).length, 'no extra stats on a coffee without details (Type, Origin, Processing)').toBe(3);
      await page.goto(`/coffees/${s.slugs.brewNew}`);
      expect(await cols('bag'), 'the same Bag stats, same columns').toEqual(none);
    } },
  // Favorite grind (Timing): one line per grinder, A to Z; wide it fills the last column over both stat rows, narrow it
  // sits below the grid at full width. Lab Bag 8 has two grinders, El Dorado one, the long-named Lab Bag none rated.
  { name: 'coffee-favorite-grind', path: (s) => `/coffees/${s.slugs.labTwo}`,
    act: async (page, s) => {
      const block = page.locator('[data-testid="favorite-grind"]');
      await expect(block.locator('li')).toHaveText([/^A4Z \(Femobook\)\s*.+\s·\s\d+(\.\d)?(\s·|$)/, /^ZP6 Special\s*.+\s·\s\d+(\.\d)?(\s·|$)/]);
      const grid = page.locator('.timing-grid');
      const box = async (t: string) => (await grid.locator('.stat', { hasText: t }).first().boundingBox())!;
      const [g, b, roast, days, rest, after, before] = [(await grid.boundingBox())!, (await block.boundingBox())!, await box('Roast date'), await box('Days since roast'), await box('Recommended rest'), await box('Drink after'), await box('Drink before')];
      expect(Math.abs(rest.x - days.x) < 2 && rest.y > days.y, 'Recommended rest under Days since roast').toBe(true);
      // A row breaks only between its segments, never inside one (at w1280 the seed's names).
      const broken = await block.locator('.seg').evaluateAll((segs) => segs.filter((e) => e.getBoundingClientRect().height > 1.5 * parseFloat(getComputedStyle(e).lineHeight === 'normal' ? getComputedStyle(e).fontSize : getComputedStyle(e).lineHeight) + 1).map((e) => e.textContent));
      if (page.viewportSize()!.width >= 1280) expect(broken, 'no segment is broken').toEqual([]);
      if (b.x > roast.x + 20) {
        expect(Math.abs(b.y - roast.y), 'block top = first row top').toBeLessThan(2);
        expect(b.y + b.height, 'block spans both rows').toBeGreaterThanOrEqual(Math.max(rest.y + rest.height, before.y + before.height) - 2);
        expect(b.x + b.width, 'block reaches the grid right').toBeGreaterThan(g.x + g.width - 2);
        expect(Math.abs(rest.x - days.x) < 2 && rest.y > days.y, 'Recommended rest under Days since roast').toBe(true);
        expect(Math.abs(before.x - after.x) < 2 && before.y > after.y, 'Drink before under Drink after').toBe(true);
        // The columns line up with the Bag grid above (Roast level, Amount, Cost, Cost/gram), the block starting at the 4th.
        const fx = async (t: string) => (await page.locator('[data-section="bag"] .stat', { hasText: t }).first().boundingBox())!.x;
        for (const [x, t] of [[roast.x, 'Roast level'], [days.x, 'Amount'], [after.x, 'Cost'], [b.x, 'Cost/gram']] as const)
          expect(Math.abs(x - (await fx(t))), `Timing column of ${t} lines up with the facts grid`).toBeLessThan(1.5);
      } else {
        expect(b.y, 'block below the stats').toBeGreaterThanOrEqual(Math.max(before.y + before.height, rest.y + rest.height) - 1);
        expect(Math.abs(b.x - g.x) < 2 && Math.abs(b.width - g.width) < 2, 'full width').toBe(true);
      }
      // The tip anchors have zero layout effect: the gap from the text to its trailing "·" is the same beside a tip as beside plain text.
      const gaps = await block.locator('li').first().evaluate((li) => {
        const rect = (n: Node, i: number, j: number) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, j); return r.getBoundingClientRect(); };
        const segs = [...li.querySelectorAll('.seg')];
        const texts = (e: Element) => { const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), ns: Node[] = []; for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent) ns.push(n); return ns; };
        const viaTip = (seg: Element) => { const t = seg.querySelector('.text-tip')!, d = [...texts(seg)].pop()!; const r = document.createRange(); r.selectNodeContents(t); return rect(d, d.textContent!.length - 1, d.textContent!.length).left - r.getBoundingClientRect().right; };
        // A plain segment: the dot is the last glyph, the nbsp before it, the text glyph before that.
        const plain = () => { const ns = texts(segs[2]);
          const dot = ns[ns.length - 1], len = dot.textContent!.length, before = len >= 3 ? dot : ns[ns.length - 2];
          const bl = before.textContent!.length, g = len >= 3 ? bl - 3 : bl - 1;
          return rect(dot, len - 1, len).left - rect(before, g, g + 1).right; };
        return [viaTip(segs[0]), viaTip(segs[1]), plain()];
      });
      expect(Math.abs(gaps[0] - gaps[2]), `setting gap ${gaps}`).toBeLessThanOrEqual(1);
      expect(Math.abs(gaps[1] - gaps[2]), `rating gap ${gaps}`).toBeLessThanOrEqual(1);
      // The dates size to their content: no label or value wraps (a stat is one label line over one value line).
      const wrapped = await grid.locator('.stat:not(.fave)').evaluateAll((ss) => ss.filter((e) => e.getBoundingClientRect().height > 70).map((e) => e.textContent));
      expect(wrapped, 'no date wraps').toEqual([]);
      // The setting and the rating each explain themselves in a help tip (the help cursor); one tip open at a time.
      const tips = block.locator('li').first().locator('.text-tip'), open = page.locator('.cell-tip:popover-open');
      await expect(tips).toHaveCount(2);
      expect(await tips.first().evaluate((e) => getComputedStyle(e).cursor)).toBe('help');
      await tapOn(tips.first());
      await expect(open).toHaveCount(1);
      await expect(open).toContainText('Grind setting of the best-rated brew on this grinder');
      await expectTipInView(page, open);
      await tapOn(tips.nth(1));
      await expect(open).toHaveCount(1);
      await expect(open).toContainText("out of 10 (Bean Conqueror's scale)");
      await expectTipInView(page, open);
      await page.keyboard.press('Escape');
      await tapOn(page.locator('.timing h2'));
      await expect(open).toHaveCount(0);
      // The real prod row (A4Z, 1.4.2, 8.5, Alpha Switch · Cafec Abaca): its header and its data line are each one line at w1280.
      const oneLine = await block.locator('ul').evaluate((ul) => {
        const li = ul.querySelector('li')!.cloneNode(true) as HTMLElement, segs = li.querySelectorAll('.seg');
        segs[0].querySelector('.text-tip')!.textContent = '1.4.2';
        segs[1].querySelector('.text-tip')!.textContent = '8.5';
        segs[2].textContent = 'Alpha Switch\u00a0·';
        segs[3].textContent = 'Cafec Abaca';
        ul.append(li);
        const one = (e: Element) => { const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight === 'normal' ? cs.fontSize : cs.lineHeight); return e.getBoundingClientRect().height < 1.5 * lh; };
        const out = [one(li.querySelector('.g')!), one(li.querySelector('.data')!)];
        li.remove();
        return out;
      });
      if (page.viewportSize()!.width >= 1280) expect(oneLine, 'header and data line: one line each').toEqual([true, true]);
      // Any grinder count and name length: six grinders, one with a very long name and dripper, wrap without overflow.
      await block.locator('ul').evaluate((ul) => {
        const li = ul.querySelector('li')!;
        for (let i = 0; i < 4; i++) ul.append(li.cloneNode(true));
        ul.querySelector('li')!.querySelector('.g')!.textContent = 'The Extraordinarily Long-Named Hand Grinder Collective Edition';
        const segs = ul.querySelector('li')!.querySelectorAll('.seg');
        segs[2].textContent = 'An Extraordinarily Long Dripper\u00a0·';
        segs[3].textContent = 'Name Of Many Words';
      });
      // A wrapped data line never starts with "·", and its continuation lines hang in from the first.
      const lines = await block.locator('.data').evaluateAll((ds) => ds.flatMap((d) => {
        const out: string[] = [], w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT), left = d.getBoundingClientRect().left;
        let top = NaN;
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const t = n.textContent!;
          for (let i = 0; i < t.length; i++) {
            if (!t[i].trim()) continue;
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
            const b = r.getBoundingClientRect();
            if (Number.isNaN(top)) top = b.top;
            else if (b.top > top + 4) { top = b.top; if (t[i] === '·') out.push('starts with a dot'); if (b.left < left + 14) out.push(`not indented (${Math.round(b.left - left)}px)`); }
          }
        }
        return out;
      }));
      expect(lines, 'wrapped lines').toEqual([]);
      const bad = await block.evaluate((el) => [...el.querySelectorAll('li, .seg')].filter((n) => n.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map((n) => n.textContent));
      expect(bad, 'no overflow').toEqual([]);
      const gb = await grid.boundingBox();
      expect((await block.boundingBox())!.x + (await block.boundingBox())!.width).toBeLessThanOrEqual(gb!.x + gb!.width + 1);
    } },
  { name: 'coffee-favorite-grind-single', viewports: 'two', path: (s) => `/coffees/${s.slugs.linked}`,
    act: async (page) => {
      await expect(page.locator('[data-testid="favorite-grind"] li')).toHaveText([/^ZP6 Special\s*.+\s·\s\d+(\.\d)?(\s·|$)/]);
    } },
  { name: 'coffee-favorite-grind-none', viewports: 'two', path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await expect(page.locator('[data-testid="favorite-grind"]')).toHaveCount(0);
      await expect(page.getByText('Recommended rest')).toBeVisible();
    } },
  // Link previews: the coffee page's SSR tags (text from coffeePreview; data: images give no og:image).
  { name: 'link-preview-coffee', viewports: 'two', path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page, s) => {
      const origin = new URL(page.url()).origin;
      const t = await previewTags(page, `/coffees/${s.slugs.long}`);
      expect(t['og:title']).toBe(s.names.long);
      expect(t['og:description']).toMatch(/^The Extraordinarily Long-Named Specialty Roasting Collective of Portland\n🇨🇴 Colombia · Double Anaerobic Thermal Shock Natural · 250g · Roasted \d{4}-\d{2}-\d{2}$/);
      expect(t.description).toBe(t['og:description']);
      expect(t.description.length).toBeLessThanOrEqual(300);
      expect(t['og:url']).toBe(`${origin}/coffees/${s.slugs.long}`);
      expect(t['og:site_name']).toBe('Bean Tracker');
      expect(t['og:type']).toBe('website');
      expect(t['theme-color']).toBe('#8a5a3b');
      expect(t['twitter:card']).toBe('summary');
      expect(t['og:image']).toBeUndefined();
      for (const slug of [s.slugs.wide, s.slugs.frozen]) {
        const d = await previewTags(page, `/coffees/${slug}`);
        expect(d['og:image'], 'a data: image gives no og:image').toBeUndefined();
        expect(d['twitter:card']).toBe('summary');
      }
      expect(await page.title()).toBe(`Bean Tracker - ${s.names.long}`);
    } },
  // Link previews for the list pages: SSR tags built from the values each page renders.
  { name: 'link-preview-coffees', viewports: 'two', path: () => '/coffees',
    act: async (page) => {
      const origin = new URL(page.url()).origin;
      for (const [path, title, re] of [
        ['/coffees', 'Coffee Collection', /^Backlog\n\d+ coffees? · [\d.]+k?g$/],
        ['/coffees?status=all&origin=Colombia&decaf=false', 'Coffee Collection', /^All\nOrigin: Colombia · Caffeinated only\n\d+ coffees? · [\d.]+k?g$/]
      ] as const) {
        const t = await previewTags(page, path);
        expect(t['og:title']).toBe(title);
        expect(t['og:description']).toMatch(re);
        expect(t.description).toBe(t['og:description']);
        expect(t.description.length).toBeLessThanOrEqual(300);
        expect(t['og:url']).toBe(origin + path);
      }
    } },
  { name: 'link-preview-on-deck', viewports: 'two', path: () => '/on-deck',
    act: async (page) => {
      const origin = new URL(page.url()).origin;
      const t = await previewTags(page, '/on-deck');
      expect(t['og:title']).toBe('On Deck: Currently open');
      const lines = t['og:description'].split('\n');
      for (const [i, l] of lines.entries())
        expect(l).toMatch(i === lines.length - 1 && /^…and/.test(l) ? /^…and \d+ more$/ : /^\d+\. .+ · .+$/);
      expect(t.description).toBe(t['og:description']);
      expect(t.description.length).toBeLessThanOrEqual(300);
      expect(t['og:url']).toBe(`${origin}/on-deck`);
      const n = await previewTags(page, '/on-deck?view=next&show=decaf');
      expect(n['og:title']).toBe('On Deck: Next up · Decaf');
      expect(n.description.length).toBeLessThanOrEqual(300);
      expect(n['og:url']).toBe(`${origin}/on-deck?view=next&show=decaf`);
    } },
  { name: 'link-preview-subscriptions', viewports: 'two', path: () => '/subscriptions',
    act: async (page) => {
      const origin = new URL(page.url()).origin;
      const t = await previewTags(page, '/subscriptions');
      expect(t['og:title']).toBe('Subscriptions');
      const d = t['og:description'];
      expect(d.startsWith('3 subscriptions\n')).toBe(true);
      expect(d).toContain('\nCeto · Paused Monthly');
      expect(d).toMatch(/\nSey$/m);
      expect(d, 'no status, price or renewal').not.toMatch(/Paused$|\$|Renews| paused/m);
      expect(t.description).toBe(d);
      expect(d.length).toBeLessThanOrEqual(300);
      expect(t['og:url']).toBe(`${origin}/subscriptions`);
    } },
  // Share works on every click (user, 2026-10-25): a share sheet that never settled (the browser then refuses the
  // next share) falls back to copying, and a second copy restarts the "Link copied" label.
  { name: 'share-again', viewports: 'two', path: () => '/stats',
    act: async (page) => {
      await page.evaluate(() => {
        const w = window as unknown as { copies: string[]; pending: boolean };
        w.copies = []; w.pending = false;
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void w.copies.push(t) }, configurable: true });
        navigator.share = () => {
          if (w.pending) return Promise.reject(new DOMException('An earlier share has not yet completed.', 'InvalidStateError'));
          w.pending = true;
          return new Promise(() => {}); // the sheet closed without settling
        };
      });
      const share = page.locator('.share-button');
      await share.click();
      await share.click();
      await expect(share).toHaveText('Link copied');
      expect(await page.evaluate(() => (window as unknown as { copies: string[] }).copies)).toHaveLength(1);
      // No share sheet: each copy restarts the label's 2s.
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
      await page.waitForTimeout(1500);
      await share.click();
      await page.waitForTimeout(1000);
      await expect(share).toHaveText('Link copied', { timeout: 0 });
    } },
  { name: 'link-preview-water', viewports: 'two', path: () => '/water',
    act: async (page) => {
      const origin = new URL(page.url()).origin;
      const cases: [string, string, string | RegExp][] = [
        ['/water', 'Water: Bright and Juicy', 'Lotus drop calculator\nWater: 800mL (recipe 800mL)\nDropper: Round tip\nCa: 4 drops\nMg: 4 drops\nNa: 2 drops\nK: 2 drops\nGH: 80.4ppm (recipe 80ppm)\nKH: 20.1ppm (recipe 20ppm)'],
        ['/water?recipe=holy-water&ml=900', 'Water: Holy Water', 'Lotus drop calculator\nWater: 900mL (recipe 800mL)\nDropper: Round tip\nCa: 0 drops\nMg: 7 drops\nNa: 0 drops\nK: 4 drops\nGH: 62.5ppm (recipe 60ppm)\nKH: 17.9ppm (recipe 20ppm)'],
        ['/water?recipe=lume-ultra-soft&ml=880', 'Water: Lume Ultra Soft', /\nWater: 880mL \(recipe 800mL\)\nDropper: Round tip\n[\s\S]*\nGH: 18\.3ppm \(recipe 20ppm\)\nKH: 4\.6ppm \(recipe 5ppm\)$/],
        ['/water?kettle=fellow-stagg-ekg', 'Water: Bright and Juicy', /\nWater: 900mL \(recipe 800mL\)\n/],
        ['/water?tip=precision', 'Water: Bright and Juicy', /\nWater: 900mL \(recipe 900mL\)\nDropper: Precision\nCa: 8 drops\nMg: 8 drops\nNa: 4 drops\nK: 4 drops\n/],
        ['/water?mode=target&tip=precision&mg=40&ca=40&na=10&k=10', 'Water: Custom target', /\nDropper: Precision\nCa: 8 drops\nMg: 8 drops\nNa: 4 drops\nK: 4 drops\n/],
        ['/water?mode=drops&tip=precision&ca=3&mg=5', 'Water: Custom drops', /Water: 900mL\nDropper: Precision\nCa: 3 drops\nMg: 5 drops/],
        ['/water?mode=drops&ca=3&mg=5', 'Water: Custom drops', /Water: 800mL\nDropper: Round tip\nCa: 3 drops\nMg: 5 drops\nNa: 0 drops\nK: 0 drops\nGH: 80\.4ppm\nKH: 0ppm/]
      ];
      for (const [path, title, desc] of cases) {
        const t = await previewTags(page, path);
        expect(t['og:title']).toBe(title);
        if (typeof desc === 'string') expect(t['og:description']).toBe(desc);
        else expect(t['og:description']).toMatch(desc);
        expect(t.description).toBe(t['og:description']);
        expect(t.description.length).toBeLessThanOrEqual(300);
        expect(t['og:url']).toBe(origin + path);
      }
      // The rendered page shows the same drop counts as the preview for the same URL.
      await gotoReady(page, '/water?recipe=holy-water&ml=900');
      const shown = await page.locator('.wr-drops .wr-drop').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.querySelector('span')!.textContent, e.querySelector('b')!.textContent])));
      const m = (await previewTags(page, '/water?recipe=holy-water&ml=900'))['og:description'].match(/Ca: (\d+) drops?\nMg: (\d+) drops?\nNa: (\d+) drops?\nK: (\d+) drops?/)!;
      expect(m.slice(1)).toEqual([shown.Ca, shown.Mg, shown.Na, shown.K]);
      expect(m.slice(1).join(',')).toBe('0,7,0,4');
    } },
  { name: 'link-preview-insights', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const origin = new URL(page.url()).origin;
      const cases: [string, string, RegExp | null][] = [
        ['/stats?tab=leaderboards&range=all&chart=leaderboard-origins', 'Stats: Origins', /^Avg rating · All time\n🥇 \d\.\d · .+\n🥈 /],
        ['/stats?tab=records&range=all&chart=records-taste', 'Stats: Taste', /^All time\n.+ · .+/],
        ['/stats?tab=records&range=all&chart=records-top-coffees', 'Stats: Top coffees', /^Avg rating · All time\n🥇 \d+\.\d · .+\n🥈 /],
        ['/stats?tab=records&range=all&chart=records-top-brews', 'Stats: Top brews', /^Rating · All time\n🥇 \d+\.\d · .+\n🥈 /],
        ['/stats?tab=records&range=all&chart=record-nightOwl', 'Stats: Night owl', /^All time\n.+\n/],
        ['/stats?tab=habits&range=all&chart=habits-hour', 'Stats: Habits', /^When and how fuhnoo brews\nAll time\n[\d,]+ brews/],
        ['/stats?chart=leaderboard-origins', 'Stats: Overview', /^fuhnoo's brewing at a glance\n/],
        ['/stats?tab=leaderboards&range=all&rank=like&chart=leaderboard-origins', 'Stats: Leaderboards', /^fuhnoo's top roasters, coffees, origins and gear\nAll time\n[\d,]+ brews/]
      ];
      for (const [path, title, desc] of cases) {
        const t = await previewTags(page, path);
        expect(t['og:title']).toBe(title);
        if (desc) expect(t['og:description']).toMatch(desc);
        expect(t.description).toBe(t['og:description']);
        expect(t.description.length).toBeLessThanOrEqual(300);
        expect(t['og:url']).toBe(origin + path);
      }
    } },
  { name: 'coffee-detail-no-like', viewports: 'two', path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => expect(page.locator('[data-section="like"]')).toHaveCount(0) },
  // Gate P4: a coffee with rated brews but no panel says why in one line; the tip has the counts; the link opens
  // the nearest view with a comparison (URL state), which offers Back to defaults.
  { name: 'coffee-detail-like-why', path: (s) => `/coffees/${s.slugs.decaf}`,
    act: async (page) => {
      const line = page.locator('[data-section="like"] .like-none');
      await expect(line).toContainText('No comparison yet: too few similar decaf coffees to compare with.');
      const tt = line.locator('.text-tip'), tip = page.locator('.float-tip');
      if (page.viewportSize()!.width >= 1280) { // desktop: hover opens, leaving closes
        await tt.hover();
        await expect(tip).toContainText('Why no comparison');
        await page.mouse.move(0, 0);
        await expect(tip).toHaveCount(0);
      }
      // The tip opens from the text only (ui-rules 41): the label is inline, so a wrapped sentence's lines are its
      // boxes (left-aligned with the paragraph), and the empty end of its last line opens nothing.
      const boxes = await tt.evaluate((e) => [...e.getClientRects()].map((r) => ({ l: r.left, r: r.right, b: r.bottom })));
      const p = (await line.boundingBox())!;
      expect(Math.abs(boxes[0].l - p.x), 'label starts at the paragraph edge').toBeLessThanOrEqual(1);
      // At 360 the sentence wraps (I2), and line 2 starts where line 1 does: left-aligned, not centered.
      if (page.viewportSize()!.width <= 360) expect(boxes.length, 'the sentence wraps at 360').toBeGreaterThanOrEqual(2);
      for (const r of boxes) expect(Math.abs(r.l - boxes[0].l)).toBeLessThanOrEqual(1);
      const last = boxes.at(-1)!;
      if (last.r < p.x + p.width - 40) {
        await page.mouse.click(p.x + p.width - 10, last.b - 8);
        await expect(tip).toHaveCount(0);
      }
      await tt.click();
      await expect(tip).toContainText('Why no comparison');
      await expect(tip).toContainText('Rated brews');
      await expectTipInView(page, tip);
      await page.keyboard.press('Escape');
      await tt.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab'); // keyboard focus (focus-visible) opens it
      await expect(tip).toBeVisible();
    } },
  { name: 'coffee-detail-like-all', viewports: 'two', path: (s) => `/coffees/${s.slugs.lab}?ratings=all&dial=all`,
    act: async (page) => {
      const panel = page.locator('[data-section="like"]');
      await expect(panel).toContainText('all brews, all ratings.');
      await panel.getByRole('link', { name: 'Back to defaults' }).click();
      await expect(page).toHaveURL(/\/coffees\/[^?]+$/);
      await expect(panel).toContainText('once dialed, calibrated ratings.');
    } },
  { name: 'coffee-long', path: (s) => `/coffees/${s.slugs.long}` },
  { name: 'coffee-frozen', path: (s) => `/coffees/${s.slugs.frozen}` },
  { name: 'coffee-decaf', path: (s) => `/coffees/${s.slugs.decaf}` },
  {
    name: 'coffee-image-fill',
    path: (s) => `/coffees/${s.slugs.wide}`,
    act: (page) => expectContained(page.locator('.detail-media img'), WIDE_FILL)
  },
  {
    // Credit under the image: host (no www) linking through the go route in a new tab, left edge on the image's.
    name: 'coffee-image-credit',
    viewports: 'two',
    path: (s) => `/coffees/${s.slugs.wide}`,
    act: async (page, s) => {
      const link = page.locator('.image-credit a');
      await expect(page.locator('.image-credit')).toHaveText('Image: shop.flowerchildcoffee.com');
      await expect(link).toHaveAttribute('href', `/coffees/${s.slugs.wide}/go?to=credit`);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      const img = (await page.locator('.detail-media img').boundingBox())!;
      const cap = (await page.locator('.image-credit').boundingBox())!;
      expect(Math.abs(cap.x - img.x)).toBeLessThan(1);
      expect(cap.y).toBeGreaterThanOrEqual(img.y + img.height);
      expect(cap.width).toBeLessThanOrEqual(img.width + 1);
      expect(cap.height).toBeLessThan(60);
    }
  },
  { name: 'coffee-image-credit-none', viewports: 'two', path: (s) => `/coffees/${s.slugs.long}`,
    act: async (page) => expect(page.locator('.image-credit')).toHaveCount(0) },
  {
    // Defaults on a bare URL; the picker and mL input write explicit params; a bad ml shows the hint, no results.
    name: 'water',
    path: () => '/water',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('bright-and-juicy');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('800');
      await expect(page.getByLabel('Kettle')).toHaveValue('');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 800mL' })).toBeVisible();
      await page.getByLabel('Recipe').selectOption('mg-k-60-10');
      await page.getByLabel('Water (mL)').fill('800');
      await expect(page.getByRole('listitem', { name: '0 Calcium' })).toBeVisible();
      await expect(page.getByRole('listitem', { name: '6 Magnesium' })).toBeVisible();
      await expect(page.locator('.wr-gauge', { hasText: 'GH' })).toContainText('60.3ppm, target 60');
      await expectGroupsLabelled(page);
      await page.getByLabel('Recipe').selectOption('substance');
      await expect(page).toHaveURL(/recipe=substance/);
      await page.getByLabel('Water (mL)').fill('900');
      await expect(page).toHaveURL(/ml=900/);
      await expect(page.getByRole('listitem', { name: '9 Potassium' })).toBeVisible();
      await page.getByLabel('Water (mL)').fill('5');
      await expect(page.getByText('Enter 100-2000mL.')).toBeVisible();
    }
  },
  {
    // Best volume above 1000mL: also offers the equally accurate one a 1000mL kettle holds, each with its own button.
    name: 'water-ideal-two', viewports: 'two',
    path: () => '/water?recipe=lume-high-clarity&tip=precision',
    act: async (page) => {
      await expect(page.locator('.water-ideal')).toContainText('best used with 550mL or 1100mL of distilled water');
      const width = async (name: string) => (await page.getByRole('button', { name }).boundingBox())!.width;
      const w550 = await width('Switch to 550mL');
      expect(await width('Switch to 1100mL'), 'same button size').toBeCloseTo(w550, 1);
      await page.getByRole('button', { name: 'Round tip', exact: true }).click();
      expect(await width('Switch to 1000mL'), 'same button size across tips').toBeCloseTo(w550, 1);
      await page.getByRole('button', { name: 'Precision', exact: true }).click();
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /Water: 900mL \(recipe 550mL or 1100mL\)/);
      await page.getByRole('button', { name: 'Switch to 550mL' }).click();
      await expect(page.getByRole('heading', { name: 'Lotus drops for 550mL' })).toBeVisible();
      await expect(page.locator('.water-ideal')).toHaveCount(0);
      await page.getByRole('spinbutton', { name: 'Water (mL)' }).fill('900');
      await page.getByRole('button', { name: 'Switch to 1100mL' }).click();
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1100mL' })).toBeVisible();
      await expect(page.locator('.water-ideal')).toHaveCount(0);
    }
  },
  {
    name: 'water-ideal-hint', viewports: 'two',
    path: () => '/water?recipe=lume-high-clarity&ml=800',
    act: async (page) => {
      await expect(page.locator('.water-ideal')).toContainText('The Lume High Clarity recipe is best used with 1000mL of distilled water.');
      await expect(page.getByRole('button', { name: 'Switch to 1000mL' })).toBeVisible();
    }
  },
  {
    name: 'water-ideal-switch', viewports: 'two',
    path: () => '/water?recipe=lume-high-clarity&ml=800',
    act: async (page) => {
      await page.getByRole('button', { name: 'Switch to 1000mL' }).click();
      await expect(page).toHaveURL(/ml=1000/);
      await expect(page.getByLabel('Water (mL)')).toHaveValue('1000');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1000mL' })).toBeVisible();
      await expect(page.locator('.water-ideal')).toHaveCount(0);
    }
  },
  {
    name: 'water-ideal-none', viewports: 'two',
    path: () => '/water?recipe=lume-high-clarity&ml=1000',
    act: async (page) => {
      await expect(page.getByLabel('Water (mL)')).toHaveValue('1000');
      await expect(page.locator('.water-ideal')).toHaveCount(0);
    }
  },
  {
    // Kettle fills mL (its published capacity); box and slider edit the same value live (no blur); kettle rides the URL while ml matches it.
    name: 'water-kettle', viewports: 'two',
    path: () => '/water',
    act: async (page) => {
      const kettle = page.getByLabel('Kettle');
      const box = page.getByLabel('Water (mL)');
      const slider = page.getByLabel('Water slider (mL)');
      await kettle.selectOption('palatti-enso');
      await expect(box).toHaveValue('880');
      await expect(page).toHaveURL(/ml=880/);
      await expect(page).toHaveURL(/kettle=palatti-enso/);
      await box.fill('725');
      await expect(kettle).toHaveValue('');
      await expect(page).not.toHaveURL(/kettle/);
      await expect(page.getByRole('heading', { name: 'Lotus drops for 725mL' })).toBeVisible();
      expect(await slider.inputValue()).toBe('725'); // typed mL sits exactly, not at a step
      await box.fill('825');
      expect(await slider.inputValue()).toBe('825');
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await expect(box).toHaveValue('850');
      await box.fill('825');
      await slider.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(box).toHaveValue('800');
      await slider.evaluate((el: HTMLInputElement) => { el.value = '827'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await expect(box).toHaveValue('850'); // dragging snaps to 50
      await box.fill('725');
      await slider.fill('1200');
      await expect(box).toHaveValue('1200');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1200mL' })).toBeVisible();
      await expectGroupsLabelled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  },
  {
    // Drops tab: whole-drop inputs -> minerals, GH, KH (880 mL: Mg 3, Ca 1, Na 1, K 1); values ride the URL with mode.
    name: 'water-mode-drops', viewports: 'two',
    path: () => '/water?mode=drops&ml=880&mg=3&ca=1&na=1&k=1',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Drops', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('3');
      await expect(page.getByRole('listitem', { name: '3 Magnesium' })).toBeVisible();
      await expect(page.locator('.wr-meters li', { hasText: 'Chloride' })).toBeVisible();
      await expect(page.locator('.wr-gauge', { hasText: 'GH' })).toContainText('36.5');
      await expect(page.locator('.wr-gauges')).not.toContainText('target');
      await page.getByRole('spinbutton', { name: 'Ca' }).fill('2');
      await page.getByRole('spinbutton', { name: 'Ca' }).pressSequentially('.5'); // a decimal drop is refused
      await expect(page.getByRole('spinbutton', { name: 'Ca' })).toHaveValue('2');
      await expect(page).toHaveURL(/ca=2/);
      await expect(page.getByRole('listitem', { name: '2 Calcium' })).toBeVisible();
      await expectGroupsLabelled(page);
    }
  },
  {
    // Target tab: ppm as CaCO3 or mg/L (toggle -> unit=mgl); Mg 32.5 / K 11.25 mg/L at 880 mL -> Mg 15, K 3.
    name: 'water-mode-target', viewports: 'two',
    path: () => '/water?mode=target&unit=mgl&ml=880&mg=32.5&k=11.25',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'mg/L' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('listitem', { name: '15 Magnesium' })).toBeVisible();
      await expect(page.getByRole('listitem', { name: '3 Potassium' })).toBeVisible();
      await expect(page.locator('.wr-gauge').first()).toContainText('target');
      await page.getByRole('button', { name: 'ppm as CaCO₃' }).click();
      await expect(page).toHaveURL(/unit=ppm/);
      await page.getByRole('button', { name: 'Recipe', exact: true }).click();
      await expect(page).not.toHaveURL(/mode=|unit=|mg=/);
      await expectGroupsLabelled(page);
    }
  },
  {
    // Dropper tip: Round tip default; Precision rides the URL as tip=precision and changes drops in Recipe and Target modes.
    name: 'water-tip', viewports: 'two',
    path: () => '/water',
    act: async (page) => {
      const round = page.getByRole('button', { name: 'Round tip', exact: true });
      const precision = page.getByRole('button', { name: 'Precision', exact: true });
      await expect(round).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('listitem', { name: '4 Calcium' })).toBeVisible();
      await expect(page.locator('.wr-note').first()).toContainText('round-tip dropper');
      await precision.click();
      await expect(page).toHaveURL(/tip=precision/);
      await expect(precision).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('listitem', { name: '8 Calcium' })).toBeVisible();
      await expect(page.getByRole('listitem', { name: '4 Sodium' })).toBeVisible();
      await expect(page.locator('.wr-note').first()).toContainText('precision dropper');
      await page.getByRole('button', { name: 'Target', exact: true }).click();
      await page.getByRole('spinbutton', { name: 'Ca' }).fill('40');
      await expect(page.getByRole('listitem', { name: '8 Calcium' })).toBeVisible();
      await round.click();
      await expect(page.getByRole('listitem', { name: '4 Calcium' })).toBeVisible();
      await expect(page).toHaveURL(/tip=round/);
      await expectGroupsLabelled(page);
    }
  },
  {
    // A shared tip= link wins and does not convert Drops values; a user switch converts them (round 4 <-> precision 7).
    name: 'water-tip-drops', viewports: 'two',
    path: () => '/water?mode=drops&tip=precision&ml=800&mg=4&ca=4&na=2&k=2',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Precision', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('4');
      await page.getByRole('button', { name: 'Round tip', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('2');
      await page.getByRole('button', { name: 'Precision', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('4');
      await expect(page.getByRole('spinbutton', { name: 'Na' })).toHaveValue('2');
      await expect(page).toHaveURL(/tip=precision/);
      await expect(page).toHaveURL(/mg=4/);
      // No drift: Mg 1 on round -> 2 on precision -> 1 on round; and an edit re-anchors only that box.
      await page.getByRole('button', { name: 'Round tip', exact: true }).click();
      await page.getByRole('spinbutton', { name: 'Mg' }).fill('1');
      await page.getByRole('button', { name: 'Precision', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('2');
      await expect(page.getByRole('spinbutton', { name: 'Ca' })).toHaveValue('4');
      await page.getByRole('button', { name: 'Round tip', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('1');
      await expect(page.getByRole('spinbutton', { name: 'Ca' })).toHaveValue('2');
      // A tip switch while another mode is showing still converts the Drops boxes.
      await page.getByRole('button', { name: 'Recipe', exact: true }).click();
      await page.getByRole('button', { name: 'Precision', exact: true }).click();
      await page.getByRole('button', { name: 'Drops', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('2');
    }
  },
  {
    // Target mode follows the URL's tip and a tip switch leaves the typed targets alone; a saved Precision restores
    // into a bare URL, so Share (which reads the location) carries tip= to the recipient.
    name: 'water-tip-target-saved', viewports: 'two',
    path: () => '/water?mode=target&tip=precision&ml=800&mg=40&ca=40&na=10&k=10',
    act: async (page) => {
      await expect(page.getByRole('listitem', { name: '7 Calcium' })).toBeVisible();
      await page.getByRole('button', { name: 'Round tip', exact: true }).click();
      await expect(page.getByRole('listitem', { name: '4 Calcium' })).toBeVisible();
      await expect(page.getByRole('spinbutton', { name: 'Ca' })).toHaveValue('40');
      await page.getByRole('button', { name: 'Precision', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Mg' })).toHaveValue('40');
      await page.evaluate(() => document.querySelector<HTMLElement>('nav.site-nav a[href="/stats"]')?.click());
      await expect(page).toHaveURL(/\/stats/);
      await page.evaluate(() => document.querySelector<HTMLElement>('nav.site-nav a[href="/water"]')?.click());
      await expect(page).toHaveURL(/tip=precision/);
      await expect(page.getByRole('button', { name: 'Precision', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
  },
  {
    // The tip control sits in the tabs row with Mode: no sideways scroll, nothing clipped, all three modes.
    name: 'water-tip-layout',
    path: () => '/water?tip=precision',
    act: async (page) => {
      for (const m of ['Drops', 'Target', 'Recipe']) {
        await page.getByRole('button', { name: m, exact: true }).click();
        const g = (await page.getByRole('group', { name: 'Dropper tip' }).boundingBox())!;
        expect(g.x + g.width, `${m}: tip group inside the viewport`).toBeLessThanOrEqual(page.viewportSize()!.width);
        for (const b of await page.getByRole('group', { name: 'Dropper tip' }).getByRole('button').all()) {
          expect((await b.boundingBox())!.height, 'tap target').toBeGreaterThanOrEqual(30);
        }
        await expectGroupsLabelled(page);
      }
    }
  },
  {
    // Slider scale: a labelled tick every 100 mL, none overlapping, all inside the slider's box.
    name: 'water-slider-ticks',
    path: () => '/water',
    act: async (page) => {
      const labels = page.locator('.water-tick-label');
      await expect(labels).toHaveCount(12);
      const box = (await page.locator('.water-slider input').boundingBox())!;
      const rects = await labels.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right })));
      rects.forEach((r, i) => {
        expect(r.l, `label ${i} inside left`).toBeGreaterThanOrEqual(box.x - 0.5);
        expect(r.r, `label ${i} inside right`).toBeLessThanOrEqual(box.x + box.width + 0.5);
        if (i) expect(r.l, `label ${i} clear of the previous`).toBeGreaterThan(rects[i - 1].r);
      });
      // The 600 mL tick sits under the thumb when the slider is at 600.
      await page.getByLabel('Water slider (mL)').fill('600');
      const thumbX = await page.locator('.water-slider input').evaluate((el: HTMLInputElement) => {
        const r = el.getBoundingClientRect();
        return r.left + 12 + ((+el.value - +el.min) / (+el.max - +el.min)) * (r.width - 24);
      });
      const tick = (await page.locator('.water-tick-major').nth(5).boundingBox())!;
      expect(Math.abs(tick.x - thumbX)).toBeLessThan(1.5);
    }
  },
  {
    // Result card: Mg, Ca, Na, K order; drops fill the headline card; no stray "·"; the slider spans the kettle's left edge
    // to the mL box's right edge; Chloride is not a full bar.
    name: 'water-result',
    path: () => '/water?recipe=substance&ml=880',
    act: async (page) => {
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880mL' })).toBeVisible();
      expect(await page.locator('.wr-drop').evaluateAll((els) => els.map((e) => e.textContent))).toEqual(['3Mg', '7Ca', '0Na', '9K']);
      const rows = await page.locator('.wr-meters li .wr-meter-label').allTextContents();
      expect(rows).toEqual(['Magnesium', 'Calcium', 'Sodium', 'Potassium', 'Chloride', 'Bicarbonate']);
      const lines = (await page.locator('.wr').innerText()).split('\n').map((l) => l.trim());
      for (const l of lines) expect(/^·|·$/.test(l), `line "${l}" starts or ends with a dot`).toBe(false);
      const head = (await page.locator('.wr-drops').boundingBox())!;
      const rights = (await page.locator('.wr-drop').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right)));
      expect(head.x + head.width - Math.max(...rights), 'drops fill the headline card').toBeLessThan(2);
      const kettle = (await page.getByLabel('Kettle').boundingBox())!;
      const mlBox = (await page.getByLabel('Water (mL)').boundingBox())!;
      const slider = (await page.getByLabel('Water slider (mL)').boundingBox())!;
      expect(Math.abs(slider.x - kettle.x), 'slider left = kettle left').toBeLessThan(2);
      expect(Math.abs(slider.x + slider.width - (mlBox.x + mlBox.width)), 'slider right = mL box right').toBeLessThan(2);
      const cl = await page.locator('.wr-meters li').nth(4).evaluate((li) => {
        const track = li.querySelector('.wr-bar')!.getBoundingClientRect().width;
        return li.querySelector('.wr-bar i')!.getBoundingClientRect().width / track;
      });
      expect(cl).toBeLessThan(0.9);
      await expectGroupsLabelled(page);
    }
  },
  {
    // Page grid: one narrow column on phones (notes last), two on wide screens (notes left, results right); inputs 2x2 or 4 across.
    name: 'water-columns',
    path: () => '/water?recipe=substance&ml=880',
    act: async (page) => {
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const two = page.viewportSize()!.width >= 900;
      const title = await box('.water-title'), controls = await box('.water-controls'), res = await box('.water-results'), notes = await box('.water-notes');
      expect(controls.width, 'columns never wider than the narrow width').toBeLessThanOrEqual(34 * 16 + 1);
      if (two) {
        expect(res.x, 'results in the right column').toBeGreaterThanOrEqual(controls.x + controls.width);
        expect(Math.abs(notes.x - title.x), 'notes in the left column').toBeLessThan(2);
        expect(notes.y).toBeGreaterThan(controls.y);
        expect(Math.abs(res.y - title.y), 'results start level with the title').toBeLessThan(2);
      } else {
        expect(res.y, 'one column: results below the controls').toBeGreaterThanOrEqual(controls.y + controls.height);
        expect(notes.y, 'one column: notes after the results').toBeGreaterThanOrEqual(res.y + res.height - 1);
      }
      const inputs = await page.locator('.water-inputs :is(input, select)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      if (inputs.length === 4) {
        const perRow = Object.values(inputs.reduce<Record<number, number>>((m, r) => ((m[Math.round(r.top)] = (m[Math.round(r.top)] ?? 0) + 1), m), {}));
        expect(perRow.every((n) => n === perRow[0]), `inputs per row ${perRow}: never 3+1`).toBe(true);
      }
      if (two) {
        const slider = (await page.getByLabel('Water slider (mL)').boundingBox())!;
        const sel = page.getByLabel('Recipe');
        if (await sel.count()) expect(Math.abs((await sel.boundingBox())!.width - slider.width), 'recipe select as wide as the kettle/slider group').toBeLessThan(2);
      }
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880mL of water' })).toBeVisible();
    }
  },
  {
    name: 'water-columns-drops',
    path: () => '/water?mode=drops&ml=880&mg=3&ca=1&na=1&k=1',
    act: async (page) => {
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const two = page.viewportSize()!.width >= 900;
      const title = await box('.water-title'), controls = await box('.water-controls'), res = await box('.water-results'), notes = await box('.water-notes');
      expect(controls.width, 'columns never wider than the narrow width').toBeLessThanOrEqual(34 * 16 + 1);
      if (two) {
        expect(res.x, 'results in the right column').toBeGreaterThanOrEqual(controls.x + controls.width);
        expect(Math.abs(notes.x - title.x), 'notes in the left column').toBeLessThan(2);
        expect(notes.y).toBeGreaterThan(controls.y);
        expect(Math.abs(res.y - title.y), 'results start level with the title').toBeLessThan(2);
      } else {
        expect(res.y, 'one column: results below the controls').toBeGreaterThanOrEqual(controls.y + controls.height);
        expect(notes.y, 'one column: notes after the results').toBeGreaterThanOrEqual(res.y + res.height - 1);
      }
      const inputs = await page.locator('.water-inputs :is(input, select)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      if (inputs.length === 4) {
        const perRow = Object.values(inputs.reduce<Record<number, number>>((m, r) => ((m[Math.round(r.top)] = (m[Math.round(r.top)] ?? 0) + 1), m), {}));
        expect(perRow.every((n) => n === perRow[0]), `inputs per row ${perRow}: never 3+1`).toBe(true);
      }
      if (two) {
        const slider = (await page.getByLabel('Water slider (mL)').boundingBox())!;
        const sel = page.getByLabel('Recipe');
        if (await sel.count()) expect(Math.abs((await sel.boundingBox())!.width - slider.width), 'recipe select as wide as the kettle/slider group').toBeLessThan(2);
      }
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880mL of water' })).toBeVisible();
    }
  },
  {
    name: 'water-columns-target',
    path: () => '/water?mode=target&ml=880&mg=60&ca=40',
    act: async (page) => {
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const two = page.viewportSize()!.width >= 900;
      const title = await box('.water-title'), controls = await box('.water-controls'), res = await box('.water-results'), notes = await box('.water-notes');
      expect(controls.width, 'columns never wider than the narrow width').toBeLessThanOrEqual(34 * 16 + 1);
      if (two) {
        expect(res.x, 'results in the right column').toBeGreaterThanOrEqual(controls.x + controls.width);
        expect(Math.abs(notes.x - title.x), 'notes in the left column').toBeLessThan(2);
        expect(notes.y).toBeGreaterThan(controls.y);
        expect(Math.abs(res.y - title.y), 'results start level with the title').toBeLessThan(2);
      } else {
        expect(res.y, 'one column: results below the controls').toBeGreaterThanOrEqual(controls.y + controls.height);
        expect(notes.y, 'one column: notes after the results').toBeGreaterThanOrEqual(res.y + res.height - 1);
      }
      const inputs = await page.locator('.water-inputs :is(input, select)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      if (inputs.length === 4) {
        const perRow = Object.values(inputs.reduce<Record<number, number>>((m, r) => ((m[Math.round(r.top)] = (m[Math.round(r.top)] ?? 0) + 1), m), {}));
        expect(perRow.every((n) => n === perRow[0]), `inputs per row ${perRow}: never 3+1`).toBe(true);
      }
      if (two) {
        const slider = (await page.getByLabel('Water slider (mL)').boundingBox())!;
        const sel = page.getByLabel('Recipe');
        if (await sel.count()) expect(Math.abs((await sel.boundingBox())!.width - slider.width), 'recipe select as wide as the kettle/slider group').toBeLessThan(2);
      }
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880mL of water' })).toBeVisible();
    }
  },
  {
    // Remembered per browser: kettle + recipe survive a trip to another page and back to a bare /water.
    name: 'water-remembered', viewports: 'two',
    path: () => '/water',
    act: async (page) => {
      await page.getByLabel('Kettle').selectOption('palatti-enso');
      await page.getByLabel('Recipe').selectOption('holy-water');
      await expect(page).toHaveURL(/recipe=holy-water/);
      await page.evaluate(() => document.querySelector<HTMLElement>('nav.site-nav a[href="/stats"]')?.click());
      await expect(page).toHaveURL(/\/stats/);
      await page.evaluate(() => document.querySelector<HTMLElement>('nav.site-nav a[href="/water"]')?.click());
      await expect(page.getByLabel('Recipe')).toHaveValue('holy-water');
      await expect(page.getByLabel('Kettle')).toHaveValue('palatti-enso');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('880');
      await expect(page).toHaveURL(/kettle=palatti-enso/);
      // A full load of the bare URL (SSR renders defaults, the client restores) ends in the same state.
      await gotoReady(page, '/water');
      await expect(page.getByLabel('Recipe')).toHaveValue('holy-water');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('880');
      await expect(page).toHaveURL(/recipe=holy-water.*kettle=palatti-enso|kettle=palatti-enso.*recipe=holy-water/);
    }
  },
  {
    // Reset: clears the saved state and goes back to the bare URL with the defaults; a reload stays default.
    name: 'water-reset', viewports: 'two',
    path: () => '/water?mode=drops&ml=880&mg=3&ca=1&kettle=palatti-enso',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Drops', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page).toHaveURL(/\/water$/);
      await expect(page.getByRole('button', { name: 'Recipe', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('800');
      await expect(page.getByLabel('Kettle')).toHaveValue('');
      await expect(page.getByLabel('Recipe')).toHaveValue('bright-and-juicy');
      await page.reload();
      await expect(page).toHaveURL(/\/water$/);
      await expect(page.getByLabel('Water (mL)')).toHaveValue('800');
      await expectGroupsLabelled(page);
    }
  },
  {
    // Nav "Water" on a bare URL restores the remembered state; a partial mL keeps the last results with no layout shift.
    name: 'water-reset-partial', viewports: 'two',
    path: () => '/water?recipe=substance&ml=900',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('substance');
      const box = page.getByLabel('Water (mL)');
      const results = page.locator('main section.wr');
      const before = (await results.boundingBox())!.height;
      await box.fill('8');
      await expect(page.getByText('Enter 100-2000mL.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Lotus drops for 900mL' })).toBeVisible();
      expect((await results.boundingBox())!.height).toBe(before);
      await page.evaluate(() => (document.querySelector('nav.site-nav a[href="/water"]') as HTMLElement | null)?.click());
      await expect(page).toHaveURL(/recipe=substance&ml=900/); // a bare visit restores the remembered state
      await expect(page.getByLabel('Recipe')).toHaveValue('substance');
      await expect(box).toHaveValue('900');
    }
  },
  {
    name: 'water-deep-link', viewports: 'two',
    path: () => '/water?recipe=HOLY-water&ml=1200',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('holy-water');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1200mL' })).toBeVisible();
      await expect(page.getByRole('listitem', { name: '9 Magnesium' })).toBeVisible();
      await expect(page.locator('.wr-head')).toBeVisible();
      await gotoReady(page, '/water?kettle=FELLOW-stagg-ekg-pro');
      await expect(page.getByLabel('Kettle')).toHaveValue('fellow-stagg-ekg-pro');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('900');
    }
  },
  { name: 'brew-now', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'This coffee', exact: true })).toBeVisible();
      await expect(page.locator('li[id^="brew-"]').first()).toContainText('Best');
      await expect(page.locator('.gt figure > svg')).toBeVisible();
      await expect(page.locator('.gt .crown')).toHaveCount(2); // the Best brew's crown and the legend's
      await expect(page.getByRole('link', { name: 'Recipe', exact: true })).toHaveAttribute('href', /^\/recipes\/[a-z0-9-]+$/); // a recipe's own page, by name
    } },
  { name: 'brew-now-why-open', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew?why=temp`,
    act: async (page) => {
      await expect(page.locator('.evidence p.syn')).toBeVisible();
      await expect(page.locator('.evidence .ev-label')).toHaveText('Evidence:');
      await expect(page.locator('.evidence .ev li').first()).toBeVisible();
      // Every column lines up row to row: the recipe column starts at the same x in each row.
      const lefts = await page.locator('.evidence .ev-line > :nth-child(6)').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(new Set(lefts).size).toBe(1);
      // "Show brews" sits under the summary line, not beside it.
      const why = page.locator('.why[aria-expanded="true"]');
      const [wb, pb] = [(await why.boundingBox())!, (await why.locator('xpath=preceding-sibling::p[1]').boundingBox())!];
      expect(wb.y).toBeGreaterThanOrEqual(pb.y + pb.height - 1);
      // Ratings end every bullet at the same right edge.
      const ends = await page.locator('.evidence .ev-r').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
      expect(new Set(ends).size).toBe(1);
      await page.locator('.why[aria-expanded="true"]').click();
      await expect(page).not.toHaveURL(/why=/);
      await expect(page.locator('.evidence')).toHaveCount(0);
    } },
  { name: 'brew-now-new-roaster', viewports: 'two', path: (s) => `/coffees/${s.slugs.brewNew}/brew`,
    act: async (page) => {
      await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
      await expect(page.locator('.rows > li').first()).toBeVisible();
      for (const li of await page.locator('.rows > li').all()) expect(((await li.locator('.rowhead').innerText()).split(/\s+/).length)).toBeGreaterThan(1);
      await expect(page.locator('.start h2 .badge')).toHaveText('Guess');
    } },
  { name: 'brew-now-marks', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      await expect(page.getByRole('heading', { name: 'Your last brews of this coffee' })).toBeVisible();
      const items = page.locator('.marks > li');
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toContainText('Waiting for your next BQ brew');
      await expect(items.nth(0).getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(items.nth(1)).toContainText('Grind: 1.4.0 → 1.3.0');
      await expect(items.nth(1).locator('a')).toHaveAttribute('href', /#brew-\d+/);
    } },
  { name: 'brew-now-mark-submit', viewports: 'two', path: (s) => `/coffees/${s.slugs.linked}/brew`, // another open coffee: the unopened one asks first (brew-now-open-confirm)
    act: async (page) => {
      const before = await page.locator('.marks > li').count(); // the other viewport may be marking at the same time
      await page.getByRole('button', { name: 'Brew this' }).click();
      const toast = page.getByRole('status').filter({ hasText: 'Marked. Your next BQ brew of this coffee will be compared.' });
      await expect(toast).toBeVisible();
      await expect(toast.getByRole('button', { name: /undo/i })).toBeVisible();
      await expect(page.locator('.marks > li')).not.toHaveCount(before);
    } },
  { name: 'brew-now-roaster-recipe', viewports: 'two', path: (s) => `/coffees/${s.slugs.brewNew}/brew`,
    act: async (page) => {
      const sec = page.locator('.rr');
      await expect(sec.getByRole('link')).toHaveAttribute('href', 'https://example.com/brew-guide');
      await expect(sec).toContainText('Searched');
      await expect(sec.getByRole('button', { name: 'Search again' })).toBeVisible();
      expect(await sec.evaluate((el) => el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } },
  { name: 'brew-now-no-grinder-data', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew?grinder=Comandante%20C40%20MK4`,
    act: async (page) => {
      await expect(page.getByText(/^No .+ brews on this grinder yet$/)).toBeVisible();
      await expect(page.locator('.ref li').first()).toBeVisible();
    } },
  { name: 'brew-now-basis-popover', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      await page.locator('.foot .basis').click();
      const tip = page.locator('.bn-tip');
      await expect(tip).toBeVisible();
      await expect(tip.getByRole('link').first()).toHaveAttribute('href', /^\/coffees\//); // each basis coffee is linked
      // The seed's brew coffee has similar coffees: the section and the button must exist (no vacuous pass).
      await expect(page.locator('#similar')).toHaveCount(1);
      await tip.getByRole('button', { name: 'Similar coffees' }).click(); // a real click: the tip must take pointer events. Closes the popover and lands on Similar coffees
      await expect(tip).toHaveCount(0);
      await expect.poll(() => page.locator('#similar').evaluate((el) => el.getBoundingClientRect().top < innerHeight)).toBe(true);
    } },
  { name: 'brew-now-chart-tip', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      const dot = page.locator('.gt-dot').first();
      await dot.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('[popover]:popover-open')).toContainText('Rating');
      await dot.click();
      await expect(page.locator('.brew-flash')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } },
  { name: 'brew-now-dose-ratio-chips', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      const dose = page.getByRole('group', { name: 'Dose' }).getByRole('button');
      await expect(dose.first()).toBeVisible();
      await page.locator('.rows .tiplabel', { hasText: 'Dose' }).click();
      await expect(page.locator('.bn-tip')).toContainText('change your usual doses and ratios on the Account page');
      await expect(page.locator('.bn-tip').getByRole('link')).toHaveAttribute('href', '/account#brew-now');
      await page.keyboard.press('Escape');
      await dose.last().click();
      await expect(page).toHaveURL(/dose=/);
      await expect(page.getByRole('group', { name: 'Ratio' }).getByRole('button').first()).toBeVisible();
    } },
  { name: 'brew-now-prefs-tip-link', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      await page.locator('.rows .tiplabel', { hasText: 'Dose' }).click();
      await page.locator('.bn-tip').getByRole('link', { name: 'Open Account' }).click();
      await expect(page).toHaveURL(/\/account#brew-now$/);
    } },
  { name: 'brew-now-filter-keeps-dripper', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      // Pick a dripper, then a different filter (a chip, else from Other): the URL keeps both. The filter lists follow the
      // dripper, so try each dripper chip until one offers a filter to switch to.
      const group = (name: string) => page.getByRole('group', { name });
      const names = await group('Dripper').locator('button[aria-pressed="false"]:not([aria-haspopup])').allInnerTexts();
      let done = false;
      for (const name of names) {
        await group('Dripper').getByRole('button', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`dripper=${encodeURIComponent(name).replace(/%20/g, '(\\+|%20)')}`));
        const chip = group('Filter').locator('button[aria-pressed="false"]:not([aria-haspopup])').first();
        const other = group('Filter').locator('button[aria-haspopup]');
        if (await chip.count()) await chip.click();
        else if (await other.count()) { await other.click(); await page.getByRole('menuitem').first().click(); }
        else continue;
        await expect(page).toHaveURL(/filter=/);
        await expect(page).toHaveURL(new RegExp(`dripper=${encodeURIComponent(name).replace(/%20/g, '(\\+|%20)')}`));
        await expect(group('Dripper').getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
        done = true;
        break;
      }
      expect(done, 'the seed has a dripper with a second filter').toBe(true);
    } },
  { name: 'brew-now-other-gear', viewports: 'two', path: (s) => `/coffees/${s.slugs.brew}/brew`,
    act: async (page) => {
      const other = page.getByRole('button', { name: /^Other/ }).first();
      await other.click();
      const item = page.getByRole('menuitem').first();
      const name = (await item.innerText()).trim();
      await item.click(); // the dropdown's label becomes the pick and shows as the selected chip
      await expect(page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).first()).toHaveAttribute('aria-pressed', 'true');
    } },
  { name: 'brew-now-open-confirm', viewports: 'two', path: (s) => `/coffees/${s.slugs.brewNew}/brew`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Brew this' }).click(); // no mutation: Cancel leaves the coffee unopened
      await expect(page.getByRole('heading', { name: "This coffee isn't open yet. Open it now?" })).toBeVisible();
      expect(await page.locator('#bn-open-title .line').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))).toHaveLength(2); // two lines
      await expect(page.getByRole('button', { name: 'Open and brew' })).toBeVisible();
      const tops = await page.locator('#bn-open-title .line').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      expect(tops[1].top - tops[0].bottom).toBeGreaterThanOrEqual(12); // a clear gap between the two lines
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.modal')).toHaveCount(0);
    } },
  {
    name: 'on-deck',
    path: () => '/on-deck',
    act: async (page) => {
      for (const text of Object.values(GRAMS)) await expect(page.getByText(text, { exact: true })).toBeVisible();
      for (const img of await page.locator('img.card-thumb').all()) await expectContained(img);
      // Brew now is a sibling of the card link (no nested <a>), with a >= 44 px tap target inside the card.
      const link = page.getByRole('link', { name: 'Brew now' }).first();
      await expect(link).toHaveAttribute('href', /^\/coffees\/[^/]+\/brew$/);
      expect(await page.locator('a a').count()).toBe(0);
      const [l, c] = [(await link.boundingBox())!, (await page.locator('.card-wrap .card').first().boundingBox())!];
      expect(l.height).toBeGreaterThanOrEqual(44);
      expect(l.y + l.height).toBeLessThanOrEqual(c.y + c.height + 1);
      expect(l.x + l.width).toBeLessThanOrEqual(c.x + c.width + 1);
    }
  },
  ...['cards', 'compact', 'list'].map((view) => ({
    name: `coffees-brew-now-button-${view}`,
    viewports: 'two' as const,
    path: () => `/coffees?status=open&view=${view}`,
    act: async (page: Page) => {
      if (view === 'compact') await page.locator('.compact-row').first().click();
      const b = page.getByRole('link', { name: 'Brew now' }).first();
      await expect(b).toHaveAttribute('href', /^\/coffees\/[^/]+\/brew$/);
      const edit = b.locator('xpath=..').getByRole('button', { name: 'Edit', exact: true });
      const [bb, eb] = [(await b.boundingBox())!, (await edit.boundingBox())!];
      expect(bb.y < eb.y - 4 || (Math.abs(bb.y - eb.y) < 4 && bb.x < eb.x)).toBe(true); // before Edit (the icon grid may wrap to 2 rows)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth || !!document.querySelector('.table-scroll'))).toBe(true);
    }
  })),
  {
    // Next up tiles carry /coffees' icon set for a backlog coffee, in one row: Open, Import, Edit, Clone (no ⋯ menu, no text button).
    name: 'on-deck-next-up-icons',
    viewports: 'two',
    path: () => '/on-deck?view=next',
    act: async (page: Page) => {
      const card = page.locator('.card-wrap').first();
      const names = ['Open', 'Import into Bean Conqueror', 'Edit', 'Clone'];
      const boxes = [];
      for (const n of names) boxes.push((await card.getByRole(n === 'Open' || false ? 'button' : 'link', { name: n, exact: true }).boundingBox())!);
      for (const b of boxes) expect(Math.abs(b.y - boxes[0].y)).toBeLessThan(2); // one row, in order
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
      const cb = (await card.boundingBox())!;
      for (const b of boxes) { expect(b.width).toBeGreaterThanOrEqual(43); expect(b.y + b.height).toBeLessThanOrEqual(cb.y + cb.height + 1); }
      await expect(card.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    }
  },
  {
    // List rows stay short (one row of icons, names/processing clamp at two lines), and Edit mode keeps the Actions column's width.
    name: 'coffees-list-row-height', path: () => '/coffees?status=all&view=list',
    act: async (page) => {
      const heights = () => page.locator('table.data-table tbody tr').evaluateAll((trs) => trs.slice(0, 40).map((tr) => tr.getBoundingClientRect().height));
      const w = page.viewportSize()!.width;
      // (The seed's stress roaster wraps to seven lines; a long roaster name may stretch its own row, so allow two.)
      if (w >= 1280) expect((await heights()).filter((h) => h > 62).length).toBeLessThanOrEqual(2);
      if (w <= 480) expect(Math.max(...(await heights()))).toBeLessThanOrEqual(56); // 44px tap targets in one row
      // Every action button of every row sits fully inside the Actions cell once the table is scrolled right (phones scroll it).
      const buttonsInCell = async () => {
        await page.locator('.table-scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
        const bad = await page.locator('table.data-table tbody tr').evaluateAll((trs) => trs.slice(0, 10).flatMap((tr) => {
          const cell = tr.lastElementChild!.getBoundingClientRect();
          const scroller = tr.closest('.table-scroll')!.getBoundingClientRect();
          const btns = [...tr.lastElementChild!.querySelectorAll<HTMLElement>('button, a.button')];
          const out: string[] = [];
          for (const b of btns) {
            const r = b.getBoundingClientRect();
            if (r.left < cell.left - 1 || r.right > cell.right + 1 || r.left < scroller.left - 1 || r.right > scroller.right + 1 || r.height < 28) out.push(`${b.getAttribute('aria-label')} ${Math.round(r.left)}-${Math.round(r.right)} vs cell ${Math.round(cell.left)}-${Math.round(cell.right)}`);
          }
          return out;
        }));
        expect(bad).toEqual([]);
        // Rows without an Actions cell of buttons are skipped above; the table still has rows that carry them.
        expect(await page.locator('table.data-table tbody tr td:last-child').locator('button, a.button').count()).toBeGreaterThanOrEqual(4);
      };
      await buttonsInCell();
      const actionsW = () => page.locator('table.data-table thead th.col-actions').evaluate((th) => Math.round(th.getBoundingClientRect().width));
      const before = await actionsW();
      await page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save changes' }).first()).toBeVisible();
      expect(Math.abs((await actionsW()) - before)).toBeLessThanOrEqual(1);
      await buttonsInCell(); // Edit mode too (three-icon rows plus the first row's four)
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      await checkLayout(page);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    }
  },
  ...['open', 'backlog'].map((st) => ({
    // The List view's column positions hold still when top Edit is toggled.
    name: `coffees-edit-stable-columns-${st}`,
    viewports: 'two' as const,
    path: () => `/coffees?status=${st}&view=list`,
    act: async (page: Page) => {
      const cols = () => page.locator('table.data-table thead th').evaluateAll((ths) => { const x0 = ths[0].getBoundingClientRect().x; return ths.map((th) => { const r = th.getBoundingClientRect(); return [r.x - x0, r.width]; }); });
      const icons = () => page.locator('table.data-table tbody tr').first().locator('td:last-child').locator('button, a.button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
      const before = await cols();
      const iconsBefore = await icons();
      await page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save changes' }).first()).toBeVisible();
      const after = await cols();
      // Both modes are one row on one grid (user, 2026-11-02: Edit mode was a 2x2): Edit mode's icons share one top,
      // and its first icons sit at the non-edit row's x positions (a backlog row's fifth lands to their right).
      const iconsAfter = await icons();
      const tops = await page.locator('table.data-table tbody tr').first().locator('td:last-child').locator('button, a.button').evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top)))]);
      expect(tops, 'Edit mode icons on one row').toHaveLength(1);
      const xs = [...iconsBefore].sort((p, q) => p - q);
      [...iconsAfter].sort((p, q) => p - q).slice(0, xs.length).forEach((y, i) => expect(Math.abs(y - xs[i]), `edit icon ${i}`).toBeLessThanOrEqual(1));
      expect(after).toHaveLength(before.length);
      after.forEach(([x, w], i) => { expect(Math.abs(x - before[i][0])).toBeLessThanOrEqual(1); expect(Math.abs(w - before[i][1])).toBeLessThanOrEqual(1); });
    }
  })),
  {
    // Phone bug: in List view, top Edit, then tapping a row's freeze icon did nothing. Touch taps stage Freeze (pressed, Pending badge);
    // a second tap un-stages; Unfreeze and Archive stage the same way. Nothing is saved.
    name: 'coffees-list-edit-tap-status', viewports: 'all' as const,
    path: () => '/coffees?status=backlog&view=list',
    act: async (page: Page) => {
      const canTap = await page.evaluate(() => 'ontouchstart' in window || navigator.maxTouchPoints > 0);
      const tap = (l: Locator) => (canTap ? l.tap() : l.click());
      await tap(page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true }));
      const row = page.locator('table.data-table tbody tr').first();
      const pending = row.locator('.badge');
      for (const [name, label] of [['Freeze', 'Pending: freeze'], ['Archive', 'Pending: archive']] as const) {
        const b = row.getByRole('button', { name, exact: true });
        await b.scrollIntoViewIfNeeded();
        const restBg = await b.evaluate((el) => getComputedStyle(el).backgroundColor); // its own look before the tap
        await tap(b);
        await expect(b).toHaveAttribute('aria-pressed', 'true');
        await expect(pending).toHaveText(label);
        // Visible: the icon is filled (not its resting look) and the badge is on screen, under the icons.
        await expect.poll(() => b.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(restBg); // the fill transitions in
        const [pb, bbt] = [(await pending.boundingBox())!, (await b.boundingBox())!];
        expect(pb.x + pb.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        expect(pb.y).toBeGreaterThan(bbt.y);
        await tap(b); // un-stage
        await expect(b).toHaveAttribute('aria-pressed', 'false');
      }
      // Unfreeze (Thaw) on a frozen bag stages the same way.
      const thaw = page.getByRole('button', { name: 'Thaw', exact: true }).first();
      expect(await thaw.count(), 'the seed has a frozen backlog bag').toBeGreaterThan(0);
      await thaw.scrollIntoViewIfNeeded();
      await tap(thaw);
      await expect(thaw).toHaveAttribute('aria-pressed', 'true');
      await expect(thaw.locator('xpath=ancestor::tr[1]').locator('.badge')).toHaveText('Pending: thaw');
      await tap(thaw);
      await expect(thaw).toHaveAttribute('aria-pressed', 'false');
    }
  },
  {
    // Archived rows offer Unarchive (was Restore, which dropped the opened date); nothing is saved here.
    name: 'coffees-unarchive-button', viewports: 'two',
    path: () => '/coffees?status=archive&view=list',
    act: async (page: Page) => {
      await page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true }).click();
      const un = page.getByRole('button', { name: 'Unarchive' }).first();
      await expect(un).toBeVisible();
      await expect(page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(0);
      // Edit's Cancel and Unarchive sit side by side on one row.
      const row = un.locator('xpath=ancestor::*[contains(@class,"action-stack")][1]');
      const [ub, cb] = [(await un.boundingBox())!, (await row.getByRole('button', { name: /^(Cancel|Edit)$/ }).boundingBox())!];
      expect(Math.abs(ub.y - cb.y)).toBeLessThan(4);
    }
  },
  {
    // An open tile: Brew now, Import / Edit, Clone (the same icons as /coffees).
    name: 'on-deck-open-icons', viewports: 'two',
    path: () => '/on-deck',
    act: async (page: Page) => {
      const card = page.locator('.card-wrap').first();
      await expect(card.getByRole('link', { name: 'Brew now', exact: true })).toHaveAttribute('href', /\/brew$/);
      await expect(card.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', /\?edit=1$/);
      await expect(card.getByRole('link', { name: 'Clone', exact: true })).toHaveAttribute('href', /\?clone=1$/);
      await expect(card.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    }
  },
  {
    // Clone from a coffee page, then Undo on the prompt deletes the clone (a real create; unique name per viewport).
    name: 'coffee-clone-undo',
    viewports: 'two',
    path: (s: Seed) => `/coffees/${s.slugs.long}`,
    act: async (page: Page, s: Seed) => {
      const name = `Undo Clone ${isPhone(page) ? 'P' : 'D'}`;
      await page.locator('.detail-clone').click();
      await page.locator('#coffee_name').fill(name);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const prompt = page.locator('.added-toast');
      await expect(prompt).toContainText('Coffee added!');
      await prompt.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
      await page.goto('/coffees?status=all&view=list');
      await expect(page.getByRole('link', { name })).toHaveCount(0);
    }
  },
  {
    name: 'coffee-clone-param',
    viewports: 'two',
    path: (s: Seed) => `/coffees/${s.slugs.brew}?clone=1`,
    act: async (page: Page) => {
      await expect(page.getByRole('heading', { name: 'Add Coffee' }).or(page.locator('.modal #coffee_name'))).toBeVisible();
      await expect(page).toHaveURL(/\/coffees\/[^?]+$/);
    }
  },
  {
    name: 'coffee-edit-param',
    viewports: 'two',
    path: (s: Seed) => `/coffees/${s.slugs.brew}?edit=1`,
    act: async (page: Page) => {
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
      await expect(page).toHaveURL(/\/coffees\/[^?]+$/); // the param is dropped once used
    }
  },
  {
    name: 'coffee-bq-import-link',
    viewports: 'two',
    path: (s: Seed) => `/coffees/${s.slugs.brew}?bq=import`,
    act: async (page: Page) => {
      await expect(page.getByAltText('QR code to import this coffee into Bean Conqueror')).toBeVisible();
    }
  },
  {
    // A coffee with every origin field makes the biggest payload: the QR stays square, inside the
    // panel, and shows at >= 3 CSS px per square unless the panel is narrower than that needs.
    name: 'coffee-bq-qr-filled',
    viewports: 'all',
    path: (s: Seed) => `/coffees/${s.slugs.brewNew}?bq=import`,
    act: async (page: Page) => {
      const qr = page.locator('img.share-qr');
      await expect(qr).toBeVisible();
      const m = await qr.evaluate((img: HTMLImageElement) => {
        const r = img.getBoundingClientRect();
        const panel = img.closest('.chart-panel')!.getBoundingClientRect();
        return { w: r.width, h: r.height, left: r.left, right: r.right, panelLeft: panel.left, panelRight: panel.right,
          squares: Number(img.dataset.squares), scrollOk: document.documentElement.scrollWidth <= innerWidth };
      });
      expect(Math.abs(m.w - m.h), 'square').toBeLessThan(1);
      expect(m.left, 'inside panel').toBeGreaterThanOrEqual(m.panelLeft - 0.5);
      expect(m.right, 'inside panel').toBeLessThanOrEqual(m.panelRight + 0.5);
      expect(m.scrollOk, 'no horizontal scroll').toBe(true);
      expect(m.squares).toBeGreaterThan(60);
      const need = m.squares * 3;
      expect(m.w, '3px per square unless the panel is narrower').toBeGreaterThanOrEqual(Math.min(need, m.panelRight - m.panelLeft - 40) - 1);
    }
  },
  {
    name: 'coffee-brew-now-button',
    viewports: 'two',
    path: (s: Seed) => `/coffees/${s.slugs.brew}`,
    act: async (page: Page) => {
      const b = page.locator('.detail-actions').getByRole('link', { name: 'Brew now' });
      await expect(b).toHaveAttribute('href', /\/brew$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  },
  {
    // An expanded compact row shows the whole name, wrapped, not an ellipsis.
    name: 'coffees-compact-long-expanded',
    path: () => '/coffees?status=open&view=compact',
    act: async (page: Page, s: Seed) => {
      const row = page.getByRole('button', { name: new RegExp(s.names.long.slice(0, 20)) });
      await row.click();
      const title = row.locator('.compact-row-title');
      await expect(title).toContainText(s.names.long);
      expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  },
  ...GRAMS_KEYS.flatMap((k) => [
    {
      name: `coffees-compact-grams-${k}`,
      path: () => '/coffees?status=open&view=compact',
      act: async (page: Page, s: Seed) => {
        await page.getByRole('button', { name: new RegExp(s.names[k]) }).click();
        await expect(page.getByText(GRAMS[k]).first()).toBeVisible();
      }
    },
    {
      name: `coffee-grams-${k}`,
      path: (s: Seed) => `/coffees/${s.slugs[k]}`,
      act: async (page: Page) => {
        await expect(page.getByText(GRAMS[k], { exact: true })).toBeVisible();
      }
    }
  ]),
  { name: 'subscriptions-compact', path: () => '/subscriptions?view=compact' },
  { name: 'subscriptions-list', path: () => '/subscriptions?view=list' },
  {
    // A staged row's Pending chip opens its tip (what's pending) on a tap, in view (ui-rules 36, 39).
    name: 'subscriptions-list-edit-pending-tip',
    path: () => '/subscriptions?view=list',
    act: async (page: Page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const row = page.locator('tbody tr').nth(0);
      await row.locator('input[name="price"]').fill('45');
      await row.locator('.pending-chip .text-tip').click();
      const tip = page.locator('.cell-tip');
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).toHaveText('Pending changes');
      await expect(tip.locator('.tip-lines li')).toHaveText(['Edited']);
      // The chip sits midway between Pause and the row's divider (±1px); the total under g/bag shares its text's
      // baseline (±1px) and font size (user, 2026-10-18).
      const m = await row.evaluate((tr) => {
        const pause = tr.querySelector('.pause-button')!.getBoundingClientRect();
        const chip = tr.querySelector('.pending-chip')!, cell = chip.closest('td')!;
        const c = chip.getBoundingClientRect();
        const divider = cell.getBoundingClientRect().bottom - parseFloat(getComputedStyle(cell).borderBottomWidth);
        const textBox = (el: Element) => {
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? 1 : 2) });
          const n = w.nextNode()!, r = document.createRange();
          r.selectNodeContents(n);
          const b = r.getBoundingClientRect();
          return { bottom: b.bottom, left: b.left, size: getComputedStyle(n.parentElement!).fontSize };
        };
        const a = textBox(chip), b = textBox(tr.querySelector('.total-note')!);
        const input = tr.querySelector('input[name="amount_per_bag_g"]')!, s = getComputedStyle(input);
        const textLeft = input.getBoundingClientRect().left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
        return { off: (c.top + c.bottom) / 2 - (pause.bottom + divider) / 2, baseline: a.bottom - b.bottom, sizes: [a.size, b.size], left: b.left - textLeft };
      });
      expect(Math.abs(m.left), "total's left edge on the g/bag input's text").toBeLessThanOrEqual(1);
      expect(Math.abs(m.off), 'chip centered under Pause').toBeLessThanOrEqual(1);
      expect(Math.abs(m.baseline), 'total on the chip text baseline').toBeLessThanOrEqual(1);
      expect(m.sizes[0]).toBe(m.sizes[1]);
    }
  },
  {
    // Edit mode (nothing saved): Pause/Resume · Delete, staged edits and a
    // staged pause, and the URL warning for a host that isn't the roaster's.
    name: 'subscriptions-list-edit',
    path: () => '/subscriptions?view=list',
    act: async (page: Page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
      const rows = page.locator('tbody tr');
      const [row, ceto, sey] = [rows.nth(0), rows.nth(1), rows.nth(2)];
      const [pause, del] = [row.locator('.sub-actions .button').nth(0), row.locator('.sub-actions .button').nth(1)];
      const boxes = () => buttonBoxes(row);
      const height = async (r: Locator) => Math.round((await r.boundingBox())!.height);
      const before = await boxes();
      const rowHeight = await height(row);
      // Pause and Delete are the same size.
      expect(before[0].slice(2)).toEqual(before[1].slice(2));
      const desktop = (page.viewportSize()?.width ?? 0) > 640;
      // A paused row: no badge in edit mode, inputs disabled, Resume and
      // Delete usable, same height as an active row.
      await expect(ceto.getByText('Paused', { exact: true })).toHaveCount(0);
      for (const input of await ceto.locator('.inline-input').all()) await expect(input).toBeDisabled();
      await expect(ceto.getByRole('button', { name: 'Resume' })).toBeEnabled();
      await expect(ceto.getByRole('button', { name: 'Delete' })).toBeEnabled();
      expect(await height(ceto)).toBe(rowHeight);
      if (desktop) {
        await expectRowLevel(row);
        await expectRowLevel(ceto);
      }
      await expectAddUrlFullWidth(page);
      // Edits stage as you type: the Pending chip names them (its tip and accessible name); the visible total
      // under g/bag updates live.
      const chip = row.locator('.pending-chip .text-tip');
      await expect(ceto.locator('.pending-chip')).toBeHidden();
      await row.locator('input[name="price"]').fill('45');
      await expect(chip).toHaveAttribute('aria-label', 'Pending: Pending changes · Edited');
      await expect(row.locator('.total-note')).toHaveText('500g total');
      await row.locator('input[name="bag_count"]').fill('3');
      await expect(row.locator('.total-note')).toHaveText('750g total');
      // Pausing disables the inputs (keeping the staged values); the label
      // flips to what a click would do now; nothing moves or grows.
      await pause.click();
      await expect(pause).toHaveText('Resume');
      await expect(chip).toHaveAttribute('aria-label', 'Pending: Pending changes · Pause · Edited');
      await expect(row.locator('input[name="price"]')).toBeDisabled();
      expect(await boxes()).toEqual(before);
      expect(await height(row)).toBe(rowHeight);
      if (desktop) await expectRowLevel(row);
      await pause.click();
      await expect(row.locator('input[name="price"]')).toBeEnabled();
      await expect(row.locator('input[name="price"]')).toHaveValue('45');
      // A staged delete reads Restore (an undo, green); a click un-stages it.
      page.once('dialog', (d) => d.accept());
      await del.click();
      const restore = row.getByRole('button', { name: 'Restore' });
      await expect(restore).toHaveClass(/button-success/);
      expect(await boxes()).toEqual(before);
      expect(await height(row)).toBe(rowHeight);
      await restore.click();
      await expect(del).toHaveText('Delete');
      await expect(page.getByRole('columnheader', { name: 'Total grams' })).toHaveCount(0);
      await sey.locator('input[name="subscription_url"]').fill('https://evil.example.com');
      await expect(page.getByText("⚠ doesn't look like Sey's site")).toBeVisible();
      await expectClearlyBelow(sey.locator('input[name="subscription_url"]'), page.getByText("⚠ doesn't look like Sey's site"));
      await expect(sey.locator('.pending-chip .text-tip')).toHaveAttribute('aria-label', 'Pending: Pending changes · Edited');
      // Desktop: the edit table fits, no sideways scroll (user, 2026-10-08).
      const size = page.viewportSize();
      if (size && size.width >= 1280) {
        for (const width of [1280, 1440]) {
          await page.setViewportSize({ width, height: size.height });
          const overflow = await page.evaluate(() => {
            const t = document.querySelector('.table-scroll')!;
            return [t.scrollWidth - t.clientWidth, document.documentElement.scrollWidth - window.innerWidth];
          });
          expect(overflow, `edit table overflow at ${width}`).toEqual([0, 0]);
        }
        await page.setViewportSize(size);
      }
    }
  },
  {
    name: 'subscriptions-compact-edit',
    path: () => '/subscriptions?view=compact',
    act: async (page: Page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const detail = page.locator('.compact-row-detail').first();
      const pause = detail.locator('.sub-actions .button').nth(0);
      await expect(pause).toHaveText('Pause');
      const boxes = () => buttonBoxes(detail);
      const before = await boxes();
      expect(before[0].slice(2)).toEqual(before[1].slice(2));
      // The URL input spans the field grid; Pause/Delete sit on its first and
      // last columns at input height (desktop), or share the row (phone).
      const geo = await detail.evaluate((el) => {
        const rect = (q: Element) => q.getBoundingClientRect();
        const inputs = [...el.querySelectorAll('.form-grid .inline-input')].map(rect);
        const [p, d] = [...el.querySelectorAll('.sub-actions .button')].map(rect);
        const url = rect(el.querySelector('input[name="subscription_url"]')!);
        return {
          left: Math.min(...inputs.map((r) => r.left)), right: Math.max(...inputs.map((r) => r.right)),
          url: [url.left, url.right], inputH: inputs[0].height, p: [p.left, p.right, p.top, p.height], d: [d.left, d.right, d.top, d.height]
        };
      });
      expect(Math.abs(geo.url[0] - geo.left)).toBeLessThanOrEqual(1);
      await expectUrlRowSpans(detail.locator('.form-grid'));
      expect(Math.abs(geo.p[0] - geo.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(geo.d[1] - geo.right)).toBeLessThanOrEqual(1);
      expect(geo.p[2]).toBe(geo.d[2]);
      if ((page.viewportSize()?.width ?? 0) > 640) {
        expect(Math.abs(geo.p[3] - geo.inputH)).toBeLessThanOrEqual(1);
        // Each button is one column wide: as wide as the first input.
        const first = await detail.locator('.form-grid .form-field:not(.url-field) .inline-input').first().boundingBox();
        expect(Math.abs(geo.p[1] - geo.p[0] - first!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(geo.d[1] - geo.d[0] - first!.width)).toBeLessThanOrEqual(1);
      } else {
        expect(geo.p[3]).toBeGreaterThanOrEqual(44);
      }
      await pause.click();
      await expect(page.getByText('Pending: pause')).toBeVisible();
      expect(await boxes()).toEqual(before);
      for (const input of await detail.locator('.form-grid .inline-input').all()) await expect(input).toBeDisabled();
      await expectClearlyBelow(pause, detail.getByText('Pending: pause'));
      await pause.click();
      await page.getByLabel('Subscription page').first().fill('https://evil.example.com');
      await expect(page.getByText(/doesn't look like A Very Long/)).toBeVisible();
      await expectClearlyBelow(page.getByLabel('Subscription page').first(), page.getByText(/doesn't look like A Very Long/));
      await expectAddUrlFullWidth(page);
    }
  },
  {
    // Add form: Fill from page (stubbed) fills only empty fields, offers the
    // options; picking one sets price, bags and g/bag. Nothing is added.
    name: 'subscriptions-add-fill',
    path: () => '/subscriptions?view=compact',
    act: async (page: Page) => {
      const posts = await stubSubFill(page, SUB_FILL);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const form = page.locator('form[action="?/create"]');
      await form.locator('#subscription_name').fill('My name');
      await form.locator('#subscription_url').fill('https://hscoffeeroasters.com/products/roasters-choice-subscription');
      await form.getByRole('button', { name: 'Fill from page' }).click();
      await expect(form.getByText('Filled 3 fields · pick an option below')).toBeVisible();
      await expect(form.locator('#roaster_service')).toHaveValue('H&S Coffee Roasters');
      await expect(form.locator('#subscription_name')).toHaveValue('My name'); // typed: kept
      await expect(form.locator('#renewal_day')).toHaveValue('10');
      await form.getByRole('button', { name: '2 bags, 250g (8.8oz) each · $56.00' }).click();
      await expect(form.getByRole('button', { name: '2 bags, 250g (8.8oz) each · $56.00' })).toHaveAttribute('aria-pressed', 'true');
      await expect(form.locator('#price')).toHaveValue('56');
      await expect(form.locator('#bag_count')).toHaveValue('2');
      await expect(form.locator('#amount_per_bag_g')).toHaveValue('250');
      await expectAddUrlFullWidth(page);
      expect(posts).toEqual([]);
    }
  },
  {
    // A failed fill: the error, the URL back to empty, and the offer to keep
    // the tried URL anyway (Yes/No share a row).
    name: 'subscriptions-add-fill-error',
    path: () => '/subscriptions?view=compact',
    act: async (page: Page) => {
      const posts = await stubSubFill(page, { error: 'No product data found on that page. Is it a single product page?' }, 422);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const form = page.locator('form[action="?/create"]');
      await form.locator('#subscription_url').fill('https://www.averylongsubscriptionservice.example.com/pages/subscriptions/explorer');
      await form.getByRole('button', { name: 'Fill from page' }).click();
      await expect(form.getByRole('alert')).toHaveText(/No product data found/);
      await expect(form.locator('#subscription_url')).toHaveValue('');
      await expect(form.getByText(/as the subscription page anyway\?/)).toBeVisible();
      await expectAddUrlFullWidth(page);
      expect(posts).toEqual([]);
    }
  },
  {
    // Edit mode: a row's Fill stages through the same path as typing
    // (overwrites what the page states, like the coffee form); the options
    // sit in a full-width row under it; the table still fits at 1280.
    name: 'subscriptions-list-edit-fill',
    path: () => '/subscriptions?view=list',
    act: async (page: Page) => {
      const posts = await stubSubFill(page, SUB_FILL);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const row = page.locator('tbody tr').nth(0);
      await row.getByRole('button', { name: 'Fill from page' }).click();
      const fillRow = page.locator('tr.fill-row');
      await expect(fillRow.getByText('Filled 3 fields · pick an option below')).toBeVisible();
      await expect(row.locator('input[name="roaster_service"]')).toHaveValue('H&S Coffee Roasters');
      await expect(row.locator('.pending-chip .text-tip')).toHaveAttribute('aria-label', 'Pending: Pending changes · Edited');
      await fillRow.getByRole('button', { name: '1 bag, 125g (4.4oz) · $16.00' }).click();
      await expect(row.locator('input[name="price"]')).toHaveValue('16');
      await expect(row.locator('input[name="amount_per_bag_g"]')).toHaveValue('125');
      const size = page.viewportSize();
      if (size && size.width >= 1280) {
        const overflow = await page.evaluate(() => {
          const t = document.querySelector('.table-scroll')!;
          return t.scrollWidth - t.clientWidth;
        });
        expect(overflow).toBe(0);
      }
      expect(posts).toEqual([]);
    }
  },
  {
    // The compact editor's URL row with a fill's options under it.
    name: 'subscriptions-compact-edit-fill',
    path: () => '/subscriptions?view=compact',
    act: async (page: Page) => {
      const posts = await stubSubFill(page, SUB_FILL);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
      const detail = page.locator('.compact-row-detail').first();
      await detail.getByRole('button', { name: 'Fill from page' }).click();
      await expect(detail.getByText('Filled 3 fields · pick an option below')).toBeVisible();
      await detail.getByRole('button', { name: '2 bags, 125g (4.4oz) each · $32.00' }).click();
      await expect(detail.locator('input[name="bag_count"]')).toHaveValue('2');
      await expectUrlRowSpans(detail.locator('.form-grid'));
      expect(posts).toEqual([]);
    }
  },
  {
    name: 'subscriptions-compact-paused-expanded',
    path: () => '/subscriptions?view=compact',
    act: async (page: Page) => {
      await page.getByRole('button', { name: /Ceto/ }).click();
      const link = page.getByRole('link', { name: 'Paused Monthly' });
      await expect(link).toBeVisible();
      await expect(link.locator('..')).toContainText('Paused Monthly (Ceto)');
      for (const l of [link, page.getByRole('link', { name: 'Ceto', exact: true })]) {
        expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(43.99) // sub-pixel float noise (43.99997) once the page above shifts by a label line;
      }
    }
  },
  {
    // The triage list sits in the Bean Conqueror panel under the upload; the import result links to it.
    name: 'account-not-tracked',
    path: () => '/account?untracked=all',
    act: async (page) => {
      const h = page.getByRole('heading', { name: /^Not yet tracked \(\d+\)$/ });
      await expect(h).toHaveAttribute('id', 'not-tracked');
      await expect(h.locator('xpath=ancestor::section[1]').getByRole('heading', { level: 2 })).toHaveText('Bean Conqueror');
      await expect(page.locator('.triage-row').filter({ hasText: 'Mountain Water' })).toContainText('Unknown roaster · No roast date');
      const row = page.locator('.triage-row').filter({ hasText: 'Kenya Kiambu' }).first();
      for (const name of ['Create', 'Link', 'Dismiss']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
      for (const theme of ['dark', 'light']) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await checkLayout(page);
      }
    }
  },
  {
    // Capped at 3 rows; "Show N more" opens the rest (?untracked=all) and "Show fewer" goes back, button in the same place.
    name: 'account-not-tracked-open', path: () => '/account',
    act: async (page) => {
      const rows = page.locator('.triage-row');
      await expect(rows).toHaveCount(3);
      const more = page.getByRole('button', { name: /^Show \d+ more$/ });
      const before = await more.boundingBox();
      await more.click();
      await expect(page).toHaveURL(/[?&]untracked=all/);
      await expect(rows).toHaveCount(5);
      const fewer = page.getByRole('button', { name: 'Show fewer' });
      const after = await fewer.boundingBox();
      expect(Math.abs(after!.width - before!.width)).toBeLessThan(2);
      expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
      await checkLayout(page);
      await fewer.click();
      await expect(rows).toHaveCount(3);
      await expect(page).not.toHaveURL(/untracked/);
    }
  },
  {
    // Deep link with the list open: every row shows; layout only (no column-ratio check).
    name: 'account-not-tracked-all', path: () => '/account?untracked=all',
    act: async (page) => {
      await expect(page.locator('.triage-row')).toHaveCount(5);
      await expect(page.getByRole('button', { name: 'Show fewer' })).toBeVisible();
      await checkLayout(page);
    }
  },
  {
    // Create opens the same CoffeeForm modal, prefilled from the bean; Cancel closes it without saving.
    name: 'account-not-tracked-create', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      const row = page.locator('.triage-row').filter({ hasText: 'Rwanda Gitega' }).first();
      await row.getByRole('button', { name: 'Create', exact: true }).click();
      const dlg = page.locator('.modal');
      await expect(dlg.getByRole('heading', { name: /Create coffee from/ })).toBeVisible();
      await expect(dlg.getByLabel('Coffee', { exact: true })).toHaveValue(/Rwanda Gitega/);
      await checkLayout(page);
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      await expect(dlg).toHaveCount(0);
    }
  },
  {
    // A failed Link shows its message in the open picker, not (only) at the top of the panel.
    name: 'account-not-tracked-link-error', viewports: 'two',
    path: () => '/account?untracked=all',
    act: async (page) => {
      await page.route('**/account?/linkBeanConqueror', (route) =>
        route.fulfill({ json: { type: 'failure', status: 400, data: '[{"error":1},"Stubbed is already linked"]' } }));
      await showPicker(page, 'Kenya Kiambu');
      await page.getByRole('button', { name: /^Coffee to link/ }).click();
      await page.getByRole('option').first().click();
      const row = page.locator('.triage-row').filter({ hasText: 'Kenya Kiambu' }).first();
      await row.getByRole('button', { name: 'Link', exact: true }).click();
      await expect(row.getByRole('alert')).toHaveText('Stubbed is already linked');
      await checkLayout(page);
    }
  },
  {
    // Closed, after a keyboard pick (nothing is submitted): ↓ + Enter takes the
    // second twin; Esc closes without changing it. Focus returns to the button.
    name: 'account-not-tracked-link-picker', viewports: 'two',
    path: () => '/account?untracked=all',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      const button = page.getByRole('button', { name: /^Coffee to link/ });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(/Bag 2$/);
      await button.click();
      await page.keyboard.press('End');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(/Bag 2$/);
    }
  },
  {
    name: 'account-not-tracked-link-picker-open',
    path: () => '/account?untracked=all',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      const top = page.getByRole('group', { name: 'Top match' }).getByRole('option');
      await expect(top).toHaveCount(2); // the seeded twins
      await expect(top.first()).toHaveAttribute('aria-selected', 'true');
      if (page.viewportSize()!.width === 360) await expectBagOnOwnLine(page);
    }
  },
  {
    name: 'account-not-tracked-link-picker-search', viewports: 'two',
    path: () => '/account?untracked=all',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      await page.getByRole('searchbox', { name: 'Search coffees' }).fill('ethiopia');
      await expect(page.getByRole('group', { name: 'Top match' })).toHaveCount(0);
      await expect(page.getByRole('option').first()).toBeVisible();
    }
  },
  {
    name: 'account-not-tracked-link-picker-long',
    path: () => '/account',
    act: (page, s) => openPicker(page, s.names.long.slice(0, 20))
  },
  {
    name: 'coffee-linked', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.linked}`,
    act: async (page) => {
      await expect(page.getByText(/Bean Conqueror: .* · 8 brews/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible();
    }
  },
  {
    // The People label is the (help-cursor) trigger of a sticky tip: text + an admin link to Account; Esc closes; the switch doesn't move.
    name: 'insights-people-tip', viewports: 'two', path: () => '/stats',
    act: async (page) => {
      const sw = page.getByRole('group', { name: 'People' });
      const trigger = page.getByRole('button', { name: 'People', exact: true });
      const before = await sw.boundingBox();
      expect(await trigger.evaluate((el) => getComputedStyle(el).cursor)).toBe('help');
      await trigger.click();
      const tip = page.locator('#tip-people');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('Per person');
      const link = tip.getByRole('link', { name: 'Set it on Account' });
      await expect(link).toBeVisible();
      expect(await link.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
      expect(await tip.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('help');
      const after = await sw.boundingBox();
      expect(after).toEqual(before);
      await checkLayout(page);
      await page.keyboard.press('Escape');
      await expect(tip).toBeHidden();
      await trigger.click();
      await link.click();
      await expect(page).toHaveURL(/\/account#household$/);
    }
  },
  {
    // Time panel on Account: three selects (Browser time first for Display; example renderings for Date format), each with
    // its one-line hint; a change toasts with Undo (stubbed: layout states never save, the real saves are in save.spec.ts).
    name: 'account-time', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      const panel = page.locator('#time');
      await expect(panel.getByRole('heading', { name: 'Time' })).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT');
      const brewing = panel.getByLabel('Brewing timezone'), display = panel.getByLabel('Display timezone'), format = panel.getByLabel('Date format');
      await expect(panel).toContainText('Where day and hour lines are drawn in your stats');
      await expect(panel).toContainText('How update and upload times are shown');
      await expect(panel).toContainText('How dates and times are written');
      await expect(display.locator('option').first()).toHaveText('Browser time');
      await expect(display).toHaveValue('browser');
      await expect(brewing.locator('option[value="America/Denver"]')).toHaveCount(1);
      await expect(brewing.locator('option[value="browser"]')).toHaveCount(0);
      await expect(format.locator('option')).toHaveText(['2026-10-22 8:05:23 PM', '2026-10-22 20:05:23', '10/22/2026, 8:05:23 PM', '22/10/2026 20:05:23']);
      // Selects stay inside the viewport and their panel, at every width (360 included).
      const vw = page.viewportSize()!.width;
      const panelBox = (await panel.boundingBox())!;
      for (const sel of [brewing, display, format]) {
        const b = (await sel.boundingBox())!;
        expect(b.x + b.width, 'select inside viewport').toBeLessThanOrEqual(vw);
        expect(b.x + b.width, 'select inside panel').toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
      }
      const before = await Promise.all([brewing, display, format].map(async (sel) => { const b = (await sel.boundingBox())!; return [b.x, b.y, b.width, b.height].map(Math.round); }));
      await page.route('**/account?/setDisplayZone', (route) => route.fulfill({ json: { type: 'success', status: 200, data: stringify({ settingSaved: true }) } }));
      await page.route('**/account?/setDateFormat', (route) => route.fulfill({ json: { type: 'failure', status: 400, data: stringify({ settingError: 'x', setting: 'dateFormat' }) } }));
      await display.selectOption('Asia/Tokyo');
      const toast = page.getByRole('status').filter({ hasText: 'Display timezone set to Asia/Tokyo.' });
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
      await format.selectOption('eu');
      await expect(panel.getByRole('alert')).toHaveText('Could not save date format.');
      // The error is the only thing that moved (it sits under its own select).
      const after = await Promise.all([brewing, display].map(async (sel) => { const b = (await sel.boundingBox())!; return [b.x, b.y, b.width, b.height].map(Math.round); }));
      expect(after, 'controls above keep size and position').toEqual(before.slice(0, 2));
    }
  },
  {
    // Household panel on Account: save toasts with Undo (and restores); a bad size shows its error in the panel.
    // Stubbed (layout states never save; the real save is in save.spec.ts).
    name: 'account-household', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      await page.route('**/account?/updateHouseholdSize', async (route) => {
        const bad = /householdSize(?:=|"\r\n\r\n)21(?:&|\r|$)/.test(route.request().postData() ?? '');
        await route.fulfill({ json: bad
          ? { type: 'failure', status: 400, data: stringify({ error: 'Household size must be a whole number from 1 to 20' }) }
          : { type: 'success', status: 200, data: stringify({ success: true }) } });
      });
      const panel = page.locator('#household');
      const input = panel.getByLabel('Household size');
      await expect(input).toHaveValue('2');
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      await input.fill('3');
      await panel.getByRole('button', { name: 'Save' }).click();
      const toast = page.getByRole('status').filter({ hasText: 'Household size set to 3.' });
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: 'Undo' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
      await expect(input).toHaveValue('2');
      await input.fill('21'); // over the 1-20 range: the browser's own check stops it, so go around it
      await input.evaluate((el: HTMLInputElement) => el.removeAttribute('max'));
      await panel.getByRole('button', { name: 'Save' }).click();
      await expect(panel.getByRole('alert')).toHaveText('Household size must be a whole number from 1 to 20');
      // The panel is no shorter than its content needs and sits inside the viewport at every width.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const theme of ['dark', 'light']) {
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await checkLayout(page);
      }
    }
  },
  {
    name: 'account',
    path: () => '/account',
    act: async (page) => {
      await expect(page.getByText('Flow data for 24 of 24 brews')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open recipes' })).toHaveAttribute('href', '/recipes');
      // Brew now lists: no mutation here (every viewport shares one DB); add/remove are covered in page.server.test.ts.
      const rows = page.locator('.bn-list').first().locator('li');
      await expect(rows.first().locator('.bn-cell').first()).toContainText(/1:\d+(\.\d)?\s*\d+g/);
      const cellXs = await page.locator('.bn-list').first().locator('li').evaluateAll((lis) => lis.map((li) => li.querySelector('.bn-cell')!.getBoundingClientRect().x));
      expect(Math.max(...cellXs) - Math.min(...cellXs)).toBeLessThan(2); // water columns line up row to row
      await page.getByLabel('New dose in grams').fill('3');
      await page.getByRole('button', { name: 'Add', exact: true }).first().click();
      await expect(page.getByText('Each dose must be 5–40g')).toBeVisible();
      // An existing value is an error with no toast (so no Undo that would remove it).
      await page.getByLabel('New dose in grams').fill('18');
      await page.getByRole('button', { name: 'Add', exact: true }).first().click();
      await expect(page.getByText('Already in your list.')).toBeVisible();
      await expect(page.getByRole('status')).toHaveCount(0);
      const x = rows.first().getByRole('button', { name: /^Remove / });
      const [xb, rb] = [(await x.boundingBox())!, (await rows.first().boundingBox())!];
      expect(rb.x + rb.width - (xb.x + xb.width)).toBeLessThan(4); // the ✕ sits at the row's far right
      await x.click();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toContainText('Remove');
      await expect(dlg.getByLabel("Don't ask again")).not.toBeChecked();
      await dlg.getByRole('button', { name: 'Cancel' }).click();
      await expect(dlg).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByText('1 brew not on the site yet: import the Bean Conqueror .zip above to add it and its coffee')).toBeVisible();
      await expect(page.getByRole('listitem').filter({ hasText: 'custom server' }).locator('code')).toHaveText('http://localhost:5198/');
      await expect(page.getByText('Username: bean-tracker. Password: your Bean Tracker sign-in password.')).toBeVisible();
      // Bean Conqueror's Basic auth takes the sign-in password (the UI tests' is `test`, playwright.config.ts).
      const basic = 'Basic ' + Buffer.from('x:test').toString('base64');
      expect((await page.request.get('/api/me', { headers: { Authorization: basic } })).status()).toBe(200);
    }
  },
  ...(() => {
    // /recipes: seeded with 24 flow brews (10 bbs, 10 bbj, 3 4sy, 1 bbf), the recipe "Seed equal pours" (the 4sy
    // brews, 3 of 24 flow brews) and the bbf structure dismissed; bbs and bbj have MIN_GROUP (10) brews each. `item` finds a list item by text inside one panel.
    const panel = (page: Page, h: string) => page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: h, level: 2 }) });
    const rows = (page: Page) => page.locator('.brew-row');
    return [
      {
        name: 'recipes',
        path: () => '/recipes',
        act: async (page: Page) => {
          const mine = panel(page, 'Your recipes').locator('li.item');
          await expect(mine).toHaveCount(3); // + the two logged-only recipes the Pours tab's seed adds
          await expect(mine.filter({ hasText: 'Seed equal pours' })).toHaveCount(1);
          const found = panel(page, 'Found in your brews').locator('li.item');
          await expect(found).toHaveCount(2);
          await expect(found.first()).toContainText('2 tagged in notes (mostly BBS)');
          for (const li of await panel(page, 'Your recipes').locator('li.item').all().then(async (a) => [...a, ...(await found.all())])) {
            const svg = li.locator('svg[role="img"]').first();
            await expect(svg).toBeVisible();
            expect(await svg.getAttribute('aria-label')).toBeTruthy();
            await expect(li.locator('[data-button-row]').first()).toBeVisible();
          }
          // The only small structures are the recipe's 4sy (matched) and the dismissed bbf: neither counts as "other".
          await expect(page.getByText(/other structures? with fewer than/)).toHaveCount(0);
          await expect(page.getByRole('link', { name: 'Hidden (1)' })).toHaveAttribute('href', '?view=hidden');
          // Card: one-liner, then a steps grid (time | text, one row per pour), then temperature · notes.
          const card = panel(page, 'Your recipes').locator('li.item').filter({ hasText: 'Seed equal pours' });
          const steps = card.locator('.steps');
          const nPours = await steps.locator('li').count();
          expect(nPours).toBeGreaterThanOrEqual(4);
          await expect(card.getByText('93°C · Rinse the filter')).toBeVisible();
          const low = steps.locator('.step-time.low', { hasText: /^Low$/ });
          await expect(low).toHaveText('Low');
          const xs = await steps.locator('li > span:first-child').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
          expect(new Set(xs).size).toBe(1); // the time column is aligned
          await low.click();
          await expect(page.locator('.cell-tip:popover-open')).toContainText('Water low');
          await expect(page.locator('.cell-tip:popover-open')).toContainText('Start this pour when the water is low');
          await page.mouse.click(1, 1);
          await expect(page.getByText('Read from 24 brews with flow data · 0 low confidence · 24 with notes only')).toBeVisible();
        }
      },
      {
        name: 'recipes-see-brews',
        path: (s: Seed) => `/recipes?brews=s${s.recipes.bbsKey}`,
        act: async (page: Page, s: Seed) => {
          await expect(rows(page)).toHaveCount(10);
          await expect(page.getByRole('link', { name: 'Latest' })).toHaveAttribute('aria-current', 'true');
          await expect(page.getByRole('link', { name: 'Top rated' })).toHaveAttribute('href', `?brews=s${s.recipes.bbsKey}&order=top`);
          for (const r of await rows(page).all()) {
            await expect(r.locator('svg[role="img"]')).toBeVisible();
            await expect(r).toContainText('bloom');
            await expect(r).not.toContainText('looks like');
          }
          expect(new URL(page.url()).search).toBe(`?brews=s${s.recipes.bbsKey}`);
        }
      },
      {
        // Top rated: 10 rows, rating never rises down the list; the toggle keeps brews=.
        name: 'recipes-see-brews-top', viewports: 'two' as const,
        path: (s: Seed) => `/recipes?brews=s${s.recipes.bbsKey}&order=top`,
        act: async (page: Page, s: Seed) => {
          await expect(rows(page)).toHaveCount(10);
          await expect(page.getByRole('link', { name: 'Top rated' })).toHaveAttribute('aria-current', 'true');
          await expect(page.getByRole('link', { name: 'Latest' })).toHaveAttribute('href', `?brews=s${s.recipes.bbsKey}`);
          const ratings = (await rows(page).locator('.brew-head span:nth-child(3)').allInnerTexts()).map((t) => Number(t) || 0); // "unrated" counts as 0
          expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
          expect(ratings[0]).toBeGreaterThan(ratings[9]);
        }
      },
      {
        // A key that is not shown as a group (here the dismissed bbf structure) still opens, in its own panel.
        name: 'recipes-unlisted-key', viewports: 'two' as const,
        path: (s: Seed) => `/recipes?brews=s${s.recipes.bbfKey}`,
        act: async (page: Page) => {
          const open = panel(page, 'Found in your brews').locator('li.item.open');
          await expect(open).toHaveCount(1);
          await expect(open).toContainText('1 brew');
          await expect(open).toContainText('total');
          await expect(rows(page)).toHaveCount(1);
          await expect(open.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '?');
        }
      },
      {
        name: 'recipes-see-recipe-brews', viewports: 'two' as const,
        path: (s: Seed) => `/recipes?brews=r${s.recipes.recipeId}`,
        act: async (page: Page) => {
          await expect(rows(page)).toHaveCount(3);
          for (const r of await rows(page).all()) await expect(r).toContainText('looks like Seed equal pours');
          // Open: the button reads Hide brews (expanded) and closes the list.
          const hide = page.getByRole('link', { name: 'Hide brews' });
          await expect(hide).toHaveAttribute('aria-expanded', 'true');
          await hide.click();
          await expect(rows(page)).toHaveCount(0);
          await expect(page.getByRole('link', { name: 'See brews' }).first()).toHaveAttribute('aria-expanded', 'false');
        }
      },
      {
        // Bloom bands: each timed bloom draws a band on the card chart, and on the brew rows.
        name: 'recipes-trigger-windows',
        path: (s: Seed) => `/recipes?brews=r${s.recipes.recipeId}`,
        act: async (page: Page, s: Seed) => {
          const chart = page.locator(`#recipe-${s.recipes.recipeId} .pour-timeline`).first();
          await expect(chart.locator('rect.window')).toHaveCount(1); // only pour 1 is a bloom; no striped part any more
          // Hovering a band says how long the bloom before it lasts.
          await chart.locator('rect.window').first().hover();
          const tip = page.getByText(/^First bloom \(\d:\d\d → \d:\d\d\)$/);
          await expect(tip).toBeVisible();
          // The tip follows the pointer across the band (further right, further right) and stays inside the viewport.
          const band = (await chart.locator('rect.window').first().boundingBox())!;
          const vw = page.viewportSize()!.width;
          const tipX = async () => (await tip.boundingBox())!.x;
          await page.mouse.move(band.x + band.width * 0.05, band.y + band.height / 2);
          await expect.poll(tipX).toBeGreaterThanOrEqual(0);
          const left = await tipX();
          await page.mouse.move(band.x + band.width * 0.95, band.y + band.height / 2);
          // A centred tip whose left edge would sit inside the page gutter is clamped there at both points (narrow
          // viewports, band near the left edge); otherwise it must move with the pointer.
          const tipW = (await tip.boundingBox())!.width;
          if (band.x + band.width * 0.95 - tipW / 2 > 24) await expect.poll(tipX).toBeGreaterThan(left + 2);
          else await expect.poll(tipX).toBeGreaterThanOrEqual(left);
          const t = (await tip.boundingBox())!;
          expect(t.x + t.width).toBeLessThanOrEqual(vw);
          // Escape closes it and further pointer moves over the band don't bring it back.
          await page.keyboard.press('Escape');
          await expect(tip).toBeHidden();
          await page.mouse.move(band.x + band.width * 0.5, band.y + band.height / 2);
          await page.mouse.move(band.x + band.width * 0.6, band.y + band.height / 2);
          await expect(tip).toBeHidden();
          await page.mouse.move(0, 0);
          await expect(tip).toHaveCount(0);
          // The level line inside the band has no tip of its own, so the band's shows through it.
          const hold = (await chart.locator('line.hold').first().boundingBox())!;
          await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
          await expect(tip).toBeVisible();
          await page.mouse.move(0, 0);
          // A pour mark and a swirl have their own.
          await chart.locator('polygon.seg').nth(2).hover();
          await expect(page.getByText(/^(Third|Second) (pour|bloom) \(/)).toBeVisible();
          await page.mouse.move(0, 0);
          await chart.locator('line.swirl').first().hover({ force: true });
          await expect(page.getByText(/^Swirl after /)).toBeVisible();
          await page.mouse.move(0, 0);
          await expect(page.getByRole('list', { name: 'Timeline legend' })).toContainText('First bloom');
          // Brew rows align with the recipe (same pour count), so they carry bands too.
          await expect(rows(page)).toHaveCount(3);
          for (const r of await rows(page).all()) {
            await expect(r.locator('.pour-timeline rect.window')).toHaveCount(1);
          }
        }
      },
      {
        name: 'recipes-by-name-path',
        path: () => '/recipes/seed-equal-pours',
        act: async (page: Page, s: Seed) => {
          const item = page.locator(`#recipe-${s.recipes.recipeId}`);
          await expect(item.getByRole('heading', { name: 'Seed equal pours' })).toBeVisible();
          await expect(item.getByRole('link', { name: 'Seed equal pours' })).toHaveAttribute('href', '/recipes/seed-equal-pours');
          await expect.poll(async () => (await item.boundingBox())!.y).toBeLessThan(140); // scrolled to the top (or already there)
          // The link preview names the recipe; no note text.
          await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Seed equal pours');
          await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /bloom[\s\S]*\n93°C · Rinse the filter\n\d+ brews? · avg/);
          await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/recipes\/seed-equal-pours$/);
          expect((await page.goto('/recipes/no-such-recipe'))!.status()).toBe(404);
        }
      },
      {
        name: 'recipes-hidden', viewports: 'two' as const,
        path: () => '/recipes?view=hidden',
        act: async (page: Page) => {
          await expect(page.getByRole('heading', { name: 'Hidden structures' })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Show again' })).toHaveCount(1);
          await expect(page.locator('li.item').first()).toContainText(/\d+ brews?/); // + " · Now matched by …" when a recipe took them over
        }
      },
      {
        name: 'recipes-bad-params', viewports: 'two' as const,
        path: () => '/recipes?brews=zzz&view=nope',
        act: async (page: Page) => {
          await expect(page.getByRole('heading', { name: 'Your recipes' })).toBeVisible();
          await expect(rows(page)).toHaveCount(0);
          await expect(page.getByRole('heading', { name: 'Hidden structures' })).toHaveCount(0);
        }
      },
      {
        // Name & save opens the form with the suggested name, nothing focused, nothing in the URL.
        name: 'recipes-name-save-open', viewports: 'two' as const,
        path: () => '/recipes',
        act: async (page: Page) => {
          const before = page.url();
          await panel(page, 'Found in your brews').locator('li.item').first().getByRole('button', { name: 'Name & save' }).click();
          await expect(page.getByLabel('Name', { exact: true })).toHaveValue('BBS');
          expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
          expect(page.url()).toBe(before);
        }
      },
      {
        // Edit on the bbs group opens the full editor: its 4 pours (2 blooms), add/remove/move, live preview, nothing focused or in the URL.
        name: 'recipes-edit',
        path: () => '/recipes',
        act: async (page: Page) => {
          const before = page.url();
          await panel(page, 'Found in your brews').locator('li.item').first().getByRole('button', { name: 'Edit', exact: true }).click();
          const pours = page.locator('fieldset.pour');
          await expect(pours).toHaveCount(4);
          await expect(pours.getByLabel('Bloom', { exact: true }).and(page.locator(':checked'))).toHaveCount(2);
          expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
          expect(page.url()).toBe(before);
          const desc = page.getByTestId('editor-description');
          await page.getByRole('button', { name: 'Add pour' }).click();
          await expect(pours).toHaveCount(5);
          await pours.nth(4).getByRole('button', { name: 'Remove' }).click();
          await expect(pours).toHaveCount(4);
          // Move up on pour 3 swaps rows 2 and 3 (their Speed values trade places).
          const speeds = () => pours.getByLabel('Speed').evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).value));
          const grams = () => pours.getByLabel('Grams').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
          const g0 = await grams();
          const s0 = await speeds();
          await pours.nth(2).getByRole('button', { name: 'Move up' }).click();
          const g1 = await grams();
          expect([g1[1], g1[2]]).toEqual([g0[2], g0[1]]);
          expect(await speeds()).toEqual([s0[0], s0[2], s0[1], s0[3]]);
          // Unit toggle round trip: % shows each pour's share of the water; typing 50 in pour 1 and going back to Grams
          // gives half the remembered total (the sum of the grams above).
          const total = g1.reduce((t, v) => t + Number(v), 0);
          await page.getByLabel('Pour amounts in').selectOption('%');
          await expect(pours.getByLabel('% of water')).toHaveCount(4);
          await expect(pours.getByLabel('Grams')).toHaveCount(0);
          const pct = pours.nth(0).getByLabel('% of water');
          await pct.focus();
          await page.keyboard.press('ControlOrMeta+a');
          await page.keyboard.type('50');
          await page.getByLabel('Pour amounts in').selectOption('g');
          await expect(pours.nth(0).getByLabel('Grams')).toHaveValue(String(+(total * 0.5).toFixed(1)));
          // Note tags' hint button adds no height: its input sits level with the Name input beside it (same row above 640px), and the hint is a named, 44px-tall tap target on phones.
          const [nameBox, tagsBox] = await Promise.all([page.getByLabel('Name', { exact: true }).boundingBox(), page.getByLabel('Note tags', { exact: true }).boundingBox()]);
          if ((page.viewportSize()?.width ?? 0) > 640) expect(Math.abs(nameBox!.y - tagsBox!.y)).toBeLessThanOrEqual(1);
          const hint = page.getByRole('button', { name: 'About note tags' });
          if ((page.viewportSize()?.width ?? 1000) <= 640) expect((await hint.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
          // Phone tap targets: icon buttons, selects and number inputs are at least 44 px tall.
          if ((page.viewportSize()?.width ?? 1000) <= 480) {
            for (const el of [pours.nth(0).getByRole('button', { name: 'Move down' }), pours.nth(0).getByRole('button', { name: 'Remove' }), pours.nth(0).getByLabel('Speed'), pours.nth(0).getByLabel('Grams'), page.locator('#re-temp'), page.locator('#re-ratio')])
              expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(43.9); // min-height 44px; sub-pixel layout can read 43.99997
          }
          // The ratio list by keyboard: type 15.5 and Enter adds it, and the description follows (Enter does not submit the form).
          const ratio = page.locator('#re-ratio');
          await ratio.focus();
          await page.keyboard.type('15.5');
          await page.keyboard.press('Enter');
          await expect(desc).toContainText('15.5');
          await expect(page.locator('form.editor')).toBeVisible();
          // Speed to Fast on the last pour changes the wording.
          const descBefore = await desc.textContent();
          await pours.nth(3).getByLabel('Speed').selectOption('fast');
          await expect(desc).not.toHaveText(descBefore!);
          expect(new URL(page.url()).search).toBe('');
        }
      },
      {
        // The default note words: two rows (High / Low selected), a Save action row.
        name: 'recipes-note-words',
        path: () => '/recipes',
        act: async (page: Page) => {
          const p = panel(page, 'Words in your notes');
          await expect(p.getByLabel('Word or phrase')).toHaveCount(2);
          await expect(p.getByLabel('Word or phrase').nth(0)).toHaveValue('high agitation');
          await expect(p.getByLabel('Agitation').nth(0)).toHaveValue('high');
          await expect(p.getByLabel('Word or phrase').nth(1)).toHaveValue('low agitation');
          await expect(p.getByLabel('Agitation').nth(1)).toHaveValue('low');
          await expect(p.locator('[data-button-row]')).toBeVisible();
          await expect(p.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
          { const v = page.viewportSize()!; if (v.width <= 640 || v.height <= 450)
            for (const el of [p.getByLabel('Word or phrase').first(), p.getByLabel('Agitation').first(), p.getByRole('button', { name: 'Remove' }).first()])
              expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44); }
        }
      },
      {
        // Add word appends an empty row without focusing it or touching the URL; Cancel appears and undoes it.
        name: 'recipes-note-words-add',
        path: () => '/recipes',
        act: async (page: Page) => {
          const before = page.url();
          const p = panel(page, 'Words in your notes');
          await p.getByRole('button', { name: 'Add word' }).click();
          await expect(p.getByLabel('Word or phrase')).toHaveCount(3);
          await expect(p.getByLabel('Word or phrase').nth(2)).toHaveValue('');
          expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
          expect(page.url()).toBe(before);
          await expect(p.getByRole('button', { name: 'Cancel' })).toBeVisible();
          await p.getByRole('button', { name: 'Cancel' }).click();
          await expect(p.getByLabel('Word or phrase')).toHaveCount(2);
          await p.getByRole('button', { name: 'Add word' }).click();
          await expect(p.getByLabel('Word or phrase')).toHaveCount(3);
        }
      },
      {
        // Length chips per step (the last reads Until drained), Custom's two number inputs, Water low, Equal shares hiding amounts,
        // the ratio list, the temperature help, nothing focused, and a too-small Up to rejected on Save.
        name: 'recipes-edit-lengths',
        path: () => '/recipes',
        act: async (page: Page) => {
          await panel(page, 'Found in your brews').locator('li.item').first().getByRole('button', { name: 'Edit', exact: true }).click();
          const pours = page.locator('fieldset.pour');
          await expect(pours).toHaveCount(4);
          expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
          await expect(pours.nth(0)).toContainText('Starts at 0:00');
          await expect(pours.nth(3).getByRole('radiogroup')).toHaveCount(0);
          await expect(pours.nth(3)).toContainText('Until drained');
          await expect(page.getByLabel('Bloom hold (s)')).toHaveCount(0);
          const group = page.getByRole('radiogroup', { name: 'Pour 1 length' });
          const names = ['Water low', '20s', '30s', '45s', '1m', 'Custom', 'Range'];
          for (const n of names) await expect(group.getByRole('radio', { name: n, exact: true })).toBeAttached();
          const labels = await group.locator('label.chip').allTextContents();
          expect(labels).toEqual(names); // the order of the sketch
          const steps = page.getByTestId('editor-steps');
          const box = async (l: import('@playwright/test').Locator) => (await l.boundingBox())!;
          const custom = group.getByLabel('Pour 1 custom length');
          const target = group.getByLabel('Pour 1 range from');
          const upTo = group.getByLabel('Pour 1 range up to');
          // The drafted 20s step loads as the 20s chip, with all three boxes empty.
          await expect(group.getByRole('radio', { name: '20s', exact: true })).toBeChecked();
          await expect(target).toHaveValue('');
          await expect(upTo).toHaveValue('');
          await expect(custom).toHaveValue('');
          // A chip selects alone; clicking it again keeps it selected (a step needs a length).
          await group.getByText('45s', { exact: true }).click();
          await expect(group.getByRole('radio', { name: '45s', exact: true })).toBeChecked();
          await expect(group.getByRole('radio', { name: 'Range', exact: true })).not.toBeChecked();
          await expect(steps).toContainText('0:45');
          await group.getByText('45s', { exact: true }).click();
          await expect(group.getByRole('radio', { name: '45s', exact: true })).toBeChecked();
          // Choosing Custom or Range puts the cursor in its box.
          await group.getByText('Custom', { exact: true }).click();
          await expect(custom).toBeFocused();
          await group.getByText('Range', { exact: true }).click();
          await expect(target).toBeFocused();
          await group.getByText('45s', { exact: true }).click();
          // Tight rows (desktop; phones keep 44px tap targets): the toggles sit close to the fields above and to each other.
          if (page.viewportSize()!.width > 1100) {
            const vgap = async (a: import('@playwright/test').Locator, b: import('@playwright/test').Locator) => {
              const [x, y] = [await box(a), await box(b)];
              return y.y - (x.y + x.height);
            };
            const toggles = page.locator('.toggles label');
            expect(await vgap(page.locator('#re-name'), toggles.nth(0)), 'fields to Pour speed').toBeLessThanOrEqual(12);
            expect(await vgap(toggles.nth(0), toggles.nth(1)), 'Pour speed to Equal shares').toBeLessThanOrEqual(2);
            expect(await vgap(toggles.nth(1), page.locator('fieldset.drippers')), 'Equal shares to Drippers').toBeLessThanOrEqual(12);
            const [fs, sw] = [await box(pours.nth(0)), await box(pours.nth(0).getByText('Swirl after'))];
            expect(fs.y + fs.height - (sw.y + sw.height), 'Swirl after to the step edge').toBeLessThanOrEqual(10);
          }
          // Custom: a valid value selects it; an invalid one shows the error and selects nothing.
          await custom.fill('1m30s');
          await expect(group.getByRole('radio', { name: 'Custom', exact: true })).toBeChecked();
          await expect(steps).toContainText('1:30');
          await group.getByText('30s', { exact: true }).click();
          // The message waits for the box to lose focus; typing never shows it. It clears as soon as the value is valid.
          const fmtMsg = pours.nth(0).getByText('A number + s or m; both as 1m30s', { exact: true });
          await custom.fill('');
          await custom.pressSequentially('abc');
          await expect(fmtMsg).toHaveCount(0);
          await custom.blur();
          await expect(fmtMsg).toBeVisible();
          await expect(group.getByRole('radio', { name: '30s', exact: true })).toBeChecked();
          // It reads small, in at most two lines, and (on the box's own row) inside the box's vertical span.
          const [mb, cb0] = [await box(fmtMsg), await box(custom)];
          const lh = await fmtMsg.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
          expect(mb.height, 'at most two lines').toBeLessThanOrEqual(2 * lh + 1);
          if (Math.abs(mb.y - cb0.y) < cb0.height) {
            expect(mb.y, 'message top inside the box span').toBeGreaterThanOrEqual(cb0.y - 1);
            expect(mb.y + mb.height, 'message bottom inside the box span').toBeLessThanOrEqual(cb0.y + cb0.height + 1);
          }
          expect(mb.x + mb.width, 'message inside the step').toBeLessThanOrEqual((await box(pours.nth(0))).x + (await box(pours.nth(0))).width + 0.5);
          await custom.focus();
          await custom.fill('2M');
          await expect(group.getByRole('radio', { name: 'Custom', exact: true })).toBeChecked();
          await expect(fmtMsg).toHaveCount(0);
          await expect(steps).toContainText('2:00');
          // The Custom box has its tip (a popover, not a bare title).
          await pours.nth(0).getByRole('button', { name: 'About custom length' }).click();
          await expect(page.locator('#re-ct-help0')).toContainText('1m30s');
          await page.keyboard.press('Escape');
          // Range: both boxes valid select it; a max below the target shows the error and does not.
          await group.getByText('Water low', { exact: true }).click();
          await target.fill('20');
          await upTo.fill('');
          await upTo.pressSequentially('10');
          await expect(pours.nth(0).getByText('Step length must be at least its target')).toHaveCount(0); // not while typing
          await upTo.blur();
          await expect(pours.nth(0).getByText('Step length must be at least its target')).toBeVisible();
          await expect(group.getByRole('radio', { name: 'Water low', exact: true })).toBeChecked();
          await upTo.fill('30');
          await expect(group.getByRole('radio', { name: 'Range', exact: true })).toBeChecked();
          await expect(steps).toContainText('0:20');
          await expect(steps).not.toContainText('(–');
          // Layout: each box sits level with its own button, whatever the row's wrapping, and nothing overflows the step.
          const level = async (a: import('@playwright/test').Locator, b: import('@playwright/test').Locator) => {
            const [x, y] = [await box(a), await box(b)];
            expect(Math.abs(x.y + x.height / 2 - (y.y + y.height / 2)), 'box level with its button').toBeLessThanOrEqual(1);
          };
          await level(custom, group.locator('label.chip', { hasText: 'Custom' }));
          await level(target, group.locator('label.chip', { hasText: 'Range' }));
          await level(upTo, group.locator('label.chip', { hasText: 'Range' }));
          const fieldset = await box(pours.nth(0));
          for (const l of [custom, target, upTo, ...(await group.locator('label.chip').all())]) {
            const b = await box(l);
            expect(b.x, 'inside the step, left').toBeGreaterThanOrEqual(fieldset.x - 0.5);
            expect(b.x + b.width, 'inside the step, right').toBeLessThanOrEqual(fieldset.x + fieldset.width + 0.5);
          }
          // Button widths: above 640px all seven match. On phones Water low (sized to its text) and the four presets are one row
          // that fills the width edge to edge, the presets a quarter of what is left each; Water low, Custom and Range match.
          const chipBoxes = [];
          for (const l of await group.locator('label.chip').all()) chipBoxes.push(await box(l));
          expect(chipBoxes.length).toBe(7);
          const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
          if (page.viewportSize()!.width > 640) {
            expect(spread(chipBoxes.map((b) => b.width)), 'seven buttons one width').toBeLessThanOrEqual(1);
          } else {
            const row = chipBoxes.slice(0, 5);
            const gb = await box(group);
            expect(spread(row.map((b) => b.y)), 'Water low and the presets share a row').toBeLessThanOrEqual(1);
            expect(spread(chipBoxes.slice(1, 5).map((b) => b.width)), 'presets one width').toBeLessThanOrEqual(1);
            expect(Math.abs(row[0].x - gb.x), 'row starts at the edge').toBeLessThanOrEqual(1);
            expect(Math.abs(row[4].x + row[4].width - (gb.x + gb.width)), 'row ends at the edge').toBeLessThanOrEqual(1);
            expect(spread([chipBoxes[0].width, chipBoxes[5].width, chipBoxes[6].width]), 'Water low, Custom and Range one width').toBeLessThanOrEqual(1);
          }
          // The Range boxes are as wide as the Custom box.
          const [cw0, tw, uw] = [await box(custom), await box(target), await box(upTo)];
          expect(Math.abs(tw.width - cw0.width), 'Range from = Custom box width').toBeLessThanOrEqual(1);
          expect(Math.abs(uw.width - cw0.width), 'Range up to = Custom box width').toBeLessThanOrEqual(1);
          // No horizontal overflow anywhere in the length row.
          expect(await group.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'length row does not overflow').toBe(true);
          // One height for the editor's controls: the name, tags and amounts fields, the buttons and the edit boxes.
          const hs = [];
          for (const l of [page.locator('#re-name'), page.locator('#re-tags'), page.locator('#re-unit'), custom, target, upTo, ...(await group.locator('label.chip').all())]) hs.push((await box(l)).height);
          expect(Math.max(...hs) - Math.min(...hs), `control heights ${hs.join(', ')}`).toBeLessThanOrEqual(1);
          // One gap: button to button equals button to its edit box, wherever they share a row.
          const gap = async (a: import('@playwright/test').Locator, b: import('@playwright/test').Locator) => {
            const [x, y] = [await box(a), await box(b)];
            return Math.abs(x.y - y.y) < 4 ? y.x - (x.x + x.width) : null;
          };
          const chip = (n: string) => group.locator('label.chip', { hasText: n }).first();
          const gaps = [await gap(chip('20s'), chip('30s')), await gap(chip('Custom'), custom), await gap(chip('Range'), target)].filter((g) => g != null) as number[];
          expect(gaps.length).toBeGreaterThanOrEqual(2);
          expect(Math.max(...gaps) - Math.min(...gaps), `gaps ${gaps.join(', ')}`).toBeLessThanOrEqual(1);
          // A cleared box of the selected Range leaves no length: Save says so.
          await upTo.fill('');
          await page.locator('form:has(#re-ratio)').getByRole('button', { name: 'Save', exact: true }).click();
          await expect(page.getByRole('alert')).toHaveText('Enter a step length');
          await upTo.fill('30');
          await group.getByText('Water low', { exact: true }).click();
          await expect(steps).toContainText('Low');
          // The flow-control note shows only for flow-controlling drippers (the seed has none; the text is unit-tested).
          await expect(page.getByTestId('flow-note')).toHaveCount(0);
          // Equal shares hides every amount input and the unit select.
          await expect(pours.getByLabel('Grams')).toHaveCount(4);
          await page.getByLabel('Equal shares').check();
          await expect(pours.getByLabel('Grams')).toHaveCount(0);
          await expect(pours.getByLabel('% of water')).toHaveCount(0);
          // The unit select stays, disabled and visibly so (not hidden).
          const unitSel = page.getByLabel('Pour amounts in');
          await expect(unitSel).toBeVisible();
          await expect(unitSel).toBeDisabled();
          expect(Number(await unitSel.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.9);
          await page.getByLabel('Equal shares').uncheck();
          await expect(unitSel).toBeEnabled();
          await expect(pours.getByLabel('Grams')).toHaveCount(4);
          // Ratio list: staged rows with an x, an input with a 1: prefix and Add.
          const rlist = page.locator('.ratios .rcell');
          const n0 = await rlist.count();
          expect(n0).toBeGreaterThanOrEqual(1);
          const rin = page.locator('#re-ratio');
          await rin.fill('17.5');
          await page.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(rlist).toHaveCount(n0 + 1);
          await expect(page.locator('.ratios .rrow')).toContainText('1:17.5');
          await rin.fill('17.5'); // a duplicate is ignored
          await rin.press('Enter');
          await expect(rlist).toHaveCount(n0 + 1);
          await expect(rin).toHaveValue('');
          // A bad value shows its message only after the box loses focus, and clears once valid.
          const rerr = page.getByText('Ratio must be between 1:5 and 1:30', { exact: true });
          await rin.pressSequentially('40');
          await expect(rerr).toHaveCount(0);
          await rin.blur();
          await expect(rerr).toBeVisible();
          await rin.fill('');
          await expect(rerr).toHaveCount(0);
          await rin.fill('3');
          await rin.press('Enter');
          await expect(rlist).toHaveCount(n0 + 1);
          await expect(rerr).toBeVisible();
          await rin.fill('');
          // Remove, down to the last one, whose x is disabled.
          await page.getByRole('button', { name: 'Remove 1:17.5' }).click();
          await expect(rlist).toHaveCount(n0);
          while ((await rlist.count()) > 1) await rlist.first().getByRole('button').click();
          await expect(rlist.first().getByRole('button')).toBeDisabled();
          await expect(rlist).toHaveCount(1);
          // At 5 ratios the input and Add are disabled (and unfocusable); hovering the pair says why; removing one re-enables both.
          const addButton = page.getByRole('button', { name: 'Add', exact: true });
          // Reached the way a user does (clicking in the box and on Add, the mouse left over the pair): the tip then follows the
          // hover in and out (clicks made before it had a tip must not pin it open).
          for (const v of ['7', '8', '9']) { await rin.click(); await rin.fill(v); await addButton.click(); }
          await expect(rlist).toHaveCount(4);
          await rin.click();
          await rin.fill('10');
          await addButton.click();
          await expect(rlist).toHaveCount(5);
          await expect(rin).toBeDisabled();
          await expect(addButton).toBeDisabled();
          // Fully inert at 5: nothing in the pair can be selected (a long press or drag on a phone, a double or triple click here).
          for (const el of ['.radd', '.radd input', '.radd .pre', '.radd button'])
            expect(await page.locator(el).first().evaluate((e) => getComputedStyle(e).userSelect), `${el} user-select`).toBe('none');
          const pairBox = await box(page.locator('.radd'));
          await page.mouse.dblclick(pairBox.x + 8, pairBox.y + pairBox.height / 2);
          await page.mouse.click(pairBox.x + 8, pairBox.y + pairBox.height / 2, { clickCount: 3 });
          expect(await page.evaluate(() => getSelection()!.toString()), 'nothing selected').toBe('');
          await page.mouse.move(2, 2);
          await page.mouse.click(2, 2);
          const fullTipText = page.getByText('Remove one to add another.', { exact: true });
          await page.mouse.move(2, 2);
          await expect(fullTipText).toHaveCount(0);
          await page.locator('.radd').hover();
          await expect(fullTipText).toBeVisible();
          await page.mouse.move(2, 2);
          await expect(fullTipText, 'hover out closes it').toHaveCount(0);
          await page.locator('.radd').hover();
          await expect(fullTipText).toBeVisible();
          await page.mouse.move(2, 2);
          await expect(fullTipText).toHaveCount(0);
          await page.getByRole('button', { name: 'Remove 1:10' }).click();
          await expect(rlist).toHaveCount(4);
          await expect(rin).toBeEnabled();
          await expect(addButton).toBeEnabled();
          while ((await rlist.count()) > 1) await rlist.last().getByRole('button').click();
          // The settings block sits on one grid: row 1 is min, max, Temperature, Ratio ± (equal widths and heights, one row top, or
          // two columns when wrapped); Ratios, then Notes, start at the first column's edge and run to the last column's; nothing
          // runs past the editor.
          const edit = await box(page.locator('form.editor'));
          const cols = [page.locator('#re-cmin'), page.locator('#re-cmax'), page.locator('#re-temp'), page.locator('#re-ratiotol')];
          const cb = [];
          for (const c of cols) cb.push(await box(c));
          expect(Math.max(...cb.map((b) => b.height)) - Math.min(...cb.map((b) => b.height))).toBeLessThanOrEqual(1);
          expect(Math.abs(cb[1].width - cb[0].width), 'equal column widths').toBeLessThanOrEqual(1);
          if (Math.abs(cb[0].y - cb[3].y) < 4) for (const b of cb) expect(Math.abs(b.y - cb[0].y)).toBeLessThanOrEqual(1);
          else expect(Math.abs(cb[0].x - cb[2].x), 'two columns share edges').toBeLessThanOrEqual(1);
          // Labels of fields sharing a row sit on one line (no wrapped label pushing its box down).
          const lab = async (id: string) => (await box(page.locator(`label[for=${id}]`))).y;
          expect(Math.abs((await lab('re-cmin')) - (await lab('re-cmax'))), 'min/max labels level').toBeLessThanOrEqual(1);
          expect(Math.abs((await lab('re-temp')) - (await lab('re-ratiotol'))), 'Temp/± labels level').toBeLessThanOrEqual(1);
          expect(Math.abs(cb[2].y - cb[3].y), 'Temp/± boxes level').toBeLessThanOrEqual(1);
          const ratiosB = await box(page.locator('.ratios'));
          const notesB = await box(page.locator('.notes'));
          const right = Math.max(...cb.map((b) => b.x + b.width));
          for (const [n, b] of [['Ratios', ratiosB], ['Notes', notesB]] as const) {
            expect(Math.abs(b.x - cb[0].x), `${n} left edge = first column`).toBeLessThanOrEqual(1);
            expect(Math.abs(b.x + b.width - right), `${n} right edge = last column`).toBeLessThanOrEqual(1);
          }
          expect(ratiosB.y, 'Ratios below the settings row').toBeGreaterThan(cb[3].y + cb[3].height - 1);
          expect(notesB.y, 'Notes below Ratios').toBeGreaterThan(ratiosB.y + ratiosB.height - 1);
          // The ratio cells, the 1: input and Add share one wrapping row (here a single cell: all on one line), at the control height.
          const cellB = await box(rlist.first());
          const addBtn = await box(page.getByRole('button', { name: 'Add', exact: true }));
          const addBox = await box(rin);
          for (const b of [addBox, addBtn]) expect(Math.abs(b.y + b.height / 2 - (cellB.y + cellB.height / 2)), 'cell, input and Add level').toBeLessThanOrEqual(1);
          expect(Math.max(cellB.height, addBox.height, addBtn.height) - Math.min(cellB.height, addBox.height, addBtn.height), 'one control height').toBeLessThanOrEqual(1);
          // The 1: prefix lives inside the input's box.
          const pre = await box(page.locator('.ratios .pre'));
          expect(pre.x).toBeGreaterThanOrEqual(addBox.x);
          expect(pre.x + pre.width).toBeLessThan(addBox.x + addBox.width);
          for (const b of [...cb, ratiosB, notesB, addBox, addBtn, cellB]) {
            expect(b.x + b.width, 'inside the editor').toBeLessThanOrEqual(edit.x + edit.width + 0.5);
            expect(b.x, 'inside the editor').toBeGreaterThanOrEqual(edit.x - 0.5);
          }
          // Temperature help.
          await page.getByRole('button', { name: 'About temperature' }).click();
          await expect(page.locator('#re-temp-help')).toContainText('±2°C');
          await page.keyboard.press('Escape');
          expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
          // A max below the target is rejected on Save.
          await group.getByText('Range', { exact: true }).click();
          await upTo.fill('10');
          await page.locator('form:has(#re-ratio)').getByRole('button', { name: 'Save', exact: true }).click();
          await expect(page.getByRole('alert')).toHaveText('Step length must be at least its target');
        }
      },
      {
        // Closing the editor (Cancel here; Save shares the handler but would write to the shared DB) puts the edited card back at the top,
        // below the sticky bars, however far down the form was scrolled.
        name: 'recipes-edit-close-scroll',
        path: () => '/recipes',
        act: async (page: Page) => {
          const card = panel(page, 'Found in your brews').locator('li.item').first();
          await card.getByRole('button', { name: 'Edit', exact: true }).click();
          const form = card.locator('form.editor');
          await form.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);
          await form.getByRole('button', { name: 'Cancel', exact: true }).click();
          await expect(form).toHaveCount(0);
          await expect.poll(async () => Math.round((await card.boundingBox())!.y), 'card top near the viewport top').toBeLessThanOrEqual(160);
          expect((await card.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
        }
      },
      {
        // Saving from /recipes/<slug> (the save response is mocked: nothing is written) lands the edited card at the top again: the
        // save follows to its slug with a goto, which must not reset the scroll to the page top.
        name: 'recipes-edit-save-scroll',
        path: () => '/recipes/seed-equal-pours',
        act: async (page: Page, s: Seed) => {
          const id = s.recipes.recipeId;
          const body = JSON.stringify({ type: 'success', status: 200, data: JSON.stringify([{ saved: 1, slug: 2 }, id, 'seed-equal-pours']) });
          await page.route('**/recipes/seed-equal-pours?/saveRecipe', (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
          const card = page.locator(`#recipe-${id}`);
          await card.getByRole('button', { name: 'Edit', exact: true }).click();
          const form = card.locator('form.editor');
          await form.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
          expect(await page.evaluate(() => scrollY), 'scrolled down the form').toBeGreaterThan(300);
          await form.getByRole('button', { name: 'Save', exact: true }).click();
          await expect(form).toHaveCount(0);
          await page.waitForTimeout(600); // the follow-up navigation settles
          await expect.poll(async () => Math.round((await card.boundingBox())!.y), 'card top near the viewport top after Save').toBeLessThanOrEqual(160);
          expect((await card.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
          await page.unroute('**/recipes/seed-equal-pours?/saveRecipe');
        }
      },
      {
        // A save the server rejects shows its exact message; the editor stays open and nothing is saved.
        name: 'recipes-edit-error', viewports: 'two' as const,
        path: () => '/recipes',
        act: async (page: Page) => {
          await panel(page, 'Found in your brews').locator('li.item').first().getByRole('button', { name: 'Edit', exact: true }).click();
          const group = page.getByRole('radiogroup', { name: 'Pour 1 length' });
          await group.getByText('Range', { exact: true }).click();
          await group.getByLabel('Pour 1 range from').fill('30');
          await group.getByLabel('Pour 1 range up to').fill('20');
          await page.getByLabel('Name', { exact: true }).fill('Should not save');
          await page.locator('form:has(#re-ratio)').getByRole('button', { name: 'Save', exact: true }).click();
          await expect(page.getByRole('alert')).toHaveText('Step length must be at least its target');
          await expect(page.locator('fieldset.pour')).toHaveCount(4);
          await expect(panel(page, 'Your recipes').locator('li.item')).toHaveCount(3);
          await expect(panel(page, 'Your recipes')).not.toContainText('Should not save');
        }
      }
    ];
  })(),
  {
    // On /recipes the Recipes nav item is current, between Stats and Water (desktop nav, phone More panel).
    name: 'recipes-nav', viewports: 'two',
    path: () => '/recipes',
    act: async (page) => {
      if (isPhone(page)) {
        await page.getByRole('button', { name: 'More' }).click();
        await expect(page.locator('.bottom-tabs-more-panel').getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
      } else {
        const links = page.locator('.nav-links > a');
        await expect(links.filter({ hasText: /^Recipes$/ })).toHaveAttribute('aria-current', 'page');
        const names = await links.allTextContents();
        expect(names.map((n) => n.trim()).slice(names.indexOf('Stats'), names.indexOf('Stats') + 3)).toEqual(['Stats', 'Recipes', 'Water']);
      }
    }
  },
  {
    // /recipes/<slug> is the Recipes page: its nav item stays current.
    name: 'recipes-nav-slug', viewports: 'two',
    path: () => '/recipes/seed-equal-pours',
    act: async (page) => {
      if (isPhone(page)) {
        await page.getByRole('button', { name: 'More' }).click();
        await expect(page.locator('.bottom-tabs-more-panel').getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page');
      } else {
        await expect(page.locator('.nav-links > a').filter({ hasText: /^Recipes$/ })).toHaveAttribute('aria-current', 'page');
      }
    }
  },
  // Clock times (footer, Account) show in the display zone: "browser time" renders UTC on a first visit (no tz cookie), then
  // the browser's zone after mount, with a clean console (no hydration warning).
  { name: 'display-zone-stamps', path: () => '/account',
    act: async (page) => {
      const bad: string[] = [];
      page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) bad.push(m.text()); });
      page.on('pageerror', (e) => bad.push(String(e)));
      await page.context().clearCookies({ name: 'tz' });
      await gotoReady(page, '/account');
      const foot = page.locator('.site-footer');
      await expect(foot).toContainText(/Last updated: \d{4}-\d\d-\d\d \d+:\d\d (AM|PM)/);
      await expect(page.getByText(/^Last updated: .*(AM|PM)/).first()).toBeVisible();
      const tz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === 'tz')?.value).toBe(tz);
      if (tz !== 'UTC') await expect(foot).not.toContainText('UTC');
      expect(bad.filter((t) => /hydrat|mismatch/i.test(t)), 'no hydration warning').toEqual([]);
    } },
  {
    // Footer line: one muted centered line that wraps cleanly (checkLayout covers overflow), links on one row.
    name: 'ai-footer',
    path: () => '/water',
    act: async (page) => {
      const foot = page.locator('.site-footer');
      await expect(foot).toContainText('Built with help from Claude Code, an AI coding assistant');
      await expect(foot.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', /^mailto:(eric@maydeck\.net|contact@fuhnoo\.coffee)$/);
      // One run of items: left-aligned, fixed order, joined by " · ".
      expect(await foot.evaluate((el) => getComputedStyle(el).textAlign)).not.toBe('center');
      const lines = (await foot.locator(':scope > div').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      expect(lines).toHaveLength(2);
      const stacked = page.viewportSize()!.width <= 640;
      // Phones stack one item per line with no separators (the links share a line, joined by one dot); wider screens run the items together.
      expect(lines[0]).toBe(stacked ? 'Built with help from Claude Code, an AI coding assistant How AI was used · Contact' : 'Built with help from Claude Code, an AI coding assistant · How AI was used · Contact');
      expect(lines[1]).toMatch(stacked ? /^v[\d.]+ Last updated: [^·]+ Last deployed: [^·]+$/ : /^v[\d.]+ · Last updated: .+ · Last deployed: [^·]+$/);
      const spans = foot.locator(':scope > div > span');
      const sizes = await foot.locator(':scope > div').evaluateAll((ds) => ds.map((d) => getComputedStyle(d).fontSize + getComputedStyle(d).color));
      expect(sizes[0], 'same size and colour on both lines').toBe(sizes[1]);
      const fb = (await foot.boundingBox())!;
      const firstX = await spans.first().evaluate((e) => e.getBoundingClientRect().x);
      expect(Math.abs(firstX - fb.x), 'first item at the content edge').toBeLessThan(1.5);
      // The dot trails its item, so no line starts with a separator.
      const lineStarts = await spans.evaluateAll((els) => {
        const out: string[] = [];
        let top = -1;
        for (const e of els) {
          const t = Math.round(e.getBoundingClientRect().top);
          if (Math.abs(t - top) > 2) out.push((e.textContent ?? '').trim()[0]);
          top = t;
        }
        return out;
      });
      for (const c of lineStarts) expect(c, 'a line never starts with a separator').not.toBe('·');
      if (page.viewportSize()!.width >= 1200) expect(lineStarts.length, 'one line each on a wide screen').toBe(2);
      if (stacked) {
        expect(lineStarts, 'sentence, links, version, updated, deployed').toHaveLength(5);
        const shown = await foot.locator('.d').evaluateAll((ds) => ds.filter((d) => getComputedStyle(d).display !== 'none').length);
        expect(shown, 'only the dot between the two links shows').toBe(1);
        const xs = await spans.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
        expect(new Set(xs).size, 'one left edge (the links share a line)').toBeLessThanOrEqual(2);
        expect(xs[0], 'at the content edge').toBe(Math.round(fb.x));
      }
    }
  },
  {
    // The dialog opens from the link and from ?about=ai; X top right, Close centered at the bottom, Esc closes, focus returns.
    name: 'ai-dialog',
    path: () => '/water',
    act: async (page) => {
      const dlg = page.locator('dialog.ai-dialog');
      const link = page.getByRole('link', { name: 'How AI was used' });
      await link.click();
      await expect(dlg).toBeVisible();
      expect(new URL(page.url()).searchParams.get('about')).toBe('ai');
      await expect(dlg.getByRole('heading', { name: 'How this site was built' })).toBeVisible();
      const box = async (l: Locator) => (await l.boundingBox())!;
      const [d, x, close] = [await box(dlg), await box(dlg.getByRole('button', { name: 'Close' }).first()), await box(dlg.locator('.ai-footer .button'))];
      expect(d.x + d.width - (x.x + x.width), 'X at the top right').toBeLessThan(20);
      expect(x.y - d.y, 'X at the top').toBeLessThan(20);
      expect(Math.abs(close.x + close.width / 2 - (d.x + d.width / 2)), 'Close centered').toBeLessThan(2);
      expect(d.y + d.height - (close.y + close.height), 'Close at the bottom').toBeLessThan(20);
      const vh = page.viewportSize()!.height;
      expect(d.y).toBeGreaterThanOrEqual(-1);
      expect(d.y + d.height, 'dialog inside the screen').toBeLessThanOrEqual(vh + 1);
      // Long copy scrolls inside the body, not the page.
      await expect(dlg.getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:/);
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
      expect(new URL(page.url()).searchParams.has('about')).toBe(false);
      await expect(link).toBeFocused();
      // X closes too.
      await link.click();
      await dlg.getByRole('button', { name: 'Close' }).first().click();
      await expect(dlg).toBeHidden();
    }
  },
  {
    name: 'ai-dialog-url',
    path: () => '/water?about=ai',
    act: async (page) => {
      await expect(page.locator('dialog.ai-dialog')).toBeVisible();
      await page.locator('.ai-footer .button').click();
      await expect(page.locator('dialog.ai-dialog')).toBeHidden();
      expect(page.url()).not.toContain('about=');
    }
  },
  {
    // The link keeps the page's params, and the dialog follows Back/Forward onto and off ?about=ai.
    name: 'ai-dialog-history',
    path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const link = page.getByRole('link', { name: 'How AI was used' });
      await expect(link).toHaveAttribute('href', /(^|[?&])status=all(&|$)/);
      await expect(link).toHaveAttribute('href', /[?&]about=ai$/);
      const dlg = page.locator('dialog.ai-dialog');
      await link.click();
      await expect(dlg).toBeVisible();
      // Leave through an in-app link (the open modal blocks real clicks).
      await page.evaluate(() => (document.querySelector('a[href="/stats"]') as HTMLElement).click());
      await expect(page).toHaveURL(/\/stats/);
      await expect(dlg).toBeHidden();
      await page.goBack();
      await expect(page).toHaveURL(/about=ai/);
      await expect(dlg).toBeVisible();
      await page.goForward();
      await expect(page).toHaveURL(/\/stats/);
      await expect(dlg).toBeHidden();
    }
  },
  {
    // Wide screens: Bean Conqueror + Household left, Recipes + Brew now + Time + Stats right; one column below 1100px. Checked in dark too.
    name: 'account-columns', path: () => '/account',
    act: async (page) => {
      const secs = await page.locator('.acct section').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom }; }));
      expect(secs).toHaveLength(6); // left: Bean Conqueror, Household; right: Recipes, Brew now, Time, Stats
      const [a, h, b, , , st] = secs, c = st;
      if (page.viewportSize()!.width >= 1100) {
        expect(b.x).toBeGreaterThan(a.right); // right column
        expect(Math.abs(c.x - b.x)).toBeLessThan(2);
        expect(Math.abs(h.x - a.x)).toBeLessThan(2);
        expect(h.y).toBeGreaterThan(a.bottom);
        expect(c.y).toBeGreaterThan(b.bottom);
        expect(Math.abs(a.y - b.y)).toBeLessThan(2);
        const left = h.bottom - a.y, right = c.bottom - b.y;
        expect(Math.min(left, right) / Math.max(left, right), 'columns end together').toBeGreaterThanOrEqual(0.6);
      } else {
        expect(Math.abs(b.x - a.x)).toBeLessThan(2); // single column
        expect(b.y).toBeGreaterThanOrEqual(a.bottom);
      }
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      await checkLayout(page);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
    }
  },
  {
    // Over the 20 MB body limit: stopped in the browser, with the reason.
    name: 'account-zip-too-big',
    path: () => '/account',
    act: async (page) => {
      const input = page.locator('input[name="file"]');
      await input.setInputFiles({ name: 'Beanconqueror.zip', mimeType: 'application/zip', buffer: Buffer.alloc(21 * 1024 * 1024) });
      expect(await input.evaluate((el: HTMLInputElement) => el.validationMessage)).toContain('Over 20 MB');
      const badge = page.locator('.bq-upload + .badge-urgent');
      await expect(badge).toContainText('Over 20 MB'); // visible, not just a greyed button
      const [bx, px] = await badge.evaluate((el) => {
        const sec = el.closest('section')!, cs = getComputedStyle(sec);
        return [el.getBoundingClientRect().right, sec.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)];
      });
      expect(bx, 'badge wraps inside its panel').toBeLessThanOrEqual(px);
      await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
      await expect(page.locator('.bq-file')).toHaveText('No file chosen');
      await input.setInputFiles({ name: 'Beanconqueror.zip', mimeType: 'application/zip', buffer: Buffer.alloc(1024) });
      await expect(page.locator('.bq-upload + .badge-urgent')).toHaveCount(0);
    }
  },
  {
    // Upload control: a roomy tonal "Choose export" + a disabled Import until a file is picked; no horizontal overflow.
    name: 'account-upload-empty',
    path: () => '/account',
    act: async (page) => {
      const choose = page.locator('.bq-choose');
      const go = page.getByRole('button', { name: 'Import', exact: true });
      await expect(go).toBeDisabled();
      for (const el of [choose, go]) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('input[name="file"]')).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  },
  {
    name: 'account-upload-picked',
    path: () => '/account',
    act: async (page) => {
      const go = page.getByRole('button', { name: 'Import', exact: true });
      const before = (await go.boundingBox())!;
      await page.locator('input[name="file"]').setInputFiles('tests/ui/fixtures/bq-tiny.zip');
      await expect(page.locator('.bq-file')).toHaveText('bq-tiny.zip');
      await expect(go).toBeEnabled();
      const after = (await go.boundingBox())!;
      expect(Math.abs(after.width - before.width) + Math.abs(after.height - before.height)).toBeLessThan(1);
      // Wide rows: the name takes the free width and Import sits at the row's right end; a very long name ellipsizes and Import stays put.
      const long = 'Beanconqueror-export-with-a-really-quite-long-file-name-for-testing-the-ellipsis-behaviour-1234567890.zip';
      await page.locator('input[name="file"]').setInputFiles({ name: long, mimeType: 'application/zip', buffer: Buffer.from('x') });
      await expect(page.locator('.bq-file')).toHaveText(long);
      const long2 = (await go.boundingBox())!;
      const form = (await page.locator('.bq-upload').boundingBox())!;
      // (stacked below 600px: a long name wraps there and Import moves down with it, as before)
      if ((await page.locator('.bq-upload').evaluate((el) => getComputedStyle(el).flexDirection)) === 'row') {
        expect(Math.abs(long2.x - after.x) + Math.abs(long2.y - after.y) + Math.abs(long2.width - after.width)).toBeLessThan(1);
        expect(form.x + form.width - (long2.x + long2.width), 'Import at the right end').toBeLessThan(2);
      }
      await checkLayout(page);
    }
  },
  {
    // A file the server rejects: the error shows, the picked name stays and Import is enabled for a retry.
    name: 'account-upload-error-retry', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      await page.locator('input[name="file"]').setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
      const go = page.getByRole('button', { name: 'Import', exact: true });
      await go.click();
      await expect(page.locator('.badge-urgent')).toContainText('Could not read that file as a .zip');
      await expect(page.locator('.bq-file')).toHaveText('broken.zip');
      await expect(go).toBeEnabled();
    }
  },
  {
    // The summary names what changed and links to the stats and the untracked list. Stubbed (layout states never import).
    name: 'account-upload-summary', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      await stubImport(page);
      await page.locator('input[name="file"]').setInputFiles('tests/ui/fixtures/bq-tiny.zip');
      await page.getByRole('button', { name: 'Import', exact: true }).click();
      const res = page.locator('.bq-result');
      await expect(res).toBeVisible();
      await expect(res).toContainText('1 new water');
      await expect(res.getByRole('link', { name: 'See your stats' })).toHaveAttribute('href', '/stats');
      await expect(res.getByRole('link', { name: 'Review untracked beans' })).toHaveAttribute('href', '#not-tracked');
      await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled(); // form reset
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      await checkLayout(page);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
      await checkLayout(page);
    }
  },
  {
    // After the over-20 MB message, the next (good) file imports on the first try (user, 2026-11-04: the form reset).
    // The import itself is stubbed; the real round-trip is in save.spec.ts.
    name: 'account-upload-after-too-big', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      await stubImport(page);
      // Real picker round-trips with an on-disk sparse file (not committed): the way a phone picks.
      const big = join(tmpdir(), `bq-big-${process.pid}-${isPhone(page) ? 'p' : 'd'}.zip`);
      await truncate(big, 25 * 1024 * 1024).catch(async () => { await writeFile(big, ''); await truncate(big, 25 * 1024 * 1024); });
      try {
        const pick = async (file: string) => {
          const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.bq-choose').click()]);
          await fc.setFiles(file);
        };
        await pick(big);
        await expect(page.locator('.bq-upload + .badge-urgent')).toBeVisible();
        await pick('tests/ui/fixtures/bq-tiny.zip');
        await expect(page.locator('.bq-upload + .badge-urgent')).toHaveCount(0);
        await expect(page.locator('.bq-file')).toHaveText('bq-tiny.zip');
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(page.locator('.bq-result')).toBeVisible();
      } finally { await rm(big, { force: true }); }
    }
  },
  {
    // Add then remove a dose (a different one per viewport: both run against one DB): each shows a status toast.
    name: 'account-toasts', viewports: 'two',
    path: () => '/account',
    act: async (page) => {
      const dose = isPhone(page) ? '31' : '32';
      // The Undo tap target is at least 44 px on phones (rule 4).
      const add = async () => {
        await page.getByLabel('New dose in grams').fill(dose);
        await page.getByRole('button', { name: 'Add', exact: true }).first().click();
        await expect(page.getByRole('status').filter({ hasText: `Added ${dose}g.` })).toBeVisible();
      };
      // Undo reverses the add and says so.
      await add();
      const undo = page.getByRole('status').filter({ hasText: `Added ${dose}g.` }).getByRole('button', { name: 'Undo' });
      const ub = (await undo.boundingBox())!;
      if (isPhone(page)) expect(Math.min(ub.width, ub.height)).toBeGreaterThanOrEqual(44);
      await undo.click();
      await expect(page.getByRole('status').filter({ hasText: 'Undone.' })).toBeVisible();
      await expect(page.getByRole('button', { name: `Remove ${dose}g` })).toHaveCount(0);
      // Toasts stack: newer below older, none replaced.
      await add();
      await page.getByRole('button', { name: `Remove ${dose}g` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
      const [added, removed] = [page.getByRole('status').filter({ hasText: `Added ${dose}g.` }), page.getByRole('status').filter({ hasText: `Removed ${dose}g.` })];
      await expect(removed).toBeVisible();
      await expect(added).toBeVisible();
      expect((await removed.boundingBox())!.y).toBeGreaterThan((await added.boundingBox())!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  },
  {
    // Desktop: the nav link; phone: the More panel. Each lands on /account.
    name: 'account-nav', viewports: 'two',
    path: () => '/coffees',
    act: async (page) => {
      if (isPhone(page)) {
        await page.getByRole('button', { name: 'More' }).click();
        await page.locator('.bottom-tabs-more-panel').getByRole('link', { name: 'Account' }).click();
      } else {
        await page.locator('.nav-links').getByRole('link', { name: 'Account' }).click();
      }
      await expect(page).toHaveURL(/\/account$/);
    }
  },
  {
    // One page width site-wide: the nav links and main share left/right edges on every page, at 1280 and 1920.
    name: 'page-width-consistent', path: () => '/coffees',
    act: async (page) => {
      const edges = () => page.evaluate(() => {
        const r = (e: Element | null) => { const b = e!.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
        return { nav: r(document.querySelector('nav.site-nav .nav-links')), main: r(document.querySelector('main.container')), footer: r(document.querySelector('.site-footer')) };
      });
      const size = page.viewportSize()!;
      for (const width of size.width >= 1280 ? [size.width, 1920] : [size.width]) {
        await page.setViewportSize({ width, height: size.height });
        const seen = [];
        for (const path of ['/coffees', '/stats', '/recipes']) { await gotoReady(page, path); seen.push(await edges()); }
        expect(seen[1], `insights at ${width}`).toEqual(seen[0]);
        expect(seen[2], `recipes at ${width}`).toEqual(seen[0]);
      }
      await page.setViewportSize(size);
      await gotoReady(page, '/coffees');
    }
  },
  // The old /insights URL redirects to /stats with its query; the hash is the browser's and survives.
  { name: 'insights-redirect', path: () => '/insights?tab=leaderboards&rank=grams#leaderboard-origins',
    act: async (page) => {
      const u = new URL(page.url());
      expect(u.pathname + u.search + u.hash).toBe('/stats?tab=leaderboards&rank=grams#leaderboard-origins');
    } },
  { name: 'insights-sticky', path: () => '/stats?range=1w&compare=1', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-default', viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      await expect(page.locator('.chart-panel h2', { hasText: 'Right now' })).toBeVisible();
      // Totals and Averages tiles, with the roasters / bag size / brew temp ones; the last-updated line sits in the period line.
      const labels = (title: string) =>
        page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: title }) }).locator('.stat-item .stat-label');
      await expect(labels('Totals')).toHaveCount(6);
      await expect(labels('Averages')).toHaveCount(8);
      await expect(labels('Totals').filter({ hasText: 'Roasters' })).toHaveCount(1);
      await expect(labels('Averages').filter({ hasText: /Avg bag size/i })).toHaveCount(1);
      await expect(labels('Averages').filter({ hasText: /Avg brew temp/i })).toHaveCount(1);
      await expect(page.locator('.insights-period [data-last-updated]')).toContainText(/^Last updated: \S/);
      // Every click-for-explanation trigger ends with its circled ?.
      expect(await page.locator('.mode-tip-button').count()).toBeGreaterThan(0);
      expect(await page.locator('.mode-tip-button').evaluateAll((bs) => bs.filter((b) => !b.querySelector('svg.icon')).length)).toBe(0);
      // Totals values are the same color as the Averages' (they were the old Stats hero brown until round 2).
      const color = (title: string) =>
        page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: title }) })
          .locator('.stat-value').first().evaluate((e) => getComputedStyle(e).color);
      expect(await color('Totals')).toBe(await color('Averages'));
      // Background and border match too.
      const box = (title: string) =>
        page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: title }) })
          .locator('.stat-item').first().evaluate((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).borderColor);
      expect(await box('Totals')).toBe(await box('Averages'));
    }
  },
  // Right now tiles link to the /coffees list they count, under the page-wide Coffees filter.
  {
    name: 'insights-right-now-links',
    path: () => '/stats?process=Washed&caffeine=decaf',
    act: async (page) => {
      const links = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Right now' }) }).locator('.tile-link');
      await expect(links).toHaveCount(8);
      const texts = await links.allTextContents();
      expect(texts.filter((x) => x === 'See coffees')).toHaveLength(6);
      expect(texts.filter((x) => x === 'See all finished coffees')).toHaveLength(2);
      const onHand = new URL((await links.nth(2).getAttribute('href'))!, 'http://x').searchParams;
      expect(onHand.getAll('status')).toEqual(['backlog', 'open']);
      expect(onHand.getAll('processing').length).toBeGreaterThan(0);
      expect(onHand.get('decaf')).toBe('true');
      await expectLinksInTiles(page, links);
    }
  },
  { name: 'insights-right-now-links-compare', path: () => '/stats?range=1w&compare=1',
    act: async (page) => {
      const links = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Right now' }) }).locator('.tile-link');
      await expect(links).toHaveCount(8);
      await expectLinksInTiles(page, links);
    } },
  {
    name: 'insights-right-now-link-lands', viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      const tile = page.locator('#overview-on-hand');
      const value = (await tile.locator('.stat-value').innerText()).replace(/,/g, '').trim();
      await tile.locator('.tile-link').click();
      await expect(page).toHaveURL(/\/coffees\?/);
      for (const n of ['Backlog', 'Open']) await expect(page.getByRole('button', { name: n }).first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Archive' }).first()).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByText(/^\d+ coffees? ·/)).toHaveText(new RegExp(`^${value} coffees? ·`));
    }
  },
  {
    name: 'insights-habits', viewports: 'two',
    path: () => '/stats?tab=habits',
    act: async (page) => {
      await expect(page.locator('.insights-charts canvas')).toHaveCount(2);
      await expect(page.locator('.heatmap .heat-cell')).toHaveCount(7 * 24);
      await page.locator('.brew-calendar .cal-cell').last().click();
      await expectDataTip(page.locator('.cell-tip'));
    }
  },
  // Spend: seven tiles; the Spent ? tip says the date rule. Later panels extend insights-spend-empty and add their own states.
  {
    name: 'insights-spend', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      await expect(page.locator('.stat-item .stat-label')).toHaveText(
        ['Spent', 'Bags bought', 'Avg $/g', 'Avg bag cost', 'New roasters', 'Subscription share', 'Plans per month'], { useInnerText: true, ignoreCase: true }
      );
      await expect(page.locator('#spend-plans-per-month .stat-unit')).toHaveText('this month');
      // Phone tiles: 3 across like Consumption's (2 across made them 229px squares).
      if ((page.viewportSize()?.width ?? 1000) <= 520) for (const t of await page.locator('.stat-item').all()) expect((await t.boundingBox())!.height).toBeLessThan(180);
      await page.getByRole('button', { name: 'About Spent' }).click();
      await expectTipInView(page, page.locator('.mode-tip:popover-open'));
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Counted by roast date');
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-spend-compare', viewports: 'two', path: () => '/stats?tab=spend&range=1m&compare=1',
    act: async (page) => {
      await expect(page.locator('#spend-spent .insights-delta')).toBeVisible();
      await expect(page.locator('#spend-plans-per-month .insights-delta')).toHaveCount(0);
      // A value's tip (the exact cents) and a change line keep the arrow; a "No change" line has no tip at all.
      for (const e of await page.locator('#spend-spent .text-tip, #spend-spent .insights-delta').all()) expect(await e.evaluate((n) => getComputedStyle(n).cursor)).toBe('default');
      for (const e of await page.locator('.stat-item .insights-delta', { hasText: 'No change' }).all()) expect(await e.evaluate((n) => n.style.cursor)).toBe('');
      // The free-bag caption stays under the $/g delta.
      await expect(page.locator('#spend-avg-ppg')).toContainText(/\d+ free bags? not in \$\/g/);
      await expectDeltasFit(page);
    }
  },
  {
    name: 'insights-spend-empty', viewports: 'two', path: () => '/stats?tab=spend&range=2000-01-01..2000-01-31',
    act: async (page) => {
      await expect(page.locator('section.chart-panel:has(.hl-empty)')).toHaveCount(1);
      await expect(page.locator('canvas')).toHaveCount(0);
      // No blank chart frame: the Spend over time panel is not rendered at all.
      await expect(page.locator('#spend-chart, .chart-container, #spend-value-map, #spend-best-value, #spend-report-card, #spend-discovery, #spend-share, #spend-subscriptions, .value-map svg.plot')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
      await expectShortEmpty(page);
    }
  },
  {
    name: 'insights-spend-chart', viewports: 'two', path: () => '/stats?tab=spend&range=12m&compare=1',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#spend-chart)');
      const toggle = (name: string) => panel.getByRole('group', { name: 'Show' }).getByRole('button', { name, exact: true });
      await expect(panel.locator('canvas')).toHaveCount(1);
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      await toggle('$ per g').click();
      await expect(page).toHaveURL(/spendView=ppg/);
      await expect(toggle('$ per g')).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('canvas')).toHaveCount(1);
      await toggle('Spend').click();
      await expect(page).not.toHaveURL(/spendView/);
      expect(fetched).toEqual([]);
      await expect(panel.getByRole('link', { name: 'Leaderboards' })).toHaveAttribute('href', /tab=leaderboards.*rank=spend.*#leaderboard-roasters/);
      // A bar's tip (the sweep of insights-consumption-compare-tooltip).
      const c = panel.locator('canvas');
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const sweep: (readonly [number, number])[] = [];
      for (const g of [0.75, 0.6, 0.45]) for (let f = 0.95; f > 0; f -= 0.05) sweep.push([b.x + b.width * f, b.y + b.height * g]);
      for (const [x, y] of [...(await chartPoints(c, false)).slice(0, 12), ...sweep]) {
        await page.mouse.move(x, y);
        if (await tip.waitFor({ timeout: 100 }).then(() => true, () => false)) break;
      }
      await expectDataTip(tip);
      await expectTipInView(page, tip);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-spend-series', viewports: 'two', path: () => '/stats?tab=spend&range=3m&compare=1',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#spend-chart)');
      const pick = panel.getByRole('combobox', { name: 'Series' });
      await panel.scrollIntoViewIfNeeded();
      await expect(pick).toHaveValue('split');
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      for (const [v, url] of [['oneoff', /spendSeries=oneoff/], ['all', /spendSeries=all/], ['overall', /spendSeries=overall/], ['sub', /spendSeries=sub/]] as const) {
        await pick.selectOption(v);
        await expect(page).toHaveURL(url);
        await expect(panel.locator('canvas')).toHaveCount(1);
      }
      // Hover anywhere in the plot (touch: tap): the tip groups by period, a date header over each period's rows.
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const c = panel.locator('canvas');
      const poke = async (fx: number, fy: number) => {
        const b = (await c.boundingBox())!;
        if (touch()) await page.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy); else await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
      };
      await pick.selectOption('all');
      await expect(page).toHaveURL(/spendSeries=all/);
      await c.scrollIntoViewIfNeeded();
      for (const [x, y] of (await chartPoints(c, false)).slice(0, 12)) { if (touch()) await page.touchscreen.tap(x, y); else await page.mouse.move(x, y); if (await tip.waitFor({ timeout: 300 }).then(() => true, () => false)) break; } // a bar
      await expect(tip.locator('.tip-group').nth(0)).toContainText('(current period)');
      await expect(tip.locator('.tip-group').nth(1)).toContainText(/\(\d+ months? prior\)/); // an offset, not "previous 3 months"
      expect(await tip.locator('.tip-mark').count()).toBeGreaterThanOrEqual(4); // a swatch before every series row
      await expect(tip.locator('.tip-rows').first()).toContainText('Total'); // All: the overall total beside the split
      await panel.getByRole('group', { name: 'Show' }).getByRole('button', { name: '$ per g' }).click();
      await expect(page).toHaveURL(/spendView=ppg/);
      await c.scrollIntoViewIfNeeded();
      for (const [fx, fy] of [[0.5, 0.2], [0.45, 0.1], [0.6, 0.15], [0.7, 0.1]]) { await poke(fx, fy); if (await tip.waitFor({ timeout: 300 }).then(() => true, () => false)) break; }
      await expect(tip.locator('.tip-group')).toHaveCount(2); // the nearest x anywhere, not only on a line
      await expect(tip.locator('.tip-mark.line.dashed').first()).toBeVisible(); // the previous period's rows have a dashed sample
      for (const v of await tip.locator('.tip-rows dd').allInnerTexts()) expect(v).toMatch(/^(\$\d[\d,]*\.\d\d\/g|No data)$/); // to the cent, never $0.00/g for a missing bucket
      await pick.selectOption('split');
      await expect(page).not.toHaveURL(/spendSeries/);
      expect(fetched).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
  },
  {
    name: 'insights-spend-value-map', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const svg = page.locator('.value-map svg.plot');
      await svg.scrollIntoViewIfNeeded();
      await expect(svg).toBeVisible();
      const box = (await svg.boundingBox())!;
      const pts = await page.locator('.value-map .pt .mark').evaluateAll((ms) => ms.map((m) => m.getBoundingClientRect()));
      expect(pts.length).toBeGreaterThan(0);
      for (const r of pts) expect(r.x >= box.x - 1 && r.x + r.width <= box.x + box.width + 1 && r.y >= box.y - 1 && r.y + r.height <= box.y + box.height + 1).toBe(true);
      expect(await page.locator('[data-section="spend-best-value"] .board-row').count()).toBeLessThanOrEqual(5);
      await expectColumnsFilled(page, '.insights-charts:has([data-section="spend-value-map"])');
      // The small-sample note: the shared wording, on one line at desktop, centered on the chip beside it.
      const note = page.locator('.value-map .chip-note');
      await expect(note).toContainText('Low confidence: under 3 bags or 10 rated brews (4 for one coffee).');
      const m = await note.evaluate((li) => {
        const tn = [...li.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())!;
        const rg = document.createRange();
        rg.selectNodeContents(tn);
        const t = rg.getBoundingClientRect(), c = li.querySelector('.sample-chip')!.getBoundingClientRect();
        return { lines: rg.getClientRects().length, dy: Math.abs((t.top + t.bottom) / 2 - (c.top + c.bottom) / 2), w: innerWidth };
      });
      if (m.w >= 1000) expect(m.lines).toBe(1);
      if (m.lines === 1) expect(m.dy).toBeLessThan(2);
    }
  },
  {
    name: 'insights-spend-value-map-tip', viewports: 'two', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const dot = page.locator('.value-map .pt .hit').first();
      await dot.scrollIntoViewIfNeeded();
      const tip = page.locator('.vm-tip').locator('xpath=ancestor::*[@popover]');
      if (touch()) await dot.tap(); else await dot.hover();
      await expect(tip).toBeVisible();
      await expectDataTip(tip);
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).not.toBeEmpty();
      // A click or tap pins the tip with the coffee's link (a click no longer navigates); Escape or a click elsewhere closes it.
      if (touch()) await expect(tip.getByRole('link', { name: 'Open coffee' })).toHaveAttribute('href', /\/coffees\//);
      else {
        // The hover tip has the link too, and stays open while the pointer crosses from the dot onto it.
        await expect(tip.getByRole('link', { name: 'Open coffee' })).toHaveAttribute('href', /\/coffees\//);
        const before = (await tip.boundingBox())!;
        const body = (await page.locator('.vm-tip').boundingBox())!;
        await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2, { steps: 6 });
        await page.waitForTimeout(300);
        await expect(tip).toBeVisible();
        const d = (await dot.boundingBox())!;
        await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 6 });
        await expect(tip).toBeVisible();
        const hovered = (await tip.boundingBox())!;
        const url = page.url();
        await dot.click();
        await expect(tip.getByRole('link', { name: 'Open coffee' })).toHaveAttribute('href', /\/coffees\//);
        expect(page.url()).toBe(url);
        // Pinning leaves the tip exactly where the hover put it.
        const pinned = (await tip.boundingBox())!;
        expect([pinned.x, pinned.y]).toEqual([hovered.x, hovered.y]);
      }
      await page.mouse.move(0, 0);
      await expect(tip.getByRole('link', { name: 'Open coffee' })).toBeVisible(); // pinned: leaving the dot keeps it
      await page.keyboard.press('Escape');
      await expect(tip).toBeHidden();
      if (touch()) await dot.tap(); else await dot.click();
      await expect(tip).toBeVisible();
      await page.locator('[data-section="spend-value-map"] .lab-head').click({ position: { x: 5, y: 5 } });
      await expect(tip).toBeHidden();
      // Keyboard: one tab stop, an arrow moves focus to another dot, Enter pins its tip with the link.
      const pts = page.locator('.value-map .pt');
      await pts.locator('xpath=self::*[@tabindex="0"]').focus();
      const first = await page.evaluate(() => document.activeElement?.getAttribute('data-i'));
      await page.keyboard.press('ArrowRight');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-i'))).not.toBe(first);
      await page.keyboard.press('Enter');
      await expect(tip.getByRole('link', { name: 'Open coffee' })).toBeVisible();
    }
  },
  {
    name: 'insights-spend-report-card', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const panel = page.locator('section[data-section="spend-report-card"]');
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole('heading', { name: 'Roaster report card' })).toBeVisible();
      const wide = ((await panel.locator('.rc').boundingBox())?.width ?? 0) >= 600; // what the container query measures
      await expect(panel.locator('table')).toBeVisible({ visible: wide });
      await expect(panel.locator('.rc-list')).toBeVisible({ visible: !wide });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await panel.locator(wide ? 'tbody tr' : '.rc-list li').count()).toBeLessThanOrEqual(10);
      await expect(panel.getByRole('link', { name: 'Leaderboards' })).toHaveAttribute('href', /tab=leaderboards.*rank=ppg/);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-spend-report-card-sort', viewports: 'two', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const panel = page.locator('section[data-section="spend-report-card"]');
      await panel.scrollIntoViewIfNeeded();
      const wide = ((await panel.locator('.rc').boundingBox())?.width ?? 0) >= 600; // what the container query measures
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      const rows = panel.locator(wide ? 'tbody tr' : '.rc-list li');
      const ppgs = async () => (await rows.evaluateAll((rs) => rs.map((r) => (r.textContent ?? '').match(/\$(\d+\.\d+)\/g/)?.[1] ?? null))).map((v) => (v === null ? null : Number(v)));
      const sorted = (xs: (number | null)[], dir: 1 | -1) => {
        const v = xs.filter((x): x is number => x !== null);
        return v.every((x, i) => i === 0 || (x - v[i - 1]) * dir >= 0) && xs.slice(v.length).every((x) => x === null) && xs.slice(0, v.length).every((x) => x !== null);
      };
      // Sorting reorders rows, never resizes a column: the header cells keep their widths across every sort.
      const widths = () => panel.locator('thead th').evaluateAll((hs) => hs.map((h) => Math.round(h.getBoundingClientRect().width)));
      const before = wide ? await widths() : [];
      if (wide) await panel.getByRole('button', { name: '$/g' }).click();
      else await panel.getByLabel('Sort by').selectOption('ppg');
      await expect(page).toHaveURL(/rcSort=ppg/);
      await expect(page).not.toHaveURL(/rcDir/);
      expect(sorted(await ppgs(), -1)).toBe(true);
      if (wide) {
        await expect(panel.locator('th[aria-sort="descending"]')).toContainText('$/g');
        await panel.getByRole('button', { name: '$/g' }).click();
      } else await panel.getByRole('group', { name: 'Direction' }).getByRole('button', { name: 'Asc' }).click();
      await expect(page).toHaveURL(/rcDir=asc/);
      expect(sorted(await ppgs(), 1)).toBe(true);
      if (wide) {
        expect(await widths()).toEqual(before);
        await panel.getByRole('button', { name: 'Rating' }).click();
        await expect(page).toHaveURL(/rcSort=rating/);
        expect(await widths()).toEqual(before);
        await panel.getByRole('button', { name: 'Roaster' }).click();
        await expect(page).toHaveURL(/rcSort=roaster/);
        expect(await widths()).toEqual(before);
      }
      // The seed has more than 10 roasters bought from in 12m.
      await panel.getByRole('button', { name: 'Show more' }).click();
      await expect(page).toHaveURL(/rcTop=20/);
      expect(fetched).toEqual([]);
    }
  },
  {
    name: 'insights-spend-discovery', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const disc = page.locator('section[data-section="spend-discovery"]');
      await disc.scrollIntoViewIfNeeded();
      await expect(disc.getByRole('heading', { name: 'Roaster discovery' })).toBeVisible();
      await expect(disc.locator('canvas')).toHaveCount(1);
      await expect(disc.locator('.repeat')).toContainText(/Repeat-buy rate \d+% · of \d+ roasters/);
      const share = page.locator('section[data-section="spend-share"]');
      await share.scrollIntoViewIfNeeded();
      await expect(share.getByRole('heading', { name: 'Share of spend' })).toBeVisible();
      await expect(share.getByRole('group', { name: /Share of spend by roaster/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    // Leaving for a shorter tab and coming back (or isolating a legend entry) never moves the page: the scroll stays where it was.
    name: 'insights-spend-scroll-return', viewports: 'two', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const share = page.locator('section[data-section="spend-share"]');
      await share.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const y0 = await page.evaluate(() => scrollY);
      const still = async () => expect(Math.abs((await page.evaluate(() => scrollY)) - y0)).toBeLessThanOrEqual(2);
      const legend = share.locator('.legend .leg');
      await legend.nth(1).click();
      await legend.nth(2).click();
      await legend.nth(2).click();
      await still();
      await page.getByLabel('View').selectOption('consumption'); // a much shorter page
      await expect(page).toHaveURL(/tab=consumption/);
      await expect(page.locator('section[data-section="consumption-time-to-open"]')).toBeVisible();
      await page.getByLabel('View').selectOption('spend');
      await expect(share).toBeVisible();
      await page.waitForTimeout(300);
      await still();
    }
  },
  {
    // The coffee page's Back is the browser's back: Insights returns with its URL and scroll; a direct visit falls back to /coffees.
    name: 'coffee-back-history', viewports: 'two', path: () => '/stats?tab=spend&range=12m&spendSeries=all',
    act: async (page) => {
      const best = page.locator('section[data-section="spend-best-value"]');
      await best.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const [url0, y0] = [page.url(), await page.evaluate(() => scrollY)];
      await best.locator('a[href^="/coffees/"]').first().click();
      await expect(page).toHaveURL(/\/coffees\/[^/?]+/);
      const coffee = page.url();
      const back = page.getByRole('link', { name: /Back$/ });
      await expect(back).toHaveText(/^\W*Back$/);
      await back.click();
      await expect(page).toHaveURL(url0);
      await expect(best).toBeVisible();
      await page.waitForTimeout(500);
      expect(Math.abs((await page.evaluate(() => scrollY)) - y0)).toBeLessThanOrEqual(2);
      // Opened directly: the link's own href, the collection.
      await page.goto(coffee);
      await page.getByRole('link', { name: /Back$/ }).click();
      await expect(page).toHaveURL(/\/coffees(\?.*)?$/);
    }
  },
  {
    // Compare with a window of another length draws one dashed average per drawn series, each in a real color, and the tip says so.
    name: 'insights-spend-compare-average', viewports: 'two', path: () => '/stats?tab=spend&range=3m&compare=before',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#spend-chart)');
      const c = panel.locator('canvas');
      await c.scrollIntoViewIfNeeded();
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      for (const [x, y] of (await chartPoints(c, false)).slice(0, 12)) { if (touch()) await page.touchscreen.tap(x, y); else await page.mouse.move(x, y); if (await tip.waitFor({ timeout: 300 }).then(() => true, () => false)) break; }
      await expect(tip.locator('.tip-group').nth(1)).toContainText(/average per/);
      const colors = await tip.locator('.tip-mark').evaluateAll((ms) => ms.map((m) => getComputedStyle(m).backgroundColor));
      expect(colors.length).toBeGreaterThanOrEqual(4); // two series, now and the average
      for (const col of colors) expect(col).not.toBe('rgba(0, 0, 0, 0)'); // a valid series color, not an unset variable
      await expect(tip.locator('dl.tip-rows').nth(1).locator('dd').first()).not.toHaveText('No data');
    }
  },
  {
    name: 'insights-spend-discovery-tip', viewports: 'two', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const seg = page.locator('section[data-section="spend-share"] .seg').first();
      await seg.scrollIntoViewIfNeeded();
      const tip = page.locator('[popover]:popover-open', { has: page.locator('.tip-title') });
      if (touch()) await seg.tap(); else await seg.hover();
      await expect(tip).toBeVisible();
      await expectDataTip(tip);
      await expectTipInView(page, tip);
      // A segment's tip gives dollars with the share: "$412.00 (18%)".
      await expect(tip.locator('.tip-rows dd').first()).toHaveText(/^\$[\d,.]+ \(\d+%\)$/);
      // Hovering a named roaster lists the month's named roasters (the hovered one bold); Other keeps its own breakdown.
      if (await tip.locator('.tip-rows dd.hl').count()) expect(await tip.locator('.tip-rows dd.hl').count()).toBe(1);
      // The legend isolates one roaster: aria-pressed, the others fade; the same entry again resets; another switches.
      const legend = page.locator('section[data-section="spend-share"] .legend .leg');
      const n = await legend.count();
      expect(n).toBeGreaterThan(1);
      // Alphabetical (case-insensitive), Other last; the tip never says "Others".
      const names = (await legend.allInnerTexts()).map((t) => t.trim());
      const named = names.filter((t) => t !== 'Other');
      expect(named).toEqual([...named].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      if (names.includes('Other')) expect(names.at(-1)).toBe('Other');
      await expect(tip).not.toContainText('Others');
      await expect(legend.first()).toHaveAttribute('aria-pressed', 'false');
      await legend.first().click();
      await expect(legend.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(legend.nth(1)).toHaveAttribute('aria-pressed', 'false');
      expect(await page.locator('section[data-section="spend-share"] .seg.faded').count()).toBeGreaterThan(0);
      await legend.nth(1).click();
      await expect(legend.first()).toHaveAttribute('aria-pressed', 'false');
      await expect(legend.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await legend.nth(1).click();
      await expect(legend.nth(1)).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('section[data-section="spend-share"] .seg.faded')).toHaveCount(0);
      expect(page.url()).not.toMatch(/iso|isolate/); // ephemeral: nothing in the URL
      // Roaster discovery: the nearest x's tip opens anywhere in the plot, not only on the line.
      const c = page.locator('section[data-section="spend-discovery"] canvas');
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      const near = page.locator('.chart-container .cell-tip:popover-open');
      const [x, y] = [b.x + b.width * 0.5, b.y + b.height * 0.12]; // well above the rising line
      if (touch()) await page.touchscreen.tap(x, y); else await page.mouse.move(x, y);
      await expect(near).toBeVisible();
      await expectDataTip(near);
      // The label says it: "Roasters 48", no unit after the count; the plot keeps the arrow.
      await expect(near.locator('.tip-rows dd').first()).toHaveText(/^\d+$/);
      if (!touch()) expect(await c.evaluate((n) => (n as HTMLElement).style.cursor)).not.toBe('help');
    }
  },
  {
    // A plan's bag count links to its /coffees list: every status, roast dates in the Period; the list has that many bags.
    name: 'insights-spend-subscription-link', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const panel = page.locator('section[data-section="spend-subscriptions"]');
      const row = panel.locator('li:not(.total)', { hasText: /^Sey/ });
      const link = row.locator('a.bags');
      const n = Number((await link.innerText()).match(/\d+/)![0]);
      expect(n).toBeGreaterThan(0);
      await expect(link).toHaveAttribute('href', /^\/coffees\?(?=.*status=all)(?=.*subscription=\d+)(?=.*roast_date=between)/);
      // A plan with no bags has no link, and the total row isn't one.
      await expect(panel.locator('li:not(.total) span.bags')).not.toHaveCount(0);
      await expect(panel.locator('li.total a')).toHaveCount(0);
      await link.click();
      await expect(page).toHaveURL(/\/coffees\?/);
      await expect(page.locator('.filter-chip-label').first()).toBeVisible();
      await expect(page.getByText(/^\d+ coffees?/).first()).toHaveText(new RegExp(`^${n} coffee${n === 1 ? '' : 's'}`));
    }
  },
  {
    name: 'insights-spend-subscriptions', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const panel = page.locator('section[data-section="spend-subscriptions"]');
      await panel.scrollIntoViewIfNeeded();
      expect(await panel.locator('li:not(.total)').count()).toBeGreaterThanOrEqual(3);
      await expect(panel.locator('li.total')).toBeVisible();
      await expect(panel.locator('.badge', { hasText: 'Paused' })).toHaveCount(1);
      expect(await panel.locator('.bar').count()).toBeGreaterThan(0);
      expect(await panel.locator('.ref').count()).toBeGreaterThan(0);
      // A paused plan with no bags shows its price only.
      await expect(panel.locator('li', { hasText: 'Paused' }).locator('.track')).toHaveCount(0);
      // Badges and figures never wrap; the page never scrolls sideways.
      for (const el of await panel.locator('.badge, .money, .bags').all()) {
        const h = await el.evaluate((n) => ({ h: n.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(n).lineHeight) || 20 }));
        expect(h.h).toBeLessThan(h.lh * 2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(panel.getByRole('link', { name: 'Manage plans' })).toHaveAttribute('href', /\/subscriptions/);
      // "vs" is a word of its own: "$0.12/g vs $0.17/g one-off", never "$0.12/gvs".
      const text = await panel.innerText();
      expect(text).toMatch(/\d\/g vs \$\d/);
      // Full wording wide; a portrait phone (<= 520px) gets "Cost: $0.12/g vs $0.17/g one-off (−$0.05)", one line each.
      const narrow = await page.evaluate(() => innerWidth <= 520);
      expect(text).toMatch(narrow ? /Cost: \$[\d.]+\/g vs \$[\d.]+\/g one-off \([−+]\$[\d.]+\)/ : /Cost comparison: \$[\d.]+\/g vs \$[\d.]+\/g one-off bags \(avg\) \([−+]\$[\d.]+\)/);
      // The seed has no rated brews of plan bags; where a rating line exists it has the same shape.
      if (text.includes('Rating')) expect(text).toMatch(narrow ? /Rating: [\d.]+ vs [\d.]+ one-off \([−+]?[\d.]+\)/ : /Rating comparison: [\d.]+ vs [\d.]+ one-off bags \(avg\) \([−+]?[\d.]+\)/);
      // No comparison line wraps on a phone: its height is one line.
      if (narrow) for (const l of await panel.locator('.vs .line').all()) {
        const h = await l.evaluate((n) => ({ h: n.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(n).lineHeight) || 20 }));
        expect(h.h).toBeLessThan(h.lh * 1.5);
      }
      // The plan's name carries its roaster ("Roaster · Plan name"), not the plan name alone.
      expect(await panel.locator('li:not(.total) .name').first().innerText()).toMatch(/\S/);
      expect(text).not.toMatch(/[\dg]vs /);
      // Every value in the comparison lines is bold (the figures, not the words).
      expect(await panel.locator('li:not(.total) .line strong').count()).toBeGreaterThanOrEqual(2);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-consumption-time-to-open', path: () => '/stats?tab=consumption&range=12m',
    act: async (page) => {
      const panel = page.locator('section[data-section="consumption-time-to-open"]');
      await panel.scrollIntoViewIfNeeded();
      await expect(panel.getByRole('heading', { name: 'Time to open' })).toBeVisible();
      // The first brew is the open day, so every bag with a brew counts: both figures and both lists are there.
      await expect(panel.locator('.fig')).toHaveCount(2);
      await expect(panel.locator('.fig-val').first()).toContainText(/\d+ days/);
      await expect(panel.locator('.list h3')).toHaveText(['By roaster', 'By process']);
      expect(await panel.locator('.list li').count()).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(page.locator('nav.board-jump').getByRole('link', { name: 'Time to open' })).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-brewing-wait', path: () => '/stats?tab=brewing&range=12m',
    act: async (page) => {
      const rest = page.locator('section[data-section="brewing-rest"]');
      const rate = page.locator('section[data-section="brewing-rating-by-wait"]');
      const win = page.locator('section[data-section="brewing-rest-window"]');
      await rate.scrollIntoViewIfNeeded();
      await expect(rate.locator('canvas')).toHaveCount(1);
      await expect(win.locator('.win li')).toHaveCount(3);
      await expect(win.locator('.chart-note', { hasText: /brews? without a rest window/ })).toBeVisible();
      // They sit right after the rest curve they belong with.
      const y = async (l: Locator) => (await l.boundingBox())!.y;
      expect(await y(rest)).toBeLessThan(await y(rate));
      expect(await y(rate)).toBeLessThan(await y(win));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-brewing-wait-tip', viewports: 'two', path: () => '/stats?tab=brewing&range=12m',
    act: async (page) => {
      const c = page.locator('section[data-section="brewing-rating-by-wait"] canvas');
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const sweep: (readonly [number, number])[] = [];
      for (const g of [0.9, 0.75, 0.6, 0.45]) for (let f = 0.95; f > 0; f -= 0.05) sweep.push([b.x + b.width * f, b.y + b.height * g]);
      for (const [x, y] of sweep) {
        await page.mouse.move(x, y);
        if (await tip.waitFor({ timeout: 100 }).then(() => true, () => false)) break;
      }
      await expectDataTip(tip);
      await expectTipInView(page, tip);
    }
  },
  {
    name: 'insights-spend-preview', viewports: 'two', path: () => '/stats?tab=spend&range=12m',
    act: async (page) => {
      const t = await previewTags(page, '/stats?tab=spend&range=12m');
      expect(t['og:title']).toBe('Stats: Spend');
      expect(t['og:description']).toMatch(/^What fuhnoo spends on coffee, and on what\n.+\nSpent \$[\d,.]+ · [\d,.]+ bags?( · \$\d+\.\d\d\/g avg)?$/);
    }
  },
  // On hand: eight tiles (with the oldest and newest unopened) and no Compare control (a snapshot has nothing to compare); the runway and freshness cards fill their rows.
  {
    name: 'insights-onhand', path: () => '/stats?tab=onhand&range=3m',
    act: async (page) => {
      const shelf = ['Bags waiting', 'Grams waiting', '$ tied up', 'Avg age', 'In the freezer', 'Avg bag cost', 'Oldest unopened', 'Newest unopened'];
      await expect(page.locator('.stat-item .stat-label')).toHaveText(
        [...shelf, 'Days left', 'Runs out', 'A day', 'Days left', 'Runs out', 'A day'], { useInnerText: true, ignoreCase: true }
      );
      await expect(page.getByLabel('Compare', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Period', { exact: true })).toBeVisible();
      await expect(page.locator('#onhand-runway-at-your-pace, #onhand-freshness, #onhand-bag-states')).toHaveCount(3);
      await expect(page.locator('[data-section="onhand-bag-states"] canvas')).toHaveCount(1);
      // The runway: its tiles are the shelf tiles' size, and a chart of the projection fills the rest.
      const runway = page.locator('section.chart-panel:has(#onhand-runway-at-your-pace)');
      await expect(runway.locator('canvas')).toHaveCount(1);
      const shelfH = (await page.locator('.stat-item').first().boundingBox())!.height;
      expect((await runway.locator('.stat-item').first().boundingBox())!.height, 'runway tiles are the shelf tiles\' size').toBeLessThanOrEqual(shelfH + 2);
      await expectGridRowsFull(page, '[data-section="onhand-freshness"] .cards');
      await expect(page.locator('[data-section="onhand-freshness"] .oh-card')).toHaveCount(4);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-onhand-runway-all', viewports: 'two', path: () => '/stats?tab=onhand&range=all',
    act: async (page) => {
      const runway = page.locator('section.chart-panel:has(#onhand-runway-at-your-pace)');
      await expect(runway.locator('.stat-item')).toHaveCount(3);
      await expect(runway.locator('canvas')).toHaveCount(1);
      const shelfH = (await page.locator('.stat-item').first().boundingBox())!.height;
      expect((await runway.locator('.stat-item').first().boundingBox())!.height, 'runway tiles are the shelf tiles\' size').toBeLessThanOrEqual(shelfH + 2);
      await expect(runway.getByRole('link', { name: 'Plan it: What if' })).toHaveAttribute('href', /insights-what-if/);
    }
  },
  {
    // Every line chart opens its tip for the nearest x anywhere in the plot, as Runway at your pace (hover; touch: tap); it closes off the chart.
    name: 'insights-line-tips-nearest-x', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const poke = async (c: Locator, fx: number, fy: number) => {
        const b = (await c.boundingBox())!;
        if (touch()) await page.touchscreen.tap(b.x + b.width * fx, b.y + b.height * fy); else await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
      };
      const check = async (c: Locator) => {
        await c.scrollIntoViewIfNeeded();
        await page.waitForTimeout(450);
        // Mid-plot, well off any mark: a tip still opens (it used to need a point within 8px).
        for (const fy of [0.35, 0.5, 0.2]) { await poke(c, 0.5, fy); if (await tip.waitFor({ timeout: 400 }).then(() => true, () => false)) break; }
        await expect(tip).toBeVisible();
        await expect(tip.locator('.tip-title')).not.toHaveText('');
        await expectDataTip(tip);
        await expectTipInView(page, tip);
        // Off the chart closes it (touch: a tap elsewhere).
        const h = (await c.locator('xpath=ancestor::section[1]//*[contains(@class,"chart-note")]').first().boundingBox())!;
        if (touch()) await page.touchscreen.tap(h.x + 2, h.y + 2); else await page.mouse.move(h.x + 2, h.y + 2);
        await expect(tip).toHaveCount(0);
      };
      await check(page.locator('[data-board="caffeine"] .time-chart canvas'));
      await page.goto('/stats?tab=onhand&range=all');
      await check(page.locator('section.chart-panel:has(#onhand-runway-at-your-pace) canvas'));
      // A bar chart with a trend line over it (Brewed over time): same.
      await page.goto('/stats?tab=consumption&range=all');
      await check(page.locator('section.chart-panel:has(#consumption-chart-brewed) canvas'));
      // A bar-only chart (Brews by hour): a bar's whole column opens its tip.
      await page.goto('/stats?tab=habits&range=all');
      await check(page.locator('section.chart-panel:has(#habits-hour) canvas'));
    }
  },
  {
    name: 'insights-onhand-freshness-links', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      // A group longer than 5 bags ends in "and N more": a /coffees link filtered to exactly that group (no tooltip).
      const more = page.locator('[data-section="onhand-freshness"] a.more');
      expect(await more.count()).toBeGreaterThan(0);
      for (const a of await more.all()) await expect(a).toHaveAttribute('href', /\/coffees\?status=backlog&status=open&.*(frozen=(true|false))/);
      await expect(page.locator('[data-section="onhand-freshness"] .text-tip')).toHaveCount(0);
    }
  },
  // A chart's tip sits at the hovered mark, not at the chart's top: beside a stacked segment (sticky tips), above a horizontal bar
  // at the pointer's x (a short move to the link), above a plain vertical bar's top.
  {
    name: 'insights-chart-tip-position', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      for (const [panelId, beside] of [['onhand-age', true], ['onhand-waiting', false]] as const) {
        const panel = page.locator(`section.chart-panel:has(#${panelId})`);
        const c = panel.locator('canvas');
        await c.scrollIntoViewIfNeeded();
        await page.waitForTimeout(450);
        const b = (await c.boundingBox())!;
        const tip = page.locator('.chart-container .cell-tip:popover-open');
        const pts: (readonly [number, number])[] = [];
        for (const g of [0.85, 0.7, 0.55, 0.4]) for (let f = 0.9; f > 0.1; f -= 0.1) pts.push([b.x + b.width * f, b.y + b.height * g]);
        for (const [x, y] of pts) {
          await page.mouse.move(x, y);
          if (await tip.waitFor({ timeout: 100 }).then(() => true, () => false)) break;
        }
        await expect(tip).toBeVisible();
        const a = (await panel.locator('.tip-anchor').boundingBox())!;
        const t = (await tip.boundingBox())!;
        if (beside) expect(t.x >= a.x - 1 || t.x + t.width <= a.x + 1, 'beside the bar end (right, or left when it does not fit)').toBe(true);
        else {
          expect(t.y + t.height, 'above the bar top').toBeLessThanOrEqual(a.y + 2);
          expect(a.x >= t.x - 1 && a.x <= t.x + t.width + 1, 'at the pointer x').toBe(true);
        }
        // Next to the mark, not up at the chart's top: the tip is within a tip's height of the anchor (or the page edge).
        expect(Math.abs(t.y + t.height / 2 - (a.y + (beside ? 0 : -t.height / 2))), panelId).toBeLessThan(a.height + t.height);
      }
    }
  },
  // Sticky tooltips (ui-rules 54) on the Age profile and What's waiting bars: a "See coffees" link to a filtered /coffees list;
  // the pointer can cross onto the tip; a click on the mark pins it until Escape. Both Age profile units.
  {
    name: 'insights-onhand-sticky-tips', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const check = async (panelId: string) => {
        const canvas = page.locator(`section.chart-panel:has(#${panelId}) canvas`);
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(450);
        let at: readonly [number, number] | null = null;
        for (const pt of await chartPoints(canvas)) {
          await page.mouse.move(pt[0], pt[1]);
          if (await tip.waitFor({ timeout: 60 }).then(() => true, () => false) && (await tip.getByRole('link', { name: /See coffees/ }).count())) { at = pt; break; }
        }
        expect(at, `${panelId}: a mark whose tip has a link`).not.toBeNull();
        await expect(tip.getByRole('link', { name: /See coffees/ })).toHaveAttribute('href', /\/coffees\?status=backlog/);
        await expectDataTip(tip);
        if (!touch()) {
          // The pointer crosses from the mark onto the tip and it stays open.
          const t = (await tip.boundingBox())!;
          await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 });
          await page.waitForTimeout(300);
          await expect(tip).toBeVisible();
          await page.mouse.move(at![0], at![1]);
        }
        // A click pins it: moving away keeps it open; Escape closes it.
        await page.mouse.click(at![0], at![1]);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(300);
        await expect(tip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tip).toBeHidden();
      };
      // Each segment keeps its own link: hovering the top segment of every stack must reach more than the Before-window series.
      const seen = new Set<string>();
      const ageCanvas = page.locator('section.chart-panel:has(#onhand-age) canvas');
      for (const pt of await chartPoints(ageCanvas)) {
        await page.mouse.move(pt[0], pt[1]);
        if (await tip.waitFor({ timeout: 60 }).then(() => true, () => false)) {
          const href = await tip.getByRole('link', { name: /See coffees/ }).getAttribute('href');
          seen.add(decodeURIComponent(href ?? '').replace(/\+/g, ' ').match(/rest_state=([^&]*)/)?.[1] ?? '');
        }
      }
      expect([...seen].some((v) => v && !/^before/i.test(v)), `rest_state links seen: ${[...seen]}`).toBe(true);
      await check('onhand-age');
      await page.locator('section.chart-panel:has(#onhand-age)').getByRole('group', { name: 'Unit' }).getByRole('button', { name: 'Bags', exact: true }).click();
      await check('onhand-age');
      await check('onhand-waiting');
    }
  },
  // Keyboard reach for the sticky tips (ui-rules 54): the canvas is one tab stop; arrows step the marks and the tip follows
  // (announced through a live region); Tab reaches "See coffees", Shift+Tab returns; Escape closes and keeps focus on the chart.
  {
    name: 'insights-onhand-chart-keyboard', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      for (const [panelId, name] of [['onhand-age', 'Age profile'], ['onhand-waiting', "What's waiting"]] as const) {
        const canvas = page.locator(`section.chart-panel:has(#${panelId}) canvas`);
        // A stacked bar's tip repeats for each segment: the mark is told apart by where the tip points (the anchor).
        const sig = async () => (await tip.innerText()) + (await page.locator(`section.chart-panel:has(#${panelId}) .tip-anchor`).evaluate((e) => `${(e as HTMLElement).style.left},${(e as HTMLElement).style.top}`));
        await canvas.scrollIntoViewIfNeeded();
        await page.waitForTimeout(450);
        await expect(canvas).toHaveAttribute('aria-label', new RegExp(`^${name}\\.`));
        await canvas.focus();
        await page.keyboard.press('ArrowRight');
        await expect(tip).toBeVisible();
        const first = await sig();
        await expectTipInView(page, tip);
        const live = page.locator(`section.chart-panel:has(#${panelId}) [aria-live="polite"]`);
        await expect(live).not.toHaveText('');
        // Arrow steps change the tip; ArrowLeft returns to the first mark.
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => sig()).not.toBe(first);
        await expectTipInView(page, tip);
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => sig()).toBe(first);
        // The canvas takes the focus ring; Tab reaches the link, Shift+Tab goes back.
        await page.keyboard.press('Tab');
        const link = tip.getByRole('link', { name: /See coffees/ });
        await expect(link).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(canvas).toBeFocused();
        await expect(tip).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
        // Escape closes the tip and puts the focus back on the chart.
        await page.keyboard.press('Escape');
        await expect(tip).toBeHidden();
        await expect(canvas).toBeFocused();
        // Escape keeps the position: the next arrow continues from it (never restarting at the first mark).
        await page.keyboard.press('Home');
        await expect(tip).toBeVisible();
        const home = await sig();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => sig()).not.toBe(home);
        const second = await sig();
        await page.keyboard.press('Escape');
        await expect(tip).toBeHidden();
        await page.keyboard.press('ArrowRight');
        await expect(tip).toBeVisible();
        const third = await sig();
        expect(third, 'continues past the second mark').not.toBe(second);
        expect(third, 'not back at the first').not.toBe(home);
        await page.keyboard.press('Escape');
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => sig()).toBe(second);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => sig()).toBe(third);
        // Tabbing past an open tip closes it; coming back reopens at the last-stepped mark.
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await expect(tip).toBeHidden();
        await page.keyboard.press('Shift+Tab');
        await expect(canvas).toBeFocused();
        await expect(tip).toBeVisible();
        expect(await sig()).toBe(third);
        await page.keyboard.press('Escape');
      }
      // New data (Group by Origin): the old position no longer maps to the same mark, so stepping starts at the first.
      const panel = page.locator('section.chart-panel:has(#onhand-waiting)');
      const canvas = panel.locator('canvas');
      await canvas.focus();
      await page.keyboard.press('ArrowRight');
      await expect(tip).toBeVisible();
      const roasterThird = await tip.innerText();
      await page.keyboard.press('Escape');
      await panel.getByRole('group', { name: 'Group by' }).getByRole('button', { name: 'Origin', exact: true }).click();
      await canvas.focus();
      await page.keyboard.press('ArrowRight');
      await expect(tip).toBeVisible();
      const originFirst = await tip.innerText();
      await page.keyboard.press('ArrowLeft');
      expect(await tip.innerText(), 'one step back from the first mark stays on it').toBe(originFirst);
      expect(originFirst).not.toBe(roasterThird);
    }
  },
  // A bar chart with a line overlay (Consumption's trend line, Spend's compare average): the tip anchors at the bar, never NaN.
  {
    name: 'insights-chart-tip-trend', viewports: 'two', path: () => '/stats?tab=consumption&range=3m',
    act: async (page) => {
      const canvas = page.locator('.chart-container canvas').first();
      await canvas.scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      const tip = await hoverChart(page, canvas);
      await expect(tip).toBeVisible();
      const anchor = page.locator('.chart-container .tip-anchor').first();
      const [top, left, height] = await anchor.evaluate((e) => { const st = (e as HTMLElement).style; return [st.top, st.left, st.height]; });
      for (const v of [top, left, height]) expect(Number.isFinite(parseFloat(v)), `anchor ${v}`).toBe(true);
      await expectTipInView(page, tip);
    }
  },
  // Bags are shared in the household: In the freezer's count never says "per person"; only the grams under it do (per person mode).
  {
    name: 'insights-onhand-people', viewports: 'two', path: () => '/stats?tab=onhand&range=3m',
    act: async (page) => {
      const tile = page.locator('#onhand-frozen-bags');
      await expect(tile.locator('.stat-unit')).not.toContainText(/per person/i);
      const bags = await tile.locator('.stat-value').innerText();
      await page.goto('/stats?tab=onhand&range=3m&people=person');
      const person = page.locator('#onhand-frozen-bags');
      await expect(person.locator('.stat-value')).toHaveText(bags);
      await expect(person.locator('.stat-unit')).toContainText(/per person/i);
      await expect(person.locator('.stat-label .mode-tip-button')).toHaveCount(0);
      // Grams and dollars tiles keep their per person caption; Bags waiting never had one.
      await expect(page.locator('#onhand-grams-waiting .stat-label .mode-tip-button', { hasText: 'per person' })).toHaveCount(1);
      await expect(page.locator('#onhand-bags-waiting .stat-label .mode-tip-button')).toHaveCount(0);
    }
  },
  {
    name: 'insights-onhand-tip', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      await page.getByRole('button', { name: 'About Avg age' }).click();
      const tip = page.locator('.mode-tip:popover-open');
      await expectTipInView(page, tip);
      await expect(tip).toContainText('Counted by roast date, minus days in the freezer.');
    }
  },
  {
    name: 'insights-onhand-trunc-tip', viewports: 'two', path: () => '/stats?tab=onhand&range=3m',
    act: async (page) => {
      // A tile's cut-off coffee name shows its full text in the tip on hover and on keyboard focus; an uncut one shows none.
      const link = page.locator('#onhand-oldest a').first();
      const full = (await link.locator('.sub1').textContent())!.trim(); // the tip also holds the roaster line
      await expect(link).toBeVisible();
      await link.hover();
      await page.waitForTimeout(300);
      const tip = page.locator('.float-tip');
      const cut = await link.evaluate((a) => [a, a.parentElement!, ...a.querySelectorAll('*')].some((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1));
      if (cut) await expect(tip.filter({ hasText: full })).toBeVisible(); else await expect(tip).toHaveCount(0);
      await page.mouse.move(0, 0);
      await expect(tip).toHaveCount(0);
      // Force the cut so the tip is certain, then keyboard focus.
      await link.evaluate((a) => { const p = a.parentElement!; p.style.right = 'auto'; p.style.width = '3rem'; p.style.overflow = 'hidden'; p.style.whiteSpace = 'nowrap'; p.style.textOverflow = 'ellipsis'; });
      await link.hover();
      await expect(tip.filter({ hasText: full })).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(tip).toHaveCount(0);
      await page.keyboard.press('Tab'); // focus-visible needs the keyboard; walk to the link
      for (let i = 0; i < 80 && !(await link.evaluate((a) => a === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expect(tip.filter({ hasText: full })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tip).toHaveCount(0);
      // An ancestor whose overflow is visible does not clip: text running out of it fully shown gets no tip.
      await link.evaluate((a) => { for (const e of [a.parentElement!, ...a.querySelectorAll<HTMLElement>('*')]) { e.style.overflow = 'visible'; e.style.textOverflow = 'clip'; } });
      await link.hover();
      await page.waitForTimeout(300);
      const clipped = await link.evaluate((a) => { for (let e: Element | null = a, i = 0; e && i < 4; e = e.parentElement, i++) { const s = getComputedStyle(e); if ((s.overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY === 'hidden' && e.scrollHeight > e.clientHeight + 1)) return true; } return [...a.querySelectorAll('*')].some((e) => getComputedStyle(e).overflowX === 'hidden' && e.scrollWidth > e.clientWidth + 1); });
      expect(clipped, 'nothing clips the text any more').toBe(false);
      await expect(tip).toHaveCount(0);
      await link.evaluate((a) => { a.parentElement!.style.overflow = 'hidden'; for (const e of a.querySelectorAll<HTMLElement>('*')) { e.style.overflow = ''; e.style.textOverflow = ''; } }); // the layout check runs after the act
    }
  },
  {
    // Oldest / Newest unopened: the roaster under the coffee name, in the same link; one tip holds both; the tiles keep their heights.
    name: 'insights-onhand-sub-roaster', viewports: 'two', path: () => '/stats?tab=onhand&range=3m',
    act: async (page) => {
      const tiles = ['oldest', 'newest'].map((k) => page.locator(`#onhand-${k}`));
      const hs: number[] = [];
      for (const tile of tiles) {
        const link = tile.locator('a:has(.sub2)');
        await expect(link).toHaveCount(1);
        const [name, roaster] = await link.evaluate((a) => [a.querySelector('.sub1')!, a.querySelector('.sub2')!].map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.left]) as number[][]).then((r) => r);
        expect(roaster[0], 'roaster below the name').toBeGreaterThan(name[0]);
        expect(await tile.locator('a:not(.caption-link)').count(), 'one link').toBe(1);
        hs.push((await tile.boundingBox())!.height);
        // Force a cut on the roaster line: one tip with both parts.
        const full = (await link.locator('.sub1').textContent())! + ' · ' + (await link.locator('.sub2').textContent())!;
        await link.locator('.sub2').evaluate((e) => { e.parentElement!.style.width = '2rem'; });
        await link.hover();
        await expect(page.locator('.float-tip').filter({ hasText: full })).toBeVisible();
        await page.mouse.move(0, 0);
        await link.locator('.sub2').evaluate((e) => { e.parentElement!.style.width = ''; });
      }
      expect(Math.abs(hs[0] - hs[1]), 'tiles level').toBeLessThanOrEqual(1);
    }
  },
  {
    // A multi-part caption ("Coarsest grind · A4Z") shows its tip text with the separators, not the glued parts.
    name: 'insights-caption-trunc-tip', viewports: 'two', path: () => '/stats?tab=sweetspots',
    act: async (page) => {
      const link = page.locator('.caption-link:has(.cap-list)').first();
      await expect(link).toBeVisible();
      await link.evaluate((a) => { a.style.display = 'block'; a.style.width = '3rem'; a.style.overflow = 'hidden'; a.style.height = '1.2em'; });
      await link.hover();
      await expect(page.locator('.float-tip').filter({ hasText: ' · ' })).toBeVisible();
      await link.evaluate((a) => a.removeAttribute('style')); // the layout checks run after the act
    }
  },
  {
    name: 'insights-onhand-preview', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      const t = await previewTags(page, '/stats?tab=onhand');
      expect(t['og:title']).toBe('Stats: On hand');
      expect(t['og:description']).toMatch(/^What's on fuhnoo's shelf right now\n.+\n\d+ bags? waiting · .+ · \$[\d,.]+ tied up$/);
    }
  },
  {
    name: 'insights-onhand-age', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#onhand-age)');
      await panel.scrollIntoViewIfNeeded();
      await panel.getByRole('group', { name: 'Unit' }).getByRole('button', { name: 'Bags', exact: true }).click();
      await expect(page).toHaveURL(/unit=bags/);
      await expect(panel.locator('canvas')).toHaveCount(1);
      const c = panel.locator('canvas');
      const b = (await c.boundingBox())!;
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      const sweep: (readonly [number, number])[] = [];
      for (const g of [0.9, 0.75, 0.6, 0.45]) for (let f = 0.95; f > 0; f -= 0.05) sweep.push([b.x + b.width * f, b.y + b.height * g]);
      for (const [x, y] of [...(await chartPoints(c, false)).slice(0, 12), ...sweep]) {
        await page.mouse.move(x, y);
        if (await tip.waitFor({ timeout: 100 }).then(() => true, () => false)) break;
      }
      await expectDataTip(tip);
      await panel.getByRole('group', { name: 'Unit' }).getByRole('button', { name: 'Grams', exact: true }).click();
      await expect(page).not.toHaveURL(/unit=bags/);
    }
  },
  {
    name: 'insights-onhand-waiting', viewports: 'two', path: () => '/stats?tab=onhand',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#onhand-waiting)');
      await panel.scrollIntoViewIfNeeded();
      const labels = () => panel.locator('canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL()); // the drawn labels change with the grouping
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      const by = panel.getByRole('group', { name: 'Group by' });
      await expect(by.getByRole('button', { name: 'Roaster', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const before = await labels();
      await by.getByRole('button', { name: 'Origin', exact: true }).click();
      await expect(page).toHaveURL(/waitBy=origin/);
      await expect(by.getByRole('button', { name: 'Origin', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(labels).not.toBe(before);
      expect(fetched).toEqual([]);
      await expect(panel.locator('.chart-note').first()).toHaveText(/^Subscription .+ · One-off /);
      await by.getByRole('button', { name: 'Roaster', exact: true }).click();
      await expect(page).not.toHaveURL(/waitBy/);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  { name: 'insights-onhand-waiting-caffeine', viewports: 'two', path: () => '/stats?tab=onhand&waitBy=caffeine',
    act: async (page) => {
      const panel = page.locator('section.chart-panel:has(#onhand-waiting)');
      await panel.scrollIntoViewIfNeeded();
      const by = panel.getByRole('group', { name: 'Group by' });
      await expect(by.getByRole('button', { name: 'Caffeine', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await by.getByRole('button', { name: 'Roaster', exact: true }).click();
      await expect(page).not.toHaveURL(/waitBy/);
      await by.getByRole('button', { name: 'Caffeine', exact: true }).click();
      await expect(page).toHaveURL(/waitBy=caffeine/);
      await expect(panel.locator('.chart-note').first()).toHaveText(/^Subscription .+ · One-off /);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  // Pours tab: the report card, technique, recipe x coffee and rest age; thin recipes behind a toggle (pourThin).
  {
    name: 'insights-pours', path: () => '/stats?tab=pours',
    act: async (page) => {
      for (const id of ['pours-recipes', 'pours-technique', 'pours-recipe-coffee', 'pours-rest']) await expect(page.locator(`#${id}`)).toBeVisible();
      const rows = page.locator('.chart-panel[data-section="pours-recipes"] li');
      await expect(rows.filter({ hasText: 'Seed high agitation' })).toHaveCount(1);
      await expect(rows.filter({ hasText: 'Seed low agitation' })).toHaveCount(1);
      await expect(rows.filter({ hasText: 'No recipe' })).toHaveCount(0); // thin: behind the toggle
      await expect(page.getByRole('button', { name: 'Show 2 more with few brews' })).toBeVisible();
      await expect(page.getByLabel('Compare', { exact: true })).toHaveCount(0);
      // The small-sample marker has its own fixed column: the delta cells line up with and without one, and the icon is named.
      await page.getByRole('button', { name: /^Show \d+ more/ }).click();
      const items = page.locator('[data-section="pours-recipes"] ul.card > li');
      const xs = await items.evaluateAll((lis) => lis.map((li) => [Math.round(li.querySelector('.delta')!.getBoundingClientRect().left), !!li.querySelector('.mark button'), Math.round(li.querySelector('.mark')!.getBoundingClientRect().left)]));
      expect(xs.some((x) => x[1]) && xs.some((x) => !x[1]), 'rows with and without a marker').toBe(true);
      expect(new Set(xs.map((x) => x[0])).size, 'delta column x').toBe(1);
      expect(new Set(xs.map((x) => x[2])).size, 'marker column x').toBe(1);
      for (const b of await items.locator('.mark button').all()) expect(await b.getAttribute('aria-label')).toBeTruthy();
      await expect(items.locator('.mark .sample-chip').first()).not.toContainText(/Only/);
      // A Best item stays on one line (its "(n brews)" never splits); wide screens fit all of a row's items on one line.
      const lines = await items.locator('.best > span').evaluateAll((es) => es.map((e) => e.getClientRects().length));
      expect(lines.every((n) => n === 1), 'a Best item wraps inside itself').toBe(true);
      if ((page.viewportSize()?.width ?? 0) >= 1280) {
        const tops = await items.locator('.best').evaluateAll((bs) => bs.map((b) => new Set([...b.querySelectorAll(':scope > span')].map((e) => Math.round(e.getBoundingClientRect().top))).size));
        expect(tops.every((n) => n === 1), 'Best items on one line at 1280').toBe(true);
      }
      await expect(page.locator('nav.board-jump')).toBeVisible();
      expect(await page.locator('main .bar.small-sample-mark').count()).toBeGreaterThan(0);
      // Cards size to their content: every Technique bar row has the normal height (no stretched pair), and the agitation
      // band labels, the report card's name and dripper lines each stay on one line (no mid-phrase wrap).
      const rowH = await page.locator('.tech-cols .bar-row').evaluateAll((rs) => rs.map((r) => Math.round(r.getBoundingClientRect().height)));
      expect(Math.max(...rowH) / Math.min(...rowH), `bar row heights ${[...new Set(rowH)]}`).toBeLessThanOrEqual(1.32); // at most the 1.3x column-balance stretch
      const wraps = await page.locator('.tech-cols [data-section="pours-agitation"] .bar-label, ul.card .nm, ul.card .sub').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight) * 1.5).map((e) => e.textContent));
      expect(wraps, 'labels wrapped mid-phrase').toEqual([]);
      const cut = await page.locator('ul.card > li').evaluateAll((lis) => lis.flatMap((li) => [...li.querySelectorAll('.spark, .counts')].filter((e) => e.getBoundingClientRect().right > li.getBoundingClientRect().right + 1).map((e) => e.tagName)));
      expect(cut, 'sparkline or counts past the card edge').toEqual([]);
      // Report card rows keep 8px of padding inside the box: no text touches its border.
      const edge = await page.locator('ul.card').evaluate((ul) => {
        const b = ul.getBoundingClientRect();
        return [...ul.querySelectorAll('li > *')].filter((e) => e.getBoundingClientRect().width > 0 && (e.textContent?.trim() || e.querySelector('svg'))).flatMap((e) => {
          const r = e.getBoundingClientRect();
          return r.left < b.left + 8 || r.right > b.right - 8 ? [`${e.className}: ${Math.round(r.left - b.left)} / ${Math.round(b.right - r.right)}`] : [];
        });
      });
      expect(edge, 'text within 8px of the card border').toEqual([]);
      // The counts' tip says what logged and matched mean.
      await page.locator('ul.card .counts span').first().hover();
      await expect(page.locator('.float-tip').filter({ hasText: 'the site recognized the recipe from the brew' })).toBeVisible();
      await page.mouse.move(0, 0);
      // Words: a table per grouping, bands in canonical order; it scrolls inside its box and the word column stays put.
      await expect(page.locator('.wscroll caption').first()).toHaveText('By agitation');
      expect(await page.locator('.wscroll').first().locator('thead th').allTextContents()).toEqual(['Word', 'High', 'Low', 'Mixed']);
      await expect(page.locator('.wscroll tbody th').first()).toContainText(/Bright|Sweet/);
      await page.locator('.wscroll').first().evaluate((e) => { e.style.width = '9rem'; e.scrollLeft = 1e4; });
      const sticky = await page.locator('.wscroll').first().evaluate((e) => ({ scrolled: e.scrollLeft, box: e.getBoundingClientRect().left, th: e.querySelector('tbody th')!.getBoundingClientRect().left }));
      expect(sticky.scrolled).toBeGreaterThan(0);
      expect(Math.abs(sticky.th - sticky.box), 'word column stays at the left edge').toBeLessThanOrEqual(1);
      await expectInnerScroll(page, '.wscroll');
      await page.locator('.wscroll').first().evaluate((e) => { e.style.width = ''; });
      // Technique columns (two-up): same top, bottoms within 56px (cards stretch at most 1.3x; the rest sits below).
      const cols = await page.locator('.tech-cols .col').evaluateAll((cs) => cs.map((c) => ({ two: getComputedStyle(c).display !== 'contents', top: Math.round(c.getBoundingClientRect().top), bottom: Math.round(c.getBoundingClientRect().bottom) })));
      if (cols.length === 2 && cols[0].two) {
        expect(cols[0].top).toBe(cols[1].top);
        expect(Math.abs(cols[0].bottom - cols[1].bottom), `column bottoms ${cols[0].bottom} vs ${cols[1].bottom}`).toBeLessThanOrEqual(56);
      }
      // A name cut by an ellipsis shows its full text in the shared tip on focus (squeeze the first one to force the cut).
      const name = page.locator('ul.card .nm').first();
      const full = (await name.textContent())!.trim();
      await name.evaluate((e) => { e.style.maxWidth = '3rem'; });
      await expect.poll(() => name.evaluate((e) => e.tabIndex >= 0 && e.scrollWidth > e.clientWidth)).toBe(true);
      await name.focus();
      await page.keyboard.press('Shift+Tab'); // keyboard modality: back, then forward onto the name
      await page.keyboard.press('Tab');
      await expect(page.locator('.float-tip').filter({ hasText: full })).toBeVisible();
      await page.keyboard.press('Escape');
      await name.evaluate((e) => { e.style.maxWidth = ''; });
      const w = async (id: string) => Math.round((await page.locator(`[data-section="${id}"]`).first().boundingBox())!.width);
      expect(await w('pours-rest')).toBe(await w('pours-recipes')); // Rest age cards are full width
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    }
  },
  {
    name: 'insights-pours-thin-open', path: () => '/stats?tab=pours&pourThin=open',
    act: async (page) => {
      const rows = page.locator('.chart-panel[data-section="pours-recipes"] li');
      await expect(rows.filter({ hasText: 'Seed equal pours' })).toHaveCount(1);
      await expect(rows.filter({ hasText: 'No recipe' })).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Show fewer' })).toBeVisible();
      await page.getByRole('button', { name: 'Show fewer' }).click();
      await expect(page).not.toHaveURL(/pourThin/);
      await expect(rows.filter({ hasText: 'No recipe' })).toHaveCount(0);
    }
  },
  {
    name: 'insights-pours-recipe-by', viewports: 'two', path: () => '/stats?tab=pours',
    act: async (page) => {
      const panel = page.locator('section.chart-panel[data-section="pours-recipe-coffee"]');
      await panel.scrollIntoViewIfNeeded();
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      const by = panel.getByRole('group', { name: 'Group by' });
      await expect(by.getByRole('button', { name: 'Roast level', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await by.getByRole('button', { name: 'Process', exact: true }).click();
      await expect(page).toHaveURL(/recipeBy=process/);
      await expect(by.getByRole('button', { name: 'Process', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.getByRole('group', { name: /^Recipe by process/ })).toContainText('Washed');
      expect(fetched).toEqual([]);
      await page.reload();
      await expect(by.getByRole('button', { name: 'Process', exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
  },
  {
    // Compare with: each mode rewrites the URL without a load; a recipe with brews but no same-bag contrast (Seed equal pours)
    // keeps a cell with its brews in Same roast level / Same recipe / Average.
    name: 'insights-pours-recipe-vs', viewports: 'two', path: () => '/stats?tab=pours',
    act: async (page) => {
      const panel = page.locator('section.chart-panel[data-section="pours-recipe-coffee"]');
      await panel.scrollIntoViewIfNeeded();
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      const vs = panel.getByRole('group', { name: 'Compare with' });
      await expect(vs.getByRole('button', { name: 'Same bags', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const cell = (g: RegExp) => panel.getByRole('group', { name: g }).getByRole('button', { name: /^Light · Seed equal pours/ });
      for (const [name, param, group] of [['Same roast level', 'group', /rating vs the rest of its row/], ['Same recipe', 'recipe', /rating vs the recipe in other rows/], ['Average', 'avg', /average rating/]] as const) {
        await vs.getByRole('button', { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`recipeVs=${param}`));
        await expect(vs.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(cell(group)).toHaveAttribute('aria-label', param === 'avg' ? /· \d\.\d/ : /3 brews/);
      }
      expect(fetched).toEqual([]);
      await reloadReady(page);
      await expect(panel.getByRole('group', { name: 'Compare with' }).getByRole('button', { name: 'Average', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await panel.getByRole('group', { name: 'Compare with' }).getByRole('button', { name: 'Same bags', exact: true }).click();
      await expect(page).not.toHaveURL(/recipeVs/);
    }
  },
  { name: 'insights-pours-recipe-vs-avg', path: () => '/stats?tab=pours&recipeVs=avg&recipeBy=process',
    act: async (page) => {
      await expect(page.getByRole('group', { name: /^Recipe by process: average rating/ })).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    } },
  {
    name: 'insights-pours-bad-params', viewports: 'two', path: () => '/stats?tab=pours&recipeBy=zzz&pourThin=x&recipeVs=zzz',
    act: async (page) => {
      const by = page.locator('[data-section="pours-recipe-coffee"]').getByRole('group', { name: 'Group by' });
      await expect(by.getByRole('button', { name: 'Roast level', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('group', { name: 'Compare with' }).getByRole('button', { name: 'Same bags', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Show 2 more with few brews' })).toBeVisible();
    }
  },
  {
    name: 'insights-pours-chart-link', viewports: 'two', path: () => '/stats?tab=pours&chart=pours-technique',
    act: async (page) => {
      await expect(page.getByRole('heading', { name: 'Technique', exact: true })).toBeInViewport();
    }
  },
  {
    name: 'insights-pours-empty', viewports: 'two', path: () => '/stats?tab=pours&range=2000-01-01..2000-01-31',
    act: async (page) => {
      await expect(page.getByText('No rated brews with pour readings in this period.')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Set up recipes' })).toHaveAttribute('href', '/recipes');
    }
  },
  // A tile's title never moves when per person adds its caption part: secondary parts sit on their own line (shared tile layout).
  {
    name: 'insights-tile-titles-people', viewports: 'two', path: () => '/stats?tab=onhand&range=3m',
    act: async (page) => {
      const tops = async () => (await page.locator('.stat-item .stat-label a').evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().top))));
      for (const tab of ['onhand', 'spend', 'overview', 'consumption', 'habits']) {
        await page.goto(`/stats?tab=${tab}&range=3m`);
        await expect(page.locator('.stat-item').first()).toBeVisible();
        const before = await tops();
        await page.goto(`/stats?tab=${tab}&range=3m&people=person`);
        await expect(page.locator('.stat-item .mode-tip-button', { hasText: 'per person' }).first()).toBeVisible();
        expect(await tops(), tab).toEqual(before);
        await expectNoEdgeDelimiters(page);
      }
    }
  },
  // Tile captions never start or end a line with a delimiter (ui-rules 55), at every width: Stats tiles.
  {
    name: 'insights-tile-captions', path: () => '/stats?tab=overview&range=3m&people=person&dial=all',
    act: async (page) => {
      await expectNoEdgeDelimiters(page);
      // A list whose items or text change without its box changing is re-placed (a per-list MutationObserver): clear its mark and
      // touch a text node in place; it comes back.
      const list = page.locator('.cap-list').first();
      await list.evaluate((l) => { l.removeAttribute('data-ready'); const w = document.createTreeWalker(l, NodeFilter.SHOW_TEXT); const n = w.nextNode() as Text; n.data = n.data; });
      await expect(list).toHaveAttribute('data-ready', '');
      // A people toggle (no navigation) changes the caption items in place.
      await page.goto('/stats?tab=onhand&range=3m');
      const toggle = page.getByRole('button', { name: 'Per person', exact: true });
      if (await toggle.isVisible()) { // (the bar is collapsed on phones, and People is hidden in a one-person household)
        await toggle.click();
        await expect(page).toHaveURL(/people=person/);
        await expect(page.locator('#onhand-grams-waiting .cap-list')).toHaveAttribute('data-ready', '');
        await expectNoEdgeDelimiters(page);
      }
      for (const url of ['/stats?tab=onhand&range=3m&people=person', '/stats?tab=spend&range=3m&people=person', '/stats?tab=consumption&range=3m&people=person', '/stats?tab=habits&range=3m&people=person', '/stats?tab=records&range=3m&people=person&dial=all' ]) {
        await page.goto(url);
        await expect(page.locator('.stat-label').first()).toBeVisible();
        await expectNoEdgeDelimiters(page);
      }
    }
  },
  { name: 'insights-habits-1w', path: () => '/stats?tab=habits&range=1w' },
  {
    name: 'insights-habits-rating-compare', viewports: 'two',
    path: () => '/stats?tab=habits&measure=rating&compare=1',
    act: async (page) => {
      await openSwitches(page);
      await expect(page.getByRole('group', { name: 'Ratings' }).first()).toBeVisible();
      // Open a chart's tip under the pointer first: a heat cell's tip then replaces it, and the dismissed chart tip
      // unmounts (it used to stay hidden in the page, a 2nd .cell-tip, whenever the pointer happened to sit on a chart).
      chart: for (const c of await page.locator('canvas').all()) {
        await c.scrollIntoViewIfNeeded();
        const b = (await c.boundingBox())!;
        for (let y = 0.1; y < 1; y += 0.1) for (let x = 0.1; x < 1; x += 0.1) {
          await page.mouse.move(b.x + b.width * x, b.y + b.height * y);
          if (await page.locator('.cell-tip').count()) break chart;
        }
      }
      await expect(page.locator('.cell-tip')).toHaveCount(1);
      await page.locator('.heatmap .heat-cell').first().focus();
      await expectDataTip(page.locator('.cell-tip'));
      // Roving tabindex: one tab stop per grid; arrow keys move focus (and the tip).
      await expect(page.locator('.heatmap [tabindex="0"]')).toHaveCount(1);
      await expect(page.locator('.brew-calendar [tabindex="0"]')).toHaveCount(1);
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('.heatmap .heat-cell:focus')).toHaveCount(1);
      await expect(page.locator('.heatmap .heat-cell').first()).not.toBeFocused();
      await expect(page.locator('.heatmap [tabindex="0"]')).toHaveCount(1);
      await expect(page.locator('.cell-tip')).toBeVisible();
    }
  },
  {
    // The previous week is inside the seed, so tiles get deltas; Longest streak
    // keeps its sub line too. Delta, sub and caption stack without overlapping, inside the tile.
    name: 'insights-habits-compare-sub',
    path: () => '/stats?tab=habits&range=1w&compare=1',
    act: async (page) => {
      await expect(page.locator('.stat-item .insights-delta').first()).toBeVisible();
      const tiles = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Longest streak$/ }) });
      await expect(tiles).toHaveCount(1);
      const overlaps = await tiles.evaluateAll((ts) =>
        ts.flatMap((tile) => {
          const boxes = [...tile.querySelectorAll('.stat-value, .insights-delta, .insights-pace, .stat-unit, .stat-caption')]
            .map((e) => [e.className, e.getBoundingClientRect()] as const);
          const o = tile.getBoundingClientRect();
          const out: string[] = [];
          if (boxes.length < 4) out.push(`only ${boxes.length} lines`);
          boxes.forEach(([n, b], i) => {
            if (b.left < o.left - 0.5 || b.right > o.right + 0.5 || b.bottom > o.bottom + 0.5) out.push(`${n} outside tile`);
            for (const [m, c] of boxes.slice(i + 1))
              if (b.top < c.bottom - 0.5 && c.top < b.bottom - 0.5) out.push(`${n} overlaps ${m}`);
          });
          return out;
        })
      );
      expect(overlaps).toEqual([]);
      await expectDeltasFit(page);
      // Busiest weekday's "N/Fri · was Sat" stays on one line and its tile is no taller than its row mates.
      const busy = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Busiest weekday$/ }) });
      const sub = busy.locator('.stat-unit, .insights-pace').first();
      await expect(sub).toContainText('was');
      const m = await busy.evaluate((t) => {
        const sb = t.querySelector('.stat-unit, .insights-pace')!;
        const lh = parseFloat(getComputedStyle(sb).lineHeight) || parseFloat(getComputedStyle(sb).fontSize) * 1.3;
        const mates = [...t.parentElement!.children].map((c) => c.getBoundingClientRect().height);
        return { lines: sb.getBoundingClientRect().height / lh, own: t.getBoundingClientRect().height, max: Math.max(...mates) };
      });
      expect(m.lines).toBeLessThan(1.6);
      expect(m.own).toBeGreaterThanOrEqual(m.max - 1);
    }
  },
  { name: 'labels-overview', path: () => '/stats', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-leaderboards', path: () => '/stats?tab=leaderboards', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-habits', path: () => '/stats?tab=habits', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-habits-rating', path: () => '/stats?tab=habits&measure=rating', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-consumption', path: () => '/stats?tab=consumption', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-coffees', path: () => '/coffees?status=all&view=compact', act: (page) => expectGroupsLabelled(page) },
  {
    // Two views behind a labeled View select: only the chosen section renders; `next` is the only explicit value.
    name: 'on-deck-view-open', viewports: 'two',
    path: () => '/on-deck',
    act: async (page) => {
      const view = page.getByLabel('View');
      await expect(view).toHaveValue('open');
      await expect(page.getByRole('heading', { name: 'Currently open' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Next up' })).toHaveCount(0);
      await expectGroupsLabelled(page);
      await view.selectOption('next');
      await expect(page).toHaveURL(/view=next/);
      await expect(page.getByRole('heading', { name: 'Currently open' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Decaf' }).click();
      await expect(page).toHaveURL(/show=decaf&view=next|view=next&show=decaf/);
      await view.selectOption('open');
      await expect(page).not.toHaveURL(/view=/);
    }
  },
  {
    name: 'on-deck-view-next', viewports: 'two',
    path: () => '/on-deck?view=next',
    act: async (page) => {
      await expect(page.getByLabel('View')).toHaveValue('next');
      await expect(page.getByRole('heading', { name: 'Next up' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Currently open' })).toHaveCount(0);
      await expect(page.locator('.card').first().or(page.getByText('Backlog is empty.'))).toBeVisible();
    }
  },
  { name: 'labels-on-deck', path: () => '/on-deck', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-subscriptions', path: () => '/subscriptions', act: (page) => expectGroupsLabelled(page) },
  {
    // Habits Show toggle: Total sums (URL carries agg=total), Avg per day is the default, rating hides the group.
    name: 'insights-habits-agg-total',
    path: () => '/stats?tab=habits&agg=total&compare=1',
    act: async (page) => {
      await expect(page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true');
      await expectChipsFit(page);
      await expectDeltasFit(page);
      await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Avg per day' }).click();
      await expect(page).not.toHaveURL(/agg=/);
      await page.getByRole('group', { name: 'Measure' }).getByRole('button', { name: 'Rating' }).click();
      // Show stays, greyed (it doesn't apply to a rating), so the bar keeps its size.
      await expect(page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Total' })).toHaveAttribute('aria-disabled', 'true');
    }
  },
  {
    name: 'insights-habits-agg-avg-grams',
    path: () => '/stats?tab=habits&measure=grams&compare=1',
    act: async (page) => {
      await page.locator('.heatmap .heat-cell').nth(10).hover();
      await expectChipsFit(page);
    }
  },
  {
    // Active days compares as a ratio of a count: "▼ 3% from 31 days (100%)", up to two lines, clear of the caption, nothing clipped.
    name: 'insights-habits-active-from',
    path: () => '/stats?tab=habits&range=1w&compare=1',
    act: async (page) => {
      const tile = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Active days$/ }) });
      await expect(tile.locator('.insights-delta [aria-hidden]')).toHaveText(/^[▲▼] \d+% from \d+ days \(\d+%\)$|^No change$/);
      await expect(tile.locator('.insights-delta .sr-only')).toHaveText(/^(Up|Down) \d+ points? from \d+% \(\d+ days?\) \(/);
      const gap = await tile.evaluate((t) => {
        const d = t.querySelector('.insights-delta')!.getBoundingClientRect();
        const c = t.querySelector('.stat-caption')!.getBoundingClientRect();
        return c.top - d.bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(-0.5);
      await expectDeltasFit(page);
    }
  },
  {
    // Busiest-weekday sub ("5.9 brews avg") on a long range, no compare: never an ellipsis (prod-like widths).
    name: 'insights-habits-busiest',
    path: () => '/stats?tab=habits&range=all',
    act: (page) => expectNoEllipsis(page)
  },
  {
    name: 'insights-habits-busiest-rating',
    path: () => '/stats?tab=habits&range=all&measure=rating',
    act: (page) => expectNoEllipsis(page)
  },
  {
    name: 'insights-habits-busiest-grams',
    path: () => '/stats?tab=habits&range=all&measure=grams&compare=before',
    act: (page) => expectDeltasFit(page)
  },
  {
    // Average mode with a compare on: the narrowest strings (per-day labels, bag fractions), grams and bags.
    name: 'insights-consumption-agg-grams',
    path: () => '/stats?tab=consumption&range=1w&compare=1',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Avg per day' })).toBeVisible();
      await expectChipsFit(page);
      await expectDeltasFit(page);
    }
  },
  {
    name: 'insights-consumption-busiest-day',
    path: () => '/stats?tab=consumption&range=all',
    act: expectBusiestDay
  },
  {
    name: 'insights-consumption-busiest-day-compare',
    path: () => '/stats?tab=consumption&range=1w&compare=1',
    act: async (page) => {
      await expectBusiestDay(page);
      const tile = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Busiest day$/ }) });
      const delta = tile.locator('.insights-pace');
      await expect(delta.locator('[aria-hidden]')).toHaveText(/^vs [A-Z][a-z]{2} \d{1,2}(, \d{4})?: \d+ brews? · \d+(\.\d+)?g$/);
      await expect(delta.locator('.sr-only')).toHaveText(/^Busiest day in the comparison period: [A-Z][a-z]{2} \d{1,2}(, \d{4})?, \d+ brews?, \d+(\.\d+)?g$/);
      await expectDeltasFit(page);
      // This period's day (the sub) is above the comparison line and at least as big.
      const ord = await tile.evaluate((t) => {
        const sub = t.querySelector('.stat-unit')!, cmp = t.querySelector('.insights-pace')!;
        return { gap: cmp.getBoundingClientRect().top - sub.getBoundingClientRect().bottom, subPx: parseFloat(getComputedStyle(sub).fontSize), cmpPx: parseFloat(getComputedStyle(cmp).fontSize) };
      });
      expect(ord.gap).toBeGreaterThanOrEqual(-0.5);
      expect(ord.subPx).toBeGreaterThanOrEqual(ord.cmpPx);
      // Value, sub, compare line and caption stack without overlapping, inside the tile (>= 4px from its sides),
      // which is no taller than its row mates: for the seed's text, the widest one-line text, and a long tail (breaks after the colon on phones).
      const check = async (inject: [string, string] | null, lines: 1 | 2 | null) => {
        if (inject)
          await tile.evaluate((t, [h, b]) => {
            const [head, tail] = t.querySelectorAll('.compare .part');
            head.textContent = h;
            tail.textContent = b;
          }, inject);
        const m = await tile.evaluate((t) => {
          const o = t.getBoundingClientRect();
          const boxes = [...t.querySelectorAll('.stat-value, .stat-unit, .insights-pace, .stat-caption')]
            .map((e) => [e.className, e.getBoundingClientRect()] as const);
          const out: string[] = [];
          if (boxes.length !== 4) out.push(`${boxes.length} lines`);
          boxes.forEach(([n, b], i) => {
            if (b.left < o.left - 0.5 || b.right > o.right + 0.5 || b.bottom > o.bottom + 0.5) out.push(`${n} outside tile`);
            for (const [k, c] of boxes.slice(i + 1)) if (b.top < c.bottom - 0.5 && c.top < b.bottom - 0.5) out.push(`${n} overlaps ${k}`);
          });
          const [head, tail] = [...t.querySelectorAll('.compare .part')].map((e) => e.getBoundingClientRect());
          const r = document.createRange();
          r.selectNodeContents(t.querySelector('.compare [aria-hidden]')!);
          const tx = r.getBoundingClientRect();
          const mates = [...t.parentElement!.children].map((e) => e.getBoundingClientRect().height);
          return {
            out, tall: o.height - Math.min(...mates), clear: Math.min(tx.left - o.left, o.right - tx.right),
            twoLines: tail.top > head.top + 2, scroll: t.querySelector('.compare')!.scrollWidth > t.querySelector('.compare')!.clientWidth
          };
        });
        const what = JSON.stringify(inject);
        expect(m.out, what).toEqual([]);
        expect(m.tall, what).toBeLessThanOrEqual(0.5);
        expect(m.clear, what).toBeGreaterThanOrEqual(4);
        expect(m.scroll, what).toBe(false);
        if (lines) expect(m.twoLines, what).toBe(lines === 2);
      };
      await check(null, null);
      await check(['vs Oct 10:', '20 brews · 200g'], 1);
      await check(['vs Oct 10:', '2,000 brews · 123,456g'], page.viewportSize()!.width <= 480 ? 2 : null);
    }
  },
  {
    // The compare bar's tooltip names the dates it covers (screenshot shows it; the server titles are unit-tested).
    name: 'insights-consumption-compare-tooltip',
    path: () => '/stats?tab=consumption&range=1w&compare=1&by=day',
    act: async (page) => {
      const c = page.locator('.insights-charts canvas').first();
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      // T1: a canvas chart's tip is the shared HTML tip: a bold title, then label/value rows (no "Label: value").
      // Swept from the right until a bar is under the pointer (bars hover by intersection); a few heights, as the legend
      // under the plot takes more lines on narrow screens.
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      // Marks first (colored pixels: a bar, not grey grid/text), so a narrow screen's extra legend rows don't cost dozens of
      // misses; then the old sweep from the right, so a bar still drawing in is found too.
      const sweep: (readonly [number, number])[] = [];
      for (const g of [0.75, 0.6, 0.45]) for (let f = 0.95; f > 0; f -= 0.05) sweep.push([b.x + b.width * f, b.y + b.height * g]);
      for (const [x, y] of [...(await chartPoints(c, false)).slice(0, 12), ...sweep]) {
        await page.mouse.move(x, y);
        // The tip renders a frame or two after the move: wait for it, up to the old 100 ms.
        if (await tip.waitFor({ timeout: 100 }).then(() => true, () => false)) break;
      }
      await expectDataTip(tip);
      await expectTipInView(page, tip);
    }
  },
  {
    name: 'insights-consumption-agg-bags',
    path: () => '/stats?tab=consumption&range=1w&compare=1&unit=bags',
    act: async (page) => {
      await expect(page.locator('.stat-label', { hasText: 'Finished/day' })).toBeVisible();
      await expectDeltasFit(page);
    }
  },
  {
    name: 'insights-consumption-agg-bags-longer',
    path: () => '/stats?tab=consumption&range=1w&compare=before&unit=bags&by=week',
    act: (page) => expectDeltasFit(page)
  },
  { name: 'insights-habits-sticky', path: () => '/stats?tab=habits', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-consumption-tab', viewports: 'two',
    path: () => '/stats?tab=consumption',
    act: async (page) => expect(page.locator('.insights-charts canvas')).toHaveCount(2)
  },
  {
    name: 'insights-consumption-bags-week', viewports: 'two',
    path: () => '/stats?tab=consumption&unit=bags&by=week&compare=1&agg=total',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.stat-label', { hasText: 'Bags finished' })).toBeVisible();
    }
  },
  {
    // The ~21-day ui seed is too short for months, even over all time (ruling P2).
    name: 'insights-consumption-all', viewports: 'two',
    path: () => '/stats?tab=consumption&range=all',
    act: async (page) => {
      // The seed's insights brews reach back 60 days: all time spans months (1w keeps Month disabled).
      await expect(page.getByRole('button', { name: 'Month' })).toBeEnabled();
      await expect(page.locator('.chart-panel canvas')).toHaveCount(3);
    }
  },
  {
    // Notes that change with a control are sentence + suffix line (blank when none): switching the measure never moves the page.
    name: 'insights-note-steady',
    path: () => '/stats?tab=consumption&range=all',
    act: async (page) => {
      const heights = () => page.locator('[data-switched-note]').evaluateAll((ns) => ns.map((n) => Math.round(n.getBoundingClientRect().height)));
      for (const [a, b] of [['?tab=consumption&range=all', '?tab=consumption&range=all&trend=rating'], ['?tab=habits&range=all&measure=grams', '?tab=habits&range=all&measure=rating']]) {
        await gotoReady(page, `/stats${a}`);
        const before = await heights();
        await gotoReady(page, `/stats${b}`);
        const after = await heights();
        expect(before.length).toBeGreaterThan(0);
        expect(after[0]).toBe(before[0]);
        expect(after.slice(-1)).toEqual(before.slice(-1));
        expect(new Set([...before, ...after]).size).toBe(1);
      }
    }
  },
  {
    // D3: Brewed over time's in-chart Measure toggle (the Unit | Brews | Water | Rating), URL state, and the header's alignment.
    name: 'insights-consumption-trend-toggle',
    path: () => '/stats?tab=consumption&range=all&by=week',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.locator('#consumption-chart-brewed') });
      const group = panel.getByRole('group', { name: 'Measure' });
      await expect(group.getByRole('button')).toHaveText(['Grams', 'Brews', 'Water', 'Rating']);
      // One row, inside the panel's content box (never crowded off its edge), every button the same height.
      const [g, p] = [(await group.boundingBox())!, (await panel.boundingBox())!];
      expect(g.x).toBeGreaterThanOrEqual(p.x + 8);
      expect(g.x + g.width).toBeLessThanOrEqual(p.x + p.width - 8);
      const ys = await group.getByRole('button').evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
      expect(new Set(ys).size, 'toggle buttons share a row').toBe(1);
      // The Unit label follows the sticky Unit; Brews / Water switch the chart's title and the URL.
      await page.getByRole('group', { name: 'Unit' }).getByRole('button', { name: 'Bags' }).click();
      await expect(group.getByRole('button').first()).toHaveText('Bags');
      await group.getByRole('button', { name: 'Brews' }).click();
      await expect(page).toHaveURL(/trend=brews/);
      await expect(panel.getByRole('heading', { name: 'Brews over time' })).toBeVisible();
      await group.getByRole('button', { name: 'Water' }).click();
      await expect(page).toHaveURL(/trend=water/);
      await expect(panel.locator('.chart-note')).toContainText('Litres of water poured');
      // Rating: the Ratings menu appears (the rating filters); the line drops the trend legend entry.
      await group.getByRole('button', { name: 'Rating' }).click();
      await expect(page).toHaveURL(/trend=rating/);
      await expect(page.locator('.filter-bar').getByText(/calibrated ratings/i).first()).toBeVisible();
      await expect(panel.locator('canvas')).toHaveCount(1);
      // The first button is the Unit again: back to the sticky Unit, `trend` gone from the URL.
      await group.getByRole('button').first().click();
      await expect(page).not.toHaveURL(/trend=/);
      await expect(page).toHaveURL(/unit=bags/);
      await expect(panel.getByRole('heading', { name: 'Brewed over time' })).toBeVisible();
    }
  },
  {
    name: 'insights-consumption-trend-water-compare', viewports: 'two',
    path: () => '/stats?tab=consumption&range=1m&compare=1&trend=water&by=day',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.locator('#consumption-chart-brewed') });
      await expect(panel.getByRole('button', { name: 'Water' })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('canvas')).toBeVisible();
      await expect(panel.locator('.chart-note')).toContainText('per day');
    }
  },
  // The See all note shares the period line's row, so it appearing or changing moves nothing below it (desktop); on phones it
  // shares the line when it fits (no held empty line). Every tab with the Ratings menu.
  ...(['consumption&trend=rating', 'habits&measure=rating', 'gear', 'leaderboards', 'records', 'brewing', 'water', 'sweetspots'] as const).map((q) => ({
    name: `insights-see-all-no-shift-${q.split('&')[0]}`,
    path: () => `/stats?tab=${q}&range=all`,
    act: async (page: Page) => {
      const row = page.locator('.period-row');
      const note = row.locator('.see-all');
      const top = async () => { const b = (await row.boundingBox())!; return Math.round(b.y + b.height + (await page.evaluate(() => scrollY))); };
      await expect(note).toBeVisible();
      const before = await top();
      const font = (l: Locator) => l.evaluate((e) => { const c = getComputedStyle(e); return [c.fontFamily, c.fontSize, c.fontWeight]; });
      expect(await font(note), 'the note reads in the period line\'s type').toEqual(await font(row.locator('.insights-period')));
      const [r, n] = [(await row.boundingBox())!, (await note.boundingBox())!];
      // Nothing covers another's taps: every point of the period line hit-tests to the period line, not to the note's tip
      // (its inline padding is a 44px tap target) or the note.
      const covered = await row.evaluate((el) => {
        const per = el.querySelector('.insights-period')!, r = per.getBoundingClientRect(), out: string[] = [];
        for (const fy of [0.1, 0.5, 0.9]) for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          if (hit && !per.contains(hit)) out.push(`${fx},${fy}: ${hit.className || hit.tagName}`);
        }
        return out;
      });
      expect(covered, 'the note never covers the period line').toEqual([]);
      if ((page.viewportSize()?.width ?? 0) >= 768) expect(n.y + n.height, 'note on the period line\'s row').toBeLessThanOrEqual(r.y + r.height + 1);
      // Toggling what it says (See all → Back to defaults) moves nothing.
      await note.locator('.filter-clear-all').click();
      // Wait for the click's navigation: /hidden/ matched the old note too, so the poll used to run (and pass) before
      // the note changed, until slow runs let it land (the flake).
      await expect(note).toContainText(/Showing everything/);
      await expect.poll(top).toBe(before);
      await note.locator('.filter-clear-all').click();
      await expect(note).toContainText(/hidden/);
      await expect.poll(top).toBe(before);
    }
  })),
  {
    // The note appearing (Rating on) or going (Brews) leaves the first panel where it was below the period line (where it
    // shares the line; the filter bar's Ratings menu, which can add a row to the bar, aside).
    name: 'insights-see-all-appears-in-place',
    path: () => '/stats?tab=consumption&range=all&by=week',
    act: async (page) => {
      if ((page.viewportSize()?.width ?? 0) < 768) return;
      const row = () => page.locator('.period-row').boundingBox().then((b) => b!.height);
      const first = async () => (await page.locator('.chart-panel').first().boundingBox())!.y - (await page.locator('.period-row').boundingBox())!.y;
      const [y0, h0] = [await first(), await row()];
      await page.getByRole('group', { name: 'Measure' }).getByRole('button', { name: 'Rating' }).click();
      await expect(page.locator('.period-row .see-all')).toBeVisible();
      expect(await row(), 'the row keeps its height').toBeCloseTo(h0, 0);
      expect(await first(), 'content below stays put').toBeCloseTo(y0, 0);
    }
  },
  {
    // Show's third option: Per brew day, one URL value, tile labels follow.
    name: 'insights-consumption-brewday', viewports: 'two',
    path: () => '/stats?tab=consumption&range=all&agg=brewday',
    act: async (page) => {
      const show = page.getByRole('group', { name: 'Show' });
      await expect(show.getByRole('button')).toHaveText(['Avg per day', 'Per brew day', 'Total']);
      await expect(show.getByRole('button', { name: 'Per brew day' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.stat-label', { hasText: 'Brewed/brew day' })).toBeVisible();
      await show.getByRole('button', { name: 'Total' }).click();
      await expect(page).toHaveURL(/agg=total/);
      await show.getByRole('button', { name: 'Avg per day' }).click();
      await expect(page).not.toHaveURL(/agg=/);
    }
  },
  {
    name: 'insights-habits-brewday', viewports: 'two',
    path: () => '/stats?tab=habits&agg=brewday',
    act: async (page) => {
      await expect(page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Per brew day' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.chart-note').first()).toContainText('per brew day');
    }
  },
  {
    // D3: Gear usage over time: Dripper | Grinder and Bars | Lines in the panel header; Water's has Bars | Lines.
    name: 'insights-usage-toggles',
    path: () => '/stats?tab=gear&gearBy=grinder&gearView=lines',
    act: async (page) => {
      const panel = page.locator('[data-section="gear-eras"]');
      await expect(panel.getByRole('button', { name: 'Grinder' })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.getByRole('button', { name: 'Lines' })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('canvas')).toBeVisible();
      await expect(panel.locator('.stacked')).toHaveCount(0);
      // Both groups sit inside the panel, level with the heading's row when it fits.
      const [p, a, b] = [(await panel.boundingBox())!, (await panel.getByRole('group', { name: 'Gear' }).boundingBox())!, (await panel.getByRole('group', { name: 'Bars or lines' }).boundingBox())!];
      for (const x of [a, b]) {
        expect(x.x).toBeGreaterThanOrEqual(p.x + 8);
        expect(x.x + x.width).toBeLessThanOrEqual(p.x + p.width - 8);
      }
      await panel.getByRole('button', { name: 'Bars' }).click();
      await expect(page).toHaveURL(/gearBy=grinder/);
      await expect(page).not.toHaveURL(/gearView=/);
      await expect(panel.locator('.stacked')).toBeVisible();
      await panel.getByRole('button', { name: 'Dripper' }).click();
      await expect(page).not.toHaveURL(/gearBy=/);
      await expect(panel.getByRole('button', { name: 'Dripper' })).toHaveAttribute('aria-pressed', 'true');
    }
  },
  {
    // Each chart keeps its own Bars | Lines: Gear's Lines never reach Water's usage chart.
    name: 'insights-usage-views-independent', viewports: 'two',
    path: () => '/stats?tab=water&gearView=lines&gearBy=grinder',
    act: async (page) => {
      await expect(page.locator('[data-section="water-eras"] .stacked')).toBeVisible();
      await expect(page.locator('[data-section="water-eras"]').getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true');
    }
  },
  {
    name: 'insights-water-usage-lines', viewports: 'two',
    path: () => '/stats?tab=water&waterView=lines',
    act: async (page) => {
      const panel = page.locator('[data-section="water-eras"]');
      await expect(panel.getByRole('button', { name: 'Lines' })).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('canvas')).toBeVisible();
      await panel.getByRole('button', { name: 'Bars' }).click();
      await expect(page).not.toHaveURL(/waterView=/);
      await expect(panel.locator('.stacked')).toBeVisible();
    }
  },
  { name: 'insights-consumption-1w', viewports: 'two', path: () => '/stats?tab=consumption&range=1w',
    act: async (page) => expect(page.getByRole('button', { name: 'Month' })).toBeDisabled() },
  {
    // Delta lines: arrow + change + "from" + the previous value (pace-scaled: change + %); the sentence
    // is visually hidden text. Never clipped or wrapped.
    name: 'insights-1w-compare',
    path: () => '/stats?range=1w&compare=1',
    act: (page) => expectDeltasFit(page)
  },
  { name: 'insights-year', path: () => `/stats?range=${new Date().getFullYear()}&ratings=all` },
  { name: 'insights-compare-2', path: () => '/stats?range=1w&compare=2' },
  {
    // Former native titles, now the shared hover tip (labelTip): a tile's delta sentence, the People switch's help.
    name: 'insights-hover-tips',
    path: () => '/stats?range=1w&compare=2',
    act: async (page) => {
      const tip = page.locator('.cell-tip:popover-open');
      const delta = page.locator('.stat-item .insights-delta').first();
      await delta.hover();
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).toHaveText((await delta.locator('.sr-only').textContent())!);
      await page.getByRole('group', { name: 'People' }).getByRole('button', { name: 'Per person', exact: true }).hover();
      await expectTipInView(page, tip, { inBar: true });
      await expect(tip.locator('.tip-title')).toHaveText('Per person');
      await expect(tip.locator('.tip-lines li')).toHaveCount(1);
    }
  },
  { name: 'insights-ratings-all', path: () => '/stats?ratings=all' },
  {
    // Overview: Totals and Averages each carry the Ratings and Brews switches in their header (no in-tile pills);
    // one URL param each keeps them in sync.
    name: 'insights-ratings-switch-sync', viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      await expect(page.locator('.stat-item [role="group"]')).toHaveCount(0);
      const switches = page.getByRole('group', { name: 'Ratings' });
      await expect(switches).toHaveCount(2);
      await switches.first().getByRole('button', { name: 'All ratings', exact: true }).click();
      await expect(page).toHaveURL(/ratings=all/);
      for (const g of await switches.all()) await expect(g.getByRole('button', { name: 'All ratings', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.mode-tip-button:not([popovertarget="tip-people"])')).toHaveText(['All ratings', 'All ratings']);
      const brews = page.getByRole('group', { name: 'Brews' });
      await expect(brews).toHaveCount(2);
      await brews.last().getByRole('button', { name: 'All brews', exact: true }).click();
      await expect(page).toHaveURL(/dial=all/);
      for (const g of await brews.all()) await expect(g.getByRole('button', { name: 'All brews', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.mode-tip-button:not([popovertarget="tip-people"])')).toHaveText(['All ratings', 'All brews', 'All ratings', 'All brews']);
    }
  },
  ...(['leaderboards', 'habits&measure=rating', 'records', 'sweetspots', 'brewing', 'water', 'gear'] as const).map((t) => ({
    name: `insights-dial-${t.split('&')[0]}`, path: () => `/stats?tab=${t}`,
    act: async (page: Page) => {
      await openSwitches(page);
      const g = page.getByRole('group', { name: 'Brews' }).first();
      await expect(g.getByRole('button', { name: 'Once dialed' })).toHaveAttribute('aria-pressed', 'true');
      await g.getByRole('button', { name: 'All brews', exact: true }).click();
      await expect(page).toHaveURL(/dial=all/);
      await expect(g.getByRole('button', { name: 'All brews', exact: true })).toHaveAttribute('aria-pressed', 'true');
    } })),
  { name: 'insights-dial-all', path: () => '/stats?tab=leaderboards&dial=all' },
  // Captions stay inside their tiles in both dial states (checkLayout).
  { name: 'insights-dial-all-overview', path: () => '/stats?dial=all' },
  { name: 'insights-dial-all-records', path: () => '/stats?tab=records&dial=all' },
  { name: 'insights-dial-all-compare', path: () => '/stats?dial=all&compare=1' },
  // ui-rules 26: Ratings and Brews are one menu button in the sticky bar, only where they apply (none in tiles or panels);
  // on a tab where it applies to some modes only, it stays greyed in the others so the bar keeps its size.
  ...(['sweetspots', 'water', 'gear', 'brewing', 'records', 'leaderboards', 'habits&measure=rating',
    'leaderboards&rank=brews', 'habits', 'consumption', 'milestones', 'insights'] as const).map((t) => ({
    name: `insights-switch-placement-${t.replace(/\W+/g, '-')}`, path: () => `/stats?tab=${t}`,
    act: async (page: Page) => {
      const on = !/^(milestones|insights)$/.test(t);
      const off = /rank=|^(habits|consumption)$/.test(t);
      const bar = page.locator('.filter-bar');
      await expect(bar.getByRole('button', { name: /^Ratings and brews/ })).toHaveCount(on ? 1 : 0);
      if (off) await expect(bar.getByRole('button', { name: /^Ratings and brews/ })).toHaveAttribute('aria-disabled', 'true');
      else if (on) await expect(bar.getByRole('button', { name: /^Ratings and brews/ })).not.toHaveAttribute('aria-disabled');
      await expect(page.getByRole('group', { name: 'Ratings', exact: true })).toHaveCount(0); // closed: not rendered
      const { width, height } = page.viewportSize()!;
      // The tab's own controls row (rendered inside the bar) is measured apart: these limits are for the shared controls.
      const h = (await bar.boundingBox())!.height - (await tabRowHeight(bar));
      // Phone landscape: one short row with People shown; phones: at most three rows of controls.
      if (height <= 450) {
        if (!/^(sweetspots|water|gear|brewing|milestones)$/.test(t)) await expect(bar.getByRole('group', { name: 'People' })).toBeVisible(); // household > 1 in the seed
        expect(h).toBeLessThanOrEqual(50);
      }
      // Phones (gate r2 A3): three controls per row, so at most three rows (View Period Compare / menu Filters /
      // People): 220px measured on Records, Leaderboards and Habits by rating; was 236 (466 at 360-420, one column).
      else if (width <= 480) expect(h).toBeLessThanOrEqual(230);
      // Every bar label's top and every control's top are level within 1px per row (a taller Filters button
      // lifted its "Show" label 3px at 768/1280/landscape). Rows: tops clustered within 20px.
      const spreads = await bar.evaluate((c) => {
        const tops = (sel: string) => [...c.querySelectorAll(sel)].map((e) => e.getBoundingClientRect())
          .filter((r) => r.height > 2).map((r) => r.top).sort((a, b) => a - b);
        const rows = (ts: number[]) => ts.reduce<number[][]>((rs, t) => {
          const last = rs.at(-1);
          if (last && t - last[0] < 20) last.push(t); else rs.push([t]);
          return rs;
        }, []).map((r) => Math.max(...r) - Math.min(...r));
        return { labels: rows(tops('.form-field > span')),
          controls: rows(tops('select, .menu-button, .filters-button, .people-switch button')) };
      });
      for (const [k, v] of Object.entries(spreads)) expect(Math.max(...v), `${k} level per row`).toBeLessThanOrEqual(1);
      if (!on || off) return;
      await openSwitches(page);
      for (const name of ['Ratings', 'Brews']) {
        const g = page.getByRole('group', { name, exact: true });
        await expect(g).toHaveCount(1);
        await expect(g).toBeVisible();
        expect(await g.evaluate((e) => !!e.closest('.filter-bar'))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('group', { name: 'Ratings', exact: true })).toHaveCount(0);
    } })),
  {
    // The menu's label tracks the state. Toggling keeps the scroll position (and any content shift is not ours):
    // checked after the navigation settles, ±5 px.
    name: 'insights-dial-records-sticky', path: () => '/stats?tab=records',
    act: async (page) => {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 3));
      const y = await page.evaluate(() => scrollY);
      // Phones: the bar has scrolled into the short row; the menu is used from the expanded bar, which stays open across the changes.
      const phone = isPhone(page) && (await page.locator('.cbar').count()) > 0;
      if (phone) await expandBar(page);
      const block0 = await outerHeight(page, '.cbar-body'); // 0 on desktop (display: contents)
      const menu = page.locator(phone ? '.cbar.overlay' : '.filter-bar').getByRole('button', { name: /^Ratings and brews/ });
      await expect(menu).toBeInViewport();
      for (const [name, button, url, label] of [['Brews', 'All brews', /dial=all/, /Calibrated ratings · All brews/], ['Ratings', 'All ratings', /ratings=all/, /All ratings · All brews/]] as const) {
        await menu.click();
        await page.getByRole('group', { name, exact: true }).getByRole('button', { name: button, exact: true }).click();
        await expect(page).toHaveURL(url);
        await expect(menu).toHaveAccessibleName(label);
        await page.waitForTimeout(600);
        // On phones the block above the content shrinks when the setting hides its "hidden by your settings" note; the page keeps what
        // is on screen still, so the scroll moves by exactly that change.
        const shift = (await page.evaluate(() => scrollY)) - y - ((await outerHeight(page, '.cbar-body')) - block0) * (phone ? 1 : 0);
        expect(Math.abs(shift)).toBeLessThanOrEqual(5);
        await page.keyboard.press('Escape');
      }
    }
  },
  {
    // Reset clears every choice but a non-default tab; tab choices survive a tab switch.
    name: 'insights-reset', viewports: 'two',
    path: () => '/stats?tab=habits&range=1w&measure=grams&ratings=all',
    act: async (page) => {
      await page.getByLabel('View').selectOption('consumption');
      await expect(page).toHaveURL(/tab=consumption/);
      await expect(page).toHaveURL(/measure=grams/);
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page).toHaveURL(/\/stats\?tab=consumption$/);
    }
  },
  {
    // Consumption: 4 tiles in the same columns as Totals, deltas on the three rates only.
    name: 'insights-consumption', viewports: 'two',
    path: () => '/stats?range=1w&compare=1',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Consumption' }) });
      await expect(panel.locator('.stat-label')).toHaveText(['Per day', 'Per week', 'Per month', 'Time to clear']);
      const clear = panel.locator('.stat-item').last();
      await expect(clear.locator('.insights-delta')).toHaveCount(0);
      await expect(clear.locator('.stat-value')).toHaveText(/^(—|[\d,]+ days)$/);
    }
  },
  {
    // A longer window: groups in the Compare menu, totals paced to the period.
    name: 'insights-compare-longer',
    path: () => '/stats?range=1w&compare=before',
    act: async (page) => {
      const compare = page.getByLabel('Compare');
      await expect(compare).toHaveValue('before');
      expect(await compare.locator('optgroup').evaluateAll((gs) => gs.map((g) => g.getAttribute('label'))))
        .toEqual(['Same length', 'Longer', 'Custom']);
      const pace = page.locator('.insights-pace');
      await expect(pace.first()).toBeVisible();
      for (const tx of await pace.allTextContents()) expect(tx).toMatch(/^vs \S+ at that pace$/);
      // The pace line sits on its own line: under its delta, above the caption, inside the tile.
      const overlaps = await page.locator('.stat-item:has(.insights-pace)').evaluateAll((tiles) =>
        tiles.flatMap((tile) => {
          const b = (s: string) => tile.querySelector(s)!.getBoundingClientRect();
          const [p, d, c, o] = [b('.insights-pace'), b('.insights-delta'), b('.stat-caption'), tile.getBoundingClientRect()];
          const out: string[] = [];
          if (p.top < d.bottom - 0.5) out.push('pace overlaps delta');
          if (p.bottom > c.top + 0.5) out.push('pace overlaps caption');
          if (p.left < o.left || p.right > o.right) out.push('pace outside tile');
          return out;
        })
      );
      expect(overlaps).toEqual([]);
      // A paced count keeps one decimal under 10, whole numbers from 10.
      const brews = page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: /^Brews$/ }) });
      await expect(brews.locator('.insights-pace')).toHaveText(/^vs (\d\.\d|\d{2,}[\d,]*) at that pace$/);
      // Trend color: by polarity, Spend rising is bad (red), Brews rising is good (green).
      const delta = (label: RegExp) => page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: label }) }).locator('.insights-delta');
      // A neutral tile (no good direction) goes by direction: up green, down red.
      const grams = ((await delta(/^Grams$/).textContent()) ?? '').trim()[0];
      if (grams !== 'N') await expect(delta(/^Grams$/)).toHaveClass(grams === '▲' ? /trend-good/ : /trend-bad/);
      const dir = async (label: RegExp) => ((await delta(label).textContent()) ?? '').trim()[0];
      const spend = await dir(/^Spend$/);
      if (spend !== 'N') await expect(delta(/^Spend$/)).toHaveClass(spend === '▲' ? /trend-bad/ : /trend-good/);
      const brewsDir = await dir(/^Brews$/);
      if (brewsDir !== 'N') await expect(delta(/^Brews$/)).toHaveClass(brewsDir === '▲' ? /trend-good/ : /trend-bad/);
    }
  },
  {
    // Custom range…: a dialog with a draft (URL untouched, no input focused) until
    // Apply; a wrong order disables Apply, Cancel applies nothing. Navigation only.
    name: 'insights-compare-custom',
    path: () => '/stats?range=1w',
    act: async (page) => {
      const before = page.url();
      await page.getByLabel('Compare').selectOption('custom');
      await expect(page.locator('dialog[open]')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      await expectDialogInViewport(page);
      expect(page.url()).toBe(before); // drafting never touches the URL
      const apply = page.getByRole('button', { name: 'Apply', exact: true });
      const from = page.getByLabel('From', { exact: true });
      const to = page.getByLabel('To', { exact: true });
      await from.fill(daysAgo(2));
      await to.fill(daysAgo(20));
      await expect(apply).toBeDisabled();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      expect(page.url()).toBe(before); // Cancel applies nothing
      await page.getByLabel('Compare').selectOption('custom');
      await from.fill(daysAgo(20));
      await to.fill(daysAgo(8));
      await apply.click();
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`compare=${daysAgo(20)}\\.\\.${daysAgo(8)}`));
      await expect(page.locator('.insights-period')).toContainText(' · vs ');
      // Enter in a date input applies too (once the dates are valid).
      await page.getByRole('button', { name: 'Compare dates' }).click();
      await to.fill(daysAgo(9));
      await to.press('Enter');
      await expect(page).toHaveURL(new RegExp(`compare=${daysAgo(20)}\\.\\.${daysAgo(9)}`));
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await page.waitForTimeout(300); // let the focused Dates… button's color transition settle for the screenshot
    }
  },
  {
    // The Custom range dialog open, for the screenshots: inside the viewport (landscape is 333px
    // tall), Apply and Cancel on screen.
    name: 'insights-compare-custom-open',
    path: () => '/stats?range=1w',
    act: async (page) => {
      await page.getByLabel('Compare').selectOption('custom');
      await expect(page.locator('dialog[open]')).toBeVisible();
      await expectDialogInViewport(page);
      await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport();
    }
  },
  {
    // A custom Period on the overview (compare 1 = the previous same-length window), applied from
    // the Period dialog; the select shows the span. Navigation only.
    name: 'insights-custom-range',
    path: () => `/stats?range=${daysAgo(40)}..${daysAgo(10)}&compare=1`,
    act: async (page) => {
      const period = page.getByLabel('Period', { exact: true });
      await expect(period).toHaveValue('custom');
      await expect(period.locator('option:checked')).toHaveText(/\d{4}/);
      await expect(page.locator('.insights-period')).toContainText(' · vs ');
      const before = page.url();
      await page.getByRole('button', { name: 'Period dates' }).click();
      await expect(page.locator('dialog[open]')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      await expectDialogInViewport(page);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(page.url()).toBe(before);
      await period.selectOption('1w');
      await expect(page).toHaveURL(/range=1w/);
      await expect(page).toHaveURL(/compare=1/);
    }
  },
  {
    // Period › Custom range… opens the shared dialog (no autofocus, fits the viewport); Apply keeps
    // the tab. A consumption `by` that no longer fits is dropped.
    name: 'insights-custom-range-open',
    path: () => '/stats?tab=consumption&by=month&range=1w',
    act: async (page) => {
      await page.getByLabel('Period', { exact: true }).selectOption('custom');
      await expect(page.locator('dialog[open]')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      await expectDialogInViewport(page);
      await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport();
      await page.getByLabel('From', { exact: true }).fill(daysAgo(20));
      await page.getByLabel('To', { exact: true }).fill(daysAgo(2));
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`range=${daysAgo(20)}\\.\\.${daysAgo(2)}`));
      await expect(page).toHaveURL(/tab=consumption/);
      await expect(page).not.toHaveURL(/by=month/);
    }
  },
  {
    // Per person: one switch drives `people`; total tiles get the suffix, averages don't;
    // a count under 10 keeps one decimal. Navigation only.
    name: 'insights-people-person', viewports: 'two',
    path: () => '/stats?range=1w&compare=1',
    act: async (page) => {
      const people = page.getByRole('group', { name: 'People' });
      await people.getByRole('button', { name: 'Per person', exact: true }).click();
      await expect(page).toHaveURL(/people=person/);
      await expect(people.getByRole('button', { name: 'Per person', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const tile = (label: RegExp) => page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: label }) });
      await expect(tile(/^Brews\s+per person\s*$/).locator('.stat-value')).toHaveText(/^(\d\.\d|\d{2,}[\d,]*)$/);
      await expect(tile(/^Rated\s+(Calibrated|All) ratings\s+per person\s*$/)).toHaveCount(1);
      await expect(tile(/^Avg dose$/)).toHaveCount(1);
      await tile(/^Grams\s+per person\s*$/).getByRole('button', { name: 'per person' }).click();
      await expect(page.locator('.mode-tip:popover-open')).toContainText('even split');
    }
  },
  {
    // Mouse hover opens a click-for-explanation tip and leaving closes it; a click then keeps it open.
    // Touch viewports (no hover) only get the tap path, covered by insights-ratings-tip.
    name: 'insights-tip-hover', viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      const btn = page.locator('.mode-tip-button:not([popovertarget="tip-people"])').first();
      const tip = page.locator('#tip-rated');
      if (!(await page.evaluate(() => matchMedia('(hover: hover)').matches))) {
        await btn.click();
        await expect(tip).toBeVisible();
        return;
      }
      await btn.hover();
      await expect(tip).toBeVisible();
      await page.mouse.move(2, 2);
      await expect(tip).toBeHidden();
      await btn.hover();
      await btn.click();
      await expect(tip).toBeVisible();
      await btn.focus();
      await page.mouse.move(2, 2);
      await expect(tip).toBeHidden();
      await btn.focus();
      await page.keyboard.press('Enter'); // keyboard keeps the toggle
      await expect(tip).toBeVisible();
    }
  },
  {
    // Score's ⓘ opens a dialog: hover shows a short tip instead, a click swaps it for the dialog. And a tip
    // closed by Escape after a hover reopens on the next click (no stale hover flag).
    name: 'insights-tip-hover-dialog', viewports: 'two',
    path: () => '/stats?tab=leaderboards',
    act: async (page) => {
      if (!(await page.evaluate(() => matchMedia('(hover: hover)').matches))) return;
      const score = page.getByRole('button', { name: 'Score', exact: true });
      const tip = page.locator('#tip-score');
      await score.hover();
      await expect(tip).toBeVisible();
      await expect(tip.locator('.tip-title')).toHaveText('Score');
      await expect(tip.locator('.tip-lines li')).toHaveText(['How each score is worked out.', 'Click for the full explanation.']);
      await page.mouse.move(2, 2);
      await expect(tip).toBeHidden();
      await score.hover();
      await score.click();
      await expect(tip).toBeHidden();
      await expect(page.locator('dialog.how-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.mouse.move(2, 2);
      const rank = page.locator('.mode-tip-button', { hasText: 'Rank by' });
      const rankTip = page.locator('#tip-rank');
      await rank.hover();
      await expect(rankTip).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(rankTip).toBeHidden();
      await rank.click();
      await expect(rankTip).toBeVisible();
    }
  },
  {
    // Tapping the caption's mode word opens its explanation (the touch path).
    name: 'insights-ratings-tip',
    path: () => '/stats',
    act: async (page) => {
      await page.locator('.mode-tip-button:not([popovertarget="tip-people"])').first().click();
      const tip = page.locator('#tip-rated');
      await expect(tip).toBeVisible();
      await expect(tip.locator('.tip-title')).toHaveText('Calibrated ratings');
      await expect(tip.locator('.tip-lines li').first()).toHaveText(/^Calibrated ratings leaves out ratings before \w+ \d{4}, while the rating scale was still settling\.$/);
      await expect(tip.locator('.tip-lines li').nth(1)).toContainText('dial-in brews');
      await expect(page.locator('.mode-tip-button:not([popovertarget="tip-people"])').first()).toHaveAccessibleDescription(/still settling/);
      const r = (await tip.boundingBox())!;
      const vw = page.viewportSize()!.width;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(vw);
    }
  },
  {
    name: 'insights-leaderboards',
    path: () => '/stats?tab=leaderboards',
    act: async (page) => {
      await expect(page.locator('.board')).toHaveCount(12);
      await expectEqualBoardHeights(page);
      await expectBarHover(page);
      await expectSampleChips(page);
    }
  },
  { name: 'insights-sample-note', path: () => '/stats?tab=leaderboards&avg=raw',
    act: async (page) => {
      const note = page.locator('.sample-note').first();
      await expect(note).toHaveText(/^Only \d+ (bags?|brews?)$/);
      // A caution label: solid amber chip, dark ink (4.5:1+), one line, never past the viewport or its row.
      const chips = await page.locator('.sample-note .sample-chip').evaluateAll((els) => els.map((el) => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect(), row = el.closest('.board-row')!.getBoundingClientRect();
        const lum = (c: string) => { const [R, G, B] = c.match(/\d+/g)!.slice(0, 3).map((v) => { const x = +v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
        const [hi, lo] = [lum(cs.color), lum(cs.backgroundColor)].sort((a, b) => b - a);
        return { oneLine: r.height < 1.8 * parseFloat(cs.fontSize), inRow: r.right <= row.right + 1 && r.left >= row.left - 1, inView: r.right <= innerWidth, ratio: (hi + 0.05) / (lo + 0.05), icon: !!el.querySelector('svg.icon') };
      }));
      for (const c of chips) expect(c).toMatchObject({ oneLine: true, inRow: true, inView: true, icon: true });
      for (const c of chips) expect(c.ratio).toBeGreaterThanOrEqual(4.5);
      await note.click();
      const tip = page.locator('[popover]:popover-open').filter({ hasText: 'Small sample' });
      await expect(tip).toContainText('Low confidence');
      await expect(tip).toContainText(/Rated brews\s*\d+/);
      await expectSampleChips(page);
      // The aria-label lists the same order: counts, then (strength,) then the Low confidence title and message.
      expect(await note.getAttribute('aria-label')).toMatch(/Rated brews \d+ · (Likely|Possible · )?.*Low confidence · Small sample: only/);
      // The Low confidence block is last in the tip, its title and reason in the chip's amber (4.5:1+ on the tip).
      const block = await tip.evaluate((el) => {
        const last = el.lastElementChild!, t = last.querySelector('.tip-title')!, bg = getComputedStyle(el).backgroundColor;
        const lum = (c: string) => { const [R, G, B] = c.match(/\d+/g)!.slice(0, 3).map((v) => { const x = +v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
        const [hi, lo] = [lum(getComputedStyle(t).color), lum(bg)].sort((a, b) => b - a);
        return { last: last.className, title: t.textContent, ratio: (hi + 0.05) / (lo + 0.05) };
      });
      expect(block).toMatchObject({ last: 'tip-block caution', title: 'Low confidence' });
      // Caveats end the tip: the count rows, then (a strength block, then) the Low confidence title and message.
      expect(await tip.evaluate((el) => { const k = [...el.children].map((c) => c.className); return k.slice(k.indexOf('tip-rows tip-counts'))[0] + '|' + k.at(-1); })).toBe('tip-rows tip-counts|tip-block caution');
      expect(block.ratio).toBeGreaterThanOrEqual(4.5);
      // One look: a small row's name and value are the muted token's color (not faded by opacity).
      await page.mouse.move(0, 0); // off the row: hover turns its text ink
      const row = page.locator('.board-row.small-sample').first();
      await expect.poll(() => row.evaluate((el) => {
        const c = (e: Element | null) => (e ? getComputedStyle(e).color : null);
        const probe = document.createElement('i');
        probe.style.color = 'var(--color-text-muted)';
        el.append(probe);
        const muted = c(probe);
        probe.remove();
        return [c(el.querySelector('.name, .who a')), c(el.querySelector('.val'))].every((x) => x === muted);
      })).toBe(true); // polled: the hover color transition (150ms) settles
    } },
  { name: 'insights-sample-marks', path: () => '/stats?tab=brewing&grinder=zp6-special',
    act: async (page) => {
      const marks = page.locator('.small-sample-mark');
      expect(await marks.count()).toBeGreaterThan(0);
      for (const m of await marks.all()) {
        const [bg, op] = await m.evaluate((el) => [getComputedStyle(el).backgroundImage, getComputedStyle(el).opacity]);
        expect(bg).toContain('gradient');
        expect(op).toBe('1');
        // Stripes plus the amber corner fold.
        if (!(await m.evaluate((el) => el.classList.contains('clip')))) {
          // A 9px fold; its corner (top left, top right on a left-pointing bar) is expectFoldCorners'.
          expect(await m.evaluate((el) => getComputedStyle(el).backgroundSize)).toBe('9px 9px, auto');
        }
      }
      await expectFoldCorners(page);
      // A clipped bar's cut end is an arrow tip, not a dark cap.
      for (const c of await page.locator('.bar.clip').all()) expect(await c.evaluate((el) => getComputedStyle(el).clipPath)).toContain('polygon');
      await expect(page.locator('body')).not.toContainText(/Striped:|Few brews|few brews/i);
      await expect(page.locator('.pale, .faded, .few')).toHaveCount(0);
    } },
  { name: 'insights-sample-habits', viewports: 'two', path: () => '/stats?tab=habits&measure=rating&range=all',
    act: async (page) => expect(page.locator('.heat-cell.small-sample-mark').first()).toBeVisible() },
  { name: 'insights-settle-dripper-water', viewports: 'two', path: () => '/stats?tab=brewing&range=all',
    act: async (page) => {
      for (const k of ['dripper', 'water']) {
        const sec = page.locator(`[data-section="brewing-settle-${k}"]`);
        await expect(sec).toBeVisible();
        expect(await sec.locator('.settle-cols .col').count()).toBeGreaterThanOrEqual(2);
        await expect(sec.locator('.chart-note')).not.toContainText('filter not applied');
      }
    } },
  { name: 'insights-settle-own-axis', viewports: 'two', path: () => '/stats?tab=brewing&range=all&dripper=V60',
    act: async (page) => {
      const sec = page.locator('[data-section="brewing-settle-dripper"]');
      await expect(sec).toBeVisible();
      expect(await sec.locator('.settle-cols .col').count()).toBeGreaterThanOrEqual(2);
      await expect(sec.locator('.chart-note')).toContainText('Dripper filter not applied');
      await expect(sec.locator('.settle-cols .col').first()).toHaveAttribute('aria-label', /Median settle brew/);
    } },
  { name: 'insights-sample-legend', viewports: 'two', path: () => '/stats?tab=brewing',
    act: async (page) => {
      await page.locator('[data-section="brewing-rest"] .mode-tip-button').first().click();
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Only 2 bags');
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Low confidence: under 3 bags or 10 rated brews (4 for one coffee).');
      await expect(page.locator('.mode-tip:popover-open .sample-chip')).toBeVisible();
    } },
  { name: 'insights-strength-badges', viewports: 'two', path: () => '/stats?tab=sweetspots',
    act: async (page) => {
      // The strength badges read Likely / Possible, never Solid / Hint; the legend explains them and "no badge".
      for (const t of await page.locator('.hl-badge').allTextContents()) expect(t).toMatch(/^(Likely|Possible|Early)$/);
      await expect(page.locator('body')).not.toContainText(/\b(Solid|Hint)\b/);
      await page.locator('[data-section="spots-cards"] .mode-tip-button').first().click();
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Likely / Possible: the gap is 2×+ / 1.5–2× its margin of error (about 95% / 87% sure).');
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Early: ahead or looking tied, but too few bags to call.');
    } },
  {
    // Overview's Recent panel: last 10 brews (bar = rating on the 10 scale) and last 10 coffees finished.
    name: 'insights-recent',
    path: () => '/stats',
    act: async (page) => {
      const panel = page.locator('section.recent');
      await expect(panel.getByRole('heading', { name: 'Last 10 brews' })).toBeVisible();
      await expect(panel.getByRole('heading', { name: 'Last 10 coffees finished' })).toBeVisible();
      await expect(panel.locator('.board-head .val')).toHaveText(['Rating', 'Days open']);
      // Recent is the last panel on Overview.
      await expect(page.locator('section.chart-panel').last()).toHaveClass(/recent/);
      const lists = panel.locator('.board-rows');
      await expect(lists).toHaveCount(2);
      // Stacked: the brews list sits above the finished list.
      const [a, b] = await lists.evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect()));
      expect(b.top).toBeGreaterThan(a.bottom - 1);
      // The seed has more than 10 brews and finished coffees, so each list has a footer with Show more only.
      await expect(panel.locator('.top-foot')).toHaveCount(2);
      for (const f of await panel.locator('.top-foot').all()) {
        await expect(f.getByRole('button', { name: 'Show more' })).toBeVisible();
        await expect(f.getByRole('button', { name: 'Show less' })).toHaveCount(0);
      }
      expect(await lists.first().locator('.board-row.bar').count()).toBeGreaterThan(0);
      await expect(lists.first().locator('.board-row.bar a').first()).toHaveAttribute('href', /^\/coffees\//);
      await expectBarHover(page);
    }
  },
  {
    // The seed has fewer than 50 finished coffees: every row shows, so the footer is Show less only.
    name: 'insights-recent-short-list',
    viewports: 'two',
    path: () => '/stats?recentc=50',
    act: async (page) => {
      const foot = page.locator('section.recent .top-foot').nth(1);
      await expect(foot.getByRole('button', { name: 'Show less' })).toBeVisible();
      await expect(foot.getByRole('button', { name: 'Show more' })).toHaveCount(0);
    }
  },
  {
    // Both Recent lists ignore the Caffeine filter: every coffee and its rating, decaf included.
    name: 'insights-recent-ignores-caffeine',
    viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      const text = () => page.locator('section.recent .board-rows').allInnerTexts();
      const base = await text();
      for (const c of ['decaf', 'caffeinated', 'all']) {
        await gotoReady(page, `/stats?caffeine=${c}`);
        expect(await text(), c).toEqual(base);
      }
    }
  },
  {
    // Recent expanded: Show less sits left of Show more; rows read row by row in two columns (one on phones).
    name: 'insights-recent-more',
    path: () => '/stats?recent=20',
    act: async (page) => {
      const panel = page.locator('section.recent');
      await expect(panel.getByRole('heading', { name: 'Last 20 brews' })).toBeVisible();
      const foot = panel.locator('.top-foot').first();
      const [less, more] = await Promise.all(['Show less', 'Show more'].map((n) => foot.getByRole('button', { name: n }).boundingBox()));
      expect(less!.x).toBeLessThan(more!.x);
      const li = panel.locator('.board-rows').first().locator('li');
      const [a, b, c] = await Promise.all([0, 1, 2].map((i) => li.nth(i).boundingBox()));
      if (page.viewportSize()!.width > 640) {
        expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
        expect(b!.x).toBeGreaterThan(a!.x);
        expect(c!.y).toBeGreaterThan(a!.y + 10);
        expect(Math.abs(c!.x - a!.x)).toBeLessThanOrEqual(1);
      } else {
        expect(b!.y).toBeGreaterThan(a!.y + 10);
        expect(Math.abs(b!.x - a!.x)).toBeLessThanOrEqual(1);
      }
    }
  },
  {
    // Show more / Show less on the brews list scrolls its footer's button to the screen bottom (as Records does).
    name: 'insights-recent-show-more-scroll',
    path: () => '/stats',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const lift = () => page.evaluate(() => { const t = document.querySelector('.bottom-tabs'); return t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect().height : 0; });
      const foot = page.locator('section.recent .top-foot').first();
      const gap = () => foot.getByRole('button').last().evaluate((el) => innerHeight - el.getBoundingClientRect().bottom);
      const click = async (name: string) => { await foot.evaluate((el) => el.scrollIntoView({ block: 'center' })); const b = (await foot.getByRole('button', { name }).boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
      await click('Show more');
      await expect(page).toHaveURL(/recent=20/);
      const l = await lift();
      await expectClearOfBackToTop(page, foot.getByRole('button').last());
      const bttUp = async () => ((await page.getByRole('button', { name: 'Back to top' }).count()) ? 64 : 0);
      await expect.poll(async () => Math.abs((await gap()) - l - (await bttUp()))).toBeLessThanOrEqual(2);
      await click('Show less');
      await expect(page).not.toHaveURL(/recent=/);
      await expectClearOfBackToTop(page, foot.getByRole('button').last());
      await expect.poll(async () => Math.abs((await gap()) - l - (await bttUp()))).toBeLessThanOrEqual(2);
    }
  },
  {
    name: 'insights-leaderboards-avg',
    path: () => '/stats?tab=leaderboards&avg=best&range=12m&compare=1',
    act: async (page) => {
      await expect(page.getByRole('combobox', { name: 'Score' })).toHaveValue('best');
      await expect(page.getByRole('combobox', { name: 'Rank by' })).toHaveValue('rating');
      // Fields sharing a row share label line and control box.
      const f = await page.locator('.rank-bar .form-field').evaluateAll((els) =>
        els.map((e) => {
          const l = e.firstElementChild!.getBoundingClientRect();
          const c = e.lastElementChild!.getBoundingClientRect();
          return { lt: l.top, ct: c.top, cb: c.bottom };
        })
      );
      expect(f).toHaveLength(2);
      for (const x of f) for (const y of f) {
        if (Math.abs(x.ct - y.ct) > 20) continue; // wrapped to another row
        expect(Math.abs(x.lt - y.lt), 'label top').toBeLessThanOrEqual(1);
        expect(Math.abs(x.ct - y.ct), 'control top').toBeLessThanOrEqual(1);
        expect(Math.abs(x.cb - y.cb), 'control bottom').toBeLessThanOrEqual(1);
      }
      await expect(page.locator('.board-row small').first()).toContainText(/brews? at \d/);
      await expect(page.locator('.board .move').first()).toHaveAttribute('aria-label', /^(up \d+ places?|down \d+ places?|unchanged|new)$/);
      await expectEqualBoardHeights(page);
    }
  },
  {
    // How scores work: opens from the Score label, fits the viewport (scrolls inside on landscape),
    // closes on Escape; nothing in the URL.
    name: 'insights-leaderboards-how-scores',
    path: () => '/stats?tab=leaderboards',
    act: async (page) => {
      await page.getByRole('button', { name: 'Score', exact: true }).click();
      const dlg = page.getByRole('dialog', { name: 'How scores work' });
      await expect(dlg).toBeVisible();
      await expect(dlg).toContainText('Confidence adj. (strong)');
      await expect(dlg.locator('h3')).toHaveText(['Default', 'Average', 'Peak']); // every entry under a group header
      await expect(dlg).toContainText('Average (3+ bags) (default for other boards)');
      await expect(dlg).toContainText('Confidence adj. (light) (default for Coffees)');
      // Setting names in the link brown, their "(default for ...)" in green, text color only (user, 2026-10-17).
      const inks = await dlg.evaluate((d) => {
        const probe = (v: string) => { const s = document.createElement('span'); s.style.color = `var(${v})`; d.append(s); const c = getComputedStyle(s).color; s.remove(); return c; };
        const col = (sel: string) => [...d.querySelectorAll(sel)].map((e) => getComputedStyle(e).color);
        return { accent: probe('--color-accent'), fresh: probe('--color-fresh'), names: col('.setting-name'), notes: col('.setting-note') };
      });
      expect(inks.names.length).toBeGreaterThan(7);
      expect(new Set(inks.names)).toEqual(new Set([inks.accent]));
      expect(inks.notes).toEqual([inks.fresh, inks.fresh]);
      // Bare URL: the Score menu reads Default (each board's own); no avg param.
      await expect(page.getByRole('combobox', { name: 'Score' })).toHaveValue('');
      await expectDialogInViewport(page);
      await expect(dlg.getByRole('button', { name: 'Close', exact: true }).last()).toBeInViewport();
      expect(page.url()).not.toContain('how');
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
    }
  },
  {
    // The Overview's Cost per brew (an average, rarely whole cents) carries the same tip.
    name: 'insights-overview-usd-tip',
    path: () => '/stats',
    act: async (page) => {
      await page.locator('#overview-cost-per-brew .stat-value .text-tip').click();
      const tip = page.locator('.float-tip');
      await expect(tip.locator('dt')).toHaveText(['To 4 decimals']);
      await expectTipInView(page, tip);
    }
  },
  {
    // A dollar amount rounded to cents carries the value to 4 decimals in the shared tip (Usd; user, 2026-10-17).
    name: 'insights-leaderboards-usd-tip',
    path: () => '/stats?tab=leaderboards&rank=ppg',
    act: async (page) => {
      await page.locator('[data-board="coffees"] .val .text-tip').first().click();
      const tip = page.locator('.float-tip');
      await expect(tip.locator('dt')).toHaveText(['To 4 decimals']);
      await expect(tip.locator('dd')).toHaveText(/^\$\d+\.\d{3,4}\/g$/);
      await expectTipInView(page, tip);
    }
  },
  {
    // Coffees default to k2 (shrunk by brews): a row's value tip shows the shrunk score beside the plain average
    // (user ruling 2026-10-17), opening from the value text over the row's stretched link.
    name: 'insights-leaderboards-coffee-tip',
    path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const val = page.locator('[data-board="coffees"] .val .text-tip').first();
      await val.click();
      const tip = page.locator('.float-tip');
      await expect(tip.locator('dt')).toHaveText(['Confidence adj. (light)', 'Plain average']);
      await expectTipInView(page, tip);
      await expect(page).toHaveURL(/tab=leaderboards/); // the tap opened the tip, not the coffee
      await expectEqualBoardHeights(page);
    }
  },
  {
    // A group board's value tip gives its score ± 1 SE; a board that differs by less than its noise is named in one
    // line under the boards (user ruling 2026-10-17).
    name: 'insights-leaderboards-se-tip',
    path: () => '/stats?tab=leaderboards&range=all&avg=raw',
    act: async (page) => {
      const val = page.locator('[data-board="roasters"] .val .text-tip').first();
      await val.evaluate((el) => el.scrollIntoView({ block: 'start' })); // phone landscape: the sticky bar (with the tab's controls) leaves little room
      await val.click();
      const tip = page.locator('.float-tip');
      await expect(tip.locator('dd').first()).toHaveText(/^\d+\.\d ± \d+\.\d$/);
      await expect(tip.locator('dt .setting-name').first()).toHaveText('Raw average'); // a setting name in a tip (ui-rules 48)
      await expect(tip.locator('.setting-name', { hasText: 'once dialed' })).toHaveCount(1);
      await expect(tip.locator('.tip-note')).toHaveText(/standard error/);
      await expectTipInView(page, tip);
      await expect(page.locator('.noise-note')).toHaveText(/differ by less than their noise/);
      // Dial-in brews skipped: the row shows the scored count, its tip both (coordinator ruling 2026-10-17).
      const [scored, rated] = (await tip.locator('p, li, div').filter({ hasText: /scored once dialed/ }).last().innerText())
        .match(/(\d+) rated brews?, (\d+) scored/)!.slice(1).reverse().map(Number);
      expect(scored).toBeLessThan(rated);
      await expect(page.locator('[data-board="roasters"] .board-row').first()).toContainText(`${scored} brew`);
      await expectEqualBoardHeights(page);
    }
  },
  {
    // A row's value is dotted and tipped only when the tip adds something (user, 2026-10-17): both counts, a ±, or a
    // plain average that differs from the score. One rated coffee (The Picky Chemist, all brews): its Confidence adj.
    // score shrinks toward its own mean, so it equals the plain average; the tip would only repeat the row.
    name: 'insights-leaderboards-tip-adds', viewports: 'two',
    path: () => '/stats?tab=leaderboards&range=all&dial=all&roaster=The%20Picky%20Chemist',
    act: async (page) => {
      const val = page.locator('[data-board="coffees"] .board-row.bar .val');
      await expect(val).toHaveCount(1);
      await expect(val.locator('.text-tip')).toHaveCount(0);
      // Nothing in the value is dotted (the underline lives on a .text-tip, never on .val itself).
      expect(await val.evaluate((v) => [v, ...v.querySelectorAll('*')].filter((e) => getComputedStyle(e).textDecorationLine.includes('underline')).length)).toBe(0);
      // Default (Confidence adj., Once dialed): every Coffees tip shows a differing plain average or both counts.
      await gotoReady(page, '/stats?tab=leaderboards&range=all');
      const tips = page.locator('[data-board="coffees"] .val .text-tip');
      expect(await tips.count()).toBeGreaterThan(0);
      for (const t of await tips.all()) {
        await t.click();
        const tip = page.locator('.float-tip');
        const dd = await tip.locator('dd').allInnerTexts();
        const adds = (dd.length === 2 && dd[0] !== dd[1]) || /scored once dialed/.test(await tip.innerText());
        expect(adds, dd.join(' / ')).toBe(true);
        await page.keyboard.press('Escape');
      }
    }
  },
  { name: 'insights-board-jump', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      // One jump link per board; a click lands the card's top just under the sticky bar.
      const links = page.locator('.board-jump a');
      await expect(links).toHaveCount(12);
      await expectChipsInBar(page, links);
      await links.filter({ hasText: 'Origins' }).click();
      await expect(page).toHaveURL(/#leaderboard-origins$/);
      const gap = async () => (await page.evaluate(() => document.getElementById('leaderboard-origins')!.getBoundingClientRect().top)) - (await pinnedBottomOf(page));
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  // One caffeine kind with rated brews (Kurasu has no decaf): the Caffeinated vs. decaf board is left out, the band ends earlier with
  // no hole, no jump chip, and a deep link to it does not break the page. The layout check covers every viewport.
  { name: 'insights-board-caffeine-hidden', path: () => '/stats?tab=leaderboards&range=all&dial=all&roaster=Kurasu#leaderboard-caffeine',
    act: async (page) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await expect(page.locator('[data-board="roasters"]')).toBeVisible();
      await expect(page.locator('[data-board="caffeine"]')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Caffeinated vs. decaf' })).toHaveCount(0);
      const bands = page.locator('.board-band');
      expect(await bands.count()).toBeGreaterThan(0);
      for (const band of await bands.all()) expect(await band.locator('> .board').count(), 'no empty band').toBeGreaterThan(0);
      await gotoReady(page, '/stats?tab=leaderboards&range=all&dial=all&roaster=Kurasu&chart=leaderboard-caffeine');
      await expect(page.locator('[data-board="roasters"]')).toBeVisible();
      expect(errors).toEqual([]);
      // Both kinds present again: the board is back.
      await gotoReady(page, '/stats?tab=leaderboards&range=all&dial=all');
      await expect(page.locator('[data-board="caffeine"]')).toHaveCount(1);
      await gotoReady(page, '/stats?tab=leaderboards&range=all&dial=all&roaster=Kurasu');
    } },
  { name: 'insights-board-caffeine', path: () => '/stats?tab=leaderboards&range=all&dial=all',
    act: async (page) => {
      const board = page.locator('[data-board="caffeine"]');
      await board.scrollIntoViewIfNeeded();
      await expect(board.locator('.time-chart canvas')).toBeVisible();
      // Both kinds are on by default (no note, no Include decaf); the under-floor kind is marked as few brews, never hidden.
      await expect(board.getByRole('button', { name: 'Include decaf' })).toHaveCount(0);
      await expect(board).not.toContainText(/left out of ratings|hidden/);
      await expect(board).toContainText('Few brews: Decaf');
      await expect(board.getByRole('button', { name: /^Show (it|them)$|^Show only/ })).toHaveCount(0);
      await expect(page).not.toHaveURL(/avg=/);
      // The board ignores the Caffeine filter: both lines under Decaf and All too.
      const note = async (q: string) => { await page.goto(`/stats?tab=leaderboards&range=all&dial=all${q}`); return board.locator('.chart-note').first(); };
      for (const q of ['&caffeine=decaf', '&caffeine=all']) await expect(await note(q)).toContainText('all 2 caffeine kinds');
      // Caffeine is Over time only: no List rows, no List / Over time or Lowest first control, no Expand; the chart is there and
      // the card is its head + chart + note (no big empty area). The old views=caffeine-time[-wide] links look the same.
      for (const q of ['', '&views=caffeine-time-wide']) {
        await page.goto(`/stats?tab=leaderboards&range=all${q}`);
        const c = page.locator('[data-board="caffeine"]');
        await c.scrollIntoViewIfNeeded();
        await expect(c.locator('.time-chart canvas')).toBeVisible();
        await expect(c.locator('.board-row')).toHaveCount(0);
        await expect(c.locator('.group-field, .low-switch, .expand')).toHaveCount(0);
        const [card, chart, head] = await Promise.all(['', '.time-chart', '.board-head'].map((s) => (s ? c.locator(s) : c).boundingBox()));
        expect(chart!.height).toBeGreaterThan(150);
        expect(chart!.height).toBeLessThan(230);
        const extra = card!.height - chart!.height - head!.height;
        expect(extra, 'head + chart + note + padding only').toBeLessThan(140);
      }
      await expectEqualBoardHeights(page);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    } },
  { name: 'insights-board-varieties', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      for (const b of ['varieties', 'producers']) await expect(page.locator(`[data-board="${b}"] .board-row:not(.placeholder)`).first()).toBeVisible();
      await expect(page.locator('[data-board="varieties"] .board-row', { hasText: 'Gesha' }).first()).toBeVisible();
      await expect(page.locator('[data-board="varieties"] .like-note')).toHaveText(/toward each of its coffee's varieties\. \d+ of \d+ bags have a variety\./);
      await expect(page.locator('[data-board="producers"] .like-note')).toHaveText(/\d+ of \d+ bags have a producer\./);
      await expectEqualBoardHeights(page);
    } },
  // A board the default Score trimmed says how many groups are hidden and offers them (avg=adjusted, never the bare URL);
  // the cards of its band stay level, whether or not they carry the line.
  { name: 'insights-board-small-note', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const note = page.locator('.board .small-note .real').first();
      await expect(note).toHaveText(/^Ranks .+ with 3\+ bags and 10\+ rated brews; \d+ more are hidden\. Show them$/);
      await expectEqualBoardHeights(page);
      // Show them, then the way back in the same spot: the URL returns to what it was, the line stays put (±2px).
      const board = await note.evaluate((e) => e.closest('.board')!.getAttribute('data-board'));
      const line = page.locator(`[data-board="${board}"] .small-note`);
      const top = () => line.evaluate((e) => e.getBoundingClientRect().top + scrollY); // document y: the click may scroll
      const url0 = new URL(page.url()), y0 = await top();
      await note.getByRole('button', { name: /^Show (them|it)$/ }).click();
      await expect(page).toHaveURL(/avg=adjusted/);
      await expect(line.locator('.real')).toHaveText(/^Showing all \d+ .+, small samples marked\. Show only 3\+ bags and 10\+ rated brews again$/);
      expect(Math.abs((await top()) - y0)).toBeLessThanOrEqual(2);
      await line.getByRole('button', { name: /^Show only .+ again$/ }).click();
      await expect(page).not.toHaveURL(/avg=/);
      expect([...new URL(page.url()).searchParams].sort()).toEqual([...url0.searchParams].sort());
      await expect(line.locator('.real')).toHaveText(/more (is|are) hidden\. Show (it|them)$/);
      expect(Math.abs((await top()) - y0)).toBeLessThanOrEqual(2);
    } },
  // No board head wraps: its children share a top, in List and Over time, Lowest first on and off, for every board.
  ...[false, true].flatMap((low) => [false, true].map((time) => ({
    name: `insights-board-head-one-row-${low ? 'low' : 'high'}-${time ? 'time' : 'list'}`,
    path: () => `/stats?tab=leaderboards&range=all${time ? '&views=process-time,roast-time,water-time,dripper-time,filter-time,grinder-time' : ''}${low ? '&low=roasters,coffees,origins,varieties,producers,process,roast,water,dripper,filter,grinder,caffeine' : ''}`,
    act: async (page: Page) => {
      await expect(page.locator('.board-head')).toHaveCount(12);
      // One row: the title and every tool are centred on the same line (they're align-items: center, so tops differ by height).
      const mids = await page.locator('.board-head').evaluateAll((heads) => heads.map((h) => {
        const m = [...h.querySelectorAll(':scope > *, .board-tools > *')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => { const r = c.getBoundingClientRect(); return [c.className || c.tagName, Math.round(r.x), Math.round(r.width), r.top + r.height / 2] as const; });
        const ys = m.map((c) => c[3]);
        return [h.querySelector('h2')?.textContent ?? '', Math.max(...ys) - Math.min(...ys), Math.round(h.getBoundingClientRect().width) + ' ' + JSON.stringify(m.map((c) => c.slice(0, 3)))] as const;
      }));
      for (const [title, spread, boxes] of mids) expect(spread, `${title}: head wraps ${boxes}`).toBeLessThanOrEqual(2);
      // The Lowest first switch and the List / Over time group keep their x and width when the view flips.
      const rects = () => page.locator('.board').evaluateAll((cards) => Object.fromEntries(cards.flatMap((c) => {
        const o = c.getBoundingClientRect(), r = (sel: string) => { const e = c.querySelector(sel)?.getBoundingClientRect(); return e ? [Math.round(e.x - o.x), Math.round(e.width)] : null; };
        return c.querySelector('.group-field') ? [[c.getAttribute('data-board')!, [r('.low-switch'), r('.group-field')]]] : [];
      })));
      const before = await rects();
      expect(Object.keys(before).length).toBeGreaterThan(0);
      for (const b of Object.keys(before)) await page.locator(`[data-board="${b}"] .group-field button`).getByText(time ? 'List' : 'Over time', { exact: true }).click();
      const after = await rects();
      for (const [b, rs] of Object.entries(before)) rs.forEach((r, i) => { if (r) for (let k = 0; k < 2; k++) expect(Math.abs(r[k] - after[b][i]![k]), `${b} ${i ? 'view group' : 'low switch'} ${k ? 'width' : 'x'}: ${r} vs ${after[b][i]}`).toBeLessThanOrEqual(1); });
    } }))),
  { name: 'insights-board-producers-spend', path: () => '/stats?tab=leaderboards&range=all&rank=spend',
    act: async (page) => {
      for (const b of ['varieties', 'producers']) {
        const rows = page.locator(`[data-board="${b}"] .board-row:not(.placeholder)`);
        await expect(rows.first()).toBeVisible();
        await expect(rows.first().locator('.val')).toContainText('$');
      }
      await expect(page.locator('[data-board="producers"] .like-note')).toHaveText(/\d+ of \d+ bags bought have a producer\./);
      await expectEqualBoardHeights(page);
    } },
  { name: 'insights-board-origin-thin', path: () => '/stats?tab=leaderboards&range=all&roaster=Kurasu',
    act: async (page) => {
      // Kurasu's bags carry no origin details: both boards show their empty line, and the band has no empty space.
      for (const b of ['varieties', 'producers']) await expect(page.locator(`[data-board="${b}"] .board-note`)).toBeVisible();
      await expect(page.locator('[data-board="varieties"] .board-row, [data-board="producers"] .board-row')).toHaveCount(0);
      const [v, p] = await Promise.all(['varieties', 'producers'].map((b) => page.locator(`[data-board="${b}"]`).boundingBox()));
      if (Math.abs(v!.y - p!.y) <= 1) expect(Math.abs(v!.height - p!.height)).toBeLessThanOrEqual(1); // side by side: level and as tall
    } },
  { name: 'insights-chart-link', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      // A heading's link carries chart=<id> and the hash; a click puts both in the address bar without a reload.
      const gap = () => anchorGap(page, 'leaderboard-origins');
      const href = (id: string) => page.locator(`#${id} a`).getAttribute('href');
      expect(await href('leaderboard-origins')).toMatch(/^\?(?=.*tab=leaderboards)(?=.*range=all)(?=.*chart=leaderboard-origins).*#leaderboard-origins$/);
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      await page.locator('#leaderboard-origins a').click();
      await expect(page).toHaveURL(/chart=leaderboard-origins.*#leaderboard-origins$/);
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
      await page.waitForTimeout(300);
      expect(requests.filter((u) => /__data\.json/.test(u))).toEqual([]);
      expect(await href('leaderboard-roasters')).toContain('chart=leaderboard-roasters');
      // A reload, and a load with no hash (Share and short links drop it), land the heading under the bar.
      const url = page.url();
      await reloadReady(page);
      expect(page.url()).toBe(url);
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
      await gotoReady(page, '/stats?tab=leaderboards&range=all&chart=leaderboard-origins');
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
      // Any other view change (Rank by here) drops chart= as well.
      await gotoReady(page, '/stats?tab=leaderboards&range=all&chart=leaderboard-roast');
      await page.getByRole('combobox', { name: 'Rank by' }).selectOption('brews');
      await expect(page).toHaveURL(/rank=brews/);
      expect(page.url()).not.toContain('chart=');
      // A tab switch drops chart= and the hash; the new tab's headings link with their own chart=.
      await page.getByLabel('View').selectOption('habits');
      await expect(page).toHaveURL(/tab=habits/);
      expect(page.url()).toContain('range=all');
      expect(page.url()).not.toMatch(/chart=|#/);
      expect(await href('habits-hour')).toContain('chart=habits-hour');
    } },
  // Jump-to chips on every tab with 3+ sections (milestones has its own ruler; sweet spots has only two sections).
  ...['overview', 'habits', 'consumption', 'records', 'insights', 'brewing', 'water', 'gear', 'milestones', 'sweetspots'].map((tab) => ({
    name: `insights-jump-${tab}`, viewports: tab === 'milestones' || tab === 'sweetspots' ? 'two' : 'all', path: () => `/stats?tab=${tab}&range=all`,
    act: async (page: Page) => {
      const links = page.locator('.board-jump a');
      if (tab === 'milestones' || tab === 'sweetspots') return void (await expect(links).toHaveCount(0));
      expect(await page.evaluate(() => { const seen = new Set<string>(); return [...document.querySelectorAll('[id]')].map((e) => e.id).filter((i) => seen.size === seen.add(i).size); })).toEqual([]);
      // One chip per rendered section; a click is a hash jump (no reload) landing the section just under the sticky bar.
      expect(await links.count()).toBeGreaterThan(2);
      await page.evaluate(() => ((window as unknown as { __jump: number }).__jump = 1));
      const gap = (id: string) => anchorGap(page, id);
      await expectChipsInBar(page, links);
      for (const n of [1, (await links.count()) - 1]) {
        const jump = links.nth(n);
        await jump.click();
        const id = (await jump.getAttribute('href'))!.slice(1);
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect.poll(() => gap(id)).toBeGreaterThanOrEqual(-1);
        // Under the bar, unless the page ends first (a short tab can't scroll its last sections to the top).
        const atEnd = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1);
        if (!atEnd) expect(await gap(id)).toBeLessThanOrEqual(16);
      }
      expect(await page.evaluate(() => (window as unknown as { __jump?: number }).__jump)).toBe(1);
    }
  })),
  // Lowest first (spec Task 4): the switch is one box, pressed or not, in List or Over time.
  { name: 'insights-board-low', path: () => '/stats?tab=leaderboards&range=all&rank=brews&low=roasters,varieties,water',
    act: async (page) => {
      // The switch's box relative to its card (right and top edges), width and height.
      const box = (b: string) => page.locator(`[data-board="${b}"]`).evaluate((card) => {
        const r = card.querySelector('.low-switch')!.getBoundingClientRect(), c = card.getBoundingClientRect();
        return [Math.round(c.right - r.right), Math.round(r.top - c.top), Math.round(r.width), Math.round(r.height)];
      });
      await expect(page.locator('[data-board="varieties"] .low-switch')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-board="producers"] .low-switch')).toHaveAttribute('aria-pressed', 'false');
      const pressed = await box('varieties'), idle = await box('producers');
      for (let i = 0; i < 4; i++) expect(Math.abs(pressed[i] - idle[i]), `box ${i}: ${pressed} vs ${idle}`).toBeLessThanOrEqual(1);
      // Lowest first: ascending values (Varieties' first row is at most its last).
      const vals = await page.locator('[data-board="varieties"] .board-row:not(.placeholder) .val').allInnerTexts();
      expect(vals.length).toBeGreaterThan(1);
      expect(parseFloat(vals[0])).toBeLessThanOrEqual(parseFloat(vals.at(-1)!));
      // A board that cut a one-bag row says so; one that cut none does not say it.
      const notes = await page.locator('.board .chart-note', { hasText: 'Groups with one bag are left out.' }).count();
      const cut = await page.evaluate(() => [...document.querySelectorAll('.board-band .board')].filter((b) => b.querySelector('.low-switch[aria-pressed=true]')).length);
      expect(notes).toBeGreaterThan(0);
      expect(notes).toBeLessThanOrEqual(cut);
      await expect(page.locator('[data-board="producers"] .chart-note', { hasText: 'one bag' })).toHaveCount(0);
      await expectEqualBoardHeights(page);
    } },
  { name: 'insights-board-low-toggle', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const fetched: string[] = [];
      page.on('request', (r) => { if (r.url().includes('__data.json')) fetched.push(r.url()); });
      const btn = page.locator('[data-board="producers"] .low-switch');
      const box = () => btn.evaluate((e) => { const r = e.getBoundingClientRect(), c = e.closest('.board')!.getBoundingClientRect(); return [Math.round(c.right - r.right), Math.round(r.y - c.y), Math.round(r.width), Math.round(r.height)]; });
      const before = await box();
      await btn.click();
      await expect(page).toHaveURL(/[?&]low=producers(&|$)/);
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      expect(await box()).toEqual(before);
      await btn.click();
      await expect(page).not.toHaveURL(/low=/);
      expect(await box()).toEqual(before);
      expect(fetched).toEqual([]);
    } },
  { name: 'insights-board-low-compare', path: () => '/stats?tab=leaderboards&range=1m&compare=1&low=roasters,coffees',
    act: async (page) => {
      const rows = page.locator('[data-board="roasters"] .board-row:not(.placeholder)');
      await expect(rows.first()).toBeVisible();
      expect(await rows.locator('.move').count()).toBe(await rows.count());
      // Coffees' move cells follow lowMove (ascending positions), so they differ from the same rows highest first.
      const moves = () => page.locator('[data-board="coffees"] .board-row:not(.placeholder)').evaluateAll(
        (rs) => Object.fromEntries(rs.map((r) => [r.querySelector('.who')!.textContent!.trim().split('\n')[0], r.querySelector('.move')?.textContent?.trim()]))
      );
      const low = await moves();
      expect(Object.values(low).every(Boolean)).toBe(true);
      await page.locator('[data-board="coffees"] .low-switch').click();
      await expect(page.locator('[data-board="coffees"] .low-switch')).toHaveAttribute('aria-pressed', 'false');
      const high = await moves();
      const shared = Object.keys(low).filter((k) => k in high); // each side shows its own top 10 of 11
      expect(shared.length).toBeGreaterThan(0);
      expect(shared.some((k) => low[k] !== high[k])).toBe(true);
    } },
  { name: 'insights-board-low-rank-prune', path: () => '/stats?tab=leaderboards&range=all&rank=brews&low=roasters,dripper',
    act: async (page) => {
      await page.getByLabel('Rank by').selectOption('spend');
      // Dripper can't rank by spend: its Lowest first is dropped with it (like open), Roasters keeps its own.
      await expect(page).toHaveURL(/[?&]low=roasters(&|$)/);
      await expect(page.locator('[data-board="roasters"] .low-switch')).toHaveAttribute('aria-pressed', 'true');
    } },
  { name: 'insights-board-low-time', path: () => '/stats?tab=leaderboards&range=all&views=water-time&low=water',
    act: async (page) => {
      const card = page.locator('[data-board="water"]');
      await expect(card.locator('canvas')).toBeVisible();
      const sw = card.locator('.low-switch');
      await expect(sw).toHaveAttribute('aria-pressed', 'true');
      const box = () => sw.evaluate((e) => { const r = e.getBoundingClientRect(), c = e.closest('.board')!.getBoundingClientRect(); return [Math.round(r.x - c.x), Math.round(r.y - c.y), Math.round(r.width), Math.round(r.height)]; });
      const inTime = await box();
      await card.getByRole('button', { name: 'List' }).click();
      await expect(card.locator('canvas')).toHaveCount(0);
      expect(await box()).toEqual(inTime);
    } },
  { name: 'insights-board-time', path: () => '/stats?tab=leaderboards&range=12m&views=dripper-time',
    act: async (page) => {
      const card = page.locator('.board[data-board=dripper]');
      await expect(card.getByRole('button', { name: 'Over time', pressed: true })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Bars' })).toHaveCount(0);
      await expect(card.locator('canvas')).toBeVisible();
      await expect(card.locator('canvas')).toHaveAttribute('data-dash-gaps', 'true');
      // Over time keeps the card's normal grid size: level with its neighbors, the same width as a List card.
      const w = () => page.locator('.board[data-board=process]').evaluate((el) => el.getBoundingClientRect().width);
      const wide = await card.evaluate((el) => el.getBoundingClientRect().width);
      expect(Math.abs(wide - (await w()))).toBeLessThanOrEqual(1);
      await expectGridRowsFull(page, '.board-band:has(.board[data-board=dripper])', true);
    } },
  { name: 'insights-board-expand', path: () => '/stats?tab=leaderboards&range=12m&views=roast-time',
    act: async (page) => {
      const card = page.locator('.board[data-board=roast]');
      const widths = () => page.locator('.board-band:has(.board[data-board=roast]) > .board').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
      const before = await widths();
      const expand = card.getByRole('button', { name: 'Expand chart' });
      if ((page.viewportSize()?.width ?? 0) <= 640) { await expect(expand).toBeHidden(); return; } // one column: nothing to span
      await expand.click();
      await expect(page).toHaveURL(/views=roast-time-wide/);
      const band = await card.evaluate((el) => el.parentElement!.getBoundingClientRect().width);
      const during = await widths();
      const i = before.length > 0 ? (await page.locator('.board-band:has(.board[data-board=roast]) > .board').evaluateAll((els) => els.findIndex((e) => e.getAttribute('data-board') === 'roast'))) : 0;
      expect(Math.abs(during[i] - band)).toBeLessThanOrEqual(1);
      // The other cards keep a normal column, never stretched.
      during.forEach((x, k) => k !== i && expect(Math.abs(x - before[k])).toBeLessThanOrEqual(1));
      await expect(card.getByRole('button', { name: 'Shrink chart' })).toBeVisible();
      // The chart resized with its card: the canvas's backing store is its CSS size x the device pixel ratio (no stale pixels).
      const sharp = () => card.locator('canvas').evaluate((c: HTMLCanvasElement) => {
        const r = c.getBoundingClientRect();
        return Math.abs(c.width - r.width * devicePixelRatio) <= 1 && Math.abs(c.height - r.height * devicePixelRatio) <= 1;
      });
      await expect.poll(sharp).toBe(true);
      await card.getByRole('button', { name: 'Shrink chart' }).click();
      await expect.poll(sharp).toBe(true);
      await card.getByRole('button', { name: 'Expand chart' }).click();
      await card.getByRole('button', { name: 'Shrink chart' }).click();
      await expect(page).toHaveURL(/views=roast-time(&|$)/);
      await expect.poll(widths).toEqual(before);
      await expect.poll(sharp).toBe(true); // the canvas redraws after its card shrinks; checkLayout ran mid-resize once (scrollWidth 1608)
    } },
  { name: 'insights-board-dashed-gaps', viewports: 'two', path: () => '/stats?tab=leaderboards&range=1m&rank=brews&views=roast-time,water-time,dripper-time,filter-time,grinder-time,process-time',
    act: async (page) => {
      // Brews / Grams / Spend plot a no-data period as 0: no dashes, no note. Ratings bridge it with a dashed segment and say so.
      await expect(page.locator('.board canvas').first()).toBeVisible();
      await expect(page.locator('.board .chart-note').filter({ hasText: 'Dashed' })).toHaveCount(0);
      await gotoReady(page, page.url().replace('&rank=brews', ''));
      await expect(page.locator('.board .chart-note').filter({ hasText: /Dashed: \w+s with no data/ }).first()).toBeVisible();
    } },
  // range=6m, not all: all now spans the seed's prior year, so the chart goes monthly and the new drippers' gaps vanish.
  { name: 'insights-board-time-size', path: () => '/stats?tab=leaderboards&range=6m&avg=raw',
    act: async (page) => {
      // List and Over time are the same card size; Show all (Over time) only adds lines: no card changes height.
      const row = '.board-band:has(.board[data-board=dripper]) > .board';
      const heights = () => page.locator(row).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      const card = page.locator('.board[data-board=dripper]');
      const list = await heights();
      await card.getByRole('button', { name: 'Over time' }).click();
      await expect(card.locator('canvas')).toBeVisible();
      await expect(page).toHaveURL(/views=dripper-time/);
      expect(await heights()).toEqual(list);
      const lines = () => card.evaluate((c) => c.getAttribute('data-lines'));
      expect(await lines()).toBe('5');
      await card.getByRole('button', { name: /^Show all/ }).click();
      await expect(page).toHaveURL(/open=dripper/);
      await expect.poll(lines).toBe('7');
      await expect(card.locator('.chart-note:not(.small-note)')).toContainText('all 7');
      expect(await heights()).toEqual(list);
      // Every line with a gap is dashed across it, the 6th and 7th included (Chart.js's own segment styles, per line).
      const dashed = ((await card.locator('canvas').getAttribute('data-dashed-segments')) ?? '').split(',').map(Number);
      expect(dashed).toHaveLength(7);
      expect(dashed.slice(-2).every((n) => n >= 1)).toBe(true);
      expect(dashed.filter((n) => n >= 1).length).toBeGreaterThanOrEqual(4);
      // The plot keeps a readable height under the 7-name legend, and nothing spills out of the card.
      const fit = await card.evaluate((c) => {
        const b = c.getBoundingClientRect(), p = c.querySelector('.time-chart')!.getBoundingClientRect();
        return { plot: p.height, inside: p.bottom <= b.bottom && p.right <= b.right + 0.5 && c.scrollWidth <= c.clientWidth + 1 };
      });
      expect(fit.plot).toBeGreaterThanOrEqual(190);
      expect(fit.inside).toBe(true);
      await card.getByRole('button', { name: /^Show top/ }).click();
      await expect.poll(lines).toBe('5');
      await expect.poll(heights).toEqual(list);
    } },
  { name: 'insights-board-time-beside-open', path: () => '/stats?tab=leaderboards&range=all&avg=raw&views=grinder-time&open=dripper',
    act: async (page) => {
      // Only a List card grows (by its own Show all): an Over time card in the same row keeps its normal height.
      const h = (b: string) => page.locator(`.board[data-board=${b}]`).evaluate((e) => Math.round(e.getBoundingClientRect().height));
      const top = (b: string) => page.locator(`.board[data-board=${b}]`).evaluate((e) => Math.round(e.getBoundingClientRect().top));
      const [open, time, plain] = [await h('dripper'), await h('grinder'), await h('filter')];
      expect(open).toBeGreaterThan(time + 20);
      expect(open).toBeGreaterThan(plain + 20); // a List sibling keeps its own height too (unchanged behaviour)
      // One row only where the band runs 3 across (dripper, filter, grinder); 2 across puts grinder below.
      const cols = await page.locator('.board[data-board=dripper]').evaluate((e) => getComputedStyle(e.parentElement!).gridTemplateColumns.split(' ').length);
      if (cols === 3) expect(await top('dripper')).toBe(await top('grinder'));
      await page.locator('.board[data-board=dripper]').getByRole('button', { name: /^Show top/ }).click();
      await expect(page).not.toHaveURL(/open=/);
      expect(Math.abs((await h('grinder')) - time)).toBeLessThanOrEqual(1);
      expect(Math.abs((await h('filter')) - plain)).toBeLessThanOrEqual(1);
    } },
  { name: 'insights-board-open-independent', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all&avg=raw',
    act: async (page) => {
      // Each board's Show all is its own: opening one never closes another, in any order, and it survives a reload.
      const btn = (b: string, name: RegExp) => page.locator(`.board[data-board=${b}]`).getByRole('button', { name });
      await btn('dripper', /^Show all/).click();
      await expect(page).toHaveURL(/open=dripper(&|$)/);
      await btn('coffees', /^Show all/).click();
      await expect(page).toHaveURL(/open=coffees%2Cdripper/); // board order, not click order
      await reloadReady(page);
      for (const b of ['coffees', 'dripper']) await expect(btn(b, /^Show top/)).toBeVisible();
      await btn('coffees', /^Show top/).click();
      await expect(page).toHaveURL(/open=dripper(&|$)/);
      await expect(btn('dripper', /^Show top/)).toBeVisible();
      await expect(btn('coffees', /^Show all/)).toBeVisible();
      await btn('coffees', /^Show all/).click(); // the other order
      await expect(page).toHaveURL(/open=coffees%2Cdripper/);
      await btn('dripper', /^Show top/).click();
      await expect(page).toHaveURL(/open=coffees(&|$)/);
      await btn('coffees', /^Show top/).click();
      await expect(page).not.toHaveURL(/open=/);
    } },
  { name: 'insights-board-no-rerender', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all&avg=raw&views=grinder-time,process-time',
    act: async (page) => {
      // Show all and the expand toggle are view-only: no data request, and the other tiles' charts are not rebuilt (a rebuilt
      // chart re-runs its animation, which rewrites data-dashed-segments; the marker below is cleared first).
      const charts = page.locator('.board:not([data-board=caffeine]) canvas'); // caffeine's is always on
      await expect(charts).toHaveCount(2);
      await expect.poll(() => charts.evaluateAll((cs) => cs.every((c) => c.hasAttribute('data-dashed-segments')))).toBe(true);
      await page.waitForTimeout(600); // the first animation has finished
      await charts.evaluateAll((cs) => cs.forEach((c) => c.removeAttribute('data-dashed-segments')));
      let fetched = 0;
      page.on('request', (r) => r.url().includes('__data.json') && fetched++);
      const dripper = page.locator('.board[data-board=dripper]');
      await dripper.getByRole('button', { name: /^Show all/ }).click();
      await expect(page).toHaveURL(/open=dripper/);
      await expect(dripper.getByRole('button', { name: /^Show top/ })).toBeVisible();
      await page.locator('.board[data-board=grinder]').getByRole('button', { name: 'Expand chart' }).isVisible().then(async (shown) => {
        if (shown) { await page.locator('.board[data-board=grinder]').getByRole('button', { name: 'Expand chart' }).click(); await expect(page).toHaveURL(/grinder-time-wide/); }
      });
      await page.waitForTimeout(1000);
      expect(fetched).toBe(0);
      // The process card's chart is untouched (the grinder's may resize when expanded).
      expect(await page.locator('.board[data-board=process] canvas').getAttribute('data-dashed-segments')).toBeNull();
      await reloadReady(page); // the URL carries it: a reload shows the same
      await expect(page.locator('.board[data-board=dripper]').getByRole('button', { name: /^Show top/ })).toBeVisible();
      await dripper.getByRole('button', { name: /^Show top/ }).click();
      await expect(page).not.toHaveURL(/open=/);
    } },
  { name: 'insights-board-views-url', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      // The view is URL state: absent = List, a pick shows in the URL and survives a reload, List drops it again.
      const card = () => page.locator('.board[data-board=roast]');
      await expect(card().getByRole('button', { name: 'List', pressed: true })).toBeVisible();
      await card().getByRole('button', { name: 'Over time' }).click();
      await expect(page).toHaveURL(/views=roast-time/);
      await reloadReady(page);
      await expect(card().getByRole('button', { name: 'Over time', pressed: true })).toBeVisible();
      // gotoReady, not goto: the List click below must not beat hydration.
      await gotoReady(page, page.url().replace('views=roast-time', 'views=roast-time-wide'));
      await expect(card().getByRole('button', { name: 'Over time', pressed: true })).toBeVisible();
      await expect(card()).toHaveClass(/wide/);
      await card().getByRole('button', { name: 'List' }).click();
      await expect(page).not.toHaveURL(/views=/);
    } },
  { name: 'insights-leaderboards-sticky', path: () => '/stats?tab=leaderboards', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-leaderboards-spend-compare',
    path: () => '/stats?tab=leaderboards&rank=spend&range=12m&compare=1',
    act: async (page) => {
      await expectEmptyGearCards(page);
      await expect(page.locator('.board .move').first()).toBeVisible();
      await expectEqualBoardHeights(page);
    }
  },
  {
    // $/g rows carry the spend and grams behind it, still one line high.
    name: 'insights-leaderboards-ppg',
    path: () => '/stats?tab=leaderboards&rank=ppg',
    act: async (page) => {
      for (const b of ['roasters', 'coffees'])
        await expect(page.locator(`.board[data-board="${b}"] .board-row small`).first()).toHaveText(/bags? · \$[\d,.]+ · [\d.]+k?g$/);
      await expectEqualBoardHeights(page);
    }
  },
  { name: 'insights-leaderboards-like', path: () => '/stats?tab=leaderboards&rank=like&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="coffees"] .board-row:not(.placeholder)').first()).toBeVisible();
      await expect(page.locator('.like-note')).toHaveText("vs like coffees ranks coffees and roasters only. Decaf is compared with decaf, caffeinated with caffeinated. A roaster is compared with other roasters' coffees. Coffees with too few like coffees to compare, or under 4 rated brews, are left out.");
      // Boards that can't rank are left out, not shown empty.
      await expect(page.locator('.board')).toHaveCount(2);
      await expect(page.locator('[data-board="origins"], [data-board="water"]')).toHaveCount(0);
      await expect(page.locator('[data-board="coffees"] .val').first()).toHaveText(/^([+−]\d\.\d|0\.0)$/);
      // No empty footers, and no "vs" line (the value already is that number).
      await expect(page.locator('.board-foot:not(:has(button))')).toHaveCount(0);
      await expect(page.locator('.like-line')).toHaveCount(0);
      // Side by side (wider than a phone), the two cards start level and are as tall as each other.
      const cards = await page.locator('.board').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()));
      expect(cards).toHaveLength(2);
      const [a, c] = cards;
      if ((page.viewportSize()?.width ?? 0) > 640) {
        expect(Math.abs(a.top - c.top)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.height - c.height)).toBeLessThanOrEqual(1);
      }
    } },
  { name: 'insights-like-lines', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const line = page.locator('[data-board="coffees"] .like-line').first();
      await expect(line).toHaveText(/^([+−]\d\.\d|0\.0) vs .+ coffees/);
      await expectDeltaInk(page);
      // Stacked (phone), only rows with a line grow: Roasters keeps the plain 3rem row; side by side the band stays level.
      const h = (sel: string) => page.locator(sel).first().evaluate((e) => e.getBoundingClientRect().height);
      const plain = await h('[data-board="roasters"] .board-row:not(.placeholder)');
      const liked = await h('[data-board="coffees"] .board-row.liked');
      if ((page.viewportSize()?.width ?? 0) <= 640) { expect(plain).toBeCloseTo(48, 0); expect(liked).toBeGreaterThan(plain + 8); }
      else expect(Math.abs(plain - liked)).toBeLessThanOrEqual(1);
      await page.getByLabel('View').selectOption('records');
      await expect(page.locator('.like-line').first()).toBeVisible();
      await expectDeltaInk(page);
      await page.getByLabel('View').selectOption('sweetspots');
      await expect(page.locator('.like-line').first()).toBeVisible();
      await expectDeltaInk(page);
    } },
  // Gate P4: the line shows under every rank but like; spend ranks bags, so it shows there too.
  { name: 'insights-like-lines-brews', viewports: 'two', path: () => '/stats?tab=leaderboards&rank=brews&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="coffees"] .like-line').first()).toHaveText(/^([+−]\d\.\d|0\.0) vs .+ coffees/);
      await page.getByLabel('Rank by').selectOption('spend');
      await expect(page.locator('[data-board="coffees"] .like-line').first()).toBeVisible();
    } },
  // Gate P4: a cut like line opens its full text (the shared FloatTip) on tap, hover and keyboard focus/Enter (the line
  // is narrowed so every viewport has one cut); one tip at a time; a whole line's tap goes on to the row's link.
  { name: 'insights-like-line-tip', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const lines = page.locator('[data-board="coffees"] .like-line');
      const tip = page.locator('.float-tip');
      for (const i of [0, 1]) await lines.nth(i).evaluate((e) => (e.style.maxWidth = '4rem'));
      const text = (i: number) => lines.nth(i).evaluate((e) => e.textContent!);
      // Mouse hover and keyboard focus show a cut line's full text; a tap or click follows the row's link (user, 2026-10-17).
      if (page.viewportSize()!.width >= 1280) {
        await lines.first().hover();
        await expect(tip).toHaveText(await text(0));
        await page.mouse.move(0, 0);
        await expect(tip).toHaveCount(0);
      }
      await lines.nth(1).focus();
      await expect(tip).toHaveCount(1);
      await expect(tip).toHaveText(await text(1));
      await expectTipInView(page, tip);
      await lines.nth(1).blur();
      await lines.first().click();
      await expect(page).toHaveURL(/\/coffees\//);
    } },
  // Gate P4: zero-centred bars: a positive gap grows right of the middle, a negative one left, in its delta color.
  // Signed values in a tip are inked by sign like the row's (round 2): the like board's value tip carries its gap.
  { name: 'insights-leaderboards-like-tip', viewports: 'two', path: () => '/stats?tab=leaderboards&rank=like&range=all',
    act: async (page) => {
      await page.locator('[data-board="roasters"] .val .text-tip').first().click();
      const tip = page.locator('.float-tip');
      const gap = tip.locator('dd').first();
      await expect(gap).toHaveText(/^[+−]\d\.\d$/);
      const [got, plain] = await Promise.all([gap.locator('span').first().evaluate((e) => getComputedStyle(e).color), tip.evaluate((e) => getComputedStyle(e).color)]);
      expect(got, 'signed value in the tip is inked, not the tip text color').not.toBe(plain);
      await expect(gap.locator('.ink-better, .ink-worse')).toHaveCount(1);
    } },
  // Totals' values are the same color as the other tiles' (they were the accent brown).
  { name: 'insights-totals-value-color', viewports: 'two', path: () => '/stats?range=all',
    act: async (page) => {
      const color = (panel: string) => page.locator('section.chart-panel', { has: page.getByRole('heading', { name: panel, exact: true }) }).locator('.stat-value').first().evaluate((e) => getComputedStyle(e).color);
      expect(await color('Totals')).toBe(await color('Averages'));
    } },
  // Show all / Show fewer on a board and on a Water pair end clear of Back to top too.
  { name: 'insights-leaderboards-show-all-clear', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const btn = page.locator('.board-foot button').first();
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b = (await btn.boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page).toHaveURL(/open=/);
      await expectClearOfBackToTop(page, page.locator('.board.open .board-foot button'));
    } },
  { name: 'insights-water-show-all-clear', path: () => '/stats?tab=water',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const btn = page.locator('.pair-more').first();
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b = (await btn.boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page).toHaveURL(/pairs=/);
      await expectClearOfBackToTop(page, page.locator('.pair-more').first());
    } },
  { name: 'insights-leaderboards-like-open', path: () => '/stats?tab=leaderboards&rank=like&range=all&open=coffees',
    act: async (page) => {
      const bars = await page.locator('[data-board="coffees"] .board-row:not(.placeholder)').evaluateAll((rows) => rows.map((r) => {
        const b = getComputedStyle(r, '::before'), w = r.getBoundingClientRect().width;
        return { v: r.querySelector('.val')!.textContent!, left: parseFloat(b.left) / w, right: (parseFloat(b.left) + parseFloat(b.width)) / w };
      }));
      expect(bars.some((b) => b.v.startsWith('−'))).toBe(true);
      for (const b of bars) {
        if (b.v.startsWith('+')) expect(b.left).toBeCloseTo(0.5, 1);
        if (b.v.startsWith('−')) expect(b.right).toBeCloseTo(0.5, 1);
      }
    } },
  {
    name: 'insights-leaderboards-open',
    path: () => '/stats?tab=leaderboards&rank=spend&open=coffees',
    act: async (page) => {
      const coffees = page.locator('.board[data-board="coffees"]');
      await expect(coffees).toHaveClass(/open/);
      await expect(coffees.locator('.board-row.placeholder')).toHaveCount(0);
      await expect(coffees.locator('.board-foot button')).toHaveText('Show top 10');
      await expectEqualBoardHeights(page);
    }
  },
  { name: 'insights-records', path: () => '/stats?tab=records',
    act: async (page) => {
      for (const h of ['Taste', 'Volume', 'Freshness & lifetime', 'Money', 'Brew extremes', 'Not quite your cup'])
        await expect(page.getByRole('heading', { name: h })).toBeVisible();
      await expectGridRowsFull(page, '.record-grid');
      // A badge sits right above its caption.
      const off = await page.locator('.record-grid .hl-card').evaluateAll((cards) => cards.flatMap((c) => {
        const badge = c.querySelector('.hl-badge')?.getBoundingClientRect();
        const cap = c.querySelector('.hl-caption')!.getBoundingClientRect();
        return [...(badge && cap.top - badge.bottom > 6 ? [`badge ${cap.top - badge.bottom}px above caption`] : [])];
      }));
      expect(off).toEqual([]);
    } },
  { name: 'insights-records-origin', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      for (const k of ['favoriteVariety', 'favoriteProducer', 'mostVariety', 'mostProducer', 'leastVariety', 'leastProducer', 'leastBrewedVariety', 'leastBrewedProducer'])
        await expect(page.locator(`#record-${k}`)).toBeVisible();
      await expectGridRowsFull(page, '.record-grid');
      // The holder opens the Varieties board Lowest first, Period and filters carried.
      await page.locator('#record-leastVariety .hl-holder a').click();
      await expect(page).toHaveURL(/tab=leaderboards/);
      await expect(page).toHaveURL(/low=varieties/);
      await expect(page.locator('#leaderboard-varieties')).toBeVisible();
    } },
  { name: 'insights-records-decaf', path: () => '/stats?tab=records&range=all&caffeine=decaf',
    act: async (page) => {
      // Caffeine is page-wide now (the Coffees panel): an explicit Decaf shows as a chip.
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/^Decaf/]);
      await expectGridRowsFull(page, '.record-grid');
    } },
  { name: 'insights-records-top50', viewports: 'two', path: () => '/stats?tab=records&range=all&top=50',
    act: async (page) => {
      const foot = page.locator('#records-top-brews ~ .top-foot');
      await expect(foot.getByRole('button', { name: 'Show less' })).toBeVisible();
      await expect(foot.getByRole('button', { name: 'Show more' })).toHaveCount(0);
      // Show less steps back one level: 50 → 20.
      await foot.getByRole('button', { name: 'Show less' }).click();
      await expect(page).toHaveURL(/top=20/);
    } },
  { name: 'insights-records-topc20', viewports: 'two', path: () => '/stats?tab=records&range=all&topc=20',
    act: async (page) => {
      // The seed has under 11 coffees with 3+ ratings: the list shows them all, with no controls.
      await expect(page.locator('#records-top-coffees')).toBeVisible();
      await expect(page.locator('#records-top-coffees + ol li').first()).toBeVisible();
    } },
  { name: 'insights-records-tile-link', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      // A tile's caption links with its own id as chart (case kept) and as the hash; a click lands it under the bar.
      const a = page.locator('#record-nightOwl a.caption-link');
      expect(await a.getAttribute('href')).toMatch(/^\?(?=.*tab=records)(?=.*chart=record-nightOwl).*#record-nightOwl$/);
      await a.click();
      await expect(page).toHaveURL(/chart=record-nightOwl.*#record-nightOwl$/);
      const gap = async () => (await page.evaluate(() => document.getElementById('record-nightOwl')!.getBoundingClientRect().top)) - (await pinnedBottomOf(page));
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
      // A load with only chart= (no hash) lands it too, and the tile previews under its own title.
      await gotoReady(page, '/stats?tab=records&range=all&chart=record-nightOwl');
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
      const label = ((await page.locator('#record-nightOwl .stat-label').textContent()) ?? '').replace(/\s*·.*$/s, '').trim();
      expect((await previewTags(page, '/stats?tab=records&range=all&chart=record-nightOwl'))['og:title']).toBe(`Stats: ${label}`);
    } },
  { name: 'insights-records-anchor', path: () => '/stats?tab=records#record-nightOwl',
    act: async (page) => {
      // The tile's top lands just under the sticky filter bar; a filter change keeps the hash.
      const gap = async () => (await page.evaluate(() => document.getElementById('record-nightOwl')!.getBoundingClientRect().top)) - (await pinnedBottomOf(page));
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Caffeine').selectOption('decaf');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/caffeine=decaf#record-nightOwl$/);
    } },
  { name: 'insights-overview-anchor', path: () => '/stats?tab=overview#overview-avg-brew-time',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#overview-avg-brew-time a.caption-link')).toHaveAttribute('href', '#overview-avg-brew-time');
      const gap = async () => (await page.evaluate(() => document.getElementById('overview-avg-brew-time')!.getBoundingClientRect().top)) - (await pinnedBottomOf(page));
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-habits-anchor', path: () => '/stats?tab=habits#habits-current-streak',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#habits-current-streak a.caption-link')).toHaveAttribute('href', '#habits-current-streak');
      const gap = () => anchorGap(page, 'habits-current-streak');
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-consumption-anchor', path: () => '/stats?tab=consumption#consumption-brewed',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#consumption-brewed a.caption-link')).toHaveAttribute('href', '#consumption-brewed');
      const gap = () => anchorGap(page, 'consumption-brewed');
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-records-soup', viewports: 'two', path: () => '/stats?tab=records&brewer=soup',
    act: async (page) => expect(page.getByRole('button', { name: 'Soup', pressed: true })).toBeVisible() },
  { name: 'insights-records-compare', path: () => '/stats?tab=records&range=1w&compare=1' },
  { name: 'insights-records-all-ratings', viewports: 'two', path: () => '/stats?tab=records&ratings=all',
    act: async (page) => {
      await page.locator('.record-ties').first().click(); // tie tip opens on tap
      await expect(page.locator('.mode-tip:popover-open')).toBeVisible();
    } },
  // Tile rows at a fractional width (Windows Firefox at 150% scaling gave a 1174.67px row) keep their columns: six
  // exact shares rounded up once overflowed into 5+1. A fractional main padding makes the row fractional.
  {
    name: 'insights-fit-fractional',
    path: () => '/stats?range=all',
    act: async (page) => {
      const rows = () => page.locator('.fit').evaluateAll((fs) => fs.map((f) => {
        const tops = new Map<number, number>();
        for (const c of f.children) { const t = Math.round(c.getBoundingClientRect().top); tops.set(t, (tops.get(t) ?? 0) + 1); }
        return [...tops.values()].join('+');
      }));
      const whole = await rows();
      for (const x of [-0.33, 0.1, 0.33, 0.5, 0.67, 0.9]) { // -0.33: the reported 1174.67px row at w1280
        await page.evaluate((x) => {
          const s = document.getElementById('frac') ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: 'frac' }));
          s.textContent = `main.container { padding-right: calc(var(--space-4) + ${x}px) }`;
        }, x);
        expect(await rows(), `row width + ${x}px`).toEqual(whole);
      }
      await page.evaluate(() => document.getElementById('frac')!.remove());
    }
  },
  // Side rail (docs/backlog/insights-side-bar.md): from 1000px wide and 500px tall. It adds width (rail + gap
  // = 176px), so with it at viewport W the content lays out exactly as the page without it at W - 176 (a
  // (W - 176) x 499 viewport: too short for the rail), and from 1416px the content column is the full 1208px.
  // At w1280 this state also runs the comparisons at other sizes, then ends back at 1280 x 800.
  {
    name: 'insights-rail',
    slow: true,
    path: () => '/stats?range=all',
    act: async (page) => {
      const rail = page.locator('nav.insights-rail');
      const main = page.locator('.rail-main');
      const vp = page.viewportSize()!;
      if (vp.width < 1000 || vp.height < 500) return expect(rail).toBeHidden();
      await expect(rail).toBeVisible();
      if (vp.width !== 1280) return;
      // The content column's width, every element's width in it, and each grid's column count (distinct child lefts).
      const shape = () => main.evaluate((m) => ({
        width: Math.round(m.getBoundingClientRect().width),
        widths: [...m.querySelectorAll('*')].map((e) => Math.round(e.getBoundingClientRect().width)).filter((w) => w > 0),
        cols: [...m.querySelectorAll('.stat-row, .fit, .hl-grid, .board-band, .insights-charts, .lab-grid')].map(
          (g) => new Set([...g.children].map((c) => Math.round(c.getBoundingClientRect().left))).size)
      }));
      // fitPairs stretches the lab pairs a frame after fonts load and after a width change, so a snapshot taken
      // at once can be pre-fit at one width and post-fit at the other: wait for its [data-fit-pending] to clear.
      const settled = async () => {
        await page.waitForFunction(() => !document.querySelector('[data-fit-pending]'));
        return shape();
      };
      const at = async (width: number, height: number, url: string) => {
        await page.setViewportSize({ width, height });
        await gotoReady(page, url);
        await expect(rail).toBeVisible({ visible: width >= 1000 && height >= 500 });
      };
      for (const w of [1100, 1280, 1436])
        for (const q of ['', '&tab=insights', '&tab=leaderboards', '&tab=habits', '&tab=consumption', '&tab=brewing']) {
          const url = `/stats?range=all${q}`;
          const bare = Math.min(w, 1416) - 176; // --container-max (1416px) caps the page, rail included
          await at(bare, 499, url);
          const today = await settled();
          await at(w, 900, url);
          expect(await settled(), `${w}px tab${q || '=overview'}: as without the rail at ${bare}px`).toEqual(today);
        }
      // Full width from 1416px: every tab's content column is 1240 - 2rem.
      await at(1436, 900, '/stats?range=all');
      for (const t of await rail.locator('a').all()) {
        await gotoReady(page, (await t.getAttribute('href'))!.replace(/^\?/, '/stats?'));
        expect(Math.round((await main.boundingBox())!.width), (await t.textContent()) ?? '').toBe(1208);
      }
      // Milestones: the ruler is left of the feed without the rail, right of it beside the rail.
      const rulerX = async () => (await page.locator('nav.ruler').boundingBox())!.x - (await page.locator('.feed').boundingBox())!.x;
      await at(999, 800, '/stats?tab=milestones&range=all');
      expect(await rulerX()).toBeLessThan(0);
      await at(1436, 900, '/stats?tab=milestones&range=all');
      expect(await rulerX(), 'ruler right of the feed beside the rail').toBeGreaterThan(0);
      // A rail link switches the tab, keeps the other params and marks itself current.
      await gotoReady(page, '/stats?range=all&tab=habits');
      await expect(rail.locator('[aria-current="page"]')).toHaveText('Habits');
      await rail.getByRole('link', { name: 'Records', exact: true }).click();
      await expect(rail.locator('[aria-current="page"]')).toHaveText('Records');
      await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('records');
      const u = new URL(page.url());
      expect([u.searchParams.get('tab'), u.searchParams.get('range')]).toEqual(['records', 'all']);
      await expect(rail.getByRole('group', { name: 'Lab' }).getByRole('link')).toHaveText(['Sweet spots', 'Brewing', 'Pours', 'Water', 'Gear']);
      await at(1280, 800, '/stats?range=all');
    }
  },
  // A feed shorter than the full side ruler caps it to the feed: it never sticks out below (M10). A window
  // taller than the week's feed makes it short whatever the data; checked at w1280 (the side ruler).
  { name: 'insights-milestones-short', viewports: 'two', path: () => '/stats?tab=milestones&range=1w',
    act: async (page) => {
      if (page.viewportSize()!.width !== 1280) return;
      const feed = page.locator('.feed'), ruler = page.locator('nav.ruler');
      await page.setViewportSize({ width: 1280, height: Math.round((await feed.boundingBox())!.height) + 600 });
      await reloadReady(page);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      // The feed's content end (the grid stretches the feed's own box to the ruler).
      const r = (await ruler.boundingBox())!, end = await feed.evaluate((e) => e.lastElementChild!.getBoundingClientRect().bottom);
      expect(Math.abs(r.y + r.height - end), 'ruler ends with the feed').toBeLessThanOrEqual(1);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
  },
  { name: 'insights-milestones', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      await expect(page.locator('.milestone-feed li').first()).toBeVisible();
      await expect(page.locator('.people-switch')).toHaveCount(0);
      await expectGridRowsFull(page, '.milestone-summary');
      await expectGridRowsFull(page, '.next-up');
      await expectGridRowsFull(page, '.milestone-totals');
      // The ruler updates a frame after a scroll (rAF): let it settle before measuring it.
      const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      // The ruler jumps to the oldest month, stays in view (sticky) and marks it as current.
      const ruler = page.locator('nav.ruler');
      const oldest = page.locator('.feed .month').last();
      const label = `Jump to ${await oldest.textContent()}`;
      await ruler.getByRole('button', { name: label }).last().click();
      // A click scrubs to the middle of that month's section, so the heading itself is out of view when the oldest
      // month is long (seed data is relative to today): the claim is that the oldest month's section is on screen.
      expect(await oldest.evaluate((h) => {
        const end = h.parentElement!.lastElementChild!.getBoundingClientRect().bottom;
        return h.getBoundingClientRect().top < innerHeight && end > 0;
      }), 'oldest month section in view').toBe(true);
      await expect(ruler).toBeInViewport();
      // Scrolled to the feed's very end, the ruler is still wholly on screen (M10).
      await page.evaluate(() => document.querySelector('.feed')!.lastElementChild!.scrollIntoView({ block: 'end' }));
      await settle();
      const rb = (await ruler.boundingBox())!, vh = page.viewportSize()!.height;
      expect(rb.y).toBeGreaterThanOrEqual(0);
      expect(rb.y + rb.height).toBeLessThanOrEqual(vh);
      // The thumb is small and fixed-size, whatever the period (M8).
      const thumb = (await ruler.locator('.band').boundingBox())!;
      expect(Math.min(thumb.width, thumb.height)).toBeLessThanOrEqual(48);
      // Scrolling never hides it: past the feed's end it stays (and slides off with the feed) (M11).
      if (page.viewportSize()!.width >= 700) {
        const feedW = (await page.locator('.feed').boundingBox())!.width;
        await page.evaluate(() => scrollBy(0, document.querySelector('.feed')!.getBoundingClientRect().bottom - 120));
        await settle();
        expect(await ruler.evaluate((e) => getComputedStyle(e).display)).not.toBe('none');
        expect((await page.locator('.feed').boundingBox())!.width).toBe(feedW);
        // A screen too short for it drops it from the start, and the feed takes its column.
        const size = page.viewportSize()!;
        await page.setViewportSize({ width: size.width, height: 260 });
        await expect(ruler).toBeHidden();
        expect((await page.locator('.feed').boundingBox())!.width).toBeGreaterThan(feedW);
        await page.setViewportSize(size);
        await expect(ruler).toBeVisible();
        // Top to bottom in steps: the side ruler keeps one height while on screen, and at the feed's
        // end it slides up and off with it (native sticky) instead of shrinking (M10).
        await page.evaluate(() => document.querySelector('.timeline')!.scrollIntoView());
        await settle();
        const full = (await ruler.boundingBox())!.height;
        // The whole walk runs inside the page (a scroll, two frames, a measure per step): ~100 round trips otherwise.
        const seen: { y: number; h: number; why: string }[] = await page.evaluate(async () => {
          const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const feed = document.querySelector('.feed')!, ruler = document.querySelector<HTMLElement>('nav.ruler')!;
          const out: { y: number; h: number; why: string }[] = [];
          // Until the feed is off the top or the page can't scroll further: below the feed sit Next up and the
          // footer, so on a tall screen the feed's end never leaves it and a feed-only exit ran all 400 steps.
          for (let i = 0, y0 = -1; i < 400 && feed.getBoundingClientRect().bottom > 0; i++) {
            scrollBy(0, 250);
            const y1 = scrollY;
            await frames();
            if (y1 === y0) break;
            y0 = y1;
            const b = ruler.getBoundingClientRect();
            // What the height was computed from, so a failure says which input moved.
            if (b.y + b.height > 0) out.push({ y: b.y, h: b.height, why: `inline ${ruler.style.height || 'none'}, innerHeight ${innerHeight}, --bar-h ${document.querySelector<HTMLElement>('.timeline')!.style.getPropertyValue('--bar-h')}, scrollY ${scrollY}` });
          }
          return out;
        });
        expect(seen.length).toBeGreaterThan(2);
        for (const r of seen) expect(Math.abs(r.h - full), `ruler height ${r.h} vs ${full} (${r.why})`).toBeLessThanOrEqual(1);
        expect(Math.min(...seen.map((r) => r.y)), 'ruler slides up with the feed end').toBeLessThan(0);
        await page.evaluate(() => document.querySelector('.feed')!.lastElementChild!.scrollIntoView({ block: 'end' }));
      }
      // A press on the ruler scrolls so the thumb lands under the pointer: the ruler's length is the
      // scroll from the first month's header under the bars to the panel's bottom at the screen's bottom.
      const track = ruler.locator('.track');
      const at = async (f: number) => {
        const b = (await track.boundingBox())!, n = await ruler.locator('.tick').count();
        return b.height > b.width ? { x: b.x + 2, y: b.y + (f * b.height) / n } : { x: b.x + (f * b.width) / n, y: b.y + 2 };
      };
      // The thumb's center along the ruler, against a pointer point.
      const off = async (q: { x: number; y: number }) => {
        const t = (await ruler.locator('.band').boundingBox())!, b = (await track.boundingBox())!;
        return b.height > b.width ? t.y + t.height / 2 - q.y : t.x + t.width / 2 - q.x;
      };
      await page.evaluate(() => document.querySelector('.feed .month')!.scrollIntoView()); // the ruler stuck in view
      await settle();
      const p = await at(0.6);
      await page.mouse.click(p.x, p.y);
      await settle();
      expect(Math.abs(await off(p)), 'thumb under the pointer').toBeLessThanOrEqual(2.5); // sub-pixel slack: the sticky bar's height is fractional now that Kinds sits in it
      await expect(ruler.locator('[aria-current]')).toHaveAttribute('aria-label', `Jump to ${await page.locator('.feed .month').first().textContent()}`);
      // Dragging along the ruler scrubs the feed: scrollY only grows going towards the oldest.
      const n = await ruler.locator('.tick').count();
      const start = await at(0.1);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      const ys: number[] = [];
      for (let i = 1; i <= 8; i++) {
        const q = await at(0.1 + (i * (n - 0.2)) / 8);
        await page.mouse.move(q.x, q.y);
        ys.push(await page.evaluate(() => scrollY));
      }
      await page.mouse.up();
      expect(ys).toEqual([...ys].sort((x, y) => x - y));
      expect(ys[ys.length - 1]).toBeGreaterThan(ys[0]);
      // Dragged to either end, the thumb reaches the ruler's end and the scroll ends with it: the
      // panel's bottom at the screen's bottom, then the first month's header just under the bars.
      const panel = page.locator('section.chart-panel', { has: page.locator('.feed') });
      const end = await at(n + 0.05), first = await at(-0.05); // past the start: a drag that overshoots
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 4 });
      await settle();
      const pb = (await panel.boundingBox())!;
      // 2: the bar's height is fractional at some widths (its label line), so the scroll lands a sub-pixel off.
      expect(Math.abs(pb.y + pb.height - vh), 'panel bottom at the screen bottom').toBeLessThanOrEqual(2);
      const tEnd = (await track.boundingBox())!; // the side ruler may have slid up a few px with the feed's end
      expect(Math.abs(await off(tEnd.height > tEnd.width ? { x: 0, y: tEnd.y + tEnd.height } : { x: tEnd.x + tEnd.width, y: 0 })),
        'thumb at the ruler end').toBeLessThanOrEqual(2);
      await page.mouse.move(first.x, first.y, { steps: 4 });
      await page.mouse.up();
      await settle();
      const head = await page.evaluate(() => {
        const r = document.querySelector('nav.ruler')!.getBoundingClientRect();
        const top = r.width > r.height ? r.bottom : parseFloat(getComputedStyle(document.querySelector('.timeline')!).getPropertyValue('--bar-h'));
        return document.querySelector('.feed .month')!.getBoundingClientRect().top - top;
      });
      expect(Math.abs(head), 'first month header under the bars').toBeLessThanOrEqual(2);
      // Phone strip, touch: a vertical swipe starting on it doesn't jump the feed; a tap does.
      if (page.viewportSize()!.width < 700) {
        await page.evaluate(() => document.querySelector('.feed .month')!.scrollIntoView());
        await settle();
        const q = await at(n - 0.5); // the oldest month: a tap scrolls down
        const touch = (moves: [number, number][], end: 'pointerup' | 'pointercancel') => page.evaluate(([x, y, moves, end]) => {
          const nav = document.querySelector<HTMLElement>('nav.ruler')!, before = scrollY;
          nav.setPointerCapture = () => {}; // a synthetic pointer can't be captured
          const fire = (type: string, dx: number, dy: number) => nav.dispatchEvent(new PointerEvent(type,
            { pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true, bubbles: true, clientX: x + dx, clientY: y + dy }));
          fire('pointerdown', 0, 0);
          for (const [dx, dy] of moves) fire('pointermove', dx, dy);
          const last = moves[moves.length - 1] ?? [0, 0];
          fire(end, last[0], last[1]);
          return scrollY - before;
        }, [q.x, q.y, moves, end] as const);
        expect(await touch([[1, 6], [2, 30], [3, 60]], 'pointercancel')).toBe(0); // the browser pans: cancel
        expect(await touch([[1, 6], [2, 30]], 'pointerup')).toBe(0);
        expect(await touch([[2, 1]], 'pointerup')).toBeGreaterThan(0); // a tap jumps
        await page.evaluate(() => document.querySelector('.feed .month')!.scrollIntoView());
        await settle();
        expect(await touch([[10, 2], [40, 3]], 'pointerup')).toBeGreaterThan(0); // a sideways drag scrubs
      }
    } },
  { name: 'insights-milestones-month-link', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      // A month header's #anchor lands it under the sticky bars, and survives a filter change (M9).
      const id = (await page.locator('.feed .month').nth(1).getAttribute('id'))!;
      // about:blank first: a real load, so the page's own on-load hash scroll runs (not a same-page jump).
      await page.goto('about:blank');
      await page.goto(`/stats?tab=milestones&range=all#${id}`);
      const head = page.locator(`[id="${id}"]`);
      await expect(head).toBeInViewport();
      await expect(head.locator('a')).toHaveAttribute('href', new RegExp(`chart=${id}#${id}$`));
      // Polled: the on-load scroll and the ruler's rAF layout can land after the first read.
      const below = async (el: typeof head, max: number) => {
        const elId = (await el.getAttribute('id'))!;
        const off = () => anchorGap(page, elId);
        await expect.poll(off).toBeGreaterThanOrEqual(-1);
        await expect.poll(off).toBeLessThan(max);
      };
      await below(head, 80);
      await page.getByRole('group', { name: 'Kinds' }).getByRole('button', { name: 'Counts' }).click();
      await expect(page).toHaveURL(new RegExp(`kinds=counts.*#${id}$`));
      // A month outside the period: no error, the page stays at the top.
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/stats?tab=milestones&range=1w#m-2000-01');
      await expect(page.locator('nav.ruler, .hl-empty').first()).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(errors).toEqual([]);
      // A tile's caption links its own anchor, which lands the tile under the sticky bar (M12).
      await page.goto('/stats?tab=milestones&range=all#milestones-total-brews');
      const tile = page.locator('#milestones-total-brews');
      await expect(tile.locator('.caption-link')).toHaveAttribute('href', '#milestones-total-brews');
      await below(tile, 40);
    } },
  { name: 'insights-milestones-firsts', path: () => '/stats?tab=milestones&range=all&kinds=firsts' },
  { name: 'insights-milestones-compare', path: () => '/stats?tab=milestones&range=1w&compare=1' },
  { name: 'insights-sweetspots', path: () => '/stats?tab=sweetspots',
    act: async (page) => {
      await expect(page.locator('.spot-card')).not.toHaveCount(0);
      await expect(page.getByText(/^Matching: \d+ bags, \d+ brews$/)).toBeVisible();
      await expect(page.locator('#spot-temp .hl-value')).not.toHaveText(/NaN|undefined/);
      await expect(page.getByLabel('Compare')).toHaveCount(0);
      // Nothing takes focus on load (the phone keyboard would pop up).
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
      await expectGridRowsFull(page, '.spot-grid');
      // ui-rules 34: every card in a row is that row's height token.
      const off = await page.locator('.spot-grid').evaluate((g) => [...g.children].map((c) => c.getBoundingClientRect())
        .filter((r, _, all) => all.some((o) => Math.round(o.top) === Math.round(r.top) && Math.abs(o.height - r.height) > 2)).length);
      expect(off).toBe(0);
      // Card content stays inside the card (the token holds it at every width).
      const spills = await page.locator('.spot-card').evaluateAll((cards) => cards.flatMap((c) => {
        const o = c.getBoundingClientRect();
        return [...c.querySelectorAll('.hl-top, .hl-value, .hl-line, .stat-label')].flatMap((e) => {
          const r = e.getBoundingClientRect();
          if (!r.width) return []; // a line the card hid to fit (data-tight)
          return r.left < o.left - 1 || r.right > o.right + 1 || r.bottom > o.bottom + 1 ? [`${c.id}: ${e.textContent?.trim().slice(0, 24)} spills`] : [];
        });
      }));
      expect(spills).toEqual([]);
      const over = await page.locator('.spot-card').evaluateAll((cs) => cs.filter((c) => c.scrollHeight > c.clientHeight + 1).map((c) => c.id));
      expect(over).toEqual([]);
      await expectDeltaInk(page);
      await expectFoldCorners(page);
      // Every card's mini chart takes spare height (≥ 1.5rem of columns), under a value that stays the largest text.
      const charts = await page.locator('.spot-card').evaluateAll((cs) => cs.flatMap((c) => {
        const cols = c.querySelector('.cols')?.getBoundingClientRect();
        const big = parseFloat(getComputedStyle(c.querySelector('.hl-value')!).fontSize);
        const bigger = [...c.querySelectorAll('.hl-line, .ends, .stat-label')].some((e) => parseFloat(getComputedStyle(e).fontSize) >= big);
        // Every bar (clipped thin ones too) stays inside the chart's column area.
        const out = cols && [...c.querySelectorAll('.bar')].some((b) => { const r = b.getBoundingClientRect(); return r.top < cols.top - 1 || r.bottom > cols.bottom + 1; });
        return [...(!cols || cols.height < 23 ? [`${c.id} chart ${cols?.height}px`] : []), ...(bigger ? [`${c.id} value not largest`] : []), ...(out ? [`${c.id} bar outside chart`] : [])];
      }));
      expect(charts).toEqual([]);
      // A tap on a band's bar shows its themed tip; a tap elsewhere closes it. The column's empty space opens
      // nothing (ui-rules 50, user 2026-10-18: not above the bar).
      await expectMarkOnly(page, page.locator('.spot-chart .col'), '.bar', page.locator('.spot-chart .cell-tip'));
      await page.locator('#spot-temp .spot-chart .bar:not(.empty)').first().click();
      // A short structured tip (ui-rules 36): the band as its title, then label/value rows.
      await expect(page.locator('#spot-temp .cell-tip .tip-title').first()).not.toBeEmpty();
      await expect(page.locator('#spot-temp .cell-tip .tip-rows')).toContainText(/Bags\s*\d+\s*Brews\s*\d+/);
      await page.locator('.insights-period').last().click();
      await expect(page.locator('.cell-tip')).toHaveCount(0);
      // Keyboard: focus opens a band tip, → moves it, Escape closes it, Enter opens the card's full text.
      // Reached by Tab (the keyboard path): from the card's last control before the chart.
      const chart = page.locator('#spot-temp .spot-chart');
      await chart.evaluate((el) => {
        const prev = [...document.querySelectorAll<HTMLElement>('a[href], button, select, [tabindex="0"]')];
        prev[prev.indexOf(el as HTMLElement) - 1].focus();
      });
      await page.keyboard.press('Tab');
      await expect(chart).toBeFocused();
      await expect(page.locator('#spot-temp .cell-tip')).toBeVisible();
      const start = await page.locator('#spot-temp .cell-tip').textContent();
      await chart.press('Escape');
      await chart.press('ArrowRight'); // first press, no tip open: the start band, not one past it
      await expect(page.locator('#spot-temp .cell-tip')).toHaveText(start!);
      await chart.press('ArrowRight');
      await expect(page.locator('#spot-temp .cell-tip')).toContainText(/Brews\s*\d+/);
      await chart.press('Escape');
      await expect(page.locator('.cell-tip')).toHaveCount(0);
      // The card's full text is the chart's description (no card popover: user, 2026-10-18).
      await expect(page.locator('#spot-temp-full')).toContainText(/vs same bag|Across|No comparison|Not enough/);
      await chart.blur();
      // S-grind: the Grind card spans every setting brewed, lowest to highest, no-match ones too: the same
      // bands as Brewing's Grind chart (same period, ratings and grinder, no filters).
      const spotBands = (await page.locator('#spot-grind .spot-chart').getAttribute('aria-label'))!.split('; ').map((t) => t.split(' · ')[0]);
      await gotoReady(page, '/stats?tab=brewing');
      const titles: string[] = [];
      for (const row of await page.locator('[data-section="brewing-grind"] .bar-row').all()) {
        await row.locator('.bar-label').click();
        titles.push((await page.locator('[data-section="brewing-grind"] .cell-tip .tip-title').first().textContent())!.trim());
      }
      expect(spotBands).toEqual(titles);
      await gotoReady(page, '/stats?tab=sweetspots');
    } },
  { name: 'insights-sweetspots-bag', path: (s) => `/stats?tab=sweetspots&bag=${s.slugs.linked}&roast=Light&process=Washed`,
    act: async (page) => {
      // The bag's Roast level and Process are page-wide filters now: chips under the bar.
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/Light/, /Washed/]);
      await expect(page.locator('.top-bags li').first()).toBeVisible();
      // Value columns line up under their header (G4).
      const cols = await page.locator('[data-section="spots-top"]').evaluate((sec) => {
        const right = (e: Element | null) => Math.round(e!.getBoundingClientRect().right);
        const head = [...sec.querySelectorAll('.top-head .num')].map(right);
        return [...sec.querySelectorAll('.top-bags .board-row')].every((row) => [...row.querySelectorAll('.num')].map(right).every((x, i) => Math.abs(x - head[i]) <= 1));
      });
      expect(cols).toBe(true);
    } },
  { name: 'insights-sweetspots-filters', viewports: 'two', path: () => '/stats?tab=sweetspots&roast=Ultralight&process=Natural&origin=Ethiopia&roaster=Lab%20Roasters',
    act: async (page) => {
      // The Coffees fields live only in the Coffees panel (ui-rules 6): Sweet spots keeps Bag (and Grinder).
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/Ultralight/, /Natural/, /Ethiopia/, /Lab Roasters/]);
      await expect(page.locator('.spot-picker').getByLabel('Process')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reset picker' })).toHaveCount(0);
    } },
  // Gate P4: Brews until dialed in by roast level and by process, beside each other from 900px; whole group names.
  { name: 'insights-brewing-settle', path: () => '/stats?tab=brewing&range=all#brewing-settle-roast',
    act: async (page) => {
      const cards = page.locator('[data-section^="brewing-settle-"]');
      await expect(cards.first()).toBeVisible();
      for (const c of await cards.all()) {
        const n = await c.locator('.settle-cols .col').count();
        expect(n).toBeGreaterThanOrEqual(2);
        await expect(c.locator('.bar-labels span')).toHaveCount(n);
        // Names are whole: no label is cut.
        const cut = await c.locator('.bar-labels span').evaluateAll((ss) => ss.filter((x) => x.scrollWidth > x.clientWidth + 1).length);
        expect(cut).toBe(0);
      }
      await expectPairsFilled(page, '.lab-grid');
      // A tap on a bar opens its tip (ui-rules 29, 36): group name and median, then counts; a small group's caveat last.
      await expectMarkOnly(page, page.locator('.settle-cols .col'), '.bar', page.locator('.float-tip'));
      await page.locator('.settle-cols .col .bar').first().click();
      const tip = page.locator('.float-tip');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('Median settle brew');
      await expectTipInView(page, tip);
      const small = page.locator('.settle-cols .col:has(.small-sample-mark)').first();
      if (await small.count()) {
        await small.locator('.bar').click();
        expect(await tip.evaluate((el) => el.lastElementChild!.className)).toBe('tip-block caution');
      }
    } },
  // Gate P4: "Leaning 20+ g" reads as one phrase in one size; a tier-3 card reads "Not enough data".
  { name: 'insights-sweetspots-words', path: () => '/stats?tab=sweetspots&range=all',
    act: async (page) => {
      const cards = await page.locator('.spot-card').evaluateAll((cs) => cs.map((c) => ({
        value: c.querySelector('.hl-value')!.textContent!, small: !!c.querySelector('.hl-value small'), ev: c.querySelector('.evidence')?.textContent ?? ''
      })));
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) {
        expect(c.value).not.toMatch(/Leaning\S/);
        expect(c.small).toBe(false);
        // Every line is short: its comparison and bag count sit in its tip (user, 2026-10-17).
        expect(c.ev).not.toContain('·');
        expect(c.ev).not.toMatch(/^Across /);
      }
      // A result line (same-bag delta, "Highest across ...", a tie's "All within 0.2") is one line in the accent ink.
      // (a phone card that hid its line to fit, data-tight 4, is skipped)
      const results = await page.locator('.spot-card .evidence.result').evaluateAll((es) => es.filter((e) => e.getClientRects().length).map((e) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--color-accent)';
        e.append(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return { ink: getComputedStyle(e).color === want, lines: e.querySelector('.text-tip')?.getClientRects().length ?? 1, text: e.textContent };
      }));
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) expect(r, r.text!).toMatchObject({ ink: true, lines: 1 });
      const best = page.locator('.spot-card .evidence .text-tip', { hasText: /vs same bag/ }).first(); // the seed has one at every width
      await best.click();
      const tip = page.locator('.float-tip');
      await expect(tip).toContainText('vs same bag');
      await expectTipInView(page, tip);
      // One line at any width: a long answer ends in an ellipsis; the tip's title has it whole.
      const lines = page.locator('.spot-card .evidence .text-tip');
      for (const n of await lines.evaluateAll((ts) => ts.map((t) => t.getClientRects().length))) expect(n).toBeLessThanOrEqual(1); // 0: hidden to fit (data-tight 4)
    } },
  {
    // No card-level popover on Sweet spots (user, 2026-10-18): a click on a card's empty space opens nothing; a card
    // that tightened (a cut or hidden line) has its full text on its value, a text tip.
    name: 'insights-sweetspots-no-card-popover', viewports: 'two',
    path: () => '/stats?tab=sweetspots',
    act: async (page) => {
      const card = page.locator('.spot-card').first();
      const b = (await card.boundingBox())!;
      await page.mouse.click(b.x + 3, b.y + b.height / 2); // the card's left padding
      await expect(page.locator(':popover-open')).toHaveCount(0);
      const bad = await page.locator('.spot-card').evaluateAll((cs) => cs.filter((c) => (c as HTMLElement).dataset.tight && !c.querySelector('.hl-value .text-tip')).map((c) => c.id));
      expect(bad, 'tightened cards without a full-text tip on the value').toEqual([]);
    }
  },
  { name: 'cursor-rules', viewports: 'two', path: () => '/stats?tab=habits',
    act: async (page) => {
      // ui-rules 50: text shows the arrow yet stays selectable; a tip trigger shows help, never the hand; a link the hand.
      const css = (sel: string) => page.locator(sel).first().evaluate((e) => [getComputedStyle(e).cursor, getComputedStyle(e).userSelect]);
      expect(await css('.stat-item .stat-value')).toEqual(['default', 'auto']);
      expect(await css('h1')).toEqual(['default', 'auto']);
      for (const sel of ['.heatmap .heat-cell', '.brew-calendar .cal-cell']) expect((await css(sel))[0], sel).toBe('default'); // chart marks keep the arrow (user, 2026-10-26)
    } },
  { name: 'cursor-rules-fields', viewports: 'two', path: () => '/subscriptions?view=list',
    act: async (page) => {
      // The I-beam only in a field meant for typing; buttons and links the hand; a ? help trigger help.
      const cur = (l: Locator) => l.first().evaluate((e) => getComputedStyle(e).cursor);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      expect(await cur(page.locator('input[name="subscription_name"]'))).toBe('text');
      expect(await cur(page.locator('td'))).toBe('default');
      expect(await cur(page.locator('main button:not(:disabled)'))).toBe('pointer');
      await page.goto('/stats');
      expect(await cur(page.locator('.stat-item .caption-link'))).toBe('pointer');
      expect(await cur(page.locator('.mode-tip-button'))).toBe('help');
    } },
  // Tips open only on their marks (ui-rules 50): a chart's empty space opens none and keeps the arrow; a bar or a line's
  // point opens it with the help cursor.
  { name: 'tip-hit-chart-bars', viewports: 'two', path: () => '/stats?tab=onhand&range=all',
    act: (page) => expectChartMarkOnly(page, page.locator('[data-section="onhand-bag-states"] canvas')) },
  { name: 'tip-hit-chart-line', viewports: 'two', path: () => '/stats?tab=consumption',
    act: (page) => expectChartMarkOnly(page, page.locator('.chart-container canvas').first(), true) },
  { name: 'tip-hit-delta-bars', viewports: 'two', path: () => '/stats?tab=brewing&range=all',
    act: (page) => expectMarkOnly(page, page.locator('[data-section="brewing-temp"] .track'), '.bar', page.locator('.cell-tip:popover-open')) },
  { name: 'insights-findings-headline-clamp', path: () => '/stats?tab=insights&range=all',
    act: async (page) => {
      // A Findings headline is 2 lines at most at any width, cut with an ellipsis (user, 2026-10-18).
      const over = await page.locator('.finding-grid .hl-caption .stat-label').evaluateAll((hs) => hs.flatMap((h) => {
        const r = document.createRange();
        r.selectNodeContents(h);
        const lines = new Set([...r.getClientRects()].filter((q) => q.width > 1 && q.bottom <= h.getBoundingClientRect().bottom + 1).map((q) => Math.round(q.bottom))).size;
        const clamp = +getComputedStyle(h).webkitLineClamp;
        return lines > 2 || clamp !== 2 ? [`${h.closest('.hl-card')!.id}: ${lines} lines, clamp ${clamp}`] : [];
      }));
      expect(over).toEqual([]);
      // A clamped headline (one is lengthened where none clamps at this width) shows its full text as a tip: on hover
      // (desktop), and a tap or click also follows its #anchor link and keeps the tip until a tap elsewhere.
      const i = await page.locator('.finding-grid .hl-card').evaluateAll((cs) => {
        const cut = (c: Element) => { const h = c.querySelector('.hl-caption .stat-label')!; return h.scrollHeight > h.clientHeight + 1; };
        const j = cs.findIndex(cut);
        if (j >= 0) return j;
        cs[0].querySelector('.caption-link')!.textContent = 'A very long finding headline that keeps going '.repeat(6);
        return cut(cs[0]) ? 0 : -1;
      });
      expect(i).toBeGreaterThanOrEqual(0);
      const card = page.locator('.finding-grid .hl-card').nth(i), id = (await card.getAttribute('id'))!;
      const head = card.locator('.caption-link');
      const full = (await head.textContent())!.trim();
      const tip = page.locator('.cell-tip:popover-open');
      if (!touch()) {
        await head.hover();
        await expect(tip.locator('.tip-title')).toHaveText(full);
        await page.mouse.move(1, 1);
        await expect(tip).toHaveCount(0);
      }
      await tapOn(head);
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(tip.locator('.tip-title')).toHaveText(full);
      await page.waitForTimeout(700);
      await expect(tip, 'still open a moment after the tap').toBeVisible();
      await tapOn(page.locator('h1'));
      await expect(tip).toHaveCount(0);
      // An unclamped headline is just its link: no tip.
      const j = await page.locator('.finding-grid .hl-card').evaluateAll((cs) => cs.findIndex((c) => {
        const h = c.querySelector('.hl-caption .stat-label')!;
        return h.scrollHeight <= h.clientHeight + 1;
      }));
      if (j >= 0 && !touch()) {
        await page.locator('.finding-grid .hl-card').nth(j).locator('.caption-link').hover();
        await page.waitForTimeout(150);
        await expect(tip).toHaveCount(0);
      }
    } },
  { name: 'insights-findings-headline-tip', path: () => '/stats?tab=insights&range=all',
    act: async (page) => {
      // One headline tip on every device (user, 2026-10-18): the full headline, then the card's clarifying lines
      // (likeStandout: the like-group compared with). Hover on desktop; a tap follows the #anchor and opens it too.
      const head = page.locator('#insight-likeStandout .caption-link'), full = (await head.textContent())!.trim();
      expect(full).toMatch(/ like coffees by /);
      const tip = page.locator('.cell-tip:popover-open');
      if (!touch()) {
        await head.hover();
        await expect(tip).toHaveCount(1);
        await expect(tip.locator('.tip-title')).toHaveText(full);
        // Labeled points (ui-rules 36): a bold label, then the value.
        await expect(tip.locator('.tip-points li').first()).toHaveText(/^Compared with: .+coffees/);
        await expect(tip.locator('.tip-points li .tip-label').first()).toHaveText('Compared with:');
        expect(await tip.locator('.tip-label').first().evaluate((e) => +getComputedStyle(e).fontWeight)).toBeGreaterThanOrEqual(700);
        await page.mouse.move(1, 1);
        await expect(tip).toHaveCount(0);
      }
      await tapOn(head);
      await expect(page).toHaveURL(/#insight-likeStandout$/);
      await expect(tip.locator('.tip-points li').first()).toHaveText(/^Compared with: /);
      await tapOn(page.locator('h1'));
      await expect(tip).toHaveCount(0);
      // A versus card's split fills the card: "Same bags" sample, no hole.
      const vs = page.locator('[id^="insight-sameBagVersus-"]').first();
      await expect(vs.locator('.sample')).toHaveText(/^Same bags · \d+ bags, \d+ brews/);
      await expectNoHoles(vs);
      await expectValueLine(page);
    } },
  { name: 'insights-findings-list-head-tips', viewports: 'two', path: () => '/stats?tab=insights&range=all',
    act: async (page) => {
      // The same headline tip in Top stories, Myth busters and Too early as in the grid (user, 2026-10-18). Where no
      // seeded headline there has points, one is given a point: the mechanism is what's under test.
      const tip = page.locator('.cell-tip:popover-open');
      for (const sel of ['.story:not([aria-hidden="true"]) h3[data-head]', '.myth h3[data-head]', '.early-head[data-head]']) {
        const h = page.locator(sel).first();
        if (!(await h.count())) continue;
        await h.evaluate((e) => e.dataset.head === '[]' && (e.dataset.head = '[["Test","a point"]]'));
        const [full, label] = await h.evaluate((e) => [e.textContent!.trim(), JSON.parse(e.dataset.head!)[0][0]]);
        await h.scrollIntoViewIfNeeded();
        if (!touch()) {
          await h.hover();
          await expect(tip.locator('.tip-title'), sel).toHaveText(full);
          await expect(tip.locator('.tip-points .tip-label').first()).toHaveText(`${label}:`);
          await page.mouse.move(1, 1);
          await expect(tip).toHaveCount(0);
        }
        await expectTapTip(page, h, tip, page.locator('h1'));
      }
    } },
  { name: 'insights-findings-gear-switch', path: () => '/stats?tab=insights&range=3m',
    act: async (page) => {
      // A gear switch card is its headline, sample and a tall chart; its words are the headline's tip (user, 2026-10-18).
      const card = page.locator('[id^="insight-gearShare-"]').filter({ has: page.locator('.caption-link', { hasText: 'now mostly' }) }).first();
      await expect(card).toBeVisible();
      await expect(card.locator('.body')).toHaveCount(0);
      const [chart, h] = await card.evaluate((c) => [c.querySelector('.multi svg')!.getBoundingClientRect().height, c.getBoundingClientRect().height]);
      expect(chart / h, 'the chart is the card\'s draw').toBeGreaterThan(0.25);
      await expectNoHoles(card);
      const tip = page.locator('.cell-tip:popover-open');
      await tapOn(card.locator('.caption-link'));
      await expect(tip.locator('.tip-points .tip-label')).toHaveText(['Before:', 'Now:']);
      await expect(tip.locator('.tip-points li').first()).toHaveText(/^Before: .+ \(\d+% as of \w+ \d+\)$/);
    } },
  { name: 'insights-milestones-ruler-cursor', viewports: 'two', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      // The whole ruler is grab (a press anywhere moves the view there), grabbing while dragging (user, 2026-10-18).
      const ruler = page.locator('nav.ruler');
      test.skip(!(await ruler.isVisible()), 'no ruler on a screen this short');
      const cur = (l: Locator) => l.first().evaluate((e) => getComputedStyle(e).cursor);
      expect(await cur(ruler)).toBe('grab');
      expect(await cur(ruler.locator('.tick'))).toBe('grab');
      if (touch()) return;
      await ruler.scrollIntoViewIfNeeded();
      const b = (await ruler.boundingBox())!, vh = page.viewportSize()!.height;
      const [x, y] = [b.x + b.width / 2, (Math.max(b.y, 0) + Math.min(b.y + b.height, vh)) / 2]; // its visible middle
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 5, y + 5);
      expect(await cur(ruler)).toBe('grabbing');
      expect(await cur(ruler.locator('.tick'))).toBe('grabbing');
      await page.mouse.up();
      expect(await cur(ruler)).toBe('grab');
    } },
  { name: 'tip-hit-findings', viewports: 'two', path: () => '/stats?tab=insights&range=all',
    act: async (page) => {
      // A finding card's empty space opens nothing; its clamped body opens the full text (hover, then a click keeps it).
      const card = page.locator('.finding-grid .hl-card').first();
      const b = (await card.boundingBox())!;
      await page.mouse.move(b.x + 3, b.y + b.height / 2);
      await page.mouse.click(b.x + 3, b.y + b.height / 2);
      await expect(page.locator(':popover-open')).toHaveCount(0);
      const i = await page.locator('.finding-grid .hl-card').evaluateAll((cs) => {
        // Prefer a body already cut by its line clamp: a longer text in a body that fits would grow a fixed-height card.
        const cut = (c: Element) => { const e = c.querySelector('.body'); return !!e && e.scrollHeight > e.clientHeight + 1; };
        const j = cs.findIndex(cut) >= 0 ? cs.findIndex(cut) : cs.findIndex((c) => c.querySelector('.body'));
        if (j >= 0) cs[j].querySelector('.body')!.textContent = 'A very long finding body that keeps going. '.repeat(12);
        return j;
      });
      test.skip(i < 0, 'no finding with a body');
      const body = page.locator('.finding-grid .hl-card').nth(i).locator('.body');
      await body.hover();
      const full = page.locator('.finding-grid .mode-tip:popover-open');
      await expect(full).toBeVisible();
      expect(await body.evaluate((e) => getComputedStyle(e).cursor)).toBe('help');
      await body.click();
      await page.mouse.move(1, 1);
      await page.waitForTimeout(300);
      await expect(full, 'a click keeps it open').toBeVisible();
    } },
  // Tap tips (ui-rules 49): every tip kind a hover opens also opens on a tap, stays, and a tap elsewhere closes it.
  { name: 'tap-tip-text', viewports: 'two', path: () => '/coffees?status=all&view=list',
    act: (page) => expectTapTip(page, page.getByRole('button', { name: /^Roast level: / }).first(), page.locator('.cell-tip:popover-open'), page.locator('h1')) },
  { name: 'tap-tip-mode', viewports: 'two', path: () => '/stats?people=person',
    act: (page) => expectTapTip(page, page.locator('.mode-tip-button').first(),
      page.locator('.mode-tip:popover-open'), page.locator('h1')) },
  { name: 'tap-tip-chart', viewports: 'two', path: () => '/stats?tab=habits&range=all',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'By day of week' }) });
      await expectTapTip(page, () => tapChart(page, panel.locator('canvas')), page.locator('.chart-container .cell-tip:popover-open'), panel.locator('h2'));
    } },
  { name: 'tap-tip-sample', viewports: 'two', path: () => '/stats?tab=leaderboards&avg=raw',
    act: (page) => expectTapTip(page, page.locator('.sample-note').first(), page.locator('.cell-tip:popover-open'), page.locator('.insights-period').last()) },
  { name: 'tap-tip-label', viewports: 'two', path: () => '/stats?tab=habits&range=1w&compare=1',
    act: (page) => expectTapTip(page, page.locator('.insights-delta').first(), page.locator('.cell-tip:popover-open'), page.locator('h1')) },
  { name: 'tap-tip-heatmap', viewports: 'two', path: () => '/stats?tab=habits',
    act: async (page) => {
      const tip = page.locator('.cell-tip:popover-open'), away = page.locator('.insights-period').last();
      await expectTapTip(page, page.locator('.heatmap .heat-cell').nth(10), tip, away);
      await expectTapTip(page, page.locator('.brew-calendar .cal-cell').last(), tip, away);
    } },
  { name: 'tap-tip-map', viewports: 'two', path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      const tip = page.locator('.cell-tip:popover-open');
      const tapEthiopia = async () => {
        await page.locator('.world-map').scrollIntoViewIfNeeded();
        const [x, y] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
          const path = p as unknown as SVGPathElement, svg = path.ownerSVGElement!, pt = svg.createSVGPoint();
          pt.x = 582; pt.y = 200; // inside Ethiopia in the 957x420 viewBox
          const c = pt.matrixTransform(svg.getScreenCTM()!);
          return [c.x, c.y];
        });
        await (touch() ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
        // A click pins it: the mouse leaving the map doesn't close it (E, 2026-10-18).
        if (!touch()) await page.mouse.move(1, 1);
      };
      await expectTapTip(page, tapEthiopia, tip, page.locator('.insights-period').last());
      await tapEthiopia();
      await page.keyboard.press('Escape');
      await expect(tip).toBeHidden();
    } },
  { name: 'insights-brewing', path: () => '/stats?tab=brewing',
    act: async (page) => {
      for (const h of ['Rest curve', 'Dial-in', 'Brews until dialed', 'Grind drift', 'Variables vs rating'])
        await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
      // ui-rules 48: a chart note's "Always all brews" is a setting name: bold brown.
      const notes = await page.locator('.chart-note').evaluateAll((ns) => ns.filter((n) => n.textContent!.includes('Always all brews')).map((n) => [...n.querySelectorAll('.setting-name')].some((e) => e.textContent === 'Always all brews')));
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.every(Boolean)).toBe(true);
      // ui-rules 47: a chart that drops data says so top right, and See all opens a tip with what it dropped.
      const best = page.locator('[data-section="brewing-best"]');
      const note = best.locator('.cut-note');
      await expect(note).toHaveText(/^Only the first 7 brews are shown\. See all\.$/);
      const [nb, hb, sb] = await Promise.all([note.boundingBox(), best.locator('.lab-head').boundingBox(), best.boundingBox()]);
      expect(nb!.x + nb!.width).toBeGreaterThan(sb!.x + sb!.width - 40); // right-aligned in the card
      expect(nb!.y + nb!.height).toBeLessThanOrEqual(hb!.y + hb!.height + 1); // in the heading row(s), above the chart
      await note.getByRole('button', { name: /^See all/ }).click();
      const seeAll = page.locator('.float-tip');
      await expect(seeAll.locator('.tip-title')).toHaveText('Best brew after #7');
      await expectTipInView(page, seeAll);
      await page.keyboard.press('Escape');
      // Fixed slots (G9/B5): Temp | Ratio, Dose | Bloom, Brew time full width, Grind | Grind drift.
      const order = await page.locator('.brewing-vars .lab-chart').evaluateAll((ps) => ps.map((p) => (p as HTMLElement).dataset.section));
      expect(order).toEqual(['temp', 'ratio', 'dose', 'bloom', 'time', 'grind', 'drift'].map((k) => `brewing-${k}`));
      const box = async (k: string) => (await page.locator(`[data-section="brewing-${k}"]`).boundingBox())!;
      if ((page.viewportSize()?.width ?? 0) >= 900) {
        expect(Math.round((await box('grind')).y)).toBe(Math.round((await box('drift')).y));
        expect((await box('time')).width).toBeGreaterThan((await box('temp')).width * 1.8);
      }
      // The rest heatmap: a cell tip is a title and label/value rows (ui-rules 36).
      const rest = page.locator('[data-section="brewing-rest"] .heatmap.diverging');
      await rest.locator('.heat-cell:not(.none)').first().click();
      await expect(rest.locator('.cell-tip .tip-title').first()).toContainText(' · ');
      await expect(rest.locator('.cell-tip .tip-rows')).toContainText('vs usual');
      await page.locator('.insights-period, h1').first().click();
      await expect(page.getByLabel('Compare')).toHaveCount(0);
      // Nothing takes focus on load (the phone keyboard would pop up).
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
      // Full rows: two columns ≥ 900 px, Brew time spans both; Dial-in beside Brews until dialed.
      await expectGridRowsFull(page, '.lab-grid', true);
      // A4Z grind bands: labeled "1.3.0", the tip gives the range "1.3.0 – 1.3.9".
      const grindRow = page.locator('[data-section="brewing-grind"] .bar-row').first();
      await expect(grindRow.locator('.bar-label')).toHaveText(/^\d+\.\d+\.0$/);
      await grindRow.locator('.bar-label').click();
      await expect(page.locator('[data-section="brewing-grind"] .cell-tip .tip-title').first()).toHaveText(/^(\d+\.\d+)\.0 – \1\.9$/);
      await page.locator('h1').click();
      // A pair of charts is one height; the shorter fills it, the taller scrolls inside past 2× (ui-rules 37).
      await expectPairsFilled(page, '.lab-grid');
      await expectInnerScroll(page, '.fit-body');
      // G1/G2 colors: same-bag bars use the heatmaps' --div-high/--div-low; Grind drift is one neutral ink.
      // T3: every bar and heat cell colors by its own value on one fixed scale: gray under 0.05, then the theme's
      // visible tint floor (--div-floor) ramping to full color at 0.4.
      const colors = await page.evaluate(() => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const resolve = (bg: string) => ((probe.style.background = bg), getComputedStyle(probe).backgroundColor);
        const floor = +getComputedStyle(document.documentElement).getPropertyValue('--div-floor');
        const expected = (v: number) => {
          const t = Math.abs(v) < 0.05 ? 0 : floor + (1 - floor) * Math.min(1, (Math.abs(v) - 0.05) / 0.35);
          return resolve(t ? `color-mix(in oklab, var(${v < 0 ? '--div-low' : '--div-high'}) ${(100 * t).toFixed(2)}%, var(--div-mid))` : 'var(--div-mid)');
        };
        const num = (s: string) => parseFloat(s.replace('−', '-'));
        // The shown value is rounded to 2 dp: any value that rounds to it may be the drawn one.
        // Colors match within 2 per channel (the drawn mix rounds its percentage).
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const same = (a: string, b: string) => rgb(a).every((x, i) => Math.abs(x - rgb(b)[i]) <= 2);
        const near = (got: string, v: number) => [-0.005, -0.0025, 0, 0.0025, 0.005].some((d) => same(expected(v + d), got));
        const out: string[] = [];
        for (const row of document.querySelectorAll('[data-section="brewing-vars"] .bar-row')) {
          const bar = row.querySelector('.bar'), v = num(row.querySelector('.bar-value')!.textContent!.trim());
          if (bar && !row.closest('[data-section="brewing-drift"]') && !near(getComputedStyle(bar).backgroundColor, v)) out.push(`bar ${v}`);
        }
        for (const cell of document.querySelectorAll<HTMLElement>('[data-section="brewing-rest"] .heat-cell:not(.none)')) {
          const v = num(cell.getAttribute('aria-label')!.split(' · ').at(-1)!);
          if (!near(getComputedStyle(cell).backgroundColor, v)) out.push(`cell ${v}`);
        }
        // Small samples are striped over its full color, never faded with opacity (the hue must not wash to gray).
        for (const el of document.querySelectorAll('.small-sample-mark')) {
          const cs = getComputedStyle(el);
          if (cs.opacity !== '1' || !cs.backgroundImage.includes('gradient')) out.push(`thin mark ${cs.opacity} ${cs.backgroundImage.slice(0, 20)}`);
        }
        const drift = getComputedStyle(document.querySelector('[data-section="brewing-drift"] .bar')!).backgroundColor;
        const muted = resolve('var(--color-text-muted)');
        probe.remove();
        return { out, drift, muted };
      });
      expect(colors.out).toEqual([]);
      expect(colors.drift).toBe(colors.muted);
      await expectDeltaInk(page);
      await expectFoldCorners(page);
      // C2: a tip never clips: the Bloom chart's last row and a top-row heat cell, scrolled just under the sticky bar.
      for (const target of ['[data-section="brewing-bloom"] .bar-row >> nth=-1 >> .bar-label', '[data-section="brewing-rest"] .heat-cell:not(.none) >> nth=0']) {
        const el = page.locator(target);
        await el.evaluate((e) => {
          // the same as pinnedBottom() (floatTip.ts), inline: a serialized function can't call another
          const pin = document.querySelector('.cbar-mini') ?? document.querySelector('.cbar.overlay');
          const fb = document.querySelector('.filter-bar');
          const sticky = fb && getComputedStyle(fb).position === 'sticky' ? fb.getBoundingClientRect().bottom : 0;
          const bar = pin ? pin.getBoundingClientRect().bottom : Math.max(sticky, 0);
          scrollBy(0, e.getBoundingClientRect().top - bar - 4); // nothing above it in view: the tip must flip below
        });
        await el.click();
        await expectTipInView(page, page.locator('.cell-tip:popover-open'));
      }
      await page.locator('h1').click();
      // Each chart's header (title + toggles) is one row from 768 px.
      if ((page.viewportSize()?.width ?? 0) >= 768) {
        const rows = await page.locator('.var-head').evaluateAll((hs) => hs.filter((h) => {
          const rs = [...h.children].map((c) => c.getBoundingClientRect());
          return Math.max(...rs.map((r) => r.top)) >= Math.min(...rs.map((r) => r.bottom)); // a second line starts below the first
        }).length);
        expect(rows).toBe(0);
      }
      // Value text is never clipped by its panel.
      const clipped = await page.locator('.bar-value').evaluateAll((vs) => vs.filter((v) => {
        const r = v.getBoundingClientRect(), p = v.closest('.chart-panel')!.getBoundingClientRect();
        return r.right > p.right + 1 || r.left < p.left - 1;
      }).length);
      expect(clipped).toBe(0);
      // Keyboard: Tab onto the Temp bars opens a themed tip, an arrow moves it, Escape closes it.
      const first = page.locator('[data-section="brewing-temp"] .bar-row').first();
      await first.evaluate((el) => {
        const all = [...document.querySelectorAll<HTMLElement>('a[href], button, select, [tabindex="0"]')];
        all[all.indexOf(el as HTMLElement) - 1].focus();
      });
      await page.keyboard.press('Tab');
      await expect(first).toBeFocused();
      const tip = page.locator('[data-section="brewing-temp"] .cell-tip');
      await expect(tip).toContainText(/brews/);
      await expect(tip.locator('dt')).not.toHaveCount(0);
      const was = await tip.textContent();
      await page.keyboard.press('ArrowDown');
      await expect(tip).not.toHaveText(was!);
      await page.keyboard.press('Escape');
      await expect(tip).toHaveCount(0);
      await page.locator('[data-section="brewing-temp"] .bar-row').nth(1).blur();
      // A toggle never moves a chart (G9): Exact on Temp keeps every chart in its slot.
      const slots = () => page.locator('.brewing-vars .lab-chart').evaluateAll((ps) => ps.map((p) => {
        const r = p.getBoundingClientRect();
        return `${(p as HTMLElement).dataset.section}@${Math.round(r.left)},${Math.round(r.width)}`;
      }));
      const before = await slots();
      await page.getByRole('group', { name: 'Temp bands' }).getByRole('button', { name: 'Exact' }).click();
      await expect(page).toHaveURL(/temp=exact/);
      expect(await slots()).toEqual(before);
    } },
  ...(['roast', 'process', 'origin', 'roaster'] as const).map((by) => ({
    name: `insights-brewing-by-${by}`, path: () => `/stats?tab=brewing&tempBy=${by}`,
    act: async (page: Page) => {
      await expect(page.getByLabel('Break down by').first()).toHaveValue(by);
      const hm = page.locator('[data-section="brewing-temp"] .heatmap.diverging');
      await expect(hm).toBeVisible();
      // Scrolls inside itself; the row labels stay put and no cell shows under one (ui-rules 43).
      await expectLabelsOutsidePlot(hm.locator('.scroll'));
      await hm.locator('.scroll').evaluate((s) => (s.scrollLeft = 0));
      await expectInnerScroll(page, '.heatmap.diverging .scroll');
      // Never widens (G9): Temp keeps Ratio's width beside it, the heatmap scrolling inside the card.
      if ((page.viewportSize()?.width ?? 0) >= 900) {
        const [t, r] = await Promise.all(['temp', 'ratio'].map((k) => page.locator(`[data-section="brewing-${k}"]`).boundingBox()));
        expect(Math.abs(t!.width - r!.width)).toBeLessThanOrEqual(1);
        expect(Math.round(t!.y)).toBe(Math.round(r!.y));
      }
      // A cell tip: its row · column as the title, then the delta and counts as rows.
      await hm.locator('.heat-cell').first().click();
      await expect(hm.locator('.cell-tip .tip-title').first()).toContainText(' · ');
      await expect(hm.locator('.cell-tip')).toContainText(/Brews|No brews/);
      await expectTipInView(page, hm.locator('.cell-tip'));
      // C2: the rightmost column (scrolled into view inside the card) keeps its tip on screen too.
      const edge = hm.locator('.heat-cell[data-r="0"]').last();
      await edge.scrollIntoViewIfNeeded();
      await edge.click();
      await expectTipInView(page, hm.locator('.cell-tip'));
      await page.locator('h1').click();
      // A small-sample cell is striped with its value and sample label; the old legend line is gone.
      const small = hm.locator('.heat-cell.small-sample-mark');
      if (await small.count()) await expect(small.first()).toHaveAttribute('aria-label', /[+−]?\d\.\d\d? \(Low confidence\)$/);
      await expect(hm.locator('.div-legend')).not.toContainText(/Striped:|few brews/i);
    } })),
  { name: 'insights-brewing-exact', viewports: 'two', path: () => '/stats?tab=brewing&temp=exact',
    act: async (page) => {
      // Each chart's toggle is its own: temp=exact leaves Grind on bands.
      await expect(page.getByRole('group', { name: 'Temp bands' }).getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('group', { name: 'Grind bands' }).getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'false');
      const bold = page.locator('[data-section="brewing-temp"] .bar-label.bold');
      await expect(bold).toHaveText(['88°C', '91°C', '92°C', '94°C']);
    } },
  { name: 'insights-brewing-zp6', viewports: 'two', path: () => '/stats?tab=brewing&grinder=zp6-special',
    act: async (page) => {
      await expect(page.getByLabel('Grinder')).toHaveValue('zp6-special');
      await expect(page.locator('[data-section="brewing-grind"] .bar-row.small').first()).toBeVisible();
      // ZP6 half-number bands are labeled by their first setting, the tip gives the range (no-match bands: vitest).
      const grind = page.locator('[data-section="brewing-grind"]');
      await expect(grind.locator('.bar-label')).toHaveText(['5.0', '5.5', '6.0']);
      await grind.locator('.bar-row .bar-label').first().click();
      await expect(grind.locator('.cell-tip .tip-title').first()).toHaveText('5.0 – 5.4');
    } },
  { name: 'insights-brewing-tip', viewports: 'two', path: () => '/stats?tab=brewing',
    act: async (page) => {
      await page.locator('[data-section="brewing-temp"] .bar-row .bar-label').first().click();
      await expect(page.locator('[data-section="brewing-temp"] .cell-tip')).toContainText(/brews/);
    } },
  ...(['ratio', 'dose', 'time', 'bloom', 'grind'] as const).map((v) => ({
    name: `insights-brewing-${v}-by-roast`, path: () => `/stats?tab=brewing&${v}By=roast`,
    act: async (page: Page) => {
      await expect(page.locator(`[data-section="brewing-${v}"] .heatmap.diverging`)).toBeVisible();
      await expectInnerScroll(page, '.heatmap.diverging .scroll');
    } })),
  { name: 'insights-brewing-all-ratings', path: () => '/stats?tab=brewing&ratings=all' },
  { name: 'insights-sweetspots-grinder', path: () => '/stats?tab=sweetspots&grinder=zp6-special',
    act: async (page) => {
      await expect(page.getByLabel('Grind for:')).toHaveValue('zp6-special');
      const name = await page.getByLabel('Grind for:').locator('option:checked').innerText();
      await expect(page.locator('#spot-grind .hl-caption')).toContainText(`Grind ${name}`); // only this card follows the grinder
      await expect(page.locator('#spot-temp .hl-caption')).not.toContainText(name);
      await expectGridRowsFull(page, '.spot-grid');
    } },
  ...(['sweetspots', 'brewing', 'water', 'gear'] as const).map((tab) => ({
    name: `insights-lab-empty-${tab}`, path: () => `/stats?tab=${tab}&range=2000-01-01..2000-01-31`,
    act: async (page: Page) => {
      await expect(page.getByText(/^No rated brews (with [a-z ]+ )?in this period\.$/)).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
      await expectShortEmpty(page);
    } })),
  // Gate 3: a truly empty tab's panels are one short line each (no tall blank chart areas).
  ...(['consumption', 'leaderboards', 'habits'] as const).map((tab) => ({
    name: `insights-empty-${tab}`, path: () => `/stats?tab=${tab}&range=2000-01-01..2000-01-31`,
    act: async (page: Page) => {
      await expect(page.locator('section.chart-panel:has(.hl-empty)')).toHaveCount(1);
      await expectShortEmpty(page);
    } })),
  { name: 'insights-lab-no-compare', viewports: 'two', path: () => '/stats?tab=gear&range=12m&compare=1&people=person&grinder=zp6-special',
    act: async (page) => {
      await expect(page.getByLabel('Compare')).toHaveCount(0);
      await expect(page.getByRole('group', { name: 'People' })).toHaveCount(0);
      await page.getByLabel('View').selectOption('overview'); // sticky: both come back on Overview
      await expect(page.getByLabel('Compare')).toHaveValue('1');
      await expect(page).toHaveURL(/compare=1/);
      await expect(page).toHaveURL(/people=person/);
      await expect(page).toHaveURL(/grinder=zp6-special/); // lab picks stick through a non-lab tab too
      await page.getByLabel('View').selectOption('gear'); // a second action on the non-lab tab
      // grinder= already matched on Overview: wait for the Gear tab itself before the layout checks.
      await expect(page).toHaveURL(/tab=gear.*grinder=zp6-special/);
      await expect(page.getByLabel('Compare')).toHaveCount(0);
    } },
  { name: 'insights-lab-reset', viewports: 'two', path: () => '/stats?tab=brewing&tempBy=roast&temp=exact&grinder=zp6-special',
    act: async (page) => {
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page).toHaveURL(/\/stats\?tab=brewing$/);
    } },
  { name: 'insights-remembered', viewports: 'two', path: () => '/stats?tab=habits&range=1w',
    act: async (page) => {
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats\?range=1w&tab=habits$/); // restored into the URL
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page).toHaveURL(/\/stats\?tab=habits$/); // filters cleared, tab kept
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats\?tab=habits$/); // remembered: the tab, bare filters
      await gotoReady(page, '/stats?tab=leaderboards'); // no filters: the tab alone is remembered
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats\?tab=leaderboards$/);
      await gotoReady(page, '/stats?range=3m'); // a link with params wins and is remembered
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats\?range=3m$/);
    } },
  // An in-page nav back to the bare URL removes the remembered state: a later bare visit stays bare.
  { name: 'insights-remembered-bare', viewports: 'two', path: () => '/stats?dial=all',
    act: async (page) => {
      await openSwitches(page);
      await page.getByRole('group', { name: 'Brews' }).first().getByRole('button', { name: 'Once dialed', exact: true }).click();
      await expect(page).toHaveURL(/\/stats$/);
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats$/);
    } },
  { name: 'insights-coffees-panel', path: () => '/stats',
    act: async (page) => {
      await expect(page.locator('.filters-field > span')).toHaveText('Show'); // its small label, like the bar's others
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT'); // no keyboard pop
      await dlg.getByLabel('Process').selectOption('Washed');
      await dlg.getByLabel('Caffeine').selectOption('decaf');
      await expect(page).toHaveURL(/\/stats$/); // a draft: nothing applied yet
      // The whole panel fits the viewport (phone landscape is 333px tall).
      const box = (await dlg.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await dlg.evaluate((d) => d.scrollHeight - d.clientHeight)).toBeLessThanOrEqual(1);
      await expect(dlg.getByRole('button', { name: 'Done' })).toHaveCount(0);
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/process=Washed/);
      await expect(page).toHaveURL(/caffeine=decaf/);
      await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('2');
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/Washed/, /Decaf/]);
    } },
  { name: 'insights-coffees-caffeine-default', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      // Default (caffeinated) shows the hint, naming that option; an explicit Decaf or All hides it; Default returns to bare. The
      // dialog doesn't change size or move its controls when the hint comes and goes.
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      const sel = dlg.getByLabel('Caffeine');
      const hint = dlg.locator('.coffees-note');
      await expect(hint).toBeVisible();
      await expect(hint).toHaveText('Caffeine, Default (caffeinated): ratings leave decaf out. Counts, cost and Caffeinated vs. decaf include it.');
      await expect(hint.locator('.setting-name')).toHaveText(['Caffeine', 'Default (caffeinated)']);
      const geom = async () => [await dlg.boundingBox(), await sel.boundingBox(), await dlg.getByRole('button', { name: 'Apply' }).boundingBox()].map((b) => [b!.x, b!.y, b!.width, b!.height].map(Math.round));
      const before = await geom();
      await sel.selectOption('decaf');
      await expect(page).not.toHaveURL(/caffeine=/); // the hint follows the draft, the URL waits for Apply
      await expect(hint).toBeHidden();
      expect(await geom(), 'nothing moves when the hint hides').toEqual(before);
      await expect(sel.locator('option')).toHaveText([/^Default/, 'Caffeinated', 'Decaf', 'All']);
      await sel.selectOption('caffeinated'); // distinct from Default: the hint goes too
      await expect(hint).toBeHidden();
      expect(await geom()).toEqual(before);
      await sel.selectOption('decaf');
      await sel.selectOption('');
      await expect(hint).toBeVisible();
      expect(await geom()).toEqual(before);
      await expect(sel.locator('option').first()).toHaveText(/^Default/);
      const box = (await dlg.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await dlg.evaluate((d) => d.scrollHeight - d.clientHeight)).toBeLessThanOrEqual(1);
      const sb = (await sel.boundingBox())!, field = (await sel.locator('xpath=..').boundingBox())!;
      expect(sb.x + sb.width, 'select stays in its cell').toBeLessThanOrEqual(field.x + field.width + 1);
    } },
  // Apply / Reset / click-out: the dialog edits a draft; only Apply (or Reset) reaches the URL; Esc and the backdrop discard.
  { name: 'insights-filters-apply', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all&process=Washed',
    act: async (page) => {
      const open = async () => { await page.getByRole('button', { name: /^Filters/ }).click(); return page.getByRole('dialog', { name: 'Filters' }); };
      let dlg = await open();
      await expect(dlg.getByLabel('Process')).toHaveValue('Washed'); // seeded from the URL
      await dlg.getByLabel('Roast level').selectOption({ index: 1 });
      await dlg.getByLabel('Process').selectOption('');
      await page.waitForTimeout(300);
      await expect(page).toHaveURL(/process=Washed/); // nothing applied
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
      await expect(page).toHaveURL(/process=Washed/);
      dlg = await open();
      await expect(dlg.getByLabel('Roast level')).toHaveValue(''); // the discarded draft does not come back
      await expect(dlg.getByLabel('Process')).toHaveValue('Washed');
      await dlg.getByLabel('Roast level').selectOption({ index: 1 });
      await page.mouse.click(2, 2); // the backdrop
      await expect(dlg).toBeHidden();
      await expect(page).not.toHaveURL(/roast=/);
      dlg = await open();
      await dlg.getByLabel('Caffeine').selectOption('decaf');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(dlg).toBeHidden();
      await expect(page).toHaveURL(/caffeine=decaf/);
      await expect(page).toHaveURL(/process=Washed/);
      dlg = await open();
      await dlg.getByRole('button', { name: 'Reset' }).click(); // in place: back to defaults, nothing applied, still open
      await expect(dlg).toBeVisible();
      await expect(dlg.getByLabel('Process')).toHaveValue('');
      await expect(dlg.getByLabel('Caffeine')).toHaveValue('');
      await expect(page).toHaveURL(/caffeine=decaf/);
      await dlg.getByRole('button', { name: 'Cancel' }).click(); // leaves what was set
      await expect(dlg).toBeHidden();
      await expect(page).toHaveURL(/caffeine=decaf/);
      dlg = await open();
      await dlg.getByRole('button', { name: 'Reset' }).click();
      await dlg.getByRole('button', { name: 'Apply' }).click(); // filters only: tab and range survive
      await expect(dlg).toBeHidden();
      await expect(page).toHaveURL(/tab=leaderboards/);
      await expect(page).toHaveURL(/range=all/);
      await expect(page).not.toHaveURL(/process=|caffeine=/);
    } },
  // Brew filters in the Filters dialog (Part 1): one select each on the tabs that use it; chips for any tab, muted off-tab.
  { name: 'insights-brew-dialog', path: () => '/stats',
    act: async (page) => {
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      for (const l of ['Dripper', 'Filter', 'Water', 'Dose', 'Temp']) await expect(dlg.getByLabel(l, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT');
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await dlg.getByLabel('Dose', { exact: true }).selectOption({ label: '15g' });
      const box = (await dlg.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await dlg.evaluate((d) => d.scrollHeight - d.clientHeight)).toBeLessThanOrEqual(1);
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(page).toHaveURL(/brewDose=15/);
    } },
  { name: 'insights-brew-dialog-gear', viewports: 'two', path: () => '/stats?tab=gear',
    act: async (page) => {
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      for (const l of ['Dripper', 'Filter', 'Water', 'Dose', 'Temp']) await expect(dlg.getByLabel(l, { exact: true })).toBeVisible();
    } },
  // Regression: a Dripper pick set back to "Any" in the dialog drops the param and shows every dripper again.
  { name: 'insights-trophy-pick-any', viewports: 'two', path: () => '/stats?tab=gear',
    act: async (page) => {
      const drippers = page.locator('.trophy-card[data-key^="dripper-"]');
      const all = await drippers.count();
      expect(all).toBeGreaterThan(1);
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(drippers).toHaveCount(1);
      await page.locator('.filters-button').click();
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(drippers).toHaveCount(all);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(0);
    } },
  { name: 'insights-brew-pick-any', viewports: 'two', path: () => '/stats',
    act: async (page) => {
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(1);
      await page.locator('.filters-button').click();
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(0);
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/dripper=/);
    } },
  { name: 'insights-trophy-pick-any-after-toggle', viewports: 'two', path: () => '/stats?tab=gear',
    act: async (page) => {
      const drippers = page.locator('.trophy-card[data-key^="dripper-"]');
      const all = await drippers.count();
      const pick = async (v: string) => {
        await page.locator('.filters-button').click();
        const d = page.getByRole('dialog', { name: 'Filters' });
        await d.getByLabel('Dripper', { exact: true }).selectOption(v);
        await d.getByRole('button', { name: 'Apply' }).click();
      };
      await page.locator('.trophy-card[data-key="dripper-origami"] .trophy-toggle').click(); // a shallow open and Esc first
      await page.keyboard.press('Escape');
      await pick('V60');
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(drippers).toHaveCount(1);
      await page.locator('.trophy-card[data-key="dripper-v60"] .trophy-toggle').click(); // and another between the picks
      await page.keyboard.press('Escape');
      await pick('');
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(drippers).toHaveCount(all);
    } },
  { name: 'insights-brew-chips-muted', path: () => '/stats?tab=habits&dripper=V60&water=Lab%20Water%20A',
    act: async (page) => {
      const chips = page.locator('.coffee-chips .filter-chip');
      await expect(chips).toHaveCount(2);
      await expect(chips.first()).not.toHaveClass(/muted/);
      await expect(chips.last()).toHaveClass(/muted/);
      await expect(page.locator('.filters-button')).toContainText('1');
      await chips.last().locator('.filter-chip-label').hover();
      await expect(page.getByText('Not used on this tab')).toBeVisible();
      await chips.last().locator('.filter-chip-label').click(); // muted: no dialog, no select to edit it
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeHidden();
      await expectChipsFit(page);
      await page.getByRole('button', { name: 'Remove filter: V60' }).click();
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(page).toHaveURL(/water=Lab(%20|\+)Water(%20|\+)A/);
    } },
  { name: 'insights-brew-clear', viewports: 'two', path: () => '/stats?dripper=V60&process=Washed',
    act: async (page) => {
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(2);
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).toHaveURL(/\/stats$/);
    } },
  { name: 'insights-brew-remembered', viewports: 'two', path: () => '/stats?tab=gear&dripper=V60',
    act: async (page) => {
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/dripper=V60/);
    } },
  // Whole-bag notes (Part 1, Task 6): one .chart-note per panel of whole-bag figures, none on brew-level panels.
  { name: 'insights-brew-overview', path: () => '/stats?dripper=V60',
    act: async (page) => {
      const note = (t: RegExp) => page.locator('.chart-panel', { has: page.getByRole('heading', { name: t }) }).locator('.chart-note');
      await expect(note(/^Totals$/)).toHaveText("Spend and Bags finished count whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Consumption$/)).toHaveText("Time to clear counts whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Right now$/)).toHaveText("Whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Totals$/).locator('strong')).toHaveText('Spend and Bags finished count whole bags:');
      await expect(note(/^Averages$/)).toHaveCount(0);
      await expect(page.locator('.chart-panel.recent .chart-note')).toHaveText("Whole bags: the dripper filter doesn't apply.");
    } },
  { name: 'insights-brew-leaderboards-spend', path: () => '/stats?tab=leaderboards&rank=spend&dripper=V60',
    act: async (page) => {
      await expect(page.locator('.chart-note', { hasText: "Whole bags: the dripper filter doesn't apply." })).toHaveCount(1);
      await expectEmptyGearCards(page);
    } },
  { name: 'insights-brew-leaderboards', viewports: 'two', path: () => '/stats?tab=leaderboards&dripper=V60',
    act: async (page) => {
      // Every board applies every filter, its own included: the Drippers board lists only V60.
      const board = page.locator('[data-board="dripper"]');
      await expect(board).toContainText('V60');
      await expect(board).not.toContainText('Origami');
      await expect(page.locator('.chart-note', { hasText: 'Whole bags' })).toHaveCount(0);
    } },
  { name: 'insights-brew-habits', viewports: 'two', path: () => '/stats?tab=habits&brewDose=15',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-consumption', path: () => '/stats?tab=consumption&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: "the dripper filter doesn't apply" });
      await expect(notes.first()).toBeVisible();
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Consumption', exact: true }) }).locator('.chart-note'))
        .toHaveText("Bought, Net, On hand and Days to clear count whole bags: the dripper filter doesn't apply.");
      // Bought vs brewed, On hand over time and Time to open; Brewed over time (grams) follows the filter.
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Brewed over time' }) }).locator('.chart-note')).toHaveCount(1);
      await expect(notes).toHaveCount(4);
    } },
  { name: 'insights-brew-records', path: () => '/stats?tab=records&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: 'count whole bags' });
      expect(await notes.count()).toBeGreaterThan(0);
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Volume' }) }).locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0);
    } },
  { name: 'insights-brew-insights', path: () => '/stats?tab=insights&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: "whole bags: the dripper filter doesn't apply." });
      expect(await notes.count()).toBeGreaterThan(0);
    } },
  { name: 'insights-brew-brewing', viewports: 'two', path: () => '/stats?tab=brewing&water=Lab%20Water%20A',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-water', viewports: 'two', path: () => '/stats?tab=water&dripper=V60',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-gear', viewports: 'two', path: () => '/stats?tab=gear&brewTemp=93',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  // A tile or section link keeps the brew filter; a /coffees link doesn't.
  { name: 'insights-brew-link-carries', viewports: 'two', path: () => '/stats?dripper=V60',
    act: async (page) => {
      // Rail tab links (?tab=…) and finding links (/stats?…) carry the filter.
      const hrefs = await page.locator('a[href^="?"], a[href^="/stats"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.some((h) => h.includes('dripper=V60'))).toBe(true);
      const coffees = await page.locator('a[href^="/coffees?"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      expect(coffees.length).toBeGreaterThan(0);
      expect(coffees.every((h) => !h.includes('dripper='))).toBe(true);
    } },
  { name: 'insights-coffees-chips', viewports: 'two', path: () => '/stats?tab=brewing&process=Washed&origin=Ethiopia&caffeine=all',
    act: async (page) => {
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(3);
      await expect(page.locator('.coffee-chips .filter-chip').last()).toHaveText(/Caf \+ decaf/);
      await page.getByRole('button', { name: 'Remove filter: Ethiopia' }).click();
      await expect(page).not.toHaveURL(/origin=/);
      await expect(page).toHaveURL(/process=Washed/);
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).not.toHaveURL(/process=|caffeine=/);
      await expect(page.locator('.coffee-chips')).toHaveCount(0);
    } },
  // The bar stays one short controls row with the Filters button in it; the chips are its last row.
  { name: 'insights-coffees-sticky', path: () => '/stats?tab=records&range=all&compare=1&process=Washed&caffeine=decaf',
    act: async (page) => {
      // The chips are the bar's last row (gate r2 A3): still in view after scrolling.
      await expect(page.locator('.filter-bar .coffee-chips')).toBeVisible();
      await expectStickyBar(page, page.locator('.filter-bar'));
      // phones: the chips are in the expanded bar (the short row has none)
      if (await phoneBar(page)) await expandBar(page);
      await expect(page.locator('.filter-bar .coffee-chips')).toBeInViewport();
      if (await phoneBar(page)) await expect(page.locator('.cbar.overlay .coffee-chips')).toBeInViewport();
    } },
  // The mixed-roast nudge: never with a Roast filter set (one level left). The thin seed's two levels
  // rate alike, so it never shows here; prod copy shows it on /stats?tab=brewing&range=3m (T13b report).
  { name: 'insights-roast-nudge-roast-set', viewports: 'two', path: () => '/stats?tab=brewing&range=all&roast=Light',
    act: async (page) => {
      await expect(page.locator('.coffee-chips')).toBeVisible();
      await expect(page.locator('.roast-nudge')).toHaveCount(0);
    } },
  // Chips row with 0, 1 and 5 chips (a long roaster name): one line that scrolls sideways, never wraps; Clear all last.
  ...([['0', ''], ['1', '&process=Washed'],
    ['5', '&roast=Light&process=Washed&origin=Ethiopia&roaster=The%20Picky%20Chemist&caffeine=all']] as const)
    .map(([n, q]) => ({
      name: `insights-chips-${n}`, viewports: n === '0' ? 'two' : 'all', path: () => `/stats?tab=records&range=all${q}`,
      act: async (page: Page) => {
        const row = page.locator('.filter-bar .coffee-chips');
        if (n === '0') return expect(row).toHaveCount(0);
        await expect(row.locator('.filter-chip')).toHaveCount(Number(n));
        await expect(row.locator(':scope > :last-child')).toHaveText('Clear all');
        // Data-agnostic: a far longer roaster name (no seed roaster with brews has one) still stays on the one line.
        if (n === '5') await row.locator('.filter-chip-label', { hasText: 'The Picky Chemist' })
          .evaluate((e) => (e.textContent = 'The Extraordinarily Long-Named Specialty Roasting Collective of Portland'));
        const mids = await row.locator(':scope > *').evaluateAll((es) => es.map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }));
        expect(Math.max(...mids) - Math.min(...mids), 'chips on one line').toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways page scroll').toBe(true);
        expect(await row.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
        await expectStickyBar(page, page.locator('.filter-bar'));
      } })),
  // F1: Clear all on the sole chip leaves the URL bare and forgets it; a later bare visit stays bare.
  { name: 'insights-coffees-clear-bare', viewports: 'two', path: () => '/stats?process=Washed',
    act: async (page) => {
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).toHaveURL(/\/stats$/);
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/stats');
      await expect(page).toHaveURL(/\/stats$/);
      await expect(page.locator('.coffee-chips')).toHaveCount(0);
    } },
  ...(['brewing', 'leaderboards', 'habits'] as const).map((t) => ({
    name: `insights-coffees-empty-${t}`, viewports: 'two' as const, path: () => `/stats?tab=${t}&roaster=Lab%20Roasters&range=1w`,
    act: async (page: Page) => {
      await expect(page.getByText(/^No (rated )?brews matching Lab Roasters in this period\.$/)).toHaveCount(1);
      // A whole empty tab is one empty panel, not a stack of empty boards or charts (rule 28).
      await expect(page.locator('section.chart-panel:has(.hl-empty)')).toHaveCount(1);
      await expect(page.locator('.board, .insights-charts, .board-map')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    } })),
  ...(['overview', 'records', 'insights', 'sweetspots', 'water', 'gear'] as const).map((t) => ({
    name: `insights-coffees-${t}`, path: () => `/stats?tab=${t}&process=Natural&range=all` })),
  // A board the confident cutoff (min3) emptied says what its rows lacked; "No brews" stays for truly empty boards.
  { name: 'insights-leaderboards-cut', path: () => '/stats?tab=leaderboards&process=Washed&roast=Light&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="roasters"] .board-note'))
        .toHaveText('No roasters with 3+ bags and 10+ rated brews matching Washed · Light in this period.');
      await expect(page.locator('.board-note', { hasText: /^No brews/ })).toHaveCount(0);
      await expectShortEmpty(page);
    } },
  // Phones (≤480) read "Last 12 mo." in the closed Period select (unclipped); wider widths keep "Last 12 months".
  { name: 'insights-period-short', path: () => '/stats?tab=records&range=12m',
    act: async (page) => {
      const want = page.viewportSize()!.width <= 480 ? 'Last 12 mo.' : 'Last 12 months';
      await expect(page.getByLabel('Period').locator('option:checked')).toHaveText(want);
      await expect(page.getByLabel('Period').locator('option[value="1m"]')).toHaveText('Last month');
    } },
  // U2: on phones the control bar's row-to-row gaps are equal, measured to what you see (a label's ink top, a
  // control's or chip's edge), on every tab; within 1px.
  { name: 'insights-bar-gaps', path: () => '/stats?tab=overview&range=12m&roast=Light&process=Washed',
    act: async (page) => {
      if (page.viewportSize()!.width > 640) return;
      for (const tab of ['overview', 'leaderboards', 'records', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing', 'water', 'insights']) {
        await page.goto(`/stats?tab=${tab}&range=12m&roast=Light&process=Washed`);
        await expect(page.locator('.insights-controls')).toBeVisible();
        const gaps: number[] = await page.evaluate(`(${BAR_GAPS})()`);
        expect(gaps.length, tab).toBeGreaterThanOrEqual(2);
        expect(Math.max(...gaps) - Math.min(...gaps), `${tab} gaps ${gaps}`).toBeLessThanOrEqual(1);
      }
    } },
  // M7: phones (≤480) abbreviate months/years/Previous in the Period and Compare selects (also before hydration,
  // app.html's script); the closed selects' text must fit (long custom spans / bag names fall back to the ellipsis style). Runs at 360 and 480.
  { name: 'insights-phone-selects', path: () => '/stats?tab=overview&range=12m&compare=1',
    act: async (page) => {
      const phone = page.viewportSize()!.width <= 480;
      await expect(page.getByLabel('Compare').locator('option:checked')).toHaveText(phone ? 'Prev. 12 mo.' : 'Previous 12 months');
      const bad = await page.locator('.insights-controls select').evaluateAll((els) => {
        const c = document.createElement('canvas').getContext('2d')!;
        return els.filter((el) => {
          const s = el as HTMLSelectElement, cs = getComputedStyle(s);
          c.font = cs.font;
          // The closed text must fit the select's content box (the arrow sits in its padding), not just carry an ellipsis.
          const avail = s.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
          return c.measureText(s.selectedOptions[0].textContent!.trim()).width > avail;
        }).map((el) => el.getAttribute('aria-label'));
      });
      if (phone) expect(bad, 'closed selects whose text overflows').toEqual([]);
    } },
  // See all (gate 3): the note names what the settings hide; See all → everything (filters, Period, tab kept);
  // Back to defaults drops only avg/ratings/dial. One line at 1280+, may wrap on phones.
  ...(['note', 'see-all', 'back'] as const).map((step) => ({
    name: `insights-see-all-${step}`, viewports: step === 'back' ? 'two' : 'all', path: () => '/stats?tab=leaderboards&process=Washed&roast=Light&range=all',
    act: async (page: Page) => {
      const note = page.locator('.see-all');
      // One short line (gate P4): "N rows and M brews hidden by your settings. See all".
      // Phones read the short form ("16 rows, 20 brews hidden. See all"): innerText skips the hidden half.
      const phone = page.viewportSize()!.width < 768;
      await expect(note).toHaveText(phone ? /^\d+ rows?(, \d+ brews?)? hidden\. See all$/ : /^\d+ rows?( and \d+ brews?)? hidden by your settings\. See all$/, { useInnerText: true });
      if (step !== 'note') {
        await note.getByRole('button', { name: 'See all' }).click();
        await expect(page).toHaveURL(/[?&]avg=raw/);
        for (const p of ['ratings=all', 'dial=all', 'process=Washed', 'roast=Light', 'range=all', 'tab=leaderboards'])
          expect(page.url()).toContain(p);
        await expect(note).toHaveText('Showing everything, including low-confidence rows. Back to defaults');
      }
      if (step === 'back') {
        await note.getByRole('button', { name: 'Back to defaults' }).click();
        await expect(page).not.toHaveURL(/avg=|ratings=|dial=/);
        for (const p of ['process=Washed', 'roast=Light', 'range=all', 'tab=leaderboards']) expect(page.url()).toContain(p);
        await expect(note).toHaveText(/See all$/);
      }
      if (page.viewportSize()!.width >= 1280)
        expect(await note.evaluate((e) => e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)), 'one line')
          .toBeLessThan(1.5);
    } })),
  // See all shows every bag (user, 2026-10-17): Onyx, a roaster of one 1-brew decaf bag, is on the Roasters rating
  // board under See all + caffeine=all, and under k2 too (every bag counts, weighted by its brews; user ruling 2026-10-17).
  { name: 'insights-see-all-every-bag', viewports: 'two', path: () => '/stats?tab=leaderboards&range=all&avg=raw&ratings=all&dial=all&caffeine=all&open=roasters',
    act: async (page) => {
      await expect(page.locator('.see-all')).toContainText('Showing everything');
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(1);
      await page.goto('/stats?tab=leaderboards&range=all&avg=k2&ratings=all&dial=all&caffeine=all&open=roasters');
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(1);
      // min3 (Average (3+ bags)) drops the 1-bag group.
      await page.goto('/stats?tab=leaderboards&range=all&avg=min3&ratings=all&dial=all&caffeine=all&open=roasters');
      await expect(page.locator('[data-board="roasters"] .board-row').first()).toBeVisible();
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(0);
    } },
  // Gate P4: "hidden by your settings" opens the shared tip (FloatTip): each board's count, the brews', the reasons
  // once; hover (mouse), tap and keyboard focus.
  { name: 'insights-see-all-tip', path: () => '/stats?tab=leaderboards&range=all',
    act: async (page) => {
      const btn = page.locator('.see-all .text-tip');
      await expect(btn).toHaveText(page.viewportSize()!.width < 768 ? 'hidden' : 'hidden by your settings', { useInnerText: true });
      await expect(btn).toHaveAttribute('aria-label', /Hidden by your settings/);
      const tip = page.locator('.float-tip');
      if (page.viewportSize()!.width >= 1280) { // desktop: hover opens, leaving closes
        await btn.hover();
        await expect(tip).toContainText('Hidden by your settings');
        await page.mouse.move(0, 0);
        await expect(tip).toHaveCount(0);
      }
      await btn.click();
      await expect(tip).toContainText('Hidden by your settings');
      // One row per board ("Roasters 23"), at most 2 then "+N more", the brews row (1–4 rows), then the reasons once (ui-rules 36).
      const labels = await tip.locator('dt').allTextContents();
      expect(labels.length).toBeLessThanOrEqual(4);
      for (const l of labels) expect(l).toMatch(/^([A-Z][a-z ]+|\+\d+ more)$/);
      expect(labels.at(-1)).toBe('Rated brews');
      await expect(tip.locator('.tip-note')).toHaveText(/^Why: (too few bags or brews|before calibration|while dialing in)/);
      expect(await tip.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'tip text overflows').toBe(true);
      // Whole tip in view at every viewport, 1003×333 included (ui-rules 39).
      await expectTipInView(page, tip);
      await page.keyboard.press('Escape');
      await btn.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab'); // keyboard focus (focus-visible) opens it
      await expect(tip).toBeVisible();
      expect(page.url()).not.toContain('tip');
    } },
  { name: 'insights-lab-anchor', path: () => '/stats?tab=water#water-gh',
    act: async (page) => {
      await expect(page.locator('#water-gh')).toBeInViewport();
      await expect.poll(async () => (await page.evaluate(() => document.getElementById('water-gh')!.getBoundingClientRect().top)) - (await pinnedBottomOf(page))).toBeGreaterThanOrEqual(-1);
    } },
  { name: 'insights-water', path: () => '/stats?tab=water',
    act: async (page) => {
      for (const h of ['Ratings by recipe', 'Recipe mineral map', 'GH vs rating', 'Water × roast level', 'Water × process', 'Water usage over time', 'Same bag, different water'])
        await expect(page.getByRole('heading', { name: h })).toBeVisible();
      await expect(page.locator('[data-section="water-recipes"] .lab-rows .board-row')).toHaveCount(3);
      await expect(page.locator('[data-section="water-gh"] .bar-row')).toHaveCount(3); // 26, 74, 124 ppm
      await expect(page.locator('#water-minerals-help')).toContainText('Strongly tied to era and roast level');
      await expect(page.getByLabel('Compare')).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(/NaN|undefined|±null/);
      await expectInnerScroll(page, '.heatmap.diverging .scroll');
      // Nothing takes focus on load (the phone keyboard would pop up).
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
      // Recipe mineral map: a row per profiled recipe (all three seeded waters), the delta then the 8 minerals;
      // scrolls inside its card with the recipe column pinned.
      const map = page.locator('[data-section="water-minerals"]');
      await expect(map.locator('tbody tr')).toHaveCount(3);
      await expect(map.locator('thead th')).toHaveText(['Recipe', 'vs usual', 'Camg/L', 'Mgmg/L', 'Kmg/L', 'Namg/L', 'GHppm', 'KHppm', 'Mg:Ca', 'Mg:K']);
      await expect(map.locator('tbody td.delta').first()).toHaveText(/^[+−]\d\.\d\d?$|^0\.00?$/);
      await expectInnerScroll(page, '.map-scroll');
      const pinned = await map.locator('.map-scroll').evaluate((sc) => {
        sc.scrollLeft = sc.scrollWidth;
        const ok = Math.abs(sc.querySelector('tbody th')!.getBoundingClientRect().left - sc.getBoundingClientRect().left) <= 3;
        sc.scrollLeft = 0;
        return ok;
      });
      expect(pinned).toBe(true);
      // Every small-sample row carries the Low confidence chip in its name cell, on one line, inside the cell.
      for (const row of await map.locator('tbody tr.small-sample').all()) {
        const chip = row.locator('th .sample-chip');
        await expect(chip).toHaveText(/^Only \d+ (bags?|brews?)$/);
        expect(await row.evaluate((tr) => { const c = tr.querySelector('th .sample-chip')!.getBoundingClientRect(), th = tr.querySelector('th')!.getBoundingClientRect(); return c.height < 24 && c.right <= th.right + 1; })).toBe(true);
      }
      // The name and its chip are one tip target: hovering the name, then the chip, leaves exactly one visible tip (mouse only).
      const small = map.locator('tbody tr.small-sample').first();
      if ((await small.count()) && (await page.evaluate(() => matchMedia('(hover: hover)').matches))) {
        await small.locator('th .map-name').hover();
        await small.locator('th .map-chip').hover();
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => [...document.querySelectorAll('.cell-tip.float-tip:popover-open')].filter((t) => getComputedStyle(t).visibility !== 'hidden').length)).toBe(1);
        await page.mouse.move(0, 0);
      }
      // Tips dismissed by another tip tell their owner: chip A, chip B, chip A again shows A (taps never blur).
      const notes = page.locator('.sample-note');
      if ((await notes.count()) >= 2) {
        await notes.nth(0).click();
        await notes.nth(1).click();
        await notes.nth(0).click();
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => [...document.querySelectorAll('.cell-tip.float-tip:popover-open')].filter((t) => getComputedStyle(t).visibility !== 'hidden').length)).toBe(1);
        await expect(notes.nth(0)).toHaveAttribute('aria-expanded', 'true');
        await page.mouse.move(0, 0);
        await page.locator('h1').click();
      }
      // The pinned name column is opaque and fills the cell gap beside it (ui-rules 43): no cell shows beside or under a name.
      const edge = await map.locator('tbody th').first().evaluate((th) => { const c = getComputedStyle(th); return { bg: c.backgroundColor, shadow: c.boxShadow }; });
      expect(edge.bg).not.toMatch(/rgba\(.*, 0\)|transparent/);
      expect(edge.shadow).not.toBe('none');
      // The name text is the tip target, not the cell's empty space; the vs usual chip hugs its value.
      const target = await map.locator('tbody th').first().evaluate((th) => {
        const name = th.querySelector('.map-name')!.getBoundingClientRect(), cell = th.getBoundingClientRect();
        // Every row's vs usual cell hugs its content (a chip, or the no-match dash): at most 24px wider.
        const loose = [...th.closest('tbody')!.querySelectorAll('td.delta')].filter((td) => {
          const content = Math.max(...[...td.children].map((e) => e.getBoundingClientRect().width));
          return td.getBoundingClientRect().width - content > 24;
        }).length;
        return { inside: name.width <= cell.width, loose };
      });
      expect(target.inside).toBe(true);
      expect(target.loose).toBe(0);
      await map.locator('tbody th').first().click({ position: { x: (await map.locator('tbody th').first().boundingBox())!.width - 3, y: 3 } });
      if (await map.locator('.map-name').first().evaluate((n) => n.getBoundingClientRect().right < n.parentElement!.getBoundingClientRect().right - 6))
        await expect(map.locator('.cell-tip')).toHaveCount(0);
      // A row's tip: brews, bags, strength; keyboard ↓ moves to the next recipe.
      await map.locator('.map-name').first().focus();
      await expect(map.locator('.cell-tip .tip-rows')).toContainText(/Brews\s*\d+\s*Bags\s*\d+/);
      await expectTipInView(page, map.locator('.cell-tip'));
      const firstTip = await map.locator('.cell-tip .tip-title').first().textContent();
      await page.keyboard.press('ArrowDown');
      await expect(map.locator('.cell-tip .tip-title').first()).not.toHaveText(firstTip!);
      await page.keyboard.press('Escape');
      await map.locator('.map-name:focus').blur();
      await expectDeltaInk(page);
      // Recipe deltas line up down the list.
      const rights = await page.locator('[data-section="water-recipes"] .val').evaluateAll((vs) => vs.map((v) => Math.round(v.getBoundingClientRect().right)));
      expect(new Set(rights).size).toBe(1);
      // The heatmaps pair up from a 1118 px content column (a 1150 px viewport without the side rail; neither
      // scrolls), stacked below.
      const cw = (await page.locator('.rail-main').boundingBox())!.width; // content column
      const wide = cw >= 1118;
      const tops = await page.locator('.heat-panel').evaluateAll((ps) => ps.map((p) => Math.round(p.getBoundingClientRect().top)));
      expect(tops[0] === tops[1]).toBe(wide);
      if (wide) {
        const scrolls = await page.locator('.heat-panel .scroll').evaluateAll((ss) => ss.filter((s) => s.scrollWidth > s.clientWidth + 1).length);
        expect(scrolls).toBe(0);
        const hs = await page.locator('.heat-panel').evaluateAll((ps) => ps.map((p) => Math.round(p.getBoundingClientRect().height)));
        expect(Math.abs(hs[0] - hs[1])).toBeLessThanOrEqual(1);
      }
      // Keyboard: Tab onto the GH bars opens a themed tip, an arrow moves it, Escape closes it.
      const first = page.locator('[data-section="water-gh"] .bar-row').first();
      await first.evaluate((el) => {
        const all = [...document.querySelectorAll<HTMLElement>('a[href], button, select, [tabindex="0"]')];
        all[all.indexOf(el as HTMLElement) - 1].focus();
      });
      await page.keyboard.press('Tab');
      await expect(first).toBeFocused();
      const tip = page.locator('[data-section="water-gh"] .cell-tip');
      await expect(tip).toContainText(/brews?/);
      const was = await tip.textContent();
      await page.keyboard.press('ArrowDown');
      await expect(tip).not.toHaveText(was!);
      await page.keyboard.press('Escape');
      await expect(tip).toHaveCount(0);
      await page.locator('[data-section="water-gh"] .bar-row').nth(1).blur();
      // Ratings by recipe beside GH vs rating from an 868 px column (900 px viewport), one height, both filled (W3, ui-rules 37).
      if (cw >= 868) {
        const [a, b] = await Promise.all(['recipes', 'gh'].map((k) => page.locator(`[data-section="water-${k}"]`).boundingBox()));
        expect(Math.round(a!.y)).toBe(Math.round(b!.y));
      }
      await expectPairsFilled(page, '.water-pair, .heat-grid');
      // Same bag, different water (W7): one bordered block per recipe pair, a headline, column headers naming the
      // two recipes in their colors, then each bag's two plain ratings, the winner's bold and green.
      const pair = page.locator('.pair').first();
      await expect(pair.locator('.pair-sum')).toHaveText(/ won \d+ of \d+ bags?( \(\d+ tied\))? · (even|[+−]\d\.\d\d on average)$/);
      // The pair's heading "A vs B": bold, each name in its own ink color (not the body text color), the tally under it.
      const nm = await pair.locator('.pair-title').evaluate((e) => ({ w: +getComputedStyle(e).fontWeight, text: e.textContent, a: getComputedStyle(e.querySelector('.pair-a')!).color,
        b: getComputedStyle(e.querySelector('.pair-b')!).color, body: getComputedStyle(e.closest('.pair')!).color, below: e.nextElementSibling!.className }));
      expect(nm.w).toBeGreaterThanOrEqual(600);
      expect(nm.text).toMatch(/ vs /);
      expect(nm.a).not.toBe(nm.body);
      expect(nm.b).not.toBe(nm.a);
      expect(nm.below).toContain('pair-sum');
      await expect(pair.locator('.pair-bags li').first().locator('.score')).toHaveText([/^\d+\.\d\d$/, /^\d+\.\d\d$/]);
      const pc = await page.locator('.pair').evaluateAll((ps) => ps.map((p) => {
        const css = (e: Element) => getComputedStyle(e);
        const sw = [...p.querySelectorAll('.pair-cols .swatch')].map((e) => css(e).backgroundColor);
        const scores = [...p.querySelectorAll('.score')];
        const plain = scores.every((e) => css(e).textDecorationLine === 'none');
        const probe = document.createElement('span');
        p.append(probe);
        probe.style.color = 'var(--div-high-ink)';
        const green = css(probe).color;
        probe.remove();
        const wins = scores.filter((e) => e.classList.contains('win')).every((e) => css(e).color === green && +css(e).fontWeight >= 700);
        const others = scores.filter((e) => !e.classList.contains('win')).every((e) => css(e).color !== green);
        return { two: sw.length === 2 && sw[0] !== sw[1], plain, wins, others, boxed: css(p).borderTopStyle !== 'none' };
      }));
      expect(pc.every((x) => x.two && x.plain && x.wins && x.others && x.boxed)).toBe(true);
      // One color per recipe across the tab (ui-rules 42): usage legend and every pair header agree, and two
      // recipes never share a color (the palette has 10 slots).
      const byName = await page.evaluate(() => {
        const seen: [string, string][] = [];
        for (const li of document.querySelectorAll('[data-section="water-eras"] .legend li'))
          if (li.textContent!.trim() !== 'Other') seen.push([li.textContent!.trim(), getComputedStyle(li.querySelector('.swatch')!).backgroundColor]);
        for (const col of document.querySelectorAll('.pair-col')) seen.push([col.textContent!.trim(), getComputedStyle(col.querySelector('.swatch')!).backgroundColor]);
        return seen;
      });
      const nameTo = new Map<string, Set<string>>(), colorTo = new Map<string, Set<string>>();
      for (const [n, c] of byName) {
        nameTo.set(n, (nameTo.get(n) ?? new Set()).add(c));
        colorTo.set(c, (colorTo.get(c) ?? new Set()).add(n));
      }
      expect([...nameTo.values()].every((cs) => cs.size === 1)).toBe(true);
      expect([...colorTo.values()].every((ns) => ns.size === 1)).toBe(true);
      // Balanced pair columns (ui-rules 40): between expanded (spanning) blocks, the two columns end within the tallest block's height (the best two unbreakable columns can do; a small block fills the space under a shorter one).
      const pairGaps = () => page.locator('.pairs').evaluate((g) => {
        const out: string[] = [];
        let seg: HTMLElement[] = [];
        const check = () => {
          const cols = new Map<number, number>();
          for (const p of seg) { const r = p.getBoundingClientRect(); cols.set(Math.round(r.left), Math.max(cols.get(Math.round(r.left)) ?? 0, r.bottom)); }
          const ends = [...cols.values()];
          const row = Math.max(...seg.map((p) => p.getBoundingClientRect().height));
          if (ends.length > 1 && Math.max(...ends) - Math.min(...ends) > row + 17) // + the gap between blocks out.push(`columns end ${Math.round(Math.max(...ends) - Math.min(...ends))}px apart`);
          seg = [];
        };
        for (const p of g.children as HTMLCollectionOf<HTMLElement>) (p.classList.contains('span') ? check() : seg.push(p));
        check();
        return out;
      });
      expect(await pairGaps()).toEqual([]);
      // Pair headers never wrap: one line each, ellipsis when long.
      expect(await page.locator('.pair-col').evaluateAll((cs) => cs.filter((c) => c.getBoundingClientRect().height > 1.6 * parseFloat(getComputedStyle(c).fontSize)).length)).toBe(0);
      // Roaster and coffee name read as two parts.
      await expect(page.locator('.pair-bags .bag').first()).toContainText(' · ');
      // The 5 biggest gaps; "Show all N" expands that pair (pairs=<slug> in the URL), "Show fewer" collapses it.
      await expect(pair.locator('.pair-bags li')).toHaveCount(5);
      // The toggle scrolls its button to the screen's bottom (above Back to top when it shows) a moment after the
      // URL changes (bottomInView awaits the navigation): a click while that scroll is pending lands on whatever
      // the page jumps to, so wait for the landing before the next action.
      const landed = (name: string | RegExp) => expect.poll(() => pair.getByRole('button', { name }).evaluate((el) => {
        const t = document.querySelector('.bottom-tabs'), lift = t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect().height : 0;
        return Math.abs(innerHeight - el.getBoundingClientRect().bottom - lift - (document.querySelector('.back-to-top') ? 64 : 0));
      })).toBeLessThanOrEqual(2);
      await pair.getByRole('button', { name: /^Show all \d+$/ }).click();
      await expect(page).toHaveURL(/[?&]pairs=[a-z0-9-]+--[a-z0-9-]+/);
      await landed('Show fewer');
      await expect(pair.locator('.pair-bags li')).toHaveCount(8); // every seeded bag used all three waters
      await expect(page.locator('.pair').nth(1).locator('.pair-bags li')).toHaveCount(5); // only that pair
      expect(await pairGaps()).toEqual([]); // expanded, it spans; the rest stay balanced
      await pair.getByRole('button', { name: 'Show fewer' }).click();
      await expect(page).not.toHaveURL(/pairs=/);
      await landed(/^Show all \d+$/);
      await expect(pair.locator('.pair-bags li')).toHaveCount(5);
      // Usage over time: 100% stacked bars; a segment's tip: the month, then the recipe and its share in one row.
      const eras = page.locator('[data-section="water-eras"]');
      await eras.locator('.seg').first().click();
      await expect(eras.locator('.cell-tip .tip-title').first()).toHaveText(/^[A-Z][a-z]{2} \d{2}$/);
      await expect(eras.locator('.cell-tip .tip-rows dt').first()).not.toHaveText('Share');
      await expect(eras.locator('.cell-tip .tip-rows dd').first()).toHaveText(/^\d+%$/);
      // Keyboard: one tab stop on a drawn segment; arrows move through segments and months.
      const stop = eras.locator('.seg[tabindex="0"]');
      await expect(stop).toHaveCount(1);
      await stop.focus();
      const at = await eras.locator('.cell-tip').textContent();
      await page.keyboard.press('ArrowUp');
      await expect(eras.locator('.cell-tip')).not.toHaveText(at!);
      const up = await eras.locator('.cell-tip .tip-title').first().textContent();
      await page.keyboard.press('ArrowRight');
      await expect(eras.locator('.cell-tip .tip-title').first()).not.toHaveText(up!);
      await page.keyboard.press('Escape');
      await expect(eras.locator('.cell-tip')).toHaveCount(0);
      await eras.locator('.seg:focus').blur();
    } },
  { name: 'insights-water-tip', viewports: 'two', path: () => '/stats?tab=water',
    act: async (page) => {
      await page.locator('[data-section="water-gh"] .bar-row .bar-label').first().click();
      await expect(page.locator('[data-section="water-gh"] .cell-tip')).toBeVisible();
    } },
  { name: 'insights-trophy', path: () => '/stats?tab=gear',
    act: async (page) => {
      const sec = page.locator('[data-section="gear-trophies"]');
      await expect(sec.getByRole('heading', { name: 'Gear showcase' })).toBeVisible();
      await expect(sec.locator('.trophy-grid:not(.retired) .trophy-card[data-key="dripper-switch"]')).toHaveCount(0);
      await expect(sec.locator('button.retired-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expectGridRowsFull(page, '.trophy-grid');
      // The low-confidence chip sits centered between brews and grams without touching either, and never grows the row.
      const chipCards = page.locator('.trophy-card:has(.sample-note)');
      expect(await chipCards.count()).toBeGreaterThan(0);
      const probs = await chipCards.evaluateAll((cs) => cs.flatMap((c) => {
        const r = (sel: string) => c.querySelector(sel)!.getBoundingClientRect();
        const [card, chip, row] = [c.getBoundingClientRect(), r('.sample-chip'), r('.fig-row')]; // the chip itself, not its 44px hit area
        const [a, b] = [c.querySelectorAll('.fig-row .fig')[0].getBoundingClientRect(), c.querySelectorAll('.fig-row .fig')[1].getBoundingClientRect()];
        const out: string[] = [];
        if (Math.abs(chip.left + chip.width / 2 - (card.left + card.width / 2)) > 2) out.push('chip off center');
        // A narrow card (under ~236px: the 2-up phone card) shows the chip's icon alone; every card keeps the figures clear.
        if (card.width < 236 && chip.width > 40) out.push(`narrow card still shows the chip words (${Math.round(chip.width)}px)`);
        if (chip.left < a.right - 0.5 || chip.right > b.left + 0.5) out.push(`chip overlaps a figure (${Math.round(a.right)}<${Math.round(chip.left)}..${Math.round(chip.right)}<${Math.round(b.left)})`);
        if (chip.height > Math.max(a.height, b.height) + 0.5) out.push('chip taller than the figures');
        if (row.height > Math.max(a.height, b.height) + 20) out.push('row taller than its figures');
        return out;
      }));
      expect(probs).toEqual([]);
      // The hierarchy: name > average > brews | grams.
      const size = (l: Locator) => l.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      // The collapsed photo box is square.
      for (const img of await page.locator('.trophy-card .trophy-img').all()) {
        const b = (await img.boundingBox())!;
        expect(Math.abs(b.width - b.height)).toBeLessThan(1.5);
      }
      const card = page.locator('.trophy-card[data-key="dripper-v60"]');
      const [name, avg, small] = [await size(card.locator('.trophy-toggle')), await size(card.locator('.fig-avg b')), await size(card.locator('.fig-row b').first())];
      expect(name).toBeGreaterThan(avg);
      expect(avg).toBeGreaterThan(small);
    } },
  { name: 'insights-trophy-open', path: () => '/stats?tab=gear&card=grinder-zp6-special',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      await expect(dlg).toBeVisible();
      await expect(dlg.getByRole('heading', { name: 'ZP6 Special' })).toBeVisible();
      await expect(dlg.locator('.stat-grid').last()).toBeVisible();
      // The scale matches the coffee page: the title is larger than the section heading.
      const size = (l: Locator) => l.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(await size(dlg.locator('.trophy-name'))).toBeGreaterThan(await size(dlg.locator('.detail-section h2')));
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      // Inside the screen; the close button is a 44px target.
      const box = (await dlg.boundingBox())!, vp = page.viewportSize()!;
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      const close = (await dlg.getByRole('button', { name: 'Close' }).boundingBox())!;
      expect(close.width).toBeGreaterThanOrEqual(43.5);
      expect(close.height).toBeGreaterThanOrEqual(43.5);
      // The facts fill their rows: every fact in a row is stretched to the row's right edge.
      const rows = await dlg.locator('.detail-body .stat-grid .stat').evaluateAll((els) => {
        const byTop = new Map<number, DOMRect[]>();
        for (const e of els) { const r = e.getBoundingClientRect(); byTop.set(Math.round(r.top), [...(byTop.get(Math.round(r.top)) ?? []), r]); }
        const right = Math.max(...els.map((e) => e.getBoundingClientRect().right));
        return [...byTop.values()].map((rs) => Math.abs(Math.max(...rs.map((r) => r.right)) - right));
      });
      for (const gap of rows) expect(gap).toBeLessThan(2);
    } },
  { name: 'insights-trophy-specs', path: () => '/stats?tab=gear&card=dripper-v60',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      await expect(dlg.getByRole('heading', { name: 'V60' })).toBeVisible();
      // Stored specs sit above the brew facts; the website shows its host; the photo is contained on its backdrop.
      const spec = dlg.locator('.specs .stat', { hasText: 'Cone angle' });
      await expect(spec.locator('.stat-value')).toHaveText('60°');
      await expect(dlg.locator('.specs .stat', { hasText: 'Cost' }).locator('.stat-value')).toHaveText('$24.00');
      await expect(dlg.locator('.specs a')).toHaveText('hario.com');
      await expectContained(dlg.locator('.trophy-img img'), 'rgb(127, 183, 164)');
      // Dates sit under the photo, inside the media column.
      const media = (await dlg.locator('.detail-media .trophy-img').boundingBox())!, meta = (await dlg.locator('.media-meta').boundingBox())!;
      expect(meta.y).toBeGreaterThanOrEqual(media.y + media.height - 1);
      await expect(dlg.locator('.media-meta')).toContainText('Added');
      await expect(dlg.locator('.media-meta')).toContainText('Updated');
      // The corner buttons overlay: the heading starts where it would without them, and clears them.
      const top = (await dlg.locator('.trophy-top').boundingBox())!, name = (await dlg.locator('.trophy-name').boundingBox())!;
      expect(name.y).toBeLessThan(top.y + top.height + 400);
      expect(await dlg.locator('.trophy-top').evaluate((e) => getComputedStyle(e).position)).toBe('absolute');
      const nameText = (await dlg.locator('.trophy-name').evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()].map((x) => x.right); }));
      expect(Math.max(...nameText)).toBeLessThanOrEqual(top.x + 1);
      // Usage: dates/bags row, then the brews/rating row starting under its first column; one line each wider than a phone.
      const ustats = await dlg.locator('.usage .stat').evaluateAll((els) => els.map((e) => ({ l: Math.round(e.getBoundingClientRect().left), t: Math.round(e.getBoundingClientRect().top), brews: e.textContent!.startsWith('Brews') })));
      const bi = ustats.findIndex((u) => u.brews);
      expect(ustats[bi].l).toBe(ustats[0].l);
      for (let i = bi + 1; i < ustats.length; i++) expect(ustats.slice(0, bi).map((u) => u.l)).toContain(ustats[i].l); // columns line up
      if (page.viewportSize()!.width > 640) expect(new Set(ustats.slice(0, bi).map((u) => u.t)).size).toBe(1);
      // Added and Updated: each is one line (label, date, time), inside the photo's width, a gap between them when side by side.
      const photoB = (await dlg.locator('.detail-media .trophy-img').boundingBox())!;
      for (const sp of await dlg.locator('.media-meta span').all()) {
        const r = (await sp.boundingBox())!;
        if (page.viewportSize()!.width > 640) expect(r.x + r.width, 'within the photo column').toBeLessThanOrEqual(photoB.x + photoB.width + 1);
        // Desktop: one line each (landscape's narrow column may wrap a stamp).
        if (page.viewportSize()!.height > 500) expect(r.height, 'one line').toBeLessThan(20);
      }
      await expect(dlg.locator('.media-meta b').first()).toHaveText(/^\d{4}-\d\d-\d\d \d{1,2}:\d\d:\d\d [AP]M$/);
      // Usage spans the dialog under the photo and details: its first row fills it, no empty tail (later rows line up under it).
      const usage = (await dlg.locator('.usage').boundingBox())!, art = (await dlg.locator('article').boundingBox())!;
      expect(usage.y).toBeGreaterThanOrEqual(art.y + art.height - 1);
      expect(Math.abs(usage.width - art.width)).toBeLessThan(2);
      const urows = await dlg.locator('.usage .stat').evaluateAll((els) => {
        const byTop = new Map<number, DOMRect[]>();
        for (const e of els) { const r = e.getBoundingClientRect(); byTop.set(Math.round(r.top), [...(byTop.get(Math.round(r.top)) ?? []), r]); }
        const right = Math.max(...els.map((e) => e.getBoundingClientRect().right));
        return [...byTop.values()].map((rs) => Math.abs(Math.max(...rs.map((r) => r.right)) - right));
      });
      expect(urows[0]).toBeLessThan(2);
      // The specs fill their rows, as the brew facts do.
      const gaps = await dlg.locator('.specs .stat').evaluateAll((els) => {
        const byTop = new Map<number, DOMRect[]>();
        for (const e of els) { const r = e.getBoundingClientRect(); byTop.set(Math.round(r.top), [...(byTop.get(Math.round(r.top)) ?? []), r]); }
        const right = Math.max(...els.map((e) => e.getBoundingClientRect().right));
        return [...byTop.values()].map((rs) => Math.abs(Math.max(...rs.map((r) => r.right)) - right));
      });
      for (const gap of gaps) expect(gap).toBeLessThan(2);
      // The card behind it shows the photo too; a card with no stored row has no spec section, no dates and the icon.
      await expectContained(page.locator('.trophy-card[data-key="dripper-v60"] img'), 'rgb(127, 183, 164)');
      await page.goto('/stats?tab=gear&card=grinder-comandante-c40-mk4');
      await expect(dlg.getByRole('heading', { name: 'Comandante C40 MK4' })).toBeVisible();
      await expect(dlg.locator('.specs')).toHaveCount(0);
      await expect(dlg.locator('.no-specs')).toHaveText('No details yet. Use Edit to add specs, cost and a photo.');
      // Added always shows (the gear's first brew when Bean Conqueror gave no date); Updated only with a stored row.
      await expect(dlg.locator('.media-meta span')).toHaveCount(1);
      await expect(dlg.locator('.media-meta')).toContainText('Added');
      await expect(dlg.locator('.media-meta')).not.toContainText('Updated');
      await expect(dlg.locator('.media-meta b')).toHaveText(/^\d{4}-\d\d-\d\d \d{1,2}:\d\d:\d\d [AP]M$/);
      await expect(dlg.locator('.trophy-img img')).toHaveCount(0);
      // A few fields: ZP6 shows its two and no empty rows.
      await page.goto('/stats?tab=gear&card=grinder-zp6-special');
      await expect(dlg.locator('.specs .stat')).toHaveCount(2);
      await expect(dlg.locator('.specs .stat', { hasText: 'Burr size' }).locator('.stat-value')).toHaveText('64mm');
      await expect(dlg.locator('.specs')).not.toContainText('Cone angle');
    } },
  { name: 'insights-trophy-edit', path: () => '/stats?tab=gear&card=dripper-v60',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      await expect(dlg.getByRole('heading', { name: 'V60' })).toBeVisible();
      // Edit sits top right, in the close button's row, a 44px target.
      const edit = dlg.locator('.trophy-top').getByRole('button', { name: 'Edit' });
      const [eb, cb] = [(await edit.boundingBox())!, (await dlg.getByRole('button', { name: 'Close' }).boundingBox())!];
      expect(Math.abs(eb.y + eb.height / 2 - (cb.y + cb.height / 2))).toBeLessThan(2);
      expect(eb.x + eb.width).toBeLessThanOrEqual(cb.x + 1);
      expect(eb.height).toBeGreaterThanOrEqual(43.5);
      await edit.click();
      const form = dlg.locator('form.gear-form');
      for (const f of fieldsFor('dripper')) await expect(form.getByLabel(f.label + (f.unit ? ` (${f.unit})` : f.type === 'money' ? ' ($)' : ''), { exact: true })).toBeVisible();
      await expect(form.getByLabel('Cone angle (°)')).toHaveValue('60');
      await expect(form.getByLabel('Brand')).toHaveValue('Hario');
      await expect(form.getByLabel('Cone angle (°)')).toHaveAttribute('inputmode', 'decimal');
      // Filter fit is gone; the photo, Image URL and Preview/Discard are in the form's grid.
      await expect(dlg.getByLabel('Filter fit')).toHaveCount(0);
      const media = form;
      await expect(dlg.getByLabel('Image URL')).toBeVisible();
      await expect(dlg.getByRole('button', { name: 'Preview' })).toBeVisible();
      await expect(dlg.getByRole('button', { name: 'Discard image' })).toBeVisible();
      const phone = page.viewportSize()!.width <= 640;
      const top = (l: Locator) => l.boundingBox().then((b) => b!.y);
      const box = (l: Locator) => l.boundingBox().then((b) => b!);
      if (!phone) await expectEditAligned(page);
      // Opening focuses no input; the form replaces the body (no brew facts), and nothing was saved or put in the URL.
      expect(await page.evaluate(() => document.activeElement?.matches('input') ?? false)).toBe(false);
      await expect(dlg.locator('.detail-body .stat-grid')).toHaveCount(0);
      await expect(page).toHaveURL(/card=dripper-v60$/);
      // "?" tips on Shape, Material, Flow, Size and Learn from similar gear? only; one opens in the site's tip look and focuses no input.
      for (const n of ['Shape', 'Material', 'Flow', 'Size', 'Learn from similar gear?']) await expect(dlg.getByRole('button', { name: `About ${n}` })).toBeVisible();
      await expect(dlg.getByRole('button', { name: /^About / })).toHaveCount(5);
      const tipBtn = dlg.getByRole('button', { name: 'About Flow' });
      if (phone) expect((await tipBtn.boundingBox())!.width).toBeGreaterThanOrEqual(43);
      await tipBtn.click();
      await expect(page.locator('#gear-tip-flow')).toBeVisible();
      await expect(page.locator('#gear-tip-flow')).toContainText('Valve / immersion');
      expect(await page.evaluate(() => document.activeElement?.matches('input') ?? false)).toBe(false);
      await page.keyboard.press('Escape');
      await expect(page.locator('#gear-tip-flow')).toBeHidden();
      await expect(dlg).toBeVisible();
      // The Brew now evidence tip: a link to /on-deck, bold Yes:/No:, one line each.
      await dlg.getByRole('button', { name: 'About Learn from similar gear?' }).click();
      const own = page.locator('#gear-tip-ownData');
      await expect(own.getByRole('link', { name: 'Brew now' })).toHaveAttribute('href', '/on-deck');
      await expect(own.locator('li')).toHaveCount(3);
      await expect(own.locator('li b')).toHaveText(['Yes:', 'No:']);
      await page.keyboard.press('Escape');
      await expect(own).toBeHidden();
      // Esc (twice: Chrome only lets `cancel` be prevented once per activation) and the backdrop do not close it.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      if (page.viewportSize()!.width > 640) await page.mouse.click(2, 2);
      await expect(dlg).toBeVisible();
      // Save and Cancel are reachable, 44px tall on a phone and (stacked) the last thing in the form.
      const save = dlg.getByRole('button', { name: 'Save' }), cancel = dlg.getByRole('button', { name: 'Cancel' });
      await expect(save).toHaveCount(1);
      for (const b of [save, cancel]) {
        await b.scrollIntoViewIfNeeded();
        await expect(b).toBeInViewport();
        if (phone) {
          expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43);
          expect(await top(b)).toBeGreaterThan(await top(dlg.getByRole('button', { name: 'Preview' })));
          expect(await top(b)).toBeGreaterThan(await top(dlg.getByLabel('Size', { exact: true })));
          const sz = await box(dlg.getByLabel('Size', { exact: true }));
          expect((await box(save)).y - (sz.y + sz.height), 'ui-rules 22: space above the action row').toBeGreaterThanOrEqual(14);
        }
      }
      void media; void box;
      // History to another card closes the form (it never carries A's values to B).
      await page.evaluate(() => { // a client-side navigation (SvelteKit takes anchor clicks), as back/forward between two card entries does
        const a = document.createElement('a'); a.href = '?tab=gear&card=dripper-origami'; document.body.append(a); a.click(); a.remove();
      });
      await expect(dlg.getByRole('heading', { name: 'Origami' })).toBeVisible();
      await expect(form).toHaveCount(0);
      await page.goBack();
      await expect(dlg.getByRole('heading', { name: 'V60' })).toBeVisible();
      await expect(form).toHaveCount(0);
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await cancel.click();
      await expect(form).toHaveCount(0);
      await expect(dlg).toBeVisible();
      await expect(dlg.locator('.specs .stat', { hasText: 'Cone angle' }).locator('.stat-value')).toHaveText('60°');
      // A card with no stored row still gets Edit, with empty fields.
      await page.goto('/stats?tab=gear&card=grinder-comandante-c40-mk4');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(form.getByLabel('Burr size (mm)')).toHaveValue('');
      // The server's error shows inline.
      await form.getByLabel('Burr size (mm)').fill('5');
      await save.click();
      await expect(dlg.getByRole('alert')).toContainText('Burr size');
      await expect(form).toBeVisible();
      // Regression: a typed number (a number input binds a number, not a string) is a listed change, and nothing phantom
      // appears for a stored number left alone (burr size 64).
      await page.goto('/stats?tab=gear&card=dripper-v60');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await form.getByLabel('Cost ($)').click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('25');
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg.getByRole('alertdialog')).toContainText('Cost: 24 → 25');
      await dlg.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
      await expect(form.getByLabel('Cost ($)')).toHaveValue('25');
      await form.getByLabel('Cost ($)').fill('24.00'); // the stored 24 again: not a change
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg).toBeHidden();
      await page.goto('/stats?tab=gear&card=grinder-zp6-special');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(form.getByLabel('Burr size (mm)')).toHaveValue('64');
      await dlg.getByRole('button', { name: 'Close' }).click(); // no change: no panel
      await expect(dlg).toBeHidden();
      await page.goto('/stats?tab=gear&card=grinder-zp6-special');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await form.getByLabel('Burr size (mm)').fill(''); // emptied reads as empty
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg.getByRole('alertdialog')).toContainText('Burr size: 64 → empty');
      await dlg.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
      // ✕ in edit mode is Cancel then close. No changes: it closes at once (no panel) and the URL drops the card.
      const panel = dlg.getByRole('alertdialog');
      await page.goto('/stats?tab=gear&card=dripper-v60');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(dlg.getByRole('button', { name: 'Close' })).toBeEnabled();
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg).toBeHidden();
      await expect(page).not.toHaveURL(/card=/);
      // A change: a panel in the dialog names it, in view with 44px buttons on a phone; Keep editing (focused; Esc too) keeps the typed
      // values; Discard closes without saving.
      await page.goto('/stats?tab=gear&card=dripper-v60');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await form.getByLabel('Brand').fill('Hario X');
      await dlg.getByLabel('Image URL').fill('https://example.com/x.png');
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(panel).toBeVisible();
      await expect(panel).toBeInViewport();
      await expect(panel).toContainText('Brand: Hario → Hario X');
      await expect(panel).toContainText('Image URL changed');
      await expect(panel).not.toContainText('Model');
      const [keep, drop] = [panel.getByRole('button', { name: 'Keep editing' }), panel.getByRole('button', { name: 'Discard changes' })];
      await expect(keep).toBeFocused();
      for (const b of [keep, drop]) {
        await expect(b).toBeInViewport();
        if (phone) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43);
      }
      await keep.click();
      await expect(panel).toHaveCount(0);
      await expect(form.getByLabel('Brand')).toHaveValue('Hario X');
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(panel).toBeVisible();
      await page.keyboard.press('Escape'); // Escape = Keep editing
      await expect(panel).toHaveCount(0);
      await expect(dlg).toBeVisible();
      await expect(form.getByLabel('Brand')).toHaveValue('Hario X');
      await dlg.getByRole('button', { name: 'Close' }).click();
      await drop.click();
      await expect(dlg).toBeHidden();
      await expect(page).not.toHaveURL(/card=/);
      await page.goto('/stats?tab=gear&card=dripper-v60');
      await expect(dlg.locator('.specs .stat', { hasText: 'Brand' }).locator('.stat-value')).toHaveText('Hario'); // nothing saved
    } },
  // The other kinds' edit grids (wide dialogs): Save/Cancel take the cell after the last field (a full last row pushes them to the next
  // row's second cell); Image URL lines up with the last field row, Preview/Discard with the row before it.
  { name: 'insights-trophy-edit-kinds', path: () => '/stats?tab=gear&card=grinder-comandante-c40-mk4',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      const bx = async (l: Locator) => (await l.boundingBox())!;
      const input = (n: string) => dlg.getByLabel(n, { exact: true });
      if (page.viewportSize()!.width <= 640) {
        // Stacked: the last field to Save/Cancel keeps ~16px (ui-rules 22), grinder and filter.
        const gap = async (last: string) => { const l = await bx(input(last)); return (await bx(dlg.getByRole('button', { name: 'Save' }))).y - (l.y + l.height); };
        await dlg.getByRole('button', { name: 'Edit' }).click();
        expect(await gap('Step size (µm)')).toBeGreaterThanOrEqual(14);
        await page.goto('/stats?tab=gear&card=filter-cafec-abaca');
        await dlg.getByRole('button', { name: 'Edit' }).click();
        expect(await gap('Flow')).toBeGreaterThanOrEqual(14);
        return;
      }
      // above: the field on the row Image URL shares; edge: the input whose left (grinder) or right (filter, own row) edge Save/Cancel follow.
      const check = async (above: string, edge: string, own: boolean) => {
        const [aboveB, edgeB, saveB, cancelB, urlB, prevB] = [await bx(input(above)), await bx(input(edge)), await bx(dlg.getByRole('button', { name: 'Save' })),
          await bx(dlg.getByRole('button', { name: 'Cancel' })), await bx(dlg.getByLabel('Image URL')), await bx(dlg.getByRole('button', { name: 'Preview' }))];
        expect(Math.abs(urlB.y - aboveB.y), 'Image URL on the row above Preview').toBeLessThan(2);
        expect(Math.abs(saveB.y - prevB.y), 'Save level with Preview').toBeLessThan(2);
        expect(Math.abs(saveB.x - edgeB.x), 'Save left = the input column left').toBeLessThan(1.5);
        if (own) {
          expect(saveB.y).toBeGreaterThan(edgeB.y + edgeB.height - 1);
          expect(Math.abs(cancelB.x + cancelB.width - (edgeB.x + edgeB.width)), 'Cancel right = last input right').toBeLessThan(1.5);
        }
      };
      // Grinder: 11 fields, the last row holds one (Step size); Save is its neighbor cell.
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(dlg.getByRole('button', { name: /^About / })).toHaveText(['', '', '', '', '']);
      for (const n of ['Type', 'Burr type', 'Burr coating', 'Adjustment', 'Step size']) await expect(dlg.getByRole('button', { name: `About ${n}`, exact: true })).toBeVisible();
      // Adjustment is a select; Step size works only on Stepped.
      await expect(input('Adjustment')).toHaveJSProperty('tagName', 'SELECT');
      await expect(input('Adjustment').locator('option').first()).toHaveText('Select one');
      await expect(input('Step size (µm)')).toBeDisabled();
      // It looks disabled: dimmed, dashed, not-allowed, unlike an enabled input; its "?" still opens.
      const look = (l: Locator) => l.evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.color, c.borderTopStyle, c.cursor, c.backgroundColor]; });
      const [off, on] = [await look(input('Step size (µm)')), await look(input('Burr size (mm)'))];
      expect(off[0]).not.toBe(on[0]);
      expect(off[1]).not.toBe(on[1]);
      expect(off[2]).toBe('dashed');
      expect(off[3]).toBe('not-allowed');
      expect(off[4]).not.toBe(on[4]);
      expect(await dlg.locator('label[for="gear-stepSize"]').evaluate((e) => getComputedStyle(e).opacity)).not.toBe('1');
      await dlg.getByRole('button', { name: 'About Step size' }).click();
      await expect(page.locator('#gear-tip-stepSize')).toBeVisible();
      await page.keyboard.press('Escape');
      await input('Adjustment').selectOption('Stepless');
      await expect(input('Step size (µm)')).toBeDisabled();
      await input('Adjustment').selectOption('Stepped');
      await expect(input('Step size (µm)')).toBeEnabled();
      await input('Adjustment').selectOption('');
      await check('Burr coating', 'Adjustment', false);
      // Filter: 8 fields, a full last row (Size, Flow): Save is below Flow.
      await page.goto('/stats?tab=gear&card=filter-cafec-abaca');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      for (const n of ['Shape', 'Material', 'Size', 'Flow', 'Learn from similar gear?']) await expect(dlg.getByRole('button', { name: `About ${n}`, exact: true })).toBeVisible();
      await expect(dlg.getByRole('button', { name: /^About / })).toHaveCount(5);
      await check('Size', 'Flow', true); // Save/Cancel right-aligned on a row of their own, level with Preview
    } },
  { name: 'insights-trophy-fill', path: () => '/stats?tab=gear&card=dripper-v60',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      const posts: string[] = [];
      await page.route('**/api/gear', (route) => { posts.push(route.request().method()); return route.abort(); });
      let fills = 0;
      await page.route('**/api/gear/fill-from-url', (route) => { fills++; return route.fulfill({ json: {
        values: { brand: 'Filled Brand', model: 'Filled Model', cost: 31.5 }, imageUrl: null, notes: ['Filled 3 fields', 'Price converted from EUR'] } }); });
      await dlg.getByRole('button', { name: 'Edit' }).click();
      const top = dlg.locator('.trophy-top');
      const fillBtn = top.getByRole('button', { name: 'Fill from URL' }), close = dlg.getByRole('button', { name: 'Close' });
      await expect(top.getByRole('button', { name: 'Edit' })).toHaveCount(0);
      // The group by the close button: Fill and close on one row, clear of the heading, 44px targets on a phone; Suggest is not in it.
      await expect(top.getByRole('button', { name: 'Suggest' })).toHaveCount(0);
      const [fb, cb, db] = [await fillBtn.boundingBox(), await close.boundingBox(), await dlg.boundingBox()];
      expect(fb!.x + fb!.width).toBeLessThanOrEqual(cb!.x + 1);
      expect(fb!.y - db!.y, 'space above the action group').toBeGreaterThanOrEqual(10);
      expect(Math.abs(fb!.y + fb!.height / 2 - (cb!.y + cb!.height / 2))).toBeLessThan(2);
      if (page.viewportSize()!.width <= 480) expect(fb!.height).toBeGreaterThanOrEqual(43.5);
      // The heading's text does not run under the group.
      const textRight = await dlg.locator('h2.trophy-name').evaluate((h) => { const r = document.createRange(); r.selectNodeContents(h); return Math.max(...[...r.getClientRects()].map((x) => x.right)); });
      expect(textRight, 'heading clear of Fill').toBeLessThanOrEqual(fb!.x + 1);
      // Fill needs a valid Official website.
      const site = dlg.getByLabel('Official website', { exact: true });
      await site.fill('');
      await expect(fillBtn).toHaveAttribute('aria-disabled', 'true');
      await expect(fillBtn).toHaveCSS('cursor', 'not-allowed'); // not the tip's help cursor (ui-rules 50)
      await expect(fillBtn).toHaveCSS('opacity', '0.5');
      await fillBtn.click({ force: true });
      expect(fills).toBe(0);
      await site.fill('https://example.com/v60');
      await expect(fillBtn).toHaveAttribute('aria-disabled', 'false');
      await fillBtn.click();
      await expect(dlg.getByLabel('Brand', { exact: true })).toHaveValue('Filled Brand');
      await expect(dlg.getByLabel('Model', { exact: true })).toHaveValue('Filled Model');
      await expect(dlg.getByLabel('Cost ($)', { exact: true })).toHaveValue('31.50');
      await expect(dlg.getByLabel('Cone angle (°)')).toHaveValue('60'); // a field the fill did not find is kept
      await expect(dlg.locator('form.gear-form')).toContainText('Price converted from EUR');
      // Nothing saved; the ✕ lists the filled fields as unsaved changes.
      expect(posts).toEqual([]);
      await close.click();
      const leave = dlg.getByRole('alertdialog');
      await expect(leave).toContainText('Brand: Hario → Filled Brand');
      await expect(leave).toContainText('Cost');
      await leave.getByRole('button', { name: 'Keep editing' }).click();
      // A reply with an image updates Image URL and its preview.
      const img = 'https://example.com/filled.jpg';
      await page.unroute('**/api/gear/fill-from-url');
      await page.route('**/api/coffees/image-fill', (route) => route.fulfill({ json: { fill: '#eeeeee' } }));
      await page.route(img, (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
      await page.route('**/api/gear/fill-from-url', (route) => route.fulfill({ json: { values: {}, imageUrl: img, notes: ['Filled 0 fields'] } }));
      await fillBtn.click();
      await expect(dlg.getByLabel('Image URL')).toHaveValue(img);
      await expect(dlg.locator('.gear-form .trophy-img img')).toHaveAttribute('src', img);
      // An error reply shows inline and changes no field.
      await page.unroute('**/api/gear/fill-from-url');
      await page.route('**/api/gear/fill-from-url', (route) => route.fulfill({ status: 422, json: { error: 'No product found on that page' } }));
      await fillBtn.click();
      await expect(dlg.getByRole('alert')).toHaveText('No product found on that page');
      await expect(dlg.getByLabel('Brand', { exact: true })).toHaveValue('Filled Brand');
    } },
  { name: 'insights-trophy-suggest', path: () => '/stats?tab=gear&card=dripper-v60',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      const asked: unknown[] = [];
      const img = 'https://example.com/picked.jpg';
      await page.route('**/api/gear/image-suggest', (route) => { asked.push(route.request().postDataJSON()); return route.fulfill({ json: {
        status: 'ok', site: null, storedSite: null, notes: [],
        candidates: [{ image: img, pageUrl: 'https://example.com/v60', pageTitle: 'Hario V60 dripper', excerpt: 'Ceramic cone', published: null, closest: false }] } }); });
      await page.route('**/api/coffees/image-fill', (route) => route.fulfill({ json: { fill: '#eeeeee' } }));
      await page.route(img, (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
      await dlg.getByRole('button', { name: 'Edit' }).click();
      // Suggest joins Preview and Discard image under the photo: one row, in the Image URL box's span.
      const row = [await dlg.getByRole('button', { name: 'Preview' }).boundingBox(), await dlg.getByRole('button', { name: 'Suggest', exact: true }).boundingBox(), await dlg.getByRole('button', { name: 'Discard image' }).boundingBox()].map((b) => b!);
      const url = (await dlg.getByLabel('Image URL').boundingBox())!;
      expect(Math.abs(row[0].y - row[1].y) + Math.abs(row[1].y - row[2].y)).toBeLessThan(2);
      expect(row[0].x + row[0].width).toBeLessThanOrEqual(row[1].x + 1);
      expect(row[1].x + row[1].width).toBeLessThanOrEqual(row[2].x + 1);
      expect(Math.abs(row[0].x - url.x)).toBeLessThan(1.5);
      expect(Math.abs(row[2].x + row[2].width - (url.x + url.width))).toBeLessThan(1.5);
      if (page.viewportSize()!.width <= 480) for (const b of row) expect(b.height).toBeGreaterThanOrEqual(43.5);
      await dlg.getByRole('button', { name: 'Suggest', exact: true }).click();
      const sug = page.locator('dialog.suggest-dialog[open]');
      await expect(sug.getByText('Hario V60 dripper')).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      expect(asked[0]).toMatchObject({ kind: 'dripper', name: 'V60' });
      // Above the gear dialog; Esc closes only Suggest and returns to the form.
      const top = await page.evaluate(() => { const b = document.querySelector('.suggest-dialog[open]')!.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + 20); return !!e?.closest('.suggest-dialog'); });
      expect(top).toBe(true);
      await page.keyboard.press('Escape');
      await expect(sug).toHaveCount(0);
      await expect(dlg.locator('form.gear-form')).toBeVisible();
      await expect(dlg).toBeVisible();
      // A pick fills only the Image URL (and its preview).
      await dlg.getByRole('button', { name: 'Suggest', exact: true }).click();
      await page.locator('dialog.suggest-dialog[open]').getByRole('button', { name: /Hario V60 dripper/ }).click();
      await expect(dlg.getByLabel('Image URL')).toHaveValue(img);
      await expect(dlg.getByLabel('Brand', { exact: true })).toHaveValue('Hario');
      await expect(dlg.locator('.gear-form .trophy-img img')).toHaveAttribute('src', img);
      await expect(dlg).toBeVisible();
    } },
  { name: 'insights-trophy-toggle', viewports: 'two', path: () => '/stats?tab=gear',
    act: async (page) => {
      const loads: string[] = [];
      page.on('request', (r) => r.url().includes('__data.json') && loads.push(r.url()));
      const dlg = page.locator('dialog.trophy-dialog');
      await expect(dlg).toBeHidden();
      // Open by the name, close by ✕, by the backdrop and by Esc; no refetch on any of it.
      await page.locator('.trophy-card[data-key="dripper-v60"] .trophy-toggle').click();
      await expect(page).toHaveURL(/card=dripper-v60/);
      await expect(dlg).toBeVisible();
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(page).not.toHaveURL(/card=/);
      await expect(dlg).toBeHidden();
      await page.locator('.trophy-card[data-key="dripper-v60"] .trophy-img').click(); // anywhere on the card
      await expect(page).toHaveURL(/card=dripper-v60/);
      // The backdrop (the dialog element itself); a phone's sheet is nearly full width, so its backdrop is too thin to hit there.
      if (page.viewportSize()!.width > 640) await page.mouse.click(2, 2);
      else await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(page).not.toHaveURL(/card=/);
      await page.locator('.trophy-card[data-key="filter-cafec-abaca"] .trophy-toggle').click();
      await expect(dlg).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page).not.toHaveURL(/card=/);
      await expect(dlg).toBeHidden();
      await page.locator('button.retired-toggle').click();
      await expect(page).toHaveURL(/retired=open/);
      expect(loads).toEqual([]);
    } },
  // The kind toggle: URL, no refetch, the shelf count follows it, it combines with a pick.
  { name: 'insights-trophy-kind', path: () => '/stats?tab=gear',
    act: async (page) => {
      const loads: string[] = [];
      page.on('request', (r) => r.url().includes('__data.json') && loads.push(r.url()));
      const kinds = page.getByRole('group', { name: 'Kind' });
      await expect(kinds.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      await kinds.getByRole('button', { name: 'Drippers' }).click();
      await expect(page).toHaveURL(/gear=dripper/);
      await expect(page.locator('.trophy-card:not([data-key^="dripper-"])')).toHaveCount(0);
      await expect(page.locator('button.retired-toggle')).toContainText('Retired (1)'); // Switch
      await kinds.getByRole('button', { name: 'Grinders' }).click();
      await expect(page).toHaveURL(/gear=grinder/);
      await expect(page.locator('.trophy-card:not([data-key^="grinder-"])')).toHaveCount(0);
      await expect(page.locator('button.retired-toggle')).toHaveCount(0);
      await expectGridRowsFull(page, '.trophy-grid');
      await kinds.getByRole('button', { name: 'All' }).click();
      await expect(page).not.toHaveURL(/gear=/);
      expect(loads).toEqual([]);
    } },
  { name: 'insights-trophy-kind-pick', viewports: 'two', path: () => '/stats?tab=gear&gear=grinder&dripper=V60',
    act: async (page) => {
      await expect(page.locator('.trophy-card')).toHaveCount(3); // the dripper pick only rules out drippers, the toggle shows grinders only (ZP6, A4Z, Comandante)
      await expect(page.locator('.trophy-card:not([data-key^="grinder-"])')).toHaveCount(0);
    } },
  // Cards follow the Period: gear with no brew in it has no card; All time shows every one.
  { name: 'insights-trophy-period', viewports: 'two', path: () => '/stats?tab=gear&range=all',
    act: async (page) => {
      const all = await page.locator('.trophy-card').count();
      await gotoReady(page, '/stats?tab=gear&range=1w');
      const week = await page.locator('.trophy-card').count();
      expect(week).toBeLessThan(all);
      expect(week).toBeGreaterThan(0);
    } },
  { name: 'insights-trophy-retired', path: () => '/stats?tab=gear&retired=open',
    act: async (page) => {
      await expect(page.locator('button.retired-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.trophy-grid.retired .trophy-card[data-key="dripper-switch"]')).toBeVisible();
      await expectGridRowsFull(page, '.trophy-grid');
    } },
  // A pick rules out only its own kind: the other drippers go, grinders and filters stay; the shelf keeps the rest.
  { name: 'insights-trophy-picked', path: () => '/stats?tab=gear&dripper=V60&retired=open',
    act: async (page) => {
      await expect(page.locator('.trophy-card[data-key^="dripper-"]')).toHaveCount(1);
      await expect(page.locator('.trophy-card[data-key="dripper-v60"]')).toHaveCount(1);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(3);
      await expect(page.locator('.trophy-card[data-key^="filter-"]')).toHaveCount(3);
      await expect(page.locator('button.retired-toggle')).toHaveCount(0);
      await expectGridRowsFull(page, '.trophy-grid');
    } },
  // Grinder is in the Filters dialog on Gear (no tab-bar select): a chip, the badge, Clear all.
  { name: 'insights-trophy-grinder-pick', viewports: 'two', path: () => '/stats?tab=gear',
    act: async (page) => {
      await expect(page.locator('.tab-controls')).toHaveCount(0);
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Grinder', { exact: true }).selectOption('a4z-femobook');
      await dlg.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/grinder=a4z-femobook/);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(1);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/A4Z/]);
      await expect(page.locator('.filters-button')).toContainText('1');
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).not.toHaveURL(/grinder=/);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(3);
    } },
  { name: 'insights-gear', path: () => '/stats?tab=gear',
    act: async (page) => {
      for (const h of ['Ratings by dripper', 'Ratings by filter', 'Filters within each dripper', 'Dripper × roast level', 'Gear usage over time'])
        await expect(page.getByRole('heading', { name: h })).toBeVisible();
      // Filters within each dripper: only V60 uses two filters (Abaca, Sibarist), so one row of two cells.
      await expect(page.locator('[data-section="gear-matrix"] .heat-cell')).toHaveCount(2);
      // No all-blank heatmap row (I8): every row has a cell with a value.
      const blankRows = await page.locator('.heatmap.diverging').evaluateAll((hs) => hs.flatMap((h) => {
        const cells = [...h.querySelectorAll<HTMLElement>('.heat-cell')];
        const rows = new Set(cells.map((c) => c.dataset.r));
        return [...rows].filter((r) => cells.filter((c) => c.dataset.r === r).every((c) => c.classList.contains('none')));
      }));
      expect(blankRows).toEqual([]);
      // Gear usage over time: the tab stop is a drawn segment.
      await expect(page.locator('[data-section="gear-eras"] .seg[tabindex="0"]')).toHaveCount(1);
      // An "Other" segment's tip lists its members after its own row: up to 8 from 768 px, 4 on phones, then "+N more".
      const others = page.locator('[data-section="gear-eras"] .seg[aria-label*=" · Other "]');
      if (await others.count()) {
        await others.last().click();
        const tip = page.locator('[data-section="gear-eras"] .cell-tip');
        await expect(tip.locator('dt').first()).toHaveText('Other');
        const members = (await tip.locator('dt').count()) - 1, all = (await others.last().getAttribute('aria-label'))!.split(' · ').length - 2; // title · Other row · each member
        const max = (page.viewportSize()?.width ?? 0) >= 768 ? 8 : 4;
        const shown = all <= max + 1 ? all : max; // never "+1 more"
        expect(members).toBe(shown);
        // Members read as Other's breakdown: indented under it.
        if (members) {
          expect(await tip.locator('dt').nth(1).evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThan(0);
        }
        if (all > shown) await expect(tip.locator('.tip-note')).toHaveText(`+${all - shown} more`);
        await page.locator('h1').click();
      }
      await expect(page.getByLabel('Compare')).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(/NaN|undefined|±null/);
      await expectInnerScroll(page, '.heatmap.diverging .scroll');
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
      // Drippers beside Filters from 768 px, the matrix stacked under the board with fewer rows (ui-rules 40):
      // the columns end level, no placeholder rows, no empty space in a card; stacked below, each its own height.
      const [d, f] = await Promise.all(['drippers', 'filters'].map((k) => page.locator(`[data-section="gear-${k}"]`).boundingBox()));
      const wide = (page.viewportSize()?.width ?? 0) >= 768;
      expect(Math.round(d!.y) === Math.round(f!.y)).toBe(wide);
      if (wide) {
        await expectColumnsFilled(page, '.gear-pair');
        const m = (await page.locator('[data-section="gear-matrix"]').boundingBox())!;
        const nd = await page.locator('[data-section="gear-drippers"] .lab-rows > li').count();
        const nf = await page.locator('[data-section="gear-filters"] .lab-rows > li').count();
        expect(Math.round(m.x)).toBe(Math.round(nf <= nd ? f!.x : d!.x)); // under the shorter board
        // Other data (rules 37/40 are data-independent): a much longer board, then a much taller stack. The
        // columns stay one height, rows stretch at most 2× (or to the 20rem floor), the over-cap side scrolls.
        const vw = page.viewportSize()!;
        const rerun = async () => {
          await page.setViewportSize({ width: vw.width - 7, height: vw.height });
          await page.setViewportSize(vw);
        };
        const rows = page.locator('[data-section="gear-drippers"] .lab-rows');
        await rows.evaluate((ol) => { for (let k = 0; k < 4; k++) for (const li of [...ol.children].slice(0, 3)) ol.append(li.cloneNode(true)); }); // board taller
        await rerun();
        await expect.poll(async () => { try { await expectColumnsFilled(page, '.gear-pair'); return 'ok'; } catch (e) { return String(e); } }).toBe('ok');
        await rows.evaluate((ol) => { while (ol.children.length > 1) ol.lastElementChild!.remove(); }); // stack taller
        await page.locator('[data-section="gear-matrix"] .heatmap .scroll').evaluate((g) => { for (let k = 0; k < 6; k++) for (const c of [...g.children].slice(-4)) g.append(c.cloneNode(true)); });
        await rerun();
        await expect.poll(async () => { try { await expectColumnsFilled(page, '.gear-pair'); return 'ok'; } catch (e) { return String(e); } }).toBe('ok');
        await reloadReady(page);
      } else {
        const lists = await page.locator('.gear-pair .board-rows').evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().height - [...l.children].reduce((h, c) => h + c.getBoundingClientRect().height, 0)));
        expect(lists.every((x) => Math.abs(x) <= 1)).toBe(true);
      }
      // Deltas line up down each list, and every value column under its header (G4).
      for (const k of ['drippers', 'filters']) {
        const rights = await page.locator(`[data-section="gear-${k}"] .val`).evaluateAll((vs) => vs.map((v) => Math.round(v.getBoundingClientRect().right)));
        expect(new Set(rights).size).toBe(1);
        const cols = await page.locator(`[data-section="gear-${k}"]`).evaluate((sec) => {
          const shown = (e: Element) => e.getBoundingClientRect().width > 0;
          const right = (e: Element) => Math.round(e.getBoundingClientRect().right);
          const head = [...sec.querySelectorAll('.board-head .num')].filter(shown).map(right);
          return [...sec.querySelectorAll('.lab-rows .board-row:not(.placeholder)')].every((row) =>
            [...row.querySelectorAll('.num, .val')].filter(shown).map(right).every((x, i) => Math.abs(x - head[i]) <= 1));
        });
        expect(cols).toBe(true);
      }
      await expectDeltaInk(page);
      // Narrow boards drop SD first; brews and the delta always show.
      const sdShown = await page.locator('[data-section="gear-drippers"] .board-head .sd').evaluate((e) => e.getBoundingClientRect().width > 0);
      const boardW = (await page.locator('[data-section="gear-drippers"] .lab-board').boundingBox())!.width;
      expect(sdShown).toBe(boardW >= 27 * 16);
      // C5: the SD header explains itself (tap or keyboard opens its tip).
      if (sdShown) {
        await page.locator('[data-section="gear-drippers"] .board-head .sd button').click();
        await expect(page.locator('.mode-tip:popover-open .tip-title')).toHaveText('SD · standard deviation');
        await expect(page.locator('.mode-tip:popover-open')).toContainText('How much ratings vary from brew to brew.');
        await page.keyboard.press('Escape');
      }
      // C4: usage bars are bars: each takes ~75% of its month's slot, the rest a gap.
      const slot = await page.locator('[data-section="gear-eras"] .col').first().evaluate((c) => c.querySelector('.stack')!.getBoundingClientRect().width / c.getBoundingClientRect().width);
      expect(slot).toBeGreaterThan(0.6);
      expect(slot).toBeLessThan(0.85);
      // A small matrix cell is striped with its value; a cell tip names the pairing and its counts (tap and keyboard).
      const hm = page.locator('[data-section="gear-matrix"] .heatmap');
      const small = hm.locator('.heat-cell.small-sample-mark');
      if (await small.count()) await expect(small.first()).toHaveAttribute('aria-label', /[+−]?\d\.\d\d? \(Low confidence\)$/);
      await hm.locator('.heat-cell').first().click();
      await expect(hm.locator('.cell-tip .tip-title').first()).toContainText(' · ');
      await hm.locator('.heat-cell').first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(hm.locator('.heat-cell').nth(1)).toBeFocused();
      await expect(hm.locator('.cell-tip')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(hm.locator('.cell-tip')).toHaveCount(0);
      await hm.locator('.heat-cell').nth(1).blur();
    } },
  { name: 'insights-insights', path: () => '/stats?tab=insights&range=all',
    act: async (page) => {
      await expectGridRowsFull(page, '.finding-grid');
      for (const h of ['Top stories', 'Myth busters', 'What if…']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
      // Nothing takes focus on load (the phone keyboard would pop up).
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
      // Every grid card keeps the badge band, and a badge sits at its right edge.
      const off = await page.locator('.finding-grid .hl-card').evaluateAll((cards) => cards.flatMap((c) => {
        const band = c.querySelector('.hl-top')!.getBoundingClientRect(), b = c.querySelector('.hl-badge')?.getBoundingClientRect();
        return [...(band.height < 15 ? [`band ${band.height}px`] : []), ...(b && band.right - b.right > 2 ? [`badge ${band.right - b.right}px from the right`] : [])];
      }));
      expect(off).toEqual([]);
      await expect(page.locator('main')).not.toContainText(/NaN|undefined/);
      // The multiple-comparisons line's tip opens from its text and stays whole in view (ui-rules 36, 39).
      const many = page.locator('.chart-note.many .text-tip');
      await expect(many).toHaveText(/^\d+ findings$/);
      await many.click();
      const manyTip = page.locator('.float-tip');
      await expect(manyTip).toContainText('Many findings at once');
      await expectTipInView(page, manyTip);
      await page.keyboard.press('Escape');
      // Long text stays inside its card at every width (B1/B3), and a versus side never runs into "vs".
      const spills = await page.locator('.finding-grid .hl-card, .myth-grid .hl-card').evaluateAll((cards) => cards.flatMap((c) => {
        const o = c.getBoundingClientRect();
        const out = [...c.querySelectorAll('.hl-value, .vs-label, .hl-line, .stat-label, .multi, .legend li, .details li')].flatMap((e) => {
          const r = e.getBoundingClientRect();
          if (!r.width) return []; // a hidden details group
          return r.left < o.left - 1 || r.right > o.right + 1 || r.bottom > o.bottom + 1 ? [`${e.textContent?.trim().slice(0, 24)} spills`] : [];
        });
        const x = c.querySelector('.vs-x')?.getBoundingClientRect();
        const hit = x && x.width ? [...c.querySelectorAll('.vs-side .hl-value')].filter((v) => {
          const r = v.getBoundingClientRect();
          return r.right > x.left && r.left < x.right && r.bottom > x.top && r.top < x.bottom;
        }).map((v) => `${v.textContent} overlaps vs`) : [];
        return [...out, ...hit];
      }));
      expect(spills).toEqual([]);
      // Card sizes (ui-rules 34): every row is one size class, its cards all the row's height token (±2px),
      // and no card's content runs past its bottom (the tightening ladder must make it fit).
      const sizes = await page.locator('.finding-grid').evaluate((grid) => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const rows = new Map<number, HTMLElement[]>();
        for (const c of grid.children as HTMLCollectionOf<HTMLElement>) rows.set(c.offsetTop, [...(rows.get(c.offsetTop) ?? []), c]);
        return [...rows.values()].flatMap((cs, i) => {
          const token = getComputedStyle(cs[0]).getPropertyValue('--h').trim();
          const px = token.endsWith('rem') ? parseFloat(token) * rem : parseFloat(token);
          return [
            ...(new Set(cs.map((c) => c.dataset.size)).size > 1 ? [`row ${i} mixes size classes`] : []),
            ...(!(px > 0) ? [`row ${i} has no height token (${token})`] : []),
            ...cs.flatMap((c) => [
              ...(Math.abs(c.offsetHeight - px) > 2 ? [`${c.id} ${c.offsetHeight}px, token ${Math.round(px)}px`] : []),
              ...(c.scrollHeight > c.clientHeight + 1 ? [`${c.id} overflows by ${c.scrollHeight - c.clientHeight}px`] : [])
            ])
          ];
        });
      });
      expect(sizes).toEqual([]);
      // Details are filler only (B7): they reveal whole entries, in order, only into the spare height of the
      // card's fixed class height with charts at their base (.fit), and as many as fit: the next hidden entry
      // would overflow. So a card whose content fills its class shows none.
      const b7 = await page.locator('.finding-grid').evaluate((grid) => {
        const over = (c: Element) => c.scrollHeight > c.clientHeight + 1;
        grid.classList.add('fit');
        const out = [...grid.children].filter((c) => c.querySelector('.dgroup')).map((c) => {
          const groups = [...c.querySelectorAll<HTMLElement>('.dgroup')];
          const shown = c.querySelectorAll('.dgroup:not([hidden]) li:not([hidden])').length;
          const bad = [...(over(c) ? ['shown details overflow at base chart height'] : []),
            ...(groups.some((g) => !g.hidden && !g.querySelector('li:not([hidden])')) ? ['a group shows its label only'] : [])];
          const g = groups.find((x) => x.hidden || x.querySelector('li[hidden]'));
          const li = g?.querySelector<HTMLElement>(g.hidden ? 'li' : 'li[hidden]');
          if (g && li) {
            const was = g.hidden;
            g.hidden = li.hidden = false;
            if (c.scrollHeight <= c.clientHeight) bad.push('the next entry fits but stays hidden'); // the filler's own strict test
            g.hidden = was;
            li.hidden = true;
          }
          return { id: c.id, shown, bad };
        });
        grid.classList.remove('fit');
        return out;
      });
      expect(b7.filter((c) => c.bad.length)).toEqual([]);
      expect(b7.some((c) => c.shown > 0)).toBe(true);
      // A full card shows no details: forced (the seed's mix of cards decides whether one is full on its own).
      // A spacer fills the first details card; a 3px narrower grid re-runs the filler; then both are undone.
      const forcedShown = await page.locator('.finding-grid').evaluate(async (grid) => {
        const card = [...grid.children].find((c) => c.querySelector('.dgroup')) as HTMLElement;
        const pad = document.createElement('div');
        pad.style.cssText = `flex: none; height: ${card.clientHeight}px`;
        card.prepend(pad);
        (grid as HTMLElement).style.width = 'calc(100% - 3px)';
        await new Promise((r) => setTimeout(r, 400));
        const shown = card.querySelectorAll('.dgroup:not([hidden]) li:not([hidden])').length;
        pad.remove();
        (grid as HTMLElement).style.width = '';
        await new Promise((r) => setTimeout(r, 400));
        return shown;
      });
      expect(forcedShown).toBe(0);
      // A shown chart is never squeezed below its minimum to make room for details.
      const squeezed = await page.locator('.finding-grid .hl-card:has(.dgroup:not([hidden])) :is(.multi, .bars, .spark) svg').evaluateAll((ss) =>
        ss.filter((s) => s.getBoundingClientRect().height < 23).length);
      expect(squeezed).toBe(0);
      // A tap on a card's clamped body opens that card's full-text popover (not its badge tip); its empty space opens
      // nothing (ui-rules 50). Where no seeded card's body clamps at this width, the first one's body is lengthened.
      const clamped = await page.locator('.finding-grid .hl-card').evaluateAll((cs) => {
        const isClamped = (c: Element) => [...c.querySelectorAll('.body')].some((t) => t.scrollHeight > t.clientHeight + 1);
        const i = cs.findIndex((c) => c.querySelector('.hl-badge') && isClamped(c));
        if (i >= 0) return i;
        const j = cs.findIndex((c) => c.querySelector('.hl-badge') && c.querySelector('.body'));
        cs[j].querySelector('.body')!.textContent = 'A very long finding body '.repeat(16);
        return isClamped(cs[j]) ? j : -1;
      });
      expect(clamped).toBeGreaterThanOrEqual(0);
      const card = page.locator('.finding-grid .hl-card').nth(clamped);
      await card.locator('.hl-top').click({ position: { x: 2, y: 2 } }); // clear of the badge at its right
      await expect(card.locator('.mode-tip:popover-open')).toHaveCount(0);
      await card.locator('.body').click();
      await expect(card.locator('.mode-tip:popover-open')).toHaveCount(1);
      await expect(card.locator(`#full-${await card.getAttribute('id')}:popover-open`)).toBeVisible();
      await page.keyboard.press('Escape');
      // Too early to tell: compact rows, each with its finding and what would settle it.
      const rows = page.locator('.early li');
      await expect(rows.first().locator('.early-head')).toBeVisible();
      await expect(rows.first().locator('.early-theme')).toHaveText(/^(Taste|Dial-in|Habits|Gear|Money)$/i);
      // A money finding's mini chart reads its values as usd for screen readers ("2026 Q1 $10.00"), as its headline shows them.
      const money = page.locator('.finding-grid .hl-card', { hasText: '$/100g went from' }).locator(':is(.spark, .bars)');
      await expect(money).toHaveCount(1);
      expect(await money.getAttribute('aria-label')).toMatch(/^[^,]+ \$\d[\d,]*\.\d{2}(, [^,]+ \$\d[\d,]*\.\d{2})+$/);
      // Every row has its progress bar and "N% there", dial-in-by-group ones too (user, 2026-10-17); only a finding whose
      // evidence can't be measured has neither (settleEvidence, unit-tested: the seed can't reach it).
      expect(await rows.evaluateAll((ls) => ls.filter((l) => !l.querySelector('.meter') || !/\d+% there/.test(l.textContent ?? '')).length)).toBe(0);
      // A multi-line chart: a legend entry per line, each line in its own color (B2).
      const multi = page.locator('.finding-grid .multi').first();
      const legend = await multi.locator('.legend li').count();
      expect(legend).toBeGreaterThan(1);
      const colors = await multi.locator('.swatch').evaluateAll((ss) => ss.map((s) => getComputedStyle(s).backgroundColor));
      expect(new Set(colors).size).toBe(legend);
      // Weekday bars: seven bars, the weekend two in the second color (B6).
      const bars = page.locator('.finding-grid .bars:not(:has(.full))').first();
      await expect(bars.locator('rect')).toHaveCount(7);
      expect(await bars.locator('rect.weekend').count()).toBe(2);
      // The seed renders the Part 4 findings. Dial-in bars carry full labels with values; nothing spills its card.
      for (const id of ['dialinBy-roastLevel', 'dialinBy-processGroup']) {
        const labels = page.locator(`#insight-${id} .bar-labels.full span`);
        expect(await labels.count()).toBeGreaterThanOrEqual(2);
        expect(await labels.locator('b').allTextContents()).toEqual(expect.arrayContaining([expect.stringMatching(/^\d+$/)]));
        const spill = await page.locator(`#insight-${id}`).evaluate((card) => {
          const r = card.getBoundingClientRect();
          return [...card.querySelectorAll('.bar-labels.full span')].filter((e) => { const b = e.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1 || e.scrollHeight > e.clientHeight + 1; }).length;
        });
        expect(spill).toBe(0);
      }
      for (const id of ['rescuedBags', 'likeRoaster', 'likeStandout']) await expect(page.locator(`#insight-${id}`)).toBeVisible();
      // Crowded bars (prod has 4-5 groups with long names): five long labels stay whole on a phone and never spill.
      const crowded = await page.locator('#insight-dialinBy-roastLevel').evaluate((card) => {
        const row = card.querySelector('.bar-labels.full') as HTMLElement, saved = row.innerHTML, n0 = row.style.getPropertyValue('--n');
        const names = ['Nordic Light', 'Nordic', 'Ultralight', 'Extended Ferment Washed', 'Anaerobic Washed'];
        row.innerHTML = names.map((n, i) => `<span><b>${i + 1}</b>${n}</span>`).join('');
        row.style.setProperty('--n', '5');
        const r = card.getBoundingClientRect();
        const spans = [...row.querySelectorAll('span')];
        const out = {
          phone: innerWidth <= 480,
          cut: spans.filter((e) => e.scrollWidth > e.clientWidth + 1).length,
          outside: spans.filter((e) => { const b = e.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1; }).length,
          overflow: card.scrollHeight - card.clientHeight
        };
        row.innerHTML = saved;
        row.style.setProperty('--n', n0);
        return out;
      });
      if (crowded.phone) expect(crowded.cut, 'labels cut at phone width').toBe(0);
      expect(crowded.outside).toBe(0);
      expect(crowded.overflow, 'card overflow with crowded labels').toBeLessThanOrEqual(1);
      // A badge explains itself on tap.
      await page.locator('.finding-grid .hl-badge').first().click();
      await expect(page.locator('.mode-tip:popover-open')).toBeVisible();
    } },
  { name: 'insights-insights-story-link', path: () => '/stats?tab=insights&range=all#insight-wildcardBrewer',
    act: async (page) => {
      // A link to a deck card opens the deck on it, in view.
      await expect(page.locator('#insight-wildcardBrewer')).toBeInViewport();
      // The dot on is the card's own place in the deck (not the first, so the link did move it).
      const want = await page.locator('.deck-track > *').evaluateAll((cs) => cs.findIndex((c) => c.id === 'insight-wildcardBrewer' || !!c.querySelector('#insight-wildcardBrewer')));
      expect(want).toBeGreaterThan(0);
      expect(await page.locator('.dot').evaluateAll((ds) => ds.findIndex((d) => d.classList.contains('on')))).toBe(want);
      expect(await page.locator('.deck').evaluate((e) => e.scrollLeft)).toBe(0);
    } },
  // Part 4 findings, each under its own theme: the cards render and nothing spills (checkLayout runs after).
  { name: 'insights-insights-theme-dialin', viewports: 'two', path: () => '/stats?tab=insights&range=all&theme=dialin',
    act: async (page) => {
      for (const id of ['dialinBy-roastLevel', 'dialinBy-processGroup', 'rescuedBags']) await expect(page.locator(`#insight-${id}`)).toBeVisible();
      // The seed grades the dripper finding into the grid (on a real DB it may sit in Too early, which has no card).
      const card = page.locator('#insight-dialinBy-dripper');
      await expect(card).toBeVisible();
      await expect(card.locator('a[href$="#brewing-settle-dripper"]').first()).toBeVisible();
    } },
  { name: 'insights-insights-theme-taste', viewports: 'two', path: () => '/stats?tab=insights&range=all&theme=taste',
    act: async (page) => { await expect(page.locator('#insight-likeRoaster')).toBeVisible(); } },
  { name: 'insights-insights-theme', path: () => '/stats?tab=insights&range=all&theme=money',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Money', pressed: true })).toBeVisible();
      await expectGridRowsFull(page, '.finding-grid');
    } },
  // A period with no brews: no measured brews/day or dose, so the spend card says so instead of "$0 a month".
  { name: 'insights-insights-nobrews', viewports: 'two', path: () => '/stats?tab=insights&range=2000-01-01..2000-01-31',
    act: async (page) => {
      const spend = page.locator('#insights-spend');
      await expect(spend).toContainText('Not enough brews to measure your spend yet');
      await expect(spend).not.toContainText(/\$0(\.00)? a (month|year)/);
    } },
  { name: 'insights-insights-whatif', viewports: 'two', path: () => '/stats?tab=insights&range=all&drinkers=2&gpp=60&inflow=500',
    act: async (page) => {
      await expect(page.getByLabel('People drinking')).toHaveValue('2');
      await page.getByRole('button', { name: 'Next story' }).click(); // deck moves, URL unchanged
      await expect(page).toHaveURL(/drinkers=2/);
      await expect(page.getByRole('button', { name: 'Previous story' })).toBeEnabled();
      // A vertical swipe on the deck doesn't move it; a sideways one does.
      const deck = page.locator('.deck');
      const swipe = (dx: number, dy: number, end: 'pointerup' | 'pointercancel') => deck.evaluate((el, [dx, dy, end]) => {
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const fire = (type: string, ox: number, oy: number) => el.dispatchEvent(new PointerEvent(type,
          { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x + ox, clientY: y + oy }));
        fire('pointerdown', 0, 0);
        fire(end as string, dx as number, dy as number);
      }, [dx, dy, end] as const);
      const dot = () => page.locator('.dot').evaluateAll((ds) => ds.findIndex((d) => d.classList.contains('on')));
      await swipe(5, 120, 'pointercancel');
      await swipe(10, 120, 'pointerup');
      expect(await dot()).toBe(1);
      await swipe(120, 5, 'pointerup');
      expect(await dot()).toBe(0);
      // Inputs write the URL and the answer follows.
      await page.getByLabel('People drinking').fill('3');
      await expect(page).toHaveURL(/drinkers=3/);
      await expect(page.locator('#insights-runway .hl-value')).toContainText(/days|Never/);
    } },
  {
    // Ethiopia (every seeded coffee but a few) is tapped at a point known to be inside its outline.
    name: 'insights-leaderboards-map-tip',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      await page.locator('.world-map').scrollIntoViewIfNeeded();
      const [x, y] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
        const path = p as unknown as SVGPathElement;
        const svg = path.ownerSVGElement!;
        const pt = svg.createSVGPoint();
        pt.x = 582; pt.y = 200; // interior of Ethiopia in the 957x420 viewBox
        if (!path.isPointInFill(pt)) throw new Error('(582,200) is not inside Ethiopia');
        const c = pt.matrixTransform(svg.getScreenCTM()!);
        return [c.x, c.y];
      });
      await page.mouse.click(x, y);
      // The shared data tip (ui-rules 36, 39): the country, then Coffees / Share / the Rank by value rows.
      const tip = page.locator('.cell-tip:popover-open');
      await expectDataTip(tip);
      await expectTipInView(page, tip);
      await expect(tip.locator('dl').first().locator('dt')).toHaveText(['Coffees', 'Share', 'Brews']);
      // The tip's link is the Ethiopia list row's own link; the pinned tip takes the click.
      const link = tip.getByRole('link', { name: 'See coffees' });
      await expect(link).toHaveAttribute('href', (await page.locator('.board-rows a[href*="origin=Ethiopia"]').first().getAttribute('href'))!);
      await link.click();
      await expect(page).toHaveURL(/\/coffees\?status=open&status=archive&origin=Ethiopia/);
      for (const n of ['Open', 'Archive']) await expect(page.getByRole('button', { name: n, pressed: true })).toBeVisible();
    }
  },
  {
    // A click on the sea closes the pinned map tip.
    name: 'insights-leaderboards-map-tip-close',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      await page.locator('.world-map').scrollIntoViewIfNeeded();
      const [x, y] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
        const path = p as unknown as SVGPathElement;
        const svg = path.ownerSVGElement!;
        const pt = svg.createSVGPoint();
        pt.x = 582; pt.y = 200;
        const c = pt.matrixTransform(svg.getScreenCTM()!);
        return [c.x, c.y];
      });
      await page.mouse.click(x, y);
      const tip = page.locator('.cell-tip:popover-open');
      await expect(tip).toBeVisible();
      await page.locator('.world-map svg').click({ position: { x: 4, y: 4 } }); // outside the globe: the sea
      await expect(tip).toHaveCount(0);
    }
  },
  {
    // A hover tip stays open while the mouse is on it (the link is clickable); an unpinned tip closes once the
    // mouse leaves both country and tip; a click pins, a second click on the country (or the tip body) closes.
    name: 'insights-leaderboards-map-tip-hover',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      await page.locator('.world-map').scrollIntoViewIfNeeded();
      const [x, y] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
        const path = p as unknown as SVGPathElement;
        const svg = path.ownerSVGElement!;
        const pt = svg.createSVGPoint();
        pt.x = 582; pt.y = 200;
        const c = pt.matrixTransform(svg.getScreenCTM()!);
        return [c.x, c.y];
      });
      const tip = page.locator('.cell-tip:popover-open');
      const onTip = async () => {
        const b = (await tip.boundingBox())!;
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      };
      await page.mouse.move(x, y);
      await expect(tip).toBeVisible();
      await onTip();
      await page.waitForTimeout(400); // past the bridge delay
      await expect(tip).toBeVisible();
      await page.mouse.move(2, 2, { steps: 4 }); // off the tip and the country
      await expect(tip).toHaveCount(0);
      // Hover, then onto the tip, then click the link.
      await page.mouse.move(x, y);
      await expect(tip).toBeVisible();
      await onTip();
      await tip.getByRole('link', { name: 'See coffees' }).click();
      await expect(page).toHaveURL(/\/coffees\?status=open&status=archive&origin=Ethiopia/);
      await page.goBack();
      await page.locator('.world-map').scrollIntoViewIfNeeded();
      // A click pins; clicking the country again closes.
      const [x2, y2] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
        const path = p as unknown as SVGPathElement;
        const svg = path.ownerSVGElement!;
        const pt = svg.createSVGPoint();
        pt.x = 582; pt.y = 200;
        const c = pt.matrixTransform(svg.getScreenCTM()!);
        return [c.x, c.y];
      });
      await page.mouse.click(x2, y2);
      await expect(tip).toBeVisible();
      await page.mouse.click(x2, y2);
      await expect(tip).toHaveCount(0);
      // A click on the tip's own body (not the link) closes a pinned tip.
      await page.mouse.click(x2, y2);
      await expect(tip).toBeVisible();
      await tip.locator('.tip-title').first().click();
      await expect(tip).toHaveCount(0);
    }
  },
  {
    // The page-wide filters ride along on the tip link, as on the list rows.
    name: 'insights-leaderboards-map-tip-filtered',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews&process=Washed',
    act: async (page) => {
      await page.locator('.world-map').scrollIntoViewIfNeeded();
      const [x, y] = await page.locator('.world-map path[data-iso="ET"]').evaluate((p) => {
        const path = p as unknown as SVGPathElement;
        const svg = path.ownerSVGElement!;
        const pt = svg.createSVGPoint();
        pt.x = 582; pt.y = 200;
        const c = pt.matrixTransform(svg.getScreenCTM()!);
        return [c.x, c.y];
      });
      await page.mouse.click(x, y);
      await expect(page.locator('.cell-tip:popover-open').getByRole('link', { name: 'See coffees' })).toHaveAttribute('href', /processing=/);
    }
  },
  {
    // Zoom buttons (peer review D4): bottom-right inside the map, 44px, disabled at the limits; zoom is never in the URL.
    name: 'insights-map-zoom-controls',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      const url = page.url();
      const map = page.locator('.world-map');
      await map.scrollIntoViewIfNeeded();
      const btn = (n: string) => page.locator('.map-zoom').getByRole('button', { name: n, exact: true });
      const [zin, zout, whole] = [btn('Zoom in'), btn('Zoom out'), btn('Show whole world')];
      const m = (await map.boundingBox())!;
      for (const b of [zin, zout, whole]) {
        await expect(b).toBeVisible();
        const r = (await b.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.x).toBeGreaterThanOrEqual(m.x);
        expect(r.y).toBeGreaterThanOrEqual(m.y);
        expect(r.x + r.width).toBeLessThanOrEqual(m.x + m.width + 0.5);
        expect(r.y + r.height).toBeLessThanOrEqual(m.y + m.height + 0.5);
      }
      const g = (await page.locator('.map-zoom').boundingBox())!;
      expect(m.x + m.width - (g.x + g.width), 'group right').toBeLessThanOrEqual(16);
      expect(m.y + m.height - (g.y + g.height), 'group bottom').toBeLessThanOrEqual(16);
      // At most a quarter of the map, or a single row of buttons (44px), whichever is larger.
      expect(g.height, 'group height').toBeLessThanOrEqual(Math.max(0.25 * m.height, 44));
      if (0.25 * m.height < 3 * 44) {
        const tops = await Promise.all([zin, zout, whole].map(async (b) => (await b.boundingBox())!.y));
        tops.forEach((t) => expect(Math.abs(t - tops[0]), 'short map: one row').toBeLessThanOrEqual(1));
      }
      expect(await mapView(page)).toEqual({ k: 1, x: 0, y: 0 });
      await expect(zout).toBeDisabled();
      await expect(whole).toBeDisabled();
      await expect(zin).toBeEnabled();
      await zin.scrollIntoViewIfNeeded(); // so the click doesn't scroll the page under the sampled point
      const m2 = (await map.boundingBox())!;
      const c = [m2.x + m2.width / 2, m2.y + m2.height / 2] as const;
      const vb0 = await vbAt(page, ...c);
      await zin.click();
      await expectZoom(page, 2);
      await expectSameVb(vb0, await vbAt(page, ...c));
      await zin.click();
      await zin.click();
      await expectZoom(page, 8);
      await expect(zin).toBeDisabled();
      await zout.click();
      await expectZoom(page, 4);
      await whole.click();
      expect(await mapView(page)).toEqual({ k: 1, x: 0, y: 0 });
      await expect(zout).toBeDisabled();
      await expect(whole).toBeDisabled();
      await zin.click(); // end zoomed: checkLayout covers a zoomed map
      await expectZoom(page, 2);
      // The map's bottom edge at the viewport bottom: Back to top (if shown) never covers the buttons.
      await page.evaluate(() => scrollBy(0, document.querySelector('.world-map')!.getBoundingClientRect().bottom - innerHeight));
      await page.waitForTimeout(200);
      const [bt, zg] = [page.locator('.back-to-top'), page.locator('.map-zoom')];
      if (await bt.isVisible()) {
        const [a, z] = [(await bt.boundingBox())!, (await zg.boundingBox())!];
        expect(a.x < z.x + z.width && z.x < a.x + a.width && a.y < z.y + z.height && z.y < a.y + a.height, 'back-to-top clear of the buttons').toBe(false);
      }
      expect(page.url()).toBe(url);
    }
  },
  {
    // Top regions in the country tip: Ethiopia lists up to 3, Kenya's 40+ character region ellipsizes inside the tip's
    // max width, a country with no region (Rwanda) has no group. Not `viewports: 'two'`: it runs at all 7 in the gate.
    name: 'insights-map-regions',
    path: () => '/stats?tab=leaderboards&range=all&rank=brews', // brews: the one-bag long Kenya region isn't cut by Average's 3+ bags
    act: async (page) => {
      const map = page.locator('.world-map');
      await map.scrollIntoViewIfNeeded();
      const tip = page.locator('.cell-tip:popover-open');
      const tap = async (iso: string) => {
        await page.keyboard.press('Escape'); // the last tip can cover the next country
        await expect(tip).toHaveCount(0);
        const barBottom = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.cbar-mini')]
          .map((e) => e.getBoundingClientRect()).filter((r) => Math.abs(r.top) <= 1).map((r) => r.bottom)));
        const [x, y] = await mapPoint(page, iso);
        if (y < barBottom || y > page.viewportSize()!.height) throw new Error(`${iso} is outside the map's visible part`);
        await (touch() ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
      };
      await tap('ET');
      await expectDataTip(tip);
      await expect(tip.locator('.tip-title').nth(1)).toHaveText('Top regions');
      const n = await tip.locator('dl.tip-rows').nth(1).locator('dt').count();
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(3);
      await tap('KE');
      await expect(tip.locator('.tip-title').first()).toHaveText('Kenya');
      const dts = tip.locator('dl.tip-rows').nth(1).locator('dt');
      expect(await dts.evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth)), 'a long region name is ellipsized').toBe(true);
      await expectTipInView(page, tip);
      const w = (await tip.boundingBox())!.width;
      expect(w - 0.5, 'the tip stays within its max width').toBeLessThanOrEqual(await tip.evaluate((e) => parseFloat(getComputedStyle(e).maxWidth) || Infinity));
      await tap('CO');
      await expect(tip.locator('.tip-title').first()).toHaveText('Colombia');
      await expect(tip.getByText('Top regions')).toHaveCount(0);
    }
  },
  {
    // A small country (Rwanda) is reachable at 8x: a drag pans without pinning, a tap then pins, and the pinned tip
    // follows its country and closes once the country leaves the map (Review Focus 3: a tap after a pan still pins).
    name: 'insights-map-zoom-tip',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      const map = page.locator('.world-map');
      await map.scrollIntoViewIfNeeded();
      const zin = page.locator('.map-zoom').getByRole('button', { name: 'Zoom in', exact: true });
      for (let i = 0; i < 3; i++) await zin.click();
      await expectZoom(page, 8);
      const m = (await map.boundingBox())!;
      // Work in the map's visible part: on a short viewport (phone-landscape, 333px) the map is taller than the
      // viewport and the pinned bar covers its top, so its own center and top quarter can be off-screen or under the bar.
      const barBottom = await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('.cbar-mini')]
        .map((e) => e.getBoundingClientRect()).filter((r) => Math.abs(r.top) <= 1).map((r) => r.bottom)));
      const top = Math.max(m.y, barBottom), h = Math.min(m.y + m.height, page.viewportSize()!.height) - top;
      // Pan in chunks from inside the map until Rwanda's center reaches the visible middle (it starts off-map at 8x).
      for (let i = 0; i < 30; i++) {
        const [px, py] = await mapPoint(page, 'RW');
        const d = [m.x + m.width / 2 - px, top + h / 2 - py];
        if (Math.hypot(d[0], d[1]) <= 2) break; // a sub-4px drag would be a click (it pins)
        const [dx, dy] = [Math.max(-0.4 * m.width, Math.min(0.4 * m.width, d[0])), Math.max(-0.4 * h, Math.min(0.4 * h, d[1]))];
        // Start in the visible top quarter: on a short map (360px) the zoom buttons sit over its middle and a press there is theirs.
        const [sx, sy] = [m.x + m.width / 2 - dx / 2, top + h * 0.2];
        await drag(page, [sx, sy], [sx + dx, sy + dy]);
      }
      const tip = page.locator('.cell-tip:popover-open');
      // The panned map can rest a country under the pointer (a legitimate hover tip, e.g. Côte d'Ivoire at 360px), so
      // leave the map first: an unpinned hover tip then closes, a pinned one would stay.
      if (!touch()) await page.mouse.move(m.x + m.width / 2, m.y - 20);
      await expect(tip, 'a drag does not pin').toHaveCount(0);
      const [x, y] = await mapPoint(page, 'RW');
      await (touch() ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
      await expectDataTip(tip);
      await expect(tip.locator('.tip-title').first()).toHaveText('Rwanda');
      await expect(tip.locator('dl').first().locator('dt')).toHaveText(['Coffees', 'Share', 'Brews']);
      await expect(tip.getByRole('link', { name: 'See coffees' })).toBeVisible();
      await expectTipInView(page, tip);
      const pinned = await vbAt(page, x, y);
      await drag(page, [m.x + 10, top + 10], [m.x + 50, top + 30]);
      await expect(tip).toBeVisible();
      await frames(page);
      const [ex, ey] = await mapPoint(page, 'RW', [pinned.x, pinned.y]);
      const a = (await page.locator('.world-map .tip-anchor').boundingBox())!;
      expect(Math.hypot(a.x + a.width / 2 - ex, a.y + a.height / 2 - ey), 'anchor stays on Rwanda').toBeLessThanOrEqual(2);
      await drag(page, [m.x + m.width - 5, top + 10], [m.x + 5, top + 10]); // Rwanda leaves the map
      await expect(tip).toHaveCount(0);
    }
  },
  {
    // Desktop wheel: a plain wheel scrolls the page and shows the hint; Ctrl/Cmd+wheel zooms about the pointer.
    name: 'insights-map-zoom-wheel',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      if (touch()) return;
      const map = page.locator('.world-map');
      const hint = page.locator('.map-hint');
      const aim = async () => {
        await map.scrollIntoViewIfNeeded();
        const [x, y] = await mapPoint(page, 'ET');
        await page.mouse.move(x, y);
        return [x, y] as const;
      };
      await aim();
      const s0 = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 200);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(s0);
      expect((await mapView(page)).k).toBe(1);
      await expect(hint).toBeVisible();
      await expect(hint).toHaveText(/^Hold (⌘|Ctrl) to zoom the map$/);
      await expect(hint).toBeHidden({ timeout: 3000 });
      for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 100);
      expect(await hint.count()).toBeLessThanOrEqual(1);
      if (await hint.count()) {
        const [h, z] = [(await hint.boundingBox())!, (await page.locator('.map-zoom').boundingBox())!];
        expect(h.x < z.x + z.width && z.x < h.x + h.width && h.y < z.y + z.height && z.y < h.y + h.height, 'hint clear of the buttons').toBe(false);
      }
      await expect(hint).toHaveCount(0, { timeout: 3000 });
      const [x, y] = await aim();
      const [vb0, s1] = [await vbAt(page, x, y), await page.evaluate(() => scrollY)];
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -200);
      await page.keyboard.up('Control');
      await expect.poll(async () => (await mapView(page)).k).toBeGreaterThan(1);
      expect(await page.evaluate(() => scrollY), 'page did not scroll').toBe(s1);
      await expectSameVb(vb0, await vbAt(page, x, y));
      await expect(hint).toHaveCount(0);
      // Review Focus 2: the Ctrl wheel listener is not passive (else the browser zooms the page).
      const prevented = (ctrlKey: boolean) => page.evaluate(([x, y, ctrlKey]) => {
        const e = new WheelEvent('wheel', { ctrlKey, deltaY: -100, clientX: x, clientY: y, bubbles: true, cancelable: true });
        document.elementFromPoint(x, y)!.dispatchEvent(e);
        return e.defaultPrevented;
      }, [x, y, ctrlKey] as const);
      expect(await prevented(true), 'ctrl wheel preventDefaulted').toBe(true);
      expect(await prevented(false), 'plain wheel left alone').toBe(false);
      // macOS wording.
      await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }));
      await reloadReady(page);
      await aim();
      await page.mouse.wheel(0, 200);
      await expect(hint).toHaveText('Hold ⌘ to zoom the map');
    }
  },
  {
    // Touch: one finger scrolls the page (hint, no pan); two fingers pinch and pan. Synthetic pointer events.
    name: 'insights-map-zoom-touch',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      const map = page.locator('.world-map');
      const hint = page.locator('.map-hint');
      await map.scrollIntoViewIfNeeded();
      expect(await page.locator('.world-map svg').evaluate((s) => getComputedStyle(s).touchAction)).toBe('pan-x pan-y');
      const [x, y] = await mapPoint(page, 'ET');
      await touchGesture(page, [[[x, y]]]); // a tap
      await page.waitForTimeout(300);
      await expect(hint, 'a tap shows no hint').toHaveCount(0);
      await touchGesture(page, [[[x, y], [x, y + 10], [x, y + 20], [x, y + 30]]]);
      expect(await mapView(page)).toEqual({ k: 1, x: 0, y: 0 });
      await expect(hint).toHaveText('Use two fingers to move the map');
      await touchGesture(page, [[[x, y], [x, y + 30]]]);
      expect(await hint.count()).toBeLessThanOrEqual(1);
      await expect(hint).toHaveCount(0, { timeout: 3000 });
      await touchGesture(page, [[[x, y], [x, y + 6]]], 'pointercancel'); // the browser took it for a scroll
      await expect(hint).toHaveText('Use two fingers to move the map');
      await expect(hint).toHaveCount(0, { timeout: 3000 });
      // Pinch: two fingers 100px apart about the map center move to 200px.
      const m = (await map.boundingBox())!;
      const [cx, cy] = [m.x + m.width / 2, m.y + m.height / 2];
      const vb0 = await vbAt(page, cx, cy);
      const steps = [1, 1.25, 1.5, 1.75, 2];
      await touchGesture(page, [steps.map((s) => [cx - 50 * s, cy]), steps.map((s) => [cx + 50 * s, cy])]);
      await expectZoom(page, 2, 0.1);
      await expectSameVb(vb0, await vbAt(page, cx, cy));
      // Both fingers +40px in x: the map follows.
      const [ex0] = await mapPoint(page, 'ET', [582, 200]);
      const mv = [0, 10, 20, 30, 40];
      await touchGesture(page, [mv.map((d) => [cx - 50 + d, cy]), mv.map((d) => [cx + 50 + d, cy])]);
      await expect.poll(async () => Math.abs((await mapPoint(page, 'ET', [582, 200]))[0] - ex0 - 40)).toBeLessThanOrEqual(2);
      if (touch()) {
        // Review Focus 1: a two-finger touchmove is preventDefaulted so the browser doesn't scroll/zoom the page.
        const prevented = (n: number) => page.locator('.world-map svg').evaluate((svg, n) => {
          const ts = [0, 1].slice(0, n).map((i) => new Touch({ identifier: i + 1, target: svg, clientX: 100 + i * 50, clientY: 100 }));
          const e = new TouchEvent('touchmove', { touches: ts, targetTouches: ts, changedTouches: ts, cancelable: true, bubbles: true });
          svg.dispatchEvent(e);
          return e.defaultPrevented;
        }, n);
        expect(await prevented(2), 'two touches preventDefaulted').toBe(true);
        expect(await prevented(1), 'one touch left to scroll').toBe(false);
      }
    }
  },
  {
    // The sharper 1:50m outlines load on the first zoom-in (not before) and swap in without the view moving.
    name: 'insights-map-zoom-detail',
    viewports: 'two',
    path: () => '/stats?tab=leaderboards&rank=brews',
    act: async (page) => {
      const url = page.url();
      // The 1:50m module is the one big lazy script: its file name is `worldMap50` in dev but a bare hash in the
      // prod build, so recognise it by size (> 500 kB), not name.
      const BIG = 500_000, SCRIPT = /worldMap50|\/chunks\/[^/]+\.js$/;
      const big: string[] = [];
      page.on('response', async (r) => {
        if (SCRIPT.test(r.url()) && (await r.body().catch(() => Buffer.alloc(0))).length > BIG) big.push(r.url());
      });
      await reloadReady(page); // so the listener sees the load
      const map = page.locator('.world-map');
      await map.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      expect(big, 'no 1:50m chunk before zooming').toEqual([]);
      const [x, y] = await mapPoint(page, 'ET');
      await page.mouse.click(x, y);
      const tip = page.locator('.cell-tip:popover-open');
      await expect(tip).toBeVisible();
      const paths = () => page.locator('.world-map path').count();
      const n1 = await paths();
      // Hold the 1:50m chunk until the "before" view is sampled, so the swap check can't pass vacuously.
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      await page.route(SCRIPT, async (r) => {
        const res = await r.fetch();
        if ((await res.body()).length > BIG) await gate;
        await r.fulfill({ response: res });
      });
      const et = page.locator('.world-map path[data-iso="ET"]');
      await et.focus();
      await et.evaluate((el) => ((el as unknown as { __probe: number }).__probe = 1));
      await page.keyboard.press('=');
      await expectZoom(page, 2);
      const ctm = () => page.locator('.world-map svg > g').evaluate((g) => { const m = (g as SVGGElement).getScreenCTM()!; return [m.a, m.e, m.f]; });
      const before = await ctm();
      expect(await paths(), 'still the 1:110m outlines').toBe(n1);
      release();
      await expect.poll(() => big.length).toBeGreaterThan(0);
      await expect.poll(paths).toBeGreaterThan(n1);
      (await ctm()).forEach((v, i) => expect(Math.abs(v - before[i]), 'view unchanged across the swap').toBeLessThanOrEqual(0.01));
      await expect(tip.locator('.tip-title').first()).toHaveText('Ethiopia');
      // The focused country kept focus across the swap (same element), and across a zoom out.
      const focused = () => page.evaluate(() => (document.activeElement as unknown as { __probe?: number })?.__probe);
      expect(await focused()).toBe(1);
      await page.keyboard.press('-');
      await expectZoom(page, 1);
      expect(await focused()).toBe(1);
      // Review Focus 4: zoomed, panned to the world's right edge, then narrowed: the view re-clamps (no blank strip).
      const zin = page.locator('.map-zoom').getByRole('button', { name: 'Zoom in', exact: true });
      await zin.click();
      await zin.click();
      await expectZoom(page, 4);
      const m = (await map.boundingBox())!;
      for (let i = 0; i < 6; i++) await drag(page, [m.x + m.width - 10, m.y + 10], [m.x + 10, m.y + 10]);
      const vp = page.viewportSize()!;
      try {
        await page.setViewportSize({ width: vp.width - 200, height: vp.height });
        await frames(page);
        const [right, mapRight] = await Promise.all([
          page.locator('.world-map svg > g').evaluate((g) => { const s = (g as SVGGElement).ownerSVGElement!; const p = s.createSVGPoint(); p.x = 957; return p.matrixTransform((g as SVGGElement).getScreenCTM()!).x; }), // WORLD_VIEWBOX right edge
          map.evaluate((e) => e.getBoundingClientRect().right)
        ]);
        expect(right, 'world still covers the map').toBeGreaterThanOrEqual(mapRight - 1);
      } finally {
        await page.setViewportSize(vp);
      }
      expect(page.url()).toBe(url);
      await reloadReady(page);
      expect(await mapView(page)).toEqual({ k: 1, x: 0, y: 0 });
    }
  },
  {
    name: 'coffees-bc-yes',
    path: () => '/coffees?status=all&view=list&bc=yes',
    act: async (page: Page) => {
      // A filter chip's full text is its label tip on hover.
      await page.locator('.filter-chip-label').first().hover();
      await expectTipInView(page, page.locator('.cell-tip:popover-open'));
      await expect(page.locator('.cell-tip:popover-open')).toHaveText('Showing coffees in Bean Conqueror');
    }
  },
  { name: 'coffees-bc-no', path: () => '/coffees?status=all&view=compact&bc=no' },
  {
    // The Subscription select: a plan, Any plan, No plan, All. The list follows, the URL carries the id (bare on All).
    name: 'coffees-filter-subscription',
    path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      const count = async () => Number((await page.getByText(/^\d+ coffees?/).first().innerText()).match(/^\d+/)![0]);
      const total = await count();
      const apply = async (label: string) => {
        await page.getByRole('button', { name: '+ Filter' }).click();
        await page.getByRole('combobox', { name: 'Subscription' }).selectOption({ label });
        await page.locator('.filter-editor').getByRole('button', { name: 'Apply', exact: true }).click();
      };
      await page.getByRole('button', { name: '+ Filter' }).click();
      await page.getByRole('combobox', { name: 'Subscription' }).selectOption({ label: 'Any plan' });
      await page.waitForTimeout(200);
      expect(page.url(), 'a draft until Apply').not.toContain('subscription');
      await page.locator('.filter-editor').getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page).toHaveURL(/subscription=any/);
      const any = await count();
      expect(any).toBeGreaterThanOrEqual(2);
      await apply('No plan');
      await expect(page).toHaveURL(/subscription=none/);
      expect(await count()).toBe(total - any);
      await apply('Sey · 1x250g');
      await expect(page).toHaveURL(/subscription=\d+/);
      expect(await count()).toBe(1);
      await expect(page.locator('.filter-chip-label')).toHaveText(/^Plan: Sey/);
      await apply('All');
      expect(page.url()).not.toContain('subscription');
    }
  },
  {
    // Main window: Cancel, Esc and click-out leave the page as it was; Reset clears the draft in place (Apply still needed).
    name: 'coffees-filter-window-cancel', viewports: 'two',
    path: () => '/coffees?status=all&view=cards&subscription=any',
    act: async (page) => {
      const url = page.url();
      const ed = page.locator('.filter-editor');
      await page.getByRole('button', { name: '+ Filter' }).click();
      await ed.getByRole('radio', { name: 'Decaf only' }).click();
      await ed.getByRole('button', { name: 'Reset' }).click();
      await expect(ed).toBeVisible();
      expect(page.url()).toBe(url);
      await expect(ed.getByRole('combobox', { name: 'Subscription' })).toHaveValue('');
      await ed.getByRole('button', { name: 'Cancel' }).click();
      await expect(ed).toHaveCount(0);
      expect(page.url()).toBe(url);
      await page.getByRole('button', { name: '+ Filter' }).click();
      await expect(ed.getByRole('combobox', { name: 'Subscription' })).not.toHaveValue(''); // the discarded Reset did not stick
      await page.keyboard.press('Escape');
      await expect(ed).toHaveCount(0);
      await page.getByRole('button', { name: '+ Filter' }).click();
      await page.mouse.click(2, 2);
      await expect(ed).toHaveCount(0);
      expect(page.url()).toBe(url);
      await page.getByRole('button', { name: '+ Filter' }).click();
      await ed.getByRole('button', { name: 'Reset' }).click();
      await ed.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page).not.toHaveURL(/subscription=/);
    }
  },
  {
    // A column sub-menu (from the list): Apply returns to the list with the URL untouched (the main Apply writes it);
    // Cancel / Esc / click-out go back to the list without applying; Reset empties it in place.
    name: 'coffees-filter-submenu', viewports: 'two',
    path: () => '/coffees?status=all&view=compact',
    act: async (page) => {
      const url = page.url();
      const ed = page.locator('.filter-editor');
      const list = page.getByRole('radiogroup', { name: 'In Bean Conqueror' });
      const apply = ed.getByRole('button', { name: 'Apply', exact: true });
      await page.getByRole('button', { name: '+ Filter' }).click();
      await ed.getByRole('button', { name: 'Origin', exact: true }).click();
      await ed.locator('.filter-values input').first().check();
      await ed.getByRole('button', { name: 'Cancel' }).click();
      await expect(list).toBeVisible();
      await ed.getByRole('button', { name: 'Origin', exact: true }).click();
      await expect(ed.locator('.filter-values input:checked')).toHaveCount(0); // the cancelled pick is gone
      await ed.locator('.filter-values input').first().check();
      await page.keyboard.press('Escape'); // one level only
      await expect(list).toBeVisible();
      await ed.getByRole('button', { name: 'Origin', exact: true }).click();
      await ed.locator('.filter-values input').first().check();
      await page.mouse.click(2, 2);
      await expect(list).toBeVisible();
      await ed.getByRole('button', { name: 'Origin', exact: true }).click();
      await ed.locator('.filter-values input').first().check();
      await ed.getByRole('button', { name: 'Reset' }).click();
      await expect(ed.locator('.filter-values input:checked')).toHaveCount(0);
      await expect(apply).toBeDisabled();
      await ed.locator('.filter-values input').first().check();
      await apply.click(); // back to the list, page untouched
      await expect(list).toBeVisible();
      expect(page.url()).toBe(url);
      const origin = ed.getByRole('button', { name: 'Origin', exact: true });
      await expect(origin).toHaveAttribute('aria-pressed', 'true'); // the list shows the draft
      await expect(origin).toBeFocused(); // focus returns to the column's button
      await ed.getByRole('button', { name: 'Reset' }).click();
      await expect(origin).toHaveAttribute('aria-pressed', 'false');
      await origin.click();
      await ed.locator('.filter-values input').first().check();
      await apply.click();
      await expect(page.locator('.filter-chip')).toHaveCount(0);
      await apply.click(); // the list's Apply
      await expect(ed).toHaveCount(0);
      await expect(page).toHaveURL(/origin=/);
      await expect(page.locator('.filter-chip')).toHaveCount(1);
      // A chip opens the editor straight in: it is top-level, Apply writes the page and Cancel just closes.
      await page.locator('.filter-chip-label').click();
      await ed.getByRole('button', { name: 'Contains' }).click(); // half-edited: Apply is off, it does not delete the filter
      await expect(apply).toBeDisabled();
      await ed.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.filter-chip')).toHaveCount(1);
      await page.locator('.filter-chip-label').click();
      await ed.getByRole('button', { name: 'Reset' }).click();
      await ed.getByRole('button', { name: 'Cancel' }).click();
      await expect(ed).toHaveCount(0);
      await expect(page.locator('.filter-chip')).toHaveCount(1);
      await page.locator('.filter-chip-label').click();
      await ed.getByRole('button', { name: 'Reset' }).click();
      await apply.click();
      await expect(page).not.toHaveURL(/origin=/);
    }
  },
  {
    name: 'coffees-filter-subscription-stale', viewports: 'two',
    path: () => '/coffees?status=all&view=cards&subscription=999999',
    act: async (page) => {
      await expect(page).not.toHaveURL(/subscription=/);
      await expect(page.locator('.filter-chip-label')).toHaveCount(0);
      await page.getByRole('button', { name: '+ Filter' }).click();
      await expect(page.getByRole('combobox', { name: 'Subscription' })).toHaveValue('');
      await expect(page.getByRole('combobox', { name: 'Subscription' }).locator('option:checked')).toHaveText('All');
    }
  },
  {
    // Rest state (Before / In / Past / No rest window, freezer-net age) and Age (days) are normal filter columns, and
    // the On hand age profile's links use them. Pick a state: the URL carries it, a chip names it.
    name: 'coffees-filter-rest-state',
    path: () => '/coffees?status=backlog&view=compact&age=between:0..4000',
    act: async (page) => {
      await expect(page.locator('.filter-chip-label').first()).toHaveText(/^Age: 0d–4000d$/);
      await page.getByRole('button', { name: '+ Filter' }).click();
      await page.getByRole('button', { name: 'Rest state', exact: true }).click();
      const options = page.locator('.filter-values label');
      expect(await options.count()).toBeGreaterThan(0);
      await expect(options.first()).toContainText(/rest window/i);
      await options.first().locator('input').check();
      await page.getByRole('button', { name: /^Apply/ }).click();
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page).toHaveURL(/rest_state=/);
      await expect(page.locator('.filter-chip-label').filter({ hasText: /^Rest state: .*rest window$/i })).toHaveCount(1);
    }
  },
  {
    name: 'coffees-filter-editor',
    path: () => '/coffees?status=all&view=compact',
    act: async (page) => {
      await page.getByRole('button', { name: '+ Filter' }).click();
      await expect(page.getByRole('radiogroup', { name: 'In Bean Conqueror' })).toBeVisible();
    }
  },
  {
    // A column's value list has a back button to the filter list (nothing applied, URL untouched), and the counts clear the scrollbar.
    name: 'coffees-filter-editor-back',
    path: () => '/coffees?status=all&view=compact',
    act: async (page) => {
      const url = page.url();
      await page.getByRole('button', { name: '+ Filter' }).click();
      await page.getByRole('button', { name: 'Origin', exact: true }).click();
      const back = page.getByRole('button', { name: 'Back to filters' });
      await expect(back).toBeVisible();
      const b = (await back.boundingBox())!;
      if (page.viewportSize()!.width <= 480) { expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44); }
      const gap = await page.locator('.filter-values').evaluate((el) => {
        const c = el.querySelector('.filter-value-count')!.getBoundingClientRect();
        return el.getBoundingClientRect().right - c.right - ((el as HTMLElement).offsetWidth - el.clientWidth);
      });
      expect(gap, 'space between the counts and the scrollbar').toBeGreaterThanOrEqual(16);
      // The column name is a bold accent title centered on the panel, clear of the arrow, on one line.
      const title = page.locator('.filter-editor-title');
      const [t, ed, st] = await Promise.all([title.boundingBox(), page.locator('.filter-editor').boundingBox(), title.evaluate((e) => ({ w: getComputedStyle(e).fontWeight, c: getComputedStyle(e).color, a: getComputedStyle(document.documentElement).getPropertyValue('--color-accent'), h: e.scrollHeight <= e.clientHeight + 1 }))]);
      expect(+st.w).toBeGreaterThanOrEqual(700);
      expect(st.h, 'title on one line').toBe(true);
      expect(t!.x, 'clear of the arrow').toBeGreaterThanOrEqual(b.x + b.width);
      expect(Math.abs(t!.x + t!.width / 2 - (ed!.x + ed!.width / 2)), 'centered on the panel').toBeLessThanOrEqual(2);
      await back.click();
      await expect(page.getByRole('radiogroup', { name: 'In Bean Conqueror' })).toBeVisible();
      await expect(page.locator('.filter-chip')).toHaveCount(0);
      expect(page.url()).toBe(url);
    }
  },
  {
    // Moonwake has a seeded default and no own image: the form previews it.
    name: 'coffee-edit-roaster-default-preview',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByText('Roaster default', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Set as roaster default' })).toBeDisabled();
      await expectContained(page.locator('.default-preview img'), NEUTRAL);
    }
  },
  {
    // The image row with all three buttons, then marked: the button is the cue.
    // Nothing is saved (shared DB); Discard changes closes the form unsaved.
    name: 'coffee-edit-set-roaster-default', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await expect(page.getByText('Roaster default', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      const marked = page.getByRole('button', { name: 'Will be set as default' });
      await expect(marked).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveValue('1');
    }
  },
  {
    // Discard is the undo: reopening the form after Discard changes shows no mark.
    name: 'coffee-edit-roaster-default-discarded', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      await page.getByRole('button', { name: 'Discard changes' }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveCount(0);
      await expect(page.getByText('Roaster default', { exact: true })).toBeVisible();
    }
  },
  {
    // Clearing the image by typing drops the mark; retyping must not revive it.
    name: 'coffee-edit-roaster-default-cleared-by-typing', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#image_url').fill('https://img.example/moonwake-bag.png');
      await page.getByRole('button', { name: 'Set as roaster default' }).click();
      await page.locator('#image_url').fill('');
      await page.locator('#image_url').fill('https://img.example/other.png');
      const btn = page.getByRole('button', { name: 'Set as roaster default' });
      await expect(btn).toBeEnabled();
      await expect(btn).not.toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('input[name="set_roaster_default"]')).toHaveCount(0);
    }
  },
  {
    name: 'coffee-edit-suggest-searching',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, null);
      await expect(dlg(page).getByRole('status').filter({ hasText: 'Searching…' })).toBeVisible();
      await expectDialogInViewport(page);
      await expect(page.getByRole('button', { name: 'Suggest', exact: true })).toBeDisabled();
    }
  },
  {
    name: 'coffee-edit-suggest-list',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply(SUGGEST_OK));
      const d = dlg(page);
      await expect(d.getByRole('heading', { name: 'Suggested images' })).toBeVisible();
      await expect(d.locator('.suggest-pick')).toHaveCount(6);
      await expect(d.getByText('Searching moonwake.example ·')).toBeVisible();
      await expect(d.getByText('tavily unavailable (rate limited)')).toBeVisible();
      for (const img of await d.locator('.suggest-pick img').all()) await expectContained(img, NEUTRAL);
      await expect(d.getByRole('button', { name: 'Retry' })).toHaveCount(0);
      // Only the closest candidate carries the badge; dates show where known.
      await expect(d.locator('.badge')).toHaveCount(1);
      // The coffee being matched sits above the body, all parts present.
      const roastDate = await page.locator('#roast_date').inputValue();
      await expect(d.locator('.suggest-matching > *')).toHaveText(['Moonwake · Ethiopia Bensa Bombe', `Washed · Roasted ${roastDate}`]);
      // Sunflower badge: AA contrast (>= 4.5) in light and in dark.
      const contrast = () => d.locator('.badge').evaluate((el) => {
        const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const st = getComputedStyle(el);
        if (/rgba/.test(st.backgroundColor)) return 0; // not opaque
        const [a, b] = [lum(rgb(st.backgroundColor)), lum(rgb(st.color))].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      });
      expect(await contrast()).toBeGreaterThanOrEqual(4.5);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      expect(await contrast()).toBeGreaterThanOrEqual(4.5);
      await page.evaluate(() => delete document.documentElement.dataset.theme);
      await expect(d.locator('.suggest-pick').nth(0).getByText('Closest to roast date', { exact: true })).toBeVisible();
      await expect(d.locator('.suggest-pick').nth(0)).toContainText('moonwake.example · 2026-09-20');
      await expect(d.locator('.suggest-pick').nth(2)).not.toContainText('·');
      // The long excerpt is clamped to four lines.
      const ex = d.locator('.suggest-pick').nth(0).locator('.suggest-excerpt');
      const clamp = await ex.evaluate((el) => ({ h: el.clientHeight, full: el.scrollHeight, line: parseFloat(getComputedStyle(el).lineHeight) }));
      expect(clamp.full).toBeGreaterThan(clamp.h);
      expect(clamp.h).toBeGreaterThan(3 * clamp.line);
      expect(clamp.h).toBeLessThanOrEqual(4 * clamp.line + 1);
      // The bag art is big enough to read the label (user, 2026-10-06).
      if (['phone-portrait', 'w1280'].includes(test.info().project.name)) {
        const img = await d.locator('.suggest-pick img').nth(0).boundingBox();
        expect(img!.height).toBeGreaterThanOrEqual(200);
      }
      // Square image boxes, the saved thumbnail's shape, spanning the card
      // (capped and centered only on the 333px-tall landscape phone); the
      // image fills the box (contained, checked above). The badge sits over
      // the image's top-left corner.
      const box = await d.locator('.suggest-pick').nth(0).evaluate((el) => {
        const r = (e: Element) => e.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const card = r(el);
        const content = card.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
        const b = r(el.querySelector('.suggest-image')!);
        const img = r(el.querySelector('img')!);
        const badge = r(el.querySelector('.badge')!);
        return {
          w: b.width, h: b.height, content, centered: Math.abs(b.left - card.left - (card.right - b.right)),
          fills: Math.abs(img.width - b.width) <= 1 && Math.abs(img.height - b.height) <= 1,
          badgeInside: badge.left >= b.left && badge.top >= b.top && badge.right <= b.right && badge.bottom <= b.bottom,
          badgeTopLeft: badge.left - b.left < 16 && badge.top - b.top < 16
        };
      });
      expect(Math.abs(box.w - box.h)).toBeLessThanOrEqual(1);
      expect(box.fills).toBe(true);
      expect(box.badgeInside).toBe(true);
      expect(box.badgeTopLeft).toBe(true);
      expect(box.centered).toBeLessThanOrEqual(1);
      if (test.info().project.name !== 'phone-landscape') expect(Math.abs(box.w - box.content)).toBeLessThanOrEqual(1);
      await expect(d.locator('.suggest-excerpt')).toHaveCount(3);
      await expectDialogInViewport(page);
    }
  },
  {
    name: 'coffee-edit-suggest-summary', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply(SUGGEST_OK), '');
      const roastDate = await page.locator('#roast_date').inputValue();
      const m = dlg(page).locator('.suggest-matching');
      // Two lines at every width (user, 2026-10-06): roaster · coffee, then
      // processing · roast date. Processing cleared: no dangling separator.
      await expect(m.locator('> *')).toHaveText(['Moonwake · Ethiopia Bensa Bombe', `Roasted ${roastDate}`]);
      const tops = await m.locator('> *').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
      expect(tops[1]).toBeGreaterThan(tops[0]);
      // Fixed above the scrolling body, not inside it.
      expect(await m.evaluate((el) => !!el.closest('.suggest-body'))).toBe(false);
      // Easy to spot (user feedback 2026-10-06): line 1 bold, at least body size.
      const font = await m.locator('> *').first().evaluate((el) => { const st = getComputedStyle(el); return { w: Number(st.fontWeight), px: parseFloat(st.fontSize) }; });
      expect(font.w).toBeGreaterThanOrEqual(600);
      expect(font.px).toBeGreaterThanOrEqual(16);
      // No processing and no roast date: line 2 is left out.
      await page.keyboard.press('Escape');
      await expect(dlg(page)).toHaveCount(0);
      await page.locator('#roast_date').fill('');
      await page.getByRole('button', { name: 'Suggest', exact: true }).click();
      await expect(m.locator('> *')).toHaveText(['Moonwake · Ethiopia Bensa Bombe']);
    }
  },
  {
    name: 'coffee-edit-suggest-empty', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply({ status: 'empty', site: SITE, storedSite: SITE, candidates: [], notes: [] }));
      await expect(dlg(page).getByText('No images found on moonwake.example')).toBeVisible();
      await expect(dlg(page).getByRole('button', { name: 'None of these' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    }
  },
  {
    name: 'coffee-edit-suggest-failed',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply({ status: 'failed', site: null, storedSite: null, candidates: [], notes: ['shopify unavailable (HTTP 503)', 'tavily unavailable (bad API key)'] }));
      await expect(dlg(page).getByText('Search failed', { exact: true })).toBeVisible();
      await expectDialogInViewport(page);
      await expect(page.getByText('tavily unavailable (bad API key)')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    }
  },
  {
    name: 'coffee-edit-suggest-request-failed', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply({ message: 'Internal Error' }, 500));
      await expect(dlg(page).getByText('Search failed', { exact: true })).toBeVisible();
      await expect(page.getByText('Internal Error')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    }
  },
  {
    name: 'coffee-edit-suggest-unconfigured',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply({ status: 'unconfigured', site: null, storedSite: null, candidates: [], notes: ['No roaster site to search and no web search key (TAVILY_API_KEY)'] }));
      const d = dlg(page);
      await expect(d.getByText("Image search isn't set up")).toBeVisible();
      await expect(d.getByText('No roaster site to search and no web search key (TAVILY_API_KEY)')).toBeVisible();
      await d.getByRole('button', { name: 'set roaster site' }).click();
      await expect(d.getByRole('textbox', { name: 'Roaster website' })).toBeVisible();
      await expectDialogInViewport(page);
    }
  },
  {
    // A pick on the roaster's own site with none stored: image + empty product
    // URL filled + the site staged; the list closes.
    name: 'coffee-edit-suggest-picked', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply(SUGGEST_UNSTORED));
      await page.locator('.suggest-pick').nth(0).click();
      await expect(page.locator('#image_url')).toHaveValue(SUGGEST_OK.candidates[0].image);
      await expect(page.locator('#product_url')).toHaveValue(SUGGEST_OK.candidates[0].pageUrl);
      await expect(page.locator('input[name="roaster_website"]')).toHaveValue(SITE);
      await expect(dlg(page)).toHaveCount(0);
      await expect(page.getByRole('img', { name: 'Preview', exact: true })).toBeVisible();
    }
  },
  {
    // Discard is the undo for a staged website too.
    name: 'coffee-edit-suggest-picked-discarded', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply(SUGGEST_UNSTORED));
      await page.locator('.suggest-pick').nth(0).click();
      await expect(page.locator('input[name="roaster_website"]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Discard changes' }).click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.locator('input[name="roaster_website"]')).toHaveCount(0);
    }
  },
  {
    // Enter in the site box reruns Suggest with that site; the form is not
    // submitted. A working search on the typed site stages it (as the
    // endpoint normalized it), and a later pick never replaces it.
    name: 'coffee-edit-suggest-change-site', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      const sites: unknown[] = [];
      await openSuggest(page, async (route) => {
        const site = route.request().postDataJSON().site;
        sites.push(site);
        await route.fulfill({ json: site ? { ...SUGGEST_UNSTORED, site: 'https://moonwake.coffee' } : SUGGEST_UNSTORED });
      });
      await expect(page.locator('input[name="roaster_website"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'change', exact: true }).click();
      const box = page.getByRole('textbox', { name: 'Roaster website' });
      await box.fill('moonwake.coffee');
      await box.press('Enter');
      await expect.poll(() => sites).toEqual([undefined, 'moonwake.coffee']);
      await expect(page.locator('#image_url')).toBeVisible();
      await expect(page.locator('.suggest-pick')).toHaveCount(6);
      await expect(page.locator('input[name="roaster_website"]')).toHaveValue('https://moonwake.coffee');
      // A pick on a host that matches the roaster name (moonwake.example) must
      // not replace the site "change" staged.
      await page.locator('.suggest-pick').nth(0).click();
      await expect(page.locator('input[name="roaster_website"]')).toHaveValue('https://moonwake.coffee');
    }
  },
  {
    // Esc (and on wide screens a backdrop click) closes the dialog and stages
    // nothing; focus goes back to Suggest.
    name: 'coffee-edit-suggest-closed', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await openSuggest(page, reply(SUGGEST_UNSTORED));
      await expect(dlg(page).locator('.suggest-pick')).toHaveCount(6);
      const before = await page.locator('#image_url').inputValue();
      await page.keyboard.press('Escape');
      await expect(dlg(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Suggest', exact: true })).toBeFocused();
      if ((page.viewportSize()?.width ?? 0) > 640) {
        await page.getByRole('button', { name: 'Suggest', exact: true }).click();
        await expect(dlg(page).locator('.suggest-pick')).toHaveCount(6);
        await page.mouse.click(4, 4);
        await expect(dlg(page)).toHaveCount(0);
      }
      await expect(page.locator('#image_url')).toHaveValue(before);
      await expect(page.locator('input[name="roaster_website"]')).toHaveCount(0);
      await expect(page.locator('#product_url')).toHaveValue('');
    }
  },
  {
    // The user's repro: Suggest from a card's own inline edit on /coffees opens
    // the same dialog; a pick stages image_url in that card's form (unsaved).
    name: 'coffees-cards-inline-edit-suggest',
    path: () => '/coffees?status=all&view=cards',
    act: async (page) => {
      // Nothing saves: no POST except the stubbed suggest and the image-fill probe.
      const posts: string[] = [];
      page.on('request', (r) => r.method() === 'POST' && !/image-(suggest|fill)/.test(r.url()) && posts.push(r.url()));
      await page.route('**/api/coffees/image-suggest', reply(SUGGEST_UNSTORED));
      await openSoloEdit(page, 'cards', 'Ethiopia Bensa Bombe');
      await page.getByRole('button', { name: 'Suggest', exact: true }).click();
      await expect(dlg(page).locator('.suggest-pick')).toHaveCount(6);
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
      await expectDialogInViewport(page);
      await dlg(page).locator('.suggest-pick').nth(0).click();
      await expect(dlg(page)).toHaveCount(0);
      await expect(page.locator('form #image_url')).toHaveValue(SUGGEST_OK.candidates[0].image);
      await expect(page.getByRole('img', { name: 'Preview', exact: true })).toBeVisible();
      expect(posts).toEqual([]);
    }
  },
  {
    // Esc while still "Searching…" (Suggest disabled): focus still returns to
    // Suggest, and the reply that lands later stages nothing.
    name: 'coffee-edit-suggest-closed-searching', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      let release = () => {};
      const replied = new Promise<void>((r) => (release = r));
      await openSuggest(page, async (route) => {
        await replied;
        await route.fulfill({ json: SUGGEST_UNSTORED });
      });
      await expect(dlg(page).getByRole('status').filter({ hasText: 'Searching…' })).toBeVisible();
      const before = await page.locator('#image_url').inputValue();
      await page.keyboard.press('Escape');
      await expect(dlg(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Suggest', exact: true })).toBeFocused();
      release();
      await page.waitForTimeout(300);
      await expect(dlg(page)).toHaveCount(0);
      await expect(page.locator('#image_url')).toHaveValue(before);
      await expect(page.locator('#product_url')).toHaveValue('');
      await expect(page.locator('input[name="roaster_website"]')).toHaveCount(0);
    }
  },
  {
    name: 'coffee-edit-suggest-disabled', viewports: 'two',
    path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Suggest', exact: true })).toBeEnabled();
      await page.locator('#coffee_name').fill('');
      await expect(page.getByRole('button', { name: 'Suggest', exact: true })).toBeDisabled();
    }
  },
  ...(['cards', 'list', 'compact'] as const).map((view) => ({
    name: `coffees-${view}-inline-edit-actions`,
    path: () => `/coffees?status=all&view=${view}`,
    act: async (page: Page) => {
      await openSoloEdit(page, view, 'Colombia Pink Bourbon');
      await expectActionsUnderForm(page);
    }
  })),
  ...(['cards', 'list', 'compact'] as const).map((view) => ({
    name: `coffees-${view}-inline-edit-action-row`,
    path: () => `/coffees?status=backlog&view=${view}`,
    act: async (page: Page, s: Seed) => {
      await openSoloEdit(page, view, s.names.everyAction);
      await page.getByRole('button', { name: 'Save', exact: true }).scrollIntoViewIfNeeded();
      await expectActionRow(page);
    }
  })),
  {
    // User choice 2026-10-06: the cards grid tops out at three per row on
    // desktop (a cramped 4th column made inline edit unusable); phones unchanged.
    name: 'coffees-cards-three-per-row',
    path: () => '/coffees?status=all&view=cards',
    act: async (page: Page) => {
      const cols = await page.locator('section.grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
      expect(cols).toBeLessThanOrEqual(3);
      const want: Record<string, number> = { w1280: 3, 'phone-landscape': 3, w768: 2, w480: 1, 'phone-portrait': 1 };
      if (want[test.info().project.name]) expect(cols).toBe(want[test.info().project.name]);
    }
  },
  {
    name: 'coffees-cards-inline-edit-aligned',
    path: () => '/coffees?status=all&view=cards',
    act: async (page: Page) => {
      await openSoloEdit(page, 'cards', 'Colombia Pink Bourbon');
      await expectFieldRowsAligned(page);
    }
  },
  {
    name: 'coffee-edit-aligned',
    path: (s: Seed) => `/coffees/${s.slugs.frozen}`,
    act: async (page: Page) => {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await expectFieldRowsAligned(page);
    }
  },
  {
    // User bug 2026-10-06: card A closed with pending edits (via Update in
    // toolbar Edit mode) keeps its action set; its icons must keep the same
    // sizes and layout, not shrink to a small grid.
    name: 'coffees-cards-inline-edit-switch',
    path: () => '/coffees?status=backlog&view=cards',
    act: async (page: Page, s: Seed) => {
      const posts: string[] = [];
      page.on('request', (r) => r.method() === 'POST' && posts.push(r.url()));
      const a = page.locator('.card').filter({ hasText: s.names.everyAction });
      await a.evaluate((el) => (el.dataset.probe = 'a')); // the card element survives the form swap
      await page.locator('.search-row').getByRole('button', { name: 'Edit', exact: true }).click();
      await a.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('form #processing').fill('Honey');
      const icons = () => page.locator('[data-probe="a"]').evaluate((card) => {
        const bs = [...card.querySelectorAll('.action-stack button')].map((b) => b.getBoundingClientRect());
        const left = card.getBoundingClientRect().left;
        return bs.map((b) => [b.width, b.height, b.left - left, b.top - bs[0].top].map(Math.round));
      });
      const before = await icons();
      expect(before.length).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(page.locator('[data-probe="a"] form')).toHaveCount(0);
      const after = await icons();
      for (const [i, b] of before.entries()) after[i].forEach((v, j) => expect(Math.abs(v - b[j]), `icon ${i} ${['width', 'height', 'left', 'top'][j]} ${b[j]} -> ${v}`).toBeLessThanOrEqual(1));
      expect(posts).toEqual([]);
    }
  },
  ...(['cards', 'list', 'compact'] as const).map((view) => ({
    // User ask 2026-10-06: opening B's inline edit keeps A's form (and what was
    // typed in it) open until A's own Save/Cancel.
    name: `coffees-${view}-inline-edit-two-open`,
    path: () => `/coffees?status=all&view=${view}`,
    act: async (page: Page, s: Seed) => {
      const posts: string[] = [];
      page.on('request', (r) => r.method() === 'POST' && !/image-fill/.test(r.url()) && posts.push(r.url())); // image-fill: the read-only probe
      await openSoloEdit(page, view, s.names.everyAction);
      await page.locator('form #processing').fill('Honey');
      await openSoloEdit(page, view, 'Colombia Pink Bourbon');
      const processing = page.locator('form #processing');
      await expect(processing).toHaveCount(2);
      expect((await processing.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).filter((v) => v === 'Honey')).toHaveLength(1);
      expect(posts).toEqual([]);
    }
  })),
  // Keyword name color (src/lib/nameColor.ts): the seed's "Colombia La Palma Skipper" in --color-skip on every surface.
  { name: 'skip-name-coffees-cards', viewports: 'two', path: () => '/coffees?status=archive&view=cards', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffees-list', viewports: 'two', path: () => '/coffees?status=archive&view=list', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffees-compact', viewports: 'two', path: () => '/coffees?status=archive&view=compact', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffee-detail', viewports: 'two', path: (s) => `/coffees/${s.slugs.skip}`, act: (page) => expectSkipColored(page, 2) },
  {
    // A coffees board row, and its value tip's title (TipBody).
    name: 'skip-name-insights-leaderboards', viewports: 'two',
    path: () => '/stats?tab=leaderboards&range=all&open=coffees',
    act: async (page) => {
      const row = page.locator('[data-board="coffees"] .board-row').filter({ hasText: 'Skipper' }).first();
      await expect(row.locator('.coffee-name')).toBeVisible();
      const tip = row.locator('.text-tip');
      if (await tip.count()) {
        await tip.click();
        await expect(page.locator('.float-tip .coffee-name')).toBeVisible();
      }
      await expectSkipColored(page, 1);
    }
  },
  // Holder labels, tie lists and the full-text tip (Records); server-built feed lines (Milestones).
  { name: 'skip-name-insights-records', viewports: 'two', path: () => '/stats?tab=records&range=all', act: (page) => expectSkipColored(page, 1) },
  { name: 'skip-name-insights-milestones', viewports: 'two', path: () => '/stats?tab=milestones&range=all', act: (page) => expectSkipColored(page, 1) },
  // ---- Peer review B (2026-10-19) ----
  // M2: the top navbar's first link lines up with the page content's left edge (the tab bar replaces it at <= 640px).
  ...['/stats?tab=habits'].map((path): State => ({
    name: `nav-aligned${path.replace(/[^a-z]+/g, '-')}`, path: () => path,
    act: async (page) => {
      if (page.viewportSize()!.width <= 640) return;
      const nav = (await page.locator('nav.site-nav .nav-links a').first().boundingBox())!.x;
      const main = await page.locator('main.container').evaluate((el) => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft));
      expect(Math.abs(nav - main), 'nav link left vs content left').toBeLessThanOrEqual(1);
    }
  })),
  // M1: each tab's own controls sit in the sticky filter bar and stay pinned inside it while scrolling.
  ...([['leaderboards', 'Rank by'], ['habits', 'Measure'], ['consumption', 'Group by'], ['milestones', 'Kinds'], ['sweetspots', 'Bag']] as const).map(([tab, label]): State => ({
    name: `insights-tab-controls-${tab}`, path: () => `/stats?tab=${tab}&range=all`,
    act: async (page) => {
      const ctl = page.locator('.filter-bar .tab-controls').getByRole(tab === 'habits' || tab === 'consumption' || tab === 'milestones' ? 'group' : 'combobox', { name: label });
      await expect(ctl).toBeVisible();
      if (await phoneBar(page)) {
        // the short row has no tab controls: expanded, they are inside the overlay
        await scrollPastBar(page);
        await expandBar(page);
        await expect(page.locator('.cbar.overlay').getByRole(tab === 'habits' || tab === 'consumption' || tab === 'milestones' ? 'group' : 'combobox', { name: label })).toBeInViewport();
        await expect(page.locator('.rail-main > .rank-bar, .rail-main > .insights-bar, .rail-main > .kinds-bar')).toHaveCount(0);
        return;
      }
      await page.evaluate(() => (document.documentElement.style.paddingBottom = '200vh'));
      await page.evaluate(() => scrollTo(0, 700));
      await frames(page);
      const bar = (await page.locator('.filter-bar').boundingBox())!, c = (await ctl.boundingBox())!;
      expect(Math.abs(bar.y)).toBeLessThanOrEqual(1);
      expect(c.y).toBeGreaterThanOrEqual(bar.y - 1);
      expect(c.y + c.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
      // Nothing of the tab's bar is left inline in the page below the sticky bar.
      await expect(page.locator('.rail-main > .rank-bar, .rail-main > .insights-bar, .rail-main > .kinds-bar')).toHaveCount(0);
    }
  })),
  // S2: a two-column list reads row by row (1 left, 2 right, 3 under 1); one column on phones.
  { name: 'insights-records-top-rowwise', path: () => '/stats?tab=records&range=all&top=20',
    act: async (page) => {
      // Show less sits left of Show more (was insights-records-top20).
      const foot = page.locator('#records-top-brews ~ .top-foot');
      const [less, more] = await Promise.all(['Show less', 'Show more'].map((n) => foot.getByRole('button', { name: n }).boundingBox()));
      expect(less!.x).toBeLessThan(more!.x);
      const li = page.locator('#records-top-brews + ol li');
      await expect(li).not.toHaveCount(10);
      const [a, b, c] = await Promise.all([0, 1, 2].map((i) => li.nth(i).boundingBox()));
      if (page.viewportSize()!.width > 640) {
        expect(Math.abs(a!.y - b!.y)).toBeLessThanOrEqual(1);
        expect(b!.x).toBeGreaterThan(a!.x);
        expect(c!.y).toBeGreaterThan(a!.y + 10);
        expect(Math.abs(c!.x - a!.x)).toBeLessThanOrEqual(1);
      } else {
        expect(b!.y).toBeGreaterThan(a!.y + 10);
        expect(Math.abs(b!.x - a!.x)).toBeLessThanOrEqual(1);
      }
    } },
  // M3: Show more scrolls the Show less / Show more buttons' bottom to the screen's bottom; Show less does the same.
  { name: 'insights-records-show-more-scroll', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const lift = () => page.evaluate(() => { const t = document.querySelector('.bottom-tabs'); return t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect().height : 0; });
      const gap = () => foot.getByRole('button').last().evaluate((el) => innerHeight - el.getBoundingClientRect().bottom); // the last button in the footer
      const foot = page.locator('#records-top-brews ~ .top-foot');
      await foot.scrollIntoViewIfNeeded();
      const click = async (name: string) => { await foot.evaluate((el) => el.scrollIntoView({ block: 'center' })); const b = (await foot.getByRole('button', { name }).boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
      await click('Show more');
      await expect(page).toHaveURL(/top=20/);
      const l = await lift();
      await expectClearOfBackToTop(page, foot.getByRole('button').last());
      // With Back to top showing the button lands above it (8px gap), else at the screen bottom above the tab bar.
      const bttUp = async () => ((await page.getByRole('button', { name: 'Back to top' }).count()) ? 64 : 0);
      await expect.poll(async () => Math.abs((await gap()) - l - (await bttUp()))).toBeLessThanOrEqual(2);
      await click('Show less');
      await expect(page).not.toHaveURL(/top=/);
      await expectClearOfBackToTop(page, foot.getByRole('button').last());
      await expect.poll(async () => Math.abs((await gap()) - l - (await bttUp()))).toBeLessThanOrEqual(2);
    } },
  // M4: Back to top appears after a screenful of scrolling, bottom right (above the phone tab bar), and returns to the top.
  { name: 'back-to-top', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const btn = page.getByRole('button', { name: 'Back to top' });
      await expect(btn).toHaveCount(0);
      await page.evaluate(() => scrollTo(0, innerHeight * 2));
      await expect(btn).toBeVisible();
      const [b, vp, tabs] = await Promise.all([btn.boundingBox(), page.evaluate(() => [innerWidth, innerHeight]), page.evaluate(() => { const t = document.querySelector('.bottom-tabs'); return t && getComputedStyle(t).display !== 'none' ? t.getBoundingClientRect().top : null; })]);
      expect(b!.width).toBeGreaterThanOrEqual(44);
      expect(b!.height).toBeGreaterThanOrEqual(44);
      expect(vp[0] - (b!.x + b!.width), 'right gap').toBeLessThanOrEqual(24);
      expect((tabs ?? vp[1]) - (b!.y + b!.height), 'clear of the tab bar').toBeGreaterThanOrEqual(0);
      await btn.click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await expect(btn).toHaveCount(0);
    } },

  // Every tab leads to every other: switching from each tab to the next in a ring changes the page content, not just the URL
  // (a tab's bar once threw on the new tab's null data and froze the swap on Consumption).
  { name: 'insights-tab-switch-ring', viewports: 'two', path: () => '/stats?range=all',
    act: async (page) => {
      const tabs = ['overview', 'leaderboards', 'habits', 'consumption', 'records', 'milestones', 'insights', 'sweetspots', 'brewing', 'water', 'gear', 'consumption', 'records', 'overview'];
      const body = () => page.locator('.rail-main').evaluate((el) => [...el.children].filter((c) => !c.matches('.filter-bar, .toolbar, .chart-note, dialog, .cbar, .cbar-mini')).map((c) => (c as HTMLElement).innerText).join('|').slice(0, 4000));
      let before = await body();
      for (const t of tabs.slice(1)) {
        await page.getByRole('combobox', { name: 'View', exact: true }).selectOption(t);
        await expect(page).toHaveURL(new RegExp(`tab=${t}`));
        await expect.poll(body, { message: `content after switching to ${t}` }).not.toBe(before);
        before = await body();
      }
    } },
  // The collapsible bar on /stats (docs/superpowers/specs/2026-10-24-insights-collapsible-bar-design.md): desktop pins only
  // the controls; a phone gets the short row once the block is scrolled past, and the expanded overlay with its pull tab.
  ...INSIGHTS_TABS.map((tab) => ({ name: `insights-cbar-${tab}`, path: () => `/stats?tab=${tab}&range=all`, act: (page: Page) => cbarAct(page) })),
  { name: 'insights-cbar-chips', path: () => '/stats?tab=records&range=all&roast=Light&process=Washed&origin=Ethiopia&roaster=The%20Picky%20Chemist&caffeine=all',
    act: (page) => cbarAct(page, 5) },
  { name: 'insights-cbar-custom', path: () => `/stats?range=${iso(-120)}..${iso(-30)}&compare=${iso(-240)}..${iso(-150)}`, act: (page) => cbarAct(page) },
  // Staying open: every change inside the expanded bar keeps it open, the spacer follows its height, a closed dialog
  // returns focus into it; the pull tab and the short row's button work from the keyboard.
  { name: 'insights-cbar-stays-open', path: () => '/stats?tab=habits&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      const overlay = await expandBar(page);
      const combo = (name: string) => overlay.getByRole('combobox', { name, exact: true });
      const check = async (url: RegExp | null, dialog = false) => {
        if (url) await expect(page).toHaveURL(url);
        await expect(overlay).toBeVisible();
        await expectSpacerMatchesBody(page);
        if (dialog) await expect.poll(() => overlay.evaluate((el) => el.contains(document.activeElement)), { message: 'focus back in the bar' }).toBe(true);
      };
      await combo('Period').selectOption('3m');
      await check(/range=3m/);
      await combo('View').selectOption('consumption');
      await check(/tab=consumption/);
      const first = await combo('Compare').evaluate((s: HTMLSelectElement) => [...s.options].map((o) => o.value).find((v) => v !== '0' && v !== 'custom')!);
      await combo('Compare').selectOption(first);
      await check(/compare=/);
      await overlay.getByRole('button', { name: /^Filters/ }).click();
      const filters = page.getByRole('dialog', { name: 'Filters' });
      const roast = filters.getByRole('combobox', { name: 'Roast level' });
      await roast.selectOption(await roast.evaluate((s: HTMLSelectElement) => [...s.options].map((o) => o.value).find((v) => v)!));
      await filters.getByRole('button', { name: 'Apply' }).click();
      await expect(filters).toHaveCount(0);
      await check(/roast=/, true);
      // the Group by control (a tab control) is on Consumption, so it goes before leaving the tab
      const by = overlay.getByRole('group', { name: 'Group by' }).locator('button[aria-pressed="false"]:not([aria-disabled="true"])').first();
      const url = page.url();
      await by.click();
      await expect.poll(() => page.url()).not.toBe(url);
      await check(null);
      await combo('View').selectOption('records');
      await check(/tab=records/);
      await overlay.getByRole('button', { name: /^Ratings and brews/ }).click();
      await page.locator('#switch-menu').getByRole('button', { name: 'All ratings' }).click();
      await check(/ratings=all/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#switch-menu:popover-open')).toHaveCount(0);
      await check(null);
      await combo('Period').selectOption('custom');
      const dates = page.getByRole('dialog', { name: 'Custom range' });
      await expect(dates).toBeVisible();
      await dates.getByRole('button', { name: 'Apply' }).click();
      await expect(dates).toHaveCount(0);
      await check(/range=\d{4}-\d\d-\d\d\.\.\d{4}-\d\d-\d\d/, true);
      await overlay.getByRole('button', { name: 'Reset' }).click();
      await check(/\/stats\?tab=records$/);
      await page.locator('.cbar-pull').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Show controls' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('.cbar-pull')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Show controls' })).toBeFocused();
    } },
  // A Jump to chip in the expanded bar folds it and lands the section just under the short row (or the page ends first).
  { name: 'insights-cbar-jump-folds', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      const overlay = await expandBar(page);
      const jump = overlay.locator('.board-jump a').nth(1);
      const id = (await jump.getAttribute('href'))!.slice(1);
      await jump.click();
      await expect(page.locator('.cbar.overlay')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect.poll(async () => {
        const [top, pinned, atEnd] = await Promise.all([
          page.evaluate((i) => document.getElementById(i)!.getBoundingClientRect().top, id), pinnedBottomOf(page),
          page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1)
        ]);
        return top - pinned >= -1 && (atEnd || top - pinned <= 16);
      }, { message: 'section lands under the short row' }).toBe(true);
    } },
  { name: 'insights-cbar-top-folds', viewports: 'two', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      await expandBar(page);
      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.locator('.cbar.overlay')).toHaveCount(0);
      await expect(page.locator('.cbar-mini')).toHaveCount(0);
    } },
  // Turning the phone while expanded keeps the bar (and its pull tab) while it is still phone mode; desktop width folds it.
  { name: 'insights-cbar-rotate', viewports: 'two', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      test.skip(!isPhone(page), 'the collapse is a phone feature');
      const [w, h] = [page.viewportSize()!.width, page.viewportSize()!.height];
      await scrollPastBar(page);
      await expandBar(page);
      await page.setViewportSize({ width: 1003, height: 333 });
      await frames(page);
      await expect(page.locator('.cbar.overlay')).toBeVisible();
      await expectPullTab(page);
      await page.setViewportSize({ width: w, height: h });
      await frames(page);
      await expect(page.locator('.cbar.overlay')).toBeVisible();
      await expectPullTab(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await frames(page);
      await expect(page.locator('.cbar.overlay')).toHaveCount(0);
      await expect(page.locator('.cbar-mini')).toHaveCount(0);
      await scrollPastBar(page);
      expect(Math.abs((await page.locator('.filter-bar').boundingBox())!.y), 'controls pinned at desktop width').toBeLessThanOrEqual(1);
    } },
  // An overlay taller than the screen scrolls inside; the pull tab stays at its visible bottom-right, clear of the last row.
  { name: 'insights-cbar-overlay-scroll', path: () => '/stats?tab=brewing&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      await expandBar(page);
      const scroller = page.locator('.cbar-scroll');
      if (!(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight + 1))) return;
      await expectPullTab(page);
      const pull = page.locator('.cbar-pull');
      const before = (await pull.boundingBox())!;
      await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight));
      await frames(page);
      const [last, tab] = [(await page.locator('.cbar.overlay .board-jump a').last().boundingBox())!, (await pull.boundingBox())!];
      expect(last.y + last.height, 'last chip above the pull tab').toBeLessThanOrEqual(tab.y + 1);
      expect(last.y + last.height, 'last chip in the viewport').toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(Math.abs(tab.x - before.x) <= 1 && Math.abs(tab.y - before.y) <= 1, 'pull tab stays put').toBe(true);
    } },
  // Back to top stays visible and tappable while the bar is expanded (behind the overlay and pull tab where they meet);
  // a tap folds the bar and ends at the normal block at the top. The pull tab stays tappable where they overlapped (w360 consumption).
  { name: 'insights-cbar-back-to-top', viewports: 'two', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      await expandBar(page);
      const btt = page.getByRole('button', { name: 'Back to top' });
      await expect(btt).toBeVisible();
      const hit = (sel: string) => page.evaluate((sel) => {
        const el = document.querySelector(sel)!, r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !!top && (el === top || el.contains(top));
      }, sel);
      const [b, o, pull] = await Promise.all([btt.boundingBox(), page.locator('.cbar.overlay').boundingBox(), page.locator('.cbar-pull').boundingBox()]);
      const meets = (r: { x: number; y: number; width: number; height: number }) => b!.x < r.x + r.width && b!.x + b!.width > r.x && b!.y < r.y + r.height && b!.y + b!.height > r.y;
      if (!meets(o!) && !meets(pull!)) expect(await hit('.back-to-top'), 'Back to top is on top where nothing overlaps it').toBe(true);
      expect(await hit('.cbar-pull'), 'the pull tab wins its own tap').toBe(true);
      if (await tapBackToTop(page)) await expectAtTopFolded(page);
    } },
  { name: 'insights-cbar-back-to-top-tap', viewports: 'two', path: () => '/stats?tab=consumption&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      await expandBar(page);
      const btt = page.getByRole('button', { name: 'Back to top' });
      await expect(btt).toBeVisible();
      // w360 consumption: the overlay reaches the button; whichever spot is free is tapped, and the overlay always wins its own area.
      const pull = (await page.locator('.cbar-pull').boundingBox())!;
      expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.cbar-pull'), [pull.x + pull.width / 2, pull.y + pull.height / 2])).toBe(true);
      if (await tapBackToTop(page)) await expectAtTopFolded(page);
    } },
  // The Ratings and brews popover opens under its button and closes when the overlay scrolls under it.
  { name: 'insights-cbar-ratings-menu', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      const overlay = await expandBar(page);
      const button = overlay.getByRole('button', { name: /^Ratings and brews/ });
      await button.click();
      const menu = page.locator('#switch-menu:popover-open');
      await expect(menu).toBeVisible();
      expect((await menu.boundingBox())!.y).toBeGreaterThanOrEqual((await button.boundingBox())!.y + (await button.boundingBox())!.height - 1);
      await page.locator('.cbar-scroll').dispatchEvent('scroll');
      await expect(menu).toHaveCount(0);
      await expect(overlay).toBeVisible();
    } },
  // A tip in the expanded bar opens in view, over the bar's own controls (inBar).
  { name: 'insights-cbar-tip', path: () => '/stats?range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await scrollPastBar(page);
      const overlay = await expandBar(page);
      await overlay.getByRole('button', { name: 'Household' }).focus();
      await page.keyboard.press('Tab');
      await expect(overlay.getByRole('button', { name: 'Per person' })).toBeFocused();
      await expectTipInView(page, page.locator('.cell-tip:popover-open'), { inBar: true });
    } },
  // Milestones' sticky ruler sits under what is pinned: the short row on a phone (not the overlay), the controls on desktop.
  { name: 'insights-cbar-milestones-bar-h', path: () => '/stats?tab=milestones&range=all',
    act: async (page) => {
      await scrollPastBar(page);
      const barH = () => page.locator('.timeline').evaluate((el) => parseFloat(el.style.getPropertyValue('--bar-h')));
      if (!isPhone(page)) {
        expect(Math.abs((await barH()) - (await page.locator('.filter-bar').evaluate((el: HTMLElement) => el.offsetHeight)))).toBeLessThanOrEqual(1);
        return;
      }
      const mini = (await page.locator('.cbar-mini').boundingBox())!.height;
      expect(Math.abs((await barH()) - mini), '--bar-h = short row').toBeLessThanOrEqual(1);
      await expandBar(page);
      await frames(page);
      expect(Math.abs((await barH()) - mini), '--bar-h unchanged expanded').toBeLessThanOrEqual(1);
    } },
  // Review focus 1: the page shrinking under an expanded bar (a short, empty tab at the page end) folds it or keeps it, never loses it.
  { name: 'insights-cbar-short-tab', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      const errors: Error[] = [];
      page.on('pageerror', (e) => errors.push(e));
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await frames(page);
      await expandBar(page);
      // a client-side link to the empty tab (a navigation would reload the page and drop the expanded bar)
      await page.evaluate(() => {
        const a = document.createElement('a');
        a.href = '?tab=sweetspots&range=2000-01-01..2000-01-31';
        document.body.append(a);
        a.click();
      });
      await expect(page).toHaveURL(/tab=sweetspots/);
      await frames(page);
      const overlay = page.locator('.cbar.overlay');
      if (!(await overlay.count())) expect((await page.locator('.cbar').first().boundingBox())!.y, 'folded: the bar is in flow at the top').toBeGreaterThanOrEqual(-1);
      else {
        expect(Math.abs((await overlay.boundingBox())!.y), 'still open: the overlay is at the top').toBeLessThanOrEqual(1);
        await expectSpacerMatchesBody(page);
      }
      expect(errors).toEqual([]);
    } },
  // Review focus 3: a 20px root font (larger text setting) keeps a jump landing clear of the short row.
  { name: 'insights-cbar-font-scale', viewports: 'two', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await page.addInitScript(() => {
        const set = () => document.documentElement && (document.documentElement.style.fontSize = '20px');
        set();
        document.addEventListener('DOMContentLoaded', set);
      });
      await reloadReady(page);
      const jump = page.locator('.board-jump a').nth(1);
      const id = (await jump.getAttribute('href'))!.slice(1);
      await jump.click();
      await expect.poll(async () => {
        const mini = page.locator('.cbar-mini');
        if (!(await mini.count())) return false;
        const gap = (await page.evaluate((i) => document.getElementById(i)!.getBoundingClientRect().top, id)) - (await pinnedBottomOf(page));
        return gap >= -1 && gap <= 16;
      }, { message: 'jump lands under the short row at 20px text' }).toBe(true);
      const [pad, mini] = await Promise.all([
        page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)),
        page.locator('.cbar-mini').evaluate((el) => el.getBoundingClientRect().height)
      ]);
      expect(Math.abs(pad - mini), 'scroll-padding-top = short row height').toBeLessThanOrEqual(1);
    } },
  // Review focus 4: a reload restores the scroll; if that is past the block, the short row is there without scrolling again.
  { name: 'insights-cbar-restore', viewports: 'two', path: () => '/stats?tab=records&range=all',
    act: async (page) => {
      if (!isPhone(page)) return;
      await page.evaluate(() => scrollTo(0, 1500));
      await reloadReady(page);
      if (await page.evaluate(() => scrollY) > 0) await expect(page.locator('.cbar-mini')).toBeVisible();
    } },
];

// A tip a hover opens also opens on a tap (a click without touch) and stays open until a tap elsewhere, one at a time
// (ui-rules 49). `open`: a tap on the trigger, or a function that taps it; `away`: a neutral spot to tap.
const touch = () => !!test.info().project.use.hasTouch;
const tapOn = async (l: Locator) => (touch() ? l.tap() : l.click());
async function expectTapTip(page: Page, open: Locator | (() => Promise<unknown>), tip: Locator, away: Locator) {
  await (typeof open === 'function' ? open() : tapOn(open));
  await expect(tip).toBeVisible();
  await page.waitForTimeout(700);
  await expect(tip, 'still open a moment after the tap').toBeVisible();
  await tapOn(away);
  await expect(tip, 'a tap elsewhere closes it').toBeHidden();
}
// Zoomable origin map (WorldMap.svelte): `.world-map svg > g` carries the zoom/pan transform (identity when absent).
async function mapView(page: Page) {
  return page.evaluate(() => {
    const m = document.querySelector<SVGGElement>('.world-map svg > g')?.transform.baseVal.consolidate()?.matrix;
    return m ? { k: m.a, x: m.e, y: m.f } : { k: 1, x: 0, y: 0 };
  });
}
const expectZoom = (page: Page, k: number, tol = 0.01) =>
  expect.poll(async () => Math.abs((await mapView(page)).k - k) <= tol, { message: `map zoom ~${k}` }).toBe(true);
// Client px of a viewBox point (default: the center of the country's bbox), through the <g>'s CTM; it must be inside the fill.
async function mapPoint(page: Page, iso: string, at?: [number, number]): Promise<[number, number]> {
  return page.evaluate(([iso, at]) => {
    const path = document.querySelector<SVGPathElement>(`.world-map path[data-iso="${iso}"]`)!;
    const g = document.querySelector<SVGGElement>('.world-map svg > g') ?? path.ownerSVGElement!;
    const b = path.getBBox();
    const pt = path.ownerSVGElement!.createSVGPoint();
    [pt.x, pt.y] = at ?? [b.x + b.width / 2, b.y + b.height / 2];
    if (!path.isPointInFill(pt)) throw new Error(`(${pt.x},${pt.y}) is not inside ${iso}`);
    const c = pt.matrixTransform(g.getScreenCTM()!);
    return [c.x, c.y] as [number, number];
  }, [iso, at] as const);
}
// The viewBox point under a client point, plus the current screen px per viewBox unit.
async function vbAt(page: Page, cx: number, cy: number) {
  return page.evaluate(([cx, cy]) => {
    const svg = document.querySelector<SVGSVGElement>('.world-map svg')!;
    const g = svg.querySelector<SVGGElement>(':scope > g') ?? svg;
    const m = g.getScreenCTM()!;
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y, s: m.a };
  }, [cx, cy] as const);
}
const expectSameVb = (a: { x: number; y: number; s: number }, b: { x: number; y: number; s: number }) =>
  expect(Math.hypot(a.x - b.x, a.y - b.y) * b.s, 'same map point (px)').toBeLessThanOrEqual(2);
// Mouse drag in 10 steps.
async function drag(page: Page, [x0, y0]: [number, number], [x1, y1]: [number, number]) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 10 });
  await page.mouse.up();
}
// Synthetic touch pointers on the map's SVG (Playwright Firefox has no touch emulation): each finger is a list of
// points; all go down, all move step by step, then all end.
async function touchGesture(page: Page, fingers: [number, number][][], end: 'pointerup' | 'pointercancel' = 'pointerup') {
  await page.evaluate(([fingers, end]) => {
    const svg = document.querySelector('.world-map svg')!;
    const fire = (type: string, i: number, [x, y]: number[]) =>
      svg.dispatchEvent(new PointerEvent(type, { pointerId: 21 + i, pointerType: 'touch', isPrimary: i === 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    fingers.forEach((f, i) => fire('pointerdown', i, f[0]));
    for (let s = 1; s < Math.max(...fingers.map((f) => f.length)); s++) fingers.forEach((f, i) => f[s] && fire('pointermove', i, f[s]));
    fingers.forEach((f, i) => fire(end, i, f[f.length - 1]));
  }, [fingers, end] as const);
}

// A Chart.js tip opens only on a mark (ui-rules 50), so the sweeps aim at marks: points on colored pixels (a bar,
// slice or line: chroma, unlike gray grid lines and text), one per 8px column, then a coarse grid as a fallback.
async function chartPoints(canvas: Locator, settle = true) {
  await canvas.scrollIntoViewIfNeeded();
  if (settle) await canvas.page().waitForTimeout(450); // the 400ms draw animation: marks at their final size
  const b = (await canvas.boundingBox())!, vh = canvas.page().viewportSize()!.height;
  const marks = await canvas.evaluate((c) => {
    const cv = c as HTMLCanvasElement, k = cv.width / cv.getBoundingClientRect().width;
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data, out: [number, number][] = [];
    for (let x = 4; x < cv.width / k - 4; x += 8)
      for (let y = 4; y < cv.height / k - 4; y += 2) {
        const i = (Math.round(y * k) * cv.width + Math.round(x * k)) * 4;
        if (d[i + 3] > 200 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) {
          out.push([x, y + 2]);
          break;
        }
      }
    return out;
  });
  const grid: [number, number][] = [];
  for (const fy of [0.75, 0.5, 0.25]) for (let fx = 0.1; fx < 1; fx += 0.1) grid.push([b.width * fx, b.height * fy]);
  return [...marks, ...grid].map(([x, y]) => [b.x + x, b.y + y] as const).filter(([, y]) => y > 60 && y < vh - 4);
}
// Taps (or clicks) a Chart.js canvas on its marks until its tip opens; returns where.
async function tapChart(page: Page, canvas: Locator) {
  const tip = page.locator('.chart-container .cell-tip:popover-open');
  for (const [x, y] of await chartPoints(canvas)) {
    await (touch() ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
    if (await tip.waitFor({ timeout: 60 }).then(() => true, () => false)) return [x, y] as const;
  }
}

// Versus values sit on the row's value line (user, 2026-10-18): each side's first-line baseline matches a lone value's
// (a reference `.hl-value` put where a lone value goes, so it holds for any seed), and the other cards' values in the
// same grid row, within 2px. Returns how many cross-card pairs it compared.
async function expectValueLine(page: Page) {
  const r = await page.locator('.finding-grid').first().evaluate((grid) => {
    const base = (v: Element) => {
      const i = document.createElement('i');
      i.style.cssText = 'display:inline-block;width:0;height:0';
      v.prepend(i);
      const y = i.getBoundingClientRect().top;
      i.remove();
      return y;
    };
    const bad: string[] = [];
    let pairs = 0;
    const cards = [...grid.children] as HTMLElement[];
    for (const c of cards.filter((k) => k.querySelector(':scope > .vs'))) {
      const ys = [...c.querySelectorAll(':scope > .vs .hl-value')].map(base);
      const ref = document.createElement('span');
      ref.className = 'hl-value';
      ref.textContent = '0';
      c.querySelector(':scope > .vs')!.before(ref); // in the split's own slot, so its baseline is the lone value's
      const lone = base(ref);
      ref.remove();
      if (Math.max(...ys) - Math.min(...ys) > 2) bad.push(`${c.id}: its sides' baselines differ (${ys.map(Math.round)})`);
      if (Math.abs(lone - ys[0]) > 2) bad.push(`${c.id}: baseline ${Math.round(ys[0] - lone)}px off a lone value's`);
      for (const k of cards.filter((k) => k !== c && k.offsetTop === c.offsetTop)) {
        const v = k.querySelector(':scope > .hl-value:not(.long)');
        if (!v) continue;
        pairs++;
        const d = base(v) - ys[0];
        if (Math.abs(d) > 2) bad.push(`${c.id} vs ${k.id}: baselines ${Math.round(d)}px apart`);
      }
    }
    return { bad, pairs };
  });
  expect(r.bad).toEqual([]);
  return r.pairs;
}

// No large hole inside a card (fill panel space): the tallest band of its content box with no text or graphic in it is
// under `max` of the card's height.
async function expectNoHoles(card: Locator, max = 0.25) {
  const r = await card.evaluate((c) => {
    const cb = c.getBoundingClientRect(), cs = getComputedStyle(c);
    const top = cb.top + parseFloat(cs.paddingTop), bottom = cb.bottom - parseFloat(cs.paddingBottom), spans: [number, number][] = [];
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent!.trim() || n.parentElement!.closest('[popover]')) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const q of rg.getClientRects()) if (q.height) spans.push([q.top, q.bottom]);
    }
    for (const s of c.querySelectorAll('svg, .badge')) if (!s.closest('[popover]') && s.getBoundingClientRect().height) spans.push([s.getBoundingClientRect().top, s.getBoundingClientRect().bottom]);
    spans.sort((x, y) => x[0] - y[0]);
    let at = top, gap = 0;
    for (const [t, b] of spans) {
      if (b <= at) continue;
      gap = Math.max(gap, Math.min(t, bottom) - at);
      at = Math.max(at, b);
    }
    return { gap: Math.max(gap, bottom - at), h: cb.height };
  });
  expect(r.gap / r.h, `a ${Math.round(r.gap)}px hole in a ${Math.round(r.h)}px card`).toBeLessThan(max);
}

// Hovers a Chart.js canvas on its marks until its tip opens; returns the tip.
// Tile titles and captions (ui-rules 55): no visible line starts or ends with "," or "·", every dot has one space on each side,
// and every caption line is centered in its tile. The caption items' dots are generated (`.cap-item::before`, " · " as pre text)
// and capItems.ts hides the dot of an item that starts a line.
async function expectNoEdgeDelimiters(page: Page) {
  const find = () => page.locator('.stat-label').evaluateAll((labels) => labels.flatMap((label) => {
    const chars: { ch: string; y: number; x: number }[] = [];
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const el = n.parentElement!;
      if (getComputedStyle(el).visibility === 'hidden' || el.closest('.sr-only')) continue;
      for (let i = 0; i < n.length; i++) {
        if (!n.data[i].trim()) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const rect = r.getBoundingClientRect();
        chars.push({ ch: n.data[i], y: rect.top + rect.height / 2, x: rect.left });
      }
    }
    const out: string[] = [];
    const name = label.textContent!.trim().replace(/\s+/g, ' ');
    // Literal delimiters in the text: never at a line edge, and one space on each side.
    if (/\S·|·\S/.test(label.textContent!)) out.push(`${name}: a dot without a space on each side`);
    const sorted = [...chars].sort((p, q) => p.y - q.y);
    const lines: typeof chars[] = [];
    for (const c of sorted) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(c.y - last[0].y) <= 4) last.push(c);
      else lines.push([c]);
    }
    for (const cs of lines) {
      cs.sort((p, q) => p.x - q.x);
      if ([cs[0].ch, cs[cs.length - 1].ch].some((c) => c === ',' || c === '·')) out.push(`${name}: a line starts or ends with a delimiter`);
    }
    // Caption items: the generated dot is a real " · " (pre) hanging in the gap before the item; the script hides it for an item
    // that starts a line, so a visible dot always has an item to its left on the same line. Every caption line is centered in
    // its tile (within 2px).
    const block = label.querySelector<HTMLElement>('.cap-block');
    if (block) {
      const tile = label.closest('.stat-item, .hl-card, .stat-item-hero') ?? block;
      const tileMid = tile.getBoundingClientRect().left + tile.getBoundingClientRect().width / 2;
      const rows = new Map<number, DOMRect[]>();
      for (const item of block.querySelectorAll<HTMLElement>('.cap-item')) {
        const r = item.getClientRects()[0];
        if (!r) continue;
        const key = [...rows.keys()].find((k) => Math.abs(k - r.top) <= 4) ?? r.top;
        rows.set(key, [...(rows.get(key) ?? []), r]);
      }
      for (const rs of rows.values()) {
        const mid = (Math.min(...rs.map((r) => r.left)) + Math.max(...rs.map((r) => r.right))) / 2;
        if (Math.abs(mid - tileMid) > 2) out.push(`${name}: a caption line is off-center by ${Math.round(mid - tileMid)}px`);
      }
      const items = [...block.querySelectorAll<HTMLElement>('.cap-item')];
      for (const item of items) {
        const pseudo = getComputedStyle(item, '::before');
        const r = item.getClientRects()[0];
        const startsLine = !items.some((o) => o !== item && o.getClientRects()[0] && Math.abs(o.getClientRects()[0].top - r.top) <= 4 && o.getClientRects()[0].left < r.left - 1);
        if (item !== items[0] && (pseudo.content !== '" · "' || pseudo.whiteSpace !== 'pre' || pseudo.position !== 'absolute')) out.push(`${name}: a dot is not a hanging " · "`);
        if (startsLine && pseudo.visibility !== 'hidden') out.push(`${name}: the dot of an item that starts a line is visible`);
      }
    }
    return out;
  }));
  await expect.poll(find).toEqual([]);
}

async function hoverChart(page: Page, canvas: Locator) {
  const tip = page.locator('.chart-container .cell-tip:popover-open');
  for (const [x, y] of await chartPoints(canvas)) {
    await page.mouse.move(x, y);
    if (await tip.waitFor({ timeout: 60 }).then(() => true, () => false)) break;
  }
  return tip;
}

// A tip opens only on its mark (ui-rules 50): the tip over the mark, none over the empty space
// beside it. `boxes`: the areas a mark sits in (a column, a row's track); `mark`: its selector inside them. Uses the
// first box with a gap of 12px or more beside its mark (a mark's hit area may reach 4px past it).
async function expectMarkOnly(page: Page, boxes: Locator, mark: string, tip: Locator) {
  const at = await boxes.evaluateAll((bs, mark) => {
    const gapOf = (b: Element) => {
      const br = b.getBoundingClientRect(), mr = b.querySelector(mark)?.getBoundingClientRect();
      if (!mr?.width || !mr.height) return null;
      const [cx, cy] = [mr.left + mr.width / 2, mr.top + mr.height / 2];
      const gaps: [number, number[]][] = [
        [mr.top - br.top, [cx, (br.top + mr.top) / 2]], [br.bottom - mr.bottom, [cx, (mr.bottom + br.bottom) / 2]],
        [mr.left - br.left, [(br.left + mr.left) / 2, cy]], [br.right - mr.right, [(mr.right + br.right) / 2, cy]]];
      const [size, empty] = gaps.sort((x, y) => y[0] - x[0])[0];
      return size >= 12 ? { empty, mark: [cx, cy] } : null;
    };
    const b = bs.find(gapOf);
    b?.scrollIntoView({ block: 'center' });
    return b ? gapOf(b) : null;
  }, mark);
  expect(at, `a ${mark} with empty space beside it`).not.toBeNull();
  const cursor = (x: number, y: number) => page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)!).cursor, [x, y]);
  const [[ex, ey], [mx, my]] = [at!.empty, at!.mark];
  await page.mouse.move(ex, ey);
  await page.waitForTimeout(150);
  await expect(tip, 'empty space beside a mark opens no tip').toBeHidden();
  expect(await cursor(ex, ey), 'the arrow over empty space').toBe('default');
  await page.mouse.move(mx, my);
  await expect(tip, 'its mark opens the tip').toBeVisible();
  expect(['default', 'pointer'], 'never the help cursor over a chart mark (the hand only where a click acts)').toContain(await cursor(mx, my));
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
}

// The same on a Chart.js canvas: an unpainted spot with no mark within 10px opens no tip and keeps
// the arrow; a mark opens the tip, still with the arrow (the help cursor is for help text and icons).
// `nearestX`: a line (or bar-with-line) chart opens its tip for the nearest x anywhere in the plot, and closes off the chart.
async function expectChartMarkOnly(page: Page, canvas: Locator, nearestX = false) {
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(450); // the 400ms draw animation
  const b = (await canvas.boundingBox())!;
  const empty = await canvas.evaluate((c) => {
    const cv = c as HTMLCanvasElement, k = cv.width / cv.getBoundingClientRect().width;
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data, w = cv.width / k, h = cv.height / k;
    const at = (x: number, y: number) => (Math.round(y * k) * cv.width + Math.round(x * k)) * 4;
    // Unpainted itself, and no colored pixel (a mark; gray grid lines and labels aren't marks) within 10px.
    const clear = (x: number, y: number) => {
      if (d[at(x, y) + 3] > 0) return false;
      for (let dy = -10; dy <= 10; dy += 2) for (let dx = -10; dx <= 10; dx += 2) {
        const i = at(x + dx, y + dy);
        if (d[i + 3] > 0 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) return false;
      }
      return true;
    };
    for (let y = h * 0.1; y < h * 0.9; y += 4) for (let x = w * 0.15; x < w * 0.95; x += 4) if (clear(x, y)) return [x, y];
    return null;
  });
  expect(empty, 'an empty spot in the chart').not.toBeNull();
  const tip = page.locator('.chart-container .cell-tip:popover-open');
  await page.mouse.move(b.x + empty![0], b.y + empty![1]);
  await page.waitForTimeout(150);
  if (nearestX) {
    await expect(tip, 'empty plot space opens the nearest x\'s tip').toHaveCount(1);
    await page.mouse.move(b.x + b.width / 2, Math.max(1, b.y - 12)); // off the chart
    await expect(tip, 'off the chart closes it').toHaveCount(0);
  } else await expect(tip, 'empty chart space opens no tip').toHaveCount(0);
  expect(await canvas.evaluate((c) => getComputedStyle(c).cursor), 'the arrow over empty chart space').toBe('default');
  await expect(await hoverChart(page, canvas), 'a mark opens the tip').toBeVisible();
  expect(await canvas.evaluate((c) => getComputedStyle(c).cursor), 'the arrow over a mark too').toBe('default');
}

// Every text node naming the seed's skip coffee sits in a .coffee-name span in the --color-skip color (hidden tips and
// popovers too), and there are at least `min` of them.
async function expectSkipColored(page: Page, min: number) {
  const r = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-skip)';
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    const bad: string[] = [];
    let ok = 0;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement!;
      if (!n.textContent!.includes('Skipper') || el.closest('option, script, style')) continue;
      if (el.closest('.coffee-name') && getComputedStyle(el).color === want) ok++;
      else bad.push(el.outerHTML.slice(0, 160));
    }
    return { ok, bad, want };
  });
  expect(['rgb(132, 94, 182)', 'rgb(169, 138, 214)'], 'the token resolves (light or dark)').toContain(r.want);
  expect(r.bad, 'skip names outside .coffee-name or off color').toEqual([]);

  expect(r.ok).toBeGreaterThanOrEqual(min);
}

// Route tag for test:changed (scripts/testScope.ts): the path's first segment, read with a stub seed.
const stubSeed = new Proxy({}, { get: () => new Proxy({}, { get: () => 'x' }) }) as unknown as Seed;
const routeTag = (st: State) => '@' + st.path(stubSeed).split(/[/?#]/)[1];
// Insights states also carry their tab (?tab=, none = overview) so a one-tab change can run just those.
const tabTag = (st: State) => {
  const path = st.path(stubSeed);
  return routeTag(st) === '@stats' ? ['@stats:' + (new URL(path, 'http://x').searchParams.get('tab') ?? 'overview')] : [];
};

const SHOTS = process.env.UI_SHOTS === 'all';
for (const state of STATES) {
  test(state.name, { tag: [routeTag(state), ...tabTag(state), ...(state.viewports === 'two' ? ['@two'] : [])] }, async ({ page }, info) => {
    if (state.slow) test.slow();
    const s = seed();
    await gotoReady(page, state.path(s));
    if (state.act) await state.act(page, s);
    if (state.name.startsWith('insights-')) await expectStatRowsFull(page);
    await expectTipsFormatted(page);
    await expectNoTitleTips(page);
    // UI_SHOTS=all only (playwright.config.ts); failures get Playwright's own screenshot either way.
    // Firefox can't capture past 32767 device px: a long page (phone cards at DPR 3) keeps its top part.
    if (SHOTS) {
      const [w, h, dpr] = await page.evaluate(() => [innerWidth, document.documentElement.scrollHeight, devicePixelRatio]);
      await page.screenshot({ path: `.ui-test/screenshots/${state.name}-${info.project.name}.png`, fullPage: true,
        clip: { x: 0, y: 0, width: w, height: Math.min(h, Math.floor(32767 / dpr)) } });
    }
    await checkLayout(page);
  });
}

// A non-UTC browser zone: "browser time" renders UTC on the first visit (server), then Tokyo after mount, and stays Tokyo
// across a client-side navigation (no UTC flash from a Stamp created later).
test.describe('browser in Tokyo', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  const minutesOf = (t: string) => {
    const m = [...t.matchAll(/Last updated: \d{4}-\d\d-\d\d (\d+):(\d\d) (AM|PM)/g)].at(-1); // /account has two; the footer's is last
    expect(m, t).not.toBeNull();
    return ((Number(m![1]) % 12) + (m![3] === 'PM' ? 12 : 0)) * 60 + Number(m![2]);
  };
  // Each reading is checked against its own <time datetime>, so data written meanwhile by parallel tests cannot skew it.
  const utcMinutesOf = (iso: string) => { const d = new Date(iso); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
  test('display-zone-tokyo', { tag: ['@account', '@two'] }, async ({ page }) => {
    await page.context().clearCookies({ name: 'tz' });
    const html = await (await page.context().request.get('/account')).text(); // the server's first render: UTC
    const flat = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const ssrIso = [...html.matchAll(/<time datetime="([^"]+)">[^<]*<\/time>/g)].at(-1)![1]; // footer stamp
    expect(html).toContain('UTC');
    expect(minutesOf(flat), 'server render is UTC').toBe(utcMinutesOf(ssrIso));
    await gotoReady(page, '/water');
    const foot = page.locator('.site-footer');
    await expect(foot).not.toContainText('UTC');
    const iso = (await foot.locator('time').first().getAttribute('datetime'))!;
    const tokyo = minutesOf(await foot.innerText());
    expect(tokyo, 'Tokyo is UTC+9').toBe((utcMinutesOf(iso) + 540) % 1440);
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === 'tz')?.value).toBe('Asia/Tokyo');
    await page.locator('a[href="/coffees"]:visible').first().click(); // client-side navigation
    await expect(page).toHaveURL(/\/coffees/);
    await expect(foot).not.toContainText('UTC');
    const iso2 = (await foot.locator('time').first().getAttribute('datetime'))!;
    expect(minutesOf(await foot.innerText())).toBe((utcMinutesOf(iso2) + 540) % 1440);
  });
});

// Public cards (signed out) with only a roaster default show it, alt "<roaster> logo".
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('recaps-404-public', { tag: ['@recaps', '@two'] }, async ({ page }) => {
    const status = async (path: string) => (await page.goto(path))!.status();
    expect(await status(`/recaps/${recapYear()}?preview=1`), 'preview is admin-only').toBe(404);
    expect(await status(`/recaps/${recapYear() + 1}`), 'a year with no brews').toBe(404);
    expect(await status(`/recaps/${recapYear() - 1}`), 'an opened year is public').toBe(200);
  });
  test('insights-recaps-public', { tag: ['@stats', '@stats:recaps', '@two'] }, async ({ page }) => {
    await gotoReady(page, '/stats?tab=recaps');
    await expectRecapTiles(page, [String(recapYear() - 1)]);
    await expect(page.locator('.recap-tile .badge')).toHaveCount(0);
    await checkLayout(page);
  });
  // Signed out, nothing to show: the tab says so and offers Sign in (it never bounces to another tab).
  test('insights-recaps-signed-out-empty', { tag: ['@stats', '@stats:recaps', '@two'] }, async ({ page }) => {
    await gotoReady(page, '/stats?tab=recaps&range=2015-01-01..2015-02-01');
    await expect(page).toHaveURL(/tab=recaps/);
    await expect(page.locator('.recap-tile')).toHaveCount(0);
    await expect(page.locator('.recaps-empty h2')).toContainText('No recaps in Jan 1, 2015');
    await expect(page.locator('.recaps-empty')).toContainText('Recaps for the current year are visible once you sign in.');
    const href = (await page.locator('.recaps-empty').getByRole('link', { name: 'Sign in' }).getAttribute('href'))!;
    expect(decodeURIComponent(href)).toBe('/login?redirectTo=/stats?tab=recaps&range=2015-01-01..2015-02-01');
    await expectNoMidWord(page, '.recaps-empty h2, .recaps-empty p');
    await checkLayout(page);
    expect((await page.goto('/recaps'))!.status(), '/recaps lands on the tab').toBe(200);
    await expect(page).toHaveURL(/\/stats\?tab=recaps$/);
  });
  test('account-signed-out', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Faccount/);
    await expect(page.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0);
  });
  test('coffees-list-brew-button-signed-out', async ({ page }) => {
    await gotoReady(page, '/coffees?status=open&view=list');
    // Brew now sits in the last (Actions) column, far right like the signed-in icons (user, 2026-11-02), never in the name cell.
    const row = page.locator('table.data-table tbody tr').filter({ has: page.getByRole('link', { name: 'Brew now' }) }).first();
    await expect(row.locator('td:last-child').getByRole('link', { name: 'Brew now' })).toHaveCount(1);
    await expect(row.locator('td:nth-child(2)').getByRole('link', { name: 'Brew now' })).toHaveCount(0);
    await expect(page.locator('table.data-table thead th').last()).toHaveText('Actions');
    await checkLayout(page);
  });
  test('insights-pours-signed-out', async ({ page }) => {
    await gotoReady(page, '/stats?tab=pours&pourThin=open');
    await expect(page.locator('[data-section="pours-recipes"] li').filter({ hasText: 'Seed high agitation' })).toHaveCount(1);
    await expect(page.locator('main a[href^="/recipes/"]').first()).toBeVisible(); // recipe names link for everyone
    await checkLayout(page);
  });
  test('recipes-public', async ({ page }) => {
    await gotoReady(page, '/recipes');
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByRole('heading', { name: 'Your recipes' })).toBeVisible();
    for (const n of ['Edit', 'Delete', 'Name & save', 'Not a recipe', 'Save']) await expect(page.getByRole('button', { name: n, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Found in your brews' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Words in your notes' })).toHaveCount(0);
    await page.getByRole('link', { name: 'See brews' }).first().click();
    await expect(page).toHaveURL(/brews=r\d+/);
    await expect(page.locator('.brew-row').first()).toBeVisible();
    await checkLayout(page);
  });
  test('coffee-edit-clone-params-signed-out', async ({ page }) => {
    await gotoReady(page, '/coffees?status=all&view=cards');
    const href = (await page.locator('a.card').first().getAttribute('href'))!;
    await gotoReady(page, `${href}?edit=1&clone=1`);
    await expect.poll(() => new URL(page.url()).search).toBe(''); // the one-shot params are dropped for everyone
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.locator('.modal')).toHaveCount(0);
  });
  test('coffees-cards-public-roaster-default', { tag: '@coffees' }, async ({ page }, info) => {
    await gotoReady(page, '/coffees?status=all&view=cards');
    const img = page.getByRole('img', { name: 'Moonwake logo', exact: true });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expectContained(page.locator('a.card').filter({ hasText: 'Rwanda Gitega Natural' }).locator('img'), WIDE_FILL);
    // Viewport only: the public card wall (every seeded bag) passes the 32767 px full-page screenshot cap at DPR 3.
    if (SHOTS) await page.screenshot({ path: `.ui-test/screenshots/coffees-cards-public-${info.project.name}.png` });
    await checkLayout(page);
  });
  test('coffees-search-row-buttons-public', { tag: '@coffees' }, async ({ page }) => {
    await gotoReady(page, '/coffees?status=all&view=cards');
    await expect(page.locator('.coffees-search-row').getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expectSearchRowButtons(page);
    await checkLayout(page);
  });
  // Signed out (no Add Coffee): the expanded phone bar hangs its pull tab off the bottom edge; the last row looks as in flow.
  test('coffees-bar-caret-public', { tag: '@coffees' }, async ({ page }) => {
    const [w, h] = [page.viewportSize()!.width, page.viewportSize()!.height];
    test.skip(!(w <= 640 || h <= 450), 'the collapse is a phone feature');
    await gotoReady(page, '/coffees?status=all&view=cards');
    const inFlow = await controlRects(page, '.cbar .add-sort-row');
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.getByRole('button', { name: 'Show controls' }).click();
    await expectPullTab(page);
    expectRectsClose(await controlRects(page, '.cbar.overlay .add-sort-row'), inFlow, 1);
    await checkLayout(page);
  });
  // The collapsible bar for a signed-out visitor: the same short row, overlay and pull tab.
  test('insights-cbar-public', { tag: '@stats' }, async ({ page }) => {
    test.skip(!isPhone(page), 'the collapse is a phone feature');
    await gotoReady(page, '/stats?range=all');
    await cbarAct(page);
    await checkLayout(page);
  });
  test('insights-gear-trophies-public', { tag: '@stats' }, async ({ page }) => {
    await gotoReady(page, '/stats?tab=gear&card=dripper-v60');
    await expect(page.locator('dialog.trophy-dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Fill|Suggest)/ })).toHaveCount(0);
    await checkLayout(page);
    await gotoReady(page, '/stats?tab=gear&card=grinder-comandante-c40-mk4');
    await expect(page.locator('dialog.trophy-dialog .no-specs')).toHaveText('No details yet.');
  });
});

// The sticky bar is the same height before hydration (the server HTML, no JS) as after it: a tab's own controls are
// rendered with the bar, so nothing grows it on load (peer review B, round 2).
for (const tab of ['overview', 'records', 'water', 'leaderboards', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing']) {
  test(`insights-bar-first-paint-${tab}`, { tag: '@stats' }, async ({ browser, page }, info) => {
    const url = `/stats?tab=${tab}&range=all`;
    await gotoReady(page, url);
    const hydrated = (await page.locator('.filter-bar').boundingBox())!.height;
    const cbarH = (await page.locator('.cbar').count()) ? (await page.locator('.cbar').first().boundingBox())!.height : null;
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport ?? undefined, baseURL: info.project.use.baseURL, deviceScaleFactor: info.project.use.deviceScaleFactor });
    try {
      const raw = await ctx.newPage();
      await raw.goto(url);
      if (['leaderboards', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing'].includes(tab)) await expect(raw.locator('.filter-bar .tab-controls')).toBeVisible();
      if (cbarH !== null) expect(Math.abs((await raw.locator('.cbar').first().boundingBox())!.height - cbarH), '.cbar height: server HTML vs hydrated').toBeLessThanOrEqual(1);
      expect(Math.abs((await raw.locator('.filter-bar').boundingBox())!.height - hydrated), 'bar height: server HTML vs hydrated').toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
  });
}
