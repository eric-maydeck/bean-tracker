# Floating (collapsible sticky) toolbar

Built for /coffees (2026-10-24, seven tuning rounds), then /insights (same day). Reuse it for any later page (/stats is out of
scope, to be deleted). Follow the checklist and most of those rounds are not needed.

## What it is

The page's control block (filters, view switches, search, buttons) pinned to the top while scrolling.

- **Desktop** (width > 640 and height > 450): the full bar is `position: sticky`. No collapse.
- **Phone mode** (width <= 640 **or** height <= 450, so phone landscape too): the bar scrolls away like normal content.
  Once it is off screen a pinned **mini row** (3.5rem = 56px) takes over: a one-line summary and a 44px caret.
  The caret expands the **full bar pinned over the page** (own scroll if taller than the screen). A **pull tab** hanging off its bottom-right edge folds it back.
- Use it when a bar is tall enough that pinning it permanently eats a phone screen (/coffees: ~310px at 480 wide).
  A bar that is one short row (rule 30) needs nothing.

## Component: `src/lib/components/CollapsibleBar.svelte`

```svelte
<CollapsibleBar>                                   <!-- /insights: <CollapsibleBar desktopPinned={barHeight}> -->
  {#snippet children()} ... full bar markup, no caret ... {/snippet}
  {#snippet summary()} 296 coffees · Urgency ↓ {/snippet}
</CollapsibleBar>
```

- `children`: the full bar, a plain snippet. The component owns the mini row's expand caret and the pull tab (CSS layout, no measuring).
- `summary`: one line of text for the mini row. Ellipsis, never wraps.
- `desktopPinned` (px): **inner mode** for a page that pins only part of the block on desktop (/insights: `.filter-bar`, whose height is
  the value). The wrappers become `display: contents` on desktop and add no chrome on phones' in-flow bar; the page keeps its own
  sticky part, and the block (heading to Jump to chips) is what collapses on phones. The page makes its own sticky part
  `position: static` in phone mode.
- `pinnedBar.h` (`pinnedBar.svelte.ts`): what is pinned at the top (3.5rem on phones, `desktopPinned ?? bar height` on desktop). Milestones'
  ruler and others read it; it and `scroll-padding-top` are reset only on unmount (a re-run never flashes 0).
- One-shot `#hash` scroll on load after the first measure, landing below the pinned part (the component owns it; pages delete theirs).
- A `#hash` link inside the bar (Jump to chips) folds it; focus then goes to the landed section (accepted). Popovers inside `.cbar`
  (the Ratings menu) close when the overlay scrolls under them. Back to top stays visible and tappable while the overlay is open; it drops to z-index 29 (behind the overlay and pull tab) only while `.cbar.overlay` exists, and a tap folds the bar and scrolls to the top.
- Focus: expand focuses the pull tab ("Hide controls"); fold focuses the short row's "Show controls".
- Internals: `.cbar` (the bar; `.overlay` while expanded, with a `.cbar-scroll` box and the pull tab as its sibling), `.cbar-mini` (fixed mini row),
  a spacer `<div>` the height of the block while it floats (no page jump; it follows the content when it changes),
  `scroll-padding-top` on `<html>` (bar height on desktop, 3.5rem on phones) so anchors, `scrollIntoView` and focus land below it.
- Auto behavior: scrolling back until the block's in-flow place shows folds the bar (`scrolled` = the bottom of the whole block, Jump to chips
  included, has left the viewport); flipping to desktop width while expanded folds it; rotating to another phone size keeps it open.
- Overlay `max-height`: `100dvh - 44px` (pull tab) in landscape; at <= 640 wide also `- 64px - env(safe-area-inset-bottom)` for the phone tab bar
  (its real height is ~60px, min-height 56).
- State (`expanded`) is **transient chrome**: not in the URL, not remembered (like an open dropdown).
- z-index: bar and mini row 30; above cards/rows; below the phone tab bar (40), toasts (90), dialogs/popovers/tips (top layer, 100+).

## Layout rulings (user, checklist)

1. Rows in the expanded bar are **identical to in-flow**: same x, width, height, no exceptions.
2. Fold caret = a **pull tab** hanging below the expanded bar's bottom border at its bottom-right, in no row: right edge = the short row
   caret's right edge (viewport width - 16px), 44x44 tap target, the visible tab is the expand caret's exact box (44x44, same fill, border and icon, `0 0 var(--radius) var(--radius)` corners), flush under the bar,
   pinned to the overlay's visible bottom (a sibling of the scroll box, never scrolled away), first focusable in the overlay.
   **No JS measuring** (the old measuring script went stale on rotation and overlapped the toggle).
3. No caret in-flow (at the top of the page there is nothing to fold).
4. The /coffees last row keeps `min-height: 44px` on phones (the signed-out look).
5. (Removed: no control shifts for a caret any more.)
6. Vertical gaps between bar rows = the horizontal gap between buttons (`--space-2`), at every width, h1 included.
7. Button groups (Show, View) grow to fill their rows (`flex: 1 1 auto`); labels never shrink; phone tab buttons use 0.5rem side padding.
   No orphan wraps where they fit; at 360/390 a wrapping Sort by or "All" is accepted (report it, don't clip text).
8. Share is the rightmost button of its row (rule 51). Edit mode: 3 + 3 rows on phones, short labels ("Save", "Discard", aria-label keeps the full name).
9. Collapsed row <= 56px with a one-line summary; caret 44px target at the content right edge, `aria-expanded`, labels "Show controls" / "Hide controls".
10. Caret color: visually distinct and neutral (no good/bad meaning, not the solid primary of rule 24): fill `var(--color-text-muted)`, icon `var(--color-bg)`, border the fill color (user pick, 2026-10-24; 6.0:1 light, 7.3:1 dark).
11. Tap targets 44px on phones; landscape (> 640 wide) buttons are 36px and the caret matches its neighbor.

## Bugs we hit

- **"Savechanges"**: Svelte trims the leading space inside `<span> changes</span>`. Write `Save <span class="more">changes</span>`.
- **Squeezed rows**: reserving caret room with float, `padding-right` on the toolbar or a margin on a row narrowed rows that must stay identical. Put the caret in its own row's cell instead.
- **Stale caret after rotating**: a one-off measured `top`/`height` never re-ran on a media-query flip. Use layout, not measurement.
- **Signed-out row collapsed**: without the optional button the last row shrank to its text height and the caret lost its size. `min-height` on the row; results text `white-space: nowrap`.
- **Grid auto-placement**: a second item in the same explicit column falls to the next row; give the caret and its sibling `grid-row: 1`.
- **Spacer must follow the content while expanded**: tab switch, Reset, filters or custom dates change the block's height; the spacer is as tall as the block's in-flow height, so the page under the overlay never jumps.
- **Sticky inside a one-child wrapper** never sticks (its containing block is the wrapper): the bar is a direct child of the page, the spacer is a sibling.
- **CSS leaked to other pages**: a phone rule on `.toolbar .tab-group button` also hit the /insights and /stats `.toolbar` (and `.cbar .toolbar`
  later leaked into /insights: use a page-only class such as `.coffees-toolbar`). Scope every bar rule under `.cbar` or a page-only class.
- Rotating to a width > 640 and height > 450 (e.g. 909x480) is not phone mode: the bar folds. Rotation tests use the real phone sizes.

## Tests to copy (`tests/ui/layout.spec.ts`, helpers `tests/ui/collapsibleBar.ts`)

- `insights-cbar-*` (every tab, chips, custom dates, stays-open, jump-folds, top-folds, rotate, short-tab, restore, overlay-scroll, ratings-menu,
  tip, font-scale, milestones-bar-h, inflow): short row at y~0 and <= 56px, one-line summary, expanded rects equal in-flow (+-1px), pull tab
  placement and first focus, spacer = in-flow block height, URL has no bar state. `insights-cbar-inflow-*` compares every block element
  against a committed baseline recorded before the change.
- `coffees-bar-pinned`, `-rotate`, `-row-height`, `-caret-public`, `coffees-bar-inline-edit-*`: the /coffees equivalents.
- Measure against `pinnedBottom()` (`floatTip.ts`; `pinnedBottomOf(page)` in the helpers), never the `.filter-bar` bottom. A target just
  under a short in-flow block can land with the block's tail still showing and no short row yet: use `anchorGap(page, id)`.
  `scrollPastBar` clamps on desktop for short tabs (it climbs past `display: contents` wrappers to measure).
- Viewports: w360, w390, phone-portrait, phone-landscape, w1280. Signed in and signed out. Rotate both ways.
- Run only these while iterating (`-g 'insights-cbar|coffees-bar'`); the push gate is the only full run.

## Rollout

- /coffees: done (plain mode). /insights: done (inner mode, `desktopPinned`); the Jump to chips are lifted into the page via each tab's
  `jumpLinks` module export so they sit inside the block. /stats: out of scope (to be deleted).
- New page: wrap its bar in `CollapsibleBar`, write a `summary`, delete the page's own sticky CSS and `scrollPaddingTop` / hash effect (the
  component owns them), keep expanded/collapsed out of the URL, scope all rules under `.cbar*` or a page-only class.
- Delete or adapt `max-height: 450px` landscape rules in the page's bar and its `expectStickyBar` use (phones show the mini row).
- Bars whose controls are rendered by child tabs (`part='bar'`) render inside the block as usual; the Jump to chips come from the page.
