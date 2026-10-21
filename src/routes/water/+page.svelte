<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import {
    RECIPES, CONCENTRATES, DEFAULT_ML, MIN_ML, MAX_ML, MODES, MODE_LABEL, KETTLES, kettleFor, dropsFromPpm, ppmFromMgl,
    minerals, lotusParams, parseLotus, loadWater, serializeWater, WATER_STORAGE_KEY, type Drops, type Mode, type Unit
  } from '$lib/lotus';

  const SLIDER_MAX = 1200;
  const TICKS = Array.from({ length: (SLIDER_MAX - MIN_ML) / 50 + 1 }, (_, i) => MIN_ML + i * 50);
  type Fields = Record<keyof Drops, string>;
  const blank = (): Fields => ({ mg: '', ca: '', na: '', k: '' });
  const fromVals = (v: Partial<Drops> = {}): Fields => ({ mg: str(v.mg), ca: str(v.ca), na: str(v.na), k: str(v.k) });
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
    // The URL's params win; a bare URL restores the remembered state, which the effect below writes into the URL.
    let s = parseLotus(currentParams(page.url));
    if (!Object.keys(s).length) {
      try {
        s = loadWater(localStorage.getItem(WATER_STORAGE_KEY));
      } catch {
        // ignore: storage may be unavailable (private browsing)
      }
    }
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

  let recipe = $derived(RECIPES.find((r) => r.slug === recipeSlug) ?? RECIPES[0]);
  let volume = $derived(ml ?? DEFAULT_ML);
  let kettle = $derived(kettleFor(volume, picked));
  let valid = $derived(/^\d+$/.test(raw) && +raw >= MIN_ML && +raw <= MAX_ML);

  const INT = /^\d{1,3}$/;
  const DEC = /^\d{1,4}(\.\d+)?$/;
  // Empty or half-typed fields count as 0 for the maths; only complete numbers ride the URL.
  const nums = (f: Fields, re: RegExp): Drops => {
    const n = (v: string) => (re.test(v) ? +v : 0);
    return { mg: n(f.mg), ca: n(f.ca), na: n(f.na), k: n(f.k) };
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
  const IONS = CONCENTRATES;
  const ANIONS = [['cl', 'Chloride'], ['hco3', 'Bicarbonate']] as const;
  const SYMBOL: Record<keyof Drops, string> = { mg: 'Mg', ca: 'Ca', na: 'Na', k: 'K' };
  const showTarget = $derived(mode !== 'drops');
  // Bar scales: a fixed reference so small values stay small; a bigger value stretches its own group.
  const ionTop = $derived(Math.max(40, ...IONS.map(([k]) => result[k])));
  const anionTop = $derived(Math.max(100, ...ANIONS.map(([k]) => result[k])));
  const hardTop = (v: number, goal: number) => (showTarget ? Math.max(v, goal, 1) * 1.15 : Math.max(150, v * 1.15));
  const f1 = (n: number) => n.toFixed(1).replace(/\.0$/, '');

  // Whole drops only: a decimal (or 4+ digits) is refused where it is typed, so the results never jump to 0.
  function setDrops(key: keyof Drops, el: HTMLInputElement) {
    if (el.value === '' || INT.test(el.value)) dropsIn[key] = el.value;
    else el.value = dropsIn[key];
  }

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

  // Mirror the state into the URL and the remembered state.
  function sync() {
    const p =
      lotusParams({
        mode: mode === 'recipe' ? undefined : mode,
        recipe: mode === 'recipe' ? recipeSlug : undefined,
        ml,
        kettle,
        unit: mode === 'target' ? unit : undefined,
        vals: mode === 'drops' ? urlVals(dropsIn, INT) : mode === 'target' ? urlVals(targetIn, DEC) : undefined
      });
    writeUrlParams(p);
    try {
      if (p.size) localStorage.setItem(WATER_STORAGE_KEY, serializeWater(p));
      else localStorage.removeItem(WATER_STORAGE_KEY);
    } catch {
      // ignore: the page still works, it just isn't remembered
    }
  }

  // Back to the defaults: first recipe, 1000 mL, no kettle, recipe mode; the saved state goes with it.
  function reset() {
    mode = 'recipe';
    unit = undefined;
    recipeSlug = undefined;
    picked = '';
    ml = undefined;
    raw = String(DEFAULT_ML);
    dropsIn = blank();
    targetIn = blank();
    sync();
  }

  // Every navigation bumps `arrived`, so the effect writes the URL after the router is ready (a write straight from
  // afterNavigate on a full load is dropped) even when the restored state equals the current one.
  let arrived = $state(0);
  $effect(() => {
    arrived;
    sync();
  });
  afterNavigate(() => {
    applyUrl();
    arrived++;
  });
</script>

<svelte:head>
  <title>Bean Tracker - Water</title>
</svelte:head>

<div class="water-page">
<div class="toolbar water-title">
  <h1>Water</h1>
  <div class="water-actions">
    <button class="button button-secondary" type="button" onclick={reset}>Reset</button>
    <ShareButton />
  </div>
</div>

<div class="water-tabs search-row">
  <div class="form-field group-field">
    <span>Mode</span>
    <div class="tab-group" role="group" aria-label="Mode">
      {#each MODES as m (m)}
        <button type="button" aria-pressed={mode === m} onclick={() => (mode = m)}>{MODE_LABEL[m]}</button>
      {/each}
    </div>
  </div>
</div>
<div class="water-controls">
<div class="water-kettle-row">
  <label class="form-field group-field water-field water-kettle">
    <span>Kettle</span>
    <select class="ctl-select" aria-label="Kettle" value={valid ? kettle : ''} onchange={(e) => pickKettle(e.currentTarget.value)}>
      <option value="" disabled>Custom</option>
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
</div>
<div class="water-inputs-wrap"><div class="water-inputs search-row">
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
      <label class="form-field group-field water-mineral" style:--el="var(--el-{key})">
        <span class="water-el">{SYMBOL[key]}{mode === 'drops' ? ' (drops)' : (unit ?? 'ppm') === 'mgl' ? ' (mg/L)' : ' (ppm)'}</span>
        {#if mode === 'drops'}
          <input type="number" inputmode="numeric" min="0" step="1" value={dropsIn[key]} oninput={(e) => setDrops(key, e.currentTarget)} />
        {:else}
          <input type="number" inputmode="decimal" min="0" step="any" value={targetIn[key]} oninput={(e) => (targetIn[key] = e.currentTarget.value)} />
        {/if}
      </label>
    {/each}
  {/if}
</div></div>

<!-- Results stay on the last valid mL while the box holds a partial number; the hint only shows then, in reserved space. -->
<p class="text-muted water-hint" class:water-hint-off={valid}>Enter {MIN_ML}-{MAX_ML} mL.</p>
<section class="wr water-results">
  <div class="card wr-head">
    <h2>Lotus drops for {volume} mL of water</h2>
    <ul class="wr-drops" aria-label="Drops to add">
      {#each CONCENTRATES as [key, label] (key)}
        <li class="wr-drop" style:--el="var(--el-{key})" class:wr-zero={drops[key] === 0} aria-label="{drops[key]} {label}"><b>{drops[key]}</b><span>{SYMBOL[key]}</span></li>
      {/each}
    </ul>
  </div>
    <div class="card wr-card">
      <h3>Minerals</h3>
      <ul class="wr-meters">
        {#each [...IONS, ...ANIONS] as [key, label] (key)}
          {@const top = key === 'cl' || key === 'hco3' ? anionTop : ionTop}
          <li style:--el={key in SYMBOL ? `var(--el-${key})` : 'var(--color-text-muted)'}><span class="wr-meter-label">{label}</span><span class="wr-bar"><i style:width="{(result[key] / top) * 100}%"></i></span><span class="wr-meter-num">{f1(result[key])}<small>mg/L</small></span></li>
        {/each}
      </ul>
    </div>
    <div class="card wr-card">
      <h3>Hardness</h3>
      <div class="wr-gauges">
        {#each [['GH', result.gh, target.gh], ['KH', result.kh, target.kh]] as [label, value, goal] (label)}
          {@const top = hardTop(value as number, goal as number)}
          <div class="wr-gauge">
            <div class="wr-gauge-head"><b>{label}</b><span>{f1(value as number)}<small>ppm{#if showTarget}, target {f1(goal as number)}{/if}</small></span></div>
            <span class="wr-bar wr-bar-tall"><i style:width="{((value as number) / top) * 100}%"></i>{#if showTarget}<u style:left="{((goal as number) / top) * 100}%"></u>{/if}</span>
          </div>
        {/each}
      </div>
    </div>
</section>
<div class="water-notes">
  <p class="text-muted wr-note">Whole drops from a round-tip dropper; GH and KH in ppm as CaCO₃.</p>
  <p class="text-muted wr-note">
    Drop math follows Lotus's own calculator. For official Lotus recipes and instructions, see
    <a href="https://lotuscoffeeproducts.com/pages/product-instructions" rel="noopener">Lotus Coffee Products</a>.
  </p>
</div>
</div>

<style>
  .water-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .water-hint-off {
    visibility: hidden;
  }
  /* Fields share a row when they fit; a long kettle name never widens the page. */
  /* Kettle + mL box sit together and the slider spans exactly from the kettle's left edge to the box's right edge. */
  .water-controls {
    margin-bottom: var(--space-4);
  }
  .water-kettle-row {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    margin-bottom: var(--space-3);
  }
  .water-kettle {
    flex: 1 1 auto;
  }
  .water-field > span {
    white-space: nowrap;
  }
  .water-field {
    max-width: 100%;
    min-width: 0;
  }
  .water-field select {
    max-width: min(100%, 24rem);
  }
  .water-kettle select {
    width: 100%;
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
    margin-bottom: 0;
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

  /* Results: a headline card of drop counts, then minerals and hardness cards (side by side from 768px). */
  .wr small { color: var(--color-text-muted); font-size: 0.75em; margin-left: 0.25em; font-weight: 400; }
  .wr h2 { margin: 0 0 var(--space-3); font-size: 1.1rem; }
  .wr h3 { margin: 0 0 var(--space-3); font-size: 0.9rem; color: var(--color-label); }
  .wr-head { margin-bottom: var(--space-4); border-left: 4px solid var(--color-accent); }
  .wr-drops { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
  .wr-drop { display: flex; align-items: baseline; justify-content: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-radius: var(--radius); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); white-space: nowrap; }
  .wr-drop b, .wr-drop span { color: var(--el); }
  .wr-note { font-size: 0.85rem; margin: 0 0 var(--space-2); }
  .water-el { color: var(--el); font-weight: 600; }
  .wr-drop b { font-size: 2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .wr-drop span { font-size: 1.1rem; font-weight: 600; }
  @container card (min-width: 26rem) { .wr-drops { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .wr-zero b, .wr-zero span { color: var(--color-text-muted); }
  .wr-meters { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .wr-meters li { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr) 5.5rem; align-items: center; gap: var(--space-2); }
  .wr-meter-label { color: var(--el); font-size: 0.9rem; font-weight: 600; }
  .wr-meter-num { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .wr-bar { position: relative; display: block; height: 8px; border-radius: 4px; background: var(--color-border); }
  .wr-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--el, var(--color-accent)); }
  .wr-bar-tall { height: 14px; border-radius: 7px; }
  .wr-bar-tall i { border-radius: 7px; }
  .wr-bar u { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--color-text); text-decoration: none; }
  .wr-gauges { --el: var(--color-label); display: grid; gap: var(--space-5); }
  .wr-gauge-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2); }
  .wr-gauge-head span { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  /* Page grid: one narrow column (title, tabs, controls, inputs, results, notes); from 900px (phone landscape included) two columns that shrink to fit, at most 34rem each,
     left = title..inputs + notes, right = results. */
  .water-page {
    display: grid;
    grid-template-columns: minmax(0, 34rem);
    grid-template-areas: 'title' 'tabs' 'ctl' 'inputs' 'hint' 'results' 'notes';
    column-gap: var(--space-6);
  }
  .water-page > * { min-width: 0; }
  .water-title { grid-area: title; }
  .water-tabs { grid-area: tabs; }
  .water-controls { grid-area: ctl; width: 100%; }
  .water-inputs-wrap { grid-area: inputs; container-type: inline-size; margin-bottom: var(--space-3); }
  .water-results { grid-area: results; }
  .water-notes { grid-area: notes; }
  .water-hint { grid-area: hint; }
  @media (min-width: 900px) {
    .water-page {
      grid-template-columns: repeat(2, minmax(0, 34rem));
      grid-template-rows: repeat(6, auto) 1fr;
      grid-template-areas: 'title results' 'tabs results' 'ctl results' 'inputs results' 'hint results' 'notes results' '. results';
    }
    .water-notes { align-self: start; }
    /* Two columns: every select the same width. */
    .water-field select { max-width: none; width: 100%; }
  }
  .water-inputs { margin-bottom: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @container (min-width: 26rem) { .water-inputs { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .water-inputs .water-unit, .water-inputs .water-field { grid-column: 1 / -1; }
  .water-inputs .water-mineral { flex: none; }
  .wr-card { margin-bottom: var(--space-4); }
</style>
