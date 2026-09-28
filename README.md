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

One app. Public pages are read-only for everyone; write actions appear
inline on the same pages once the site owner signs in — there is no
separate "Manage" destination.

- **Public** — `/` (Coffees), `/coffees/[slug]`, `/on-deck`,
  `/subscriptions`. Read-only for anonymous visitors.
- **`/login`** — the site owner signs in with a single shared password;
  repeated failed attempts from the same IP (5) trigger a 15-minute lockout
  ("Too many attempts. Try again later.").
  On success, a signed session cookie (`bt_session`, 24h expiry) unlocks an
  "Edit" toggle on the Coffees, coffee detail, and Subscriptions pages —
  editable fields, status actions (Open/Freeze/Thaw/Archive/Restore),
  delete, and inline "+ Add" controls appear in place. No page or route is
  network-gated; authentication is entirely owned by the app itself (see
  `docs/superpowers/specs/2026-09-18-auth-and-inline-editing-design.md`).

Requires two additional environment variables beyond `DB_PATH`:

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD_HASH` | `<saltHex>:<hashHex>`, produced by `node scripts/hash-password.ts <password>` |
| `SESSION_SECRET` | A long random string, generated once — e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Both are secrets — never commit real values. For local dev, export them in
your shell before running the server. For a deployment, set them in its
environment.

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

## Continuous Integration & Deployment

- Every push and PR runs the `CI` workflow (`npm test`, `npm run build`).
- Every commit on `main` must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, etc.) — enforced locally by a Husky `commit-msg`
  hook and backstopped in CI. This drives fully automatic semantic
  versioning: once CI passes on `main`, `semantic-release` computes the next
  version from the commits since the last release and, if one is warranted,
  cuts a git tag, a GitHub Release, and a `CHANGELOG.md` entry.
- `semantic-release` authenticates as a dedicated GitHub App
  (`RELEASE_APP_ID` + `RELEASE_APP_PRIVATE_KEY` repo secrets), not the
  workflow's built-in `GITHUB_TOKEN` — GitHub does not raise `release:
  published` for events created by `GITHUB_TOKEN`, which would otherwise
  leave the Docker publish step permanently, silently unreachable.
- A published release triggers a Docker image build (targeting the server's
  `linux/arm64`, via `buildx`/QEMU emulation) pushed to
  `ghcr.io/eric-maydeck/bean-tracker`.
- `@semantic-release/git` pushes the version-bump commit directly to `main`.
  If branch protection ever requires PRs on this repo, the release App will
  need an explicit bypass allowance for that push — otherwise every release
  starts failing at that step.
