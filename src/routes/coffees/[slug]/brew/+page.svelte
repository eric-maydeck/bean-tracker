<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { originWithFlag } from '$lib/countryFlags';
  import { formatDate } from '$lib/formatDate';
  import type { BrewRow } from '$lib/server/brewNow/load';
  import type { Setting } from '$lib/server/brewNow/suggest';
  import { brewNowParams } from './brewNowUrl';
  import { CONFIDENCE_LABEL } from '$lib/brewNowConfidence';
  import GrindTrend from './GrindTrend.svelte';
  import TrendScatter from './TrendScatter.svelte'; // PREVIEW-TEMP
  import TrendStrip from './TrendStrip.svelte'; // PREVIEW-TEMP

  let { data, form } = $props();
  const recipeError = $derived((form as { recipeError?: string } | null)?.recipeError);
  let submitting = $state(false); // blocks a double tap on Brew this
  let marked = $state(false); // shown after the mark, until the gear or page changes
  $effect(() => { void [data.gear, data.coffee.id]; marked = false; });
  const LABEL: Record<Setting, string> = { grind: 'Grind', temp: 'Temp', dose: 'Dose', recipe: 'Recipe', water: 'Water' };
  const c = $derived(data.coffee);
  const asc = $derived([...data.thisCoffee].sort((a, b) => a.localTime.localeCompare(b.localTime)));
  const trend = $derived(page.url.searchParams.get('trend')); // PREVIEW-TEMP

  function go(patch: Partial<{ grinder: string | null; dripper: string | null; filter: string | null; why: Setting | null }>) {
    const q = brewNowParams({ grinder: data.gear.grinder, dripper: data.gear.dripper, filter: data.gear.filter, why: data.why, ...patch }, data.defaults);
    const qq = [q, trend ? `trend=${trend}` : ''].filter(Boolean).join('&'); // PREVIEW-TEMP
    goto(page.url.pathname + (qq ? `?${qq}` : ''), { replaceState: true, noScroll: true, keepFocus: true });
  }
  // The chosen gear is always listed, even if it dropped out of the recent options.
  const opts = (list: string[], cur: string | null) => (cur && !list.includes(cur) ? [cur, ...list] : list);
  const pickers = $derived([
    { key: 'grinder', label: 'Grinder', list: opts(data.options.grinders, data.gear.grinder), cur: data.gear.grinder },
    { key: 'dripper', label: 'Dripper', list: opts(data.options.drippers, data.gear.dripper), cur: data.gear.dripper },
    { key: 'filter', label: 'Filter', list: opts(data.options.filters, data.gear.filter), cur: data.gear.filter }
  ] as const);

  const gearText = (b: BrewRow) => [b.dripper, b.filter].filter(Boolean).join(' · ');
</script>

<svelte:head><title>Brew now - {c.coffeeName}</title></svelte:head>

{#snippet brewLine(b: BrewRow, withCoffee: boolean)}
  <span class="date">{formatDate(b.localTime)}</span>
  {#if withCoffee}{#if b.slug}<a href="/coffees/{b.slug}">{b.coffeeName}</a>{:else}<span>{b.coffeeName}</span>{/if}{/if}
  {#if b.grinder || b.grind}<span>{[b.grinder, b.grind].filter(Boolean).join(' ')}</span>{/if}
  {#if b.tempC}<span>{b.tempC}°C</span>{/if}
  {#if gearText(b)}<span>{gearText(b)}</span>{/if}
  {#if b.recipeName}<span>{b.recipeName}</span>{/if}
  {#if b.rating !== null}<span class="rate">{b.rating}</span>{/if}
  {#if b.best}<span class="badge badge-fresh">Best</span>{/if}
  {#if b.notes}<span class="note">{b.notes}</span>{/if}
{/snippet}

{#snippet thisCoffee()}
  {#if data.thisCoffee.length}
    <section class="bn-card" aria-labelledby="bn-this">
      <h2 id="bn-this">This coffee</h2>
      <div class="split">
        {#if trend === 'b'}<TrendScatter brews={asc} grinder={data.gear.grinder} /> <!-- PREVIEW-TEMP -->
        {:else if trend === 'c'}<TrendStrip brews={asc} grinder={data.gear.grinder} /> <!-- PREVIEW-TEMP -->
        {:else}<GrindTrend brews={asc} grinder={data.gear.grinder} />{/if} <!-- PREVIEW-TEMP -->
        <ul class="brews">
          {#each data.thisCoffee as b (b.id)}
            <li id="brew-{b.id}" class:best={b.best}>{@render brewLine(b, false)}</li>
          {/each}
        </ul>
      </div>
    </section>
  {/if}
{/snippet}

{#snippet roasterRecipe()}
  {@const rr = data.roasterRecipe}
  {#if rr || data.isAdmin}
    <section class="bn-card rr" aria-labelledby="bn-rr">
      <h2 id="bn-rr">Roaster's recipe</h2>
      {#if rr?.url}
        <p><a href={rr.url} target="_blank" rel="noopener noreferrer">{rr.title}</a></p>
        <p class="foot host">{data.recipeOwn ? data.recipeHost : data.recipeHost ? `From ${data.recipeHost}, not ${c.roaster}'s site` : ''}</p>
        {#if rr.snippet}<p class="snip">{rr.snippet}</p>{/if}
      {:else if rr}
        <p class="none">Nothing found {data.roasterHost ? `on ${c.roaster}'s site` : `for ${c.roaster}`}</p>
      {/if}
      {#if rr}<p class="foot">Searched {formatDate(rr.searchedAt)}</p>{/if}
      {#if data.isAdmin}
        <form method="POST" action="?/findRecipe" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
          <button type="submit" class="button">{rr ? 'Search again' : 'Find roaster recipe'}</button>
          {#if recipeError}<span role="alert">{recipeError}</span>{/if}
        </form>
      {/if}
    </section>
  {/if}
{/snippet}

<div class="bn">
  <p><a href="/coffees/{c.slug}">← {c.coffeeName}</a></p>
  <h1>Brew now</h1>

  <section class="bn-card" aria-label="Coffee">
    <h2>{c.roaster}</h2>
    <p class="name">{c.coffeeName}</p>
    <dl class="facts">
      {#if c.roastDate}<div><dt>Roasted</dt><dd>{c.roastDate}{c.restDays !== null ? ` (${c.restDays} d off roast)` : ''}</dd></div>{/if}
      {#if c.gramsLeft !== null}<div><dt>Left</dt><dd>{c.gramsLeft} g</dd></div>{/if}
      {#if c.processing}<div><dt>Process</dt><dd>{c.processing}</dd></div>{/if}
      {#if c.origin}<div><dt>Origin</dt><dd>{originWithFlag(c.origin)}</dd></div>{/if}
      {#if c.roastLevel}<div><dt>Roast</dt><dd>{c.roastLevel}</dd></div>{/if}
    </dl>
  </section>

  <section class="bn-card pickers" aria-label="Gear">
    {#each pickers as p (p.key)}
      <label>
        <span>{p.label}</span>
        <select value={p.cur ?? ''} onchange={(e) => go({ [p.key]: e.currentTarget.value || null, ...(p.key === 'dripper' ? { filter: null } : {}) })}>
          {#if !p.list.length}<option value="">None yet</option>{/if}
          {#each p.list as o (o)}<option value={o}>{o}</option>{/each}
        </select>
      </label>
    {/each}
  </section>

  {#if data.neverBrewedRoaster}{@render roasterRecipe()}{/if}

  <section class="bn-card start" aria-labelledby="bn-start">
    <h2 id="bn-start">Start here <span class="badge badge-neutral">{CONFIDENCE_LABEL[data.suggestion.confidence]}</span></h2>
    <ul class="rows">
      {#each data.suggestion.rows as r (r.setting)}
        {@const open = data.why === r.setting}
        <li class:open>
          <div class="rowhead">
            <span class="lab">{LABEL[r.setting]}</span>
            {#if r.value !== null}
              <strong class="val">{r.value}</strong>
              {#if r.link && (r.setting !== 'recipe' || data.isAdmin)}<a class="more" href={r.link}>{r.setting === 'recipe' ? 'Recipe' : 'Profile'}</a>{/if}
            {:else}
              <span class="none">{r.reason}</span>
            {/if}
          </div>
          {#if r.value !== null}
            {#if r.evidence.length}
              <button type="button" class="why" aria-expanded={open} onclick={() => go({ why: open ? null : r.setting })}>{r.reason}</button>
            {:else}
              <span class="why-plain">{r.reason}</span>
            {/if}
          {/if}
          {#if r.reference?.length}
            <ul class="ref">
              {#each r.reference as x (x.grinder)}<li>{x.grinder}: {x.grind}</li>{/each}
            </ul>
          {/if}
          {#if open}
            <ul class="evidence">
              {#each r.evidence as b (b.id)}<li>{@render brewLine(b, true)}</li>{/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="foot">{data.suggestion.basis}{#if data.suggestion.lastNote}<br />Last note: {data.suggestion.lastNote}{/if}</p>
    {#if data.isAdmin}
      <form class="mark" method="POST" action="?/brewThis" use:enhance={() => { submitting = true; return async ({ result, update }) => { try { await update({ reset: false }); marked = result.type === 'success'; } finally { submitting = false; } }; }}>
        {#each ['grinder', 'dripper', 'filter'] as const as k (k)}{#if data.gear[k]}<input type="hidden" name={k} value={data.gear[k]} />{/if}{/each}
        <button type="submit" class="button" disabled={submitting}>Brew this</button>
        {#if marked}<span role="status">Marked — your next BQ brew of this coffee will be compared</span>{/if}
      </form>
    {/if}
  </section>

  {#if data.marks.length}
    <section class="bn-card" aria-labelledby="bn-marks">
      <h2 id="bn-marks">Your last tries</h2>
      {#if data.bias}<p class="bias">{data.bias}</p>{/if}
      <ul class="brews marks">
        {#each data.marks as m (m.id)}
          <li>
            <span class="date">{formatDate(m.markedLocal)}</span>
            {#if m.status === 'pending'}<span class="badge badge-neutral">Waiting for your next BQ brew</span>
            {:else if m.status === 'expired'}<span class="badge badge-neutral">Expired</span>
            {:else if m.status === 'skipped'}<span class="badge badge-neutral">Skipped</span>
            {:else}
              {#if m.brewId !== null}<a href="#brew-{m.brewId}">Brew</a>{/if}
              {#if m.rating !== null}<span class="rate">{m.rating}</span>{/if}
              {#each m.diffs as d (d.setting)}
                <span>{LABEL[d.setting]}: {d.suggested ?? 'none'} → {d.actual ?? 'none'}</span>
              {:else}<span>Followed the suggestion</span>{/each}
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {@render thisCoffee()}

  {#if data.similar.length}
    <section class="bn-card" aria-labelledby="bn-similar">
      <h2 id="bn-similar">{!data.neverBrewedRoaster ? 'Similar coffees' : 'Similar coffees from other roasters'}</h2>
      <ul class="brews">
        {#each data.similar as s (s.slug)}
          <li>
            <a href="/coffees/{s.slug}">{s.roaster} {s.coffeeName}</a>
            <span>{s.brews} {s.brews === 1 ? 'brew' : 'brews'}</span>
            {#if s.avgRating !== null}<span class="rate">{Math.round(s.avgRating * 10) / 10}</span>{/if}
            {#if s.grindRange}<span>grind {s.grindRange[0] === s.grindRange[1] ? s.grindRange[0] : `${s.grindRange[0]} to ${s.grindRange[1]}`}</span>{/if}
            {#if s.tempRange}<span>{s.tempRange[0] === s.tempRange[1] ? s.tempRange[0] : `${s.tempRange[0]} to ${s.tempRange[1]}`}°C</span>{/if}
            {#if s.topRecipe}<span>{s.topRecipe}</span>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if !data.neverBrewedRoaster}{@render roasterRecipe()}{/if}
</div>

<style>
  .bn { max-width: 56rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
  .bn > p, .bn > h1 { margin: 0; }
  .bn-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: var(--space-4); }
  .name { margin: 0 0 var(--space-3); font-weight: 600; }
  .facts { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin: 0; }
  .facts div { display: flex; gap: var(--space-2); }
  dt { color: var(--color-text-muted); }
  dd { margin: 0; }
  .pickers { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: var(--space-3); }
  .pickers label { display: flex; flex-direction: column; gap: var(--space-1); font-size: 0.85rem; color: var(--color-text-muted); }
  .pickers select { min-height: 44px; width: 100%; }
  .rows, .brews, .evidence, .ref { list-style: none; margin: 0; padding: 0; }
  .rows > li { padding: var(--space-3) 0; border-top: 1px solid var(--color-border); }
  .rows > li:first-child { border-top: 0; padding-top: 0; }
  .rowhead { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-3); }
  .lab { min-width: 4rem; color: var(--color-text-muted); }
  .val { font-size: 1.25rem; }
  .none { color: var(--color-text-muted); }
  .more { font-size: 0.85rem; }
  .why { display: block; min-height: 44px; margin: 0; padding: var(--space-1) 0; background: none; border: 0; color: var(--color-text-muted);
    font: inherit; font-size: 0.9rem; text-align: left; text-decoration: underline dotted; cursor: pointer; }
  .why-plain { display: block; color: var(--color-text-muted); font-size: 0.9rem; padding: var(--space-1) 0; }
  .ref { color: var(--color-text-muted); font-size: 0.9rem; }
  .evidence { margin-top: var(--space-2); background: var(--color-bg); border-radius: var(--radius); padding: var(--space-2) var(--space-3); }
  .evidence li, .brews li { display: flex; flex-wrap: wrap; gap: 0 var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--color-border); font-size: 0.9rem; }
  .evidence li:first-child, .brews li:first-child { border-top: 0; }
  .brews li.best { font-weight: 600; }
  .date { color: var(--color-text-muted); }
  .rate { font-weight: 600; }
  .note { flex-basis: 100%; color: var(--color-text-muted); font-style: italic; }
  .mark { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-3); }
  .mark .button { min-height: 44px; }
  .rr form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-3); }
  .rr .button { min-height: 44px; }
  .rr .snip { overflow-wrap: anywhere; }
  .bias { margin: 0 0 var(--space-2); }
  .foot { margin: var(--space-3) 0 0; color: var(--color-text-muted); font-size: 0.9rem; }
  .foot.host { margin-top: 0; }
  .split { display: grid; gap: var(--space-4); }
  @media (min-width: 700px) { .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
</style>
