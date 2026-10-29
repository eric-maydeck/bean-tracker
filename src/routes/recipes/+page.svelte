<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import PreviewMeta from '$lib/components/PreviewMeta.svelte';
  import { recipesPreview } from '$lib/linkPreview';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import RecipeEditor from './RecipeEditor.svelte';
  import { recipesParams, type RecipesItem } from '$lib/recipesView';
  let { data, form } = $props();
  const isAdmin = $derived(!!page.data.isAdmin);

  // Inline editor state: never in the URL.
  let naming = $state<string | null>(null);
  let deleting = $state<number | null>(null);
  let editing = $state<string | null>(null); // 'r<id>' or 's<structure key>'
  const formError = $derived(form && 'error' in form && form.error ? String(form.error) : undefined);

  // Words in your notes: edited rows are local until Save (never in the URL).
  let words = $state(data.noteWords.map((w: { word: string; agitation: string }) => ({ ...w })));
  const wordsEdited = $derived(JSON.stringify(words) !== JSON.stringify(data.noteWords));
  const resetWords = () => (words = data.noteWords.map((w: { word: string; agitation: string }) => ({ ...w })));
  const noteWordsError = $derived(form && 'noteWordsError' in form && form.noteWordsError ? String(form.noteWordsError) : undefined);

  const avg = (r: number | null) => (r == null ? 'no ratings' : `avg ${r.toFixed(1)}`);
  // The link that opens an item's brews, or closes them when it is already open.
  const brewsHref = (item: RecipesItem) => {
    const cur = data.view.brews;
    const open = cur && ('recipe' in item ? 'recipe' in cur && cur.recipe === item.recipe : 'key' in cur && cur.key === item.key);
    const q = recipesParams({ ...data.view, brews: open ? undefined : item, order: open ? undefined : data.view.order }).toString();
    return q ? `?${q}` : '?';
  };
  const isOpen = (item: RecipesItem) => {
    const cur = data.view.brews;
    return !!cur && ('recipe' in item ? 'recipe' in cur && cur.recipe === item.recipe : 'key' in cur && cur.key === item.key);
  };
  const orderHref = (order?: 'top') => `?${recipesParams({ ...data.view, order })}`;
  const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
</script>

<svelte:head>
  <title>Bean Tracker - Recipes</title>
</svelte:head>
<PreviewMeta preview={recipesPreview(data.recipes.map((r: { recipe: { name: string } }) => r.recipe.name))} />

<div class="recipes">
<h1>Recipes</h1>
{#if isAdmin}<p><a class="button button-ghost" href="/account">Account</a></p>{/if}

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
    <div class="order" data-button-row>
      <a class="button {data.view.order ? 'button-secondary' : ''}" href={orderHref()} aria-current={data.view.order ? undefined : 'true'} data-sveltekit-noscroll>Latest</a>
      <a class="button {data.view.order ? '' : 'button-secondary'}" href={orderHref('top')} aria-current={data.view.order ? 'true' : undefined} data-sveltekit-noscroll>Top rated</a>
    </div>
    {#if data.brewsTotal > data.brews.length}<p class="text-muted">Showing {data.brews.length} of {data.brewsTotal}.</p>{/if}
    <ul class="brew-rows">
      {#each data.brews as b, i (i)}
        <li class="brew-row">
          <div class="brew-head">
            <span>{b.date}</span>
            <span class="brew-coffee">
              {#if b.slug}<a href="/coffees/{b.slug}"><CoffeeName name={b.coffeeName} /></a>{:else}<CoffeeName name={b.coffeeName} />{/if}
            </span>
            <span>{b.rating ? b.rating : 'unrated'}</span>
            {#if b.dripper}<span class="text-muted">{b.dripper}</span>{/if}
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

{#if form && 'error' in form && form.error && naming === null && editing === null}
  <p class="badge badge-urgent" role="alert">{form.error}</p>
{/if}

{#if form && 'now' in form && form.now}
  <p role="status">
    <strong>
      {#if form.now.length}
        {form.now.map((m: { name: string; count: number }) => `${n(m.count, 'brew', 'brews')} now ${m.count === 1 ? 'matches' : 'match'} ${m.name}`).join(', ')}
      {:else}
        Back in found structures.
      {/if}
    </strong>
  </p>
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
            <div class="text-muted">
              {n(h.count, 'brew', 'brews')}{#if h.matchedBy.length} · Now matched by {h.matchedBy.length === 1 ? h.matchedBy[0].name : h.matchedBy.map((m: { name: string; count: number }) => `${m.name} (${m.count})`).join(', ')}{/if}
            </div>
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
          <li class="item" class:open={isOpen({ recipe: r.recipe.id })} id="recipe-{r.recipe.id}">
            <h3><a class="recipe-link" href="#recipe-{r.recipe.id}" data-sveltekit-preload-data="off">{r.recipe.name}<Icon name="link" /></a></h3>
            <PourTimeline timeline={r.timeline} label={r.description} />
            <div>{r.description}</div>
            <div class="text-muted">
              {r.counts.logged} from notes · {r.counts.match} look like it · {r.counts.modified} modified · {avg(r.avgRating)}
            </div>
            <div class="row-actions" data-button-row>
              <a class="button" class:button-secondary={!isOpen({ recipe: r.recipe.id })} href={brewsHref({ recipe: r.recipe.id })} aria-expanded={isOpen({ recipe: r.recipe.id })} data-sveltekit-noscroll>{isOpen({ recipe: r.recipe.id }) ? 'Hide brews' : 'See brews'}</a>
              {#if isAdmin}
                <button class="button button-secondary" type="button" onclick={() => (editing = 'r' + r.recipe.id)}>Edit</button>
                <button class="button button-danger button-ghost" type="button" onclick={() => (deleting = r.recipe.id)}>Delete</button>
              {/if}
            </div>
            {#if editing === 'r' + r.recipe.id}
              <RecipeEditor name={r.recipe.name} tags={r.recipe.tags} def={r.recipe.def} id={r.recipe.id} drippers={data.drippers} locked={data.locked} error={formError} ondone={() => (editing = null)} />
            {/if}
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
      <p class="text-muted">{isAdmin ? 'No saved recipes yet. Name one from the structures below.' : 'No saved recipes yet.'}</p>
    {/if}
  </section>

  {#if isAdmin}
  <section class="chart-panel">
    <h2>Found in your brews</h2>
    {#if data.unlisted}
      <ul class="items">
        <li class="item open">
          <div>{data.unlisted.description}</div>
          <div class="text-muted">{n(data.unlisted.count, 'brew', 'brews')}</div>
          <div class="row-actions" data-button-row>
            <a class="button button-secondary" href={brewsHref({ key: data.unlisted.key })} data-sveltekit-noscroll>Close</a>
          </div>
          {@render brewList()}
        </li>
      </ul>
    {/if}
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
              <button class="button button-secondary" type="button" onclick={() => (editing = 's' + g.key)}>Edit</button>
              <form method="POST" action="?/dismiss" use:enhance class="inline">
                <input type="hidden" name="key" value={g.key} />
                <button class="button button-ghost" type="submit">Not a recipe</button>
              </form>
            </div>
            {#if editing === 's' + g.key}
              <RecipeEditor name={g.suggestedName ?? ''} tags={g.suggestedPhrase ? [g.suggestedPhrase] : []} def={g.draft} drippers={data.drippers} locked={data.locked} error={formError} ondone={() => (editing = null)} />
            {/if}
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
      <p class="text-muted">No repeated structures yet: brews with flow data show up here once {data.minGroup} share a structure.</p>
    {/if}
    {#if data.smallGroups > 0}
      <p class="text-muted">{n(data.smallGroups, 'other structure', 'other structures')} with fewer than {data.minGroup} brews</p>
    {/if}
    {#if data.hiddenCount > 0}
      <p><a href="?view=hidden">Hidden ({data.hiddenCount})</a></p>
    {/if}
  </section>

  {/if}
  {#if isAdmin}
  <section class="chart-panel">
    <h2>Words in your notes</h2>
    <p class="text-muted">A brew whose note contains one of these as a word gets that agitation, unless its recipe sets one.</p>
    <form method="POST" action="?/saveNoteWords" use:enhance={() => async ({ result, update }) => { await update({ reset: false }); if (result.type === 'success') resetWords(); }} class="panel">
      {#if words.length}
        {#each words as w, i (i)}
          <div class="word-row">
            <div class="form-field group-field grow"><input name="word" aria-label="Word or phrase" bind:value={w.word} maxlength="40" /></div>
            <div class="form-field group-field">
              <select name="agitation" aria-label="Agitation" bind:value={w.agitation}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button class="icon-button" type="button" aria-label="Remove" onclick={() => words.splice(i, 1)}><Icon name="x" /></button>
          </div>
        {/each}
      {:else}
        <p class="text-muted">No words yet.</p>
      {/if}
      <div><button class="button button-ghost" type="button" onclick={() => words.push({ word: '', agitation: 'high' })}>Add word</button></div>
      {#if noteWordsError}<p class="badge badge-urgent" role="alert">{noteWordsError}</p>{/if}
      <div class="form-actions" data-button-row>
        <button class="button" type="submit">Save</button>
        {#if wordsEdited}<button class="button button-ghost" type="button" onclick={resetWords}>Cancel</button>{/if}
      </div>
    </form>
  </section>
  {/if}
{/if}
</div>

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
    width: 0;
    height: 14px;
    border-radius: 0;
    background: none;
    border-left: 3px dashed var(--color-text);
  }
  .order {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .order .button,
  .row-actions .button,
  .panel .button {
    margin: 0;
  }
  /* Phones: a button row's buttons share its width (ui-rules 17); desktop keeps them their own size. */
  @media (max-width: 640px) {
    .order .button,
    .row-actions .button,
    .panel .button {
      flex: 1 1 auto;
      text-align: center;
    }
  }
  .items,
  .brew-rows {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-4);
  }
  .recipes {
    max-width: 720px; /* the repo's width for form-like content (.form-grid, subscriptions' actions) */
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
  .item { scroll-margin-top: var(--space-4); }
  .item h3 { margin: 0; }
  .recipe-link { color: inherit; text-decoration: none; }
  .recipe-link :global(.icon) { width: 0.8em; height: 0.8em; margin-inline-start: 0.3em; vertical-align: -0.05em; color: var(--color-text-muted); opacity: 0; }
  .recipe-link:hover :global(.icon), .recipe-link:focus-visible :global(.icon) { opacity: 1; }
  @media (hover: none) { .recipe-link :global(.icon) { opacity: 0.5; } }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: auto;
  }
  .row-actions .inline { display: contents; }
  .panel {
    display: grid;
    gap: var(--space-2);
  }
  .word-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  /* Phones, portrait and landscape (rule 4) */
  @media (max-width: 640px), (max-height: 450px) {
    .word-row :is(input, select, .icon-button) { min-height: 44px; box-sizing: border-box; }
    .word-row .icon-button { min-width: 44px; }
  }
  .word-row .grow { flex: 1 1 auto; min-width: 0; }
  .word-row input { width: 100%; min-width: 0; box-sizing: border-box; }
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
