# Bean Tracker

A coffee-bean tracking web app: replaces a spreadsheet-based workflow with a
single SvelteKit site that tracks what's in rotation, suggests what to drink
next based on an urgency/drink-window algorithm, and offers a clean public
showcase of the collection.

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
  network-gated; authentication is entirely owned by the app itself.

## Requirements to deploy

Environment variables (secrets and the data path; never commit real values):

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD_HASH` | Required. `<saltHex>:<hashHex>`, produced by `node scripts/hash-password.ts <password>` |
| `SESSION_SECRET` | Required. A long random string, generated once, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TAVILY_API_KEY` | Optional. Tavily web search for the coffee form's image Suggest; without it Suggest searches only the roaster's Shopify store |
| `DB_PATH` | SQLite file path (default `data/bean-tracker.db`) |
| `CONFIG_PATH` | Config file path (default `./config.yaml`) |

Everything else is in an optional `config.yaml`. Without it the site is named
"Bean Tracker" and shows no contact email.

```yaml
hosts:
  # The first entry is the default for any host not listed, and the canonical domain.
  - domain: example.com
    contactName: Jane Doe
    contactEmail: jane@example.com
  - domain: coffee.example.org
    contactName: Jane Doe
    contactEmail: coffee@example.org
imageSuggest:
  providers: shopify,tavily   # provider order (default)
tavily:
  monthlyLimit: 1400          # Tavily calls per rolling 31 days (default)
```

Mount a persistent volume for the data directory (the database and the
`data/images/` copies). The published image is
`ghcr.io/eric-maydeck/bean-tracker`. Ratings use a 10-point scale.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (`adapter-node`) |
| `npm run preview` | Preview a production build locally |
| `npm run test` | Full test suite (unit + route/script tests) |
| `npm run migrate -- --file "<path>" --dry-run` | Parse an xlsx export and print row counts without writing |
| `npm run migrate -- --file "<path>" [--db <path>] [--clear]` | Import coffees/subscriptions from an xlsx export into the SQLite database |
| `npx vite-node --config scripts/vite-node.config.mjs scripts/suggest-compare.ts <db copy> [n] [out]` | Image Suggest results per provider, side by side (on a DB copy) |

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
  versioning: once CI passes on the `release` branch, `semantic-release` computes the next
  version from the commits since the last release and, if one is warranted,
  cuts a git tag, a GitHub Release, and a `CHANGELOG.md` entry.
- Pushing to `main` does not release or deploy. Promote with
  `git push origin main:release` (fast-forward only; its pre-push gate runs the full prod UI
  suite). After a release, `.github/back-merge-release.sh` merges `release` back into `main`
  so the bot's `chore(release)` commit is on both and the next promotion fast-forwards.
- `semantic-release` authenticates as a dedicated GitHub App
  (`RELEASE_APP_ID` + `RELEASE_APP_PRIVATE_KEY` repo secrets), not the
  workflow's built-in `GITHUB_TOKEN` — GitHub does not raise `release:
  published` for events created by `GITHUB_TOKEN`, which would otherwise
  leave the Docker publish step permanently, silently unreachable.
- A published release triggers a Docker image build (`linux/arm64`, via `buildx`/QEMU emulation) pushed to
  `ghcr.io/eric-maydeck/bean-tracker`.
- `@semantic-release/git` pushes the version-bump commit directly to `release`, and the
  back-merge pushes to `main`. If branch protection ever requires PRs on either branch, the
  release App will need an explicit bypass allowance for those pushes — otherwise every release
  starts failing at that step.
