# Design system

Where the visual values live. Every value cites its file; the numbered rules and
what `checkLayout` enforces are in `docs/ui-rules.md`. Change a value in the
cited file, not by copying it elsewhere.

## Colour tokens (`src/app.css`, `:root`)

- Surface: `--color-bg` #faf7f2, `--color-surface` #ffffff, `--color-border` #e6ddd2.
- Text: `--color-text` #2b211b, `--color-text-muted` #6b5c4f, `--color-label` #5c3a24 (bold tile names).
- Accent: `--color-accent` #8a5a3b, `--color-accent-contrast` #ffffff. Links, primary buttons, pressed toggles.
- Status: `--color-urgent` #c0392b, `--color-fresh` #4a7c59, `--color-frozen` #2e6f9e, `--color-warm` #d68910.
- Categorical series: `--series-1`..`--series-14` (7 hues x 2 tones) with a matching `-ink` text tone each; `--series-other` for "Other".
- Chart browns: `--series-brown-1..3`. Signed deltas: `--div-low` / `--div-mid` / `--div-high` plus `-ink` text variants.
- Dark theme: the `@media (prefers-color-scheme: dark)` block re-declares the tokens (`:root:not([data-theme='light'])`), so use tokens, never literal colours.

## Spacing, radius, shadow (`src/app.css`, `:root`)

- Scale: `--space-1` 0.25rem, `--space-2` 0.5rem, `--space-3` 0.75rem, `--space-4` 1rem, `--space-5` 1.5rem, `--space-6` 2rem.
- `--radius` 10px on cards, buttons, selects. `--shadow` at rest, `--shadow-hover` on hover (cards also lift 1px).

## Type (`src/app.css`)

- `body`: `--font-sans` (Karla), 14px, line-height 1.5.
- `h1` to `h3`: `--font-display` (Lora), weight 600, line-height 1.25. `h1` 1.5rem, `h2` 1rem.
- Small text: `.stat-label` 0.72rem uppercase muted; table text 0.9rem; control text 0.85rem.
- Numbers in columns use `font-variant-numeric: tabular-nums`.

## Controls

- Tap target: 44px minimum on phones (`.card-actions .button` `min-height: 44px`; `.ctl-select` goes to `min-height: 44px; font-size: 16px` under `@media (max-width: 640px)`, which also stops iOS input zoom).
- Desktop select: `.ctl-select` `min-height: 2.25rem`, 0.85rem text (`src/app.css`).
- Button: `.button` is padding `--space-2` x `--space-4`, accent fill, inverts on hover; variants `.button-secondary`, `.button-danger`, `.button-success`, `.button-ghost`. Icon-only: `.button.button-icon`.
- Icons: one set, Phosphor regular paths in `src/lib/components/Icon.svelte`. No emoji.
- Toggle / segmented switch: `.tab-group` of `button[aria-pressed]`, accent fill when pressed, `aria-disabled` plus a title for an unavailable option (`src/app.css`). Use for 2 to 4 short options; a native `select` for 5+ (`ui-rules.md` rule 32).

## Layout and patterns

- Width: `--container-max` 1416px on `.container` and the nav: 1240px content plus the `/stats` rail (`--rail-w` 10rem + `--rail-gap` 1rem = 176px, `src/routes/stats/+page.svelte`). The rail shows at `min-width: 1000px` and `min-height: 500px`.
- Card: `.card` is surface, 1px border, `--radius`, `--shadow`, `--space-4` padding. Lists use `.grid` (`repeat(auto-fill, minmax(260px, 1fr))`, gap `--space-4`). Example: `src/routes/coffees/+page.svelte`.
- Stat tile: `.stat-item` is a square (`aspect-ratio: 1`) card; compact rows drop the ratio. `.stat-grid` is `auto-fill, minmax(140px, 1fr)` (`src/app.css`).
- Section break: `.section-heading` adds a top border and `--space-6` margin.
- Table: `table.data-table` at 100% width, `--space-2` x `--space-3` cell padding, 1px row borders, hover tint. Wide tables sit in `.table-scroll` (`overflow-x: auto`), never scroll the page. Example: `src/routes/coffees/+page.svelte`, `src/routes/stats/ReportCard.svelte`.
- Breakpoints: phone is `max-width: 640px` (narrow layout, 44px targets); `max-width: 419px` for the narrowest; `max-height: 450px` is phone landscape (one short row, captions hidden but kept as `aria-label`). `src/app.css`.
- Test viewports: 360, 390, 480, 768, 1280 wide, phone portrait 480x909, phone landscape 1003x333 (`tests/ui/viewports.ts`).

## Rules

Summarises the numbered rules in `docs/ui-rules.md`.

- One place per action. Do not offer the same control in two spots.
- One term per concept, used everywhere (for example "Sign in" and "Sign out", never mixed with "Log out").
- Alike things look alike: menu items share icon and button style; icons come from the one set.
- Units attach to the number: `30s`, `18g`, `91°C`, `1:16.7`. An initialism such as masl is not a unit: `1,500 masl`.
- Seamless controls: swapping a control or showing other data on a toggle keeps sizes, positions, plot area and axes fixed. Content pushes things down only when it really changes (added text or lines). A swapped button label keeps the button's dimensions.
- Fill panel space: visible empty space inside a panel that groups tiles or charts is a defect. Add content or change the layout.
- Data-agnostic layouts: rules key off available width and content, never a known dataset or one screen size. Check thin data and large data, and sizes between the breakpoints.
- URL state: every page and view state (tabs, filters, sort, search, layout, pickers) is addressable by URL. A fresh visit and Reset give a bare URL; a default the user explicitly picks may be written. Inline edit state (edit mode, staged edits, inline add form, expanded row) never goes in the URL. Hand-built URL values are case-insensitive. Ship each new page with its params and a test for the param parser.
- Edit forms use the same groups and field order as the page they edit. Change both in the same commit.
- Opening a picker, menu or panel never focuses its text input; focus the list or the opener, so a phone keyboard does not pop up.
- Every UI change gets automated layout checks (no sideways scroll, no wrapping or clipped buttons and chips, 44px targets on phones, aligned rows) at all test viewports before a manual check. Add each new state to `tests/ui`.
- Alignment: `table.data-table` th and td are all `text-align: left` (`src/app.css:908`), numeric columns included; only tooltip value columns (`.tip-rows dd`) right-align, with `tabular-nums` so digits line up (`src/app.css:2923-2924`). Tile captions: the first line and the value stay level across a row, extra lines flow down (`ui-rules.md` rule 44). Sibling controls in one bar share a baseline (`ui-rules.md` rule 32).
