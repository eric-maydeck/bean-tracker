import { test, expect, type Page, type Locator, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { checkLayout } from './checkLayout';

interface Seed {
  slugs: { long: string; linked: string; frozen: string; decaf: string; wide: string } & Record<GramsKey, string>;
  names: { long: string; everyAction: string } & Record<GramsKey, string>;
}
// Seeded open coffees with a linked bean, and their bag text (checkLayout rule 6
// asserts each stays on one line).
const GRAMS = { big: '2kg (2kg left)', under: '999g (999g left)', part: '1.5kg (1.2kg left)' };
type GramsKey = keyof typeof GRAMS;
const GRAMS_KEYS = Object.keys(GRAMS) as GramsKey[];
// Read lazily: .ui-test/seed.json only exists once the web server has started.
let cached: Seed | undefined;
const seed = (): Seed => (cached ??= JSON.parse(readFileSync('.ui-test/seed.json', 'utf8')));

interface State {
  name: string;
  path: (s: Seed) => string;
  act?: (page: Page, s: Seed) => Promise<void>;
}

// Stats → Not yet tracked → Link on the bean row containing `text`.
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

// Every page and state the layout rules apply to. Every UI change adds its
// states here (docs/ui-rules.md). Actions must not save anything: the
// workers share one DB.
export const STATES: State[] = [
  { name: 'coffees-compact', path: () => '/coffees?status=all&view=compact' },
  { name: 'coffees-list', path: () => '/coffees?status=all&view=list' },
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
  { name: 'coffee-long', path: (s) => `/coffees/${s.slugs.long}` },
  { name: 'coffee-frozen', path: (s) => `/coffees/${s.slugs.frozen}` },
  { name: 'coffee-decaf', path: (s) => `/coffees/${s.slugs.decaf}` },
  {
    name: 'coffee-image-fill',
    path: (s) => `/coffees/${s.slugs.wide}`,
    act: (page) => expectContained(page.locator('.detail-media img'), WIDE_FILL)
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
  { name: 'stats-general', path: () => '/stats' },
  ...(['overview', 'favorites', 'brewing', 'economics'] as const).map((tab) => ({
    name: `stats-${tab}`,
    path: () => `/stats?tab=bq&bc=${tab}`
  })),
  { name: 'coffees-bc-yes', path: () => '/coffees?status=all&view=list&bc=yes' },
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
      await expect(d.locator('.suggest-matching')).toHaveText(`Moonwake · Ethiopia Bensa Bombe · Washed · Roasted ${roastDate}`);
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
      await expect(m).toHaveText(`Moonwake · Ethiopia Bensa Bombe · Roasted ${roastDate}`);
      // Processing cleared: no dangling separator. Fixed above the scrolling body, not inside it.
      expect(await m.evaluate((el) => !!el.closest('.suggest-body'))).toBe(false);
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
];

// Known failures: the list view's table is crushed at tablet width and needs a
// redesign (docs/backlog/list-view-tablet-width.md). test.fail() makes a fix
// show up as "unexpectedly passed", so these entries flag themselves. Nothing
// else gets listed here.
const KNOWN_FAILURES = new Set([
  ...['w768', 'phone-landscape'].flatMap((w) => [`coffees-list-${w}`, `coffees-inline-edit-pending-${w}`, `coffees-list-inline-edit-actions-${w}`, `coffees-list-inline-edit-action-row-${w}`, `coffees-bc-yes-${w}`])
]);

for (const state of STATES) {
  test(state.name, async ({ page }, info) => {
    test.fail(
      KNOWN_FAILURES.has(`${state.name}-${info.project.name}`),
      'list view breaks at tablet widths: docs/backlog/list-view-tablet-width.md'
    );
    const s = seed();
    await page.goto(state.path(s), { waitUntil: 'networkidle' });
    if (state.act) await state.act(page, s);
    // Screenshot first, so a failing state still leaves a picture to look at.
    await page.screenshot({ path: `.ui-test/screenshots/${state.name}-${info.project.name}.png`, fullPage: true });
    await checkLayout(page);
  });
}

// Public cards (signed out) with only a roaster default show it, alt "<roaster> logo".
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('coffees-cards-public-roaster-default', async ({ page }, info) => {
    await page.goto('/coffees?status=all&view=cards', { waitUntil: 'networkidle' });
    const img = page.getByRole('img', { name: 'Moonwake logo', exact: true });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expectContained(page.locator('a.card').filter({ hasText: 'Rwanda Gitega Natural' }).locator('img'), WIDE_FILL);
    await page.screenshot({ path: `.ui-test/screenshots/coffees-cards-public-${info.project.name}.png`, fullPage: true });
    await checkLayout(page);
  });
});
