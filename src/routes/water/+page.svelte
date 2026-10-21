<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import { RECIPES, CONCENTRATES, DEFAULT_ML, MIN_ML, MAX_ML, dropsFor, hardness, KETTLES, kettleFor, lotusParams, parseLotus } from '$lib/lotus';

  // Untouched = undefined -> defaults; only what the visitor picked rides the URL.
  let recipeSlug = $state<string | undefined>();
  let picked = $state('');
  let ml = $state<number | undefined>();
  let raw = $state(String(DEFAULT_ML));

  // Read the URL on entry and on every navigation (nav "Water" -> bare resets). A bare ?kettle=<slug>
  // fills its capacity; with an ml that differs, the kettle is dropped.
  function applyUrl() {
    const s = parseLotus(currentParams(page.url));
    recipeSlug = s.recipe;
    picked = s.kettle ?? '';
    ml = s.ml ?? KETTLES.find((k) => k.slug === s.kettle)?.ml;
    raw = String(ml ?? DEFAULT_ML);
  }
  applyUrl();
  afterNavigate(applyUrl);

  let recipe = $derived(RECIPES.find((r) => r.slug === recipeSlug) ?? RECIPES[0]);
  let volume = $derived(ml ?? DEFAULT_ML);
  let kettle = $derived(kettleFor(volume, picked));
  let drops = $derived(dropsFor(recipe, volume));
  let fit = $derived(hardness(drops, volume));
  let target = $derived({ gh: recipe.ppm.ca + recipe.ppm.mg, kh: recipe.ppm.na + recipe.ppm.k });
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

<div class="toolbar">
  <h1>Water</h1>
  <ShareButton />
</div>

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
    <input type="range" min={MIN_ML} max={MAX_ML} step="50" aria-label="Water slider (mL)" aria-valuetext="{volume} mL" value={volume} oninput={(e) => setMl(e.currentTarget.value)} />
  </label>
</div>

<!-- Results stay on the last valid mL while the box holds a partial number; the hint only shows then, in reserved space. -->
<p class="text-muted water-hint" class:water-hint-off={valid}>Enter {MIN_ML}-{MAX_ML} mL.</p>
<section>
  <h2>Drops in {volume} mL</h2>
  <table class="water-table" aria-label="Drops per concentrate">
    <tbody>
      {#each CONCENTRATES as [key, label] (key)}
        <tr><th scope="row">{label}</th><td>{drops[key]}</td></tr>
      {/each}
    </tbody>
  </table>
  <table class="water-table" aria-label="Resulting hardness against target">
    <thead><tr><td></td><th scope="col">Result</th><th scope="col">Target</th></tr></thead>
    <tbody>
      <tr><th scope="row">GH</th><td>{fit.gh.toFixed(1)}</td><td>{target.gh.toFixed(1).replace(/\.0$/, '')}</td></tr>
      <tr><th scope="row">KH</th><td>{fit.kh.toFixed(1)}</td><td>{target.kh.toFixed(1).replace(/\.0$/, '')}</td></tr>
    </tbody>
  </table>
  <p class="text-muted">Whole drops from a round-tip dropper, ppm as CaCO3.</p>
</section>

<style>
  .water-hint-off {
    visibility: hidden;
  }
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
