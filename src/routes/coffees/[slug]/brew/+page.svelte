<script lang="ts">
  import { enhance, deserialize } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { originWithFlag } from '$lib/countryFlags';
  import { formatDate } from '$lib/formatDate';
  import type { BrewRow } from '$lib/server/brewNow/load';
  import type { Setting } from '$lib/server/brewNow/suggest';
  import { brewNowParams } from './brewNowUrl';
  import { CONFIDENCE_LABEL } from '$lib/brewNowConfidence';
  import GrindTrend from './GrindTrend.svelte';
  import { recipeSteps } from './recipeSteps';
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
  // One sticky popover at a time: the basis footer's coffees, or the dose reason's plan for the rest of the bag.
  let pop = $state<{ kind: 'basis' | 'plan'; el: Element } | null>(null);
  const toggle = (kind: 'basis' | 'plan', el: Element) => (pop = pop?.kind === kind ? null : { kind, el });
  const BADGE = { high: 'badge-fresh', moderate: 'badge-neutral', low: 'badge-warm', guess: 'badge-warm' } as const;

  type Patch = Partial<{ grinder: string | null; dripper: string | null; filter: string | null; why: Setting | null; dose: number | null; ratio: number | null }>;
  function go(patch: Patch) {
    const q = brewNowParams({ grinder: data.gear.grinder, dripper: data.gear.dripper, filter: data.gear.filter, why: data.why,
      dose: data.suggestion.dose, ratio: data.suggestion.ratio, ...patch }, data.defaults); // dose / ratio in use ride along; defaults drop out
    goto(page.url.pathname + (q ? `?${q}` : ''), { replaceState: true, noScroll: true, keepFocus: true });
  }
  const dripperFirst = (key: string): Patch => (key === 'dripper' ? { filter: null } : {});
  // The chosen gear is always listed, even if it dropped out of the options. Dripper and filter keep a second list
  // behind "Other…"; it opens by itself when the pick lives there.
  const picks = $derived([
    { key: 'grinder', label: 'Grinder', main: data.options.grinders, other: [] as string[], cur: data.gear.grinder },
    { key: 'dripper', label: 'Dripper', main: data.options.drippers, other: data.options.otherDrippers, cur: data.gear.dripper },
    { key: 'filter', label: 'Filter', main: data.options.filters, other: data.options.otherFilters, cur: data.gear.filter }
  ] as const);
  let otherOpen = $state<Record<string, boolean>>({});
  const inOther = (p: { other: readonly string[]; cur: string | null }) => !!p.cur && p.other.includes(p.cur);
  const mainOf = (p: { main: readonly string[]; other: readonly string[]; cur: string | null }) => (p.cur && !p.main.includes(p.cur) && !p.other.includes(p.cur) ? [p.cur, ...p.main] : [...p.main]);
  const fitsChips = (list: string[]) => list.length >= 1 && list.length <= 4 && list.every((o) => o.length <= 16);
  const fmtRatio = (n: number) => `1:${Math.round(n * 10) / 10}`;
  // "enough for 3 more brews" opens the plan for the rest of the bag.
  const planSplit = (reason: string) => reason.match(/^(.*?)(\d+ more brews?)(.*)$/) ?? null;
  const dedupe = (lines: string[]) => [...new Set(lines)];

  // Brew this on a coffee that isn't open yet asks first, then opens it and records the mark.
  let confirmOpen = $state(false), brewForm: HTMLFormElement | undefined = $state(), openError = $state('');
  const notOpen = $derived(c.status !== 'open' && c.status !== 'archive');
  async function openAndBrew() {
    openError = '';
    const res = deserialize(await (await fetch('?/openCoffee', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } })).text());
    if (res.type !== 'success') { openError = "Couldn't open this coffee"; return; }
    confirmOpen = false;
    await invalidateAll();
    brewForm?.requestSubmit();
  }

  const gearText = (b: BrewRow) => [b.dripper, b.filter].filter(Boolean).join(' · ');
</script>

<svelte:document onclick={(e) => pop && !(e.target as Element).closest('.bn-trig, .bn-tip') && (pop = null)} onkeydown={(e) => e.key === 'Escape' && ((pop = null), (confirmOpen = false))} />
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

{#snippet evidenceList(list: BrewRow[])}
  <ul class="ev">
    {#each list as b (b.id)}
      <li>
        <div class="ev-line">
        <span class="ev-main">
          <span class="date">{formatDate(b.localTime)}</span>
          <span>{#if b.slug}<a href="/coffees/{b.slug}">{b.coffeeName}</a>{:else}{b.coffeeName}{/if}</span>
          <span>{[b.grinder, b.grind].filter(Boolean).join(' ') || 'No grinder'}</span>
          <span>{b.tempC ? `${b.tempC}°C` : 'No temp'}</span>
          <span>{gearText(b) || 'No dripper'}</span>
          <span class:muted={!b.recipeName}>{b.recipeName ?? 'Not using saved recipe'}</span>
        </span>
        <span class="ev-r">{#if b.best}<span class="badge badge-fresh">Best</span>{/if} <strong>{b.rating ?? '–'}</strong></span>
        </div>
        {#if b.notes}<p class="note">{b.notes}</p>{/if}
      </li>
    {/each}
  </ul>
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
        {#if rr.snippet}
          {@const steps = recipeSteps(rr.snippet)}
          {#if steps}<ol class="snip steps">{#each steps as st, i (i)}<li>{st}</li>{/each}</ol>{:else}<p class="snip">{rr.snippet}</p>{/if}
        {/if}
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

  <section class="bn-card hero" aria-label="Coffee">
    {#if data.image}<img class="hero-img" src={data.image.src} alt={data.image.alt} style:background-color={data.image.fill} />{/if}
    <div class="hero-body">
      <p class="muted">{c.roaster}</p>
      <h2 class="hero-name">{c.coffeeName}</h2>
      <dl class="facts">
        {#if c.roastDate}<dt>Roasted</dt><dd>{c.roastDate}{c.restDays !== null ? ` (${c.restDays} d off roast)` : ''}</dd>{/if}
        {#if c.gramsLeft !== null}<dt>Left</dt><dd>{c.gramsLeft} g</dd>{/if}
        {#if c.processing}<dt>Process</dt><dd>{c.processing}</dd>{/if}
        {#if c.origin}<dt>Origin</dt><dd>{originWithFlag(c.origin)}</dd>{/if}
        {#if c.roastLevel}<dt>Roast</dt><dd>{c.roastLevel}</dd>{/if}
      </dl>
    </div>
  </section>

  <section class="bn-card pk2" aria-label="Gear, dose and ratio">
    {#each picks as p (p.key)}
      {@const main = mainOf(p)}
      {@const showOther = (otherOpen[p.key] ?? false) || inOther(p)}
      <div class="pk2-row">
        <span class="pk2-label" id="pk-{p.key}">{p.label}</span>
        <div class="pk2-chips" role="group" aria-labelledby="pk-{p.key}">
          {#if fitsChips(main)}
            {#each main as o (o)}
              <button type="button" class="pk2-chip" aria-pressed={o === p.cur} onclick={() => go({ [p.key]: o, ...dripperFirst(p.key) })}>{o}</button>
            {/each}
          {:else}
            <select class="pk2-select" aria-labelledby="pk-{p.key}" value={inOther(p) ? '' : (p.cur ?? '')} onchange={(e) => go({ [p.key]: e.currentTarget.value || null, ...dripperFirst(p.key) })}>
              {#if !main.length}<option value="">None yet</option>{/if}
              {#if inOther(p)}<option value="" disabled>See Other…</option>{/if}
              {#each main as o (o)}<option value={o}>{o}</option>{/each}
            </select>
          {/if}
          {#if p.other.length}
            <button type="button" class="pk2-chip" aria-pressed={showOther} aria-expanded={showOther} onclick={() => (otherOpen[p.key] = !showOther)}>Other…</button>
          {/if}
        </div>
        {#if showOther}
          <select class="pk2-select pk2-other" aria-label="Other {p.label.toLowerCase()}s" value={inOther(p) ? (p.cur ?? '') : ''} onchange={(e) => go({ [p.key]: e.currentTarget.value || null, ...dripperFirst(p.key) })}>
            {#if !inOther(p)}<option value="" disabled>Choose…</option>{/if}
            {#each p.other as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        {/if}
      </div>
    {/each}
    {#if data.options.doses.length}
      <div class="pk2-row">
        <span class="pk2-label" id="pk-dose">Dose</span>
        <div class="pk2-chips" role="group" aria-labelledby="pk-dose">
          {#each data.options.doses as d (d)}
            <button type="button" class="pk2-chip" aria-pressed={d === data.suggestion.dose} onclick={() => go({ dose: d })}>{d} g</button>
          {/each}
        </div>
      </div>
    {/if}
    {#if data.options.ratios.length}
      <div class="pk2-row">
        <span class="pk2-label" id="pk-ratio">Ratio</span>
        <div class="pk2-chips" role="group" aria-labelledby="pk-ratio">
          {#each data.options.ratios as r (r)}
            <button type="button" class="pk2-chip" aria-pressed={r === data.suggestion.ratio} onclick={() => go({ ratio: r })}>{fmtRatio(r)}</button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

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
              {#if r.link}<a class="more" href={r.link}>{r.setting === 'recipe' ? 'Recipe' : 'Profile'}</a>{/if}
              <span class="badge rowconf {BADGE[r.confidence]}">{CONFIDENCE_LABEL[r.confidence]}</span>
            {:else}
              <span class="none">{r.reason}</span>
            {/if}
          </div>
          {#if r.value !== null}
            <p class="why-plain">
              {#if r.setting === 'dose' && data.suggestion.dosePlan && planSplit(r.reason)}
                {@const m = planSplit(r.reason)!}{m[1]}<button type="button" class="basis bn-trig" aria-expanded={pop?.kind === 'plan'} onclick={(e) => toggle('plan', e.currentTarget)}>{m[2]}</button>{m[3]}
              {:else}{r.reason}{/if}
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
              {#if r.synopsis.length}<p class="syn">{dedupe(r.synopsis).join(' ')}</p>{/if}
              {#if r.evidence.length}<p class="ev-label">Evidence:</p>{@render evidenceList(r.evidence)}{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="foot">
      {#if data.suggestion.basisCoffees.length}
        <button type="button" class="basis bn-trig" aria-expanded={pop?.kind === 'basis'} onclick={(e) => toggle('basis', e.currentTarget)}>{data.suggestion.basis}</button>
      {:else}{data.suggestion.basis}{/if}
      {#if data.suggestion.lastNote}<br />Last note: {data.suggestion.lastNote}{/if}
    </p>
    {#if pop}
      <FloatTip anchor={pop.el} reveal onclose={() => (pop = null)}>
        <div class="bn-tip">
          {#if pop.kind === 'basis'}
            <TipBody tip={{ title: 'Based on', rows: data.suggestion.basisCoffees.map((b) => [`${b.name}, ${b.roaster}`, `${b.brews} ${b.brews === 1 ? 'brew' : 'brews'}`]) }} />
            <a class="tip-link" href="#similar" onclick={() => (pop = null)}>See coffees</a>
          {:else if data.suggestion.dosePlan}
            {@const plan = data.suggestion.dosePlan}
            <TipBody tip={{ title: 'Rest of the bag', lines: [`${plan.brews.map((d) => `${d} g`).join(' + ')}`, `${Math.round(plan.leftover * 10) / 10} g left over`] }} />
          {/if}
        </div>
      </FloatTip>
    {/if}
    {#if data.isAdmin}
      <form class="mark" method="POST" action="?/brewThis" bind:this={brewForm} use:enhance={() => { submitting = true; return async ({ result, update }) => { try { await update({ reset: false }); marked = result.type === 'success'; } finally { submitting = false; } }; }}>
        {#each ['grinder', 'dripper', 'filter'] as const as k (k)}{#if data.gear[k]}<input type="hidden" name={k} value={data.gear[k]} />{/if}{/each}
        {#if data.suggestion.dose !== null}<input type="hidden" name="dose" value={data.suggestion.dose} />{/if}
        {#if data.suggestion.ratio !== null}<input type="hidden" name="ratio" value={data.suggestion.ratio} />{/if}
        <button type={notOpen ? 'button' : 'submit'} class="button" disabled={submitting} onclick={notOpen ? () => (confirmOpen = true) : undefined}>Brew this</button>
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

{#if confirmOpen}
  <div class="modal-backdrop">
    <div class="modal bn-confirm" role="dialog" aria-modal="true" aria-labelledby="bn-open-title">
      <h2 id="bn-open-title">This coffee isn't open yet. Open it now?</h2>
      {#if openError}<p role="alert" class="badge badge-urgent">{openError}</p>{/if}
      <div class="action-buttons">
        <button class="button" type="button" onclick={openAndBrew}>Open and brew</button>
        <button class="button button-secondary" type="button" onclick={() => (confirmOpen = false)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bn { max-width: 56rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
  .bn > p, .bn > h1 { margin: 0; }
  .bn-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: var(--space-4); }
  .name { margin: 0 0 var(--space-3); font-weight: 600; }
  dt { color: var(--color-text-muted); }
  dd { margin: 0; }
  .rows, .brews, .ref { list-style: none; margin: 0; padding: 0; }
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
  .brews li.best { font-weight: 600; }
  .date { color: var(--color-text-muted); }
  .rate { font-weight: 600; }
  .note { flex-basis: 100%; color: var(--color-text-muted); font-style: italic; }
  .mark { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-3); }
  .mark .button { min-height: 44px; }
  .rr form { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-top: var(--space-3); }
  .rr .button { min-height: 44px; }
  .bias { margin: 0 0 var(--space-2); }
  .foot { margin: var(--space-3) 0 0; color: var(--color-text-muted); font-size: 0.9rem; }
  .foot.host { margin-top: 0; }
  .split { display: grid; gap: var(--space-4); }
  @media (min-width: 700px) { .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
  .muted { color: var(--color-text-muted); }
  .rowconf { margin-left: auto; }
  .others { margin: var(--space-1) 0 0; font-size: 0.9rem; color: var(--color-text-muted); display: flex; flex-wrap: wrap; gap: 0 var(--space-3); }
  .others strong { color: var(--color-text); font-weight: 600; }
  .basis { background: none; border: 0; padding: 0; margin: 0; font: inherit; color: inherit; text-decoration: underline dotted; text-underline-offset: 2px; cursor: pointer; min-height: 44px; }
  .bn-tip { display: flex; flex-direction: column; gap: var(--space-2); }
  .bn-tip :global(.tip-link) { align-self: flex-start; }
  .marks form { display: contents; }
  .rr-title { font-weight: 600; overflow-wrap: anywhere; }
  .rr-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin: var(--space-1) 0 var(--space-2); font-size: 0.85rem; color: var(--color-text-muted); }
  .rr .snip { margin: 0 0 var(--space-2); padding: 0 0 0 var(--space-3); border-left: 3px solid var(--color-border); color: var(--color-text-muted); font-size: 0.9rem; overflow-wrap: anywhere; }
  .rr ol.snip { padding-left: calc(var(--space-3) + 1.2rem); }
  .rr ol.snip li { margin: var(--space-1) 0; }
  .hero { display: flex; gap: var(--space-4); align-items: flex-start; }
  .hero-img { width: 7rem; height: 7rem; object-fit: contain; border-radius: var(--radius); flex: none; }
  .hero-body { min-width: 0; flex: 1; }
  .hero-body p { margin: 0; }
  .hero-name { font-size: 1.25rem; margin: 0 0 var(--space-3); }
  .pk2 { display: flex; flex-direction: column; gap: var(--space-3); }
  .pk2-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .pk2-label { width: 4.5rem; font-size: 0.85rem; color: var(--color-text-muted); }
  .pk2-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: 1; }
  .pk2-chip { min-height: 44px; padding: 0 var(--space-4); border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text); font: inherit; white-space: nowrap; cursor: pointer; }
  .pk2-chip[aria-pressed='true'] { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-contrast); }
  .pk2-select { flex: 1; min-width: 10rem; min-height: 44px; border-radius: 999px; }
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; }
  .brews li { display: flex; flex-wrap: wrap; gap: 0 var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--color-border); font-size: 0.9rem; }
  .brews li:first-child { border-top: 0; }
  .syn { margin: 0 0 var(--space-2); font-size: 0.9rem; }
  .ev-label { margin: 0; font-size: 0.85rem; font-weight: 600; }
  .ev { margin: 0; padding-left: 1.1rem; list-style: disc; font-size: 0.9rem; }
  .ev li { padding: var(--space-1) 0; }
  .ev .note { margin: 0; flex-basis: auto; }
  .ev-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--space-3); }
  .ev-main { display: flex; flex-wrap: wrap; gap: 0 var(--space-2); flex: 1; min-width: 0; }
  .ev-main > span + span::before { content: '·'; margin-right: var(--space-2); color: var(--color-text-muted); }
  .ev-main .muted { color: var(--color-text-muted); }
  .ev-r { margin-left: auto; white-space: nowrap; }
  .marks li { align-items: center; gap: var(--space-2) var(--space-3); }
  .marks .badge { white-space: nowrap; }
  .marks .button { min-height: 44px; margin: 0; }
  .bn-confirm { max-width: 24rem; }
</style>
