// Tile caption items (ui-rules 55), the one script behind every `.cap-block` (CapItem.svelte, app.css). Lines stay centered, so
// the " · " before an item can't be clipped by CSS alone; instead:
//  1. `--cap-ws`: the gap between items is a collapsible space whose word-spacing makes it exactly as wide as " · " in the
//     caption's font (measured once, in em), so the dot (the item's ::before) fills the gap with a space on each side.
//  2. `data-start` on an item that starts a line hides its dot (visibility only: no reflow, so no loop).
// Dots stay hidden until a list has been placed (`data-ready`), so the server render shows none.
export function captionItems(): () => void {
  let frame = 0;
  const place = () => {
    frame = 0;
    const lists = document.querySelectorAll<HTMLElement>('.cap-list');
    if (!lists.length) return;
    measure(lists[0]);
    for (const list of lists) {
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
    mutations.takeRecords(); // our own probe spans are not a page change
  };
  let mutations: MutationObserver;
  const schedule = () => { frame ||= requestAnimationFrame(place); };
  // The word-spacing that turns a space into " · "'s width, in em (letter-spacing and font from the list itself).
  const measure = (list: HTMLElement) => {
    const probe = (text: string) => {
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;word-spacing:0';
      span.textContent = text;
      list.append(span);
      const w = span.getBoundingClientRect().width;
      span.remove();
      return w;
    };
    const size = parseFloat(getComputedStyle(list).fontSize);
    const ws = (probe(' · ') - probe(' ')) / size;
    if (ws > 0 && ws < 3) document.documentElement.style.setProperty('--cap-ws', `${ws.toFixed(4)}em`);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(document.documentElement);
  mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true, characterData: true });
  void document.fonts?.ready.then(schedule);
  schedule();
  return () => { resize.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame); };
}
