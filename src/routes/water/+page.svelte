<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import {
    RECIPES, CONCENTRATES, DEFAULT_ML, MIN_ML, MAX_ML, MODES, MODE_LABEL, KETTLES, kettleFor, dropsFromPpm, ppmFromMgl,
    minerals, lotusParams, parseLotus, type Drops, type Mode, type Unit
  } from '$lib/lotus';

  const SLIDER_MAX = 1200;
  const TICKS = Array.from({ length: (SLIDER_MAX - MIN_ML) / 50 + 1 }, (_, i) => MIN_ML + i * 50);
  type Fields = Record<keyof Drops, string>;
  const blank = (): Fields => ({ ca: '', mg: '', na: '', k: '' });
  const fromVals = (v: Partial<Drops> = {}): Fields => ({ ca: str(v.ca), mg: str(v.mg), na: str(v.na), k: str(v.k) });
  const str = (n?: number) => (n === undefined ? '' : String(n));

  // Untouched = undefined -> defaults; only what the visitor picked rides the URL.
  let mode = $state<Mode>('recipe');
  let unit = $state<Unit | undefined>();
  let recipeSlug = $state<string | undefined>();
  let picked = $state('');
  let ml = $state<number | undefined>();
  let raw = $state(String(DEFAULT_ML));
  let dropsIn = $state<Fields>(blank());
  let targetIn = $state<Fields>(blank());

  // Read the URL on entry and on every navigation (nav "Water" -> bare resets). A bare ?kettle=<slug>
  // fills its capacity; with an ml that differs, the kettle is dropped.
  function applyUrl() {
    const s = parseLotus(currentParams(page.url));
    mode = s.mode ?? 'recipe';
    unit = s.unit;
    recipeSlug = s.recipe;
    picked = s.kettle ?? '';
    ml = s.ml ?? KETTLES.find((k) => k.slug === s.kettle)?.ml;
    raw = String(ml ?? DEFAULT_ML);
    dropsIn = s.mode === 'drops' ? fromVals(s.vals) : blank();
    targetIn = s.mode === 'target' ? fromVals(s.vals) : blank();
  }
  applyUrl();
  afterNavigate(applyUrl);

  let recipe = $derived(RECIPES.find((r) => r.slug === recipeSlug) ?? RECIPES[0]);
  let volume = $derived(ml ?? DEFAULT_ML);
  let kettle = $derived(kettleFor(volume, picked));
  let valid = $derived(/^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML);

  const INT = /^\d{1,3}$/;
  const DEC = /^\d{1,4}(\.\d+)?$/;
  // Empty or half-typed fields count as 0 for the maths; only complete numbers ride the URL.
  const nums = (f: Fields, re: RegExp): Drops => {
    const n = (v: string) => (re.test(v) ? +v : 0);
    return { ca: n(f.ca), mg: n(f.mg), na: n(f.na), k: n(f.k) };
  };
  const urlVals = (f: Fields, re: RegExp): Partial<Drops> =>
    Object.fromEntries((Object.keys(f) as (keyof Drops)[]).filter((k) => re.test(f[k])).map((k) => [k, +f[k]]));

  // The target in ppm as CaCO3 (recipe: its own; target mode: the typed values, converted from mg/L if asked).
  let targetPpm = $derived(
    mode === 'recipe' ? recipe.ppm : (unit ?? 'ppm') === 'mgl' ? ppmFromMgl(nums(targetIn, DEC)) : nums(targetIn, DEC)
  );
  let drops = $derived(mode === 'drops' ? nums(dropsIn, INT) : dropsFromPpm(targetPpm, volume));
  let result = $derived(minerals(drops, volume));
  let target = $derived({ gh: targetPpm.ca + targetPpm.mg, kh: targetPpm.na + targetPpm.k });
  const f1 = (n: number) => n.toFixed(1).replace(/\.0$/, '');

  function pickKettle(name: string) {
    const k = KETTLES.find((x) => x.slug === name);
    if (!k) return;
    picked = name;
    setMl(String(k.ml));
  }

  // The slider shows any typed mL exactly, but dragging snaps to 50 and arrows jump 50 -- step="any" can't do both.
  function snapSlider(e: Event & { currentTarget: HTMLInputElement }) {
    const v = Math.round(+e.currentTarget.value / 50) * 50;
    e.currentTarget.value = String(v);
    setMl(String(v));
  }
  function stepSlider(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const v = +e.currentTarget.value;
    const next = Math.min(SLIDER_MAX, Math.max(MIN_ML, dir > 0 ? (Math.floor(v / 50) + 1) * 50 : (Math.ceil(v / 50) - 1) * 50));
    e.currentTarget.value = String(next);
    setMl(String(next));
  }

  function setMl(v: string) {
    raw = v;
    if (/^\d+$/.test(v) && +v >= MIN_ML && +v <= MAX_ML) ml = +v;
  }

  $effect(() =>
    writeUrlParams(
      lotusParams({
        mode: mode === 'recipe' ? undefined : mode,
        recipe: mode === 'recipe' ? recipeSlug : undefined,
        ml,
        kettle,
        unit: mode === 'target' ? unit : undefined,
        vals: mode === 'drops' ? urlVals(dropsIn, INT) : mode === 'target' ? urlVals(targetIn, DEC) : undefined
      })
    )
  );
</script>

<svelte:head>
  <title>Bean Tracker - Water</title>
</svelte:head>

<div class="toolbar">
  <h1>Water</h1>
  <ShareButton />
</div>

<div class="search-row">
  <div class="form-field group-field">
    <span>Mode</span>
    <div class="tab-group" role="group" aria-label="Mode">
      {#each MODES as m (m)}
        <button type="button" aria-pressed={mode === m} onclick={() => (mode = m)}>{MODE_LABEL[m]}</button>
      {/each}
    </div>
  </div>
</div>

<div class="search-row">
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
</div>
<div class="form-field group-field water-slider">
  <input type="range" min={MIN_ML} max={SLIDER_MAX} step="any" aria-label="Water slider (mL)" aria-valuetext="{volume} mL" value={Math.min(volume, SLIDER_MAX)} oninput={snapSlider} onkeydown={stepSlider} />
  <div class="water-ticks" aria-hidden="true">
    {#each TICKS as t (t)}
      <span class="water-tick" class:water-tick-major={t % 100 === 0} style:left="{((t - MIN_ML) / (SLIDER_MAX - MIN_ML)) * 100}%">
        {#if t % 100 === 0}<span class="water-tick-label">{t}</span>{/if}
      </span>
    {/each}
  </div>
</div>

<div class="search-row">
  {#if mode === 'recipe'}
    <label class="form-field group-field water-field">
      <span>Recipe</span>
      <select class="ctl-select" aria-label="Recipe" value={recipe.slug} onchange={(e) => (recipeSlug = e.currentTarget.value)}>
        {#each RECIPES as r (r.slug)}<option value={r.slug}>{r.name}</option>{/each}
      </select>
    </label>
  {:else}
    {#if mode === 'target'}
      <div class="form-field group-field water-unit">
        <span>Unit</span>
        <div class="tab-group" role="group" aria-label="Unit">
          <button type="button" aria-pressed={(unit ?? 'ppm') === 'ppm'} onclick={() => (unit = 'ppm')}>ppm as CaCO₃</button>
          <button type="button" aria-pressed={unit === 'mgl'} onclick={() => (unit = 'mgl')}>mg/L</button>
        </div>
      </div>
    {/if}
    {#each CONCENTRATES as [key, label] (key)}
      <label class="form-field group-field water-mineral">
        <span>{label}{mode === 'drops' ? ' (drops)' : (unit ?? 'ppm') === 'mgl' ? ' (mg/L)' : ' (ppm)'}</span>
        {#if mode === 'drops'}
          <input type="number" inputmode="numeric" min="0" step="1" aria-label={label} value={dropsIn[key]} oninput={(e) => (dropsIn[key] = e.currentTarget.value)} />
        {:else}
          <input type="number" inputmode="decimal" min="0" step="any" aria-label={label} value={targetIn[key]} oninput={(e) => (targetIn[key] = e.currentTarget.value)} />
        {/if}
      </label>
    {/each}
  {/if}
</div>

<!-- Results stay on the last valid mL while the box holds a partial number; the hint only shows then, in reserved space. -->
<p class="text-muted water-hint" class:water-hint-off={valid}>Enter {MIN_ML}-{MAX_ML} mL.</p>
<section>
  <h2>Result in {volume} mL</h2>
  <table class="water-table" aria-label="Drops and minerals">
    <thead><tr><td></td><th scope="col">Drops</th><th scope="col">mg/L</th></tr></thead>
    <tbody>
      {#each CONCENTRATES as [key, label] (key)}
        <tr><th scope="row">{label}</th><td>{drops[key]}</td><td>{f1(result[key])}</td></tr>
      {/each}
      <tr><th scope="row">Chloride</th><td></td><td>{f1(result.cl)}</td></tr>
      <tr><th scope="row">Bicarbonate</th><td></td><td>{f1(result.hco3)}</td></tr>
    </tbody>
  </table>
  <table class="water-table" aria-label="Resulting hardness against target">
    <thead><tr><td></td><th scope="col">Result</th>{#if mode !== 'drops'}<th scope="col">Target</th>{/if}</tr></thead>
    <tbody>
      <tr><th scope="row">GH</th><td>{f1(result.gh)}</td>{#if mode !== 'drops'}<td>{f1(target.gh)}</td>{/if}</tr>
      <tr><th scope="row">KH</th><td>{f1(result.kh)}</td>{#if mode !== 'drops'}<td>{f1(target.kh)}</td>{/if}</tr>
    </tbody>
  </table>
  <p class="text-muted">Whole drops from a round-tip dropper; GH and KH in ppm as CaCO₃.</p>
</section>

<style>
  .water-hint-off {
    visibility: hidden;
  }
  /* Fields share a row when they fit; a long kettle name never widens the page. */
  .water-field {
    max-width: 100%;
    min-width: 0;
  }
  .water-field select {
    max-width: min(100%, 24rem);
  }
  .water-field input {
    width: 8rem;
    max-width: 100%;
  }
  .water-mineral,
  .water-unit {
    flex: 1 1 8rem;
    min-width: 0;
  }
  .water-mineral input {
    width: 100%;
    min-width: 0;
  }
  /* Slider with a scale: the thumb is a fixed width so ticks can follow its travel
     (centre runs from half a thumb in from each end). */
  .water-slider {
    --thumb: 24px;
    max-width: 30rem;
    margin-bottom: var(--space-4);
  }
  .water-slider input[type='range'] {
    appearance: none;
    width: 100%;
    height: var(--thumb);
    margin: 0;
    padding: 0;
    background: transparent;
  }
  .water-slider input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
  }
  .water-slider input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
  }
  .water-slider input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((4px - var(--thumb)) / 2);
    border: 0;
    border-radius: 50%;
    background: var(--color-accent);
  }
  .water-slider input[type='range']::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    box-sizing: border-box;
    border: 0;
    border-radius: 50%;
    background: var(--color-accent);
  }
  .water-ticks {
    position: relative;
    height: 1.6rem;
    margin: 0 calc(var(--thumb) / 2);
  }
  .water-tick {
    position: absolute;
    top: 0;
    width: 1px;
    height: 5px;
    background: var(--color-text-muted);
  }
  .water-tick-major {
    height: 9px;
  }
  .water-tick-label {
    position: absolute;
    top: 11px;
    left: 0;
    transform: translateX(-50%);
    font-size: 0.65rem;
    line-height: 1;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
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
