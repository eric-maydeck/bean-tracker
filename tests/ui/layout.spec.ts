import { test, expect, type Page, type Locator, type Route } from '@playwright/test';
import { gotoReady, reloadReady } from './ready';
import { readFileSync } from 'node:fs';
import { fieldsFor } from '../../src/lib/gear';
import { checkLayout, expectGridRowsFull, expectInnerScroll, expectPairsFilled, expectStatRowsFull, expectTipInView, expectTipsFormatted, expectNoTitleTips, expectColumnsFilled, expectDataTip, expectLabelsOutsidePlot } from './checkLayout';

interface Seed {
  slugs: { long: string; linked: string; frozen: string; decaf: string; wide: string; lab: string; skip: string } & Record<GramsKey, string>;
  names: { long: string; everyAction: string } & Record<GramsKey, string>;
}
// Seeded open coffees with a linked bean, and their bag text (checkLayout rule 6
// asserts each stays on one line).
const GRAMS = { big: '2kg (2kg left)', under: '999g (999g left)', part: '1.5kg (1.1kg left)' };
type GramsKey = keyof typeof GRAMS;
const GRAMS_KEYS = Object.keys(GRAMS) as GramsKey[];
// Read lazily: .ui-test/seed.json only exists once the web server has started.
let cached: Seed | undefined;
const seed = (): Seed => (cached ??= JSON.parse(readFileSync('.ui-test/seed.json', 'utf8')));

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
// Image URL sits on the row above. Measured on the dripper's 9 fields (Size alone on the last row).
async function expectEditAligned(page: Page) {
  const dlg = page.locator('dialog.trophy-dialog');
  const bx = async (l: Locator) => (await l.boundingBox())!;
  const [flow, size, mat] = [await bx(dlg.getByLabel('Flow', { exact: true })), await bx(dlg.getByLabel('Size', { exact: true })), await bx(dlg.getByLabel('Material', { exact: true }))];
  const [save, cancel] = [await bx(dlg.getByRole('button', { name: 'Save' })), await bx(dlg.getByRole('button', { name: 'Cancel' }))];
  expect(Math.abs(save.x - flow.x), 'Save left = Flow input left').toBeLessThan(1.5);
  expect(Math.abs(cancel.x + cancel.width - (flow.x + flow.width)), 'Cancel right = Flow input right').toBeLessThan(1.5);
  expect(Math.abs(save.y - size.y), 'Save top = Size input top').toBeLessThan(2);
  expect(Math.abs(cancel.y - size.y)).toBeLessThan(2);
  expect(Math.abs(save.y + save.height - (size.y + size.height)), 'Save bottom = Size input bottom').toBeLessThan(2);
  const url = await bx(dlg.getByLabel('Image URL'));
  expect(Math.abs(url.y - mat.y), 'Image URL input top = Material input top').toBeLessThan(2);
  expect(Math.abs((await bx(dlg.getByText('Image URL', { exact: true }))).y - (await bx(dlg.getByText('Material', { exact: true }).first())).y), 'labels level').toBeLessThan(2);
  const [prev, disc] = [await bx(dlg.getByRole('button', { name: 'Preview' })), await bx(dlg.getByRole('button', { name: 'Discard image' }))];
  expect(Math.abs(prev.y - size.y), 'Preview top = Size input top').toBeLessThan(2);
  expect(Math.abs(prev.x - url.x)).toBeLessThan(1.5);
  expect(Math.abs(disc.x + disc.width - (url.x + url.width))).toBeLessThan(1.5);
  // Compact: label to input ~4px, field to field ~10-12px, inputs at the site's normal height.
  expect(size.height).toBeLessThan(42);
  expect(size.y - mat.y, 'row pitch (label + input + gap)').toBeLessThan(74);
  const lbl = await bx(dlg.getByText('Size', { exact: true }).first());
  expect(size.y - (lbl.y + lbl.height), 'label to input').toBeLessThan(7);
}

// Stats → Not yet tracked → Link on the bean row containing `text`.
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
    const left = horizontal && Math.abs(r.right - (track.left + track.width / 2)) < 1.5 && r.width > 2; // ends at the 0 line
    const atRight = /^(100%|right)/.test(cs.backgroundPositionX.split(',')[0].trim()) && /to left bottom|to bottom left/.test(cs.backgroundImage);
    return left === atRight ? [] : [`${e.closest('[data-section]')?.getAttribute('data-section')}: fold at ${atRight ? 'right' : 'left'}, bar points ${left ? 'left' : 'right/up'}`];
  }));
  expect(bad).toEqual([]);
}
// Height of the active tab's own controls row inside the sticky bar (0 when the tab has none).
const tabRowHeight = (bar: Locator) =>
  bar.evaluate((el) => { const r = el.querySelector('.tab-controls')?.getBoundingClientRect().height; return r ? r + parseFloat(getComputedStyle(el).rowGap) : 0; });
async function expectStickyBar(page: Page, bar: Locator) {
  // Room to scroll on pages shorter than the viewport.
  await page.evaluate(() => (document.documentElement.style.paddingBottom = '200vh'));
  const target = page.locator('section.chart-panel').nth(1);
  await target.evaluate((el) => el.scrollIntoView());
  await page.waitForTimeout(100);
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
  expect(bands).toHaveLength(3); // so the loop below can't pass vacuously
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
  const row = page.locator('.compact-row-wrap, tbody tr').filter({ hasText: text }).first();
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
    for (const cell of grid.children) {
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
    expect(r.y - m.y).toBeLessThan(page.viewportSize()!.height);
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

export const STATES: State[] = [
  // /coffees status is a multi-select: Backlog + Open lit together, the list is their union.
  { name: 'coffees-status-multi', path: () => '/coffees?status=backlog&status=open&view=cards',
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
      await gotoReady(page, '/insights');
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
      await gotoReady(page, '/insights');
      await gotoReady(page, '/coffees');
      await expect(page).toHaveURL(/status=all(&|$)/);
      expect(page.url()).not.toContain('prev');
      await tap('All');
      await expect(page).toHaveURL(/status=archive(&|$)/);
      expect(page.url()).not.toContain('status=all');
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
    name: 'coffees-refreshed',
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
  { name: 'coffee-detail-like', path: (s) => `/coffees/${s.slugs.lab}`,
    act: async (page) => {
      const panel = page.locator('[data-section="like"]');
      await expect(panel.getByRole('heading', { name: 'Vs like coffees' })).toBeVisible();
      await expect(panel).toContainText(/\d+(st|nd|rd|th) of \d+/);
      await expectGridRowsFull(page, '[data-section="like"] .stat-grid');
    } },
  { name: 'coffee-detail-no-like', viewports: 'two', path: (s) => `/coffees/${s.slugs.frozen}`,
    act: async (page) => expect(page.locator('[data-section="like"]')).toHaveCount(0) },
  // Gate P4: a coffee with rated brews but no panel says why in one line; the tip has the counts; the link opens
  // the nearest view with a comparison (URL state), which offers Back to defaults.
  { name: 'coffee-detail-like-why', path: (s) => `/coffees/${s.slugs.decaf}`,
    act: async (page) => {
      const line = page.locator('[data-section="like"] .like-none');
      await expect(line).toContainText('No comparison: decaf coffees are left out by default.');
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
  { name: 'coffee-detail-like-all', path: (s) => `/coffees/${s.slugs.lab}?ratings=all&dial=all`,
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
    // Defaults on a bare URL; the picker and mL input write explicit params; a bad ml shows the hint, no results.
    name: 'water',
    path: () => '/water',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('bright-and-juicy');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('800');
      await expect(page.getByLabel('Kettle')).toHaveValue('');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 800 mL' })).toBeVisible();
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
      await expect(page.getByText('Enter 100-2000 mL.')).toBeVisible();
    }
  },
  {
    name: 'water-ideal-hint',
    path: () => '/water?recipe=lume-high-clarity&ml=800',
    act: async (page) => {
      await expect(page.locator('.water-ideal')).toContainText('The Lume High Clarity recipe is best used with 1000 mL of distilled water.');
      await expect(page.getByRole('button', { name: 'Switch to 1000 mL' })).toBeVisible();
    }
  },
  {
    name: 'water-ideal-switch',
    path: () => '/water?recipe=lume-high-clarity&ml=800',
    act: async (page) => {
      await page.getByRole('button', { name: 'Switch to 1000 mL' }).click();
      await expect(page).toHaveURL(/ml=1000/);
      await expect(page.getByLabel('Water (mL)')).toHaveValue('1000');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1000 mL' })).toBeVisible();
      await expect(page.locator('.water-ideal')).toHaveCount(0);
    }
  },
  {
    name: 'water-ideal-none',
    path: () => '/water?recipe=lume-high-clarity&ml=1000',
    act: async (page) => {
      await expect(page.getByLabel('Water (mL)')).toHaveValue('1000');
      await expect(page.locator('.water-ideal')).toHaveCount(0);
    }
  },
  {
    // Kettle fills mL (its published capacity); box and slider edit the same value live (no blur); kettle rides the URL while ml matches it.
    name: 'water-kettle',
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 725 mL' })).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1200 mL' })).toBeVisible();
      await expectGroupsLabelled(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  },
  {
    // Drops tab: whole-drop inputs -> minerals, GH, KH (880 mL: Mg 3, Ca 1, Na 1, K 1); values ride the URL with mode.
    name: 'water-mode-drops',
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
    name: 'water-mode-target',
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880 mL' })).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880 mL of water' })).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880 mL of water' })).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Lotus drops for 880 mL of water' })).toBeVisible();
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
      await page.evaluate(() => document.querySelector<HTMLElement>('nav.site-nav a[href="/insights"]')?.click());
      await expect(page).toHaveURL(/\/insights/);
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
    name: 'water-reset',
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
    name: 'water-reset-partial',
    path: () => '/water?recipe=substance&ml=900',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('substance');
      const box = page.getByLabel('Water (mL)');
      const results = page.locator('main section.wr');
      const before = (await results.boundingBox())!.height;
      await box.fill('8');
      await expect(page.getByText('Enter 100-2000 mL.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Lotus drops for 900 mL' })).toBeVisible();
      expect((await results.boundingBox())!.height).toBe(before);
      await page.evaluate(() => (document.querySelector('nav.site-nav a[href="/water"]') as HTMLElement | null)?.click());
      await expect(page).toHaveURL(/recipe=substance&ml=900/); // a bare visit restores the remembered state
      await expect(page.getByLabel('Recipe')).toHaveValue('substance');
      await expect(box).toHaveValue('900');
    }
  },
  {
    name: 'water-deep-link',
    path: () => '/water?recipe=HOLY-water&ml=1200',
    act: async (page) => {
      await expect(page.getByLabel('Recipe')).toHaveValue('holy-water');
      await expect(page.getByRole('heading', { name: 'Lotus drops for 1200 mL' })).toBeVisible();
      await expect(page.getByRole('listitem', { name: '9 Magnesium' })).toBeVisible();
      await expect(page.locator('.wr-head')).toBeVisible();
      await gotoReady(page, '/water?kettle=FELLOW-stagg-ekg-pro');
      await expect(page.getByLabel('Kettle')).toHaveValue('fellow-stagg-ekg-pro');
      await expect(page.getByLabel('Water (mL)')).toHaveValue('900');
    }
  },
  {
    name: 'on-deck',
    path: () => '/on-deck',
    act: async (page) => {
      for (const text of Object.values(GRAMS)) await expect(page.getByText(text, { exact: true })).toBeVisible();
      for (const img of await page.locator('img.card-thumb').all()) await expectContained(img);
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
      await expect(row.locator('.total-note')).toHaveText('500 g total');
      await row.locator('input[name="bag_count"]').fill('3');
      await expect(row.locator('.total-note')).toHaveText('750 g total');
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
    // Closed, after a keyboard pick (nothing is submitted): ↓ + Enter takes the
    // second twin; Esc closes without changing it. Focus returns to the button.
    name: 'stats-link-picker',
    path: () => '/stats?tab=bq',
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
    name: 'stats-link-picker-open',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      const top = page.getByRole('group', { name: 'Top match' }).getByRole('option');
      await expect(top).toHaveCount(2); // the seeded twins
      await expect(top.first()).toHaveAttribute('aria-selected', 'true');
      if (page.viewportSize()!.width === 360) await expectBagOnOwnLine(page);
    }
  },
  {
    name: 'stats-link-picker-search',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      await openPicker(page, 'Kenya Kiambu');
      await page.getByRole('searchbox', { name: 'Search coffees' }).fill('ethiopia');
      await expect(page.getByRole('group', { name: 'Top match' })).toHaveCount(0);
      await expect(page.getByRole('option').first()).toBeVisible();
    }
  },
  {
    name: 'stats-link-picker-long',
    path: () => '/stats?tab=bq',
    act: (page, s) => openPicker(page, s.names.long.slice(0, 20))
  },
  {
    name: 'coffee-linked',
    path: (s) => `/coffees/${s.slugs.linked}`,
    act: async (page) => {
      await expect(page.getByText(/Bean Conqueror: .* · 8 brews/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlink', exact: true })).toBeVisible();
    }
  },
  // A bare /stats URL is All time (DEFAULTS.range, user ruling 2026-10-17) and stays bare.
  { name: 'stats-general', viewports: 'two', path: () => '/stats',
    act: async (page) => {
      await expect(page.getByLabel('Period')).toHaveValue('all');
      expect(new URL(page.url()).search).toBe('');
    } },
  {
    // The /stats people switch drives both tabs: At a Glance on General, totals on Bean Conqueror.
    name: 'stats-people-person',
    path: () => '/stats',
    act: async (page) => {
      const people = page.getByRole('group', { name: 'People' });
      await people.getByRole('button', { name: 'Per person', exact: true }).click();
      await expect(page).toHaveURL(/people=person/);
      await expect(page.locator('.stat-label', { hasText: 'To clear' }).first()).toHaveText('To clear per person', { useInnerText: true, ignoreCase: true });
      // The switch options' help is the shared hover tip (ui-rules 27), not a native title.
      await people.getByRole('button', { name: 'Household', exact: true }).hover();
      await expectTipInView(page, page.locator('.cell-tip:popover-open'), { inBar: true });
      await expect(page.locator('.cell-tip:popover-open .tip-title')).toHaveText('Household');
      await page.mouse.move(0, 0);
      // The mode word opens its help popover (ui-rules 27), in view under the sticky bar.
      const help = page.locator('.stat-item', { hasText: 'Time to clear' }).getByRole('button', { name: 'per person' });
      await help.click();
      await expectTipInView(page, page.locator('.mode-tip:popover-open'));
      await expect(page.locator('.mode-tip:popover-open .tip-title')).toHaveText('Per person');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Bean Conqueror', exact: true }).click();
      await expect(page).toHaveURL(/people=person/);
      await expect(page.locator('.stat-label', { hasText: 'Total brews' })).toHaveText('Total brews · per person', { useInnerText: true, ignoreCase: true });
      await expect(page.locator('.stat-label', { hasText: 'Average rating' })).toHaveText('Average rating');
      await expect(page.locator('.stat-label', { hasText: 'Total beans' })).toHaveText('Total beans');
      await expect(page.getByRole('heading', { name: 'Brews per day · per person' })).toBeVisible();
      await expect(page.locator('.stat-item', { hasText: 'Total brews' }).locator('.stat-value')).toHaveText(/^\d+(\.\d)?$/);
    }
  },
  {
    // A tip value carries its unit, the other measure in parentheses (ui-rules 36): "1,750 g (14 bags)".
    name: 'stats-breakdown-tip', viewports: 'two',
    path: () => '/stats',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Top Coffees by Category' }) });
      const tip = await hoverChart(page, panel.locator('canvas'));
      await expectDataTip(tip);
      await expect(tip.locator('dd')).toHaveText(/^[\d,]+ g \(\d+ bags?\)$/);
    }
  },
  {
    // A /stats chart's tip (ui-rules 36, 39): the shared data tip, in view with the chart scrolled up under the sticky bar.
    name: 'stats-chart-tip',
    path: () => '/stats',
    act: async (page) => {
      const c = page.locator('.chart-container canvas').first();
      await c.scrollIntoViewIfNeeded();
      const bar = (await page.locator('.filter-bar').boundingBox())!;
      await page.evaluate((dy) => scrollBy(0, dy), (await c.boundingBox())!.y - bar.y - bar.height - 8);
      await expectDataTip(await hoverChart(page, c));
      await expectTipInView(page, page.locator('.chart-container .cell-tip:popover-open'));
    }
  },
  {
    // A weight of 100 kg and up drops its decimal; the tile's value opens "Exact" (like Usd's Before rounding). The seed
    // has no 100 kg total, so the client load's data is rewritten (a client navigation from /coffees).
    name: 'stats-exact-tip',
    path: () => '/coffees',
    act: async (page) => {
      await page.route(/\/stats\/__data\.json/, async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        for (const n of body.nodes ?? []) for (const o of Array.isArray(n?.data) ? n.data : []) {
          if (o && typeof o === 'object' && !Array.isArray(o) && 'finishedGrams' in o) n.data[o.finishedGrams] = 123456;
        }
        await route.fulfill({ response: res, json: body });
      });
      await page.locator('a[href="/stats"]:visible').first().click();
      const value = page.getByRole('button', { name: /^123kg: Exact/ });
      await value.click();
      const tip = page.locator('.cell-tip:popover-open');
      await expectDataTip(tip);
      await expectTipInView(page, tip);
      await expect(tip.locator('.tip-title')).toHaveText('Exact');
      await expect(tip.locator('dd')).toHaveText('123,456 g');
    }
  },
  {
    // Temporary Time to Clear panel: its own Period select writes `range`; people from the URL.
    name: 'stats-time-to-clear-range',
    path: () => '/stats?people=person',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Time to Clear' }) });
      await panel.getByLabel('Period').selectOption('1m');
      await expect(page).toHaveURL(/range=1m/);
      await expect(page).toHaveURL(/people=person/);
      await expect(panel.locator('.stat-label')).toHaveText([
        'Time to clear · per person', 'Per day · per person', 'Per week · per person', 'Per month · per person'
      ], { useInnerText: true, ignoreCase: true });
      await expect(page.locator('.stat-label', { hasText: 'To clear' }).first()).toHaveText('To clear per person', { useInnerText: true, ignoreCase: true });
    }
  },
  {
    // Household size: Edit opens the form with nothing focused (no autofocus). Nothing saved.
    name: 'stats-household-size-edit',
    path: () => '/stats',
    act: async (page) => {
      await page.getByRole('button', { name: 'Edit household size' }).click();
      await expect(page.getByLabel('Household size')).toHaveValue('2');
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
    }
  },
  {
    // Over the 20 MB body limit: stopped in the browser, with the reason.
    name: 'stats-import-too-big', viewports: 'two',
    path: () => '/stats?tab=bq',
    act: async (page) => {
      const input = page.locator('input[name="file"]');
      await input.setInputFiles({ name: 'Beanconqueror.zip', mimeType: 'application/zip', buffer: Buffer.alloc(21 * 1024 * 1024) });
      expect(await input.evaluate((el: HTMLInputElement) => el.validationMessage)).toContain('Over 20 MB');
    }
  },
  ...(['overview', 'favorites', 'brewing', 'economics'] as const).map((tab) => ({
    name: `stats-${tab}`,
    path: () => `/stats?tab=bq&bc=${tab}`,
    // ui-rules 47: a top-N chart says how many it shows, only while it cuts something (never "top 4 of 4").
    act: async (page: Page) => {
      await expect(page.locator('main')).toBeVisible();
      const lines = await page.getByText(/^\s*Showing top \d+ of \d+\.\s*$/).allInnerTexts();
      for (const l of lines) { const [n, m] = l.match(/\d+/g)!.map(Number); expect(n, l).toBeLessThan(m); }
      // The seed's By Method and By Grinder have under 10 groups each: no line.
      if (tab === 'brewing') await expect(page.locator('.chart-panel-row').getByText(/Showing top/)).toHaveCount(0);
    }
  })),
  {
    // ui-rules 46: the cost-per-roaster chart's bar labels are usd ("$0.05/g"), never Chart's plain-number fallback.
    name: 'stats-bc-economics-usd', viewports: 'two',
    path: () => '/stats?tab=bq&bc=economics',
    act: async (page) => {
      await page.addInitScript(() => {
        const w = window as unknown as { drawn: string[] };
        w.drawn = [];
        const fill = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) { w.drawn.push(String(t)); return fill.call(this, t, ...rest); };
      });
      await gotoReady(page, '/stats?tab=bq&bc=economics');
      await expect(page.locator('canvas').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => (window as unknown as { drawn: string[] }).drawn.filter((t) => /\/g$/.test(t)).length)).toBeGreaterThan(0);
      const drawn = await page.evaluate(() => (window as unknown as { drawn: string[] }).drawn);
      expect(drawn.filter((t) => /^\d*\.\d+$/.test(t))).toEqual([]); // no raw "0.047" labels or "0.02" ticks
      for (const t of drawn.filter((t) => /\/g$/.test(t))) expect(t).toMatch(/^\$[\d,]+(\.\d{2})?\/g$/);
    }
  },
  { name: 'insights-sticky', path: () => '/insights?range=1w&compare=1', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  { name: 'stats-sticky', path: () => '/stats', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  { name: 'stats-bq-sticky', path: () => '/stats?tab=bq', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-default', viewports: 'two',
    path: () => '/insights',
    act: async (page) => {
      await expect(page.locator('.chart-panel h2', { hasText: 'Right now' })).toBeVisible();
      // Every click-for-explanation trigger ends with its circled ?.
      expect(await page.locator('.mode-tip-button').count()).toBeGreaterThan(0);
      expect(await page.locator('.mode-tip-button').evaluateAll((bs) => bs.filter((b) => !b.querySelector('svg.icon')).length)).toBe(0);
      // Totals values are the same color as the Averages' (they were the /stats hero brown until round 2).
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
    path: () => '/insights?process=Washed&caffeine=decaf',
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
  { name: 'insights-right-now-links-compare', path: () => '/insights?range=1w&compare=1',
    act: async (page) => {
      const links = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Right now' }) }).locator('.tile-link');
      await expect(links).toHaveCount(8);
      await expectLinksInTiles(page, links);
    } },
  {
    name: 'insights-right-now-link-lands', viewports: 'two',
    path: () => '/insights',
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
    path: () => '/insights?tab=habits',
    act: async (page) => {
      await expect(page.locator('.insights-charts canvas')).toHaveCount(2);
      await expect(page.locator('.heatmap .heat-cell')).toHaveCount(7 * 24);
      await page.locator('.brew-calendar .cal-cell').last().click();
      await expectDataTip(page.locator('.cell-tip'));
    }
  },
  { name: 'insights-habits-1w', path: () => '/insights?tab=habits&range=1w' },
  {
    name: 'insights-habits-rating-compare',
    path: () => '/insights?tab=habits&measure=rating&compare=1',
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
    path: () => '/insights?tab=habits&range=1w&compare=1',
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
  { name: 'labels-overview', path: () => '/insights', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-leaderboards', path: () => '/insights?tab=leaderboards', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-habits', path: () => '/insights?tab=habits', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-habits-rating', path: () => '/insights?tab=habits&measure=rating', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-consumption', path: () => '/insights?tab=consumption', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-stats-general', path: () => '/stats', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-stats-bq', path: () => '/stats?tab=bq', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-stats-bq-favorites', path: () => '/stats?tab=bq&bc=favorites', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-stats-bq-brewing', path: () => '/stats?tab=bq&bc=brewing', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-stats-bq-economics', path: () => '/stats?tab=bq&bc=economics', act: (page) => expectGroupsLabelled(page) },
  { name: 'labels-coffees', path: () => '/coffees?status=all&view=compact', act: (page) => expectGroupsLabelled(page) },
  {
    // Two views behind a labeled View select: only the chosen section renders; `next` is the only explicit value.
    name: 'on-deck-view-open',
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
    name: 'on-deck-view-next',
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
    path: () => '/insights?tab=habits&agg=total&compare=1',
    act: async (page) => {
      await expect(page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Total' })).toHaveAttribute('aria-pressed', 'true');
      await expectChipsFit(page);
      await expectDeltasFit(page);
      await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Avg per day' }).click();
      await expect(page).not.toHaveURL(/agg=/);
      await page.getByRole('group', { name: 'Measure' }).getByRole('button', { name: 'Rating' }).click();
      await expect(page.getByRole('group', { name: 'Show' })).toHaveCount(0);
    }
  },
  {
    name: 'insights-habits-agg-avg-grams',
    path: () => '/insights?tab=habits&measure=grams&compare=1',
    act: async (page) => {
      await page.locator('.heatmap .heat-cell').nth(10).hover();
      await expectChipsFit(page);
    }
  },
  {
    // Active days compares as a ratio of a count: "▼ 3% from 31 days (100%)", up to two lines, clear of the caption, nothing clipped.
    name: 'insights-habits-active-from',
    path: () => '/insights?tab=habits&range=1w&compare=1',
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
    path: () => '/insights?tab=habits&range=all',
    act: (page) => expectNoEllipsis(page)
  },
  {
    name: 'insights-habits-busiest-rating',
    path: () => '/insights?tab=habits&range=all&measure=rating',
    act: (page) => expectNoEllipsis(page)
  },
  {
    name: 'insights-habits-busiest-grams',
    path: () => '/insights?tab=habits&range=all&measure=grams&compare=before',
    act: (page) => expectDeltasFit(page)
  },
  {
    // Average mode with a compare on: the narrowest strings (per-day labels, bag fractions), grams and bags.
    name: 'insights-consumption-agg-grams',
    path: () => '/insights?tab=consumption&range=1w&compare=1',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Avg per day' })).toBeVisible();
      await expectChipsFit(page);
      await expectDeltasFit(page);
    }
  },
  {
    name: 'insights-consumption-busiest-day',
    path: () => '/insights?tab=consumption&range=all',
    act: expectBusiestDay
  },
  {
    name: 'insights-consumption-busiest-day-compare',
    path: () => '/insights?tab=consumption&range=1w&compare=1',
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
    path: () => '/insights?tab=consumption&range=1w&compare=1&by=day',
    act: async (page) => {
      const c = page.locator('.insights-charts canvas').first();
      await c.scrollIntoViewIfNeeded();
      const b = (await c.boundingBox())!;
      // T1: a canvas chart's tip is the shared HTML tip: a bold title, then label/value rows (no "Label: value").
      // Swept from the right until a bar is under the pointer (bars hover by intersection).
      const tip = page.locator('.chart-container .cell-tip:popover-open');
      for (let f = 0.95; f > 0 && !(await tip.count()); f -= 0.05) {
        await page.mouse.move(b.x + b.width * f, b.y + b.height * 0.75);
        await page.waitForTimeout(100);
      }
      await expectDataTip(tip);
      await expectTipInView(page, tip);
    }
  },
  {
    name: 'insights-consumption-agg-bags',
    path: () => '/insights?tab=consumption&range=1w&compare=1&unit=bags',
    act: async (page) => {
      await expect(page.locator('.stat-label', { hasText: 'Finished/day' })).toBeVisible();
      await expectDeltasFit(page);
    }
  },
  {
    name: 'insights-consumption-agg-bags-longer',
    path: () => '/insights?tab=consumption&range=1w&compare=before&unit=bags&by=week',
    act: (page) => expectDeltasFit(page)
  },
  { name: 'insights-habits-sticky', path: () => '/insights?tab=habits', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-consumption-tab', viewports: 'two',
    path: () => '/insights?tab=consumption',
    act: async (page) => expect(page.locator('.insights-charts canvas')).toHaveCount(2)
  },
  {
    name: 'insights-consumption-bags-week',
    path: () => '/insights?tab=consumption&unit=bags&by=week&compare=1&agg=total',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.stat-label', { hasText: 'Bags finished' })).toBeVisible();
    }
  },
  {
    // The ~21-day ui seed is too short for months, even over all time (ruling P2).
    name: 'insights-consumption-all', viewports: 'two',
    path: () => '/insights?tab=consumption&range=all',
    act: async (page) => {
      // The seed's insights brews reach back 60 days: all time spans months (1w keeps Month disabled).
      await expect(page.getByRole('button', { name: 'Month' })).toBeEnabled();
      await expect(page.locator('.chart-panel canvas')).toHaveCount(3);
    }
  },
  { name: 'insights-consumption-1w', path: () => '/insights?tab=consumption&range=1w',
    act: async (page) => expect(page.getByRole('button', { name: 'Month' })).toBeDisabled() },
  {
    // Delta lines: arrow + change + "from" + the previous value (pace-scaled: change + %); the sentence
    // is visually hidden text. Never clipped or wrapped.
    name: 'insights-1w-compare',
    path: () => '/insights?range=1w&compare=1',
    act: (page) => expectDeltasFit(page)
  },
  { name: 'insights-year', path: () => `/insights?range=${new Date().getFullYear()}&ratings=all` },
  { name: 'insights-compare-2', path: () => '/insights?range=1w&compare=2' },
  {
    // Former native titles, now the shared hover tip (labelTip): a tile's delta sentence, the People switch's help.
    name: 'insights-hover-tips',
    path: () => '/insights?range=1w&compare=2',
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
  { name: 'insights-ratings-all', path: () => '/insights?ratings=all' },
  {
    // Overview: Totals and Averages each carry the Ratings and Brews switches in their header (no in-tile pills);
    // one URL param each keeps them in sync.
    name: 'insights-ratings-switch-sync', viewports: 'two',
    path: () => '/insights',
    act: async (page) => {
      await expect(page.locator('.stat-item [role="group"]')).toHaveCount(0);
      const switches = page.getByRole('group', { name: 'Ratings' });
      await expect(switches).toHaveCount(2);
      await switches.first().getByRole('button', { name: 'All ratings', exact: true }).click();
      await expect(page).toHaveURL(/ratings=all/);
      for (const g of await switches.all()) await expect(g.getByRole('button', { name: 'All ratings', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.mode-tip-button')).toHaveText(['All ratings', 'All ratings']);
      const brews = page.getByRole('group', { name: 'Brews' });
      await expect(brews).toHaveCount(2);
      await brews.last().getByRole('button', { name: 'All brews', exact: true }).click();
      await expect(page).toHaveURL(/dial=all/);
      for (const g of await brews.all()) await expect(g.getByRole('button', { name: 'All brews', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.mode-tip-button')).toHaveText(['All ratings, All brews', 'All ratings, All brews']);
    }
  },
  ...(['leaderboards', 'habits&measure=rating', 'records', 'sweetspots', 'brewing', 'water', 'gear'] as const).map((t) => ({
    name: `insights-dial-${t.split('&')[0]}`, path: () => `/insights?tab=${t}`,
    act: async (page: Page) => {
      await openSwitches(page);
      const g = page.getByRole('group', { name: 'Brews' }).first();
      await expect(g.getByRole('button', { name: 'Once dialed' })).toHaveAttribute('aria-pressed', 'true');
      await g.getByRole('button', { name: 'All brews', exact: true }).click();
      await expect(page).toHaveURL(/dial=all/);
      await expect(g.getByRole('button', { name: 'All brews', exact: true })).toHaveAttribute('aria-pressed', 'true');
    } })),
  { name: 'insights-dial-all', path: () => '/insights?tab=leaderboards&dial=all' },
  // Captions stay inside their tiles in both dial states (checkLayout).
  { name: 'insights-dial-all-overview', path: () => '/insights?dial=all' },
  { name: 'insights-dial-all-records', path: () => '/insights?tab=records&dial=all' },
  { name: 'insights-dial-all-compare', path: () => '/insights?dial=all&compare=1' },
  // ui-rules 26: Ratings and Brews are one menu button in the sticky bar, only where they apply (none in tiles or panels).
  ...(['sweetspots', 'water', 'gear', 'brewing', 'records', 'leaderboards', 'habits&measure=rating',
    'leaderboards&rank=brews', 'habits', 'consumption', 'milestones', 'insights'] as const).map((t) => ({
    name: `insights-switch-placement-${t.replace(/\W+/g, '-')}`, path: () => `/insights?tab=${t}`,
    act: async (page: Page) => {
      const on = !/rank=|^(habits|consumption|milestones|insights)$/.test(t);
      const bar = page.locator('.filter-bar');
      await expect(bar.getByRole('button', { name: /^Ratings and brews/ })).toHaveCount(on ? 1 : 0);
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
      if (!on) return;
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
    name: 'insights-dial-records-sticky', path: () => '/insights?tab=records',
    act: async (page) => {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 3));
      const y = await page.evaluate(() => scrollY);
      const menu = page.locator('.filter-bar').getByRole('button', { name: /^Ratings and brews/ });
      await expect(menu).toBeInViewport();
      for (const [name, button, url, label] of [['Brews', 'All brews', /dial=all/, /Calibrated ratings · All brews/], ['Ratings', 'All ratings', /ratings=all/, /All ratings · All brews/]] as const) {
        await menu.click();
        await page.getByRole('group', { name, exact: true }).getByRole('button', { name: button, exact: true }).click();
        await expect(page).toHaveURL(url);
        await expect(menu).toHaveAccessibleName(label);
        await page.waitForTimeout(600);
        expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(5);
        await page.keyboard.press('Escape');
      }
    }
  },
  {
    // Reset clears every choice but a non-default tab; tab choices survive a tab switch.
    name: 'insights-reset',
    path: () => '/insights?tab=habits&range=1w&measure=grams&ratings=all',
    act: async (page) => {
      await page.getByLabel('View').selectOption('consumption');
      await expect(page).toHaveURL(/tab=consumption/);
      await expect(page).toHaveURL(/measure=grams/);
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(page).toHaveURL(/\/insights\?tab=consumption$/);
    }
  },
  {
    // Consumption: 4 tiles in the same columns as Totals, deltas on the three rates only.
    name: 'insights-consumption', viewports: 'two',
    path: () => '/insights?range=1w&compare=1',
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
    path: () => '/insights?range=1w&compare=before',
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
    path: () => '/insights?range=1w',
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
    path: () => '/insights?range=1w',
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
    path: () => `/insights?range=${daysAgo(40)}..${daysAgo(10)}&compare=1`,
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
    path: () => '/insights?tab=consumption&by=month&range=1w',
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
    name: 'insights-people-person',
    path: () => '/insights?range=1w&compare=1',
    act: async (page) => {
      const people = page.getByRole('group', { name: 'People' });
      await people.getByRole('button', { name: 'Per person', exact: true }).click();
      await expect(page).toHaveURL(/people=person/);
      await expect(people.getByRole('button', { name: 'Per person', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const tile = (label: RegExp) => page.locator('.stat-item').filter({ has: page.locator('.stat-label', { hasText: label }) });
      await expect(tile(/^Brews · per person$/).locator('.stat-value')).toHaveText(/^(\d\.\d|\d{2,}[\d,]*)$/);
      await expect(tile(/^Rated · (Calibrated|All) ratings · per person$/)).toHaveCount(1);
      await expect(tile(/^Avg dose$/)).toHaveCount(1);
      await tile(/^Grams · per person$/).getByRole('button', { name: 'per person' }).click();
      await expect(page.locator('.mode-tip:popover-open')).toContainText('even split');
    }
  },
  {
    // Mouse hover opens a click-for-explanation tip and leaving closes it; a click then keeps it open.
    // Touch viewports (no hover) only get the tap path, covered by insights-ratings-tip.
    name: 'insights-tip-hover', viewports: 'two',
    path: () => '/insights',
    act: async (page) => {
      const btn = page.locator('.mode-tip-button').first();
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
    path: () => '/insights?tab=leaderboards',
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
    path: () => '/insights',
    act: async (page) => {
      await page.locator('.mode-tip-button').first().click();
      const tip = page.locator('#tip-rated');
      await expect(tip).toBeVisible();
      await expect(tip.locator('.tip-title')).toHaveText('Calibrated ratings');
      await expect(tip.locator('.tip-lines li').first()).toHaveText(/^Calibrated ratings leaves out ratings before \w+ \d{4}, while the rating scale was still settling\.$/);
      await expect(tip.locator('.tip-lines li').nth(1)).toContainText('dial-in brews');
      await expect(page.locator('.mode-tip-button').first()).toHaveAccessibleDescription(/still settling/);
      const r = (await tip.boundingBox())!;
      const vw = page.viewportSize()!.width;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(vw);
    }
  },
  {
    name: 'insights-leaderboards',
    path: () => '/insights?tab=leaderboards',
    act: async (page) => {
      await expect(page.locator('.board')).toHaveCount(9);
      await expectEqualBoardHeights(page);
      await expectBarHover(page);
      await expectSampleChips(page);
    }
  },
  { name: 'insights-sample-note', path: () => '/insights?tab=leaderboards&avg=raw',
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
  { name: 'insights-sample-marks', path: () => '/insights?tab=brewing&grinder=zp6-special',
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
  { name: 'insights-sample-habits', path: () => '/insights?tab=habits&measure=rating&range=all',
    act: async (page) => expect(page.locator('.heat-cell.small-sample-mark').first()).toBeVisible() },
  { name: 'insights-settle-dripper-water', viewports: 'two', path: () => '/insights?tab=brewing&range=all',
    act: async (page) => {
      for (const k of ['dripper', 'water']) {
        const sec = page.locator(`[data-section="brewing-settle-${k}"]`);
        await expect(sec).toBeVisible();
        expect(await sec.locator('.settle-cols .col').count()).toBeGreaterThanOrEqual(2);
        await expect(sec.locator('.chart-note')).not.toContainText('filter not applied');
      }
    } },
  { name: 'insights-settle-own-axis', viewports: 'two', path: () => '/insights?tab=brewing&range=all&dripper=V60',
    act: async (page) => {
      const sec = page.locator('[data-section="brewing-settle-dripper"]');
      await expect(sec).toBeVisible();
      expect(await sec.locator('.settle-cols .col').count()).toBeGreaterThanOrEqual(2);
      await expect(sec.locator('.chart-note')).toContainText('Dripper filter not applied');
      await expect(sec.locator('.settle-cols .col').first()).toHaveAttribute('aria-label', /Median settle brew/);
    } },
  { name: 'insights-sample-legend', viewports: 'two', path: () => '/insights?tab=brewing',
    act: async (page) => {
      await page.locator('[data-section="brewing-rest"] .mode-tip-button').first().click();
      await expect(page.locator('.mode-tip:popover-open')).toContainText('Only 2 bags');
      await expect(page.locator('.mode-tip:popover-open')).toContainText('low confidence, under 3 bags or 10 rated brews');
      await expect(page.locator('.mode-tip:popover-open .sample-chip')).toBeVisible();
    } },
  { name: 'insights-strength-badges', viewports: 'two', path: () => '/insights?tab=sweetspots',
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
    path: () => '/insights',
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
    path: () => '/insights?recentc=50',
    act: async (page) => {
      const foot = page.locator('section.recent .top-foot').nth(1);
      await expect(foot.getByRole('button', { name: 'Show less' })).toBeVisible();
      await expect(foot.getByRole('button', { name: 'Show more' })).toHaveCount(0);
    }
  },
  {
    // Recent expanded: Show less sits left of Show more; rows read row by row in two columns (one on phones).
    name: 'insights-recent-more',
    path: () => '/insights?recent=20',
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
    path: () => '/insights',
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
    path: () => '/insights?tab=leaderboards&avg=best&range=12m&compare=1',
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
    path: () => '/insights?tab=leaderboards',
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
    path: () => '/insights',
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
    path: () => '/insights?tab=leaderboards&rank=ppg',
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
    path: () => '/insights?tab=leaderboards&range=all',
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
    path: () => '/insights?tab=leaderboards&range=all&avg=raw',
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
    path: () => '/insights?tab=leaderboards&range=all&dial=all&roaster=The%20Picky%20Chemist',
    act: async (page) => {
      const val = page.locator('[data-board="coffees"] .board-row.bar .val');
      await expect(val).toHaveCount(1);
      await expect(val.locator('.text-tip')).toHaveCount(0);
      // Nothing in the value is dotted (the underline lives on a .text-tip, never on .val itself).
      expect(await val.evaluate((v) => [v, ...v.querySelectorAll('*')].filter((e) => getComputedStyle(e).textDecorationLine.includes('underline')).length)).toBe(0);
      // Default (Confidence adj., Once dialed): every Coffees tip shows a differing plain average or both counts.
      await gotoReady(page, '/insights?tab=leaderboards&range=all');
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
  { name: 'insights-board-jump', path: () => '/insights?tab=leaderboards&range=all',
    act: async (page) => {
      // One jump link per board; a click lands the card's top just under the sticky bar.
      const links = page.locator('.board-jump a');
      await expect(links).toHaveCount(9);
      await links.filter({ hasText: 'Origins' }).click();
      await expect(page).toHaveURL(/#leaderboard-origins$/);
      const gap = () => page.evaluate(() =>
        document.getElementById('leaderboard-origins')!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom);
      await expect.poll(gap).toBeGreaterThanOrEqual(-1);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  // Jump-to chips on every tab with 3+ sections (milestones has its own ruler; sweet spots has only two sections).
  ...['overview', 'habits', 'consumption', 'records', 'insights', 'brewing', 'water', 'gear', 'milestones', 'sweetspots'].map((tab) => ({
    name: `insights-jump-${tab}`, path: () => `/insights?tab=${tab}&range=all`,
    act: async (page: Page) => {
      const links = page.locator('.board-jump a');
      if (tab === 'milestones' || tab === 'sweetspots') return void (await expect(links).toHaveCount(0));
      expect(await page.evaluate(() => { const seen = new Set<string>(); return [...document.querySelectorAll('[id]')].map((e) => e.id).filter((i) => seen.size === seen.add(i).size); })).toEqual([]);
      // One chip per rendered section; a click is a hash jump (no reload) landing the section just under the sticky bar.
      expect(await links.count()).toBeGreaterThan(2);
      await page.evaluate(() => ((window as unknown as { __jump: number }).__jump = 1));
      const gap = (id: string) => page.evaluate((i) => document.getElementById(i)!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom, id);
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
  { name: 'insights-board-time', path: () => '/insights?tab=leaderboards&range=12m&views=dripper-time',
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
  { name: 'insights-board-expand', path: () => '/insights?tab=leaderboards&range=12m&views=roast-time',
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
    } },
  { name: 'insights-board-dashed-gaps', path: () => '/insights?tab=leaderboards&range=1m&rank=brews&views=roast-time,water-time,dripper-time,filter-time,grinder-time,process-time',
    act: async (page) => {
      // Brews / Grams / Spend plot a no-data period as 0: no dashes, no note. Ratings bridge it with a dashed segment and say so.
      await expect(page.locator('.board canvas').first()).toBeVisible();
      await expect(page.locator('.board .chart-note').filter({ hasText: 'Dashed' })).toHaveCount(0);
      await gotoReady(page, page.url().replace('&rank=brews', ''));
      await expect(page.locator('.board .chart-note').filter({ hasText: /Dashed: \w+s with no data/ }).first()).toBeVisible();
    } },
  { name: 'insights-board-time-size', path: () => '/insights?tab=leaderboards&range=all&avg=raw',
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
      await expect(card.locator('.chart-note')).toContainText('all 7');
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
  { name: 'insights-board-time-beside-open', path: () => '/insights?tab=leaderboards&range=all&avg=raw&views=grinder-time&open=dripper',
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
  { name: 'insights-board-open-independent', path: () => '/insights?tab=leaderboards&range=all&avg=raw',
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
  { name: 'insights-board-no-rerender', viewports: 'two', path: () => '/insights?tab=leaderboards&range=all&avg=raw&views=grinder-time,process-time',
    act: async (page) => {
      // Show all and the expand toggle are view-only: no data request, and the other tiles' charts are not rebuilt (a rebuilt
      // chart re-runs its animation, which rewrites data-dashed-segments; the marker below is cleared first).
      const charts = page.locator('.board canvas');
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
  { name: 'insights-board-views-url', viewports: 'two', path: () => '/insights?tab=leaderboards&range=all',
    act: async (page) => {
      // The view is URL state: absent = List, a pick shows in the URL and survives a reload, List drops it again.
      const card = () => page.locator('.board[data-board=roast]');
      await expect(card().getByRole('button', { name: 'List', pressed: true })).toBeVisible();
      await card().getByRole('button', { name: 'Over time' }).click();
      await expect(page).toHaveURL(/views=roast-time/);
      await reloadReady(page);
      await expect(card().getByRole('button', { name: 'Over time', pressed: true })).toBeVisible();
      await page.goto(page.url().replace('views=roast-time', 'views=roast-time-wide'));
      await expect(card().getByRole('button', { name: 'Over time', pressed: true })).toBeVisible();
      await expect(card()).toHaveClass(/wide/);
      await card().getByRole('button', { name: 'List' }).click();
      await expect(page).not.toHaveURL(/views=/);
    } },
  { name: 'insights-leaderboards-sticky', path: () => '/insights?tab=leaderboards', act: (page) => expectStickyBar(page, page.locator('.filter-bar')) },
  {
    name: 'insights-leaderboards-spend-compare',
    path: () => '/insights?tab=leaderboards&rank=spend&range=12m&compare=1',
    act: async (page) => {
      await expectEmptyGearCards(page);
      await expect(page.locator('.board .move').first()).toBeVisible();
      await expectEqualBoardHeights(page);
    }
  },
  {
    // $/g rows carry the spend and grams behind it, still one line high.
    name: 'insights-leaderboards-ppg',
    path: () => '/insights?tab=leaderboards&rank=ppg',
    act: async (page) => {
      for (const b of ['roasters', 'coffees'])
        await expect(page.locator(`.board[data-board="${b}"] .board-row small`).first()).toHaveText(/bags? · \$[\d,.]+ · [\d.]+k?g$/);
      await expectEqualBoardHeights(page);
    }
  },
  { name: 'insights-leaderboards-like', path: () => '/insights?tab=leaderboards&rank=like&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="coffees"] .board-row:not(.placeholder)').first()).toBeVisible();
      await expect(page.locator('.like-note')).toHaveText("vs like coffees ranks coffees and roasters only. A roaster is compared with other roasters' coffees. Coffees with too few like coffees to compare, or under 4 rated brews, are left out.");
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
  { name: 'insights-like-lines', path: () => '/insights?tab=leaderboards&range=all',
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
  { name: 'insights-like-lines-brews', path: () => '/insights?tab=leaderboards&rank=brews&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="coffees"] .like-line').first()).toHaveText(/^([+−]\d\.\d|0\.0) vs .+ coffees/);
      await page.getByLabel('Rank by').selectOption('spend');
      await expect(page.locator('[data-board="coffees"] .like-line').first()).toBeVisible();
    } },
  // Gate P4: a cut like line opens its full text (the shared FloatTip) on tap, hover and keyboard focus/Enter (the line
  // is narrowed so every viewport has one cut); one tip at a time; a whole line's tap goes on to the row's link.
  { name: 'insights-like-line-tip', path: () => '/insights?tab=leaderboards&range=all',
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
  { name: 'insights-leaderboards-like-tip', path: () => '/insights?tab=leaderboards&rank=like&range=all',
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
  { name: 'insights-totals-value-color', viewports: 'two', path: () => '/insights?range=all',
    act: async (page) => {
      const color = (panel: string) => page.locator('section.chart-panel', { has: page.getByRole('heading', { name: panel, exact: true }) }).locator('.stat-value').first().evaluate((e) => getComputedStyle(e).color);
      expect(await color('Totals')).toBe(await color('Averages'));
    } },
  // Show all / Show fewer on a board and on a Water pair end clear of Back to top too.
  { name: 'insights-leaderboards-show-all-clear', path: () => '/insights?tab=leaderboards&range=all',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const btn = page.locator('.board-foot button').first();
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b = (await btn.boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page).toHaveURL(/open=/);
      await expectClearOfBackToTop(page, page.locator('.board.open .board-foot button'));
    } },
  { name: 'insights-water-show-all-clear', path: () => '/insights?tab=water',
    act: async (page) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const btn = page.locator('.pair-more').first();
      await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b = (await btn.boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await expect(page).toHaveURL(/pairs=/);
      await expectClearOfBackToTop(page, page.locator('.pair-more').first());
    } },
  { name: 'insights-leaderboards-like-open', path: () => '/insights?tab=leaderboards&rank=like&range=all&open=coffees',
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
    path: () => '/insights?tab=leaderboards&rank=spend&open=coffees',
    act: async (page) => {
      const coffees = page.locator('.board[data-board="coffees"]');
      await expect(coffees).toHaveClass(/open/);
      await expect(coffees.locator('.board-row.placeholder')).toHaveCount(0);
      await expect(coffees.locator('.board-foot button')).toHaveText('Show top 10');
      await expectEqualBoardHeights(page);
    }
  },
  { name: 'insights-records', path: () => '/insights?tab=records',
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
  { name: 'insights-records-decaf', path: () => '/insights?tab=records&range=all&caffeine=decaf',
    act: async (page) => {
      // Caffeine is page-wide now (the Coffees panel): an explicit Decaf shows as a chip.
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/^Decaf/]);
      await expectGridRowsFull(page, '.record-grid');
    } },
  { name: 'insights-records-top20', path: () => '/insights?tab=records&range=all&top=20',
    act: async (page) => {
      // Show less sits left of Show more.
      const foot = page.locator('#records-top-brews ~ .top-foot');
      const [less, more] = await Promise.all(['Show less', 'Show more'].map((n) => foot.getByRole('button', { name: n }).boundingBox()));
      expect(less!.x).toBeLessThan(more!.x);
      await expect(page.locator('#records-top-brews + ol li')).not.toHaveCount(10);
    } },
  { name: 'insights-records-top50', path: () => '/insights?tab=records&range=all&top=50',
    act: async (page) => {
      const foot = page.locator('#records-top-brews ~ .top-foot');
      await expect(foot.getByRole('button', { name: 'Show less' })).toBeVisible();
      await expect(foot.getByRole('button', { name: 'Show more' })).toHaveCount(0);
      // Show less steps back one level: 50 → 20.
      await foot.getByRole('button', { name: 'Show less' }).click();
      await expect(page).toHaveURL(/top=20/);
    } },
  { name: 'insights-records-topc20', path: () => '/insights?tab=records&range=all&topc=20',
    act: async (page) => {
      // The seed has under 11 coffees with 3+ ratings: the list shows them all, with no controls.
      await expect(page.locator('#records-top-coffees')).toBeVisible();
      await expect(page.locator('#records-top-coffees + ol li').first()).toBeVisible();
    } },
  { name: 'insights-records-anchor', path: () => '/insights?tab=records#record-nightOwl',
    act: async (page) => {
      // The tile's top lands just under the sticky filter bar; a filter change keeps the hash.
      const gap = () => page.evaluate(() =>
        document.getElementById('record-nightOwl')!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom);
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
      await page.getByRole('button', { name: /^Filters/ }).click();
      await page.getByRole('dialog', { name: 'Filters' }).getByLabel('Caffeine').selectOption('decaf');
      await expect(page).toHaveURL(/caffeine=decaf#record-nightOwl$/);
    } },
  { name: 'insights-overview-anchor', path: () => '/insights?tab=overview#overview-avg-brew-time',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#overview-avg-brew-time a.caption-link')).toHaveAttribute('href', '#overview-avg-brew-time');
      const gap = () => page.evaluate(() =>
        document.getElementById('overview-avg-brew-time')!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom);
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-habits-anchor', path: () => '/insights?tab=habits#habits-current-streak',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#habits-current-streak a.caption-link')).toHaveAttribute('href', '#habits-current-streak');
      const gap = () => page.evaluate(() =>
        document.getElementById('habits-current-streak')!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom);
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-consumption-anchor', path: () => '/insights?tab=consumption#consumption-brewed',
    act: async (page) => {
      // The caption links to its tile; loading the hash puts the tile's top just under the sticky bar.
      await expect(page.locator('#consumption-brewed a.caption-link')).toHaveAttribute('href', '#consumption-brewed');
      const gap = () => page.evaluate(() =>
        document.getElementById('consumption-brewed')!.getBoundingClientRect().top - document.querySelector('.filter-bar')!.getBoundingClientRect().bottom);
      await expect.poll(gap).toBeGreaterThanOrEqual(0);
      expect(await gap()).toBeLessThanOrEqual(16);
    } },
  { name: 'insights-records-soup', path: () => '/insights?tab=records&brewer=soup',
    act: async (page) => expect(page.getByRole('button', { name: 'Soup', pressed: true })).toBeVisible() },
  { name: 'insights-records-compare', path: () => '/insights?tab=records&range=1w&compare=1' },
  { name: 'insights-records-all-ratings', path: () => '/insights?tab=records&ratings=all',
    act: async (page) => {
      await page.locator('.record-ties').first().click(); // tie tip opens on tap
      await expect(page.locator('.mode-tip:popover-open')).toBeVisible();
    } },
  // Tile rows at a fractional width (Windows Firefox at 150% scaling gave a 1174.67px row) keep their columns: six
  // exact shares rounded up once overflowed into 5+1. A fractional main padding makes the row fractional.
  {
    name: 'insights-fit-fractional',
    path: () => '/insights?range=all',
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
    path: () => '/insights?range=all',
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
          const url = `/insights?range=all${q}`;
          await at(w - 176, 499, url);
          const today = await settled();
          await at(w, 900, url);
          expect(await settled(), `${w}px tab${q || '=overview'}: as without the rail at ${w - 176}px`).toEqual(today);
        }
      // Full width from 1416px: every tab's content column is 1240 - 2rem.
      await at(1436, 900, '/insights?range=all');
      for (const t of await rail.locator('a').all()) {
        await gotoReady(page, (await t.getAttribute('href'))!.replace(/^\?/, '/insights?'));
        expect(Math.round((await main.boundingBox())!.width), (await t.textContent()) ?? '').toBe(1208);
      }
      // Milestones: the ruler is left of the feed without the rail, right of it beside the rail.
      const rulerX = async () => (await page.locator('nav.ruler').boundingBox())!.x - (await page.locator('.feed').boundingBox())!.x;
      await at(999, 800, '/insights?tab=milestones&range=all');
      expect(await rulerX()).toBeLessThan(0);
      await at(1436, 900, '/insights?tab=milestones&range=all');
      expect(await rulerX(), 'ruler right of the feed beside the rail').toBeGreaterThan(0);
      // A rail link switches the tab, keeps the other params and marks itself current.
      await gotoReady(page, '/insights?range=all&tab=habits');
      await expect(rail.locator('[aria-current="page"]')).toHaveText('Habits');
      await rail.getByRole('link', { name: 'Records', exact: true }).click();
      await expect(rail.locator('[aria-current="page"]')).toHaveText('Records');
      await expect(page.getByRole('combobox', { name: 'View' })).toHaveValue('records');
      const u = new URL(page.url());
      expect([u.searchParams.get('tab'), u.searchParams.get('range')]).toEqual(['records', 'all']);
      await expect(rail.getByRole('group', { name: 'Lab' }).getByRole('link')).toHaveText(['Sweet spots', 'Brewing', 'Water', 'Gear']);
      await at(1280, 800, '/insights?range=all');
    }
  },
  // A feed shorter than the full side ruler caps it to the feed: it never sticks out below (M10). A window
  // taller than the week's feed makes it short whatever the data; checked at w1280 (the side ruler).
  { name: 'insights-milestones-short', path: () => '/insights?tab=milestones&range=1w',
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
  { name: 'insights-milestones', path: () => '/insights?tab=milestones&range=all',
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
        const seen: { y: number; h: number; why: string }[] = [];
        // Until the feed is off the top or the page can't scroll further: below the feed sit Next up and the
        // footer, so on a tall screen the feed's end never leaves it and a feed-only exit ran all 400 steps.
        for (let i = 0, y0 = -1; i < 400 && (await page.locator('.feed').boundingBox())!.y + (await page.locator('.feed').boundingBox())!.height > 0; i++) {
          const y1 = await page.evaluate(() => (scrollBy(0, 250), scrollY));
          await settle();
          if (y1 === y0) break;
          y0 = y1;
          const b = (await ruler.boundingBox())!;
          // What the height was computed from, so a failure says which input moved.
          if (b.y + b.height > 0) seen.push({ y: b.y, h: b.height, why: await ruler.evaluate((e) => `inline ${(e as HTMLElement).style.height || 'none'}, innerHeight ${innerHeight}, bar ${document.querySelector<HTMLElement>('.filter-bar')!.offsetHeight}, scrollY ${scrollY}`) });
        }
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
        const top = r.width > r.height ? r.bottom : (document.querySelector('.filter-bar') as HTMLElement).offsetHeight;
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
  { name: 'insights-milestones-month-link', path: () => '/insights?tab=milestones&range=all',
    act: async (page) => {
      // A month header's #anchor lands it under the sticky bars, and survives a filter change (M9).
      const id = (await page.locator('.feed .month').nth(1).getAttribute('id'))!;
      // about:blank first: a real load, so the page's own on-load hash scroll runs (not a same-page jump).
      await page.goto('about:blank');
      await page.goto(`/insights?tab=milestones&range=all#${id}`);
      const head = page.locator(`[id="${id}"]`);
      await expect(head).toBeInViewport();
      await expect(head.locator('a')).toHaveAttribute('href', `#${id}`);
      // Polled: the on-load scroll and the ruler's rAF layout can land after the first read.
      const barBottom = () => page.locator('.filter-bar').evaluate((e) => e.getBoundingClientRect().bottom);
      const below = async (el: typeof head, max: number) => {
        const off = async () => (await el.boundingBox())!.y - (await barBottom());
        await expect.poll(off).toBeGreaterThanOrEqual(-1);
        await expect.poll(off).toBeLessThan(max);
      };
      await below(head, 80);
      await page.getByRole('group', { name: 'Kinds' }).getByRole('button', { name: 'Counts' }).click();
      await expect(page).toHaveURL(new RegExp(`kinds=counts.*#${id}$`));
      // A month outside the period: no error, the page stays at the top.
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/insights?tab=milestones&range=1w#m-2000-01');
      await expect(page.locator('nav.ruler, .hl-empty').first()).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(errors).toEqual([]);
      // A tile's caption links its own anchor, which lands the tile under the sticky bar (M12).
      await page.goto('/insights?tab=milestones&range=all#milestones-total-brews');
      const tile = page.locator('#milestones-total-brews');
      await expect(tile.locator('.caption-link')).toHaveAttribute('href', '#milestones-total-brews');
      await below(tile, 40);
    } },
  { name: 'insights-milestones-firsts', path: () => '/insights?tab=milestones&range=all&kinds=firsts' },
  { name: 'insights-milestones-compare', path: () => '/insights?tab=milestones&range=1w&compare=1' },
  { name: 'insights-sweetspots', path: () => '/insights?tab=sweetspots',
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
      await gotoReady(page, '/insights?tab=brewing');
      const titles: string[] = [];
      for (const row of await page.locator('[data-section="brewing-grind"] .bar-row').all()) {
        await row.locator('.bar-label').click();
        titles.push((await page.locator('[data-section="brewing-grind"] .cell-tip .tip-title').first().textContent())!.trim());
      }
      expect(spotBands).toEqual(titles);
      await gotoReady(page, '/insights?tab=sweetspots');
    } },
  { name: 'insights-sweetspots-bag', path: (s) => `/insights?tab=sweetspots&bag=${s.slugs.linked}&roast=Light&process=Washed`,
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
  { name: 'insights-sweetspots-filters', path: () => '/insights?tab=sweetspots&roast=Ultralight&process=Natural&origin=Ethiopia&roaster=Lab%20Roasters',
    act: async (page) => {
      // The Coffees fields live only in the Coffees panel (ui-rules 6): Sweet spots keeps Bag (and Grinder).
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/Ultralight/, /Natural/, /Ethiopia/, /Lab Roasters/]);
      await expect(page.locator('.spot-picker').getByLabel('Process')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Reset picker' })).toHaveCount(0);
    } },
  // Gate P4: Brews until dialed in by roast level and by process, beside each other from 900px; whole group names.
  { name: 'insights-brewing-settle', path: () => '/insights?tab=brewing&range=all#brewing-settle-roast',
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
  { name: 'insights-sweetspots-words', path: () => '/insights?tab=sweetspots&range=all',
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
    name: 'insights-sweetspots-no-card-popover',
    path: () => '/insights?tab=sweetspots',
    act: async (page) => {
      const card = page.locator('.spot-card').first();
      const b = (await card.boundingBox())!;
      await page.mouse.click(b.x + 3, b.y + b.height / 2); // the card's left padding
      await expect(page.locator(':popover-open')).toHaveCount(0);
      const bad = await page.locator('.spot-card').evaluateAll((cs) => cs.filter((c) => (c as HTMLElement).dataset.tight && !c.querySelector('.hl-value .text-tip')).map((c) => c.id));
      expect(bad, 'tightened cards without a full-text tip on the value').toEqual([]);
    }
  },
  { name: 'cursor-rules', viewports: 'two', path: () => '/insights?tab=habits',
    act: async (page) => {
      // ui-rules 50: text shows the arrow yet stays selectable; a tip trigger shows help, never the hand; a link the hand.
      const css = (sel: string) => page.locator(sel).first().evaluate((e) => [getComputedStyle(e).cursor, getComputedStyle(e).userSelect]);
      expect(await css('.stat-item .stat-value')).toEqual(['default', 'auto']);
      expect(await css('h1')).toEqual(['default', 'auto']);
      for (const sel of ['.heatmap .heat-cell', '.brew-calendar .cal-cell']) expect((await css(sel))[0], sel).toBe('help');
    } },
  { name: 'cursor-rules-fields', path: () => '/subscriptions?view=list',
    act: async (page) => {
      // The I-beam only in a field meant for typing; buttons and links the hand; a ? help trigger help.
      const cur = (l: Locator) => l.first().evaluate((e) => getComputedStyle(e).cursor);
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      expect(await cur(page.locator('input[name="subscription_name"]'))).toBe('text');
      expect(await cur(page.locator('td'))).toBe('default');
      expect(await cur(page.locator('main button:not(:disabled)'))).toBe('pointer');
      await page.goto('/insights');
      expect(await cur(page.locator('.stat-item .caption-link'))).toBe('pointer');
      expect(await cur(page.locator('.mode-tip-button'))).toBe('help');
    } },
  // Tips open only on their marks (ui-rules 50): a chart's empty space opens none and keeps the arrow; a bar or a line's
  // point opens it with the help cursor.
  { name: 'tip-hit-chart-bars', path: () => '/stats',
    act: (page) => expectChartMarkOnly(page, page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Top Coffees by Category' }) }).locator('canvas')) },
  { name: 'tip-hit-chart-line', path: () => '/insights?tab=consumption',
    act: (page) => expectChartMarkOnly(page, page.locator('.chart-container canvas').first()) },
  { name: 'tip-hit-delta-bars', path: () => '/insights?tab=brewing&range=all',
    act: (page) => expectMarkOnly(page, page.locator('[data-section="brewing-temp"] .track'), '.bar', page.locator('.cell-tip:popover-open')) },
  { name: 'insights-findings-headline-clamp', path: () => '/insights?tab=insights&range=all',
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
  { name: 'insights-findings-headline-tip', path: () => '/insights?tab=insights&range=all',
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
  { name: 'insights-findings-list-head-tips', viewports: 'two', path: () => '/insights?tab=insights&range=all',
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
  { name: 'insights-findings-gear-switch', path: () => '/insights?tab=insights&range=3m',
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
  { name: 'insights-milestones-ruler-cursor', path: () => '/insights?tab=milestones&range=all',
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
  { name: 'tip-hit-findings', path: () => '/insights?tab=insights&range=all',
    act: async (page) => {
      // A finding card's empty space opens nothing; its clamped body opens the full text (hover, then a click keeps it).
      const card = page.locator('.finding-grid .hl-card').first();
      const b = (await card.boundingBox())!;
      await page.mouse.move(b.x + 3, b.y + b.height / 2);
      await page.mouse.click(b.x + 3, b.y + b.height / 2);
      await expect(page.locator(':popover-open')).toHaveCount(0);
      const i = await page.locator('.finding-grid .hl-card').evaluateAll((cs) => {
        const j = cs.findIndex((c) => c.querySelector('.body'));
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
    act: (page) => expectTapTip(page, page.locator('.stat-item', { hasText: 'Time to clear' }).getByRole('button', { name: 'per person' }),
      page.locator('.mode-tip:popover-open'), page.getByRole('heading', { name: 'Time to Clear' })) },
  { name: 'tap-tip-chart', viewports: 'two', path: () => '/stats',
    act: async (page) => {
      const panel = page.locator('section.chart-panel').filter({ has: page.getByRole('heading', { name: 'Top Coffees by Category' }) });
      await expectTapTip(page, () => tapChart(page, panel.locator('canvas')), page.locator('.chart-container .cell-tip:popover-open'), panel.locator('h2'));
    } },
  { name: 'tap-tip-sample', viewports: 'two', path: () => '/insights?tab=leaderboards&avg=raw',
    act: (page) => expectTapTip(page, page.locator('.sample-note').first(), page.locator('.cell-tip:popover-open'), page.locator('.insights-period').last()) },
  { name: 'tap-tip-label', viewports: 'two', path: () => '/insights?tab=habits&range=1w&compare=1',
    act: (page) => expectTapTip(page, page.locator('.insights-delta').first(), page.locator('.cell-tip:popover-open'), page.locator('h1')) },
  { name: 'tap-tip-heatmap', viewports: 'two', path: () => '/insights?tab=habits',
    act: async (page) => {
      const tip = page.locator('.cell-tip:popover-open'), away = page.locator('.insights-period').last();
      await expectTapTip(page, page.locator('.heatmap .heat-cell').nth(10), tip, away);
      await expectTapTip(page, page.locator('.brew-calendar .cal-cell').last(), tip, away);
    } },
  { name: 'tap-tip-map', viewports: 'two', path: () => '/insights?tab=leaderboards&rank=brews',
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
  { name: 'insights-brewing', path: () => '/insights?tab=brewing',
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
          const bar = document.querySelector('.filter-bar')!.getBoundingClientRect().bottom;
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
    name: `insights-brewing-by-${by}`, path: () => `/insights?tab=brewing&tempBy=${by}`,
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
  { name: 'insights-brewing-exact', path: () => '/insights?tab=brewing&temp=exact',
    act: async (page) => {
      // Each chart's toggle is its own: temp=exact leaves Grind on bands.
      await expect(page.getByRole('group', { name: 'Temp bands' }).getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('group', { name: 'Grind bands' }).getByRole('button', { name: 'Exact' })).toHaveAttribute('aria-pressed', 'false');
      const bold = page.locator('[data-section="brewing-temp"] .bar-label.bold');
      await expect(bold).toHaveText(['88 °C', '91 °C', '92 °C', '94 °C']);
    } },
  { name: 'insights-brewing-zp6', viewports: 'two', path: () => '/insights?tab=brewing&grinder=zp6-special',
    act: async (page) => {
      await expect(page.getByLabel('Grinder')).toHaveValue('zp6-special');
      await expect(page.locator('[data-section="brewing-grind"] .bar-row.small').first()).toBeVisible();
      // ZP6 half-number bands are labeled by their first setting, the tip gives the range (no-match bands: vitest).
      const grind = page.locator('[data-section="brewing-grind"]');
      await expect(grind.locator('.bar-label')).toHaveText(['5.0', '5.5', '6.0']);
      await grind.locator('.bar-row .bar-label').first().click();
      await expect(grind.locator('.cell-tip .tip-title').first()).toHaveText('5.0 – 5.4');
    } },
  { name: 'insights-brewing-tip', viewports: 'two', path: () => '/insights?tab=brewing',
    act: async (page) => {
      await page.locator('[data-section="brewing-temp"] .bar-row .bar-label').first().click();
      await expect(page.locator('[data-section="brewing-temp"] .cell-tip')).toContainText(/brews/);
    } },
  ...(['ratio', 'dose', 'time', 'bloom', 'grind'] as const).map((v) => ({
    name: `insights-brewing-${v}-by-roast`, path: () => `/insights?tab=brewing&${v}By=roast`,
    act: async (page: Page) => {
      await expect(page.locator(`[data-section="brewing-${v}"] .heatmap.diverging`)).toBeVisible();
      await expectInnerScroll(page, '.heatmap.diverging .scroll');
    } })),
  { name: 'insights-brewing-all-ratings', path: () => '/insights?tab=brewing&ratings=all' },
  { name: 'insights-sweetspots-grinder', path: () => '/insights?tab=sweetspots&grinder=zp6-special',
    act: async (page) => {
      await expect(page.getByLabel('Grind for:')).toHaveValue('zp6-special');
      const name = await page.getByLabel('Grind for:').locator('option:checked').innerText();
      await expect(page.locator('#spot-grind .hl-caption')).toContainText(`Grind · ${name}`); // only this card follows the grinder
      await expect(page.locator('#spot-temp .hl-caption')).not.toContainText(name);
      await expectGridRowsFull(page, '.spot-grid');
    } },
  ...(['sweetspots', 'brewing', 'water', 'gear'] as const).map((tab) => ({
    name: `insights-lab-empty-${tab}`, path: () => `/insights?tab=${tab}&range=2000-01-01..2000-01-31`,
    act: async (page: Page) => {
      await expect(page.getByText(/^No rated brews (with [a-z ]+ )?in this period\.$/)).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
      await expectShortEmpty(page);
    } })),
  // Gate 3: a truly empty tab's panels are one short line each (no tall blank chart areas).
  ...(['consumption', 'leaderboards', 'habits'] as const).map((tab) => ({
    name: `insights-empty-${tab}`, path: () => `/insights?tab=${tab}&range=2000-01-01..2000-01-31`,
    act: async (page: Page) => {
      await expect(page.locator('section.chart-panel:has(.hl-empty)')).toHaveCount(1);
      await expectShortEmpty(page);
    } })),
  { name: 'insights-lab-no-compare', path: () => '/insights?tab=gear&range=12m&compare=1&people=person&grinder=zp6-special',
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
  { name: 'insights-lab-reset', viewports: 'two', path: () => '/insights?tab=brewing&tempBy=roast&temp=exact&grinder=zp6-special',
    act: async (page) => {
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page).toHaveURL(/\/insights\?tab=brewing$/);
    } },
  { name: 'insights-remembered', viewports: 'two', path: () => '/insights?tab=habits&range=1w',
    act: async (page) => {
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights\?range=1w&tab=habits$/); // restored into the URL
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page).toHaveURL(/\/insights\?tab=habits$/); // filters cleared, tab kept
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights\?tab=habits$/); // remembered: the tab, bare filters
      await gotoReady(page, '/insights?tab=leaderboards'); // no filters: the tab alone is remembered
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights\?tab=leaderboards$/);
      await gotoReady(page, '/insights?range=3m'); // a link with params wins and is remembered
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights\?range=3m$/);
    } },
  // An in-page nav back to the bare URL removes the remembered state: a later bare visit stays bare.
  { name: 'insights-remembered-bare', path: () => '/insights?dial=all',
    act: async (page) => {
      await openSwitches(page);
      await page.getByRole('group', { name: 'Brews' }).first().getByRole('button', { name: 'Once dialed', exact: true }).click();
      await expect(page).toHaveURL(/\/insights$/);
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights$/);
    } },
  { name: 'insights-coffees-panel', path: () => '/insights',
    act: async (page) => {
      await expect(page.locator('.filters-field > span')).toHaveText('Show'); // its small label, like the bar's others
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT'); // no keyboard pop
      await dlg.getByLabel('Process').selectOption('Washed');
      await expect(page).toHaveURL(/process=Washed/);
      await dlg.getByLabel('Caffeine').selectOption('decaf');
      await expect(page).toHaveURL(/caffeine=decaf/);
      // The whole panel fits the viewport (phone landscape is 333px tall).
      const box = (await dlg.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await dlg.evaluate((d) => d.scrollHeight - d.clientHeight)).toBeLessThanOrEqual(1);
      await dlg.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('2');
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/Washed/, /Decaf/]);
    } },
  // Brew filters in the Filters dialog (Part 1): one select each on the tabs that use it; chips for any tab, muted off-tab.
  { name: 'insights-brew-dialog', path: () => '/insights',
    act: async (page) => {
      await page.getByRole('button', { name: /^Filters/ }).click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      for (const l of ['Dripper', 'Filter', 'Water', 'Dose', 'Temp']) await expect(dlg.getByLabel(l, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('SELECT');
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await expect(page).toHaveURL(/dripper=V60/);
      await dlg.getByLabel('Dose', { exact: true }).selectOption({ label: '15g' });
      await expect(page).toHaveURL(/brewDose=15/);
      const box = (await dlg.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(await dlg.evaluate((d) => d.scrollHeight - d.clientHeight)).toBeLessThanOrEqual(1);
    } },
  { name: 'insights-brew-dialog-gear', path: () => '/insights?tab=gear',
    act: async (page) => {
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await expect(dlg).toBeVisible();
      for (const l of ['Dripper', 'Filter', 'Water', 'Dose', 'Temp']) await expect(dlg.getByLabel(l, { exact: true })).toBeVisible();
    } },
  // Regression: a Dripper pick set back to "Any" in the dialog drops the param and shows every dripper again.
  { name: 'insights-trophy-pick-any', viewports: 'two', path: () => '/insights?tab=gear',
    act: async (page) => {
      const drippers = page.locator('.trophy-card[data-key^="dripper-"]');
      const all = await drippers.count();
      expect(all).toBeGreaterThan(1);
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(drippers).toHaveCount(1);
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('');
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(drippers).toHaveCount(all);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(0);
    } },
  { name: 'insights-brew-pick-any', viewports: 'two', path: () => '/insights',
    act: async (page) => {
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('V60');
      await expect(page).toHaveURL(/dripper=V60/);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(1);
      await dlg.getByLabel('Dripper', { exact: true }).selectOption('');
      await expect(page).not.toHaveURL(/dripper=/);
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(0);
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/dripper=/);
    } },
  { name: 'insights-trophy-pick-any-after-toggle', viewports: 'two', path: () => '/insights?tab=gear',
    act: async (page) => {
      const drippers = page.locator('.trophy-card[data-key^="dripper-"]');
      const all = await drippers.count();
      const pick = async (v: string) => {
        await page.locator('.filters-button').click();
        await page.getByRole('dialog', { name: 'Filters' }).getByLabel('Dripper', { exact: true }).selectOption(v);
        await page.keyboard.press('Escape');
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
  { name: 'insights-brew-chips-muted', path: () => '/insights?tab=habits&dripper=V60&water=Lab%20Water%20A',
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
  { name: 'insights-brew-clear', viewports: 'two', path: () => '/insights?dripper=V60&process=Washed',
    act: async (page) => {
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveCount(2);
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).toHaveURL(/\/insights$/);
    } },
  { name: 'insights-brew-remembered', viewports: 'two', path: () => '/insights?tab=gear&dripper=V60',
    act: async (page) => {
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/dripper=V60/);
    } },
  // Whole-bag notes (Part 1, Task 6): one .chart-note per panel of whole-bag figures, none on brew-level panels.
  { name: 'insights-brew-overview', path: () => '/insights?dripper=V60',
    act: async (page) => {
      const note = (t: RegExp) => page.locator('.chart-panel', { has: page.getByRole('heading', { name: t }) }).locator('.chart-note');
      await expect(note(/^Totals$/)).toHaveText("Spend and Bags finished count whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Consumption$/)).toHaveText("Time to clear counts whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Right now$/)).toHaveText("Whole bags: the dripper filter doesn't apply.");
      await expect(note(/^Totals$/).locator('strong')).toHaveText('Spend and Bags finished count whole bags:');
      await expect(note(/^Averages$/)).toHaveCount(0);
      await expect(page.locator('.chart-panel.recent .chart-note')).toHaveText("Whole bags: the dripper filter doesn't apply.");
    } },
  { name: 'insights-brew-leaderboards-spend', path: () => '/insights?tab=leaderboards&rank=spend&dripper=V60',
    act: async (page) => {
      await expect(page.locator('.chart-note', { hasText: "Whole bags: the dripper filter doesn't apply." })).toHaveCount(1);
      await expectEmptyGearCards(page);
    } },
  { name: 'insights-brew-leaderboards', path: () => '/insights?tab=leaderboards&dripper=V60',
    act: async (page) => {
      // Every board applies every filter, its own included: the Drippers board lists only V60.
      const board = page.locator('[data-board="dripper"]');
      await expect(board).toContainText('V60');
      await expect(board).not.toContainText('Origami');
      await expect(page.locator('.chart-note', { hasText: 'Whole bags' })).toHaveCount(0);
    } },
  { name: 'insights-brew-habits', path: () => '/insights?tab=habits&brewDose=15',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-consumption', path: () => '/insights?tab=consumption&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: "the dripper filter doesn't apply" });
      await expect(notes.first()).toBeVisible();
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Consumption', exact: true }) }).locator('.chart-note'))
        .toHaveText("Bought, Net, On hand and Days to clear count whole bags: the dripper filter doesn't apply.");
      // Bought vs brewed and On hand over time; Brewed over time (grams) follows the filter.
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Brewed over time' }) }).locator('.chart-note')).toHaveCount(1);
      await expect(notes).toHaveCount(3);
    } },
  { name: 'insights-brew-records', path: () => '/insights?tab=records&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: 'count whole bags' });
      expect(await notes.count()).toBeGreaterThan(0);
      await expect(page.locator('.chart-panel', { has: page.getByRole('heading', { name: 'Volume' }) }).locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0);
    } },
  { name: 'insights-brew-insights', path: () => '/insights?tab=insights&dripper=V60',
    act: async (page) => {
      const notes = page.locator('.chart-note', { hasText: "whole bags: the dripper filter doesn't apply." });
      expect(await notes.count()).toBeGreaterThan(0);
    } },
  { name: 'insights-brew-brewing', path: () => '/insights?tab=brewing&water=Lab%20Water%20A',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-water', path: () => '/insights?tab=water&dripper=V60',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  { name: 'insights-brew-gear', path: () => '/insights?tab=gear&brewTemp=93',
    act: async (page) => { await expect(page.locator('.chart-note', { hasText: 'whole bags' })).toHaveCount(0); } },
  // A tile or section link keeps the brew filter; a /coffees link doesn't.
  { name: 'insights-brew-link-carries', viewports: 'two', path: () => '/insights?dripper=V60',
    act: async (page) => {
      // Rail tab links (?tab=…) and finding links (/insights?…) carry the filter.
      const hrefs = await page.locator('a[href^="?"], a[href^="/insights"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(0);
      expect(hrefs.some((h) => h.includes('dripper=V60'))).toBe(true);
      const coffees = await page.locator('a[href^="/coffees?"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
      expect(coffees.length).toBeGreaterThan(0);
      expect(coffees.every((h) => !h.includes('dripper='))).toBe(true);
    } },
  { name: 'insights-coffees-chips', viewports: 'two', path: () => '/insights?tab=brewing&process=Washed&origin=Ethiopia&caffeine=all',
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
  { name: 'insights-coffees-sticky', path: () => '/insights?tab=records&range=all&compare=1&process=Washed&caffeine=decaf',
    act: async (page) => {
      // The chips are the bar's last row (gate r2 A3): still in view after scrolling.
      await expect(page.locator('.filter-bar .coffee-chips')).toBeVisible();
      await expectStickyBar(page, page.locator('.filter-bar'));
      await expect(page.locator('.filter-bar .coffee-chips')).toBeInViewport();
    } },
  // The mixed-roast nudge: never with a Roast filter set (one level left). The thin seed's two levels
  // rate alike, so it never shows here; prod copy shows it on /insights?tab=brewing&range=3m (T13b report).
  { name: 'insights-roast-nudge-roast-set', path: () => '/insights?tab=brewing&range=all&roast=Light',
    act: async (page) => {
      await expect(page.locator('.coffee-chips')).toBeVisible();
      await expect(page.locator('.roast-nudge')).toHaveCount(0);
    } },
  // Chips row with 0, 1 and 5 chips (a long roaster name): one line that scrolls sideways, never wraps; Clear all last.
  ...([['0', ''], ['1', '&process=Washed'],
    ['5', '&roast=Light&process=Washed&origin=Ethiopia&roaster=The%20Picky%20Chemist&caffeine=all']] as const)
    .map(([n, q]) => ({
      name: `insights-chips-${n}`, path: () => `/insights?tab=records&range=all${q}`,
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
  { name: 'insights-coffees-clear-bare', viewports: 'two', path: () => '/insights?process=Washed',
    act: async (page) => {
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).toHaveURL(/\/insights$/);
      await gotoReady(page, '/coffees');
      await gotoReady(page, '/insights');
      await expect(page).toHaveURL(/\/insights$/);
      await expect(page.locator('.coffee-chips')).toHaveCount(0);
    } },
  ...(['brewing', 'leaderboards', 'habits'] as const).map((t) => ({
    name: `insights-coffees-empty-${t}`, path: () => `/insights?tab=${t}&roaster=Lab%20Roasters&range=1w`,
    act: async (page: Page) => {
      await expect(page.getByText(/^No (rated )?brews matching Lab Roasters in this period\.$/)).toHaveCount(1);
      // A whole empty tab is one empty panel, not a stack of empty boards or charts (rule 28).
      await expect(page.locator('section.chart-panel:has(.hl-empty)')).toHaveCount(1);
      await expect(page.locator('.board, .insights-charts, .board-map')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
    } })),
  ...(['overview', 'records', 'insights', 'sweetspots', 'water', 'gear'] as const).map((t) => ({
    name: `insights-coffees-${t}`, path: () => `/insights?tab=${t}&process=Natural&range=all` })),
  // A board the confident cutoff (min3) emptied says what its rows lacked; "No brews" stays for truly empty boards.
  { name: 'insights-leaderboards-cut', path: () => '/insights?tab=leaderboards&process=Washed&roast=Light&range=all',
    act: async (page) => {
      await expect(page.locator('[data-board="roasters"] .board-note'))
        .toHaveText('No roasters with 3+ bags and 10+ rated brews matching Washed · Light in this period.');
      await expect(page.locator('.board-note', { hasText: /^No brews/ })).toHaveCount(0);
      await expectShortEmpty(page);
    } },
  // Phones (≤480) read "Last 12 mo." in the closed Period select (unclipped); wider widths keep "Last 12 months".
  { name: 'insights-period-short', path: () => '/insights?tab=records&range=12m',
    act: async (page) => {
      const want = page.viewportSize()!.width <= 480 ? 'Last 12 mo.' : 'Last 12 months';
      await expect(page.getByLabel('Period').locator('option:checked')).toHaveText(want);
      await expect(page.getByLabel('Period').locator('option[value="1m"]')).toHaveText('Last month');
    } },
  // U2: on phones the control bar's row-to-row gaps are equal, measured to what you see (a label's ink top, a
  // control's or chip's edge), on every tab; within 1px.
  { name: 'insights-bar-gaps', path: () => '/insights?tab=overview&range=12m&roast=Light&process=Washed',
    act: async (page) => {
      if (page.viewportSize()!.width > 640) return;
      for (const tab of ['overview', 'leaderboards', 'records', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing', 'water', 'insights']) {
        await page.goto(`/insights?tab=${tab}&range=12m&roast=Light&process=Washed`);
        await expect(page.locator('.insights-controls')).toBeVisible();
        const gaps: number[] = await page.evaluate(`(${BAR_GAPS})()`);
        expect(gaps.length, tab).toBeGreaterThanOrEqual(2);
        expect(Math.max(...gaps) - Math.min(...gaps), `${tab} gaps ${gaps}`).toBeLessThanOrEqual(1);
      }
    } },
  // M7: phones (≤480) abbreviate months/years/Previous in the Period and Compare selects (also before hydration,
  // app.html's script); the closed selects' text must fit (long custom spans / bag names fall back to the ellipsis style). Runs at 360 and 480.
  { name: 'insights-phone-selects', path: () => '/insights?tab=overview&range=12m&compare=1',
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
    name: `insights-see-all-${step}`, path: () => '/insights?tab=leaderboards&process=Washed&roast=Light&range=all',
    act: async (page: Page) => {
      const note = page.locator('.see-all');
      // One short line (gate P4): "N rows and M brews hidden by your settings. See all".
      await expect(note).toHaveText(/^\d+ rows?( and \d+ brews?)? hidden by your settings\. See all$/);
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
  { name: 'insights-see-all-every-bag', path: () => '/insights?tab=leaderboards&range=all&avg=raw&ratings=all&dial=all&caffeine=all&open=roasters',
    act: async (page) => {
      await expect(page.locator('.see-all')).toContainText('Showing everything');
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(1);
      await page.goto('/insights?tab=leaderboards&range=all&avg=k2&ratings=all&dial=all&caffeine=all&open=roasters');
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(1);
      // min3 (Average (3+ bags)) drops the 1-bag group.
      await page.goto('/insights?tab=leaderboards&range=all&avg=min3&ratings=all&dial=all&caffeine=all&open=roasters');
      await expect(page.locator('[data-board="roasters"] .board-row').first()).toBeVisible();
      await expect(page.locator('[data-board="roasters"] .board-row', { hasText: 'Onyx' })).toHaveCount(0);
    } },
  // Gate P4: "hidden by your settings" opens the shared tip (FloatTip): each board's count, the brews', the reasons
  // once; hover (mouse), tap and keyboard focus.
  { name: 'insights-see-all-tip', path: () => '/insights?tab=leaderboards&range=all',
    act: async (page) => {
      const btn = page.locator('.see-all .text-tip');
      await expect(btn).toHaveText('hidden by your settings');
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
  { name: 'insights-lab-anchor', path: () => '/insights?tab=water#water-gh',
    act: async (page) => expect(page.locator('#water-gh')).toBeInViewport() },
  { name: 'insights-water', path: () => '/insights?tab=water',
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
  { name: 'insights-water-tip', viewports: 'two', path: () => '/insights?tab=water',
    act: async (page) => {
      await page.locator('[data-section="water-gh"] .bar-row .bar-label').first().click();
      await expect(page.locator('[data-section="water-gh"] .cell-tip')).toBeVisible();
    } },
  { name: 'insights-trophy', path: () => '/insights?tab=gear',
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
  { name: 'insights-trophy-open', path: () => '/insights?tab=gear&card=grinder-zp6-special',
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
  { name: 'insights-trophy-specs', path: () => '/insights?tab=gear&card=dripper-v60',
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
      await page.goto('/insights?tab=gear&card=grinder-comandante-c40-mk4');
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
      await page.goto('/insights?tab=gear&card=grinder-zp6-special');
      await expect(dlg.locator('.specs .stat')).toHaveCount(2);
      await expect(dlg.locator('.specs .stat', { hasText: 'Burr size' }).locator('.stat-value')).toHaveText('64 mm');
      await expect(dlg.locator('.specs')).not.toContainText('Cone angle');
    } },
  { name: 'insights-trophy-edit', path: () => '/insights?tab=gear&card=dripper-v60',
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
      // "?" tips on Shape, Material, Flow and Size only; one opens in the site's tip look and focuses no input.
      for (const n of ['Shape', 'Material', 'Flow', 'Size']) await expect(dlg.getByRole('button', { name: `About ${n}` })).toBeVisible();
      await expect(dlg.getByRole('button', { name: /^About / })).toHaveCount(4);
      const tipBtn = dlg.getByRole('button', { name: 'About Flow' });
      if (phone) expect((await tipBtn.boundingBox())!.width).toBeGreaterThanOrEqual(43);
      await tipBtn.click();
      await expect(page.locator('#gear-tip-flow')).toBeVisible();
      await expect(page.locator('#gear-tip-flow')).toContainText('Valve / immersion');
      expect(await page.evaluate(() => document.activeElement?.matches('input') ?? false)).toBe(false);
      await page.keyboard.press('Escape');
      await expect(page.locator('#gear-tip-flow')).toBeHidden();
      await expect(dlg).toBeVisible();
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
      await page.goto('/insights?tab=gear&card=grinder-comandante-c40-mk4');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(form.getByLabel('Burr size (mm)')).toHaveValue('');
      // The server's error shows inline.
      await form.getByLabel('Burr size (mm)').fill('5');
      await save.click();
      await expect(dlg.getByRole('alert')).toContainText('Burr size');
      await expect(form).toBeVisible();
      // Regression: a typed number (a number input binds a number, not a string) is a listed change, and nothing phantom
      // appears for a stored number left alone (burr size 64).
      await page.goto('/insights?tab=gear&card=dripper-v60');
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
      await page.goto('/insights?tab=gear&card=grinder-zp6-special');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(form.getByLabel('Burr size (mm)')).toHaveValue('64');
      await dlg.getByRole('button', { name: 'Close' }).click(); // no change: no panel
      await expect(dlg).toBeHidden();
      await page.goto('/insights?tab=gear&card=grinder-zp6-special');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await form.getByLabel('Burr size (mm)').fill(''); // emptied reads as empty
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg.getByRole('alertdialog')).toContainText('Burr size: 64 → empty');
      await dlg.getByRole('alertdialog').getByRole('button', { name: 'Keep editing' }).click();
      // ✕ in edit mode is Cancel then close. No changes: it closes at once (no panel) and the URL drops the card.
      const panel = dlg.getByRole('alertdialog');
      await page.goto('/insights?tab=gear&card=dripper-v60');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      await expect(dlg.getByRole('button', { name: 'Close' })).toBeEnabled();
      await dlg.getByRole('button', { name: 'Close' }).click();
      await expect(dlg).toBeHidden();
      await expect(page).not.toHaveURL(/card=/);
      // A change: a panel in the dialog names it, in view with 44px buttons on a phone; Keep editing (focused; Esc too) keeps the typed
      // values; Discard closes without saving.
      await page.goto('/insights?tab=gear&card=dripper-v60');
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
      await page.goto('/insights?tab=gear&card=dripper-v60');
      await expect(dlg.locator('.specs .stat', { hasText: 'Brand' }).locator('.stat-value')).toHaveText('Hario'); // nothing saved
    } },
  // The other kinds' edit grids (wide dialogs): Save/Cancel take the cell after the last field (a full last row pushes them to the next
  // row's second cell); Image URL lines up with the last field row, Preview/Discard with the row before it.
  { name: 'insights-trophy-edit-kinds', path: () => '/insights?tab=gear&card=grinder-comandante-c40-mk4',
    act: async (page) => {
      const dlg = page.locator('dialog.trophy-dialog');
      const bx = async (l: Locator) => (await l.boundingBox())!;
      const input = (n: string) => dlg.getByLabel(n, { exact: true });
      if (page.viewportSize()!.width <= 640) {
        // Stacked: the last field to Save/Cancel keeps ~16px (ui-rules 22), grinder and filter.
        const gap = async (last: string) => { const l = await bx(input(last)); return (await bx(dlg.getByRole('button', { name: 'Save' }))).y - (l.y + l.height); };
        await dlg.getByRole('button', { name: 'Edit' }).click();
        expect(await gap('Step size (µm)')).toBeGreaterThanOrEqual(14);
        await page.goto('/insights?tab=gear&card=filter-cafec-abaca');
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
      await page.goto('/insights?tab=gear&card=filter-cafec-abaca');
      await dlg.getByRole('button', { name: 'Edit' }).click();
      for (const n of ['Shape', 'Material', 'Size', 'Flow']) await expect(dlg.getByRole('button', { name: `About ${n}`, exact: true })).toBeVisible();
      await expect(dlg.getByRole('button', { name: /^About / })).toHaveCount(4);
      await check('Size', 'Flow', true); // Save/Cancel right-aligned on a row of their own, level with Preview
    } },
  { name: 'insights-trophy-fill', path: () => '/insights?tab=gear&card=dripper-v60',
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
  { name: 'insights-trophy-suggest', path: () => '/insights?tab=gear&card=dripper-v60',
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
  { name: 'insights-trophy-toggle', path: () => '/insights?tab=gear',
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
  { name: 'insights-trophy-kind', path: () => '/insights?tab=gear',
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
  { name: 'insights-trophy-kind-pick', path: () => '/insights?tab=gear&gear=grinder&dripper=V60',
    act: async (page) => {
      await expect(page.locator('.trophy-card')).toHaveCount(3); // the dripper pick only rules out drippers, the toggle shows grinders only (ZP6, A4Z, Comandante)
      await expect(page.locator('.trophy-card:not([data-key^="grinder-"])')).toHaveCount(0);
    } },
  // Cards follow the Period: gear with no brew in it has no card; All time shows every one.
  { name: 'insights-trophy-period', viewports: 'two', path: () => '/insights?tab=gear&range=all',
    act: async (page) => {
      const all = await page.locator('.trophy-card').count();
      await gotoReady(page, '/insights?tab=gear&range=1w');
      const week = await page.locator('.trophy-card').count();
      expect(week).toBeLessThan(all);
      expect(week).toBeGreaterThan(0);
    } },
  { name: 'insights-trophy-retired', path: () => '/insights?tab=gear&retired=open',
    act: async (page) => {
      await expect(page.locator('button.retired-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.trophy-grid.retired .trophy-card[data-key="dripper-switch"]')).toBeVisible();
      await expectGridRowsFull(page, '.trophy-grid');
    } },
  // A pick rules out only its own kind: the other drippers go, grinders and filters stay; the shelf keeps the rest.
  { name: 'insights-trophy-picked', path: () => '/insights?tab=gear&dripper=V60&retired=open',
    act: async (page) => {
      await expect(page.locator('.trophy-card[data-key^="dripper-"]')).toHaveCount(1);
      await expect(page.locator('.trophy-card[data-key="dripper-v60"]')).toHaveCount(1);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(3);
      await expect(page.locator('.trophy-card[data-key^="filter-"]')).toHaveCount(3);
      await expect(page.locator('button.retired-toggle')).toHaveCount(0);
      await expectGridRowsFull(page, '.trophy-grid');
    } },
  // Grinder is in the Filters dialog on Gear (no tab-bar select): a chip, the badge, Clear all.
  { name: 'insights-trophy-grinder-pick', viewports: 'two', path: () => '/insights?tab=gear',
    act: async (page) => {
      await expect(page.locator('.tab-controls')).toHaveCount(0);
      await page.locator('.filters-button').click();
      const dlg = page.getByRole('dialog', { name: 'Filters' });
      await dlg.getByLabel('Grinder', { exact: true }).selectOption('a4z-femobook');
      await expect(page).toHaveURL(/grinder=a4z-femobook/);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('.coffee-chips .filter-chip')).toHaveText([/A4Z/]);
      await expect(page.locator('.filters-button')).toContainText('1');
      await page.getByRole('button', { name: 'Clear all' }).click();
      await expect(page).not.toHaveURL(/grinder=/);
      await expect(page.locator('.trophy-card[data-key^="grinder-"]')).toHaveCount(3);
    } },
  { name: 'insights-gear', path: () => '/insights?tab=gear',
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
  { name: 'insights-insights', path: () => '/insights?tab=insights&range=all',
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
      const money = page.locator('.finding-grid .hl-card', { hasText: '$/100 g went from' }).locator(':is(.spark, .bars)');
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
  { name: 'insights-insights-story-link', path: () => '/insights?tab=insights&range=all#insight-wildcardBrewer',
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
  { name: 'insights-insights-theme-dialin', path: () => '/insights?tab=insights&range=all&theme=dialin',
    act: async (page) => {
      for (const id of ['dialinBy-roastLevel', 'dialinBy-processGroup', 'rescuedBags']) await expect(page.locator(`#insight-${id}`)).toBeVisible();
    } },
  { name: 'insights-dialin-by-dripper', path: () => '/insights?tab=insights&theme=dialin&range=all',
    act: async (page) => {
      // The seed grades the dripper finding into the grid (on a real DB it may sit in Too early, which has no card).
      const card = page.locator('#insight-dialinBy-dripper');
      await expect(card).toBeVisible();
      await expect(card.locator('a[href$="#brewing-settle-dripper"]').first()).toBeVisible();
    } },
  { name: 'insights-insights-theme-taste', path: () => '/insights?tab=insights&range=all&theme=taste',
    act: async (page) => { await expect(page.locator('#insight-likeRoaster')).toBeVisible(); } },
  { name: 'insights-insights-theme', path: () => '/insights?tab=insights&range=all&theme=money',
    act: async (page) => {
      await expect(page.getByRole('button', { name: 'Money', pressed: true })).toBeVisible();
      await expectGridRowsFull(page, '.finding-grid');
    } },
  // A period with no brews: no measured brews/day or dose, so the spend card says so instead of "$0 a month".
  { name: 'insights-insights-nobrews', path: () => '/insights?tab=insights&range=2000-01-01..2000-01-31',
    act: async (page) => {
      const spend = page.locator('#insights-spend');
      await expect(spend).toContainText('Not enough brews to measure your spend yet');
      await expect(spend).not.toContainText(/\$0(\.00)? a (month|year)/);
    } },
  { name: 'insights-insights-whatif', path: () => '/insights?tab=insights&range=all&drinkers=2&gpp=60&inflow=500',
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
    path: () => '/insights?tab=leaderboards&rank=brews',
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
      await expect(tip.locator('dt')).toHaveText(['Coffees', 'Share', 'Brews']);
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
    path: () => '/insights?tab=leaderboards&rank=brews',
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
    path: () => '/insights?tab=leaderboards&rank=brews',
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
      await tip.locator('.tip-title').click();
      await expect(tip).toHaveCount(0);
    }
  },
  {
    // The page-wide filters ride along on the tip link, as on the list rows.
    name: 'insights-leaderboards-map-tip-filtered',
    viewports: 'two',
    path: () => '/insights?tab=leaderboards&rank=brews&process=Washed',
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
    name: 'coffee-edit-set-roaster-default',
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
    name: 'coffee-edit-roaster-default-discarded',
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
    name: 'coffee-edit-roaster-default-cleared-by-typing',
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
    name: 'coffee-edit-suggest-summary',
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
    name: 'coffee-edit-suggest-empty',
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
    name: 'coffee-edit-suggest-request-failed',
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
    name: 'coffee-edit-suggest-picked',
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
    name: 'coffee-edit-suggest-picked-discarded',
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
    name: 'coffee-edit-suggest-change-site',
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
    name: 'coffee-edit-suggest-closed',
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
    name: 'coffee-edit-suggest-closed-searching',
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
    name: 'coffee-edit-suggest-disabled',
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
  { name: 'skip-name-coffees-cards', path: () => '/coffees?status=archive&view=cards', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffees-list', path: () => '/coffees?status=archive&view=list', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffees-compact', path: () => '/coffees?status=archive&view=compact', act: (page) => expectSkipColored(page, 2) },
  { name: 'skip-name-coffee-detail', path: (s) => `/coffees/${s.slugs.skip}`, act: (page) => expectSkipColored(page, 2) },
  {
    // A coffees board row, and its value tip's title (TipBody).
    name: 'skip-name-insights-leaderboards',
    path: () => '/insights?tab=leaderboards&range=all&open=coffees',
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
  { name: 'skip-name-insights-records', viewports: 'two', path: () => '/insights?tab=records&range=all', act: (page) => expectSkipColored(page, 1) },
  { name: 'skip-name-insights-milestones', viewports: 'two', path: () => '/insights?tab=milestones&range=all', act: (page) => expectSkipColored(page, 1) },
  // ---- Peer review B (2026-10-19) ----
  // M2: the top navbar's first link lines up with the page content's left edge (the tab bar replaces it at <= 640px).
  ...['/insights?tab=habits', '/stats'].map((path): State => ({
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
    name: `insights-tab-controls-${tab}`, path: () => `/insights?tab=${tab}&range=all`,
    act: async (page) => {
      const ctl = page.locator('.filter-bar .tab-controls').getByRole(tab === 'habits' || tab === 'consumption' || tab === 'milestones' ? 'group' : 'combobox', { name: label });
      await expect(ctl).toBeVisible();
      await page.evaluate(() => (document.documentElement.style.paddingBottom = '200vh'));
      await page.evaluate(() => scrollTo(0, 700));
      await page.waitForTimeout(150);
      const bar = (await page.locator('.filter-bar').boundingBox())!, c = (await ctl.boundingBox())!;
      expect(Math.abs(bar.y)).toBeLessThanOrEqual(1);
      expect(c.y).toBeGreaterThanOrEqual(bar.y - 1);
      expect(c.y + c.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
      // Nothing of the tab's bar is left inline in the page below the sticky bar.
      await expect(page.locator('.rail-main > .rank-bar, .rail-main > .insights-bar, .rail-main > .kinds-bar')).toHaveCount(0);
    }
  })),
  // S2: a two-column list reads row by row (1 left, 2 right, 3 under 1); one column on phones.
  { name: 'insights-records-top-rowwise', path: () => '/insights?tab=records&range=all&top=20',
    act: async (page) => {
      const li = page.locator('#records-top-brews + ol li');
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
  { name: 'insights-records-show-more-scroll', path: () => '/insights?tab=records&range=all',
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
  { name: 'back-to-top', path: () => '/insights?tab=milestones&range=all',
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
  { name: 'insights-tab-switch-ring', viewports: 'two', path: () => '/insights?range=all',
    act: async (page) => {
      const tabs = ['overview', 'leaderboards', 'habits', 'consumption', 'records', 'milestones', 'insights', 'sweetspots', 'brewing', 'water', 'gear', 'consumption', 'records', 'overview'];
      const body = () => page.locator('.rail-main').evaluate((el) => [...el.children].filter((c) => !c.matches('.filter-bar, .toolbar, .chart-note, dialog')).map((c) => (c as HTMLElement).innerText).join('|').slice(0, 4000));
      let before = await body();
      for (const t of tabs.slice(1)) {
        await page.getByRole('combobox', { name: 'View', exact: true }).selectOption(t);
        await expect(page).toHaveURL(new RegExp(`tab=${t}`));
        await expect.poll(body, { message: `content after switching to ${t}` }).not.toBe(before);
        before = await body();
      }
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
// A Chart.js tip opens only on a mark (ui-rules 50), so the sweeps aim at marks: points on colored pixels (a bar,
// slice or line: chroma, unlike gray grid lines and text), one per 8px column, then a coarse grid as a fallback.
async function chartPoints(canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  await canvas.page().waitForTimeout(450); // the 400ms draw animation: marks at their final size
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
    await page.waitForTimeout(60);
    if (await tip.count()) return [x, y] as const;
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
async function hoverChart(page: Page, canvas: Locator) {
  const tip = page.locator('.chart-container .cell-tip:popover-open');
  for (const [x, y] of await chartPoints(canvas)) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(60);
    if (await tip.count()) break;
  }
  return tip;
}

// A tip opens only on its mark (ui-rules 50): the help cursor and the tip over the mark, neither over the empty space
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
  expect(await cursor(mx, my)).toBe('help');
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
}

// The same on a Chart.js canvas: an unpainted spot with no mark within 10px opens no tip and keeps
// the arrow; a mark opens the tip with the help cursor.
async function expectChartMarkOnly(page: Page, canvas: Locator) {
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
  await expect(tip, 'empty chart space opens no tip').toHaveCount(0);
  expect(await canvas.evaluate((c) => getComputedStyle(c).cursor), 'the arrow over empty chart space').toBe('default');
  await expect(await hoverChart(page, canvas), 'a mark opens the tip').toBeVisible();
  expect(await canvas.evaluate((c) => getComputedStyle(c).cursor), 'help over a mark').toBe('help');
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
  return routeTag(st) === '@insights' ? ['@insights:' + (new URL(path, 'http://x').searchParams.get('tab') ?? 'overview')] : [];
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

// Public cards (signed out) with only a roaster default show it, alt "<roaster> logo".
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
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
  test('insights-gear-trophies-public', { tag: '@insights' }, async ({ page }) => {
    await gotoReady(page, '/insights?tab=gear&card=dripper-v60');
    await expect(page.locator('dialog.trophy-dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Fill|Suggest)/ })).toHaveCount(0);
    await checkLayout(page);
    await gotoReady(page, '/insights?tab=gear&card=grinder-comandante-c40-mk4');
    await expect(page.locator('dialog.trophy-dialog .no-specs')).toHaveText('No details yet.');
  });
});

// The sticky bar is the same height before hydration (the server HTML, no JS) as after it: a tab's own controls are
// rendered with the bar, so nothing grows it on load (peer review B, round 2).
for (const tab of ['leaderboards', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing']) {
  test(`insights-bar-first-paint-${tab}`, { tag: '@insights' }, async ({ browser, page }, info) => {
    const url = `/insights?tab=${tab}&range=all`;
    await gotoReady(page, url);
    const hydrated = (await page.locator('.filter-bar').boundingBox())!.height;
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport ?? undefined, baseURL: info.project.use.baseURL, deviceScaleFactor: info.project.use.deviceScaleFactor });
    try {
      const raw = await ctx.newPage();
      await raw.goto(url);
      await expect(raw.locator('.filter-bar .tab-controls')).toBeVisible();
      expect(Math.abs((await raw.locator('.filter-bar').boundingBox())!.height - hydrated), 'bar height: server HTML vs hydrated').toBeLessThanOrEqual(1);
    } finally { await ctx.close(); }
  });
}
