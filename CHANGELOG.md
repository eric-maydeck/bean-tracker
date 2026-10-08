# [1.57.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.56.0...v1.57.0) (2026-10-08)


### Features

* **coffees:** images for archived backfill leftovers, batch 2026_10_archive_b

# [1.56.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.55.0...v1.56.0) (2026-10-08)


### Features

* **coffees:** backfill product pages and images, batch 2026_10_archive_a

# [1.55.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.54.0...v1.55.0) (2026-10-08)


### Bug Fixes

* **coffees:** guard backfill fixes by roaster too


### Features

* **coffees:** backfill product pages and images, batch 2026_10_a

# [1.54.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.53.0...v1.54.0) (2026-10-07)


### Features

* **coffees:** apply guarded product page and image fixes as one batch
* **db:** apply product page backfill batches at boot
* **scripts:** find product pages and images for coffees without one, resumable
* **scripts:** review page and batch export for the product page backfill

# [1.53.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.52.1...v1.53.0) (2026-10-07)


### Bug Fixes

* **coffees:** line up compact inline-edit icons with the form's buttons


### Features

* **coffees:** keep several inline edit forms open at once

## [1.52.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.52.0...v1.52.1) (2026-10-07)


### Bug Fixes

* **auth:** sign in returns you to the page you were on

# [1.52.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.51.0...v1.52.0) (2026-10-07)


### Bug Fixes

* **coffee-form:** image url input lines up with its row
* **coffees:** a pending card keeps its action icons when another card opens
* **coffees:** inline edit action row wraps inside a narrow card
* **image-suggest:** a pick never replaces a site staged by change
* **image-suggest:** closest computed on the final list, restore per-provider page dedupe
* **image-suggest:** closing the dialog mid-search returns focus to suggest
* **image-suggest:** longer excerpt from the tasting notes, no smushed words
* **share:** share button lines up with inline-block neighbors
* **share:** top-align instead of a label baseline


### Features

* **image-suggest:** admin-only image-suggest endpoint
* **image-suggest:** large image cards in the suggest dialog
* **image-suggest:** later providers only fill, name match ranks first
* **image-suggest:** provider comparison script
* **image-suggest:** rank a page's images by bag-art hints
* **image-suggest:** read every image from a product page
* **image-suggest:** release date, excerpt and closest-to-roast ranking
* **image-suggest:** roaster_websites table with boot backfill
* **image-suggest:** run providers in order and rank the pages' images
* **image-suggest:** save a staged roaster_website with the coffee
* **image-suggest:** shopify store search provider
* **image-suggest:** show suggestions in a dialog with dates and notes
* **image-suggest:** suggest button and pick list in the coffee form
* **image-suggest:** tavily provider with a 31-day call budget

# [1.51.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.50.0...v1.51.0) (2026-10-06)


### Features

* **coffees:** show a centered notice while Refresh reloads

# [1.50.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.49.1...v1.50.0) (2026-10-06)


### Features

* **coffees:** frozen badge and plum decaf badge

## [1.49.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.49.0...v1.49.1) (2026-10-06)


### Bug Fixes

* **images:** don't read a cropped wordmark as a solid background
* **images:** recompute cached backdrop fills once

# [1.49.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.48.0...v1.49.0) (2026-10-06)


### Bug Fixes

* **roasters:** correct dongze logo url


### Features

* **images:** background run stores local copies
* **images:** serve local copies from /img
* **images:** show local copies when available
* **images:** store content-addressed local copies
* **roasters:** seed macs roasters and dongze logos

# [1.48.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.47.0...v1.48.0) (2026-10-06)


### Features

* **roasters:** seed default images for existing roasters

# [1.47.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.2...v1.47.0) (2026-10-06)


### Bug Fixes

* **beanconqueror:** treat a 0 rating as unrated


### Features

* **stats:** brews and grams per day with period averages

## [1.46.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.1...v1.46.2) (2026-10-06)


### Bug Fixes

* **coffees:** keep the current status tab on Reset

## [1.46.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.0...v1.46.1) (2026-10-06)


# [1.46.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.45.0...v1.46.0) (2026-10-06)


### Bug Fixes

* **coffee-form:** phone button rows share each line; phone portrait+landscape in test:ui
* **coffees:** inline-edit action row stays on one line in Cards and List like Compact
* **coffees:** keep List inline-edit action row in the viewport, match Compact spacing
* **coffees:** keep List inline-edit actions inside the table scroller
* **coffees:** save and cancel under the inline edit form in cards and list views
* **roaster-image:** clearing the image by typing drops the roaster-default mark


### Features

* **image-fill:** contained images on their fill at every render site and in form previews
* **image-fill:** image_fills cache, image_fill on list rows, coffeeImage returns the fill
* **image-fill:** image-fill endpoint and background fill worker at boot and after saves
* **image-fill:** sharp, warm-palette backdrops and the border fill algorithm
* **roaster-image:** roaster_image_url on list and coffee page rows
* **roaster-image:** roaster_images table and roasterImages.ts
* **roaster-image:** save set_roaster_default with the coffee, before the dedupe
* **roaster-image:** set as roaster default button and roaster default preview
* **roaster-image:** show the roaster default when a coffee has no image
* **roaster-image:** store null when a coffee image equals its roaster default

# [1.45.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.44.0...v1.45.0) (2026-10-05)


# [1.44.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.43.0...v1.44.0) (2026-10-05)


### Features

* **bc:** second one-time pairs batch with guarded coffee fixes

# [1.43.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.42.0...v1.43.0) (2026-10-05)


### Bug Fixes

* **stats:** bag n on its own line in the link picker, wrap bean card names
* **stats:** roasted prefix in the link picker, added date on the twin line
* **stats:** title-case status and added in the link picker meta line
* **ui:** drop the extra line break under eyebrow labels
* **ui:** wrap long names in expanded compact rows, title-case the likely-match line


### Features

* **stats:** custom link picker with search and grouped two-line options

# [1.42.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.41.0...v1.42.0) (2026-10-05)


### Bug Fixes

* **coffees:** keep the list's rest window column at its old width


### Features

* **coffees:** show grams left for open coffees with a linked bean

# [1.41.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.40.0...v1.41.0) (2026-10-05)


### Features

* **beanconqueror:** apply the reconciled bean-to-coffee pairs once at boot

# [1.40.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.2...v1.40.0) (2026-10-05)


### Bug Fixes

* **coffee:** show unlink error only for a failed unlink
* **db:** add link column, index and backfill in one transaction
* **import:** don't auto-link a new bean when an unlinked twin exists
* **link-picker:** keep alphabetical order outside top match
* **link-picker:** list all twin bags under top match
* **link-picker:** unique disambiguated labels across all options
* **ui-seed:** compare resolved paths so .. can't escape .ui-test
* **ui:** keep coffee page action labels on one line, wrap the row instead
* **ui:** keep create button at its natural width in the untracked beans table
* **ui:** keep quick filter switch labels on one line on phones
* **ui:** make filter chip remove button a 44px tap target on phones
* **ui:** raise form selects to a 44px tap target on phones


### Features

* **beanconqueror:** link picker on stats and unlink on the coffee page
* **beanconqueror:** link, unlink and create-and-link actions
* **beanconqueror:** store bean-to-coffee links and auto-link on import
* **coffees:** in bean conqueror quick filter
* **link-picker:** show roaster first in option labels
* **stats:** general and bean conqueror tabs
* **ui:** top match group in link picker, BQ chip label, ui rules 14-15

## [1.39.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.1...v1.39.2) (2026-10-04)


### Bug Fixes

* **import:** reject workbooks that aren't bean conqueror exports

## [1.39.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.0...v1.39.1) (2026-10-04)


### Bug Fixes

* **share:** open bean conqueror in a new tab, send roast type filter

# [1.39.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.38.0...v1.39.0) (2026-09-28)


### Bug Fixes

* **coffees:** one row of larger compact edit icons, pending badge below


# [1.38.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.37.0...v1.38.0) (2026-09-28)


### Bug Fixes

* **share:** gate stats URL sync on load, normalise stored short-link paths


### Features

* **coffees:** move the list to /coffees; / redirects
* **coffees:** url codec and 12h persistence for coffee view state
* **coffees:** view state in the URL, 12h memory, Share button
* **share:** public short links with TTL and row cap
* **url-state:** remembered-choice and whitelisted param helpers
* **url-state:** shareable stats, on-deck and subscriptions views

# [1.37.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.36.0...v1.37.0) (2026-09-26)


### Features

* **coffees:** show date added and last updated on the coffee page

# [1.36.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.35.0...v1.36.0) (2026-09-26)


### Features

* **nav:** use Phosphor icons for navigation; rename "Log out" to "Sign out"

# [1.35.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.34.1...v1.35.0) (2026-09-26)


### Features

* **coffees:** compact row links to its page; back re-expands it

## [1.34.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.34.0...v1.34.1) (2026-09-26)


### Bug Fixes

* **coffees:** row Edit opens only that coffee, with its own save

# [1.34.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.33.1...v1.34.0) (2026-09-26)


### Bug Fixes

* **db,form:** enforce foreign_keys pragma and disambiguate slug button labels
* **detail:** equal-size action buttons, spacing, and drop duplicate Clone
* **detail:** hide the redundant update button on the coffee page
* **fill:** block NAT64 local-use and Teredo IPv6 ranges
* **fill:** drop zero-price Shopify variants and guard malformed meta.json
* **fill:** match roast levels regardless of hyphen/space/case
* **fill:** prefer the page's own weight over shopify's grams (shipping weight)
* **fill:** resolve relative and protocol-relative image URLs
* **fill:** restore the timeout-specific 504 branch in fill-from-url
* **fill:** reword rest-day suggestion note to the requested phrasing
* **fill:** strip a trailing roaster/site-name suffix from coffee_name
* **fill:** tighten IPv6 blocklist and destroy decompression stream on 2MB cap
* **fill:** use shopify's own variant grams when the label has no weight
* **form:** align the decaf checkbox with the neighbouring inputs
* **form:** clear a stale rest suggestion when a fill sets roast level alone
* **form:** don't let save-changes' apply-open-form step fight a staged delete
* **form:** equal columns, image url beside the rest fields, decaf under frozen end
* **form:** image row layout, code-style URL, locked slug, rest note, save changes
* **form:** keep other columns fixed when the image preview grows
* **form:** keep the decaf checkbox pinned to the top of its grid row
* **form:** move decaf under frozen end date and the url slug under decaf
* **form:** put the rest fields under roast date on phones
* **form:** put the url slug under the image block on desktop
* **form:** reorder mobile rest/decaf and stack fill-anyway yes/no below text
* **form:** shorten rest-day labels so they fit on one line
* **form:** show the rest suggestion directly below the rest fields
* **form:** stack decaf, rest days, and frozen dates under their related fields
* **types:** clear svelte-check errors introduced by product_url


### Features

* **coffees:** add product_url field, saved on every path and linked from the detail page
* **coffees:** lock the slug field by default with an edit/cancel toggle
* **coffees:** regenerate the slug on identity edits and redirect old slugs
* **fill:** add a guarded server-side fetch for product pages
* **fill:** add admin endpoint that fills coffee fields from a product URL
* **fill:** convert non-USD prices with cached daily rates from open.er-api.com
* **fill:** extract coffee name, origin, processing and bag size from product data
* **fill:** fill from page button, status note, size chips and discard image in the coffee form
* **fill:** image preview and revert the product URL after a failed fill
* **fill:** match roaster, roast level and bag size against the user's history
* **fill:** parse Shopify JSON and product HTML into one shape, with captured fixtures
* **fill:** suggest rest days from history or roast-level defaults

## [1.33.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.33.0...v1.33.1) (2026-09-25)


### Bug Fixes

* **auth:** decay the login rate-limiter's failure count over time
* **beanconqueror:** validate blend component column headers on import
* **stats:** apply the unmatched-beans limit and count in SQL, not client-side
* **stats:** clarify the beanConqueror rated-group empty-state copy

# [1.33.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.32.1...v1.33.0) (2026-09-25)


### Bug Fixes

* **coffees:** more space between search and toolbar buttons on phones
* **coffees:** put Refresh before Reset; full-width search on phones
* **filters:** even column grid and wider desktop filter menu
* **filters:** match quick-filter segment spacing to the column buttons
* **filters:** same even column grid for the filter menu on phones


### Features

* **filters:** turn Decaf/Frozen into quick-filter switches

## [1.32.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.32.0...v1.32.1) (2026-09-25)


### Bug Fixes

* **filters:** add aria-modal and a focus trap to the filter editor
* **filters:** lock page scroll behind the mobile filter bottom sheet
* **filters:** re-stamp lastUsed when leaving the Coffees page

# [1.32.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.31.0...v1.32.0) (2026-09-25)


### Bug Fixes

* **filters:** drop saved filters whose mode does not fit their column
* **filters:** format chip values instead of showing the raw typed text
* **filters:** give filter-value rows a 44px tap target on mobile
* **filters:** keep chip filter editor within the viewport
* **filters:** keep the chip's visible text as its accessible name
* **filters:** label Weight column as "Weight (g)" in the filter editor
* **filters:** manage focus on filter editor open/close
* **filters:** return focus to "+ Filter" when Clear ends that flow


### Features

* **filters:** add coffee filter model and applyFilters
* **filters:** add FilterBar and FilterEditor components
* **filters:** add value counts, apply gating, and chip text
* **filters:** back to collection restores list position via history
* **filters:** persist filters and search with version and 12h expiry
* **filters:** replace Decaf/Frozen rows with filter chips on Coffees page

# [1.31.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.30.0...v1.31.0) (2026-09-24)


### Bug Fixes

* **login:** drop Secure session cookie flag on the local dev server


### Features

* **coffees:** clone a coffee; add/edit/clone always available when logged in

# [1.30.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.29.0...v1.30.0) (2026-09-24)


### Features

* **stats:** uniform tile grid, container-scaled tiles, 8-tile At a Glance

# [1.29.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.2...v1.29.0) (2026-09-23)


### Features

* **stats:** filter Top Coffees by Category by status
* **stats:** keep Top Coffees axis fixed across status toggles

## [1.28.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.1...v1.28.2) (2026-09-23)


### Bug Fixes

* harden release pipeline against the workflow_run stale-ref race

## [1.28.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.0...v1.28.1) (2026-09-23)


### Bug Fixes

* vertically align the QR hint text with the button next to it

# [1.28.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.5...v1.28.0) (2026-09-23)


### Bug Fixes

* roast_range floor + redesign the Bean Conqueror share panel


### Features

* highlight the exact roast level and cost after a Bean Conqueror import

## [1.27.5](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.4...v1.27.5) (2026-09-23)


### Bug Fixes

* stack By Method/By Grinder charts on mobile, not just donuts

## [1.27.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.3...v1.27.4) (2026-09-23)

Manual patch release.

## [1.27.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.2...v1.27.3) (2026-09-23)


### Bug Fixes

* left-align top tile groups and widen Bean Conqueror panel to full width

## [1.27.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.1...v1.27.2) (2026-09-23)


### Bug Fixes

* revert possible-match line-break/parens change on mobile, keep desktop

## [1.27.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.0...v1.27.1) (2026-09-23)


### Bug Fixes

* move possible-match roast date/status to its own line, drop parens

# [1.27.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.4...v1.27.0) (2026-09-23)


### Features

* flag likely BeanConqueror duplicate matches for human confirmation

## [1.26.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.3...v1.26.4) (2026-09-23)


### Bug Fixes

* chart-panel line chart colliding with tiles above it

## [1.26.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.2...v1.26.3) (2026-09-23)


### Bug Fixes

* disable mobile browser auto text-size-adjust (real page-wide overflow)

## [1.26.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.1...v1.26.2) (2026-09-23)


### Bug Fixes

* mobile stats — font proportion, overflow, and button sizing bugs

## [1.26.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.0...v1.26.1) (2026-09-23)


### Bug Fixes

* mobile stats tile/font proportion and donut cascade bug

# [1.26.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.2...v1.26.0) (2026-09-23)

Bean Conqueror import fixes (413 error, ratings chart aggregation) and a /stats mobile layout redesign. Semantic-release couldn't auto-cut this one due to a workflow_run race condition against a docs-only follow-up commit.

## [1.25.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.1...v1.25.2) (2026-09-23)


### Bug Fixes

* aggregate Bean Conqueror ratings-over-time chart by week

## [1.25.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.0...v1.25.1) (2026-09-23)


### Bug Fixes

* raise BODY_SIZE_LIMIT so Bean Conqueror imports don't 413

# [1.25.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.2...v1.25.0) (2026-09-23)


### Features

* add admin-gated mark-read/dismiss routes for alerts
* add admin-only alerts bell and panel to the nav
* add alerts data layer for operational failure notifications

## [1.24.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.1...v1.24.2) (2026-09-22)


### Bug Fixes

* center stats tile subtext symmetrically between value and label

## [1.24.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.0...v1.24.1) (2026-09-22)


### Bug Fixes

* harden stats rates handling and close two staged-edit gaps

# [1.24.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.23.0...v1.24.0) (2026-09-22)


### Features

* redesign stats page tiles with static sizing and overflow-safe formatting

# [1.23.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.22.1...v1.23.0) (2026-09-22)


### Features

* add per-page titles and a coffee-cup favicon

## [1.22.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.22.0...v1.22.1) (2026-09-22)


### Bug Fixes

* correct remaining wire-type mismatches in beanconquerorBean.proto

# [1.22.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.21.0...v1.22.0) (2026-09-22)


### Bug Fixes

* exclude unrated-only groups from Bean Conqueror RatedGroup breakdowns
* match Bean Conqueror's shipped proto wire types for weight/cost
* parse slash-formatted date/timestamp strings from Bean Conqueror xlsx exports
* rename Bean Conqueror share button to "Import into Bean Conqueror"
* require a minimum brew count for rated Bean Conqueror groups
* use expression-based unique index for beanconqueror_brews identity instead of trigger
* validate export headers and tidy the candidate list


### Features

* add Bean Conqueror candidate list, Dismiss, and create-coffee modal
* add Bean Conqueror data model and shared Excel parsing helpers
* add Bean Conqueror stats and breakdowns tabs
* add Bean Conqueror xlsx import action and upload UI
* add Bean Conqueror xlsx parsing and diff/upsert import
* add Send to Bean Conqueror QR/link share button


### Performance Improvements

* load protobufjs and qrcode only when sharing a coffee

# [1.21.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.2...v1.21.0) (2026-09-22)


### Features

* add visible-list totals and decaf/frozen filters to the Coffees page

## [1.20.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.1...v1.20.2) (2026-09-22)


### Bug Fixes

* eliminate NaN day counts, equalize panel/tile heights, polish layout

## [1.20.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.0...v1.20.1) (2026-09-22)


### Bug Fixes

* stabilize composition chart width, add donut percentages, rename headings

# [1.20.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.19.0...v1.20.0) (2026-09-22)


### Features

* expand stats page timing/rate detail and improve chart readability

# [1.19.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.18.0...v1.19.0) (2026-09-22)


### Features

* group stats page sections into labeled panels

# [1.18.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.17.0...v1.18.0) (2026-09-22)


### Bug Fixes

* left-align sparse stat rows, center each tile's own content


### Features

* add finished-coffee stats, second donut, and composition chart fixes

# [1.17.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.16.0...v1.17.0) (2026-09-22)


### Bug Fixes

* disambiguate stat labels, pin locale, and guard the donut against an empty backlog
* keep the stats rate-edit form open so save errors are visible


### Features

* add /stats route load, rate-update action, and nav link
* add Chart.js and a theme-aware reusable chart component
* add editable stats consumption-rate settings to app_meta
* add pure backlog-stats computation module
* build the backlog stats page UI

# [1.16.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.15.0...v1.16.0) (2026-09-21)


### Features

* add a 'Stay signed in' checkbox for 30-day remembered sessions
* show 10 coffees on the On Deck next-up list instead of 5

# [1.15.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.14.1...v1.15.0) (2026-09-21)


### Bug Fixes

* correctly display staged Decaf checkbox edits on reopen
* harden batch actions with a default case and request-body validation
* harden saveChanges error handling and guard Discard during save
* staged-edit un-stage affordance, stale form data, and save-flow error handling


### Features

* add atomic batch validate/commit actions for coffees
* add atomic batch validate/commit actions for subscriptions
* add batch validate/commit API routes for coffees and subscriptions
* add shared pending-changes module for staged edit sessions
* add staged-mode support to CoffeeForm and a button-success style
* convert coffee detail page to a staged Save changes / Discard changes session
* convert Coffees page to a staged Save changes / Discard changes session
* convert Subscriptions page to a staged Save changes / Discard changes session

## [1.14.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.14.0...v1.14.1) (2026-09-20)


### Bug Fixes

* extend the decaf backfill to also check processing, not just name
* move status/decaf badges inline next to the coffee name

# [1.14.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.13.0...v1.14.0) (2026-09-20)


# [1.13.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.12.1...v1.13.0) (2026-09-19)

**New:** Manual release workflow — trigger a patch/minor/major release on demand from GitHub Actions instead of relying solely on commit-message conventions.

**Polish:** Roast-level bean icons on the Coffees page now render brown (light mode) / tan (dark mode) to match the coffee theme, instead of plain black/white.

## [1.12.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.12.0...v1.12.1) (2026-09-19)


### Bug Fixes

* address 6 deferred mobile-responsive polish items

# [1.12.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.11.0...v1.12.0) (2026-09-19)


### Bug Fixes

* address final-review findings on mobile-responsive plan
* bump mobile input font-size and touch targets to avoid iOS zoom and cramped taps
* coffees table view scrolls horizontally instead of squeezing columns under 640px
* subscriptions table view scrolls horizontally instead of squeezing columns under 640px


### Features

* add bottom tab bar navigation for mobile
* add defaultViewForWidth helper for mobile view defaulting
* add read-only Compact view to the Coffees page
* add read-only Compact view to the Subscriptions page
* wire admin editing into the Coffees Compact view
* wire admin editing into the Subscriptions Compact view

# [1.11.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.10.0...v1.11.0) (2026-09-19)


### Features

* sortable Processing/Frozen/Unfrozen/Decaf columns, drop Status column

# [1.10.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.4...v1.10.0) (2026-09-19)


### Features

* subscription totals/renewal date, decaf tracking, minor polish

## [1.9.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.3...v1.9.4) (2026-09-19)


### Bug Fixes

* coffees list-view table layout issues

## [1.9.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.2...v1.9.3) (2026-09-19)


### Bug Fixes

* two Subscriptions bugs — case-sensitive sort, and Save blanking fields

## [1.9.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.1...v1.9.2) (2026-09-19)


### Bug Fixes

* default Coffees list to Urgency descending, persist sort choice

## [1.9.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.0...v1.9.1) (2026-09-19)


### Bug Fixes

* session cookie was silently marked Secure over plain HTTP

# [1.9.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.8.0...v1.9.0) (2026-09-19)


### Bug Fixes

* give the list-view Actions column real width in the colgroup
* re-check admin status before rendering edit affordances


### Features

* add a Refresh button to On Deck
* add app-owned admin authentication and login page
* add password hashing and session cookie signing
* inline coffee editing on the Coffees page
* inline editing on the coffee detail page
* move coffee write actions onto the Coffees page
* move Subscriptions to a top-level route with inline editing
* show the running app version in the footer
* support inline create/cancel in CoffeeForm

# [1.8.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.7.0...v1.8.0) (2026-09-18)


### Features

* add coffee delete, On Deck detail, and add-coffee autocomplete

# [1.7.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.6.0...v1.7.0) (2026-09-18)


### Features

* track last-deployed alongside last-updated, both durable in the db

# [1.6.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.5.0...v1.6.0) (2026-09-18)


### Features

* add an Unopen action to undo Open on the Manage page
* add Manage tabs for coffees and subscriptions
* split Origin/Roast into separate sortable, searchable columns

# [1.5.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.4.0...v1.5.0) (2026-09-18)


### Bug Fixes

* import the real Moved date for archived coffees from the spreadsheet
* urgency gradient clamps at zero and Manage buttons stay aligned


### Features

* move subscription creation to a dedicated Manage page

# [1.4.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.3.1...v1.4.0) (2026-09-18)


### Bug Fixes

* store frozen dates as date-only and guard status transitions
* use explicit .ts extension importing slug module


### Features

* add coffee status lifecycle migration and URL slug generation
* add slug generation utility for coffee URL identifiers
* add the On Deck page
* home-page polish — reset button, stable columns, thumbnails, urgency gradient
* make the coffee URL slug editable from the edit form
* point nav at On Deck/Manage and migrate script at the new status values
* reduce Manage to an uncapped action list for the new lifecycle
* rework coffees data layer for the backlog/open/archive lifecycle
* show frozen/opened/archived dates on the Archive page
* switch the coffee detail page to slug-based URLs
* update the home page for the three-state coffee lifecycle

## [1.3.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.3.0...v1.3.1) (2026-09-18)


### Bug Fixes

* redirect to the new coffee after adding it, not the dashboard

# [1.3.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.2.0...v1.3.0) (2026-09-18)


### Features

* coffee images, redesigned detail page, sortable list, footer

# [1.2.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.1.0...v1.2.0) (2026-09-18)


### Features

* design refresh — typography, dark mode toggle, responsive tables

# [1.1.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.2...v1.1.0) (2026-09-17)


### Features

* make the backlog the home page, add site nav and view toggle

## [1.0.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.1...v1.0.2) (2026-09-17)


### Bug Fixes

* embed the DB schema as a TS string instead of a sibling .sql file

## [1.0.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.0...v1.0.1) (2026-09-17)


### Bug Fixes

* skip lifecycle scripts in the docker runtime stage

# 1.0.0 (2026-09-17)


### Bug Fixes

* address final review findings in the CI/CD pipeline


### Features

* add Dockerfile for containerized deployment
* add semantic-release configuration and release workflow
* add workflow to build and publish the Docker image on release
