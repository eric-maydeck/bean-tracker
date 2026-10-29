import { labelTip } from '$lib/components/labelTip';

// An ellipsized cell shows its full text in the shared tip (hover, focus; ui-rules 36, 39: no native title), only while it
// is actually cut. Same behavior as the Pours tab's, for the evidence grid.
export function cutTip(node: HTMLElement, text: string) {
  let tip: ReturnType<typeof labelTip> | null = null;
  const sync = () => {
    const cut = node.scrollWidth > node.clientWidth + 1;
    if (cut && !tip) {
      node.tabIndex = 0;
      tip = labelTip(node, text);
    } else if (!cut && tip) {
      tip.destroy();
      tip = null;
      node.removeAttribute('tabindex');
      node.style.cursor = '';
    }
  };
  const ro = new ResizeObserver(sync);
  ro.observe(node);
  sync();
  return { update: (t: string) => { text = t; tip?.update(t); sync(); }, destroy: () => (ro.disconnect(), tip?.destroy()) };
}
