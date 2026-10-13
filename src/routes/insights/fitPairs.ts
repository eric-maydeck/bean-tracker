// Paired lab columns (ui-rules 37, 40): two side-by-side columns are one height H = clamp(shorter, taller,
// max(shorter + its stretchable part, 20rem)), from their natural heights: the stretchable part is the shorter
// column's .fit-body content, so its rows grow at most 2× (headings and padding don't grow). A column is a card, or a `.fit-col` of stacked cards.
// The shorter column's rows stretch to fill H (a stack grows each card in proportion to its .fit-body); a column
// taller than H scrolls inside (a stack: its tallest card's .fit-body). `floor` is 20rem in px.
export function pairHeight(a: number, b: number, floor: number, aBody = a, bBody = b): number {
  const [s, t, sb] = a < b ? [a, b, aBody] : [b, a, bBody];
  return Math.min(t, Math.max(s + sb, floor));
}

// A Svelte action on a grid of columns: measures each row's natural heights (top-aligned, no height set) and
// sets both columns of a two-column row to pairHeight. Each card's .fit-body gets --grow, its height over its
// natural height (≥ 1), so a stretched chart scales its marks and type up (round 2 C3). Re-runs on a width
// change and when `key` (the data/view) changes; never on its own height changes, so it can't loop.
export function fitPairs(node: HTMLElement, _key: unknown) {
  let raf = 0, w = -1;
  const cardsOf = (c: HTMLElement) => (c.classList.contains('fit-col') ? ([...c.children] as HTMLElement[]) : [c]);
  const body = (c: HTMLElement) => c.querySelector<HTMLElement>('.fit-body');
  const run = () => {
    const cols = [...node.children] as HTMLElement[];
    const cards = cols.flatMap(cardsOf);
    for (const c of cols) c.style.height = '';
    for (const c of cards) {
      c.style.flexGrow = c.style.flexShrink = c.style.minHeight = '';
      body(c)?.style.removeProperty('--grow');
    }
    node.style.alignItems = 'start';
    const natural = new Map(cards.map((c) => [c, { card: c.offsetHeight, body: body(c)?.offsetHeight ?? 0 }]));
    const rows = new Map<number, HTMLElement[]>();
    for (const c of cols) rows.set(c.offsetTop, [...(rows.get(c.offsetTop) ?? []), c]);
    const heights = new Map(cols.map((c) => [c, c.offsetHeight]));
    node.style.alignItems = '';
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    for (const r of rows.values()) {
      if (r.length !== 2) continue;
      const bodies = r.map((c) => cardsOf(c).reduce((n, x) => n + natural.get(x)!.body, 0));
      const h = pairHeight(heights.get(r[0])!, heights.get(r[1])!, 20 * rem, bodies[0], bodies[1]);
      for (const c of r) {
        c.style.height = `${h}px`;
        if (!c.classList.contains('fit-col')) continue;
        const cs = cardsOf(c), n = heights.get(c)!;
        if (h > n + 1) for (const x of cs) x.style.flexGrow = `${natural.get(x)!.body}`; // every body grows by one ratio
        else if (h < n - 1) {
          const tall = cs.reduce((a, b) => (natural.get(b)!.card > natural.get(a)!.card ? b : a));
          tall.style.flexShrink = '1';
          tall.style.minHeight = '0';
        }
      }
      for (const x of r.flatMap(cardsOf)) {
        const b = body(x), n = natural.get(x)!.body;
        if (b && n && b.clientHeight > n + 1) b.style.setProperty('--grow', (b.clientHeight / n).toFixed(3));
      }
    }
  };
  const later = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  };
  const ro = new ResizeObserver(([e]) => {
    if (Math.round(e.contentRect.width) === w) return;
    w = Math.round(e.contentRect.width);
    later();
  });
  ro.observe(node);
  document.fonts?.ready.then(later);
  return { update: later, destroy: () => (ro.disconnect(), cancelAnimationFrame(raf)) };
}
