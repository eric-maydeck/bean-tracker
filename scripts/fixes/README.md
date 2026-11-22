# scripts/fixes

One-off data fixes for one person's database. Not run at boot.

- Name: `<date>-<name>.ts`, taking one or more DB paths: `node scripts/fixes/<file>.ts <db path>...`.
- Try it on a prod copy first, then apply it to the real DB with a backup taken.
- Guard every row (match the old value, and the roaster for id-keyed fixes) so a rerun changes nothing.
- A fix that is wrong for every database (format standardisation) is not a script: make it an idempotent boot migration in `applySchema` (`src/lib/server/db.ts`).
- `src/lib/server/legacyFixes.ts` is frozen history; don't add to it.
