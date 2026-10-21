<script lang="ts">
  import { page } from '$app/state';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import { RECIPES, CONCENTRATES, DEFAULT_ML, MIN_ML, MAX_ML, bestFit, KETTLES, kettleFor, lotusParams, parseLotus } from '$lib/lotus';

  // Untouched = undefined -> defaults; only what the visitor picked rides the URL.
  const start = parseLotus(currentParams(page.url));
  let recipeSlug = $state<string | undefined>(start.recipe);
  // A bare ?kettle=<slug> fills its capacity; with an ml that differs, the kettle is dropped.
  let picked = $state(start.kettle ?? '');
  let ml = $state<number | undefined>(start.ml ?? KETTLES.find((k) => k.slug === start.kettle)?.ml);
  let raw = $state(String(ml ?? DEFAULT_ML));

  let recipe = $derived(RECIPES.find((r) => r.slug === recipeSlug) ?? RECIPES[0]);
  let volume = $derived(ml ?? DEFAULT_ML);
  let kettle = $derived(kettleFor(volume, picked));
  let fit = $derived(bestFit(recipe, volume));
  let valid = $derived(/^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML);

  function pickKettle(name: string) {
    const k = KETTLES.find((x) => x.slug === name);
    if (!k) return;
    picked = name;
    setMl(String(k.ml));
  }

  function setMl(v: string) {
    raw = v;
    if (/^\d+$/.test(v) && +v >= MIN_ML && +v <= MAX_ML) ml = +v;
  }

  $effect(() => writeUrlParams(lotusParams({ recipe: recipeSlug, ml, kettle })));
</script>

<svelte:head>
  <title>Bean Tracker - Water</title>
</svelte:head>

<h1>Water</h1>

<div class="search-row">
  <label class="form-field group-field water-field">
    <span>Recipe</span>
    <select class="ctl-select" aria-label="Recipe" value={recipe.slug} onchange={(e) => (recipeSlug = e.currentTarget.value)}>
      {#each RECIPES as r (r.slug)}<option value={r.slug}>{r.name}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field water-field">
    <span>Kettle</span>
    <select class="ctl-select" aria-label="Kettle" value={valid ? kettle : ''} onchange={(e) => pickKettle(e.currentTarget.value)}>
      <option value="" disabled>Kettle</option>
      {#each KETTLES as k (k.slug)}<option value={k.slug}>{k.name} ({k.ml} mL)</option>{/each}
    </select>
  </label>
  <label class="form-field group-field water-field">
    <span>Water (mL)</span>
    <input type="number" inputmode="numeric" min={MIN_ML} max={MAX_ML} step="1" aria-label="Water (mL)" value={raw} oninput={(e) => setMl(e.currentTarget.value)} />
  </label>
  <label class="form-field group-field water-field">
    <span>Water slider</span>
    <input type="range" min={MIN_ML} max={MAX_ML} step="50" aria-label="Water slider (mL)" value={valid ? volume : DEFAULT_ML} oninput={(e) => setMl(e.currentTarget.value)} />
  </label>
</div>

{#if valid}
  <section>
    <h2>Drops in {volume} mL</h2>
    <table class="water-table">
      <tbody>
        {#each CONCENTRATES as [key, label] (key)}
          <tr><th scope="row">{label}</th><td>{fit.drops[key] ?? 0}</td></tr>
        {/each}
      </tbody>
    </table>
    <table class="water-table">
      <thead><tr><th></th><th scope="col">Result</th><th scope="col">Target</th></tr></thead>
      <tbody>
        <tr><th scope="row">GH</th><td>{fit.gh.toFixed(1)}</td><td>{recipe.gh}</td></tr>
        <tr><th scope="row">KH</th><td>{fit.kh.toFixed(1)}</td><td>{recipe.kh}</td></tr>
      </tbody>
    </table>
    <p class="text-muted">Whole drops from a round-tip dropper, ppm as CaCO3.</p>
  </section>
{:else}
  <p class="text-muted">Enter {MIN_ML}-{MAX_ML} mL.</p>
{/if}

<style>
  /* Fields share a row when they fit; a long kettle name never widens the page. */
  .water-field {
    flex: 1 1 12rem;
    min-width: 0;
  }
  .water-field :is(input, select) {
    width: 100%;
    min-width: 0;
  }
  .water-table {
    border-collapse: collapse;
    margin-bottom: var(--space-4);
    max-width: 100%;
  }
  .water-table th,
  .water-table td {
    padding: var(--space-1) var(--space-3);
    text-align: left;
  }
  .water-table td {
    font-variant-numeric: tabular-nums;
  }
</style>
