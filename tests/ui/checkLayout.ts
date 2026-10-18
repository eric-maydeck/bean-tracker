import { expect, type Locator, type Page } from '@playwright/test';

// The automatable rules from docs/ui-rules.md. Anything inside an element with
// data-layout-ignore="<why>" is skipped; an empty reason is itself a problem.
export async function checkLayout(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const narrow = window.innerWidth <= 480;
    const describe = (el: Element) => {
      const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
      const text = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
    };
    const shown = (el: Element) =>
      !el.closest('[data-layout-ignore]') &&
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
      el.getBoundingClientRect().width > 0;
    const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].filter(shown);

    for (const el of document.querySelectorAll('[data-layout-ignore]')) {
      if (!el.getAttribute('data-layout-ignore')?.trim()) out.push(`data-layout-ignore needs a reason: ${describe(el)}`);
    }

    // 1. No sideways page scroll.
    const sw = document.documentElement.scrollWidth;
    if (sw > window.innerWidth) out.push(`page scrolls sideways: scrollWidth ${sw} > ${window.innerWidth}`);

    // Text whose line boxes don't overlap vertically wrapped.
    const wrapped = (range: Range) => {
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length < 2) return false;
      return Math.max(...rects.map((r) => r.top)) >= Math.min(...rects.map((r) => r.bottom)) - 1;
    };

    // 2. Buttons, badges and chips stay on one line. Checked per text node (not
    // the whole element's boxes), so an icon stacked over a label isn't a wrap:
    // a single text node whose line boxes don't overlap vertically wrapped.
    const chips = all('button, .button, .badge, .filter-chip');
    for (const el of chips) {
      // A picker button is a form control, not an action: its meta line may wrap.
      // An expanded compact row shows its full name, wrapped, on purpose.
      // A Suggest candidate row is content (title, notes), not a label. A text tip (TextTip) is a run of prose.
      if (el.matches('[aria-haspopup="listbox"], .compact-row[aria-expanded="true"], .suggest-pick, .text-tip')) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        if (wrapped(range)) {
          out.push(`wraps onto 2+ lines: ${describe(el)}`);
          break;
        }
      }
    }

    // 3. No clipped or overflowing text in those elements or in table cells.
    for (const el of [...chips, ...all('td, th')]) {
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`text overflows (${el.scrollWidth}px in ${el.clientWidth}px): ${describe(el)}`);
      }
    }

    // 4. Tap targets ≥ 44×44 on phone widths.
    if (narrow) {
      for (const el of all('button, .button, select, [role="button"]')) {
        // Deliberate exemption: list view is dense by design (compact is the
        // phone view), so column sort headers aren't held to 44px.
        if (el.matches('th > .sort-button')) continue;
        // Countries can't be 44px; the Origins list beside the map carries the same data with 44px rows.
        if (el.matches('.world-map svg path')) continue;
        // Heatmap and calendar cells can't be 44px; the hour and weekday charts carry the same data.
        if (el.matches('.heat-cell, .cal-cell')) continue;
        // A 100% stacked bar's segment is as tall as its share; a tap anywhere picks the segment under it, the
        // arrow keys reach every one, and the legend names each series.
        if (el.matches('.stacked .seg')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 43.5 || r.height < 43.5) {
          out.push(`tap target ${Math.round(r.width)}×${Math.round(r.height)} < 44×44: ${describe(el)}`);
        }
      }
    }

    // 5. Buttons sharing a row (same nearest flex/grid container, overlapping
    // vertically) have the same top and height. Buttons with no flex/grid
    // ancestor sit in plain inline flow (baseline-aligned): one group, so an
    // inline-flex button riding a few px off its inline-block neighbors shows.
    const container = (el: Element) => {
      let p = el.parentElement;
      while (p && !/flex|grid/.test(getComputedStyle(p).display)) p = p.parentElement;
      return p ?? document.body;
    };
    const groups = new Map<Element, HTMLElement[]>();
    for (const el of all('button, .button')) {
      const c = container(el);
      if (c) groups.set(c, [...(groups.get(c) ?? []), el]);
    }
    for (const els of groups.values()) {
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i].getBoundingClientRect();
          const b = els[j].getBoundingClientRect();
          // >1px overlap: stacked lines of a wrapped caption touch at a sub-pixel edge, not a row.
          const sameRow = a.top < b.bottom - 1 && b.top < a.bottom - 1;
          // (.see-all: the See all note's tap targets on two wrapped lines, likewise.) Mode words on two lines of a wrapping caption (.stat-label.wrap): their 44px tap areas overlap, they are not a row.
          if (sameRow && Math.abs(a.top - b.top) > 8 && els[i].closest('.stat-label.wrap, .see-all') && els[i].closest('.stat-label.wrap, .see-all') === els[j].closest('.stat-label.wrap, .see-all')) continue;
          if (sameRow && (Math.abs(a.top - b.top) > 1 || Math.abs(a.height - b.height) > 1)) {
            out.push(`row misaligned (top ${a.top.toFixed(0)}/${b.top.toFixed(0)}, height ${a.height.toFixed(0)}/${b.height.toFixed(0)}): ` +
              `${describe(els[i])} vs ${describe(els[j])}`);
          }
        }
      }
    }

    // 6. Bag text ("1.5kg (1.2kg left)") stays on one line, wherever it sits.
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = texts.nextNode(); n; n = texts.nextNode()) {
      if (!n.parentElement || !shown(n.parentElement)) continue;
      for (const m of (n.textContent ?? '').matchAll(/\S+ \(\S+ left\)/g)) {
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        if (wrapped(range)) out.push(`wraps onto 2+ lines: "${m[0]}" in ${describe(n.parentElement)}`);
      }
    }

    // 7. (ui-rules 14) Every option in a custom picker sits under a visible
    // group header: role="group" labeled by a shown element.
    for (const el of all('[role="option"]')) {
      const header = document.getElementById(el.closest('[role="group"]')?.getAttribute('aria-labelledby') ?? '');
      if (!header || !shown(header)) out.push(`option without a group header: ${describe(el)}`);
    }
    // 8. (ui-rules 17) Phone widths: a row of buttons marked data-button-row
    // never leaves one button on its own line at its content width; every
    // line spans the row (the buttons grow to share it).
    if (window.innerWidth <= 640) {
      for (const row of all('[data-button-row]')) {
        const box = row.getBoundingClientRect();
        const lines = new Map<number, DOMRect[]>();
        for (const b of row.querySelectorAll('button, .button')) {
          const r = b.getBoundingClientRect();
          lines.set(Math.round(r.top), [...(lines.get(Math.round(r.top)) ?? []), r]);
        }
        for (const rs of lines.values()) {
          const left = Math.min(...rs.map((r) => r.left));
          const right = Math.max(...rs.map((r) => r.right));
          if (Math.abs(left - box.left) > 1 || Math.abs(right - box.right) > 1) {
            out.push(`button line ${left.toFixed(0)}–${right.toFixed(0)} doesn't span its row ` +
              `${box.left.toFixed(0)}–${box.right.toFixed(0)}: ${describe(row)}`);
          }
        }
      }
    }
    // 9. (ui-rules 18) Images are never cropped or stretched: an image whose
    // box shape differs from its own is contained, on a fill color.
    for (const img of all('img') as HTMLImageElement[]) {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) continue;
      const r = img.getBoundingClientRect();
      const box = r.width / r.height;
      if (Math.abs(box - img.naturalWidth / img.naturalHeight) <= 0.01 * box) continue;
      const style = getComputedStyle(img);
      if (style.objectFit !== 'contain' && style.objectFit !== 'scale-down') {
        out.push(`image cropped or stretched (object-fit: ${style.objectFit}): ${describe(img)}`);
      } else if (style.backgroundColor === 'rgba(0, 0, 0, 0)') {
        out.push(`contained image has no fill color behind it: ${describe(img)}`);
      }
    }
    // 10. (ui-rules 44) Tile text never spills past its tile: every text line box, as far as it is visible (clipped
    // by any overflow-hiding ancestor inside the tile, e.g. an ellipsis or a line clamp), sits inside the tile's box.
    // Popover tips (top layer) and screen-reader text are not tile text. (A tip button's 44px tap padding may
    // overflow on purpose, so the tile's scrollWidth is not the measure.)
    for (const tile of all('.stat-item, .hl-card')) {
      const t = tile.getBoundingClientRect();
      const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement!;
        if (!n.textContent?.trim() || p.closest('[popover], .sr-only') || !shown(p)) continue;
        let [l, tp, rt, bt] = [-Infinity, -Infinity, Infinity, Infinity];
        for (let a: Element | null = p; a && a !== tile; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
          const c = a.getBoundingClientRect();
          [l, tp, rt, bt] = [Math.max(l, c.left), Math.max(tp, c.top), Math.min(rt, c.right), Math.min(bt, c.bottom)];
        }
        const range = document.createRange();
        range.selectNodeContents(n);
        const spill = [...range.getClientRects()].some((r) => {
          const [x0, y0, x1, y1] = [Math.max(r.left, l), Math.max(r.top, tp), Math.min(r.right, rt), Math.min(r.bottom, bt)];
          return x1 - x0 > 0 && y1 - y0 > 0 && (x0 < t.left - 1 || x1 > t.right + 1 || y0 < t.top - 1 || y1 > t.bottom + 1);
        });
        if (spill) { out.push(`tile text spills past its tile: "${n.textContent.trim().slice(0, 30)}" in ${describe(tile)}`); break; }
      }
    }
    return out;
  });
  expect(problems, `layout problems on ${page.url()}:\n${problems.join('\n')}`).toEqual([]);
  await expectCaptionsLevel(page);
}

// Card grids: every row of cards runs edge to edge (no empty cell, no ragged last row; ui-rules 28, 33),
// and no card sits alone on a row it stretches across (a lone card, ui-rules 33) unless `allowLone` or it is a
// phone card grid's odd last card (T5).
export async function expectGridRowsFull(page: Page, selector: string, allowLone = false) {
  const gaps = await page.locator(selector).evaluateAll((rows, allowLone) =>
    rows.flatMap((row) => {
      const o = row.getBoundingClientRect();
      const byTop = new Map<number, DOMRect[]>();
      for (const t of row.children) {
        const r = t.getBoundingClientRect();
        byTop.set(Math.round(r.top), [...(byTop.get(Math.round(r.top)) ?? []), r]);
      }
      const all = [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, rs]) => rs);
      return all.flatMap((rs, i) => {
        const [l, r] = [Math.min(...rs.map((x) => x.left)) - o.left, o.right - Math.max(...rs.map((x) => x.right))];
        // T5: a card grid on a phone (.hl-grid under 520px: 2 across; a .stat-strip of single figures is exempt)
        // never puts 3 in a row; an odd count ends in one card spanning the row (the end of a size class, too).
        const phone = row.classList.contains('hl-grid') && !row.classList.contains('stat-strip') && o.width < 520;
        if (phone && rs.length > 2) return [`${rs.length} cards in a phone row`];
        const next = all[i + 1];
        const lastOfTwoUp = phone && (!next || Math.abs(next[0].height - rs[0].height) > 2);
        if (!allowLone && !lastOfTwoUp && rs.length === 1 && row.children.length > 1) return [`a lone tile on its own row (of ${row.children.length})`];
        return Math.abs(l) > 1 || Math.abs(r) > 1 ? [`${rs.length} tiles leave ${Math.round(l)}px left, ${Math.round(r)}px right`] : [];
      });
    }), allowLone
  );
  expect(gaps, selector).toEqual([]);
}

// Wide content scrolls inside its own box: each match's scrollWidth may exceed its width, the page's never
// does, and the box itself sits inside the viewport.
export async function expectInnerScroll(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toBeVisible();
  const bad = await page.locator(selector).evaluateAll((els) => {
    const de = document.documentElement;
    const out = de.scrollWidth > de.clientWidth + 1 ? ['the page scrolls sideways'] : [];
    for (const e of els) {
      const r = e.getBoundingClientRect();
      if (r.left < -1 || r.right > de.clientWidth + 1) out.push(`${e.className} sits outside the viewport`);
    }
    return out;
  });
  expect(bad, selector).toEqual([]);
}

// Paired lab cards (fitPairs, ui-rules 37): the two cards of a row are one height, and each card's .fit-body
// is either filled (no gap under its content taller than one of its rows) or scrolls inside itself.
export async function expectPairsFilled(page: Page, selector: string) {
  const bad = await page.locator(selector).evaluateAll((grids) => grids.flatMap((g) => {
    const cards = [...g.children] as HTMLElement[];
    return cards.flatMap((c) => {
      const r = c.getBoundingClientRect();
      const mate = cards.find((o) => o !== c && Math.round(o.getBoundingClientRect().top) === Math.round(r.top));
      if (!mate) return [];
      const name = c.dataset.section ?? c.className;
      if (Math.abs(mate.getBoundingClientRect().height - r.height) > 1) return [`${name}: ${Math.round(r.height)}px beside ${Math.round(mate.getBoundingClientRect().height)}px`];
      const fb = c.querySelector<HTMLElement>('.fit-body');
      if (!fb) return [`${name}: no .fit-body`];
      if (fb.scrollHeight > fb.clientHeight + 1) return []; // the taller card: scrolls inside
      const parts = [...fb.querySelectorAll('*')].filter((e) => !e.closest('.cell-tip, [popover]')).map((e) => e.getBoundingClientRect()).filter((b) => b.height > 0);
      const row = fb.querySelector('.bar-row, .heat-cell, .board-row')?.getBoundingClientRect().height ?? 48;
      // Stretched bars scale up, not apart (C3): a bar is 55-65% of its row (at most 32px, so taller rows may go lower).
      const g = parseFloat(getComputedStyle(fb).getPropertyValue('--grow')) || 1;
      const thin = g > 1 ? [...fb.querySelectorAll('.bar-row')].filter((r) => {
        const bar = r.querySelector('.bar')?.getBoundingClientRect(), h = r.getBoundingClientRect().height;
        return bar && bar.height < Math.min(32, 0.55 * h) - 1;
      }) : [];
      const fat = g > 1 ? [...fb.querySelectorAll('.bar-row')].filter((r) => {
        const bar = r.querySelector('.bar')?.getBoundingClientRect();
        return bar && bar.height > 0.65 * r.getBoundingClientRect().height + 1;
      }) : [];
      if (thin.length || fat.length) return [`${name}: ${thin.length} bars under 55% / ${fat.length} over 65% of their stretched rows`];
      const gap = fb.getBoundingClientRect().bottom - Math.max(...parts.map((b) => b.bottom));
      return gap > row + 1 ? [`${name}: ${Math.round(gap)}px empty under a ${Math.round(row)}px row`] : [];
    });
  }));
  expect(bad, selector).toEqual([]);
}

// A chart tip is never clipped (ui-rules 39): it is an open popover (the top layer: no card overflow, scroll
// wrapper or sticky bar can cover or cut it), and its box is inside the viewport and below the sticky filter bar.
// ponytail: Firefox's elementFromPoint skipped the open top-layer tip in the runner (it hit the content under
// it even with pointer-events on), so the top-layer check stands in for a per-corner hit test.
export async function expectTipInView(page: Page, tip: Locator) {
  await expect(tip).toBeVisible();
  const bad = await tip.evaluate((el) => {
    const r = el.getBoundingClientRect(), out: string[] = [];
    const bar = document.querySelector('.filter-bar')?.getBoundingClientRect();
    if (!el.matches(':popover-open')) out.push('not in the top layer (an open popover)');
    if (r.left < 0 || r.top < 0 || r.right > document.documentElement.clientWidth || r.bottom > innerHeight) out.push(`outside the viewport: ${JSON.stringify(r)}`);
    if (bar && bar.bottom > 0 && r.top < bar.bottom - 1) out.push(`under the sticky bar (${Math.round(r.top)} < ${Math.round(bar.bottom)})`);
    return out;
  });
  expect(bad).toEqual([]);
}

// Tile captions (ui-rules 44): in a row of tiles, each caption's FIRST line sits at the same top and each value at
// the same place (±1px), whatever the caption's line count. Stat tiles and Records cards.
export async function expectCaptionsLevel(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const tiles = [...document.querySelectorAll('.stat-row > .stat-item, .record-grid .hl-card, .hl-card:has(.hl-top):not(.finding):not(.myth):not(.calc)')] as HTMLElement[];
    const rows = new Map<string, HTMLElement[]>();
    for (const t of tiles) {
      const r = t.getBoundingClientRect();
      if (!r.width) continue;
      const key = `${[...document.querySelectorAll('*')].indexOf(t.parentElement!)}:${Math.round(r.top / 4)}`;
      rows.set(key, [...(rows.get(key) ?? []), t]);
    }
    for (const row of rows.values()) {
      const tops = row.flatMap((t) => { const l = t.querySelector('.stat-caption .stat-label, .hl-caption .stat-label'); return l ? [[t, l.getBoundingClientRect().top - t.getBoundingClientRect().top] as const] : []; });
      const vals = row.flatMap((t) => { const v = t.querySelector('.stat-value, .hl-value'); return v ? [[t, v.getBoundingClientRect().top - t.getBoundingClientRect().top] as const] : []; });
      for (const [what, xs] of [['caption', tops], ['value', vals]] as const) {
        if (!xs.length) continue;
        const lo = Math.min(...xs.map((x) => x[1])), hi = Math.max(...xs.map((x) => x[1]));
        if (hi - lo > 1) out.push(`${what} offsets differ by ${Math.round(hi - lo)}px in a row: ${xs.map((x) => `${(x[0].textContent ?? '').trim().slice(0, 14)}@${Math.round(x[1])}`).join(' | ')}`);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
}

// Insights stat grids: full rows, and every caption inside its tile.
export async function expectStatRowsFull(page: Page) {
  // The overview's square tiles stretch a deliberate lone last tile (.fit.n4 / n5 at 360 px).
  await expectGridRowsFull(page, '.stat-row', true);
  // Every caption stays inside its tile (checkLayout misses absolutely positioned overflow).
  const spills = await page.locator('.stat-row .stat-item').evaluateAll((tiles) =>
    tiles.flatMap((t) => {
      const c = t.querySelector('.stat-caption')!.getBoundingClientRect();
      const b = t.getBoundingClientRect().bottom;
      return c.bottom > b - 1 ? [`${t.textContent?.trim().slice(0, 30)}: caption ${Math.round(c.bottom - b)}px past the bottom`] : [];
    })
  );
  expect(spills).toEqual([]);
}

// One tip look (ui-rules 36, T1), on every page: every help popover on the page (closed ones are in the DOM too) is a bold
// title, then label/value rows or short lines (at most 6), never loose text. A help line holds one idea: at most 120
// characters, and never a second "Term: …" after a sentence ends ("A: x. B: y."). A full-text popover
// (a card's clamped text: id full-… / …-full) carries content, so only its title is checked.
// An open FloatTip (.cell-tip: chart, text, label and sample tips) is checked too: TipBody content only (no loose text),
// a title or rows, the same line rules (not on its caveat blocks), and no "Label:" in a row label. A label tip is a
// title alone.
export async function expectTipsFormatted(page: Page) {
  const bad = await page.locator('.mode-tip:not(.tip-list):not([popover="manual"]), .cell-tip.float-tip').evaluateAll((tips) => tips.flatMap((t) => {
    const float = t.classList.contains('float-tip');
    const id = t.id || (float ? `cell-tip "${t.textContent!.trim().slice(0, 30)}"` : t.className);
    const out: string[] = [];
    const first = t.firstElementChild;
    if ([...t.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())) out.push(`${id}: loose text`);
    if (float) {
      if (!t.querySelector('.tip-title')?.textContent?.trim() && !t.querySelector('.tip-rows')) out.push(`${id}: no title or rows`);
      for (const dt of t.querySelectorAll('.tip-rows dt')) if (dt.textContent!.includes(':')) out.push(`${id}: "Label:" row "${dt.textContent}"`);
    } else {
      if (!first?.classList.contains('tip-title') || !first.textContent?.trim()) out.push(`${id}: no bold title first`);
      if (/^full-|-full$/.test(t.id)) return out;
      if (!t.querySelector('.tip-rows, .tip-lines')) out.push(`${id}: no rows or lines`);
    }
    // A data tip's caveat blocks (strength, Low confidence) keep their full sentence.
    const lis = [...t.querySelectorAll('.tip-lines li')].filter((li) => !(float && li.closest('.tip-block')));
    const n = lis.filter((li) => !li.classList.contains('gap')).length;
    if (n > 6) out.push(`${id}: ${n} lines (6 at most)`);
    for (const li of lis) {
      const s = li.textContent!.trim();
      if (s.length > 120) out.push(`${id}: ${s.length}-char line`);
      if (/[.!?]\s+[^.]*:\s/.test(s)) out.push(`${id}: two ideas in "${s.slice(0, 40)}…"`);
    }
    return out;
  }));
  expect(bad).toEqual([]);
}

// No native `title` tooltips in page content (ui-rules 36: one tip look; a title never shows on touch): a tip is
// TipBody in a FloatTip (TextTip, labelTip, SampleNote, Chart) or a .mode-tip help popover. <title> elements are not
// attributes, so the head's and any SVG's are out of scope. Allowed, each for its reason:
const TITLE_OK: [string, string][] = [
  ['iframe', "an iframe's accessible name, not a tip"],
  ['option', 'a native select option: the browser draws the list, so no tip can open there (its select has a ? popover)'],
  ['.tab-group > button[aria-describedby]', "a mode switch option: rule 27's own hover hint, beside the mode word's popover"],
  // Older /insights titles, outside the 2026-10-17 audit's inventory (follow-up):
  ['.tab-group > button[aria-disabled="true"]', "an unavailable Group by option's reason (Consumption)"],
  ['.insights-delta, .insights-pace', "a tile's delta sentence (its sr-only twin carries it)"],
  ['.hl-card.finding, .hl-card.spot-card, .hl-line.body', "a card's clamped text in full (a click opens it as a popover)"],
  ['.who > a, .who > .name', "a Recent row's clamped coffee name"],
  ['.bar-labels span', 'a clamped bar label (the row is aria-hidden)']
];
export async function expectNoTitleTips(page: Page) {
  const left = await page.evaluate((ok) => [...document.body.querySelectorAll('[title]')]
    .filter((el) => !ok.some((sel) => el.matches(sel)))
    .map((el) => `${el.outerHTML.slice(0, 120)}`), TITLE_OK.map(([sel]) => sel));
  expect(left, 'native title tips (use TextTip, labelTip or a FloatTip)').toEqual([]);
}

// Leftover column space holds real content (ui-rules 37, 40): two side-by-side columns (a card, or a .fit-col of
// stacked cards) are one height (±1px); a column with two cards never also pads with placeholder rows; inside
// every card that doesn't scroll, the content reaches its bottom (no gap over one row); and no stretched rows
// grow past the cap: --grow ≤ 2 (±0.05 rounding), unless the pair sits at the 20rem floor.
export async function expectColumnsFilled(page: Page, selector: string) {
  const bad = await page.locator(selector).evaluateAll((grids) => grids.flatMap((g) => {
    const cols = [...g.children] as HTMLElement[];
    const out: string[] = [];
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tops = new Map<number, HTMLElement[]>();
    for (const c of cols) tops.set(Math.round(c.getBoundingClientRect().top), [...(tops.get(Math.round(c.getBoundingClientRect().top)) ?? []), c]);
    for (const row of tops.values()) {
      if (row.length !== 2) continue;
      const hs = row.map((c) => c.getBoundingClientRect().height);
      if (Math.abs(hs[0] - hs[1]) > 1) out.push(`columns ${hs.map(Math.round).join(' vs ')}px`);
      if (row.some((c) => c.classList.contains('fit-col')) && g.querySelector('.placeholder')) out.push('placeholder rows beside a stacked card');
      for (const card of row.flatMap((c) => (c.classList.contains('fit-col') ? ([...c.children] as HTMLElement[]) : [c]))) {
        const name = card.dataset.section ?? card.className;
        const fb = card.querySelector<HTMLElement>('.fit-body');
        if (!fb) { out.push(`${name}: no .fit-body`); continue; }
        const grow = parseFloat(getComputedStyle(fb).getPropertyValue('--grow')) || 1;
        if (grow > 2.05 && hs[0] > 20 * rem + 1) out.push(`${name}: rows stretched ${grow}×`);
        if (fb.scrollHeight > fb.clientHeight + 1) continue; // past the cap: scrolls inside
        const parts = [...fb.querySelectorAll('*')].filter((e) => !e.closest('[popover]')).map((e) => e.getBoundingClientRect()).filter((b) => b.height > 0);
        const rowH = fb.querySelector('.board-row, .heat-cell, .bar-row')?.getBoundingClientRect().height ?? 48;
        const gap = fb.getBoundingClientRect().bottom - Math.max(...parts.map((b) => b.bottom));
        if (gap > rowH + 1) out.push(`${name}: ${Math.round(gap)}px empty under a ${Math.round(rowH)}px row`);
        const cardGap = card.getBoundingClientRect().bottom - parseFloat(getComputedStyle(card).paddingBottom) - Math.max(...[...card.querySelectorAll('*')].filter((e) => !e.closest('[popover]')).map((e) => e.getBoundingClientRect().bottom));
        if (cardGap > rowH + 1) out.push(`${name}: ${Math.round(cardGap)}px empty at the bottom`);
      }
    }
    return out;
  }));
  expect(bad, selector).toEqual([]);
}

// An open data tip (FloatTip, a chart tip, ui-rules 36): a bold title, then label/value rows ("Brews  3"), never a
// "Label: value" line.
export async function expectDataTip(tip: Locator) {
  await expect(tip.locator('.tip-title').first()).not.toBeEmpty(); // a caveat block (Low confidence) has its own
  await expect(tip.locator('.tip-rows dt').first()).toBeVisible();
  expect(await tip.locator('.tip-rows dt').evaluateAll((ds) => ds.every((d) => !d.textContent!.includes(':')))).toBe(true);
}

// Axis labels sit outside the data area (ui-rules 43): scroll the plot all the way right; the topmost element at
// a point just inside the first label's right edge is the label itself (never a cell sliding under it), and the
// plot starts at or after the label column's edge.
export async function expectLabelsOutsidePlot(plot: Locator, labels = '.row-label') {
  const r = await plot.evaluate((s, sel) => {
    s.scrollIntoView({ block: 'center' });
    s.scrollLeft = s.scrollWidth;
    const label = (s.parentElement ?? s).querySelector(sel)!.getBoundingClientRect();
    const top = document.elementFromPoint(label.right - 2, label.top + label.height / 2);
    s.scrollLeft = 0;
    return { hit: !!top?.closest(sel), gap: s.getBoundingClientRect().left - label.right };
  }, labels);
  expect(r.hit, 'a label (not a cell) is topmost at its inner edge after scrolling').toBe(true);
  expect(r.gap, 'the plot starts after the label column').toBeGreaterThanOrEqual(-0.5);
}
