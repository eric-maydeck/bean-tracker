# Bean Tracker

A coffee-bean tracking web app: replaces a spreadsheet-based workflow with a
single SvelteKit site that tracks what's in rotation, suggests what to drink
next based on an urgency/drink-window algorithm, and offers a clean public
showcase of the collection.

Full design rationale lives in
[`docs/superpowers/specs/2026-09-17-coffee-tracker-web-app-design.md`](docs/superpowers/specs/2026-09-17-coffee-tracker-web-app-design.md);
the v1 build plan is in
[`docs/superpowers/plans/2026-09-17-coffee-tracker-v1.md`](docs/superpowers/plans/2026-09-17-coffee-tracker-v1.md).

## Stack

- [SvelteKit](https://kit.svelte.dev/) 2 + Svelte 5, TypeScript, `adapter-node`
- Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) — no ORM, no native module to cross-compile
- [Vitest](https://vitest.dev/) for unit and script tests
- Requires **Node.js ≥ 22.5**

## Getting started

```bash
npm install
npm run dev
```

The dev server runs against a local SQLite file at `data/bean-tracker.db`
(created automatically on first run, schema applied on connect). Override the
path with the `DB_PATH` environment variable.

## Routes

One app, two route namespaces, access controlled at the network edge rather
than in application code:

- **Public** (`/`, `/coffees/[id]`) — read-only showcase of the collection.
  No write actions live here.
- **Private** (`/manage/**`) — the working dashboard (urgency-sorted,
  "suggested next"), the add/edit coffee form, the archive (with undo), and
  subscriptions. In production this path is meant to sit behind an access-control
  policy at the edge — the app itself does no authentication.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (`adapter-node`) |
| `npm run preview` | Preview a production build locally |
| `npm run test` | Full test suite (unit + route/script tests) |
| `npm run migrate -- --file "<path>" --dry-run` | Parse an xlsx export and print row counts without writing |
| `npm run migrate -- --file "<path>" [--db <path>] [--clear]` | Import coffees/subscriptions from an xlsx export into the SQLite database |

### Data migration

`scripts/migrate.ts` reads a spreadsheet export (`Bean backlog`,
`Finished beans`, and `Subscriptions` sheets) and seeds the database. Always
dry-run first to sanity-check row counts before writing:

```bash
npm run migrate -- --file "/path/to/export.xlsx" --dry-run
npm run migrate -- --file "/path/to/export.xlsx" --db data/bean-tracker.db
```

Re-running the real migration against a database that already has data is
refused by default (it would duplicate every row) — pass `--clear` to wipe
existing coffees/subscriptions first:

```bash
npm run migrate -- --file "/path/to/export.xlsx" --db data/bean-tracker.db --clear
```

## Testing

```bash
npm run test
```

Covers the urgency/drink-window algorithm (ported line-for-line from the
original spreadsheet formula, including frozen-period edge cases), the
data-access layer, form validation, and the migration script.
