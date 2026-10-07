export const schema = `
CREATE TABLE IF NOT EXISTS coffees (
  id INTEGER PRIMARY KEY,
  roaster TEXT NOT NULL,
  coffee_name TEXT NOT NULL,
  origin TEXT,
  roast_level TEXT,
  processing TEXT,
  amount_g REAL,
  cost REAL,
  roast_date TEXT,
  frozen_start_date TEXT,
  frozen_end_date TEXT,
  rest_days_low INTEGER,
  rest_days_high INTEGER,
  image_url TEXT,
  product_url TEXT,
  -- Nullable here (unlike types.ts's non-optional 'slug: string') because SQLite
  -- can't ALTER TABLE ADD COLUMN NOT NULL without a default; the unique index plus
  -- the startup backfill migration are what actually guarantee every row has one.
  slug TEXT,
  opened_date TEXT,
  drank INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'backlog',
  moved_date TEXT,
  decaf INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Old slugs keep working after a rename (written by updateCoffee). Keyed to
-- coffee_id, not the target slug, so a chain of renames lands on the current
-- one. Old slugs count as taken (slugExists). node:sqlite enforces foreign
-- keys by default, so deleting a coffee cascades here.
CREATE TABLE IF NOT EXISTS slug_redirects (
  old_slug TEXT PRIMARY KEY,
  coffee_id INTEGER NOT NULL REFERENCES coffees(id) ON DELETE CASCADE
);

-- Roaster → default image, set by hand from the coffee form ("Set as roaster
-- default"). A live fallback for coffees with no image of their own (joined in
-- coffees.ts LIST_SELECT), never copied into coffees. NOCASE: "norml" = "Norml".
CREATE TABLE IF NOT EXISTS roaster_images (
  roaster TEXT PRIMARY KEY COLLATE NOCASE,
  image_url TEXT NOT NULL
);

-- Roaster → website origin (https://host), searched by image Suggest.
-- Filled at boot from known product URLs (backfillRoasterWebsites, never
-- overwriting) and by Suggest picks saved from the coffee form.
CREATE TABLE IF NOT EXISTS roaster_websites (
  roaster TEXT PRIMARY KEY COLLATE NOCASE,
  url TEXT NOT NULL
);

-- One row per paid search call (Tavily), written before the call, so the
-- provider stays under the free plan's monthly credits. Rows older than 31
-- days are pruned on each write (imageSuggest/providers/tavily.ts).
CREATE TABLE IF NOT EXISTS search_usage (
  provider TEXT NOT NULL,
  at TEXT NOT NULL
);

-- Backdrop color behind each displayed image (object-fit: contain), keyed by
-- the exact URL so a logo shared by many coffees is computed once. Written by
-- server/imageFills.ts; joined in coffees.ts LIST_SELECT as image_fill.
CREATE TABLE IF NOT EXISTS image_fills (
  url TEXT PRIMARY KEY,
  fill TEXT NOT NULL
);

-- Our own copy of each displayed image (spec 2026-10-06-local-image-copies-design.md):
-- original URL + kind → content-addressed file under images/<kind>/. Written by
-- server/imageCopies.ts; joined in coffees.ts LIST_SELECT as image_copy.
CREATE TABLE IF NOT EXISTS image_copies (
  url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('coffees', 'roasters')),
  file TEXT NOT NULL,
  PRIMARY KEY (url, kind)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  roaster_service TEXT NOT NULL,
  subscription_name TEXT,
  price REAL,
  bag_count REAL,
  amount_per_bag_g REAL,
  renewal_day INTEGER,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  created_at TEXT NOT NULL,
  read_at TEXT,
  dismissed_at TEXT
);

CREATE TABLE IF NOT EXISTS roast_levels (
  roast_level TEXT PRIMARY KEY,
  degrees_of_roast REAL
);

INSERT OR IGNORE INTO roast_levels (roast_level, degrees_of_roast) VALUES
  ('Green', 0.0),
  ('Hyperlight', 0.5),
  ('Ultralight', 1.0),
  ('Nordic Light', 1.5),
  ('Nordic', 2.0),
  ('Light', 2.5),
  ('Light/Medium', 3.0),
  ('Medium/Light', 3.5),
  ('Medium', 4.0),
  ('Medium/Dark', 4.5),
  ('Dark', 5.0);

CREATE TABLE IF NOT EXISTS beanconqueror_beans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  roaster TEXT,
  roast_date TEXT,
  roast_type TEXT,
  degree_of_roast REAL,
  custom_degree_of_roast TEXT,
  blend TEXT,
  weight_g REAL,
  cost REAL,
  aromatics TEXT,
  cupping_points TEXT,
  decaffeinated INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  ean_article_number TEXT,
  notes TEXT,
  rating REAL,
  bc_created_at TEXT,
  bc_archived INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  dismissed_at TEXT,
  coffee_id INTEGER REFERENCES coffees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS beanconqueror_bean_origins (
  id INTEGER PRIMARY KEY,
  bean_id TEXT NOT NULL REFERENCES beanconqueror_beans(id),
  component_number INTEGER NOT NULL,
  country TEXT,
  region TEXT,
  farm TEXT,
  farmer TEXT,
  elevation TEXT,
  variety TEXT,
  processing TEXT,
  certification TEXT,
  harvested TEXT,
  percentage REAL,
  UNIQUE(bean_id, component_number)
);

CREATE TABLE IF NOT EXISTS beanconqueror_methods (
  id TEXT PRIMARY KEY,
  preparation_method TEXT,
  name TEXT,
  preparation_style TEXT,
  preparation_tools TEXT,
  notes TEXT,
  bc_archived INTEGER NOT NULL DEFAULT 0,
  bc_created_at TEXT,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beanconqueror_grinders (
  id TEXT PRIMARY KEY,
  name TEXT,
  notes TEXT,
  bc_archived INTEGER NOT NULL DEFAULT 0,
  bc_created_at TEXT,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beanconqueror_brews (
  id INTEGER PRIMARY KEY,
  bc_created_at TEXT NOT NULL,
  bean_id TEXT REFERENCES beanconqueror_beans(id),
  preparation_id TEXT REFERENCES beanconqueror_methods(id),
  mill_id TEXT REFERENCES beanconqueror_grinders(id),
  grind_setting TEXT,
  ground_coffee_g REAL,
  brew_temperature REAL,
  bean_type TEXT,
  grind_speed_rpm REAL,
  grind_time TEXT,
  profile TEXT,
  preparation_tools TEXT,
  temperature_time TEXT,
  brew_time TEXT,
  bloom_time TEXT,
  first_drip_time TEXT,
  water_amount_g REAL,
  coffee_type TEXT,
  coffee_concentration TEXT,
  rating REAL,
  notes TEXT,
  beverage_quantity REAL,
  tds_percent REAL,
  extraction_yield_percent REAL,
  brew_ratio TEXT,
  bean_age_days INTEGER,
  bc_archived INTEGER NOT NULL DEFAULT 0,
  water TEXT,
  imported_at TEXT NOT NULL
);

-- COALESCE(bean_id, '') so NULL-bean_id brews still dedupe by bc_created_at:
-- SQLite's plain UNIQUE(...) treats NULL <> NULL, letting duplicates through otherwise.
CREATE UNIQUE INDEX IF NOT EXISTS beanconqueror_brews_identity
ON beanconqueror_brews (bc_created_at, COALESCE(bean_id, ''));

-- Public short links for sharing long, filter-heavy views (see shortLinks.ts
-- for the TTL/row-cap policy that keeps this table bounded).
CREATE TABLE IF NOT EXISTS short_links (
  code TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_short_links_last_used ON short_links(last_used_at);
`;
