<script lang="ts">
  import { tick } from 'svelte';
  import { hostOf, type Candidate, type SuggestResponse } from '$lib/imageSuggest';
  import { backdrop } from '$lib/imageBackdrop';
  import { formatDate } from '$lib/formatDate';

  // Image Suggest (spec 2026-10-06-image-suggest-design.md), shared by the coffee and gear forms: the Suggest
  // button and its results dialog. Inline state, never in the URL. The parent owns the fields: body() reads
  // them when a search starts, matching() describes the item as typed, onpick stages the pick (the dialog then
  // closes), onsite stages a site typed via "change" once a search on it worked.
  let { endpoint, body, matching, siteLabel, setSiteText = 'set roaster site', disabled, onpick, onsite }: {
    endpoint: string;
    body: () => Record<string, unknown>;
    matching: () => string[];
    siteLabel: string;
    setSiteText?: string;
    disabled: boolean;
    onpick: (c: Candidate, r: SuggestResponse) => void;
    onsite?: (site: string) => void;
  } = $props();

  let suggesting = $state(false);
  let suggestResult = $state<SuggestResponse | null>(null);
  let siteEditing = $state(false);
  let siteInput = $state('');
  let lastSite: string | undefined;
  // Results live in a modal <dialog>; closing it (✕, Esc, backdrop, None of
  // these, a pick) drops the result, and a reply that lands after a close or
  // a newer search is ignored (searchId).
  let suggestDialog: HTMLDialogElement;
  let suggestButton: HTMLButtonElement;
  let searchId = 0;
  const failedResult = (note: string): SuggestResponse => ({ status: 'failed', site: null, storedSite: null, candidates: [], notes: [note] });

  // Backdrop per candidate image (POST /api/coffees/image-fill), keyed by URL.
  let fills = $state<Record<string, string>>({});
  const requested = new Set<string>();
  async function loadFill(url: string) {
    if (!/^https?:\/\//i.test(url) || requested.has(url)) return;
    requested.add(url);
    const res = await fetch('/api/coffees/image-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (typeof data?.fill === 'string') fills[url] = data.fill;
  }

  // site: a site typed via "change" (or its Retry); undefined = the usual search.
  async function runSuggest(site?: string) {
    const id = ++searchId;
    lastSite = site;
    siteEditing = false;
    suggesting = true;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(site ? { ...body(), site } : body())
      });
      const data = await res.json().catch(() => null);
      if (id !== searchId) return;
      // SvelteKit's own errors (e.g. 500) come back as { message }.
      const r: SuggestResponse = res.ok && data?.status ? data : failedResult(data?.error ?? data?.message ?? `Search failed (HTTP ${res.status})`);
      suggestResult = r;
      // Only "change" replaces a stored site: stage the typed site (as the
      // endpoint normalized it) once a search on it worked.
      if (site && r.site && (r.status === 'ok' || r.status === 'empty')) onsite?.(r.site);
      for (const c of r.candidates) loadFill(c.image);
    } catch {
      if (id === searchId) suggestResult = failedResult("Couldn't reach the server");
    } finally {
      if (id === searchId) suggesting = false;
    }
  }

  // The item being matched, as typed at the moment Suggest is pressed.
  let matchingLines = $state<string[]>([]);
  function openSuggest() {
    matchingLines = matching();
    suggestDialog.showModal();
    runSuggest();
  }

  async function suggestClosed() {
    searchId++;
    suggesting = false;
    suggestResult = null;
    siteEditing = false;
    // Suggest is still disabled until Svelte flushes `suggesting = false`.
    await tick();
    suggestButton.focus();
  }

  function changeSite(e: KeyboardEvent) {
    // Enter here must rerun Suggest, never submit (stage) the parent form.
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (siteInput.trim()) runSuggest(siteInput.trim());
  }
</script>

<button class="button button-secondary" type="button" bind:this={suggestButton} disabled={disabled || suggesting} onclick={openSuggest}>Suggest</button>
<dialog
  class="suggest-dialog"
  aria-labelledby="suggest-title"
  bind:this={suggestDialog}
  onclose={suggestClosed}
  onclick={(e) => e.target === suggestDialog && suggestDialog.close()}
>
  <div class="suggest-sheet">
    <header class="suggest-header">
      <h2 id="suggest-title">Suggested images</h2>
      <button type="button" class="suggest-close" aria-label="Close" onclick={() => suggestDialog.close()}>✕</button>
    </header>
    <div class="text-muted suggest-matching">
      {#each matchingLines as text, i (i)}<p>{text}</p>{/each}
    </div>
    <div class="suggest-body">
      {#if suggesting}
        <p class="text-muted fill-note suggest-status" role="status"><span class="spinner" aria-hidden="true"></span>Searching…</p>
      {:else if suggestResult}
        {@const r = suggestResult}
        {@const closest = r.candidates.find((x) => x.closest)}
        <p class="text-muted fill-note">
          {r.site ? `Searching ${hostOf(r.site)}` : 'Searching the web'} ·
          <button
            type="button"
            class="suggest-change"
            onclick={() => {
              siteEditing = true;
              siteInput = r.site ?? '';
            }}>{r.site ? 'change' : setSiteText}</button
          >
        </p>
        {#if siteEditing}
          <!-- No name: never submitted. type="text" (not url), so a bare host
               neither fails the form's constraint validation nor blocks Save. -->
          <div class="inline-row">
            <input type="text" inputmode="url" aria-label={siteLabel} placeholder="roaster.com" bind:value={siteInput} onkeydown={changeSite} />
            <button class="button button-secondary" type="button" disabled={!siteInput.trim()} onclick={() => runSuggest(siteInput.trim())}>Search</button>
          </div>
        {/if}
        {#if r.status === 'ok'}
          <div class="suggest-list">
            {#each r.candidates as c (c.image)}
              <button type="button" class="suggest-pick" onclick={() => { onpick(c, r); suggestDialog.close(); }}>
                <span class="suggest-image">
                  <img src={c.image} alt="" style:background-color={backdrop(fills[c.image])} />
                  {#if c === closest}
                    <span class="badge">Closest to roast date</span>
                  {/if}
                </span>
                <span class="suggest-text">
                  <span class="suggest-title">{c.pageTitle}</span>
                  <span class="text-muted suggest-meta">{hostOf(c.pageUrl)}{c.published ? ` · ${formatDate(c.published)}` : ''}</span>
                  {#if c.excerpt}
                    <span class="text-muted suggest-excerpt">{c.excerpt}</span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        {:else if r.status === 'empty'}
          <p class="fill-note">{r.site ? `No images found on ${hostOf(r.site)}` : 'No images found'}</p>
        {:else if r.status === 'failed'}
          <p class="fill-note">Search failed</p>
        {:else}
          <p class="fill-note">Image search isn't set up</p>
        {/if}
        {#each r.notes as note, i (i)}
          <p class="text-muted fill-note">{note}</p>
        {/each}
      {/if}
    </div>
    {#if suggestResult && !suggesting}
      <footer class="suggest-footer">
        <div class="suggest-actions" data-button-row>
          {#if suggestResult.status === 'failed'}
            <button class="button button-secondary" type="button" onclick={() => runSuggest(lastSite)}>Retry</button>
          {/if}
          <button class="button button-secondary" type="button" onclick={() => suggestDialog.close()}>None of these</button>
        </div>
      </footer>
    {/if}
  </div>
</dialog>

<style>
  .fill-note {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  .inline-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: stretch;
  }
  .inline-row input {
    flex: 1;
    min-width: 10rem;
  }
  .inline-row .button {
    flex-shrink: 0;
    white-space: nowrap;
  }
  /* Image Suggest's results dialog: a centered box on wide screens, a
     full-screen sheet on phones. The sheet fills the dialog (no dialog
     padding), so a click on the dialog element itself is a backdrop click.
     Header and footer stay put; the body scrolls. */
  .suggest-dialog {
    width: min(52rem, 100% - 2rem);
    max-height: 85dvh;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
  }
  .suggest-dialog[open] {
    display: flex;
  }
  /* Phone landscape (333px tall): 85dvh leaves room for barely one row. */
  @media (max-height: 500px) {
    .suggest-dialog {
      max-height: calc(100dvh - 1rem);
    }
  }
  .suggest-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .suggest-sheet {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .suggest-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }
  .suggest-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .suggest-matching {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    font-size: 1rem;
    overflow-wrap: break-word;
  }
  .suggest-matching p {
    margin: 0;
  }
  .suggest-matching p:first-child {
    font-weight: 600;
  }
  .suggest-close {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .suggest-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4) var(--space-4);
  }
  @media (max-width: 640px) {
    .suggest-dialog {
      width: 100dvw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    .suggest-sheet {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
  }
  .suggest-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .suggest-change {
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  /* Candidate cards: one per row on phones, two in the wider dialog. */
  .suggest-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  @media (min-width: 641px) {
    .suggest-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  /* The whole card is the pick button: a large image on top, so the bag
     label is legible (user, 2026-10-06), then the text. */
  .suggest-pick {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  /* A square, full card width: the shape the saved image gets as a
     thumbnail (user, 2026-10-06; taller cards are fine). */
  .suggest-image {
    position: relative;
    flex: none;
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  .suggest-image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--radius);
  }
  /* Phone landscape (333px tall): the body shows ~150px, so a full-width
     square can't fit; cap it so a whole image fits on screen. */
  @media (max-height: 500px) {
    .suggest-image {
      width: 9rem;
      align-self: center;
    }
  }
  /* Over the image's top-left corner: opaque sunflower with dark text, so it
     reads over any image in both themes (contrast checked in test:ui). */
  .suggest-image .badge {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
    background: var(--color-sunflower);
    color: var(--color-sunflower-text);
  }
  .suggest-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    min-width: 0;
    font-size: 0.85rem;
  }
  .suggest-title,
  .suggest-excerpt {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  .suggest-title {
    font-weight: 600;
  }
  .suggest-excerpt {
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
  .suggest-footer {
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .suggest-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .suggest-actions .button {
    margin: 0;
  }
  @media (max-width: 640px) {
    .suggest-actions .button {
      flex: 1 1 auto;
      text-align: center;
    }
  }
  @media (max-width: 480px) {
    .suggest-change {
      min-width: 44px;
      min-height: 44px;
    }
  }
</style>
