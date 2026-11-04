// A choice that shrinks the last panel at the page bottom would clamp the scroll and slide the clicked control down. Hold the
// panel at its old height (min-height) so the page keeps its length, and let go as soon as that wouldn't move anything: when
// the visitor scrolls up by the spare height (or at once, mid-page). Call it just before the choice is applied.
export function holdHeight(el: HTMLElement | undefined): void {
  if (!el) return;
  const panel = el;
  panel.style.minHeight = `${panel.offsetHeight}px`;
  const off = () => {
    panel.style.minHeight = '';
    removeEventListener('scroll', check);
    removeEventListener('resize', off);
  };
  // The panel's own content height: the last child's bottom plus the panel's bottom padding and border.
  const natural = () => {
    const s = getComputedStyle(panel), last = panel.lastElementChild;
    return last ? last.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + parseFloat(s.paddingBottom) + parseFloat(s.borderBottomWidth) : 0;
  };
  function check() {
    if (!panel.isConnected) return off();
    const spare = panel.offsetHeight - natural();
    if (spare <= 1 || scrollY + innerHeight + 2 < document.documentElement.scrollHeight - spare) off();
  }
  addEventListener('scroll', check, { passive: true });
  // A resize or rotation reflows the page anyway: drop the hold rather than leave a stale blank band.
  addEventListener('resize', off);
  // After the new content has rendered (local state: the next frame).
  requestAnimationFrame(() => requestAnimationFrame(check));
}
