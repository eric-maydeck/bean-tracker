import { mount, unmount } from 'svelte';
import FloatTip from './FloatTip.svelte';

// A label tip (ui-rules 36, 39): an icon-only button's or a filter chip's name in the site's tip (TipBody with just a
// title, in a FloatTip: never clipped, one open at a time), on mouse hover and keyboard focus. A tap or click still
// just acts and shows none. The element keeps its aria-label; this replaces a native `title`.
// `use:labelTip={'Edit'}`; a falsy label (the text button variant) attaches nothing.
export function labelTip(node: HTMLElement, label: string | null | undefined) {
  let tip: ReturnType<typeof mount> | null = null;
  const close = () => {
    if (tip) void unmount(tip);
    tip = null;
  };
  // Another tip dismissing this one calls onclose from inside its own effect: unmount after it.
  const closed = () => queueMicrotask(close);
  const open = () => {
    if (!tip && label) tip = mount(FloatTip, { target: document.body, props: { anchor: node, tip: { title: label }, onclose: closed } });
  };
  const on: [string, (e: Event) => void][] = [
    ['pointerenter', (e) => (e as PointerEvent).pointerType === 'mouse' && open()],
    ['pointerleave', (e) => (e as PointerEvent).pointerType === 'mouse' && close()],
    ['focus', () => node.matches(':focus-visible') && open()],
    ['blur', close],
    ['pointerdown', close],
    ['keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close()]
  ];
  for (const [e, f] of on) node.addEventListener(e, f);
  return {
    update(next: string | null | undefined) {
      if (next === label) return;
      label = next;
      if (tip) (close(), node.matches(':focus-visible, :hover') && open());
    },
    destroy() {
      close();
      for (const [e, f] of on) node.removeEventListener(e, f);
    }
  };
}
