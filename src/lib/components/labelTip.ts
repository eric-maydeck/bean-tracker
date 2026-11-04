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
export const labelTip = (node: HTMLElement, label: Label) => makeTip(node, label, false);
// A chart mark's tip: it follows the pointer (and sits at a tap's point) instead of staying at the mark.
export const followTip = (node: HTMLElement, label: Label) => makeTip(node, label, true);
function makeTip(node: HTMLElement, label: Label, follow: boolean) {
  let tip: ReturnType<typeof mount> | null = null;
  let at: { x: number; y: number } | null = null;
  const track = (e: Event) => {
    const p = e as PointerEvent;
    if (!follow || p.clientX == null) return;
    at = { x: p.clientX, y: p.clientY };
  };
  let pinned = false;
  const passive = !node.matches('a[href], button:not([aria-disabled="true"]), input, select, [role="button"]');
  if (passive && label) node.style.cursor = 'help';
  const acts = (e: Event) => {
    const hit = (e.target as Element | null)?.closest('a[href], button, input, select, textarea, [role="button"]');
    return !!hit && hit !== node && node.contains(hit);
  };
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
    if (!tip && label) {
      tip = mount(FloatTip, { target: document.body, props: { anchor: node, tip: typeof label === 'string' ? { title: label } : label, onclose: closed, at, follow } });
    }
  };
  const pin = () => {
    open();
    pinned = true;
    document.addEventListener('click', away, true);
  };
  const on: [string, (e: Event) => void][] = [
    ['pointerenter', (e) => (track(e), (e as PointerEvent).pointerType === 'mouse' && open())],
    ['pointermove', track],
    ['pointerleave', (e) => ((at = null), (e as PointerEvent).pointerType === 'mouse' && !pinned && close())],
    ['focus', () => node.matches(':focus-visible') && ((at = null), open())],
    ['blur', () => !pinned && close()],
    // A tap on passive text pins its tip. Only when there is a tip to pin (a click made while the label was empty used to leave it
    // pinned, so the tip that came later stayed open after the pointer left), and not for a click that a control inside it handles.
    passive ? ['click', (e) => label && !acts(e) && (track(e), pin())] : ['pointerdown', close],
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

// A truncated name's full text in the tip (ui-rules 50): a tile's sub line or caption link that ellipsizes or clamps. The tip
// exists only while the text is cut (checked on hover and focus, the node and its next 3 ancestors, where the clip is set:
// only a hidden or clipped overflow counts, so visible or scrolling ancestors never raise a tip for fully shown text).
// `use:truncTip={text}`: the visible label (keeps a caption's " · " separators); absent = the node's text.
export function truncTip(node: HTMLElement, text?: string | null) {
  const clips = (e: HTMLElement) => {
    const s = getComputedStyle(e);
    const hid = (o: string) => o === 'hidden' || o === 'clip';
    return (hid(s.overflowX) && e.scrollWidth > e.clientWidth + 1) || (hid(s.overflowY) && e.scrollHeight > e.clientHeight + 1);
  };
  const cut = () => {
    if ([...node.querySelectorAll<HTMLElement>('*')].some(clips)) return true; // a part inside it (a second line) cut on its own
    for (let e: HTMLElement | null = node, i = 0; e && i < 4; e = e.parentElement, i++) if (clips(e)) return true;
    return false;
  };
  const set = () => tip.update(cut() ? (text || node.textContent)?.trim() : undefined);
  node.addEventListener('pointerenter', set); // before labelTip's own listeners: the label is current when it opens
  node.addEventListener('focus', set);
  const tip = labelTip(node, undefined);
  return { update(next?: string | null) { text = next; }, destroy() { node.removeEventListener('pointerenter', set); node.removeEventListener('focus', set); tip.destroy(); } };
}
