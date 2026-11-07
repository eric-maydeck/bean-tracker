# Coffee Image Search — Criteria & Lessons Learned

Reference doc for the "Suggest" button feature. Captures the
rules used for a manual one-time image-population pass (2026-09-20) so the
same logic can be turned into an automated feature later, rather than
re-deriving it from scratch.

## The rules, in priority order

1. **Specific bag art first.** The exact label/bag image for that coffee,
   not a generic stock photo.
2. **Match the vintage when it matters.** If a roaster has sold the same
   coffee name more than once (different years) and multiple bag-art
   images exist, prefer the one matching the roast date's year. In
   practice this is often unsatisfiable — most small-roaster sites only
   keep their *current* listing live, with no archive of prior years'
   art (see "Failure modes" below).
3. **Roaster logo as fallback.** If no bag art exists for that specific
   coffee, fall back to the roasting company's logo.
4. **Source preference: roaster's own site first.** Their shop/product
   page's own image, not a screenshot or reupload. If unavailable, other
   sources (e.g. beanhoard.com) are acceptable.
5. **Roughly square.** Images are used as square thumbnails — prefer
   images that aren't extremely wide/panoramic, so they don't look
   distorted when cropped to a square. Note: neither web search nor
   WebFetch can confirm actual pixel dimensions of a remote image file —
   only page-level plausibility (e.g. "this looks like a product photo,
   not a banner"). A real "Suggest" feature would need to fetch the image
   bytes and check dimensions itself, or leave that check to the "Preview"
   step for a human to eyeball.

## What worked well (pilot batch, 9 coffees, 2026-09-20)

- Most small/independent roasters run Shopify-based storefronts, whose
  product images live at a predictable, directly-fetchable CDN URL
  pattern: `https://<shop-domain>/cdn/shop/files/<name>.{jpg,png}?v=<cachebust>`
  (or `/cdn/shop/products/...` on older-style stores). These URLs work
  as direct `<img src>` values with no further processing.
- Product-page URLs sometimes need to be guessed from a slug pattern
  (`/products/<coffee-name-slugified>`) when a page is too new to be
  search-indexed yet — worth trying before giving up.
- 6 of 9 pilot coffees got a confident, exact bag-art match this way.

## Lessons from human review of the pilot (2026-09-20)

The user reviewed all 9 pilot results and corrected 3 of them — validates
doing a pilot at all; these would have been wrong if applied blind:

- **Product pages have multiple images — don't grab the wrong one.** A
  product page's *first* or *most prominent* image is often a lifestyle/
  beans close-up shot, not the bag/label mockup. The real bag art is
  frequently a separate image on the same page, sometimes with a filename
  hint like `mock_light_...` or containing "mock"/"mockup"/"bag". A
  "Suggest" feature needs to specifically identify the label/mockup
  image among several candidates on a product page, not just take
  whichever loads first.
- **Check for a dedicated crop/vintage archive before falling back to a
  logo.** One roaster (Scenery) keeps a "coffee archive" blog separate
  from their live shop, with crop-year-specific product posts and their
  own bag art (e.g. a URL literally containing the crop year,
  `ethiopia_worka_chelbesa_fw_2026_shopify.png`) — well past when the
  coffee left the main shop. Worth searching `<roaster domain>` +
  "archive" or "crop" alongside the coffee name before concluding no
  year-matched art exists and falling back to a logo.
- **Try the roaster's full/formal name, not just the DB's short name.**
  "Lume" alone matched several unrelated companies; the real business is
  "Lume Coffee Roasters" — the DB's `roaster` field is often an informal
  shorthand the user typed, not the legal/formal name a search needs.
  Worth trying both the literal DB value and reasonable
  expansions/variations before giving up on a roaster.
- **When multiple logo images exist, prefer the current, higher-quality
  one.** For H&S, a better/more current logo existed at a different URL
  than the first one found — sites sometimes have older, lower-res, or
  outdated brand assets still live alongside current ones.

## Failure modes to design around

- **Protocol-relative URLs.** Shopify CDN URLs are often returned as
  `//domain.com/...` (no scheme) — must prepend `https:` before storing
  or rendering, or the browser resolves them against the wrong page
  protocol.
- **Sold-out / rotated coffees.** The product page and its image often
  stay live even after a coffee sells out and drops from the shop's main
  collection — findable via search/archived blog posts, but not always
  linked from current navigation.
- **Ambiguous roaster names.** Short or generic names (e.g. "Lume",
  "H&S", "GWO") can match multiple unrelated businesses. Auto-search
  cannot safely guess which one — needs either a stored per-roaster
  website URL (see the datalist-backed roaster field already in
  `CoffeeForm.svelte`, which could gain a companion "roaster website"
  value) or a human confirmation step before trusting a match.
- **Multi-variety farms.** A single farm/origin can produce several
  distinct lots (e.g. different processing or varieties) in one season.
  A found image can be right about the farm and origin while still being
  the wrong specific lot. Hard to fully automate away — worth flagging
  low-confidence matches for human review rather than auto-applying them.
- **Old-vintage-only art.** When rule #2 (year-matching) can't be
  satisfied because no archive exists, falling back to the roaster's
  logo is safer than presenting a wrong-year bag as if it were current.

## Toward the "Suggest" button feature

The user's proposed UI (next to the existing `image_url` field in
`CoffeeForm.svelte:144-147`, which is currently a plain `type="url"` text
input with no preview):

- **Preview** — show the current `image_url` value as an image, without
  saving. Doesn't need any search logic, just an `<img>` bound to the
  current (unsaved) field value.
- **Suggest** — run the search logic above (roaster's own site → bag art
  → logo fallback → beanhoard.com fallback) and populate the field with
  a found URL, without saving it yet (so Preview + manual override still
  work before committing).
- **Clear** — empty the field (and, if saved afterward, removes the
  image from that coffee's row).

Not designed yet: whether "Suggest" runs synchronously inline (the user
waits for search to complete) or needs a loading/async UX; how
low-confidence matches are surfaced (e.g. a confidence badge, or simply
trusting the human to hit Preview and judge for themselves); whether a
"roaster website" field should be added to reduce the ambiguous-name
failure mode. Needs its own design pass when the user is ready to
build it — this doc exists so that pass starts from real findings, not a
blank page.
