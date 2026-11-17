<script lang="ts" module>
  // Required by the API terms. ponytail: copy of beanBaseCreditUrl (server-only module); keep in step.
  export const CREDIT_URL = 'https://www.loffeelabs.com';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { BeanCard, BeanSearch } from '$lib/server/beanBase';
  import { formatDate } from '$lib/formatDate';
  import SuggestSheet from './SuggestSheet.svelte';

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
  let sheet: SuggestSheet;
  let button: HTMLButtonElement;
  let searchId = 0;
  let lastRoaster: string | undefined;

  // roaster: one typed via "change" or a tapped closest name; undefined = the roaster as typed on the form.
  async function run(roaster?: string) {
    const id = ++searchId;
    lastRoaster = roaster;
    roasterEditing = false;
    searching = true;
    try {
      const b = body();
      typedRoaster = roaster ?? b.roaster;
      const res = await fetch('/api/coffees/bean-base-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...b, roaster: typedRoaster })
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
  function open() {
    matchingLines = matching();
    sheet.show();
    run();
  }

  async function closed() {
    searchId++;
    searching = false;
    result = null;
    roasterEditing = false;
    await tick();
    button.focus();
  }

  function changeKey(e: KeyboardEvent) {
    // Enter here reruns the search, never submits the parent form.
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (roasterInput.trim()) run(roasterInput.trim());
  }

  const lines = (f: BeanCard['fields']) =>
    [
      [f.origin, f.region],
      [f.processing, f.variety],
      [f.tasting_notes],
      [f.elevation, f.harvest_time]
    ].map((l) => l.filter(Boolean).join(' · '));
</script>

<button class="button button-secondary" type="button" bind:this={button} disabled={disabled || searching} onclick={open}>Search Loffee Labs</button>
<SuggestSheet title="Loffee Labs matches" matching={matchingLines} onclose={closed} showFooter={!!result && !searching} bind:this={sheet}>
  {#if searching}
    <p class="text-muted fill-note suggest-status" role="status"><span class="spinner" aria-hidden="true"></span>Searching…</p>
  {:else if result}
    {@const r = result}
    {#if r.status === 'ok'}
      <p class="text-muted fill-note">
        Loffee Labs roaster: {r.roaster} ·
        <button type="button" class="suggest-change" onclick={() => { roasterEditing = true; roasterInput = r.roaster; }}>change</button>
      </p>
    {/if}
    {#if roasterEditing}
      <!-- No name: never submitted. -->
      <div class="inline-row">
        <input type="text" aria-label="Loffee Labs roaster" bind:value={roasterInput} onkeydown={changeKey} />
        <button class="button button-secondary" type="button" disabled={!roasterInput.trim()} onclick={() => run(roasterInput.trim())}>Search</button>
      </div>
    {/if}
    {#if r.status === 'ok'}
      {#if r.beans.length}
        <div class="suggest-list">
          {#each r.beans as c (c.id)}
            <button type="button" class="suggest-pick" onclick={() => { onpick(c); sheet.close(); }}>
              {#if c.image}
                <span class="suggest-image">
                  <img src={c.image} alt="" />
                  {#if c.closest}<span class="badge">Closest to roast date</span>{/if}
                  {#if c.soldout}<span class="badge badge-sold">Sold out</span>{/if}
                </span>
              {/if}
              <span class="suggest-text">
                <span class="suggest-title">{c.name}</span>
                {#if !c.image && (c.closest || c.soldout)}
                  <span class="badge-row">
                    {#if c.closest}<span class="badge badge-inline">Closest to roast date</span>{/if}
                    {#if c.soldout}<span class="badge badge-inline">Sold out</span>{/if}
                  </span>
                {/if}
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
            <button class="button button-secondary" type="button" onclick={() => run(name)}>{name}</button>
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
      <button class="button button-secondary" type="button" onclick={() => run(lastRoaster)}>Retry</button>
    {/if}
    <button class="button button-secondary" type="button" onclick={() => sheet.close()}>None of these</button>
  {/snippet}
</SuggestSheet>

<style>
  /* Badges over the image's top-left corner: Closest first, Sold out under it. */
  .suggest-image :global(.badge-sold) {
    top: calc(var(--space-1) + 1.5rem);
  }
  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  /* The no-image card has no badge corner, so the badge sits in the text. */
  .badge-inline {
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
    background: var(--color-sunflower);
    color: var(--color-sunflower-text);
  }
</style>
