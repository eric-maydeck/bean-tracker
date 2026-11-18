<script lang="ts">
  import { tick } from 'svelte';
  import { hostOf, type Candidate, type SuggestResponse } from '#lib/imageSuggest.ts';
  import { backdrop } from '#lib/imageBackdrop.ts';
  import { formatDate } from '#lib/formatDate.ts';
  import SuggestSheet from './SuggestSheet.svelte';

  // Image Suggest, shared by the coffee and gear forms: the Suggest
  // button and its results dialog. Inline state, never in the URL. The parent owns the fields: body() reads
  // them when a search starts, matching() describes the item as typed, onpick stages the pick (the dialog then
  // closes), onsite stages a site typed via "change" once a search on it worked.
  let { endpoint, body, matching, siteLabel, setSiteText = 'set roaster site', label = 'Suggest', disabled, onpick, onsite }: {
    endpoint: string;
    body: () => Record<string, unknown>;
    matching: () => string[];
    siteLabel: string;
    setSiteText?: string;
    label?: string;
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
  let sheet: SuggestSheet;
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
    sheet.show();
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

<button class="button button-secondary" type="button" bind:this={suggestButton} disabled={disabled || suggesting} onclick={openSuggest}>{label}</button>
<SuggestSheet title="Suggested images" matching={matchingLines} onclose={suggestClosed} showFooter={!!suggestResult && !suggesting} bind:this={sheet}>
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
              <button type="button" class="suggest-pick" onclick={() => { onpick(c, r); sheet.close(); }}>
                <span class="suggest-image">
                  <img src={c.image} alt="" style:background-color={backdrop(fills[c.image])} />
                  {#if c === closest}
                    <span class="badge">Closest to roast date</span>
                  {/if}
                </span>
                <span class="suggest-text">
                  <span class="suggest-title">{c.pageTitle}</span>
                  <span class="text-muted suggest-meta">{hostOf(c.pageUrl)}{c.published ? ` · ${formatDate(c.published)}` : ''}{c.provider === 'beanbase' ? ' · via Loffee Labs' : ''}</span>
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
  {#snippet footer()}
    {#if suggestResult?.status === 'failed'}
      <button class="button button-secondary" type="button" onclick={() => runSuggest(lastSite)}>Retry</button>
    {/if}
    <button class="button button-secondary" type="button" onclick={() => sheet.close()}>None of these</button>
  {/snippet}
</SuggestSheet>
