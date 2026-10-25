// Where a chart tip goes (round 2, C2): above its anchor, centered and clamped 8px inside the viewport; below
// when there isn't room above (under the sticky filter bar); whichever side has more room when neither fits, clamped into the visible band (over the anchor).
// `view.top` / `view.bottom`: the visible band between the sticky bar and any bottom tab bar.
type Box = { left: number; top: number; right: number; bottom: number };
export function tipPlace(a: Box, tip: { w: number; h: number }, view: { w: number; top: number; bottom: number }, gap = 6) {
  const x = Math.min(Math.max((a.left + a.right) / 2 - tip.w / 2, 8), Math.max(8, view.w - tip.w - 8));
  const above = a.top - gap - tip.h, below = a.bottom + gap;
  const side = above >= view.top ? above : below + tip.h <= view.bottom ? below : a.top - view.top > view.bottom - a.bottom ? above : below;
  // Neither side fits (a phone in landscape under its sticky bar): overlap the anchor rather than leave the band.
  return { x, y: Math.max(view.top, Math.min(side, view.bottom - tip.h)) };
}
// The visible band: below whatever is pinned at the top (pinnedBottom), above a fixed .bottom-tabs bar that is shown.
export function viewBand() {
  const tabs = document.querySelector('.bottom-tabs')?.getBoundingClientRect();
  return {
    w: document.documentElement.clientWidth,
    top: pinnedBottom(),
    bottom: tabs && tabs.height ? tabs.top : innerHeight
  };
}
// Only one tip is open app-wide: a FloatTip that opens dismisses the one before it (its owner may still think it
// open), and so does a help popover (.mode-tip, modeTip.ts placeTip).
export const openTip: { current: { dismiss: () => void } | null } = { current: null };
export function closeFloatTip() {
  openTip.current?.dismiss();
  openTip.current = null;
}
// Viewport bottom of whatever is pinned to the top: the phone short row, the expanded bar overlay, or the sticky
// .filter-bar (0 when none). Self-contained: tests serialize it into the page.
export function pinnedBottom(): number {
  const pinned = document.querySelector('.cbar-mini') ?? document.querySelector('.cbar.overlay');
  if (pinned) return pinned.getBoundingClientRect().bottom;
  const bar = document.querySelector('.filter-bar');
  const bottom = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0;
  return bottom > 0 ? bottom : 0;
}
