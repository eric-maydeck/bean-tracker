import { expect, type Locator, type Page } from '@playwright/test';
import { pinnedBottom } from '../../src/lib/components/floatTip';

// Helpers for the collapsible bar states (docs/superpowers/specs/2026-10-24-insights-collapsible-bar-design.md).
// Selectors are the component's contract: .cbar(.inner|.overlay), .cbar-scroll, .cbar-body, .cbar-mini,
// .cbar-summary, .cbar-toggle, .cbar-pull(-tab); the spacer is .cbar's previous sibling while expanded.
export const INSIGHTS_TABS = ['overview', 'insights', 'records', 'leaderboards', 'habits', 'consumption', 'milestones', 'sweetspots', 'brewing', 'water', 'gear'] as const;

export const isPhone = (page: Page) => {
  const { width, height } = page.viewportSize()!;
  return width <= 640 || height <= 450;
};
export const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10);
const frames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

export const BLOCK_PARTS = '.toolbar > *, .filter-bar > *, .tab-controls button, .tab-controls select, .coffee-chips, .roast-nudge, .period-row > *, .board-jump a';
const COFFEES_PARTS = '.cbar .toolbar button, .cbar .toolbar select, .coffees-search-row > *, .add-sort-row > *';
const TEXT_ROWS = '.insights-period, .see-all, .roast-nudge';

// At scrollY 0, document coords rounded, keyed "<part>#<index>" (index among that part's matches, DOM order).
// A part is the first of the selector list an element matches. Controls: [x, y, w, h]; text rows: [x, y, h].
export async function inflowRects(page: Page): Promise<Record<string, number[]>> {
  const coffees = page.url().includes('/coffees');
  return page.evaluate(([parts, textRows, coffees]) => {
    const list = parts.split(', ');
    const seen: Record<string, number> = {};
    const out: Record<string, number[]> = {};
    for (const el of document.querySelectorAll(parts)) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const part = list.find((p) => el.matches(p))!;
      const key = `${part}#${(seen[part] = (seen[part] ?? -1) + 1)}`;
      const [x, y, w, h] = [r.x + scrollX, r.y + scrollY, r.width, r.height].map(Math.round);
      out[key] = !coffees && el.matches(textRows) ? [x, y, h] : [x, y, w, h];
    }
    const first = document.querySelector('main section.chart-panel, main .chart-panel');
    if (first) out['first-content'] = [Math.round(first.getBoundingClientRect().y + scrollY)];
    return out;
  }, [coffees ? COFFEES_PARTS : BLOCK_PARTS, TEXT_ROWS, coffees] as const);
}

// [x, w, h] rounded of every visible button, select, link and results count inside `scope` (not the pull tab).
export function controlRects(page: Page, scope: string): Promise<number[][]> {
  return page.evaluate((scope) => [...(document.querySelector(scope)?.querySelectorAll('button, select, a, .results') ?? [])]
    .filter((c) => !c.closest('.cbar-pull') && c.getClientRects().length && getComputedStyle(c).visibility !== 'hidden')
    .map((c) => { const r = c.getBoundingClientRect(); return [r.x, r.width, r.height].map(Math.round); })
    .filter((r) => r[1] || r[2]), scope);
}

export function expectRectsClose(a: unknown, b: unknown, tol = 1) {
  const [fa, fb] = [a, b].map((v) => (Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v as object)));
  expect(fa.map(([k]) => k), 'same controls').toEqual(fb.map(([k]) => k));
  fa.forEach(([k, v], i) => {
    const w = fb[i][1] as unknown;
    if (Array.isArray(v)) {
      expect(v.length, `${k}: same length`).toBe((w as number[]).length);
      v.forEach((n: number, j: number) => expect(Math.abs(n - (w as number[])[j]), `${k}[${j}]: ${n} vs ${(w as number[])[j]}`).toBeLessThanOrEqual(tol));
    } else expect(Math.abs((v as number) - (w as number)), `${k}: ${String(v)} vs ${String(w)}`).toBeLessThanOrEqual(tol);
  });
}

export async function scrollPastBar(page: Page) {
  // 1500px, or less on desktop when a short tab ends the sticky bar's container (its content box; padding does not
  // count) sooner: the pinned bar would leave with it. Phones pin a fixed row, so there it is always 1500.
  await page.evaluate(() => {
    document.documentElement.style.paddingBottom = '200vh';
    const bar = document.querySelector('.filter-bar');
    let parent = bar?.parentElement ?? null;
    while (parent && getComputedStyle(parent).display === 'contents') parent = parent.parentElement; // .cbar wrappers are display: contents on desktop
    const desktop = innerWidth > 640 && innerHeight > 450;
    const room = bar && parent && desktop
      ? parent.getBoundingClientRect().bottom + scrollY - parseFloat(getComputedStyle(parent).paddingBottom) - bar.getBoundingClientRect().height - parseFloat(getComputedStyle(bar).marginBottom) - 1
      : 1500;
    scrollTo({ top: Math.min(1500, room), behavior: 'instant' });
  });
  await frames(page);
}

export async function expectShortRow(page: Page) {
  const vw = page.viewportSize()!.width;
  const mini = page.locator('.cbar-mini');
  await expect(mini).toBeVisible();
  const m = (await mini.boundingBox())!;
  expect(Math.abs(m.y), 'short row at the top').toBeLessThanOrEqual(1);
  expect(m.height, 'short row <= 56px').toBeLessThanOrEqual(56);
  expect(m.x + m.width).toBeLessThanOrEqual(vw + 1);
  const oneLine = await page.locator('.cbar-summary').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { nowrap: cs.whiteSpace === 'nowrap', fits: el.scrollHeight <= (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6) + 1 };
  });
  expect(oneLine, 'summary is one line').toEqual({ nowrap: true, fits: true });
  const b = (await mini.getByRole('button', { name: 'Show controls' }).boundingBox())!;
  expect(Math.abs(b.width - 44) <= 1 && Math.abs(b.height - 44) <= 1, `Show controls is 44x44 (${b.width}x${b.height})`).toBe(true);
  expect(b.x).toBeGreaterThanOrEqual(m.x - 1);
  expect(b.x + b.width).toBeLessThanOrEqual(m.x + m.width + 1);
  expect(Math.abs(b.x + b.width - (vw - 16)), 'Show controls at the content right edge').toBeLessThanOrEqual(1);
}

export async function expandBar(page: Page): Promise<Locator> {
  const show = page.getByRole('button', { name: 'Show controls' });
  await expect(show).toBeVisible();
  await show.click();
  const overlay = page.locator('.cbar.overlay');
  await expect(overlay).toBeVisible();
  return overlay;
}

export async function expectPullTab(page: Page) {
  const pull = page.locator('.cbar-pull');
  await expect(pull).toBeVisible();
  await expect(pull).toHaveAttribute('aria-expanded', 'true');
  await expect(pull).toHaveAccessibleName('Hide controls');
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const overlay = document.querySelector('.cbar.overlay')!, pull = document.querySelector('.cbar-pull')!;
    const [o, p] = [overlay.getBoundingClientRect(), pull.getBoundingClientRect()];
    const vw = document.documentElement.clientWidth;
    const tabs = document.querySelector('.bottom-tabs')?.getBoundingClientRect();
    const bottom = tabs && tabs.height ? tabs.top : innerHeight;
    if (Math.abs(p.top - o.bottom) > 1) out.push(`top ${p.top} vs overlay bottom ${o.bottom}`);
    if (Math.abs(p.right - (vw - 16)) > 1) out.push(`right ${p.right} vs ${vw - 16}`);
    if (p.width < 44 - 0.5 || p.height < 44 - 0.5) out.push(`box ${p.width}x${p.height} under 44x44`);
    if (p.bottom > bottom + 1) out.push(`bottom ${p.bottom} past the visible bottom ${bottom}`);
    for (const c of overlay.querySelectorAll('button, select, a')) {
      if (c === pull || pull.contains(c) || !c.getClientRects().length) continue;
      const r = c.getBoundingClientRect();
      if (r.width && r.left < p.right - 0.5 && r.right > p.left + 0.5 && r.top < p.bottom - 0.5 && r.bottom > p.top + 0.5) out.push(`overlaps ${c.tagName} ${(c.textContent ?? '').trim().slice(0, 20)}`);
    }
    const first = [...overlay.querySelectorAll('button, a[href], select, input, textarea, [tabindex]:not([tabindex="-1"])')].find((e) => !(e as HTMLButtonElement).disabled);
    if (first !== pull) out.push(`first focusable is ${first?.outerHTML.slice(0, 60)}`);
    return out;
  });
  expect(bad, 'pull tab').toEqual([]);
}

export const pinnedBottomOf = (page: Page): Promise<number> => page.evaluate(pinnedBottom);

// Same as in-flow: the spacer under an expanded bar is as tall as the block's in-flow outer height (+-1).
export const outerHeight = (page: Page, sel: string) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return -1;
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}, sel);
export const spacerHeight = (page: Page) => page.evaluate(() => document.querySelector('.cbar')?.previousElementSibling?.getBoundingClientRect().height ?? -1);
export const expectSpacerMatchesBody = (page: Page) =>
  expect.poll(async () => Math.abs((await spacerHeight(page)) - (await outerHeight(page, '.cbar-body'))), { message: 'spacer height = .cbar-body outer height' }).toBeLessThanOrEqual(1);

// y of the first section.chart-panel with some part in view, as [index, y] (so the same one is read again after a change).
export const panelAt = (page: Page, i?: number) => page.evaluate((i) => {
  const els = [...document.querySelectorAll('section.chart-panel')];
  const k = i ?? els.findIndex((e) => e.getBoundingClientRect().bottom > 60);
  return k < 0 ? null : { i: k, y: els[k].getBoundingClientRect().y };
}, i);

// The shared /insights act: desktop pins only the controls; a phone gets in-flow bar, short row, expanded overlay.
export async function cbarAct(page: Page, filters = 0) {
  const mini = page.locator('.cbar-mini');
  if (!isPhone(page)) {
    await expect(mini).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show controls' })).toHaveCount(0);
    await scrollPastBar(page);
    const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    expect(Math.abs((await box('.filter-bar')).y), 'controls pinned').toBeLessThanOrEqual(1);
    const [t, p] = [await box('.toolbar'), await box('.period-row')];
    expect(t.y + t.height, 'heading scrolled away').toBeLessThan(0);
    expect(p.y + p.height, 'period row scrolled away').toBeLessThan(0);
    return;
  }
  await expect(mini).toHaveCount(0);
  await expect(page.locator('.cbar-pull')).toHaveCount(0);
  const inFlow = await controlRects(page, '.cbar');
  const bodyH = await outerHeight(page, '.cbar-body');
  await scrollPastBar(page);
  await expectShortRow(page);
  const [view, period, summary] = await Promise.all([
    page.locator('select[aria-label="View"]').evaluate((s: HTMLSelectElement) => s.selectedOptions[0].textContent!.trim()),
    page.locator('.insights-period').first().innerText(),
    page.locator('.cbar-summary').innerText()
  ]);
  expect(summary.startsWith(`${view} · `), `summary "${summary}" starts with "${view} · "`).toBe(true);
  expect(summary, 'summary has the period').toContain(period.trim().slice(0, 8));
  if (filters) expect(summary.endsWith(` · ${filters} filters`), summary).toBe(true);
  else expect(summary).not.toMatch(/ · \d+ filters?$/);
  const before = await panelAt(page);
  const url = page.url();
  const overlay = await expandBar(page);
  expect(Math.abs((await overlay.boundingBox())!.y), 'overlay at the top').toBeLessThanOrEqual(1);
  expectRectsClose(await controlRects(page, '.cbar.overlay'), inFlow, 1);
  await expectPullTab(page);
  if (before) expect(Math.abs((await panelAt(page, before.i))!.y - before.y), 'page does not jump').toBeLessThanOrEqual(1);
  expect(Math.abs((await spacerHeight(page)) - bodyH), 'spacer = in-flow block height').toBeLessThanOrEqual(1);
  await page.locator('.cbar-pull').click();
  await expect(page.locator('.cbar.overlay')).toHaveCount(0);
  await expect(mini).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show controls' })).toBeFocused();
  expect(page.url()).toBe(url);
  expect(page.url()).not.toMatch(/expand|collapse|cbar/);
}

// A tile's top minus what is pinned. A tile just below a short block can land (the scroll padding reserves the short
// row's height) while the block's last pixels are still on screen and no short row shows yet: nothing covers the tile
// then, so that stretch is not a gap.
export const anchorGap = (page: Page, id: string): Promise<number> => page.evaluate((id) => {
  const cbar = document.querySelector('.cbar'), pinned = document.querySelector('.cbar-mini') ?? document.querySelector('.cbar.overlay');
  const top = document.getElementById(id)!.getBoundingClientRect().top;
  if (!pinned && cbar && cbar.getBoundingClientRect().bottom > 0 && top <= cbar.getBoundingClientRect().bottom + 56) return 0;
  const bar = document.querySelector('.filter-bar');
  const bottom = pinned ? pinned.getBoundingClientRect().bottom : bar && getComputedStyle(bar).position === 'sticky' ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  return top - bottom;
}, id);
