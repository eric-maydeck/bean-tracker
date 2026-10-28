# Insights stat catalog

Date: 2026-10-09. Roadmap: `docs/superpowers/specs/2026-10-09-insights-foundation-design.md`
(sub-projects 0–7). Import: `docs/superpowers/specs/2026-10-09-beanconqueror-json-import-design.md`.

The pool of stat ideas for `/insights`. When brainstorming a sub-project (2
breakdowns, 3 highlights, 4 brewing lab + buying + subscriptions, 5 year in
review, 6 pour analytics, 7 custom views), pick from its section here instead
of starting from zero. It's a menu, not a commitment.

Sources (mined 2026-10-09, read-only):

- **DB**: prod SQLite (`coffees`, `subscriptions`, `beanconqueror_*`), 265 bags,
  1344 joined brews.
- **BQ**: Bean Conqueror JSON export (app 8.7.0), 242 beans, 1357 brews,
  22 preparations, 3 mills, 17 waters.
- **FP**: smart-scale flow profiles from the full export, 1218 brews, 354
  profiles read, summarizer prototyped (see "Pour analytics notes").

Line format: `name — what it shows | data | coverage | chart | sub-project | priority`.
Sources in brackets. All rating stats follow the foundation's rating switches
(Settled/All, adjusted mean with K = 5 and "few bags" marker) and timeframes.
**needs-new-data** marks ideas that can't be built from what's stored today.

## Data coverage

| Area | Status | Notes |
|---|---|---|
| Brews: dose, grind, temp, time, bloom, water, ratio, rating | rich (97–100%) | 2026-02-09 → 10-09, ~226 brew days; ratings 0.5 steps, mode 8 |
| Bags: roaster, origin, process, roast level, cost, weight, roast date, rest window | rich (98–100%) | 41 roasters, 17 origins, 46 process labels (9 groups), 8 roast labels (Ultralight 159/265) |
| Water minerals, stored GH/KH | rich (41–82%) | 12 recipes used; Mg/K 60/10 on 784 brews |
| Flow profiles | rich (90% of brews) | only from 2026-03-04 |
| Bean-level rating, BQ roast slider, best_brew flag | good (72% / 100% / one per bag) | bean rating correlates 0.80 with mean brew rating |
| Gear | good | 22 methods (dripper + filter in the name), 2 grinders used (A4Z 1245, ZP6 112) |
| Subscriptions | thin | 6 rows, current state only; no dates, no link to bags |
| Freezer dates | thin | 18 bags (DB only; BQ freezer off) |
| opened_date | thin | 37 rows, since 2026-09-20 |
| Decaf, free bags, repeat buys | thin | 16 decaf, 5 free, 33 repeat pairs |
| Brew notes (recipe tags, coarser/finer) | thin | 62% have a note, heuristic parsing only |
| TDS/EY, farm/region/variety/elevation, coordinates, cupping, first drip time, favorite, vessel, BQ frozen/buy/open dates, brew photos, pressure/temperature curves, second scale | **empty (0%)** | settings off or never used; stats on these need new data |

## Overview

- **Bags bought** — bags by purchase (roast) date in the period, vs previous [DB] | roast_date | ok | tile | 3 | high
- **Backlog right now** — bags, grams and $ waiting (backlog + open, ~82 bags / 11 kg) [DB, BQ] | status, amount_g, cost | ok | tile | 3 | high
- **Days of coffee left** — backlog grams ÷ recent g/day (~119 days), plus run-out date at current pace ignoring new buys [DB] | status, amount_g, doses | ok | tile | 3 | high
- **Variety tried** — distinct roasters, origins, process groups in the period [DB] | roaster, origin, processing | ok | tile | 3 | med
- **Unrated share** — % of brews and bags left unrated, over time [BQ] | rating = 0 | ok | line | 3 | low

## Taste & preference

- **Rating by origin** — adjusted mean per origin with bag count [DB, BQ] | origin + brew rating | ok | bar | 2 | high
- **Rating by process group** — adjusted mean per process group [DB, BQ] | processing → processGroup | ok | bar | 2 | high
- **Rating by roaster** — adjusted mean, bags, brews per roaster, few-bags marker [DB, BQ] | roaster + rating | ok | bar | 2 | high
- **Rating by roast level** — normalized roast level, or BQ's numeric roast slider for finer steps [DB, BQ] | roast_level / roast_range | ok (Ultralight-heavy) | bar | 2 | high
- **Rating distribution** — histogram of brew ratings, mode and median, Settled vs All [BQ] | brew rating | ok | bar | 2 | high
- **Bag verdict vs brew average** — bean rating vs mean brew rating per bag; above the line = remembered better than brewed [BQ] | bean rating, brew rating | ok | scatter | 4 | high
- **Best-brew uplift** — how far each bag's best brew sits above its mean [BQ] | best_brew, rating | ok | bar | 4 | med
- **Most consistent bags** — lowest rating spread per bag (≥ 5 brews) [BQ] | rating per bag | ok | table | 3 | med
- **Rating variance over time** — monthly SD of ratings; shows the June calibration settling [BQ] | rating, date | ok | line | 2 | med
- **Origin × process heatmap** — rating per cell [DB] | origin, processing, rating | thin (many small cells) | heatmap | 2 | med
- **Rating by bag size** — 250 g bags vs 100/125 g samplers [DB, BQ] | amount_g, rating | ok | bar | 2 | low
- **Decaf vs regular** — decaf share of bags/grams and rating gap [DB, BQ] | decaf | thin (16 bags) | tile | 2 | low
- **Note words by rating band** — frequent words in brew notes per rating band [BQ] | brew notes | thin | bar | 4 | low

## Brewing

- **Rest curve** — rating by days off roast (net of freezer), bucketed [BQ] | roast_date, brew date, frozen_*, rating | ok | line | 4 | high
- **Rest curve by process / roast level** — peak day per group [BQ] | + processGroup, roast level | ok | line | 4 | high
- **Dial-in curve** — mean rating by brew number within a bag (1st 6.7 → 7th 7.7) [BQ] | brews per bag, rating | ok | line | 4 | high
- **Brews to dial in** — brews until a bag first hits its best (or ≥ 8) [BQ] | rating, best_brew | ok | bar | 4 | high
- **Grind drift over a bag** — grind setting by brew number (per grinder) [BQ] | grind_size, mill | ok | line | 4 | high
- **Grind vs rating** — rating by grind setting per grinder, faceted by roast level [BQ] | grind_size, mill, rating | ok | heatmap | 4 | high
- **Temperature vs rating** — mean rating per temp (85–94 °C) [BQ] | brew_temperature, rating | ok | bar | 4 | high
- **Brew time vs rating** — rating by total time band, per dripper [BQ] | brew_time, method, rating | ok | scatter | 4 | high
- **Ratio vs rating** — water/dose bands (15.6–18) vs rating [BQ] | brew_quantity, dose, rating | ok | bar | 4 | high
- **Bloom length vs rating** — entered bloom (30/40/45/60 s); prefer the measured bloom from flow profiles once sub-project 6 exists (Alpha Switch: 45 s 7.5 vs 30 s 6.4) [BQ, FP] | coffee_blooming_time / bloom_s, rating | ok | bar | 4 → 6 | high
- **Recipe tag leaderboard** — rating per recipe tag parsed from brew notes [BQ] | notes | thin | table | 4 | high
- **Where the best brew lands** — position in the bag (median ~70% through) and days off roast [BQ] | best_brew, order, roast_date | ok | bar | 4 | med
- **Temperature by roast level** — chosen temp vs roast level, rating as color [BQ] | temp, roast level, rating | ok | heatmap | 4 | med
- **Dose sizes** — dose histogram (8–33 g) and rating by dose [BQ] | grind_weight, rating | ok | bar | 4 | med
- **Back-to-back brews** — same bag twice in a day (436 bean-days): rating change on the second [BQ] | bag, date, rating | ok | tile | 4 | med
- **Sweet spot per process** — best grind/temp/ratio band per process group [BQ] | brew vars, processGroup | ok | table | 4 | med
- **Method eras** — which method dominated each month [BQ] | method, date | ok | line | 4 | med
- **Dial-in direction log** — how often notes say coarser/finer and whether the next brew improved [BQ] | notes, next brew | thin | bar | 4 | med
- **Over vs under extraction calls** — note mentions by roast level and process [BQ] | notes | thin | bar | 4 | low

## Water

- **Water recipe leaderboard** — adjusted mean per recipe, with brews and bags [BQ] | water, rating | ok | bar | 2 | high
- **GH band vs rating** — 0 / 40 / 60 / 70–90 ppm [BQ] | derived GH (stored as cross-check) | ok | bar | 2 | high
- **KH band vs rating** — 10 / 14–20 / 25–40 ppm [BQ] | derived KH | ok | bar | 2 | high
- **GH × KH map** — rating heatmap over GH/KH cells [BQ] | GH, KH, rating | ok | heatmap | 2 | high
- **Ca vs Mg water** — Mg-only, Ca-only, mixed recipes [BQ] | calcium, magnesium | ok | bar | 2 | high
- **Water × roast level** — "what water for what coffee" [BQ] | water, roast level, rating | ok | heatmap | 2 | high
- **Water × process group** — naturals vs washed vs anaerobic [BQ] | water, processGroup, rating | ok | heatmap | 2 | high
- **Same bag, different water** — paired rating difference on bags brewed with 2+ waters [BQ] | bag, water, rating | ok | bar | 4 | high
- **Water × origin** — recipe × top countries [BQ] | water, origin, rating | thin | heatmap | 2 | med
- **Water × dripper** — recipe × dripper [BQ] | water, method, rating | thin | heatmap | 2 | med
- **Water eras** — recipe use by month [BQ] | water, date | ok | line | 4 | med
- **Mineral mg per month** — Mg/Ca/K mg consumed (mg/L × water g) [BQ] | minerals, brew_quantity | ok | line | 4 | low
- **Lotus drops used** — drops per mineral from the recipe note × brews, as a bottle burn rate [BQ] | water.note, brews | thin | bar | 4 | low

## Gear (drippers, filters, grinders)

- **Dripper comparison** — adjusted mean, brews, SD per dripper, filter ignored [BQ] | method → dripper | ok | bar | 2 | high
- **Filter comparison** — Abaca vs T90 vs Sibarist Fast, overall and within one dripper (Alpha Switch: 7.02 / 7.42 / 6.79) [BQ] | method → filter | ok | bar | 2 | high
- **Dripper × filter matrix** — rating per pair, cell size = brews [BQ] | method, rating | ok | heatmap | 2 | high
- **Consistency per method** — rating SD per method (0.67 vs 1.98) [BQ] | method, rating | ok | bar | 2 | high
- **Grinder comparison** — A4Z vs ZP6 on the same bags only [BQ] | mill, bag, rating | ok | bar | 4 | med
- **Gear usage share** — brews per dripper/filter/grinder over time [BQ] | method, mill, date | ok | bar | 2 | med
- **Dripper by roast level** — which dripper per roast level and its rating there [BQ] | method, roast level, rating | ok | heatmap | 2 | med
- **Dripper geometry** — cone vs flat/wave vs Origami [BQ] | preparation.type | ok | bar | 2 | low
- **Unused gear** — defined but rarely/never used [BQ] | mill, preparation, brews | ok | table | 3 | low

## Habits & time

- **Hour of day** — brews and rating per hour (peak 11–14, 15:00 rates highest) [BQ] | brew timestamp (local) | ok | bar | 2 | high
- **Day of week** — brews and rating by weekday (weekend ~7.5 vs Wed 7.0) [BQ] | timestamp, rating | ok | bar | 2 | high
- **Brew calendar** — daily brews heatmap [BQ] | timestamp | ok | calendar | 3 | high
- **Bag lifetime** — days first → last brew (avg 5.5) and brews per bag (avg 7.3) [DB, BQ] | brews per bag | ok | histogram | 4 | high
- **Active brew days & streaks** — share of days brewed, longest streak, current gap [BQ] | timestamp | ok | tile | 3 | med
- **Brews per brew day** — distribution (mode 6) and busiest day [BQ] | timestamp | ok | bar | 3 | med
- **Hour × weekday** — brew count heatmap [BQ] | timestamp | ok | heatmap | 2 | med
- **Bags in rotation** — bags open/brewed at once per day or week [DB, BQ] | first/last brew per bag | ok | line | 4 | med
- **Bags finished per month** — throughput by last brew (not moved_date) [DB] | last brew per bag | ok | bar | 4 | med
- **Bag yield** — share of bag grams logged as brews (86%), unaccounted grams per bag [DB, BQ] | amount_g, doses | ok | tile | 4 | med
- **Note-taking habit** — share of brews with a note, by month and rating [BQ] | notes present | ok | line | 3 | low

## Buying & value

- **Monthly spend & grams bought** — $ and kg bought per month [DB] | cost, amount_g, roast_date | ok | bar | 4 | high
- **Price per 100 g trend** — weighted $/100 g bought per month (10.6 → 18.7 → 13.8) [DB] | cost, amount_g | ok | line | 4 | high
- **$/g by roaster** — weighted, ranked (Sey $0.108 vs Picky Chemist $0.393) [DB] | cost, amount_g, roaster | ok | bar | 2 | high
- **$/g by origin** — with bag count [DB] | cost, amount_g, origin | ok | bar | 2 | high
- **$/g by process group** — are co-ferments the premium tier? [DB] | cost, amount_g, processGroup | ok | bar | 2 | high
- **Price vs rating** — does paying more get a better cup; correlation + scatter of $/g vs bag rating [DB, BQ] | cost, amount_g, rating | ok | scatter | 4 | high
- **Value map** — adjusted rating vs $/g with a "cheap & great" quadrant and a top value-picks list [DB, BQ] | cost, amount_g, rating | ok | scatter + table | 4 | high
- **Best value roasters** — adjusted rating ÷ $/g per roaster [DB] | roaster, cost, rating | ok | table | 4 | high
- **Roaster report card** — bags, $, $/g, rating, rated-bag %, last bought per roaster [DB, BQ] | coffees + rating | ok | table | 4 | high
- **New-roaster discovery** — first-ever bag per roaster per month + cumulative roasters [DB] | roaster, roast_date | ok | line | 4 | high
- **Arrival lag** — days from roast to logging the bag, per roaster (5–40 days) [BQ] | roastingDate, bean created timestamp | ok | bar | 4 | high
- **$/g by roast level** — ordered by degrees of roast [DB] | cost, roast_levels | ok (skewed) | bar | 2 | med
- **Bag size habits** — 100/125/200/250 g split and shift over time [DB, BQ] | amount_g, roast_date | ok | bar | 4 | med
- **Share of spend by roaster** — top roasters' share of $, rest grouped [DB] | roaster, cost | ok | stacked 100% bar | 4 | med
- **Roaster loyalty over time** — monthly bags per top-N roaster, repeat-buy rate [DB, BQ] | roaster, roast_date | ok | stacked bar | 4 | med
- **Origin / process mix over time** — bags per origin and per process group by month [DB, BQ] | origin, processGroup, roast_date | ok | stacked bar | 2 | med
- **Repeat purchases** — coffees bought twice (33 pairs): bag 1 vs bag 2 rating, repeat rate [DB, BQ] | name + roaster, rating | ok (fuzzy matching) | table | 4 | med
- **Purchase cadence** — days between purchases, average gap, longest drought [DB] | roast_date | ok (proxy) | line | 4 | med
- **Rebuy-worthy list** — best bags never rebought from roasters still bought [DB] | coffees + rating | ok | table | 3 | low
- **Buying bursts** — purchase calendar heatmap [DB] | roast_date | ok | calendar | 4 | low
- **Free / sample bags** — bags with cost 0 [DB] | cost | thin (5) | tile | 4 | low

Subscriptions (own sub-section, user-requested in the roadmap):

- **Monthly subscription commitment** — active subscription $, bags and grams per month [DB] | subscriptions.price, bag_count, amount_per_bag_g, paused | ok (current only) | tile | 4 | high
- **Subscription spend over time** — monthly subscription $ [DB] | **needs-new-data**: start/end dates, price history | line | 4 | high
- **Subscription $/g vs one-off $/g** — per subscription vs that roaster's one-off bags [DB] | subscriptions + coffees | ok for current price; bag matching thin | bar | 4 | high
- **Subscription vs one-off ratings** — rating of subscription bags vs others [DB] | **needs-new-data**: `subscription_id` on coffees (or roaster alias map; names differ) | bar | 4 | high
- **Subscription share of grams** — % of incoming grams from subscriptions [DB] | **needs-new-data**: bag ↔ subscription link | tile | 4 | low
- **Renewal calendar** — upcoming deliveries by renewal_day [DB] | renewal_day | ok | calendar | 4 | low

## Backlog & freshness

- **Backlog size over time** — bags/grams on hand per day: bought minus finished (last brew) [DB] | roast_date, last brew | ok (reconstructed) | line | 4 | high
- **Inflow vs outflow** — grams bought vs brewed per month; is the pile growing [DB] | amount_g, doses | ok | paired bar | 4 | high
- **Time in backlog** — days roast → first brew per bag (avg 55), by roaster/process [DB, BQ] | roast_date, first brew | ok | bar | 4 | high
- **Backlog age profile** — waiting bags bucketed by days since roast (net of freezer) [DB, BQ] | roast_date, frozen_*, status | ok | bar | 4 | high
- **Rest-window adherence** — % brews before / inside / after the bag's window (65 / 1177 / 102) [DB] | rest_days_low/high, rest days | ok | stacked bar | 4 | high
- **Rating vs rest window** — early / in-window / late means, plus rating vs position in window (0 = low, 1 = high) [DB] | rest window, rating | ok | bar + scatter | 4 | high
- **Urgency right now** — backlog bags ready / not yet / past drink-before [DB] | urgency.ts | ok | tile | 3 | med
- **Upcoming ready queue** — bags becoming drinkable per week ahead [DB] | drink_after | ok | bar | 4 | med
- **Bags past their window** — share of bags whose last brew was after drink-before [DB] | urgency + last brew | ok | tile | 4 | med
- **Roast-to-finish** — days roast → last brew, distribution and trend [DB] | roast_date, last brew | ok | histogram | 4 | med
- **Backlog by origin / process / roaster** — what the pile is made of [DB] | status + dims | ok | bar | 4 | med
- **Rating by time in backlog** — bag rating vs days roast → first brew [DB] | roast_date, rating | ok | scatter | 4 | med
- **Freezer usage** — bags frozen, currently frozen (10), avg days frozen (52) [DB] | frozen_* | thin (18) | tile | 4 | med
- **Frozen vs never-frozen rating** — 7.60 vs 7.16 (n = 9 vs 174) [DB] | frozen_*, rating | thin | bar | 4 | med
- **Rest windows by roaster** — typical stated window per roaster [DB] | rest_days_* | ok | range bar | 4 | low
- **Days saved by freezing** — rest days paused across frozen bags [DB] | frozen_* | thin | tile | 4 | low
- **What gets frozen** — frozen bags by roaster/process/window [DB] | frozen_* | thin | table | 4 | low
- **Bags never brewed** — archived without brews (3) [DB] | status, BQ link | ok | tile | 4 | low
- **On-deck behavior** — opened → first brew, open → archive [DB] | opened_date | thin (since 2026-09-20) | tile | 4 | low

## Records & fun

- **Best / worst bag ever** — top and bottom bags by mean rating (min brews) [DB] | rating per bag | ok | table | 3 | high
- **Highest-rated brews** — top 10 with bag, method, water, grind [BQ] | brews | ok | table | 3 | high
- **Perfect 10s** — the 7 brews rated 10 and what they share [BQ] | rating = 10 | ok | table | 3 | med
- **Biggest dial-in jump** — largest gain between consecutive brews of a bag [BQ] | rating per bag | ok | table | 3 | med
- **Most-brewed bag** — most brews (16) / grams [DB, BQ] | brews per bag | ok | tile | 3 | med
- **Firsts** — first bag per roaster/origin/process, first brew per dripper/filter/water/grinder [DB, BQ] | dates | ok | table | 3 | med
- **Biggest buying month** — most bags (Mar: 45) / most $ (Apr: $1,032) [DB] | roast_date, cost | ok | tile | 3 | med
- **Most / least expensive bag** — by $/g and absolute [DB] | cost, amount_g | ok | table | 3 | med
- **Oldest bag waiting** — longest-resting backlog bag [DB] | roast_date, frozen_* | ok | tile | 3 | med
- **Busiest brew day** — 13 brews [BQ] | timestamp | ok | tile | 3 | low
- **Longest / shortest brew** — brew_time extremes, zeros excluded [BQ] | brew_time | ok | tile | 3 | low
- **Most-renamed coffee** — slug redirects (15) [DB] | slug_redirects | thin | tile | 3 | low

## Pour analytics

All from flow profiles summarized at upload [FP]; analyze within a method
family (and ideally within a bag), always show n.

- **Brew timeline bar** — stacked bloom / pouring / drawdown seconds per brew; the main pour visual | pour_starts_s, last_pour_end_s, tail_s | ok | horizontal stacked bar | 6 | high
- **Drawdown by dripper & filter** — typical tail per dripper, and filter effect on the same dripper (Abaca vs T90 vs Sibarist) | tail_s, t_final_s, method | ok | grouped box plot | 6 | high
- **Drawdown trend** — is a dripper drifting (CT62 38 → 66 s, Jul → Oct) | tail_s, date | ok | line (monthly median) | 6 | high
- **Drawdown vs grind** — grind feedback per grinder | tail_s, grind_size, mill | ok (parse per mill) | scatter per mill | 6 | high
- **Drawdown vs rating** — faster or slower drawdowns, per method | tail_s, rating | ok | scatter + LOESS | 6 | high
- **Pour count vs rating** — best pour count per dripper (Alpha Switch: 3 pours 7.3 vs 4 pours 6.5) | n_pours, rating | ok | dot + CI | 6 | high
- **Recipe fingerprints** — cluster brews by pour schedule (60+120+120 vs 4×75), make "recipe" a dimension | pours_g, pour_starts_s | ok | small multiples | 6 | high
- **Dial-in journey per bag** — drawdown and rating across a bag's brews | tail_s, n_pours, rating, grind | ok | dual line | 6 | high
- **Dripper report card** — median bloom, pours, rate, drawdown, rating per dripper | all metrics | ok | table + sparklines | 6 | med
- **Bloom ratio** — bloom water ÷ dose vs rating | bloom_g, dose | ok | scatter | 6 | med
- **Pour speed** — average g/s per method and over time | avg_rate | ok | line | 6 | med
- **Pour steadiness** — in-pour flow CV vs rating | rate_cv | ok (trim pour edges first) | scatter | 6 | med
- **Swirl effect** — lifts per brew vs rating (CT62 ρ −0.26, Graycano +0.28) | lift count | ok | bar by count | 6 | med
- **Contact time split** — share of time pouring vs drawing down | t_final_s, tail_s, total_s | ok | 100% stacked bar | 6 | med
- **Bloom timer accuracy** — measured vs entered bloom (57% within 5 s) | bloom_s, coffee_blooming_time | ok | histogram | 6 | med
- **Consistency within a bag** — spread of drawdown and schedule; "stable recipe" score | tail_s, pours_g | ok | dot range | 6 | med
- **Dose vs drawdown** — do bigger beds drain slower | tail_s, dose | ok | scatter | 6 | med
- **Best vs worst profile** — median curve of top- vs bottom-rated brews per method | **needs-new-data**: stored ~60-point curve | overlaid step lines | 6 | med
- **Pour replay sparkline** — cleaned curve on each brew's detail | **needs-new-data**: stored ~60-point curve | sparkline | 6 | med
- **Gap length vs rating** — longer waits between pours | gaps_s | ok | scatter | 6 | low
- **Agitation count** — presses/stirs vs rating | press count | thin (press type unknown) | bar | 6 | low
- **Temperature vs drawdown** — hotter drains faster? | tail_s, temp | ok (temps cluster 90–92) | scatter | 6 | low
- **Pour accuracy** — final water vs target | final_g, brew_quantity | ok | histogram | 6 | low
- **Peak pour rate** — aggressive pours (> 20 g/s) vs rating | peak_rate | ok | strip plot | 6 | low
- **Pour habits by time** — pour speed/timing by hour × weekday | avg_rate, total_s | ok | heatmap | 6 | low
- **Profile availability** — share of brews with a profile, by month [BQ] | flow_profile | ok | tile | 6 | low
- **Alpha Switch steep time** — closed vs open phase | **needs-new-data**: switch-open marker (invisible on one scale) | stacked bar | 6 | low
- **Channeling / stall detector** — drip rate during drawdown | **needs-new-data**: server-only weight (second scale) | line | 6 | low

## Year in review

Composites of the ideas above for a period = calendar year (sub-project 5).

- **Year in numbers** — brews, grams, bags, spend, roasters, origins, new roasters, vs last year | overview tiles | ok | tile row | 5 | high
- **Bag of the year** — top 5 bags with roaster, origin, process | Best bag ever | ok | table | 5 | high
- **Brew of the year** — the top brew and its recipe | Highest-rated brews | ok | tile | 5 | med
- **Your gear & water** — most-used and best-rated dripper, filter, water | Gear, Water | ok | tiles | 5 | med
- **Taste profile** — origin / process mix and ratings vs last year | Taste, Buying mix | ok | bar | 5 | med
- **Month by month** — brews, spend and avg rating per month | timeline | ok | strip | 5 | med
- **Firsts of the year** — new roasters, origins, processes, gear | Firsts | ok | table | 5 | med
- **Big moments** — busiest day, biggest buying month, perfect 10s, longest streak | Records | ok | tiles | 5 | low
- **How you improved** — rating spread and brews-to-dial-in vs last year | Taste, Brewing | ok (needs 2 years) | tile | 5 | low

## Pour analytics notes

### Export and format

- Full export zip: **133 MB** (844 MB uncompressed). Profiles are
  `brews/<uuid>_flow_profile.json` (1217 files, 777 MB raw, 67 MB compressed);
  `<uuid>` = brew `config.uuid`, and the brew's `flow_profile` field names the
  file (empty = no profile). Also 22 photos (66 MB) and the inner
  `Beanconqueror.zip` (136 KB).
- One Acaia Lunar, tare on timer start, raw readings kept (glitches included).
- Setup inferred from the curves: dripper **and** server on the scale, so
  weight = cumulative water poured. Drawdown is invisible (water moves within
  the scale), as are drip rate, channeling, stalls and the Alpha Switch opening.
- Only `weight` matters: samples at ~10.5 Hz (800–3300 per brew) with
  `timestamp` ("HH:MM:SS.mmm"), `brew_time`, raw and smoothed weight.
  `realtimeFlow` and `waterFlow` are derived from it (and spike on lifts).
  Second-scale, pressure, temperature, brew-by-weight and newer
  smart-machine keys are always empty.
- **Gotcha:** `brew_time` "6.10" means second 6, sample 10 (goes to .12); it's
  not a decimal. Use `timestamp` deltas, handling the midnight wrap.
- ~600 KB JSON per brew (~60 KB gzipped): 7 repeated keys × 3 parallel series.

### Summarizer algorithm (prototype, ~150 lines, stdlib only)

Core idea: with everything on the scale, cleaned weight can only rise.

```
t      = seconds from first timestamp (mod 86400)
w      = 5-sample rolling median of raw weight          # despike
re-tare: weight drops to ~0 from > 20 g, holds 2 s, then rises again
         -> add the previous level as an offset
         if an instant > 30 g step happened in the 30 s before the tare
         (object placed, e.g. Gabi drip-assist top), carry over only the
         level before that step
cup-off: trailing run > 15 g below the smoothed running max -> cut there
excursions: split at > 10 g jumps between samples; a segment < 8 s that
         starts > 15 g away from the last kept value is a lift (below) or
         press (above); hold the last good value, count one event per run
clean  = centered rolling median (±8 s, shrinking at the ends), then running max
flow   = 1 s backward difference
pours  = flow > 1 g/s, gaps < 2 s merged, ≥ 5 g added
```

Per brew output (~310 B JSON, ~15 ms in CPython): `total_s`, `final_g`,
`n_pours`, `bloom_g`, `bloom_s` (pour 2 start − pour 1 start), `pours_g[]`,
`pour_starts_s[]`, `gaps_s[]`, `t_final_s` (98% of final), `last_pour_end_s`,
`tail_s` (total − last pour end = drawdown if the timer stops at dry bed),
`avg_rate`, `peak_rate`, `rate_cv`, `flags` (tare, object, cup_off,
lift:n, press:n).

Thresholds (15 g excursion, 10 g/sample step, ±8 s window, 1 g/s pour, 2 s
merge) were tuned on this user's Lunar and habits: keep them as named
constants. Store an `algo_version` with each summary.

### Robustness (300 random profiles)

- 0 errors. `final_g` within 5 g of `brew_quantity` for 292/300 (misses: user
  edits to the quantity, and odd re-tared brews).
- `total_s` within 3 s of `brew_time` for 284/300; misses are cup-off cuts
  (mostly Gabi), arguably the better drawdown end.
- Measured bloom within 5 s of the entered bloom for only 167/295: entries are
  presets, so the measured value is the useful one.
- 223/300 brews have a lift or press (swirling after the bloom is routine).
  Without masking, ~25% got phantom 40–400 g/s pours; with it, 1/300 peaks
  above 50 g/s.
- Known limits: one re-tare per brew (15/300 have one); a press > ~8 s reads
  as water; dumps > ~100 g/s split at steps; `rate_cv` includes pour ramps.
  CT62 bloom splits into two "pours" when a swirl follows a short bloom
  (14/94): merge pour 1 into pour 2 when followed by a lift and a gap < 3 s.

Medians by method family:

| family | n | pours | bloom g / s | avg g/s | CV | t→final s | tail s |
|---|---|---|---|---|---|---|---|
| Alpha Switch | 96 | 3–4 | 63 / 47 | 6.7 | 0.31 | 124 | 55 |
| CT62 | 94 | 4–5 | 63 / 21 | 8.4 | 0.64 | 105 | 52 |
| Graycano | 49 | 4 | 62 / 31 | 8.2 | 0.41 | 110 | 44 |
| V60 | 29 | 2–4 | 58 / 31 | 7.4 | 0.30 | 96 | 56 |
| Gabi Master A | 16 | 4 | 60 / 39 | 9.0 | 0.44 | 148 | 93 |

Alpha Switch's tail mixes steep and drawdown, so compare tails within a
method only. Pooled across methods every |ρ| vs rating is < 0.1; within a
method the strongest are ~0.2–0.3 (Alpha Switch tail −0.25, CT62 lifts −0.26,
Graycano lifts +0.28). Hypotheses, not findings: the bean dominates rating.

### Upload and storage recommendation

- **Summarize client-side in the browser.** The server rejects bodies > 20 MB
  (`BODY_SIZE_LIMIT`), the reverse proxy caps at 100 MB, and the zip is
  133 MB. `jszip` (already in the lockfile) opens the zip; inflate, parse,
  summarize and discard one profile at a time. Port the summarizer to JS
  (~150 lines, no new dependency). Under a minute for 1218 profiles; show a
  progress count; Web Worker only if the page janks. Desktop is the expected
  path (the whole zip sits in memory).
- **Payload:** ~310 B × 1218 ≈ 380 KB JSON (~80 KB gzipped). Key by brew
  `config.uuid` (= `bc_uuid`), server upserts; page data carries known uuids so
  later uploads only process new brews.
- **One upload for both:** the full export contains `Beanconqueror.zip`, so a
  single "Full export (.zip)" picker can POST the inner 136 KB zip (JSON
  import) plus the summaries.
- Server-side streaming unzip rejected: raised limits or chunking through the
  proxy, plus server CPU/disk, for no gain.
- **Storage:** one `brew_flow_summary` table (`brew_id`, `algo_version`,
  scalar metrics, `pours_json`, `flags_json`), ~300 B/brew ≈ 0.4 MB total.
  Optional `curve` (60 points × uint16 ≈ 120 B) unlocks the replay and
  best-vs-worst ideas.

## Data-quality caveats

- **Purchase date** = roast date (no buy date anywhere). `created_at` is useless
  for it (bulk entries: 30 on 03-03, 21 on 04-27).
- **Finished date** = last brew, not `moved_date` (27 bulk-stamped 2026-04-10,
  mixed date/ISO formats, gap to last brew −5 to 148 days; normalize with
  `substr(…,1,10)`). `drank` duplicates `status = 'archive'`.
- **Data starts** 2026-01-19 (bags), 2026-02-09 (brews), 2026-03-04 (flow
  profiles); January is partial and `3y` is mostly empty. `opened_date` only
  since 2026-09-20.
- **Rest days** must be net of freezer time (BQ `bean_age_days` ignores it);
  10 of 18 frozen bags are still frozen (open freeze runs to the brew).
- **Zeros mean "not entered"**: rating 0 (37 brews, 68 beans), brew_time 0
  (18), bloom 0 (35), brew_quantity 0 and one −368.6; a few malformed grind
  strings (`1..5.0`, empty). Exclude, don't average.
- **Grind settings are per grinder** (A4Z `a.b.c`, ZP6 `a.b`): never mix
  grinders on one axis.
- **Back-filled brews:** brew timestamps are already local, but 9 sit on
  whole hours and 12 predate their bag's creation; exclude from hour-of-day.
  Insights uses whole hours only (the created_at rule flagged 30 on prod-copy, 2026-10-11).
  BQ `roastingDate` is mixed ISO-UTC / plain date: convert ISO carefully so a
  late-evening roast doesn't land on the next day.
- **Brew upsert key:** two brews share both timestamp and bean; key on
  `bc_uuid` (the import spec does).
- **Water GH/KH:** stored values exist but are stale on several profiles (e.g.
  Ultralights store KH 20 vs 10 derived); derived wins, stored is a flag. The
  "1/3 strength TWW" profile holds full-strength numbers (4 brews).
- **Cost:** 5 bags cost 0/null; per-bag cost includes whatever shipping was
  entered, so roaster $/g mixes shipping policies. Subscription deliveries are
  already bags: never add `subscriptions.price` to spend.
- **Subscriptions** are current-state only: no start/end, no price history, no
  link to bags, and roaster names don't match `coffees.roaster` ("H&S Coffee
  Roasters" vs "H&S"); one has no bags at all.
- **Bag yield < 100%** (86% of grams logged): grams bought vs brewed won't
  balance.
- **Small samples:** decaf 16, frozen 18, many origins < 5 bags, 33 repeat
  pairs, Ultralight 159/265. Use the adjusted mean and few-bags marker; repeat
  detection by name + roaster is fuzzy (harvest years, variants).
- **best_brew** is exactly one per bag, so it's a "pick of the bag" flag, not
  an independent signal (10/138 aren't the top-rated brew).
- **Brews per day** (mode 6) include dial-in sessions and possibly multiple
  drinkers: don't read per-day stats as one person's consumption.
- **Note parsing** (recipe tags, coarser/finer, words) is heuristic personal
  shorthand: treat as thin.
- **Flow profiles:** `tail_s` is drawdown only if the timer stops at dry bed
  (40–70 s values suggest it usually does); ~3% won't match `brew_quantity`,
  so surface a "check" flag instead of trusting either number.
