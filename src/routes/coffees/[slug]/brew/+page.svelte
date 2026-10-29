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
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';

  let { data, form } = $props();
  const recipeError = $derived((form as { recipeError?: string } | null)?.recipeError);
  let submitting = $state(false); // blocks a double tap on Brew this
  let marked = $state(false); // shown after the mark, until the gear or page changes
  $effect(() => { void [data.gear, data.coffee.id]; marked = false; });
  const LABEL: Record<Setting, string> = { grind: 'Grind', temp: 'Temp', dose: 'Dose', ratio: 'Ratio', recipe: 'Recipe', water: 'Water' };
  const c = $derived(data.coffee);
  const asc = $derived([...data.thisCoffee].sort((a, b) => a.localTime.localeCompare(b.localTime)));
  const card = $derived(page.url.searchParams.get('card')); // PREVIEW-TEMP
  const pk = $derived(page.url.searchParams.get('pickers')); // PREVIEW-TEMP
  let basisEl = $state<Element | null>(null);
  let basisOpen = $state(false);
  const BADGE = { high: 'badge-fresh', moderate: 'badge-neutral', low: 'badge-warm', guess: 'badge-warm' } as const;

  function go(patch: Partial<{ grinder: string | null; dripper: string | null; filter: string | null; why: Setting | null }>) {
    const q = brewNowParams({ grinder: data.gear.grinder, dripper: data.gear.dripper, filter: data.gear.filter, why: data.why, ...patch }, data.defaults);
    const qq = [q, card ? `card=${card}` : '', pk ? `pickers=${pk}` : ''].filter(Boolean).join('&'); // PREVIEW-TEMP
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

<svelte:document onclick={(e) => basisOpen && !(e.target as Element).closest('.basis, .bn-tip') && (basisOpen = false)} onkeydown={(e) => e.key === 'Escape' && (basisOpen = false)} />
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

{#snippet evidenceTable(list: BrewRow[])}
  <div class="table-scroll">
    <table class="ev">
      <thead><tr><th>Date</th><th>Coffee</th><th>Grinder</th><th>Temp</th><th>Dripper / filter</th><th>Recipe</th><th class="r">Rating</th></tr></thead>
      <tbody>
        {#each list as b (b.id)}
          <tr>
            <td class="date">{formatDate(b.localTime)}</td>
            <td>{#if b.slug}<a href="/coffees/{b.slug}">{b.coffeeName}</a>{:else}{b.coffeeName}{/if}</td>
            <td>{[b.grinder, b.grind].filter(Boolean).join(' ') || '–'}</td>
            <td>{b.tempC ? `${b.tempC}°C` : '–'}</td>
            <td>{gearText(b) || '–'}</td>
            <td class:muted={!b.recipeName}>{b.recipeName ?? 'Not using saved recipe'}</td>
            <td class="r rate">{b.rating ?? '–'}{#if b.best}<span class="star" title="Best brew"> ★</span>{/if}</td>
          </tr>
          {#if b.notes}<tr class="nrow"><td colspan="7">{b.notes}</td></tr>{/if}
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

{#snippet thisCoffee()}
  {#if data.thisCoffee.length}
    <section class="bn-card" aria-labelledby="bn-this">
      <h2 id="bn-this">This coffee</h2>
      <div class="split">
        <GrindTrend brews={asc} grinder={data.gear.grinder} summary={data.thisCoffeeSummary} />
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
        <a class="rr-title" href={rr.url} target="_blank" rel="noopener noreferrer">{rr.title ?? rr.url}</a>
        <p class="rr-meta">
          {#if data.recipeHost}<span class="badge" class:badge-fresh={data.recipeOwn} class:badge-warm={!data.recipeOwn}>{data.recipeOwn ? data.recipeHost : `${data.recipeHost}, not ${c.roaster}'s site`}</span>{/if}
          <span>Searched {formatDate(rr.searchedAt)}</span>
        </p>
        {#if rr.snippet}<blockquote class="snip">{rr.snippet}</blockquote>{/if}
      {:else if rr}
        <p class="none">Nothing found {data.roasterHost ? `on ${c.roaster}'s site` : `for ${c.roaster}`}</p>
        <p class="rr-meta"><span>Searched {formatDate(rr.searchedAt)}</span></p>
      {/if}
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

  {#if card === 'b'} <!-- PREVIEW-TEMP: hero card -->
    <section class="bn-card hero" aria-label="Coffee">
      {#if data.image}<img class="hero-img" src={data.image.src} alt={data.image.alt} style:background-color={data.image.fill} />{/if}
      <div class="hero-body">
        <p class="muted">{c.roaster}</p>
        <h2 class="hero-name">{c.coffeeName}</h2>
        <dl class="facts">
          {#if c.roastDate}<div><dt>Roasted</dt><dd>{c.roastDate}{c.restDays !== null ? ` (${c.restDays} d off roast)` : ''}</dd></div>{/if}
          {#if c.gramsLeft !== null}<div><dt>Left</dt><dd>{c.gramsLeft} g</dd></div>{/if}
          {#if c.processing}<div><dt>Process</dt><dd>{c.processing}</dd></div>{/if}
          {#if c.origin}<div><dt>Origin</dt><dd>{originWithFlag(c.origin)}</dd></div>{/if}
          {#if c.roastLevel}<div><dt>Roast</dt><dd>{c.roastLevel}</dd></div>{/if}
        </dl>
      </div>
    </section>
  {:else if card === 'c'} <!-- PREVIEW-TEMP: compact row + chips -->
    <section class="bn-card slim" aria-label="Coffee">
      <div class="slim-head">
        {#if data.image}<img class="slim-img" src={data.image.src} alt={data.image.alt} style:background-color={data.image.fill} />{/if}
        <div><h2>{c.coffeeName}</h2><p class="muted">{c.roaster}</p></div>
      </div>
      <p class="chips">
        {#if c.origin}<span class="badge badge-neutral">{originWithFlag(c.origin)}</span>{/if}
        {#if c.processing}<span class="badge badge-neutral">{c.processing}</span>{/if}
        {#if c.roastLevel}<span class="badge badge-neutral">{c.roastLevel}</span>{/if}
        {#if c.restDays !== null}<span class="badge badge-fresh">{c.restDays} d off roast</span>{/if}
        {#if c.gramsLeft !== null}<span class="badge badge-neutral">{c.gramsLeft} g left</span>{/if}
      </p>
    </section>
  {:else}
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
  {/if}

  {#if pk === 'b'} <!-- PREVIEW-TEMP: chips for short lists, compact select otherwise -->
    <section class="bn-card pk2" aria-label="Gear">
      {#each pickers as p (p.key)}
        <div class="pk2-row">
          <span class="pk2-label" id="pk-{p.key}">{p.label}</span>
          {#if p.list.length >= 1 && p.list.length <= 4 && p.list.every((o) => o.length <= 16)}
            <div class="pk2-chips" role="group" aria-labelledby="pk-{p.key}">
              {#each p.list as o (o)}
                <button type="button" class="pk2-chip" aria-pressed={o === p.cur} onclick={() => go({ [p.key]: o, ...(p.key === 'dripper' ? { filter: null } : {}) })}>{o}</button>
              {/each}
            </div>
          {:else}
            <select class="pk2-select" aria-labelledby="pk-{p.key}" value={p.cur ?? ''} onchange={(e) => go({ [p.key]: e.currentTarget.value || null, ...(p.key === 'dripper' ? { filter: null } : {}) })}>
              {#if !p.list.length}<option value="">None yet</option>{/if}
              {#each p.list as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          {/if}
        </div>
      {/each}
    </section>
  {:else}
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
  {/if}

  {#if data.neverBrewedRoaster}{@render roasterRecipe()}{/if}

  <section class="bn-card start" aria-labelledby="bn-start">
    <h2 id="bn-start">Start here <span class="badge {BADGE[data.suggestion.confidence]}">{CONFIDENCE_LABEL[data.suggestion.confidence]}</span></h2>
    <ul class="rows">
      {#each data.suggestion.rows as r (r.setting)}
        {@const open = data.why === r.setting}
        <li class:open>
          <div class="rowhead">
            <span class="lab">{LABEL[r.setting]}</span>
            {#if r.value !== null}
              <strong class="val">{r.value}</strong>
              {#if r.link && (r.setting !== 'recipe' || data.isAdmin)}<a class="more" href={r.link}>{r.setting === 'recipe' ? 'Recipe' : 'Profile'}</a>{/if}
              <span class="badge rowconf {BADGE[r.confidence]}">{CONFIDENCE_LABEL[r.confidence]}</span>
            {:else}
              <span class="none">{r.reason}</span>
            {/if}
          </div>
          {#if r.value !== null}
            <p class="why-plain">{r.reason}
              {#if r.evidence.length}
                <button type="button" class="why" aria-expanded={open} onclick={() => go({ why: open ? null : r.setting })}>{open ? 'Hide brews' : 'Show brews'}</button>
              {/if}
            </p>
          {/if}
          {#if r.reference?.length}
            <ul class="ref">
              {#each r.reference as x (x.grinder)}<li>{x.grinder}: {x.grind}</li>{/each}
            </ul>
          {/if}
          {#if r.setting === 'grind' && data.suggestion.otherGrinders.length}
            <p class="others"><strong>On your other grinders</strong>
              {#each data.suggestion.otherGrinders as g (g.grinder)}<span>{g.grinder} {g.grind}</span>{/each}
            </p>
          {/if}
          {#if open}
            <div class="evidence">
              {#if r.synopsis.length}<ul class="syn">{#each r.synopsis as line (line)}<li>{line}</li>{/each}</ul>{/if}
              {@render evidenceTable(r.evidence)}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="foot">
      {#if data.suggestion.basisCoffees.length}
        <button type="button" class="basis" bind:this={basisEl} aria-expanded={basisOpen} onclick={() => (basisOpen = !basisOpen)}>{data.suggestion.basis}</button>
      {:else}{data.suggestion.basis}{/if}
      {#if data.suggestion.lastNote}<br />Last note: {data.suggestion.lastNote}{/if}
    </p>
    {#if basisOpen && basisEl}
      <FloatTip anchor={basisEl} reveal onclose={() => (basisOpen = false)}>
        <div class="bn-tip">
          <TipBody tip={{ title: 'Based on', rows: data.suggestion.basisCoffees.map((b) => [`${b.name}, ${b.roaster}`, `${b.brews} ${b.brews === 1 ? 'brew' : 'brews'}`]) }} />
          <a class="tip-link" href="#similar" onclick={() => (basisOpen = false)}>See coffees</a>
        </div>
      </FloatTip>
    {/if}
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
      <h2 id="bn-marks">Your last brews of this coffee</h2>
      {#if data.bias}<p class="bias">{data.bias}</p>{/if}
      <ul class="brews marks">
        {#each data.marks as m (m.id)}
          <li>
            <span class="date">{formatDate(m.markedLocal)}</span>
            {#if m.status === 'pending'}<span class="badge badge-neutral">Waiting for your next BQ brew</span>
              {#if data.isAdmin}
                <form method="POST" action="?/deleteMark" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
                  <input type="hidden" name="id" value={m.id} /><button type="submit" class="button button-ghost">Cancel</button>
                </form>
              {/if}
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
    <section class="bn-card" id="similar" aria-labelledby="bn-similar">
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
  .why { min-height: 44px; margin: 0 0 0 var(--space-2); padding: var(--space-1) var(--space-2); background: none; border: 0; color: var(--color-accent);
    font: inherit; font-size: 0.9rem; white-space: nowrap; text-decoration: underline; cursor: pointer; }
  .why-plain { margin: 0; color: var(--color-text-muted); font-size: 0.9rem; padding: var(--space-1) 0; }
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
  .muted { color: var(--color-text-muted); }
  .rowconf { margin-left: auto; }
  .others { margin: var(--space-1) 0 0; font-size: 0.9rem; color: var(--color-text-muted); display: flex; flex-wrap: wrap; gap: 0 var(--space-3); }
  .others strong { color: var(--color-text); font-weight: 600; }
  .syn { margin: 0 0 var(--space-2); padding-left: 1.1rem; font-size: 0.9rem; }
  .syn li { margin: var(--space-1) 0; }
  .ev { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .ev th { text-align: left; font-weight: 500; color: var(--color-text-muted); padding: var(--space-1) var(--space-3) var(--space-1) 0; white-space: nowrap; }
  .ev td { padding: var(--space-2) var(--space-3) var(--space-2) 0; border-top: 1px solid var(--color-border); white-space: nowrap; vertical-align: baseline; }
  .ev .r { text-align: right; padding-right: 0; }
  .ev td.muted { color: var(--color-text-muted); }
  .ev .nrow td { border-top: 0; padding-top: 0; white-space: normal; color: var(--color-text-muted); font-style: italic; }
  .star { color: var(--color-accent); }
  .basis { background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-decoration: underline dotted; text-underline-offset: 2px; cursor: pointer; min-height: 44px; }
  .bn-tip { display: flex; flex-direction: column; gap: var(--space-2); }
  .bn-tip :global(.tip-link) { align-self: flex-start; }
  .marks form { display: contents; }
  .marks .button { min-height: 44px; }
  .rr-title { font-weight: 600; overflow-wrap: anywhere; }
  .rr-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin: var(--space-1) 0 var(--space-2); font-size: 0.85rem; color: var(--color-text-muted); }
  .rr .snip { margin: 0 0 var(--space-2); padding-left: var(--space-3); border-left: 3px solid var(--color-border); color: var(--color-text-muted); font-size: 0.9rem; }
  /* PREVIEW-TEMP card + picker options */
  .hero { display: flex; gap: var(--space-4); align-items: flex-start; }
  .hero-img { width: 7rem; height: 7rem; object-fit: contain; border-radius: var(--radius); flex: none; }
  .hero-body { min-width: 0; flex: 1; }
  .hero-body p { margin: 0; }
  .hero-name { font-size: 1.25rem; margin: 0 0 var(--space-3); }
  .slim-head { display: flex; gap: var(--space-3); align-items: center; }
  .slim-head h2 { margin: 0; }
  .slim-head p { margin: 0; }
  .slim-img { width: 3.5rem; height: 3.5rem; object-fit: contain; border-radius: var(--radius); flex: none; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-3) 0 0; }
  .pk2 { display: flex; flex-direction: column; gap: var(--space-3); }
  .pk2-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .pk2-label { width: 4.5rem; font-size: 0.85rem; color: var(--color-text-muted); }
  .pk2-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: 1; }
  .pk2-chip { min-height: 44px; padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text); font: inherit; white-space: nowrap; cursor: pointer; }
  .pk2-chip[aria-pressed='true'] { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-contrast); }
  .pk2-select { flex: 1; min-width: 10rem; min-height: 44px; border-radius: 999px; }
</style>
