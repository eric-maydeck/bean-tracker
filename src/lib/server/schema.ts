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
  slug TEXT,
  opened_date TEXT,
  drank INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'backlog',
  moved_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  roaster_service TEXT NOT NULL,
  subscription_name TEXT,
  price REAL,
  bag_count REAL,
  amount_per_bag_g REAL,
  purchased INTEGER NOT NULL DEFAULT 0
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
`;
