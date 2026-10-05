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
      if (el.matches('[aria-haspopup="listbox"], .compact-row[aria-expanded="true"]')) continue;
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
        const r = el.getBoundingClientRect();
        if (r.width < 43.5 || r.height < 43.5) {
          out.push(`tap target ${Math.round(r.width)}×${Math.round(r.height)} < 44×44: ${describe(el)}`);
        }
      }
    }

    // 5. Buttons sharing a row (same nearest flex/grid container, overlapping
    // vertically) have the same top and height.
    const container = (el: Element) => {
      let p = el.parentElement;
      while (p && !/flex|grid/.test(getComputedStyle(p).display)) p = p.parentElement;
      return p;
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
          const sameRow = a.top < b.bottom && b.top < a.bottom;
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
    return out;
  });
  expect(problems, `layout problems on ${page.url()}:\n${problems.join('\n')}`).toEqual([]);
}
