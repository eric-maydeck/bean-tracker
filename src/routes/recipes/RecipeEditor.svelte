<script lang="ts">
  import { goto } from '$app/navigation';
  import { recipeFollow } from '$lib/recipeNav';
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { labelTip } from '$lib/components/labelTip';
  import { placeTip } from '$lib/components/modeTip';
  import { convertAmounts, defaultLength, describeRecipe, LENGTH_CHIP_SECONDS, lengthChip, parseDuration, formatDuration, parseRatioTarget, flowNote, recipeTimeline, type RecipeDef, type Length } from '$lib/recipes';
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
  // Ratio targets: a staged list (saving the recipe saves it). Enter or Add takes the typed value; a bad one explains itself on blur.
  const fmtRatio = (t: number) => String(Math.round(t * 10) / 10);
  let ratioText = $state('');
  let ratioShow = $state(false);
  const ratioBad = () => ratioText.trim() !== '' && parseRatioTarget(ratioText) == null;
  function addRatio() {
    const v = parseRatioTarget(ratioText);
    if (v == null) return void (ratioShow = ratioText.trim() !== '');
    if (!copy.ratio.targets.includes(v) && copy.ratio.targets.length < 5) copy.ratio.targets = [...copy.ratio.targets, v].sort((a, b) => a - b);
    ratioText = '';
    ratioShow = false;
  }
  const maxed = $derived(copy.ratio.targets.length >= 5);
  const fullTip = { title: 'Up to 5 ratios', lines: ['Remove one to add another.'] };
  const removeRatio = (t: number) => copy.ratio.targets.length > 1 && (copy.ratio.targets = copy.ratio.targets.filter((x) => x !== t));

  // The length row, one state per pour: the selected button ('low', a chip's seconds, 'custom', 'range') and the three boxes.
  // A box that holds a valid value selects its button; the length follows the selection.
  type LenUi = { sel: string; text: string; tt: string; tm: string; showC: boolean; showR: boolean };
  const uiOf = (l: Length): LenUi => {
    const sel = lengthChip(l);
    const t = l?.kind === 'time' ? l : null;
    return { sel, text: sel === 'custom' && t ? formatDuration(t.targetS) : '', tt: sel === 'range' && t ? String(t.targetS) : '', tm: sel === 'range' && t ? String(t.maxS) : '', showC: false, showR: false };
  };
  /* svelte-ignore state_referenced_locally */
  let ui = $state<LenUi[]>(def.pours.map((p) => uiOf(p.length)));
  const timeChips = LENGTH_CHIP_SECONDS.map((s): [string, string] => [String(s), formatDuration(s)]);
  function apply(i: number) {
    const u = ui[i];
    const time = (a: number, b: number): Length => ({ kind: 'time', targetS: a, maxS: b });
    let l: Length = null;
    if (u.sel === 'low') l = { kind: 'low' };
    else if (/^\d+$/.test(u.sel)) l = time(+u.sel, +u.sel);
    else if (u.sel === 'custom') {
      const d = parseDuration(u.text);
      if (d) l = time(d, d);
    } else if (u.sel === 'range' && u.tt !== '' && u.tm !== '' && +u.tt > 0 && +u.tm > 0) l = time(+u.tt, +u.tm); // max below target: the parser says so on Save
    copy.pours[i].length = l;
  }
  // Choosing Custom or Range puts the cursor in its (first) box.
  const focusBox = (i: number, v: string) => (v === 'custom' || v === 'range') && document.getElementById(v === 'custom' ? `re-cu${i}` : `re-rf${i}`)?.focus();
  const pick = (i: number, v: string) => ((ui[i].sel = v), apply(i));
  function typeCustom(i: number, text: string) {
    ui[i].text = text;
    if (parseDuration(text)) ui[i].sel = 'custom';
    if (!customBad(i)) ui[i].showC = false; // a message clears as soon as the value is fine; it shows only after the box loses focus
    apply(i);
  }
  function typeRange(i: number, which: 'tt' | 'tm', v: string) {
    ui[i][which] = v;
    const [a, b] = [+ui[i].tt, +ui[i].tm];
    if (ui[i].tt !== '' && ui[i].tm !== '' && a > 0 && b >= a) ui[i].sel = 'range';
    if (!rangeBad(i)) ui[i].showR = false;
    apply(i);
  }
  const customBad = (i: number) => ui[i].text.trim() !== '' && parseDuration(ui[i].text) == null;
  const rangeBad = (i: number) => ui[i].tt !== '' && ui[i].tm !== '' && +ui[i].tm < +ui[i].tt;
  // A selected Custom or Range with no valid value leaves the step without a length: Save then says so.
  const noLength = (i: number) => (ui[i].sel === 'custom' || ui[i].sel === 'range') && copy.pours[i].length == null;

  function add() {
    const last = copy.pours.at(-1);
    if (last && !last.length) last.length = defaultLength(copy, copy.pours.length); // the old last step now has a next one
    const start = last ? (last.startS ?? 0) + (last.durationS ?? 0) + 15 : 0;
    copy.pours.push({ bloom: false, grams: unit === 'g' ? 50 : null, share: unit === '%' ? 0.1 : null, speed: 'slow', rateGps: null, agitation: null, tool: null, swirlAfter: false, startS: start, durationS: 20, length: null });
    if (last && ui[copy.pours.length - 2]) ui[copy.pours.length - 2] = uiOf(last.length);
    ui.push(uiOf(null));
    fit();
  }
  function move(i: number, d: -1 | 1) {
    const [a, b] = [copy.pours[i], copy.pours[i + d]];
    [a.startS, b.startS, a.durationS, b.durationS, a.length, b.length] = [b.startS, a.startS, b.durationS, a.durationS, b.length, a.length]; // timing and lengths stay by position
    copy.pours[i] = b;
    copy.pours[i + d] = a;
  }

  // The timeline needs grams: a % pour is drawn at 100 g per 100 %.
  // What is saved: only the fields of the chosen unit, so a stale value never lingers.
  // A cleared ratio box is dropped so the parser answers "Add a ratio", not "Invalid recipe".
  const clean = $derived({ ...copy, ratio: { ...copy.ratio, targets: copy.ratio.targets.filter((t) => t != null) } });
  const payload = $derived({ ...clean, pours: clean.pours.map((q, i) => {
    const p = i < clean.pours.length - 1 && noLength(i) ? { ...q, length: { kind: 'time', targetS: null, maxS: null } } : q; // the parser answers "Enter a step length"
    return (unit === 'g' ? { ...p, share: p.grams == null ? p.share : null } : { ...p, grams: p.share == null ? p.grams : null });
  }) });
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
    if (to) { await goto(to, { invalidateAll: true, noScroll: true }); return; } // noScroll: a goto resets to the page top; the closed editor already put its card there
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
    <div class="form-field a-unit">
      <label for="re-unit">Pour amounts in</label>
      <select id="re-unit" value={unit} disabled={copy.equalSplit} onchange={(e) => setUnit(e.currentTarget.value as 'g' | '%')}>
        <option value="g">Grams</option>
        <option value="%">% of water</option>
      </select>
    </div>
  </div>

  <div class="toggles">
    <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={copy.anySpeed} /> Pour speed doesn't matter</label></div>
    <div class="form-field-checkbox"><label><input type="checkbox" bind:checked={copy.equalSplit} /> Equal shares</label></div>
  </div>
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

  {#snippet pickChip(i: number, v: string, label: string)}
    <label class="chip"><input type="radio" name="re-len{i}" value={v} checked={ui[i].sel === v} onchange={() => pick(i, v)} onclick={() => focusBox(i, v)} />{label}</label>
  {/snippet}
  {#each copy.pours as p, i (i)}
    <fieldset class="pour">
      <legend>Pour {i + 1}</legend>
      <div class="pour-head">
        <label class="check"><input type="checkbox" bind:checked={p.bloom} /> Bloom</label>
        <span class="tools">
          <button class="icon-button" type="button" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="arrow-up" /></button>
          <button class="icon-button" type="button" aria-label="Move down" disabled={i === copy.pours.length - 1} onclick={() => move(i, 1)}><Icon name="arrow-down" /></button>
          <button class="icon-button" type="button" aria-label="Remove" onclick={() => { copy.pours.splice(i, 1); ui.splice(i, 1); fit(); }}><Icon name="x" /></button>
        </span>
      </div>
      {#if i === 0}<p class="starts">Starts at 0:00</p>{/if}
      {#if i === copy.pours.length - 1}
        <p class="starts">Until drained</p>
      {:else}
        <div class="trigger">
          <div class="chips" role="radiogroup" aria-label="Pour {i + 1} length">
            {@render pickChip(i, 'low', 'Water low')}
            <span class="times">
              {#each timeChips as [v, label] (v)}
                {@render pickChip(i, v, label)}
              {/each}
            </span>
            <span class="pair">
              {@render pickChip(i, 'custom', 'Custom')}
              <span class="form-field box"><input id="re-cu{i}" class="dur" aria-label="Pour {i + 1} custom length" placeholder="90s" autocomplete="off" value={ui[i].text} oninput={(e) => typeCustom(i, e.currentTarget.value)} onblur={() => (ui[i].showC = customBad(i))} /></span>
              <button type="button" class="mode-tip-button" popovertarget="re-ct-help{i}" aria-label="About custom length" aria-describedby="re-ct-help{i}"><Icon name="question" /></button>
              <div class="mode-tip" id="re-ct-help{i}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Custom length', lines: ['A number + s or m; both as 1m30s.'] }} /></div>
              {#if ui[i].showC && customBad(i)}<small class="len-err">A number + s or m; both as 1m30s</small>{/if}
            </span>
            <span class="pair">
              {@render pickChip(i, 'range', 'Range')}
              <span class="with-unit"><span class="form-field box"><input id="re-rf{i}" type="number" min="1" max="600" step="any" aria-label="Pour {i + 1} range from" value={ui[i].tt} oninput={(e) => typeRange(i, 'tt', e.currentTarget.value)} onblur={() => (ui[i].showR = rangeBad(i))} /></span>s</span>
              <span class="with-unit"><span class="form-field box"><input type="number" min="1" max="600" step="any" aria-label="Pour {i + 1} range up to" value={ui[i].tm} oninput={(e) => typeRange(i, 'tm', e.currentTarget.value)} onblur={() => (ui[i].showR = rangeBad(i))} /></span>s</span>
            </span>
          </div>
          {#if ui[i].showR && rangeBad(i)}<small class="len-err">Step length must be at least its target</small>{/if}
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

  <div class="grid settings">
    <div class="form-field"><label for="re-cmin">Pour count min</label><input id="re-cmin" type="number" min="1" step="1" bind:value={copy.pourCount.min} /></div>
    <div class="form-field"><label for="re-cmax">Pour count max</label><input id="re-cmax" type="number" min="1" step="1" bind:value={copy.pourCount.max} /></div>
    <div class="form-field">
      <div class="label-row">
        <label for="re-temp">Temp (°C)</label>
        <button type="button" class="mode-tip-button" popovertarget="re-temp-help" aria-label="About temperature" aria-describedby="re-temp-help"><Icon name="question" /></button>
      </div>
      <div class="mode-tip" id="re-temp-help" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Temperature', lines: ['A brew within ±2°C of this matches.', 'The ±2°C is fixed.'] }} /></div>
      <input id="re-temp" type="number" step="any" bind:value={copy.tempC} />
    </div>
    <div class="form-field"><label for="re-ratiotol">Ratio ±</label><input id="re-ratiotol" type="number" step="any" bind:value={copy.ratio.tol} /></div>
    <div class="form-field ratios">
      <span class="label" id="re-ratios-label">Ratios</span>
      <div class="rrow" role="group" aria-labelledby="re-ratios-label">
        {#each copy.ratio.targets as t (t)}
          <span class="rcell">
            <strong>1:{fmtRatio(t)}</strong>
            <button class="icon-button" type="button" aria-label="Remove 1:{fmtRatio(t)}" disabled={copy.ratio.targets.length <= 1} onclick={() => removeRatio(t)}><Icon name="x" /></button>
          </span>
        {/each}
        <span class="radd" class:full={maxed} use:labelTip={maxed ? fullTip : null}>
        <span class="form-field box pref">
          <span class="pre" aria-hidden="true">1:</span>
          <input id="re-ratio" type="text" inputmode="decimal" autocomplete="off" aria-label="New ratio, water per 1 of coffee" placeholder="16" disabled={maxed} bind:value={ratioText}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRatio(); } }}
            oninput={() => (ratioShow &&= ratioBad())} onblur={() => (ratioShow = ratioBad())} />
        </span>
        <button class="button button-secondary" type="button" onclick={addRatio} disabled={maxed}>Add</button>
        </span>
      </div>
      {#if ratioShow && ratioBad()}<small class="fld-err">Ratio must be between 1:5 and 1:30</small>{/if}
    </div>
    <div class="form-field notes">
      <label for="re-notes">Notes</label>
      <input id="re-notes" maxlength="40" value={copy.notes ?? ''} oninput={(e) => (copy.notes = e.currentTarget.value || null)} />
    </div>
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
  .pour { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-1) var(--space-2); display: grid; gap: var(--space-1); min-width: 0; margin: 0; }
  .pour-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .check, .form-field-checkbox label { display: flex; align-items: center; gap: var(--space-2); font-weight: 600; min-height: 2rem; }
  .starts { margin: 0; color: var(--color-text-muted); }
  .editor { --h: 2.5rem; gap: var(--space-2); }
  .grid > :global(.form-field) { margin-bottom: 0; }
  .settings { grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; }
  .notes, .ratios { grid-column: 1 / -1; }
  .label { font-weight: 600; font-size: 0.9rem; }
  .rrow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .rcell { display: inline-flex; align-items: center; gap: var(--space-1); height: var(--h); box-sizing: border-box; padding-left: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }
  .rcell .icon-button { border: 0; background: none; width: var(--h); height: var(--h); }
  .rcell .icon-button:disabled { opacity: 0.4; cursor: not-allowed; }
  .radd { display: inline-flex; align-items: center; gap: var(--space-2); }
  .radd.full > :global(*) { pointer-events: none; } /* the wrapper takes the hover and tap, so its tip opens over the disabled pair */
  .radd :global(input:disabled) { opacity: 0.5; }
  /* Inert at 5: Firefox lets a disabled input's text (and the 1: beside it) be selected, and a long press offers its menu; the tip is the only thing here. */
  .radd.full, .radd.full :global(*) { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; caret-color: transparent; }
  .pref { position: relative; width: 6rem; }
  .pre { position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
  .editor :global(.form-field.pref input:not([type='checkbox'])) { padding-left: 1.75rem; width: 100%; }
  .radd :global(.button) { height: var(--h); padding-block: 0; }
  .fld-err { color: var(--color-urgent); font-size: 0.75rem; }
  .toggles { display: grid; gap: 0; }
  select:disabled { opacity: 0.5; cursor: not-allowed; }
  .editor :global(.form-field input:not([type='checkbox'])), .editor :global(.form-field select) { height: var(--h); min-height: var(--h); box-sizing: border-box; }
  .trigger { display: grid; gap: var(--space-1); }
  .times { display: contents; } /* phones: the four presets are one full-width row */
  .pair { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .box { margin: 0; }
  .dur { width: 5.5rem; }
  .len-err { color: var(--color-urgent); font-size: 0.75rem; line-height: 1.15; max-width: 9rem; flex: 1 1 8rem; max-height: var(--h); overflow: hidden; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .with-unit { display: flex; align-items: center; gap: var(--space-1); }
  .with-unit input { width: 3.75rem; }
  .chip { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 4.75rem; box-sizing: border-box; height: var(--h); padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); font-weight: 400; white-space: nowrap; cursor: pointer; }
  .chip input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .chip:has(input:checked) { background: var(--color-accent); color: var(--color-accent-contrast); border-color: var(--color-accent); }
  .chip:has(input:focus-visible) { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .steps { white-space: pre-line; color: var(--color-text-muted); }
  .tools { display: flex; gap: var(--space-2); }
  .form-field-checkbox { align-self: end; }
  .form-field input, .form-field select { min-width: 0; max-width: 100%; }
  .form-field { min-width: 0; }
  .label-row { display: flex; align-items: center; gap: var(--space-2); }
  .editor :global(.form-actions) { margin-top: var(--space-2); }
  .editor :global(.button) { margin: 0; }
  @media (max-width: 1100px) {
    /* Phones (either way up): Name over Pour amounts beside the taller Note tags. */
    .top { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: 'name tags' 'unit tags'; }
    .a-name { grid-area: name; } .a-tags { grid-area: tags; } .a-unit { grid-area: unit; }
  }
  @media (max-width: 640px) {
    .top { grid-template-areas: 'name name' 'unit unit' 'tags tags'; }
    .settings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .form-field input:not([type='checkbox']),
    .form-field select { min-height: 44px; box-sizing: border-box; }
    .editor { --h: 44px; }
    .times { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); flex: 1 1 100%; }
    .times .chip { width: auto; }
    .check, .form-field-checkbox label { min-height: 44px; }
    .editor :global(.form-actions .button) { flex: 1 1 auto; text-align: center; }
  }
</style>
