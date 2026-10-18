// Where a chart tip goes (round 2, C2): above its anchor, centered and clamped 8px inside the viewport; below
// when there isn't room above (under the sticky filter bar); whichever side has more room when neither fits.
// `view.top` / `view.bottom`: the visible band between the sticky bar and any bottom tab bar.
type Box = { left: number; top: number; right: number; bottom: number };
export function tipPlace(a: Box, tip: { w: number; h: number }, view: { w: number; top: number; bottom: number }, gap = 6) {
  const x = Math.min(Math.max((a.left + a.right) / 2 - tip.w / 2, 8), Math.max(8, view.w - tip.w - 8));
  const above = a.top - gap - tip.h, below = a.bottom + gap;
  const y = above >= view.top ? above : below + tip.h <= view.bottom ? below : a.top - view.top > view.bottom - a.bottom ? Math.max(view.top, above) : below;
  return { x, y };
}
// The visible band: below a sticky .filter-bar that is in view, above a fixed .bottom-tabs bar that is shown.
export function viewBand() {
  const bar = document.querySelector('.filter-bar')?.getBoundingClientRect();
  const tabs = document.querySelector('.bottom-tabs')?.getBoundingClientRect();
  return {
    w: document.documentElement.clientWidth,
    top: bar && bar.bottom > 0 ? bar.bottom : 0,
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
