<script lang="ts">
  import { page } from '$app/state';
  import { afterNavigate } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
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
  // TEMP (preview only): ?design=a|b|c picks a results layout; delete with the design commit.
  let design = $state('');
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
    design = new URLSearchParams(currentParams(page.url)).get('design')?.toLowerCase() ?? '';
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
  const MROWS = [...CONCENTRATES.map(([k, l]) => [k, l] as const), ['cl', 'Chloride'] as const, ['hco3', 'Bicarbonate'] as const];
  const showTarget = $derived(mode !== 'drops');
  const maxMgl = $derived(Math.max(20, ...MROWS.map(([k]) => result[k])));
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

  $effect(() => {
    const p =
      lotusParams({
        mode: mode === 'recipe' ? undefined : mode,
        recipe: mode === 'recipe' ? recipeSlug : undefined,
        ml,
        kettle,
        unit: mode === 'target' ? unit : undefined,
        vals: mode === 'drops' ? urlVals(dropsIn, INT) : mode === 'target' ? urlVals(targetIn, DEC) : undefined
      });
    if (design) p.set('design', design);
    writeUrlParams(p);
  });
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
{#snippet hardnessRow(label: string, value: number, goal: number)}
  <div class="wr-hard">
    <span class="wr-hard-label">{label}</span>
    <span class="wr-hard-value">{f1(value)}<small>ppm</small></span>
    {#if showTarget}
      <span class="wr-hard-target">target {f1(goal)} <b class:wr-off={Math.abs(value - goal) > 0.1 * goal}>{value - goal >= 0 ? '+' : '−'}{f1(Math.abs(value - goal))}</b></span>
    {/if}
  </div>
{/snippet}

{#if design === 'a'}
  <section class="wr wr-a">
    <h2>Result in {volume} mL</h2>
    <ul class="wr-tiles">
      {#each CONCENTRATES as [key, label] (key)}
        <li class="wr-tile" class:wr-zero={drops[key] === 0}><span>{label}</span><strong>{drops[key]}</strong><small>drops</small></li>
      {/each}
    </ul>
    <div class="wr-split">
      <dl class="wr-minerals">
        {#each MROWS as [key, label] (key)}<dt>{label}</dt><dd>{f1(result[key])}<small>mg/L</small></dd>{/each}
      </dl>
      <div class="wr-heroes">
        {@render hardnessRow('GH', result.gh, target.gh)}
        {@render hardnessRow('KH', result.kh, target.kh)}
      </div>
    </div>
  </section>
{:else if design === 'b'}
  <section class="wr wr-b">
    <h2>Result in {volume} mL</h2>
    <div class="wr-split">
      <div class="card wr-card">
        <table class="wr-table" aria-label="Drops and minerals">
          <thead><tr><td></td><th scope="col">Drops</th><th scope="col">mg/L</th></tr></thead>
          <tbody>
            {#each MROWS as [key, label] (key)}
              <tr><th scope="row">{label}</th><td>{#if key !== 'cl' && key !== 'hco3'}{drops[key]}{/if}</td><td>{f1(result[key])}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="card wr-card">
        <table class="wr-table" aria-label="Hardness against target">
          <thead><tr><td></td><th scope="col">Result</th>{#if showTarget}<th scope="col">Target</th>{/if}</tr></thead>
          <tbody>
            <tr><th scope="row">GH</th><td>{f1(result.gh)}<small>ppm</small></td>{#if showTarget}<td>{f1(target.gh)}<small>ppm</small></td>{/if}</tr>
            <tr><th scope="row">KH</th><td>{f1(result.kh)}<small>ppm</small></td>{#if showTarget}<td>{f1(target.kh)}<small>ppm</small></td>{/if}</tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
{:else if design === 'c'}
  <section class="wr wr-c">
    <h2>Result in {volume} mL</h2>
    <p class="wr-dose" aria-label="Drops to add">
      <Icon name="drop" />
      {#each CONCENTRATES.filter(([k]) => drops[k] > 0) as [key, label], i (key)}
        {#if i}<span class="wr-dot" aria-hidden="true">·</span>{/if}<span class="wr-dose-item"><b>{drops[key]}</b> {label}</span>
      {:else}<span class="wr-dose-item">No drops</span>{/each}
    </p>
    <div class="wr-split">
      <ul class="wr-meters">
        {#each MROWS as [key, label] (key)}
          <li><span class="wr-meter-label">{label}</span><span class="wr-bar"><i style:width="{(result[key] / maxMgl) * 100}%"></i></span><span class="wr-meter-num">{f1(result[key])}<small>mg/L</small></span></li>
        {/each}
      </ul>
      <div class="wr-gauges">
        {#each [['GH', result.gh, target.gh], ['KH', result.kh, target.kh]] as [label, value, goal] (label)}
          {@const top = Math.max(value as number, goal as number, 1) * 1.15}
          <div class="wr-gauge">
            <div class="wr-gauge-head"><b>{label}</b><span>{f1(value as number)}{#if showTarget} <small>of {f1(goal as number)}</small>{/if}</span></div>
            <span class="wr-bar wr-bar-tall"><i style:width="{((value as number) / top) * 100}%"></i>{#if showTarget}<u style:left="{((goal as number) / top) * 100}%"></u>{/if}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>
{:else}
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
{/if}

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

  /* TEMP result-design previews (a tiles, b cards, c dosing); one revertable commit. */
  .wr h2 { margin-top: 0; }
  .wr small { color: var(--color-text-muted); font-size: 0.75em; margin-left: 0.25em; font-weight: 400; }
  .wr-split { display: grid; gap: var(--space-4); align-items: start; }
  @media (min-width: 768px) { .wr-split { grid-template-columns: 1.4fr 1fr; } }
  .wr-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); list-style: none; padding: 0; margin: 0 0 var(--space-4); }
  .wr-tile { display: flex; flex-direction: column; align-items: center; padding: var(--space-3) var(--space-1); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); box-shadow: var(--shadow); min-width: 0; }
  .wr-tile span { font-size: 0.8rem; color: var(--color-label); font-weight: 600; }
  .wr-tile strong { font-size: 2.2rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .wr-tile small { margin: 0; }
  .wr-zero { opacity: 0.45; }
  .wr-minerals { display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-4); margin: 0; padding: var(--space-3) var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .wr-minerals dt { color: var(--color-text-muted); }
  .wr-minerals dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .wr-heroes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
  @media (min-width: 768px) { .wr-heroes { grid-template-columns: 1fr; } }
  .wr-hard { display: flex; flex-direction: column; padding: var(--space-3) var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); min-width: 0; }
  .wr-hard-label { font-size: 0.8rem; font-weight: 600; color: var(--color-label); }
  .wr-hard-value { font-size: 2rem; line-height: 1.1; font-weight: 700; font-variant-numeric: tabular-nums; }
  .wr-hard-target { font-size: 0.8rem; color: var(--color-text-muted); }
  .wr-hard-target b { color: var(--color-fresh); }
  .wr-hard-target b.wr-off { color: var(--color-warm); }
  .wr-card { padding: var(--space-2) var(--space-4); }
  .wr-table { width: 100%; border-collapse: collapse; }
  .wr-table th, .wr-table td { padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
  .wr-table tbody tr:last-child > * { border-bottom: 0; }
  .wr-table thead :is(th, td) { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 600; }
  .wr-table th[scope='row'] { text-align: left; font-weight: 400; }
  .wr-table td, .wr-table th[scope='col'] { text-align: right; font-variant-numeric: tabular-nums; }
  .wr-table td { font-weight: 600; }
  .wr-dose { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); margin: 0 0 var(--space-4); padding: var(--space-3) var(--space-4); font-size: 1.25rem; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); border: 1px solid var(--color-border); border-left: 4px solid var(--color-accent); border-radius: var(--radius); }
  .wr-dose b { font-size: 1.6rem; font-variant-numeric: tabular-nums; }
  .wr-dose :global(svg) { width: 1.6rem; height: 1.6rem; flex: none; color: var(--color-accent); }
  .wr-dot { color: var(--color-text-muted); }
  .wr-meters { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .wr-meters li { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr) 5.5rem; align-items: center; gap: var(--space-2); }
  .wr-meter-label { color: var(--color-text-muted); font-size: 0.9rem; }
  .wr-meter-num { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .wr-bar { position: relative; display: block; height: 8px; border-radius: 4px; background: var(--color-border); }
  .wr-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--color-accent); }
  .wr-bar-tall { height: 14px; border-radius: 7px; }
  .wr-bar-tall i { border-radius: 7px; }
  .wr-bar u { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--color-text); text-decoration: none; }
  .wr-gauges { display: grid; gap: var(--space-4); padding: var(--space-3) var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .wr-gauge-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2); }
  .wr-gauge-head span { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
