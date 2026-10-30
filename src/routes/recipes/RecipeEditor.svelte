<script lang="ts">
  import { goto } from '$app/navigation';
  import { recipeFollow } from '$lib/recipeNav';
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { placeTip } from '$lib/components/modeTip';
  import { convertAmounts, defaultTrigger, describeRecipe, flowNote, recipeTimeline, type RecipeDef, type Trigger } from '$lib/recipes';
  import { stepsText } from '$lib/recipeSteps';

  let {
    name,
    tags,
    def,
    id,
    drippers,
    locked,
    error,
    ondone,
    focusId = null
  }: { focusId?: number | null; name: string; tags: string[]; def: RecipeDef; id?: number; drippers: string[]; locked: string[]; error?: string; ondone: () => void } = $props();

  // Editor-local copy; never in the URL. Props only seed it.
  /* svelte-ignore state_referenced_locally */
  let copy = $state<RecipeDef>($state.snapshot(def) as RecipeDef);
  /* svelte-ignore state_referenced_locally */
  let nameText = $state(name);
  /* svelte-ignore state_referenced_locally */
  let tagText = $state(tags.join(', '));

  // The lock is the dripper's, so it starts from the dripper's current state.
  /* svelte-ignore state_referenced_locally */
  let locks = $state<Record<string, boolean>>(Object.fromEntries(locked.map((d) => [d, true])));
  const dripperChoices = $derived([...drippers, ...copy.drippers.filter((d) => !drippers.includes(d))]);

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
  // The pour-count range always includes the pours listed, so Add/Remove then Save never trips the parser.
  const fit = () => {
    copy.pourCount.min = Math.min(copy.pourCount.min, copy.pours.length);
    copy.pourCount.max = Math.max(copy.pourCount.max, copy.pours.length);
  };
  // Trigger chips: +20s / +30s are {after, n, n}; anything else after is Range, which also stays picked once chosen.
  let custom = $state<boolean[]>([]);
  const lastCustom: ({ kind: 'after'; targetS: number; maxS: number } | undefined)[] = []; // the pair typed before leaving Custom
  const chip = (i: number) => {
    const t = copy.pours[i].trigger;
    if (t?.kind === 'low') return 'low';
    if (custom[i]) return 'custom';
    if (t?.kind === 'after') return t.targetS === t.maxS && (t.targetS === 20 || t.targetS === 30) ? String(t.targetS) : 'custom';
    return '';
  };
  function setChip(i: number, c: string) {
    const t = copy.pours[i].trigger;
    if (custom[i] && t?.kind === 'after') lastCustom[i] = { ...t };
    custom[i] = c === 'custom';
    copy.pours[i].trigger = c === 'low' ? { kind: 'low' } : c === 'custom' ? (t?.kind === 'after' ? t : (lastCustom[i] ?? { kind: 'after', targetS: 20, maxS: 20 })) : { kind: 'after', targetS: +c, maxS: +c };
  }
  const chips = [['20', '+20s'], ['30', '+30s'], ['custom', 'Range'], ['low', 'Water low']];
  const after = (i: number) => copy.pours[i].trigger as Extract<Trigger, { kind: 'after' }>;

  function add() {
    const last = copy.pours.at(-1);
    const start = last ? (last.startS ?? 0) + (last.durationS ?? 0) + 15 : 0;
    copy.pours.push({ bloom: false, grams: unit === 'g' ? 50 : null, share: unit === '%' ? 0.1 : null, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: start, durationS: 20, trigger: defaultTrigger(copy, copy.pours.length) });
    custom.length = copy.pours.length - 1;
    fit();
  }
  function move(i: number, d: -1 | 1) {
    const [a, b] = [copy.pours[i], copy.pours[i + d]];
    [a.startS, b.startS, a.durationS, b.durationS, a.trigger, b.trigger] = [b.startS, a.startS, b.durationS, a.durationS, b.trigger, a.trigger]; // timing and triggers stay by position
    [custom[i], custom[i + d]] = [custom[i + d], custom[i]];
    copy.pours[i] = b;
    copy.pours[i + d] = a;
  }

  // The timeline needs grams: a % pour is drawn at 100 g per 100 %.
  // What is saved: only the fields of the chosen unit, so a stale value never lingers.
  // A cleared ratio box is dropped so the parser answers "Add a ratio", not "Invalid recipe".
  const clean = $derived({ ...copy, ratio: { ...copy.ratio, targets: copy.ratio.targets.filter((t) => t != null) } });
  const payload = $derived({ ...clean, pours: clean.pours.map((p) => (unit === 'g' ? { ...p, share: p.grams == null ? p.share : null } : { ...p, grams: p.share == null ? p.grams : null })) });
</script>

<form
  method="POST"
  action="?/saveRecipe"
  class="editor"
  use:enhance={() => {
    tried = true;
    return async ({ result, update }) => {
    if (result.type === 'success') ondone();
    const to = recipeFollow(result, focusId);
    if (to) { await goto(to, { invalidateAll: true }); return; }
    await update({ reset: false });
  };
  }}
>
  <input type="hidden" name="definition" value={JSON.stringify(payload)} />
  {#if id != null}<input type="hidden" name="id" value={id} />{/if}
  <input type="hidden" name="locks" value={JSON.stringify(Object.fromEntries(copy.drippers.map((d) => [d, !!locks[d]])))} />
  <div class="grid top">
    <div class="form-field a-name"><label for="re-name">Name</label><input id="re-name" name="name" bind:value={nameText} maxlength="40" required /></div>
    <div class="form-field a-tags">
      <div class="label-row">
        <label for="re-tags">Note tags</label>
        <button type="button" class="mode-tip-button" popovertarget="re-tags-help" aria-label="About note tags" aria-describedby="re-tags-help"><Icon name="question" /></button>
      </div>
      <div class="mode-tip" id="re-tags-help" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Note tags', lines: ['Comma-separated words or phrases.', 'A brew whose note contains one is logged as this recipe.'] }} /></div>
      <input id="re-tags" name="tags" bind:value={tagText} />
    </div>
    {#if !copy.equalSplit}
      <div class="form-field a-unit">
        <label for="re-unit">Pour amounts in</label>
        <select id="re-unit" value={unit} onchange={(e) => setUnit(e.currentTarget.value as 'g' | '%')}>
          <option value="g">Grams</option>
          <option value="%">% of water</option>
        </select>
      </div>
    {/if}
    <div class="form-field a-hold"><label for="re-hold">Bloom hold (s)</label><input id="re-hold" type="number" min="0" step="any" bind:value={copy.bloomHoldS} /></div>
    <div class="form-field a-tol"><label for="re-holdtol">± (s)</label><input id="re-holdtol" type="number" min="0" step="any" bind:value={copy.bloomHoldTolS} /></div>
  </div>

  <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={copy.anySpeed} /> Pour speed doesn't matter</label></div>
  <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={copy.equalSplit} /> Equal shares</label></div>
  <fieldset class="drippers">
    <legend>Drippers</legend>
    <div class="choices">
      {#each dripperChoices as d (d)}
        <div class="form-field-checkbox"><label><input type="checkbox" value={d} bind:group={copy.drippers} /> {d}</label></div>
      {/each}
    </div>
    <small class="text-muted">{copy.drippers.length ? 'Only brews on the ticked drippers match.' : 'Any dripper, as none is ticked.'}</small>
    {#if flowNote(copy.drippers)}<small class="text-muted" data-testid="flow-note">{flowNote(copy.drippers)}</small>{/if}
    {#each copy.drippers as d (d)}
      <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={locks[d]} /> Brews on {d} only match its recipes</label></div>
    {/each}
  </fieldset>

  {#each copy.pours as p, i (i)}
    <fieldset class="pour">
      <legend>Pour {i + 1}</legend>
      <div class="pour-head">
        <label class="check"><input type="checkbox" bind:checked={p.bloom} /> Bloom</label>
        <span class="tools">
          <button class="icon-button" type="button" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="arrow-up" /></button>
          <button class="icon-button" type="button" aria-label="Move down" disabled={i === copy.pours.length - 1} onclick={() => move(i, 1)}><Icon name="arrow-down" /></button>
          <button class="icon-button" type="button" aria-label="Remove" onclick={() => { copy.pours.splice(i, 1); custom.splice(i, 1); fit(); }}><Icon name="x" /></button>
        </span>
      </div>
      {#if i === 0}
        <p class="starts">Starts at 0:00</p>
      {:else}
        <div class="trigger">
          <div class="chips" role="radiogroup" aria-label="Pour {i + 1} starts">
            {#each chips as [v, label] (v)}
              <label class="chip"><input type="radio" name="re-trig{i}" value={v} checked={chip(i) === v} onchange={() => setChip(i, v)} />{label}</label>
            {/each}
          </div>
          {#if chip(i) === 'custom'}
            <div class="range">
              <div class="form-field">
                <label for="re-ta{i}">Target</label>
                <div class="with-unit"><input id="re-ta{i}" type="number" min="1" max="600" step="any" bind:value={() => after(i).targetS, (v) => (after(i).targetS = v as number)} />s</div>
              </div>
              <div class="form-field">
                <label for="re-tm{i}">Up to</label>
                <div class="with-unit"><input id="re-tm{i}" type="number" min="1" max="600" step="any" bind:value={() => after(i).maxS, (v) => (after(i).maxS = v as number)} />s</div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
      <div class="grid">
        {#if !copy.equalSplit}<div class="form-field">
          {#if unit === 'g'}
            <label for="re-a{i}">Grams</label><input id="re-a{i}" type="number" min="0" step="any" bind:value={p.grams} />
          {:else}
            <label for="re-a{i}">% of water</label>
            <input id="re-a{i}" type="number" min="0" max="100" step="any" bind:value={() => (p.share == null ? null : +(p.share * 100).toFixed(1)), (v) => (p.share = v == null ? null : v / 100)} />
          {/if}
        </div>{/if}
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
          <select id="re-g{i}" value={p.agitation ?? ''} onchange={(e) => (p.agitation = e.currentTarget.value === '' ? null : (e.currentTarget.value as 'high' | 'medium' | 'low'))}>
            <option value="">From speed</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div class="form-field">
          <label for="re-t{i}">Tool</label>
          <input id="re-t{i}" maxlength="40" placeholder="e.g. spoon" value={p.tool ?? ''} oninput={(e) => (p.tool = e.currentTarget.value || null)} />
        </div>
        <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={p.swirlAfter} /> Swirl after</label></div>
      </div>
    </fieldset>
  {/each}
  <div class="form-actions" data-button-row>
    <button class="button button-secondary" type="button" onclick={add} disabled={copy.pours.length >= 12}>Add pour</button>
  </div>

  <div class="grid">
    <div class="form-field"><label for="re-cmin">Pour count min</label><input id="re-cmin" type="number" min="1" step="1" bind:value={copy.pourCount.min} /></div>
    <div class="form-field"><label for="re-cmax">Pour count max</label><input id="re-cmax" type="number" min="1" step="1" bind:value={copy.pourCount.max} /></div>
    {#each copy.ratio.targets as _, i (i)}
      <div class="form-field">
        <label for="re-ratio{i ? i : ''}">Ratio 1:{i ? ` (${i + 1})` : ''}</label>
        <div class="with-button">
          <input id="re-ratio{i ? i : ''}" type="number" step="any" bind:value={copy.ratio.targets[i]} />
          {#if copy.ratio.targets.length > 1}
            <button class="icon-button" type="button" aria-label="Remove ratio {i + 1}" onclick={() => copy.ratio.targets.splice(i, 1)}><Icon name="x" /></button>
          {/if}
        </div>
      </div>
    {/each}
    <div class="form-field-checkbox"><button class="button button-secondary" type="button" disabled={copy.ratio.targets.length >= 5} onclick={() => copy.ratio.targets.push(16)}>Add ratio</button></div>
    <div class="form-field"><label for="re-ratiotol">Ratio ±</label><input id="re-ratiotol" type="number" step="any" bind:value={copy.ratio.tol} /></div>
    <div class="form-field">
      <div class="label-row">
        <label for="re-temp">Temperature (°C)</label>
        <button type="button" class="mode-tip-button" popovertarget="re-temp-help" aria-label="About temperature" aria-describedby="re-temp-help"><Icon name="question" /></button>
      </div>
      <div class="mode-tip" id="re-temp-help" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Temperature', lines: ['A brew within ±2°C of this matches.', 'The ±2°C is fixed.'] }} /></div>
      <input id="re-temp" type="number" step="any" bind:value={copy.tempC} />
    </div>
  </div>
  <div class="form-field">
    <label for="re-notes">Notes</label>
    <input id="re-notes" maxlength="40" value={copy.notes ?? ''} oninput={(e) => (copy.notes = e.currentTarget.value || null)} />
  </div>

  <div class="preview">
    <PourTimeline timeline={recipeTimeline(clean)} label={describeRecipe(clean)} />
    <div data-testid="editor-description">{describeRecipe(clean)}</div>
    <div class="steps" data-testid="editor-steps">{stepsText(clean)}</div>
  </div>
  {#if tried && error}<p class="badge badge-urgent" role="alert">{error}</p>{/if}
  <div class="form-actions" data-button-row>
    <button class="button" type="submit">Save</button>
    <button class="button button-ghost" type="button" onclick={ondone}>Cancel</button>
  </div>
</form>

<style>
  .editor { display: grid; gap: var(--space-3); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(9rem, 100%), 1fr)); gap: var(--space-2); }
  .drippers { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2); display: grid; gap: 0; min-width: 0; margin: 0; }
  .drippers .form-field-checkbox label { min-height: 32px; font-weight: 400; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); column-gap: var(--space-2); }
  .drippers small { margin: var(--space-1) 0; }
  .pour { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2); display: grid; gap: var(--space-2); min-width: 0; margin: 0; }
  .pour-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .check, .form-field-checkbox label { display: flex; align-items: center; gap: var(--space-2); font-weight: 600; min-height: 44px; }
  .starts { margin: 0; color: var(--color-text-muted); }
  .trigger { --h: 36px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-2); }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .range { display: inline-flex; gap: var(--space-2); }
  .range .form-field { margin-bottom: 0; }
  .with-unit { display: flex; align-items: center; gap: var(--space-1); }
  .with-unit input { width: 4.5rem; height: var(--h); min-height: var(--h); box-sizing: border-box; }
  .chip { position: relative; display: inline-flex; align-items: center; justify-content: center; height: var(--h); padding: 0 var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-weight: 400; white-space: nowrap; cursor: pointer; }
  .chip input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .chip:has(input:checked) { background: var(--color-accent); color: var(--color-accent-contrast); border-color: var(--color-accent); }
  .chip:has(input:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .with-button { display: flex; align-items: center; gap: var(--space-1); }
  .with-button input { flex: 1; }
  .steps { white-space: pre-line; color: var(--color-text-muted); }
  .tools { display: flex; gap: var(--space-2); }
  .form-field-checkbox { align-self: end; }
  .form-field input, .form-field select { min-width: 0; max-width: 100%; }
  .form-field { min-width: 0; }
  .label-row { display: flex; align-items: center; gap: var(--space-2); }
  .editor :global(.form-actions) { margin-top: 0; }
  .editor :global(.button) { margin: 0; }
  @media (max-width: 1100px) {
    /* Phones (either way up): Name over Pour amounts beside the taller Note tags, then Bloom hold and its ± on one row. */
    .top { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: 'name tags' 'unit tags' 'hold tol'; }
    .a-name { grid-area: name; } .a-tags { grid-area: tags; } .a-unit { grid-area: unit; } .a-hold { grid-area: hold; } .a-tol { grid-area: tol; }
  }
  @media (max-width: 640px) {
    .top { grid-template-areas: 'name name' 'unit unit' 'tags tags' 'hold tol'; }
    .form-field input:not([type='checkbox']),
    .form-field select { min-height: 44px; box-sizing: border-box; }
    .trigger { --h: 44px; }
    .editor :global(.form-actions .button) { flex: 1 1 auto; text-align: center; }
  }
</style>
