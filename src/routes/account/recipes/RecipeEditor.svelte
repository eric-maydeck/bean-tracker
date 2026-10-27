<script lang="ts">
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import { convertAmounts, describeRecipe, recipeTimeline, type RecipeDef } from '$lib/recipes';

  let {
    name,
    tags,
    def,
    id,
    error,
    ondone
  }: { name: string; tags: string[]; def: RecipeDef; id?: number; error?: string; ondone: () => void } = $props();

  // Editor-local copy; never in the URL. Props only seed it.
  /* svelte-ignore state_referenced_locally */
  let copy = $state<RecipeDef>($state.snapshot(def) as RecipeDef);
  /* svelte-ignore state_referenced_locally */
  let nameText = $state(name);
  /* svelte-ignore state_referenced_locally */
  let tagText = $state(tags.join(', '));

  let tried = $state(false); // show only the error of a save this editor sent
  const mode = (p: RecipeDef['pours'][number]) => (p.rateGps ? 'range' : p.speed);
  // One unit for the whole recipe. `totalG` is the water remembered from the last grams state (null: never known).
  /* svelte-ignore state_referenced_locally */
  let unit = $state<'g' | '%'>(def.pours.some((p) => p.grams == null && p.share != null) ? '%' : 'g');
  /* svelte-ignore state_referenced_locally */
  let totalG = $state<number | null>(def.pours.every((p) => p.grams != null) ? def.pours.reduce((t, p) => t + p.grams!, 0) : null);
  function setUnit(u: 'g' | '%') {
    if (u === unit) return;
    const c = convertAmounts($state.snapshot(copy.pours) as RecipeDef['pours'], u, totalG);
    copy.pours = c.pours;
    totalG = c.totalG;
    unit = u;
  }

  function setMode(i: number, m: string) {
    const p = copy.pours[i];
    if (m === 'range') p.rateGps = p.rateGps ?? [p.speed === 'fast' ? 13 : 3, p.speed === 'fast' ? 20 : 8];
    else {
      p.rateGps = null;
      p.speed = m as 'fast' | 'slow';
    }
  }
  function add() {
    const last = copy.pours.at(-1);
    const start = last ? (last.startS ?? 0) + (last.durationS ?? 0) + 15 : 0;
    copy.pours.push({ bloom: false, grams: unit === 'g' ? 50 : null, share: unit === '%' ? 0.1 : null, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: start, durationS: 20 });
  }
  function move(i: number, d: -1 | 1) {
    const [a, b] = [copy.pours[i], copy.pours[i + d]];
    [a.startS, b.startS, a.durationS, b.durationS] = [b.startS, a.startS, b.durationS, a.durationS]; // timing stays by position
    copy.pours[i] = b;
    copy.pours[i + d] = a;
  }

  // The timeline needs grams: a % pour is drawn at 100 g per 100 %.
  const preview = $derived({ ...copy, pours: copy.pours.map((p) => ({ ...p, grams: p.grams ?? (p.share ?? 0) * 100 })) });
  // What is saved: only the fields of the chosen unit, so a stale value never lingers.
  const payload = $derived({ ...copy, pours: copy.pours.map((p) => (unit === 'g' ? { ...p, share: p.grams == null ? p.share : null } : { ...p, grams: p.share == null ? p.grams : null })) });
</script>

<form
  method="POST"
  action="?/saveRecipe"
  class="editor"
  use:enhance={() => {
    tried = true;
    return async ({ result, update }) => {
    if (result.type === 'success') ondone();
    await update({ reset: false });
  };
  }}
>
  <input type="hidden" name="definition" value={JSON.stringify(payload)} />
  {#if id != null}<input type="hidden" name="id" value={id} />{/if}
  <div class="grid">
    <div class="form-field"><label for="re-name">Name</label><input id="re-name" name="name" bind:value={nameText} maxlength="40" required /></div>
    <div class="form-field">
      <label for="re-tags">Note tags</label><input id="re-tags" name="tags" bind:value={tagText} />
      <small class="text-muted">A note containing one of these as a word is logged as this recipe.</small>
    </div>
    <div class="form-field">
      <label for="re-unit">Pour amounts in</label>
      <select id="re-unit" value={unit} onchange={(e) => setUnit(e.currentTarget.value as 'g' | '%')}>
        <option value="g">Grams</option>
        <option value="%">% of water</option>
      </select>
    </div>
    <div class="form-field"><label for="re-hold">Bloom hold (s)</label><input id="re-hold" type="number" min="0" step="any" bind:value={copy.bloomHoldS} /></div>
    <div class="form-field"><label for="re-holdtol">± (s)</label><input id="re-holdtol" type="number" min="0" step="any" bind:value={copy.bloomHoldTolS} /></div>
  </div>

  {#each copy.pours as p, i (i)}
    <fieldset class="pour">
      <legend>Pour {i + 1}</legend>
      <div class="pour-head">
        <label class="check"><input type="checkbox" bind:checked={p.bloom} /> Bloom</label>
        <span class="tools">
          <button class="icon-button" type="button" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="arrow-up" /></button>
          <button class="icon-button" type="button" aria-label="Move down" disabled={i === copy.pours.length - 1} onclick={() => move(i, 1)}><Icon name="arrow-down" /></button>
          <button class="icon-button" type="button" aria-label="Remove" onclick={() => copy.pours.splice(i, 1)}><Icon name="x" /></button>
        </span>
      </div>
      <div class="grid">
        <div class="form-field">
          {#if unit === 'g'}
            <label for="re-a{i}">Grams</label><input id="re-a{i}" type="number" min="0" step="any" bind:value={p.grams} />
          {:else}
            <label for="re-a{i}">% of water</label>
            <input id="re-a{i}" type="number" min="0" max="100" step="any" bind:value={() => (p.share == null ? null : +(p.share * 100).toFixed(1)), (v) => (p.share = v == null ? null : v / 100)} />
          {/if}
        </div>
        <div class="form-field">
          <label for="re-s{i}">Speed</label>
          <select id="re-s{i}" value={mode(p)} onchange={(e) => setMode(i, e.currentTarget.value)}>
            <option value="fast">Fast</option>
            <option value="slow">Slow</option>
            <option value="range">Range</option>
          </select>
        </div>
        {#if p.rateGps}
          <div class="form-field"><label for="re-r0{i}">From (g/s)</label><input id="re-r0{i}" type="number" min="0" step="any" bind:value={p.rateGps[0]} /></div>
          <div class="form-field"><label for="re-r1{i}">To (g/s)</label><input id="re-r1{i}" type="number" min="0" step="any" bind:value={p.rateGps[1]} /></div>
        {/if}
        <div class="form-field">
          <label for="re-g{i}">Agitation</label>
          <select id="re-g{i}" value={p.agitation ?? ''} onchange={(e) => (p.agitation = e.currentTarget.value === '' ? null : (e.currentTarget.value as 'high' | 'low'))}>
            <option value="">From speed</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div class="form-field">
          <label for="re-t{i}">Tool</label>
          <input id="re-t{i}" maxlength="40" placeholder="e.g. melodrip" value={p.tool ?? ''} oninput={(e) => (p.tool = e.currentTarget.value || null)} />
        </div>
        <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={p.swirlAfter} /> Swirl after</label></div>
      </div>
    </fieldset>
  {/each}
  <div class="form-actions" data-button-row>
    <button class="button button-secondary" type="button" onclick={add} disabled={copy.pours.length >= 12}>Add pour</button>
  </div>

  <div class="grid">
    <div class="form-field"><label for="re-cmin">Pour count min</label><input id="re-cmin" type="number" min="1" step="any" bind:value={copy.pourCount.min} /></div>
    <div class="form-field"><label for="re-cmax">Pour count max</label><input id="re-cmax" type="number" min="1" step="any" bind:value={copy.pourCount.max} /></div>
    <div class="form-field"><label for="re-ratio">Ratio 1:</label><input id="re-ratio" type="number" step="any" bind:value={copy.ratio.target} /></div>
    <div class="form-field"><label for="re-ratiotol">Ratio ±</label><input id="re-ratiotol" type="number" step="any" bind:value={copy.ratio.tol} /></div>
    <div class="form-field"><label for="re-temp">Temperature (°C)</label><input id="re-temp" type="number" step="any" bind:value={copy.tempC} /></div>
  </div>
  <div class="form-field">
    <label for="re-notes">Notes</label>
    <input id="re-notes" maxlength="40" value={copy.notes ?? ''} oninput={(e) => (copy.notes = e.currentTarget.value || null)} />
  </div>

  <div class="preview">
    <PourTimeline timeline={recipeTimeline(preview)} label={describeRecipe(copy)} />
    <div data-testid="editor-description">{describeRecipe(copy)}</div>
  </div>
  {#if tried && error}<p class="badge badge-urgent" role="alert">{error}</p>{/if}
  <div class="form-actions" data-button-row>
    <button class="button" type="submit">Save</button>
    <button class="button button-ghost" type="button" onclick={ondone}>Cancel</button>
  </div>
</form>

<style>
  .editor { display: grid; gap: var(--space-3); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: var(--space-2); }
  .pour { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2); display: grid; gap: var(--space-2); min-width: 0; margin: 0; }
  .pour-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .check, .form-field-checkbox label { display: flex; align-items: center; gap: var(--space-2); font-weight: 600; min-height: 44px; }
  .tools { display: flex; gap: var(--space-2); }
  .form-field-checkbox { align-self: end; }
  .form-field input, .form-field select { min-width: 0; }
  .editor :global(.form-actions) { margin-top: 0; }
  .editor :global(.button) { margin: 0; }
  @media (max-width: 640px) {
    .form-field input:not([type='checkbox']),
    .form-field select { min-height: 44px; box-sizing: border-box; }
    .editor :global(.form-actions .button) { flex: 1 1 auto; text-align: center; }
  }
</style>
