<script lang="ts" module>
  // Required by the API terms. ponytail: copy of beanBaseCreditUrl (server-only module); keep in step.
  export const CREDIT_URL = 'https://www.loffeelabs.com';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { BeanCard, BeanSearch } from '#lib/server/beanBase.ts';
  import { formatDate } from '#lib/formatDate.ts';
  import SuggestSheet from './SuggestSheet.svelte';
  import Icon from './Icon.svelte';

  // "Search Loffee Labs": the Bean Base twin of ImageSuggest (same dialog shell, same flow). The parent owns the
  // fields: body() reads the roaster and coffee name when a search starts, matching() describes them as typed,
  // onpick stages the picked card. Inline state, never in the URL.
  let { body, matching, disabled, onpick }: {
    body: () => { roaster: string; coffee_name: string; roast_date?: string | null; product_url?: string | null };
    matching: () => string[];
    disabled: boolean;
    onpick: (card: BeanCard) => void;
  } = $props();

  let searching = $state(false);
  let result = $state<BeanSearch | null>(null);
  let typedRoaster = $state('');
  let roasterEditing = $state(false);
  let roasterInput = $state('');
  let typedTerm = $state('');
  let termEditing = $state(false);
  let termInput = $state('');
  let sheet: SuggestSheet;
  let button: HTMLButtonElement;
  let searchId = 0;
  // Overrides from "change" (or a tapped closest name) for this dialog session; absent = as typed on the form.
  // Each survives a rerun that changes the other.
  let override: { roaster?: string; term?: string } = {};

  async function run(patch: { roaster?: string; term?: string } = {}) {
    const id = ++searchId;
    override = { ...override, ...patch };
    roasterEditing = false;
    termEditing = false;
    searching = true;
    try {
      const b = body();
      typedRoaster = override.roaster ?? b.roaster;
      typedTerm = override.term ?? b.coffee_name.trim();
      const res = await fetch('/api/coffees/bean-base-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...b, roaster: typedRoaster, coffee_name: typedTerm })
      });
      const data = await res.json().catch(() => null);
      if (id !== searchId) return;
      result = res.ok && data?.status ? data : { status: 'failed' };
    } catch {
      if (id === searchId) result = { status: 'failed' };
    } finally {
      if (id === searchId) searching = false;
    }
  }

  let matchingLines = $state<string[]>([]);
  // The header's first line follows the current search (Loffee Labs' roaster name once matched, the term or "any"),
  // not the form as it was when the dialog opened; the form's second line (process, roast date) stays.
  const headerLines = $derived(
    typedRoaster
      ? [`${result?.status === 'ok' ? result.roaster : typedRoaster} · ${typedTerm || 'any'}`, ...matchingLines.slice(1)]
      : matchingLines
  );
  function open() {
    matchingLines = matching();
    override = {};
    sheet.show();
    run();
  }

  async function closed() {
    searchId++;
    searching = false;
    result = null;
    roasterEditing = false;
    termEditing = false;
    override = {};
    await tick();
    button.focus();
  }

  // Enter here reruns the search, never submits the parent form. A blank term is allowed (any coffee).
  const changeKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (roasterInput.trim()) run({ roaster: roasterInput.trim() });
  };
  const termKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    run({ term: termInput.trim() });
  };

  const lines = (f: BeanCard['fields']) =>
    [
      [f.origin, f.region],
      [f.processing, f.variety],
      [f.tasting_notes],
      [f.elevation, f.harvest_time]
    ].map((l) => l.filter(Boolean).join(' · '));
</script>

<button class="button button-secondary" type="button" bind:this={button} disabled={disabled || searching} onclick={open}>Search Loffee Labs</button>
<SuggestSheet title="Loffee Labs matches" matching={headerLines} onclose={closed} showFooter={!!result && !searching} bind:this={sheet}>
  {#if searching}
    <p class="text-muted fill-note suggest-status" role="status"><span class="spinner" aria-hidden="true"></span>Searching…</p>
  {:else if result}
    {@const r = result}
    {#if r.status === 'ok'}
      <p class="text-muted fill-note">
        <strong class="search-label">Roaster:</strong> <span class="search-value">{r.roaster}</span> ·
        <button type="button" class="suggest-change" onclick={() => { roasterEditing = true; termEditing = false; roasterInput = r.roaster; }}>change</button>
      </p>
      <p class="text-muted fill-note">
        <strong class="search-label">Coffee:</strong> <span class="search-value">{typedTerm || 'any'}</span> ·
        <button type="button" class="suggest-change" onclick={() => { termEditing = true; roasterEditing = false; termInput = typedTerm; }}>change</button>
      </p>
      {#if r.fallback}
        <p class="text-muted fill-note">No match for "{typedTerm}"; showing all {r.roaster} beans</p>
      {/if}
    {/if}
    {#if roasterEditing}
      <!-- No name: never submitted. -->
      <div class="inline-row">
        <input type="text" aria-label="Loffee Labs roaster" bind:value={roasterInput} onkeydown={changeKey} />
        <button class="button button-secondary" type="button" disabled={!roasterInput.trim()} onclick={() => run({ roaster: roasterInput.trim() })}>Search</button>
      </div>
    {/if}
    {#if termEditing}
      <div class="inline-row">
        <input type="text" aria-label="Loffee Labs search term" bind:value={termInput} onkeydown={termKey} />
        <button class="button button-secondary" type="button" onclick={() => run({ term: termInput.trim() })}>Search</button>
      </div>
    {/if}
    {#if r.status === 'ok'}
      {#if r.beans.length}
        <div class="suggest-list">
          {#each r.beans as c (c.id)}
            <button type="button" class="suggest-pick" onclick={() => { onpick(c); sheet.close(); }}>
              <!-- Every card gets the square, so cards in a row match (a placeholder when there's no photo). -->
              <span class="suggest-image">
                {#if c.image}
                  <img src={c.image} alt="" />
                {:else}
                  <span class="no-photo"><Icon name="coffee" /><span>No photo available</span></span>
                {/if}
                {#if c.closest}<span class="badge">Closest to roast date</span>{/if}
                {#if c.soldout}<span class="badge badge-sold">Sold out</span>{/if}
              </span>
              <span class="suggest-text">
                <span class="suggest-title">{c.name}</span>
                {#each lines(c.fields) as line, i (i)}
                  {#if line}<span class={i === 2 ? 'text-muted suggest-excerpt' : 'text-muted suggest-meta'}>{line}</span>{/if}
                {/each}
                <span class="text-muted suggest-meta">Added {formatDate(c.date)}</span>
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="fill-note">No beans from {r.roaster} in Loffee Labs</p>
      {/if}
    {:else if r.status === 'roaster'}
      <p class="fill-note">No Loffee Labs roaster matches "{typedRoaster}"</p>
      {#if r.closest.length}
        <p class="text-muted fill-note">Closest:</p>
        <div class="inline-row">
          {#each r.closest as name (name)}
            <button class="button button-secondary" type="button" onclick={() => run({ roaster: name })}>{name}</button>
          {/each}
        </div>
      {/if}
    {:else if r.status === 'failed'}
      <p class="fill-note">Search failed</p>
    {:else}
      <p class="fill-note">Loffee Labs search isn't set up</p>
    {/if}
    <p class="text-muted fill-note"><a href={CREDIT_URL} target="_blank" rel="noopener noreferrer">From Loffee Labs Bean Base</a></p>
  {/if}
  {#snippet footer()}
    {#if result?.status === 'failed'}
      <button class="button button-secondary" type="button" onclick={() => run()}>Retry</button>
    {/if}
    <button class="button button-secondary" type="button" onclick={() => sheet.close()}>None of these</button>
  {/snippet}
</SuggestSheet>

<style>
  /* The search lines: bold label, full-strength value on the muted line; "change" stays the accent link. */
  .search-label {
    color: var(--color-label);
  }
  .search-value {
    color: var(--color-text);
  }
  /* Badges over the image's top-left corner: Closest first, Sold out under it. */
  .suggest-image :global(.badge-sold) {
    top: calc(var(--space-1) + 1.5rem);
  }
  .no-photo {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 1rem;
    font-weight: 600;
  }
  .no-photo :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
    opacity: 0.6;
  }
</style>
