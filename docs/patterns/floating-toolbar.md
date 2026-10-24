# Floating (collapsible sticky) toolbar

Built for /coffees (backlog item "/coffees Sort by", 2026-10-24), seven tuning rounds. Reuse it for /insights and /stats
(Open #3 "Collapsible sticky bars") and any later page. Follow the checklist and most of those rounds are not needed.

## What it is

The page's control block (filters, view switches, search, buttons) pinned to the top while scrolling.

- **Desktop** (width > 640 and height > 450): the full bar is `position: sticky`. No collapse.
- **Phone mode** (width <= 640 **or** height <= 450, so phone landscape too): the bar scrolls away like normal content.
  Once it is off screen a pinned **mini row** (3.5rem = 56px) takes over: a one-line summary and a 44px caret.
  The caret expands the **full bar pinned over the page** (own scroll if taller than the screen). A caret in the bar folds it back.
- Use it when a bar is tall enough that pinning it permanently eats a phone screen (/coffees: ~310px at 480 wide).
  A bar that is one short row (rule 30) needs nothing.

## Component: `src/lib/components/CollapsibleBar.svelte`

```svelte
<CollapsibleBar>
  {#snippet children(caret)}
    ... full bar markup ...
    <div class="add-sort-row"> ... last row ... {@render caret()} </div>
  {/snippet}
  {#snippet summary()} 296 coffees · Urgency ↓ {/snippet}
</CollapsibleBar>
```

- `children(caret)`: the full bar; render `caret()` as the **last item of the last row**. It renders nothing unless expanded.
- `summary`: one line of text for the mini row (count + sort/filter hint). Ellipsis, never wraps.
- Internals: `.cbar` (the bar), `.cbar-mini` (fixed mini row), a spacer `<div>` the height of the bar while it floats (no page jump),
  `scroll-padding-top` on `<html>` (bar height on desktop, 3.5rem on phones) so anchors, `scrollIntoView` and focus land below it.
- Auto behavior: scrolling back to the top folds the bar (`scrolled` is "the bar's in-flow place is off screen");
  flipping to desktop width while expanded folds it.
- State (`expanded`) is **transient chrome**: not in the URL, not remembered (like an open dropdown).
- z-index: bar and mini row 30; above cards/rows; below the phone tab bar (40), toasts (90), dialogs/popovers/tips (top layer, 100+).

## Layout rulings (user, checklist)

1. Rows in the expanded bar are **identical to in-flow**: same x, width, height. Only the row holding the caret may change.
2. Caret: **bottom-right**, the last item of the **last row**, placed by CSS layout (a grid cell of that row), same top and
   height as its left neighbor (ui-rules 5). **No JS measuring** (the measuring script went stale on rotation and overlapped the toggle).
3. No caret in-flow (at the top of the page there is nothing to fold).
4. The last row keeps its height when an optional button (Add Coffee) is absent: `min-height: 44px` on phones.
5. Landscape: the control sharing the caret's row (Sort by) shifts left for it (margin-right on that control, only while the caret exists).
   The caret matches its neighbor's height (36px), not 44.
6. Vertical gaps between bar rows = the horizontal gap between buttons (`--space-2`), at every width, h1 included.
7. Button groups (Show, View) grow to fill their rows (`flex: 1 1 auto`); labels never shrink; phone tab buttons use 0.5rem side padding.
   No orphan wraps where they fit; at 360/390 a wrapping Sort by or "All" is accepted (report it, don't clip text).
8. Share is the rightmost button of its row (rule 51). Edit mode: 3 + 3 rows on phones, short labels ("Save", "Discard", aria-label keeps the full name).
9. Collapsed row <= 56px with a summary; caret 44px target, `aria-expanded`, labels "Show controls" / "Hide controls".
10. Caret color: visually distinct and neutral (no good/bad meaning, not the solid primary of rule 24): fill `var(--color-text-muted)`, icon `var(--color-bg)`, border the fill color (user pick, 2026-10-24; 6.0:1 light, 7.3:1 dark).
11. Tap targets 44px on phones; landscape (> 640 wide) buttons are 36px and the caret matches its neighbor.

## Bugs we hit

- **"Savechanges"**: Svelte trims the leading space inside `<span> changes</span>`. Write `Save <span class="more">changes</span>`.
- **Squeezed rows**: reserving caret room with float, `padding-right` on the toolbar or a margin on a row narrowed rows that must stay identical. Put the caret in its own row's cell instead.
- **Stale caret after rotating**: a one-off measured `top`/`height` never re-ran on a media-query flip. Use layout, not measurement.
- **Signed-out row collapsed**: without the optional button the last row shrank to its text height and the caret lost its size. `min-height` on the row; results text `white-space: nowrap`.
- **Grid auto-placement**: a second item in the same explicit column falls to the next row; give the caret and its sibling `grid-row: 1`.
- **Sticky inside a one-child wrapper** never sticks (its containing block is the wrapper): the bar is a direct child of the page, the spacer is a sibling.
- Rotating to a width > 640 and height > 450 (e.g. 909x480) is not phone mode: the bar folds. Rotation tests use the real phone sizes.

## Tests to copy (`tests/ui/layout.spec.ts`)

- `coffees-bar-pinned`: desktop pinned at y~0 with no caret; phone: no caret in-flow, mini row at y~0 and <= 56px, expand, a control inside
  works, caret right edge = bar content right edge, caret top/height = its left neighbor (+-2px landscape), overlaps nothing,
  **rects of every toolbar control equal expanded vs in-flow**, fold back, URL has no bar state.
- `coffees-bar-rotate`: expand, turn to the other orientation and back (480x909 <-> 1003x333); caret visible, bottom-right, aligned.
- `coffees-bar-row-height`: last row height equal with and without the optional button.
- `coffees-bar-caret-public`: the signed-out expanded row.
- `coffees-bar-inline-edit-*`: Save is not under the bar after `scrollIntoView` (scroll-padding).
- Viewports: w360, w390, phone-portrait, phone-landscape, w1280. Signed in and signed out. Rotate both ways.
- Run only these while iterating (`-g 'coffees-bar'`); the push gate is the only full run.

## Rollout to /insights and /stats

- Wrap each page's sticky bar (`.filter-bar`, the /stats tab bar + people switch) in `CollapsibleBar`; write a `summary` per page
  (range, compare, active filters); give the caret its place in the bar's last row.
- Delete the page's own sticky CSS and its `barHeight` / `scrollPaddingTop` effect (the component owns them).
- Delete or adapt the `max-height: 450px` landscape rules in `.filter-bar` and `expectStickyBar` (it asserts a full bar at top 0 in landscape;
  phones now show the mini row).
- Bars whose controls are rendered by child tabs (`part='bar'`): the caret must still land in the final row; the jump chips row is the last row there.
- Update rule 30's "pending" note when each page ships; keep expanded/collapsed out of the URL.
