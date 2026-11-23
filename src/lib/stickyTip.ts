// The state of one sticky tip (ui-rules 54; WorldMap, GearPanel; StickyTipBody is its content wrapper). The owner keeps what is open;
// this keeps `pinned` and the short bridge delay: an unpinned hover tip closes a moment after the pointer leaves, so the pointer
// can cross the gap onto the tip (its link is clickable), and entering the anchor or the tip cancels it (user, 2026-10-20).
// `shut` clears the owner's open state.
export class StickyTip {
  pinned = false; // a click, tap or Enter pinned it: it stays until a click outside, Escape or the tip's link
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private shut: () => void) {}
  keep = () => clearTimeout(this.timer);
  close = () => { this.keep(); this.pinned = false; this.shut(); };
  later = () => { this.keep(); this.timer = setTimeout(this.close, 100); };
}
