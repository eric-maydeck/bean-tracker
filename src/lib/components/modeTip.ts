// Help popovers (ui-rules 27): a `.mode-tip-button` names its `.mode-tip` (a native auto popover) with popovertarget, or
// a dialog trigger (Score) with data-tip. The page-wide pointer handlers (tipOver/tipOut/tipClick) sit on the root
// layout's <svelte:document>; each popover calls placeTip from onbeforetoggle. Styles: app.css (.mode-tip).
import { closeFloatTip } from './floatTip';

// Click-for-explanation triggers also open on mouse hover (mouse only: touch and keyboard keep
// click/Enter). The hover opens it, so a mouse click must not toggle it shut again.
const tipOf = (e: Event) => {
  const b = (e.target as Element | null)?.closest?.('.mode-tip-button');
  return b && matchMedia('(hover: hover)').matches ? document.getElementById(b.getAttribute('popovertarget') ?? b.getAttribute('data-tip') ?? '') : null;
};
// The tip a hover opened: a click on its button must leave it open, not toggle it shut.
let hoverTip: HTMLElement | null = null;
let closing: ReturnType<typeof setTimeout> | undefined;
// The hover tip and its trigger are one area: the pointer can cross the gap into the tip (to
// scroll a long list) and back. Leaving the area closes it after a short grace.
const inHover = (el: EventTarget | null) =>
  !!hoverTip && el instanceof Element &&
  (hoverTip.contains(el) || !!document.querySelector(`[popovertarget="${hoverTip.id}"], [data-tip="${hoverTip.id}"]`)?.contains(el));
function closeHover() {
  clearTimeout(closing);
  if (hoverTip?.matches(':popover-open')) hoverTip.hidePopover();
  hoverTip = null;
}
export function tipOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  if (inHover(e.target)) return clearTimeout(closing);
  const tip = tipOf(e);
  if (!tip || tip.matches(':popover-open')) return;
  closeHover();
  tip.showPopover();
  hoverTip = tip;
}
export function tipOut(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !inHover(e.target) || inHover(e.relatedTarget)) return;
  clearTimeout(closing);
  closing = setTimeout(closeHover, 200);
}
export function tipClick(e: MouseEvent) {
  const tip = tipOf(e);
  if (!tip) return;
  // A dialog trigger opens its dialog: the hover tip steps aside. A popover trigger keeps the tip
  // the hover opened (unless Escape or a click elsewhere already closed it: then the click reopens it).
  if ((e.target as Element).closest('[data-tip]')) tip.hidePopover();
  else if (tip === hoverTip && tip.matches(':popover-open')) e.preventDefault();
}

// A popover sits in the top layer; put it under its caption button (above
// when there's no room below). Its CSS clamps it inside the viewport.
// Opening one closes an open FloatTip (one tip open at a time, ui-rules 36).
// ponytail: fixed position, so it stays put if the page scrolls while open.
export function placeTip(e: ToggleEvent) {
  if (e.newState !== 'open') return;
  closeFloatTip();
  const tip = e.currentTarget as HTMLElement;
  const r = document.querySelector(`[popovertarget="${tip.id}"], [data-tip="${tip.id}"]`)!.getBoundingClientRect();
  const below = r.bottom + 96 < innerHeight;
  tip.style.setProperty('--x', `${r.left + r.width / 2}px`);
  tip.style.setProperty('--y', `${below ? r.bottom : r.top}px`);
  tip.toggleAttribute('data-above', !below);
}
