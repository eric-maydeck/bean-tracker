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
