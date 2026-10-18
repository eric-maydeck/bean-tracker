## [1.79.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.79.0...v1.79.1) (2026-10-18)


### Bug Fixes

* **data:** shoebox rest windows to 45 days (caf) and 30-60 (decaf)

# [1.79.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.78.0...v1.79.0) (2026-10-18)


### Features

* show coffee names containing skip in purple everywhere
* **theme:** add skip color token; decaf badge turns rose

# [1.78.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.77.0...v1.78.0) (2026-10-18)


### Bug Fixes

* **charts:** a chart tip another tip dismisses unmounts instead of staying hidden
* **coffees:** like panel matches Leaderboards on decaf, no blank grid track, shared signed
* **coffees:** the no-comparison tip counts dial-in brews only among calibrated ones
* every price, spend and cost shows dollars to 2 decimals through one formatter
* **insights:** a board value is tipped only when the tip adds to the row
* **insights:** a left-pointing small bar's corner fold sits top right
* **insights:** a like line is a tab stop and opens on Enter only when cut
* **insights:** a repurchase stays out of its twin's like group
* **insights:** badges explain the gap against its margin of error
* **insights:** bag means and gaps between them show one decimal
* **insights:** bag-mean findings use the page's 4-brew bag rule
* **insights:** brews until dialed reads each bag's first 7 brews, closes [1-#7](https://github.com/1-/issues/7)
* **insights:** dial-in by group always lists; with no measurable z it has no bar
* **insights:** dial-in by group progress is (z / bar)²; no card when z can't be measured
* **insights:** empty leaderboard panels fit their note
* **insights:** empty panels are one short line
* **insights:** equal row gaps in the phone control bar
* **insights:** every bag counts in pooled means, weighted by its brews
* **insights:** every too early card has its progress bar, dial-in by group too
* **insights:** filters field sits level with the bar's controls
* **insights:** final-review minors
* **insights:** finding deltas show 2 decimals only when their margin is under 0.05
* **insights:** finding links keep the page's Period, ratings, caffeine and Coffees filter
* **insights:** findings use the t test at every n, with no step at 30
* **insights:** group 10-brew rule counts dial-in brews; tips follow the mode
* **insights:** group findings compare a group with the rest, not a pool holding it
* **insights:** habits rating charts say they are raw means
* **insights:** lab badges never back a gap the bar contradicts, and tier 2 counts bags once
* **insights:** lab badges use the page's t test with the bag as the unit
* **insights:** lab charts pick their decimals per chart, not per row
* **insights:** lab deltas and means show 1 decimal unless the bag-level se is under 0.05
* **insights:** leaning and its setting read as one phrase in one size
* **insights:** like line tip uses the shared float tip, opens on hover, tap and focus
* **insights:** like rank help, See-all rows, and only boards that can rank
* **insights:** likeRoaster small-sample rule, twin tags, phone bar labels, tighter milestones check
* **insights:** money mini charts read their values as usd for screen readers
* **insights:** more dollar amounts get the Usd tip; ± note says what an SE is
* **insights:** myths show their margin of error and claim no effect only inside it
* **insights:** name the confident cutoff on boards it emptied
* **insights:** no clear winner cards name the best-so-far setting
* **insights:** no clear winner sweet spots lines take the accent ink; contrast notes corrected
* **insights:** notes finding says the cause likely runs the other way
* **insights:** once dialed skips dial-in brews by position only
* **insights:** once dialed skips the first brew of a 4–7 bag, two of an 8+ bag, closes [#2](https://github.com/eric-maydeck/bean-tracker/issues/2) [#3](https://github.com/eric-maydeck/bean-tracker/issues/3)
* **insights:** one empty panel when a filtered tab has nothing
* **insights:** only rows with a like line grow; ink check, tidy lookups
* **insights:** overview tiles fit 2-decimal costs
* **insights:** pooled means count only bags with 4+ rated brews
* **insights:** rank like leaves out low-confidence rows
* **insights:** readable reason list when one reason holds an or
* **insights:** rescued bags compare the first two brews with the rest
* **insights:** rescued bags say how many chance alone would rescue
* **insights:** roast nudge on a z of 2 and a gap of half a point
* **insights:** roaster like gaps vs other roasters, rescue and dial-in rules, bar labels, seed
* **insights:** rows show their scored brews; chip and tips give both counts
* **insights:** see all counts every bag under raw and the peak scores
* **insights:** see all under rank like counts every bag in the roaster figure
* **insights:** see-all note blames each setting that hid rows; review minors
* **insights:** setting names are bold brown in tips and chart notes too; dial window from data
* **insights:** setting names in prose are bold brown; their default notes are green
* **insights:** settle bars get a tip with counts, small-sample caveat last
* **insights:** settle brews measured within each bag's first 6 brews
* **insights:** show-all footer only where a band row needs it
* **insights:** small-sample findings use a t test
* **insights:** sweet spots best so far reads as the answer alone, its numbers in a tip
* **insights:** sweet spots lines are short with numbers in a tip; results in the accent ink
* **insights:** tapping a cut-off like line follows the row link
* **insights:** the cutoff line names a board only when full bags would fill it
* **insights:** the dial-in story quotes ratings within a bag, closes [#1](https://github.com/eric-maydeck/bean-tracker/issues/1)
* **insights:** the hidden-by-settings tip lists one row per board and the reasons once
* **insights:** the hidden-by-settings tip type is plain TypeScript, so tsc stays at baseline
* **insights:** the many-findings line counts every test run, under any theme
* **insights:** the score help's default entry gets its own group header
* **insights:** the settle tip counts the brews it read, and its small-group shape is unit-tested
* **insights:** too early lists 6 leads past 1× their margin of error
* **milestones:** resize the side ruler when the bar or viewport height changes
* **money:** $1,000 and up shows whole dollars; the tip keeps the cents
* **money:** charts and lists keep one format; stats cost chart labels use usd
* **stats:** by method and by grinder say how many of their groups they show
* **stats:** showing top n of m only shows when the chart cuts something
* **ui:** a revealed tip never scrolls its own anchor under the sticky bar
* **ui:** a text tip is inline text, so a wrapped label opens only from its words


### Features

* **coffees:** explain a missing vs like coffees panel, honor ratings and dial params
* **coffees:** vs like coffees panel on the coffee page
* **insights:** a cut like line opens its full text on tap or enter
* **insights:** an odd Too early list pulls in the next lead the cap cut
* **insights:** board-count tooltip and accurate See all reasons
* **insights:** brews until dialed in by roast level and process on brewing
* **insights:** brews until dialed says it shows the first 7 brews; see all tips the rest
* **insights:** coffees button, panel and chips for the page-wide filter
* **insights:** coffees default to a by-brews confidence score; min3 is "Average (3+ bags)"
* **insights:** dialinBy findings always show, too early ones outside the cap
* **insights:** findings for like-coffee standouts, dial-in by group, rescues
* **insights:** group rows show their score ± 1 SE; boards within noise say so
* **insights:** like line under every leaderboard rank but like
* **insights:** like-coffee groups with self-exclusion
* **insights:** nudge to filter by roast when roast levels rate apart
* **insights:** page-wide coffees filter in the load
* **insights:** phone-short Period/Compare words before first paint, ellipsis on long selects
* **insights:** rank coffees and roasters vs like coffees
* **insights:** remember the view for 12 hours; reset clears it
* **insights:** say how many Likely badges a page of findings earns by chance
* **insights:** see all note as one short line, its breakdown in a tip
* **insights:** see all when settings hide results
* **insights:** see-all note gives each board its own reasons
* **insights:** the default Period is All time, on /insights and /stats
* **insights:** vs like coffees line on coffee rows
* **insights:** zero-centred delta bars under rank like
* **money:** a rounded dollar amount shows its 4-decimal value in a tip


### Performance Improvements

* **insights:** skip like lines where boards are only counted, pre-split like groups by roast

# [1.77.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.2...v1.77.0) (2026-10-16)


### Bug Fixes

* **coffees:** list table words no longer break mid-word
* **insights:** a dismissed tip tells its owner
* **insights:** hover ink reaches the sub line note, mineral map uses the muted look
* **insights:** label the overview brews switches
* **insights:** old score links no longer read object prototype names
* **insights:** view menu button reports aria-expanded
* **insights:** view menu label fits narrow phone columns


### Features

* **insights:** brews switch beside every ratings switch
* **insights:** default Score is the raw average, confident
* **insights:** once dialed by default, dial=all keeps every brew
* **insights:** once-dialed tiers and the settle helper in dialed.ts
* **insights:** one small-sample look on charts, heatmaps and legends
* **insights:** one small-sample marker on board rows
* **insights:** one small-sample rule
* **insights:** ratings and brews become one sticky-bar menu, toggles keep the scroll
* **insights:** ratings and brews switches live in the sticky bar
* **insights:** records brews switch in the sticky bar, dial scores read all brews
* **insights:** retire the best-half scores, default Score is the raw average

## [1.76.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.1...v1.76.2) (2026-10-15)


### Bug Fixes

* **insights:** rated tile caption sits in place at 360/390 in firefox

## [1.76.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.0...v1.76.1) (2026-10-15)


### Bug Fixes

* **insights:** milestones ruler spans the first header to the panel's bottom

# [1.76.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.75.0...v1.76.0) (2026-10-15)


### Bug Fixes

* **insights:** tile rows never orphan a tile at fractional widths


### Features

* **insights:** milestones ruler keeps its height and slides off with the feed
* **insights:** side rail of every view on wide screens

# [1.75.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.2...v1.75.0) (2026-10-15)


### Bug Fixes

* **coffees:** clone from a coffee page shows the added popup
* **insights:** days open start at the earlier of opened and first brew


### Features

* **insights:** bar hover and a recent panel on overview (preview variants)
* **insights:** readable bar hover and value column labels on recent
* **insights:** recent brews and finished coffees data for overview

## [1.74.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.1...v1.74.2) (2026-10-14)


### Bug Fixes

* **coffees:** record open/freeze/thaw on the local date, not utc
* **coffees:** show opened/archived dates on the local calendar, not utc's
* **data:** boot-correct coffee 6's thaw date the utc bug wrote a day late
* **test:** seed brew times on the local clock, not utc

## [1.74.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.0...v1.74.1) (2026-10-14)


### Bug Fixes

* **db:** wait up to 5s on a locked database instead of failing
* **test:** reject prototype keys as ui profiles
* **ui:** drop command from metrics run.json to keep it valid json

# [1.74.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.73.0...v1.74.0) (2026-10-13)


### Bug Fixes

* **charts:** canvas chart tips render the shared tip format
* **insights:** a water pair never shows both recipes in one color
* **insights:** a water profile with no minerals entered stays out of mineral charts
* **insights:** brewing chart pairs fill their height; rest axis starts at the data
* **insights:** dark mineral map cells keep 4.5:1 text contrast
* **insights:** delta colors get a visible tint floor, thin data striped
* **insights:** delta tint floor set per theme, at least 10 from gray
* **insights:** empty heat cell tip says no brews
* **insights:** every tip and help popover shares one titled format
* **insights:** final review fixes (series color, ordered trim, pair slug, a11y)
* **insights:** gear matrix fills the shorter board's column
* **insights:** give mineral cards their own anchor ids, clear of the GH section
* **insights:** grind bands never skip a step inside their range
* **insights:** habits heatmap and calendar tips use label value rows
* **insights:** heatmap row labels outside the scrolling plot; opaque mineral names
* **insights:** help popovers hold six short lines at most
* **insights:** lab boards rank solid before thin; faded rest curve needs 3 bags
* **insights:** lab Bonferroni test counts, paired spread, bag-weighted usual mean
* **insights:** lab charts guard empty data, announce line tips, tidy markup
* **insights:** lab picks stay in the url through non-lab tabs
* **insights:** lab wording, top bags help, shared grinder select, brewing empty state
* **insights:** mineral map no match keeps the vs usual column narrow
* **insights:** mineral map tip opens from the name, vs usual is a chip
* **insights:** one color per recipe across the water tab, ten slots
* **insights:** other tip lists members indented under other
* **insights:** other tips show a lone leftover instead of +1 more
* **insights:** pair headers get wider columns and clamp to two lines
* **insights:** phone card grids hold two per row, odd last spans
* **insights:** rest centre uses banded brews; shared lab number formats and section header
* **insights:** sd and green/red help tips put each state on its own line
* **insights:** sd help tip opens on keyboard focus
* **insights:** series colors stay clearly distinct, checked by delta e
* **insights:** seven recipe colors, every two at least 20 apart; drop duplicate dark slots
* **insights:** signed rating deltas read green or red as text
* **insights:** stacked gear columns share the paired-chart height cap
* **insights:** sweet spot chart keys start at the winning band
* **insights:** sweet spot charts work from the keyboard
* **insights:** sweet spot twin tags lead the sub line; charts scale to solid bands
* **insights:** sweet spots grind card spans every setting brewed
* **insights:** thin rows keep their delta's green or red
* **insights:** truncated pair names stay keyboard-focusable
* **insights:** usage tips show name and share, other lists its members
* **insights:** versus side labels tighten with the card
* **insights:** versus sides in the full-text popover and title
* **insights:** water pair recipes never share a color
* **insights:** water pairs flow by column, one-line headers with tip, roaster · name
* **insights:** water pairs flow in balanced columns
* **insights:** water pairs get recipe column headers and bordered blocks
* **insights:** water pairs tag repurchases; shared hint badge and heatmap fill
* **lab:** a focus tip survives the page scrolling under the mouse
* **lab:** brewing headings are h2 siblings, mineral dots tick every shown value
* **lab:** mineral dots are 44px tap targets
* **lab:** never leave out a solid mineral point
* **lab:** one green/red pair for bars and heatmaps, neutral drift, dark-mode faded tones
* **lab:** paired cards share a fitted height, the taller scrolls inside
* **lab:** reachable segments and dots, left-out mineral notes, show all bags per water pair
* **tips:** untitled chart tips keep all rows; close on rebuild, escape, scroll away


### Features

* **insights:** 21-slot recipe palette in three tones; ink-colored pair headline
* **insights:** band/exact url param per brewing chart
* **insights:** brew temperature fact and brewing lab bands
* **insights:** brewing lab tab builder
* **insights:** brewing lab tabs and url params
* **insights:** brewing tab
* **insights:** brewing thin cells faded, rest curve by bag, unpaired bands dropped
* **insights:** gear tab
* **insights:** lab chart pieces: delta bars, line chart, diverging heatmap
* **insights:** load the brewing lab tabs per tab
* **insights:** same-bag deltas, sweet-spot ladder and breakdowns
* **insights:** sweet spot cards chart their evidence
* **insights:** sweet spot evidence bands and distinct top bag names
* **insights:** sweet spots builder and lab picker options
* **insights:** sweet spots tab
* **insights:** two-tone site-wide categorical palette, neutral other gray, a vs b pair headings
* **insights:** water and gear lab tab builders
* **insights:** water tab
* **lab:** board value columns and short spot tips
* **lab:** chart tips in the top layer, never clipped; spaced stacked bars with other contents
* **lab:** drop all-blank heatmap rows/columns, leave out far-above mineral points, pairs url param
* **lab:** fixed absolute delta color scale, stretched bars scale up
* **lab:** fixed brewing layout, rest heatmap, mineral dots, grouped water pairs, gear titles
* **lab:** green/gray/red diverging scale, structured tips, no match label
* **lab:** grind band labels with ranges, no-match grind bands, eras other contents
* **lab:** preview round 1 data shapes (exact modes, bands, sd, heatmaps, pairs)
* **lab:** recipe mineral map rows replace per-mineral points
* **lab:** recipe mineral map, water pair colors, SD help tips
* **lab:** usage over time as 100% stacked bars, smooth trend lines

# [1.73.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.72.0...v1.73.0) (2026-10-12)


### Bug Fixes

* **insights:** calibration full months, shared groupBy and grindValue
* **insights:** clamped tap opens the full text, no $0 spend, B7 test
* **insights:** co-ferment details label reads Process
* **insights:** deck bucketed on the server, shared spend, what-if and caveat fixes
* **insights:** fuller what-if cards, no 0.00 findings or giant settle counts
* **insights:** match spec definitions on prod data
* **insights:** on-hand lists from all brews, bonferroni wildcard, sample sd
* **insights:** return the full grid, drop fillRows and splitRows
* **insights:** runway uses consumption, stricter minimums for generators
* **insights:** weekday side first, weekends over the Sat/Sun bars


### Features

* **insights:** details fill spare row height only
* **insights:** generator registry with dial-in, taste and runway findings
* **insights:** habits, gear, money and myth findings
* **insights:** insights tab bucketing and what-if math
* **insights:** insights tab params and load
* **insights:** insights tab ui
* **insights:** multi-line charts, details lists, too-early meters, wrapping versus cards
* **insights:** notes, brew index, bag rating facts and stats helpers
* **insights:** rule-based findings card sizes
* **insights:** runway lists the oldest bags on hand
* **insights:** supporting detail lists on descriptive and number cards
* **insights:** trend charts, multi-line gear shares and too-early progress
* **insights:** weekday bar chart
* **insights:** weekday bars, 2-item details, dial-in speed details

# [1.72.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.71.0...v1.72.0) (2026-10-12)


### Bug Fixes

* **insights:** brews rated 9+ follow current/all; on this day skips brews with no coffee
* **insights:** feed dates beside titles, milestone wording, records polish
* **insights:** hide the side ruler by screen height only, never on scroll
* **insights:** milestone wording for type firsts and busiest day, round kg
* **insights:** no lone record cards, 2-line names, spec deltas and hole-in-one
* **insights:** period-scope bag price records, format buying month spend
* **insights:** phone strip waits for a tap or sideways drag; end drags on lost capture
* **insights:** records all-time badge, after-midnight night owls, ties once per bag
* **insights:** records round 2 wording, hover tips, badge tip
* **insights:** sum milestone weights in grams, reuse isFinished
* **insights:** tab switch drops the old tab's anchor; tidy page leftovers
* **insights:** taste ties go to the higher-rated roaster, then a–z


### Features

* **insights:** brewer, brewer type, water, ratio and grind on brew facts
* **insights:** caffeine filter, top 20 and clearer records
* **insights:** firsts, bests, gear and anniversary milestones
* **insights:** fixed-size ruler thumb, month anchors, ruler fits the feed, closes [#m-YYYY-MM](https://github.com/eric-maydeck/bean-tracker/issues/m-YYYY-MM)
* **insights:** freshness, money, brew extremes and gentle records
* **insights:** hide the side ruler when too little room is left
* **insights:** linked tile names on every tab, card hover tint
* **insights:** load records and milestones per tab; seed soup and decaf
* **insights:** milestone ladders, count and streak events
* **insights:** milestone totals, timeline navigator, coffee links, kind colours
* **insights:** milestones timeline ruler with current-month marker
* **insights:** records anchors, caption links and tighter tiles
* **insights:** records and milestones tabs
* **insights:** records and milestones tabs, brewer and kinds params
* **insights:** records engine with taste and volume records
* **insights:** ruler sub-ticks, viewport band, scrub and relative jumps
* **insights:** top brews to 50, compare line names its window
* **insights:** top coffees list, show less first, espresso tile names

# [1.71.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.70.0...v1.71.0) (2026-10-11)


### Features

* **coffees:** coffee added popup with open, add coffee on the coffee page
* **coffees:** popup at the top, 5s on touch screens, 2s minimum after a pause

# [1.70.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.69.0...v1.70.0) (2026-10-11)


### Bug Fixes

* **insights:** busiest day compare line is one line, wraps after the colon only if it must
* **insights:** busiest day compare reads this day first, comparison small and muted below


### Features

* **insights:** busiest day compare shows the comparison day's brews and grams
* **insights:** busiest day tile under avg per day, replaces the avg per week hack

# [1.69.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.68.0...v1.69.0) (2026-10-11)


### Bug Fixes

* **insights:** backlog counts bags with no roast date as on hand
* **insights:** busiest weekday sub drops the weekday
* **insights:** calendar scale, legend labels tested, tooltip units
* **insights:** final review fixes, shared css and weekday names, avg per week tile, a11y labels
* **insights:** habits calendar, no-data cells, rating axis, keyboard grids
* **insights:** keep the view, period and compare labels on their original line height
* **insights:** kept sub line stacks under the delta
* **insights:** monotone on-hand line, whole-number count ticks, aligned chart pair
* **insights:** no data means nothing tracked for bounded periods
* **insights:** one group label style, named groups, hover tip flag, filter match label
* **insights:** one group-field label style, shared ctl-select on date inputs, tidy on-deck
* **insights:** pace the weekday compare sums like the hour ones
* **insights:** paced deltas, screen-reader delta text, shorter weekday sub, tested reset
* **insights:** partial buckets show their days, compare average line shows dates
* **insights:** ratio delta wraps at full size, says points, singular day


### Features

* **coffees:** show and view toggle groups get labels
* **insights:** 12-hour clock for hours on insights
* **insights:** brew calendar shows the latest 24 months
* **insights:** busiest weekday tile shows its average
* **insights:** compare bars name the dates they cover
* **insights:** consumption average or total toggle
* **insights:** consumption engine
* **insights:** consumption tab
* **insights:** custom range for the period dropdown
* **insights:** delta lines show direction and the previous value
* **insights:** every toggle group gets a small label
* **insights:** explanation tips also open on mouse hover
* **insights:** habits and consumption tabs, right now panel
* **insights:** habits and consumption url params
* **insights:** habits engine
* **insights:** habits show avg per day or total
* **insights:** habits tab
* **insights:** legends named for the period and compare labels
* **insights:** ratio tiles show the previous count with their percent
* **insights:** remaining grams on hand, right-now snapshot, back-filled flag
* **insights:** reset button clears every choice
* **insights:** score info shows a hover tip, stale hover flag fixed
* **insights:** tab choices stay when switching tabs
* **on-deck:** currently open and next up split into two views

# [1.68.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.67.0...v1.68.0) (2026-10-11)


### Features

* **insights:** spend and grams in the $/g leaderboard rows

# [1.67.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.66.0...v1.67.0) (2026-10-11)


### Bug Fixes

* **insights:** 44px tap target for leaderboard row links
* **insights:** map svg role group, align dark tokens
* **insights:** stretch leaderboard row link over the whole row


### Features

* **insights:** average switch for rating boards (raw, light, strong)
* **insights:** best adjusted (light) is the default score
* **insights:** dialed in scores and a how scores work dialog
* **insights:** grinder and bag name, slug, processing in facts
* **insights:** leaderboard cards with rank by, movement and show all
* **insights:** leaderboard ranking with movement vs compare
* **insights:** natural earth world map shapes and origin iso lookup
* **insights:** origin world map with themed tooltip
* **insights:** overview and leaderboards tabs
* **insights:** rank by dropdown, seven score modes, stronger value bars
* **insights:** score dropdown with a best brew mode
* **insights:** tab, rank and open url params

# [1.66.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.65.0...v1.66.0) (2026-10-11)


### Bug Fixes

* stats empty states use grams on hand; reset people choice at household of one


### Features

* add insights to the nav (top nav; More on phones)
* household size and measured time to clear on stats
* household size editor in the sticky stats bar
* household size setting and people url param
* measured consumption panel on insights
* per person on insights
* per person on stats
* sticky filter bars on insights and stats

# [1.65.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.64.0...v1.65.0) (2026-10-11)


### Bug Fixes

* insights compare tiles grow on phones instead of shrinking text
* insights dates button row and open-dialog layout state
* insights same-length compares pace only when partly tracked
* insights tiles keep captions inside; 2 columns on narrow phones


### Features

* insights compare against longer windows and custom ranges
* insights compare windows and tracked-day count
* insights custom range dialog, pace line and trend colours
* insights pace line and custom range form
* insights tile grid without empty cells; Settled → Current
* pace insights totals across window lengths

# [1.64.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.63.0...v1.64.0) (2026-10-10)


### Features

* settled/all switch on every rating tile, with tooltips

# [1.63.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.62.1...v1.63.0) (2026-10-10)


### Bug Fixes

* insights brews per day from first brew and delta polish
* insights skip negative rest and years without brews
* normalize the two stray roast level labels


### Features

* group processing labels for insights
* insights brew fact derivations
* insights compare depth, metric kinds and averages
* insights mountain time and period bounds
* insights overview design
* insights overview tiles and deltas
* insights page with overview tiles
* insights rating switches and adjusted means
* insights url state parser
* load per-brew and per-bag insights facts

## [1.62.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.62.0...v1.62.1) (2026-10-10)


### Bug Fixes

* null bean conqueror brew links to missing beans, methods, mills

# [1.62.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.61.1...v1.62.0) (2026-10-10)


### Bug Fixes

* skip bean conqueror brews with a blank uuid


### Features

* derive water gh and kh from minerals
* import the bean conqueror zip export from stats
* parse the bean conqueror json export
* read the bean conqueror export zip, including the full export
* store bean conqueror waters and identify brews by uuid

## [1.61.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.61.0...v1.61.1) (2026-10-10)


### Bug Fixes

* **beanconqueror:** share sets blend from the coffee name

# [1.61.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.60.0...v1.61.0) (2026-10-09)


### Bug Fixes

* **fill:** use the variants' own price currency over the shop's base currency


### Features

* **subscriptions:** boot migration sets the six live subscriptions' page urls
* **subscriptions:** fill from page on the add form and in edit mode
* **subscriptions:** parse subscription pages into subscription fields

# [1.60.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.59.0...v1.60.0) (2026-10-08)


### Features

* **coffees:** card image links to the coffee page when signed in

# [1.59.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.58.1...v1.59.0) (2026-10-08)


### Features

* **ui:** button tiers with tonal fills and invert-on-hover
* **ui:** top nav links grow an underline on hover

## [1.58.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.58.0...v1.58.1) (2026-10-08)


### Bug Fixes

* **coffee-page:** even button spacing; Back left, Share right on desktop
* **images:** show the Shoebox roaster default on its labels' green, closes [#9ae197](https://github.com/eric-maydeck/bean-tracker/issues/9ae197)

# [1.58.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.57.1...v1.58.0) (2026-10-08)


### Features

* **subscriptions:** pause/resume and a subscription page link

## [1.57.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.57.0...v1.57.1) (2026-10-08)


### Bug Fixes

* **coffees:** correct three archived coffees' name, origin and process

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
