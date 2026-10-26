// Tile caption items (ui-rules 55), the one script behind every `.cap-list` (CapItem.svelte, app.css). Lines stay centered, so
// the " · " before an item can't be clipped by CSS alone; instead, per list:
//  1. `--cap-ws` (on the list): the gap between items is a collapsible space whose word-spacing makes it exactly as wide as
//     " · " in that list's own font (measured in em), so the dot (the item's ::before) fills the gap with a space each side.
//  2. `data-start` on an item that starts a line hides its dot (visibility only: no reflow, so no loop).
// Dots stay hidden until a list has been placed (`data-ready`), so the server render shows none. Each list has its own
// ResizeObserver (any size change, including a hidden ancestor showing) and MutationObserver (items or text changing inside the
// list without changing its box), both scheduling a placement in the next frame; one body MutationObserver notices lists added or removed.
export function captionItems(): () => void {
  const lists = new Map<HTMLElement, { ro: ResizeObserver; mo: MutationObserver; frame: number }>();

  const probe = (list: HTMLElement, text: string) => {
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;word-spacing:0';
    span.textContent = text;
    list.append(span);
    const w = span.getBoundingClientRect().width;
    span.remove();
    return w;
  };

  function place(list: HTMLElement) {
    if (!list.isConnected || !list.getClientRects().length) return; // hidden: placed when it shows (the observer fires on its resize)
    const size = parseFloat(getComputedStyle(list).fontSize);
    const ws = (probe(list, ' · ') - probe(list, ' ')) / size;
    if (ws > 0 && ws < 3) list.style.setProperty('--cap-ws', `${ws.toFixed(4)}em`);
    for (const item of list.querySelectorAll<HTMLElement>(':scope > .cap-item')) {
      const gap = item.previousElementSibling?.classList.contains('cap-gap') ? item.previousElementSibling : item;
      const before = document.createRange();
      before.setStart(list, 0);
      before.setEndBefore(gap);
      const rects = before.getClientRects();
      const above = rects.length ? rects[rects.length - 1] : null;
      item.toggleAttribute('data-start', !above || item.getBoundingClientRect().top >= above.bottom - 2);
    }
    list.setAttribute('data-ready', '');
  }

  // Place a list in the next frame; its own probe spans are discarded from its mutation queue (the attribute writes aren't observed).
  const replace = (list: HTMLElement) => {
    const e = lists.get(list);
    if (!e || e.frame) return;
    e.frame = requestAnimationFrame(() => { e.frame = 0; place(list); e.mo.takeRecords(); });
  };
  const stop = (e: { ro: ResizeObserver; mo: MutationObserver; frame: number }) => (e.ro.disconnect(), e.mo.disconnect(), cancelAnimationFrame(e.frame));
  let frame = 0;
  const sync = () => {
    frame = 0;
    for (const list of document.querySelectorAll<HTMLElement>('.cap-list')) {
      if (lists.has(list)) continue;
      const entry = { ro: new ResizeObserver(() => replace(list)), mo: new MutationObserver(() => replace(list)), frame: 0 }; // the RO also fires once on observe
      entry.ro.observe(list);
      entry.mo.observe(list, { childList: true, characterData: true, subtree: true });
      lists.set(list, entry);
    }
    for (const [list, e] of lists) if (!list.isConnected) (stop(e), lists.delete(list));
  };
  const schedule = () => { frame ||= requestAnimationFrame(sync); };
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true });
  void document.fonts?.ready.then(() => { for (const list of lists.keys()) replace(list); });
  sync();
  return () => {
    mutations.disconnect();
    cancelAnimationFrame(frame);
    for (const e of lists.values()) stop(e);
    lists.clear();
  };
}
