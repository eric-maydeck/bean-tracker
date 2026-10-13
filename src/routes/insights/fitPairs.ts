// Paired lab cards (ui-rules 37): a row of two cards is one height H = clamp(shorter, taller, max(2 × shorter,
// 20rem)), from their natural heights. The shorter card's rows stretch to fill H; a taller card past H scrolls
// inside its .fit-body. `floor` is 20rem in px.
export function pairHeight(a: number, b: number, floor: number): number {
  const [s, t] = a < b ? [a, b] : [b, a];
  return Math.min(t, Math.max(2 * s, floor));
}

// A Svelte action on a grid of .fit-card cards: measures each row's natural heights (top-aligned, no height
// set) and sets both cards of a two-card row to pairHeight. Each card's .fit-body gets --grow, its height over
// its natural height (≥ 1), so a stretched chart scales its marks and type up (ui-rules 37, round 2 C3). Re-runs on a width change and when `key` (the
// data/view) changes; never on its own height changes, so it can't loop.
export function fitPairs(node: HTMLElement, _key: unknown) {
  let raf = 0, w = -1;
  const run = () => {
    const cards = [...node.children] as HTMLElement[];
    const body = (c: HTMLElement) => c.querySelector<HTMLElement>('.fit-body');
    for (const c of cards) {
      c.style.height = '';
      body(c)?.style.removeProperty('--grow');
    }
    node.style.alignItems = 'start';
    const natural = new Map(cards.map((c) => [c, body(c)?.offsetHeight ?? 0]));
    const rows = new Map<number, HTMLElement[]>();
    for (const c of cards) rows.set(c.offsetTop, [...(rows.get(c.offsetTop) ?? []), c]);
    const heights = [...rows.values()].map((r) => r.map((c) => c.offsetHeight));
    node.style.alignItems = '';
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    [...rows.values()].forEach((r, i) => {
      if (r.length !== 2) return;
      const h = pairHeight(heights[i][0], heights[i][1], 20 * rem);
      for (const c of r) c.style.height = `${h}px`;
      for (const c of r) {
        const b = body(c), n = natural.get(c)!;
        if (b && n && b.clientHeight > n + 1) b.style.setProperty('--grow', (b.clientHeight / n).toFixed(3));
      }
    });
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
