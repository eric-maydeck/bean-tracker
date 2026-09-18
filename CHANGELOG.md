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
