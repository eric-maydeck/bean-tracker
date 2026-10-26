import { mount, unmount, type ComponentProps } from 'svelte';
import FloatTip from './FloatTip.svelte';
type Tip = NonNullable<ComponentProps<typeof FloatTip>['tip']>;

// A label tip (ui-rules 36, 39): an icon-only button's or a filter chip's name in the site's tip (TipBody with just a
// title, in a FloatTip: never clipped, one open at a time), on mouse hover and keyboard focus. A tap or click still
// just acts and shows none. The element keeps its aria-label; this replaces a native `title`.
// `use:labelTip={'Edit'}`; a falsy label (the text button variant) attaches nothing. A Tip in place of the string: a
// fuller hover tip in the same mechanism (a switch option's help, ui-rules 27; a delta's sentence; a card's full text).
// On text that does nothing on a click (not a link or a working button) the tip is the point: the help cursor, and a
// tap or click opens it too and keeps it open until a tap elsewhere (ui-rules 49, 50).
type Label = string | Tip | null | undefined;
export function labelTip(node: HTMLElement, label: Label) {
  let tip: ReturnType<typeof mount> | null = null;
  let pinned = false;
  const passive = !node.matches('a[href], button:not([aria-disabled="true"]), input, select, [role="button"]');
  if (passive && label) node.style.cursor = 'help';
  const away = (e: Event) => !node.contains(e.target as Node) && close();
  const close = () => {
    if (tip) void unmount(tip);
    tip = null;
    pinned = false;
    document.removeEventListener('click', away, true);
  };
  // Another tip dismissing this one calls onclose from inside its own effect: unmount after it.
  const closed = () => queueMicrotask(close);
  const open = () => {
    if (!tip && label) tip = mount(FloatTip, { target: document.body, props: { anchor: node, tip: typeof label === 'string' ? { title: label } : label, onclose: closed } });
  };
  const pin = () => {
    open();
    pinned = true;
    document.addEventListener('click', away, true);
  };
  const on: [string, (e: Event) => void][] = [
    ['pointerenter', (e) => (e as PointerEvent).pointerType === 'mouse' && open()],
    ['pointerleave', (e) => (e as PointerEvent).pointerType === 'mouse' && !pinned && close()],
    ['focus', () => node.matches(':focus-visible') && open()],
    ['blur', () => !pinned && close()],
    passive ? ['click', pin] : ['pointerdown', close],
    ['keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close()]
  ];
  for (const [e, f] of on) node.addEventListener(e, f);
  return {
    update(next: Label) {
      if (next === label || (typeof next === 'object' && JSON.stringify(next) === JSON.stringify(label))) return;
      label = next;
      if (passive) node.style.cursor = next ? 'help' : '';
      if (tip) (close(), node.matches(':focus-visible, :hover') && open());
    },
    destroy() {
      close();
      for (const [e, f] of on) node.removeEventListener(e, f);
    }
  };
}
