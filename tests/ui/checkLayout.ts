import { expect, type Page } from '@playwright/test';

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
      // A Suggest candidate row is content (title, notes), not a label.
      if (el.matches('[aria-haspopup="listbox"], .compact-row[aria-expanded="true"], .suggest-pick')) continue;
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
    // group header: role="group" labelled by a shown element.
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
    return out;
  });
  expect(problems, `layout problems on ${page.url()}:\n${problems.join('\n')}`).toEqual([]);
}

// Card grids: every row of cards runs edge to edge (no empty cell, no ragged last row; ui-rules 28, 33),
// and no card sits alone on a row it stretches across (a lone card, ui-rules 33) unless `allowLone`.
export async function expectGridRowsFull(page: Page, selector: string, allowLone = false) {
  const gaps = await page.locator(selector).evaluateAll((rows, allowLone) =>
    rows.flatMap((row) => {
      const o = row.getBoundingClientRect();
      const byTop = new Map<number, DOMRect[]>();
      for (const t of row.children) {
        const r = t.getBoundingClientRect();
        byTop.set(Math.round(r.top), [...(byTop.get(Math.round(r.top)) ?? []), r]);
      }
      return [...byTop.values()].flatMap((rs) => {
        const [l, r] = [Math.min(...rs.map((x) => x.left)) - o.left, o.right - Math.max(...rs.map((x) => x.right))];
        if (!allowLone && rs.length === 1 && row.children.length > 1) return [`a lone tile on its own row (of ${row.children.length})`];
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
