<script lang="ts">
  import { enhance } from '$app/forms';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import { recipesParams, type RecipesItem } from '$lib/recipesView';
  let { data, form } = $props();

  // Inline editor state: never in the URL.
  let naming = $state<string | null>(null);
  let deleting = $state<number | null>(null);

  const avg = (r: number | null) => (r == null ? 'no ratings' : `avg ${r.toFixed(1)}`);
  // The link that opens an item's brews, or closes them when it is already open.
  const brewsHref = (item: RecipesItem) => {
    const cur = data.view.brews;
    const open = cur && ('recipe' in item ? 'recipe' in cur && cur.recipe === item.recipe : 'key' in cur && cur.key === item.key);
    const q = recipesParams({ ...data.view, brews: open ? undefined : item }).toString();
    return q ? `?${q}` : '?';
  };
  const isOpen = (item: RecipesItem) => {
    const cur = data.view.brews;
    return !!cur && ('recipe' in item ? 'recipe' in cur && cur.recipe === item.recipe : 'key' in cur && cur.key === item.key);
  };
  const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
</script>

<svelte:head>
  <title>Bean Tracker - Recipes</title>
</svelte:head>

<h1>Recipes</h1>
<p><a class="button button-ghost" href="/account">Account</a></p>

<p class="text-muted">
  Read from {data.totals.read} brews with flow data · {data.totals.lowConfidence} low confidence · {data.totals.notesOnly} with
  notes only
</p>

<ul class="legend" aria-label="Timeline legend">
  <li><span class="swatch bloom"></span>Bloom</li>
  <li><span class="swatch fast"></span>Fast pour (likely high agitation)</li>
  <li><span class="swatch slow"></span>Slow pour (likely low agitation)</li>
  <li><span class="swatch swirl"></span>Swirl or shake</li>
</ul>

{#snippet brewList()}
  {#if data.brews}
    <ul class="brew-rows">
      {#each data.brews as b, i (i)}
        <li class="brew-row">
          <div class="brew-head">
            <span>{b.date}</span>
            <span class="brew-coffee">
              {#if b.slug}<a href="/coffees/{b.slug}"><CoffeeName name={b.coffeeName} /></a>{:else}<CoffeeName name={b.coffeeName} />{/if}
            </span>
            <span>{b.rating ? b.rating : 'unrated'}</span>
            {#if b.lowConfidence}<span class="badge badge-warm">low confidence</span>{/if}
          </div>
          {#if b.timeline}<PourTimeline timeline={b.timeline} label={b.description} compact />{/if}
          {#if b.label}<div>{b.label}</div>{/if}
          <div class="text-muted">{b.gear ? `${b.description} · ${b.gear}` : b.description}</div>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#if form && 'error' in form && form.error && naming === null}
  <p class="badge badge-urgent" role="alert">{form.error}</p>
{/if}

{#if data.view.view === 'hidden'}
  <section class="chart-panel">
    <h2>Hidden structures</h2>
    <p><a class="button button-ghost" href="?">Back to recipes</a></p>
    {#if data.hidden?.length}
      <ul class="items">
        {#each data.hidden as h (h.key)}
          <li class="item">
            <div>{h.description}</div>
            <div class="text-muted">{n(h.count, 'brew', 'brews')}</div>
            <form method="POST" action="?/undismiss" use:enhance data-button-row class="row-actions">
              <input type="hidden" name="key" value={h.key} />
              <button class="button button-secondary" type="submit">Show again</button>
            </form>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted">Nothing hidden.</p>
    {/if}
  </section>
{:else}
  <section class="chart-panel">
    <h2>Your recipes</h2>
    {#if data.recipes.length}
      <ul class="items">
        {#each data.recipes as r (r.recipe.id)}
          <li class="item" class:open={isOpen({ recipe: r.recipe.id })}>
            <h3>{r.recipe.name}</h3>
            <PourTimeline timeline={r.timeline} label={r.description} />
            <div>{r.description}</div>
            <div class="text-muted">
              {r.counts.logged} from notes · {r.counts.match} look like it · {r.counts.modified} modified · {avg(r.avgRating)}
            </div>
            <div class="row-actions" data-button-row>
              <a class="button button-secondary" href={brewsHref({ recipe: r.recipe.id })} data-sveltekit-noscroll>See brews</a>
              <button class="button button-danger button-ghost" type="button" onclick={() => (deleting = r.recipe.id)}>Delete</button>
            </div>
            {#if deleting === r.recipe.id}
              <form method="POST" action="?/deleteRecipe" use:enhance={() => async ({ update }) => { deleting = null; await update(); }} class="panel">
                <p>Delete {r.recipe.name}? Its brews stay; they just lose the label.</p>
                <input type="hidden" name="id" value={r.recipe.id} />
                <div class="row-actions" data-button-row>
                  <button class="button button-danger" type="submit">Delete</button>
                  <button class="button button-ghost" type="button" onclick={() => (deleting = null)}>Cancel</button>
                </div>
              </form>
            {/if}
            {#if isOpen({ recipe: r.recipe.id })}{@render brewList()}{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted">No saved recipes yet. Name one from the structures below.</p>
    {/if}
  </section>

  <section class="chart-panel">
    <h2>Found in your brews</h2>
    {#if data.groups.length}
      <ul class="items">
        {#each data.groups as g (g.key)}
          <li class="item" class:open={isOpen({ key: g.key })}>
            <PourTimeline timeline={g.timeline} label={g.description} />
            <div>{g.description}</div>
            <div class="text-muted">{g.count} brews · {avg(g.avgRating)}</div>
            {#if g.tagged > 0}
              <div class="text-muted">{g.tagged} tagged in notes{g.suggestedName ? ` (mostly ${g.suggestedName})` : ''}</div>
            {/if}
            {#if g.suggestedPhrase}<div class="text-muted">“{g.suggestedPhrase}”</div>{/if}
            {#if g.common.length}<div class="text-muted">Mostly {g.common.join(' · ')}</div>{/if}
            <div class="row-actions" data-button-row>
              <button class="button" type="button" onclick={() => (naming = g.key)}>Name &amp; save</button>
              <a class="button button-secondary" href={brewsHref({ key: g.key })} data-sveltekit-noscroll>See brews</a>
              <form method="POST" action="?/dismiss" use:enhance class="inline">
                <input type="hidden" name="key" value={g.key} />
                <button class="button button-ghost" type="submit">Not a recipe</button>
              </form>
            </div>
            {#if naming === g.key}
              <form
                method="POST"
                action="?/saveRecipe"
                class="panel"
                use:enhance={() => async ({ result, update }) => {
                  if (result.type === 'success') naming = null;
                  await update();
                }}
              >
                <input type="hidden" name="definition" value={JSON.stringify(g.draft)} />
                <label>Name <input name="name" value={g.suggestedName ?? ''} maxlength="40" required /></label>
                <label>Note tags <input name="tags" value={g.suggestedPhrase ?? ''} /></label>
                {#if form && 'error' in form && form.error}<p class="badge badge-urgent" role="alert">{form.error}</p>{/if}
                <div class="form-actions" data-button-row>
                  <button class="button" type="submit">Save</button>
                  <button class="button button-ghost" type="button" onclick={() => (naming = null)}>Cancel</button>
                </div>
              </form>
            {/if}
            {#if isOpen({ key: g.key })}{@render brewList()}{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-muted">No repeated structures yet: brews with flow data show up here once 3 share a structure.</p>
    {/if}
    {#if data.smallGroups > 0}
      <p class="text-muted">{n(data.smallGroups, 'other structure', 'other structures')} with fewer than 3 brews</p>
    {/if}
    {#if data.hiddenCount > 0}
      <p><a href="?view=hidden">Hidden ({data.hiddenCount})</a></p>
    {/if}
  </section>
{/if}

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-4);
    font-size: 0.875rem;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .swatch {
    width: 14px;
    height: 10px;
    border-radius: 2px;
    background: currentColor;
  }
  .swatch.bloom { background: var(--series-4); }
  .swatch.fast { background: var(--series-1-ink); }
  .swatch.slow { background: var(--series-6); }
  .swatch.swirl {
    width: 10px;
    background: var(--color-text);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }
  .items,
  .brew-rows {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-4);
  }
  .items {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
  }
  .items:has(> .item:only-child) {
    grid-template-columns: 1fr;
  }
  .item {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  .item h3 { margin: 0; }
  .item.open { grid-column: 1 / -1; }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: auto;
  }
  .row-actions .button {
    flex: 1 1 auto;
    margin: 0;
    text-align: center;
  }
  .row-actions .inline { display: contents; }
  .panel {
    display: grid;
    gap: var(--space-2);
  }
  .panel .button {
    flex: 1 1 auto;
    margin: 0;
    text-align: center;
  }
  .panel label { display: grid; gap: var(--space-1); }
  .brew-rows { gap: var(--space-3); margin-top: var(--space-2); }
  .brew-row {
    display: grid;
    gap: var(--space-1);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-2);
    font-size: 0.875rem;
  }
  .brew-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    align-items: baseline;
  }
</style>
