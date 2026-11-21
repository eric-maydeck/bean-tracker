<script lang="ts">
  import { tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { Category, CritMode, Fill, Iteration, PickCoffee, PickRules, SortGroup, SortRule } from '#lib/pick/types.ts';
  import { cleanName } from '#lib/pick/profiles.ts';
  import CritPicker from './CritPicker.svelte';

  let { custom = false, rules, coffees, eligible, names, selected, open, ontoggle, onchange, onpick, onsave, onsaveas, ondelete, onreset, onrevert, canSave, locked }: {
    rules: PickRules; coffees: PickCoffee[]; eligible: PickCoffee[]; names: string[]; selected: string; canSave: boolean; open: boolean;
    ontoggle: (open: boolean) => void; onchange: (next: PickRules) => void;
    onpick: (name: string) => void; onsave: () => void; onsaveas: (name: string) => Promise<boolean>; ondelete: () => Promise<boolean>; onreset: () => void; onrevert: () => void;
    locked: boolean; custom?: boolean; // custom: the visitor's own list, no categories, decaf or profiles
  } = $props();

  // Inline profile prompts (no window.prompt): naming a new profile, confirming an overwrite or a delete.
  let step = $state<'idle' | 'naming' | 'overwrite' | 'delete'>('idle');
  let nameInput = $state('');
  const cleaned = $derived(cleanName(nameInput));
  // A failed save keeps the prompt and the typed name; the note says why.
  async function saveNamed() {
    if (cleaned && (await onsaveas(cleaned))) { step = 'idle'; nameInput = ''; }
  }
  function submitName() {
    if (!cleaned) return;
    if (names.includes(cleaned)) step = 'overwrite';
    else saveNamed();
  }
  async function removeSelected() {
    if (await ondelete()) step = 'idle';
  }

  // Focus the panel's Close button when it opens, and the opener when it closes; start below the site header.
  let toggleEl: HTMLButtonElement | undefined = $state();
  let closeEl: HTMLButtonElement | undefined = $state();
  let top = $state(0);
  let wasOpen = false;
  let byOutside = false;
  let panelEl: HTMLElement | undefined = $state();
  let phone = $state(false); // the phone overlay is a modal: aria-modal and Tab kept inside; the desktop side bar is not
  // The side bar (desktop) starts under the site header, which scrolls away with the page; a phone's modal is centred.
  const measure = () => (phone = window.innerWidth <= 640, top = window.innerWidth > 640 ? Math.max(0, document.querySelector('nav.site-nav')?.getBoundingClientRect().bottom ?? 0) : 0);
  // It slides out as it slid in; no motion on a phone or with reduced motion.
  const slide = () => ({ x: -416, duration: matchMedia('(min-width: 641px) and (prefers-reduced-motion: no-preference)').matches ? 200 : 0 });
  $effect(() => {
    if (open) {
      wasOpen = true;
      measure();
      addEventListener('scroll', measure, { passive: true });
      addEventListener('resize', measure);
      tick().then(() => closeEl?.focus());
      return () => (removeEventListener('scroll', measure), removeEventListener('resize', measure));
    } else if (wasOpen) {
      wasOpen = false;
      if (byOutside) byOutside = false; // a click outside leaves focus on what was clicked
      else toggleEl?.focus();
    }
  });

  const CATEGORIES: [Category, string][] = [['open', 'Open'], ['backlog', 'Backlog'], ['frozen', 'Frozen']];
  const SORTS: [SortRule, string][] = [['urgency-desc', 'Urgency, high first'], ['urgency-asc', 'Urgency, low first'], ['name', 'A to Z'], ['category', 'By category']];
  const CUSTOM_SORTS: [SortRule, string][] = [['urgency-desc', 'List order'], ['urgency-asc', 'Reverse list order'], ['name', 'A–Z']];
  const ITERATIONS: [Iteration, string][] = [['asc', 'Sequential, ascending'], ['desc', 'Sequential, descending'], ['evens', 'Evens first, then odds'], ['odds', 'Odds first, then evens'], ['random', 'Random (fixed for the day)']];
  const FILLS: [Fill, string][] = [['wrap', 'Repeat from the beginning'], ['snake', 'Snake (1 to 20 and back)'], ['shuffle', 'Shuffle everything'], ['cross', 'Cross out (roll again)']];
  const GROUP_LABEL: Record<SortGroup, string> = { open: 'Open', backlog: 'Backlog', frozen: 'Frozen', decaf: 'Decaf' };

  const set = (patch: Partial<PickRules>) => onchange({ ...rules, ...patch });
  const toggleCategory = (c: Category, on: boolean) => set({ categories: CATEGORIES.map(([k]) => k).filter((k) => (k === c ? on : rules.categories.includes(k))) });
  const move = (i: number, d: number) => {
    const o = [...rules.categoryOrder];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    set({ categoryOrder: o });
  };
  // A coffee sits in at most one crit: picking it in one list drops it from the other.
  const setCrit = (which: 'critSuccess' | 'critFail', ids: number[]) => {
    const other = which === 'critSuccess' ? 'critFail' : 'critSuccess';
    set({ [which]: ids, [other]: rules[other].filter((x) => !ids.includes(x)) });
  };

  const on = (which: 'critSuccess' | 'critFail') => (which === 'critSuccess' ? rules.critSuccessOn : rules.critFailOn);
  const mode = (which: 'critSuccess' | 'critFail') => (which === 'critSuccess' ? rules.critSuccessMode : rules.critFailMode);
  const setOn = (which: 'critSuccess' | 'critFail', v: boolean) => set(which === 'critSuccess' ? { critSuccessOn: v } : { critFailOn: v });
  const setMode = (which: 'critSuccess' | 'critFail', v: CritMode) => set(which === 'critSuccess' ? { critSuccessMode: v } : { critFailMode: v });

  // A click outside the desktop side bar closes it like Close (the opener returns focus). Not on the opener itself (it toggles), inside a popup or tooltip, or while a dialog is open; a phone's overlay has its own backdrop click.
  const onOutside = (e: MouseEvent) => {
    if (!open || window.innerWidth <= 640 || !(e.target instanceof Element) || !e.target.isConnected) return;
    if (e.target.closest('.rules-panel, .float-tip, .modal-backdrop, dialog') || toggleEl?.contains(e.target) || document.querySelector('dialog[open]')) return;
    byOutside = true;
    ontoggle(false);
  };
  // Escape closes the panel; on a phone Tab and Shift+Tab stay inside it (the same trap as the result pop-up), unless a dialog is on top.
  function onkey(e: KeyboardEvent) {
    if (!open || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') return ontoggle(false);
    if (e.key !== 'Tab' || !phone || !panelEl) return;
    const els = [...panelEl.querySelectorAll<HTMLElement>('button, input, select')].filter((el) => el.offsetParent && !el.matches(':disabled'));
    const [first, last] = [els[0], els[els.length - 1]];
    if (!first || !last) return;
    if (!panelEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
</script>

{#snippet crit(label: string, which: 'critSuccess' | 'critFail', spot: string)}
  <div class="crit">
    <label class="filter-value"><input type="checkbox" checked={on(which)} onchange={(e) => setOn(which, e.currentTarget.checked)} /> {label}</label>
    {#if on(which)}
      <div class="sub" role="radiogroup" aria-label={`${label} holds`}>
        <label class="filter-value"><input type="radio" name={`${which}-mode`} checked={mode(which) === 'spot'} onchange={() => setMode(which, 'spot')} /> The coffee in that spot ({spot})</label>
        <label class="filter-value"><input type="radio" name={`${which}-mode`} checked={mode(which) === 'specific'} onchange={() => setMode(which, 'specific')} /> Specific coffees</label>
        {#if which === 'critSuccess' && mode(which) === 'spot'}
          <label class="filter-value sub"><input type="checkbox" checked={rules.highestIsCrit} onchange={(e) => set({ highestIsCrit: e.currentTarget.checked })} /> <span>Highest number is crit success <span class="text-muted">when fewer than 20 coffees</span></span></label>
        {/if}
        {#if mode(which) === 'specific'}
          <CritPicker label={`${label} coffees`} {coffees} group={rules.groupBags} selected={rules[which]} onchange={(ids) => setCrit(which, ids)} />
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<svelte:window onkeydown={onkey} onclick={onOutside} />

<button type="button" class="button button-secondary toggle" bind:this={toggleEl} aria-expanded={open} onclick={() => ontoggle(!open)}>Rules</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled on the window) -->
  <div class="modal-backdrop rules-backdrop" style:top="{top}px" onclick={(e) => e.target === e.currentTarget && window.innerWidth <= 640 && ontoggle(false)}>
    <section class="modal rules-panel" role="dialog" aria-modal={phone ? 'true' : undefined} aria-label="Rules" bind:this={panelEl} in:fly={slide()} out:fly={slide()}>
      <header class="bar">
        <h3>Rules</h3>
        <button type="button" class="button button-secondary" bind:this={closeEl} onclick={() => ontoggle(false)}>Close</button>
      </header>
      <fieldset class="body" disabled={locked}>
        <fieldset>
          <legend>Pool</legend>
          {#if !custom}
          <div class="line">
            {#each CATEGORIES as [k, label] (k)}
              <label class="filter-value"><input type="checkbox" checked={rules.categories.includes(k)} onchange={(e) => toggleCategory(k, e.currentTarget.checked)} /> {label}</label>
            {/each}
          </div>
          <label class="filter-value"><input type="checkbox" checked={rules.includeDecaf} onchange={(e) => set({ includeDecaf: e.currentTarget.checked })} /> Include decaf</label>
          <label class="filter-value sub"><input type="checkbox" checked={rules.includeFrozenDecaf} disabled={!rules.includeDecaf} onchange={(e) => set({ includeFrozenDecaf: e.currentTarget.checked })} /> Include frozen decaf</label>
          {/if}
          <label class="filter-value"><input type="checkbox" checked={rules.groupBags} onchange={(e) => set({ groupBags: e.currentTarget.checked })} /> <span>Group bags of the same coffee <span class="text-muted">(open bag first)</span></span></label>
          <label class="field">Sort
            <select class="ctl-select" value={rules.sort} onchange={(e) => set({ sort: e.currentTarget.value as SortRule })}>
              {#each custom ? CUSTOM_SORTS : SORTS as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
          {#if rules.sort === 'category' && !custom}
            <ol class="order" aria-label="Category order">
              {#each rules.categoryOrder as g, i (g)}
                <li>
                  <span>{GROUP_LABEL[g]}</span>
                  <button type="button" class="button button-secondary" disabled={i === 0} aria-label={`Move ${GROUP_LABEL[g]} up`} onclick={() => move(i, -1)}>Up</button>
                  <button type="button" class="button button-secondary" disabled={i === rules.categoryOrder.length - 1} aria-label={`Move ${GROUP_LABEL[g]} down`} onclick={() => move(i, 1)}>Down</button>
                </li>
              {/each}
            </ol>
          {/if}
          <div class="line" role="radiogroup" aria-label="More than 20 coffees">
            <label class="filter-value"><input type="radio" name="over20" checked={rules.over20 === 'first20'} onchange={() => set({ over20: 'first20' })} /> First 20</label>
            <label class="filter-value"><input type="radio" name="over20" checked={rules.over20 === 'byHand'} onchange={() => set({ over20: 'byHand' })} /> Exclude specific coffees</label>
          </div>
          {#if rules.over20 === 'byHand'}
            <CritPicker label="Excluded coffees" group={rules.groupBags} requireSearch coffees={eligible} known={coffees} selected={rules.excluded} onchange={(ids) => set({ excluded: ids })} />
          {/if}
        </fieldset>

        <fieldset>
          <legend>Crits</legend>
          {@render crit('Crit fail', 'critFail', '#1')}
          {@render crit('Crit success', 'critSuccess', '#20')}
        </fieldset>

        <fieldset>
          <legend>D20 numbering</legend>
          <label class="field">Order
            <select class="ctl-select" value={rules.iteration} onchange={(e) => set({ iteration: e.currentTarget.value as Iteration })}>
              {#each ITERATIONS as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
          <label class="field">Fewer coffees than numbers
            <select class="ctl-select" value={rules.fill} onchange={(e) => set({ fill: e.currentTarget.value as Fill })}>
              {#each FILLS as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
          <label class="filter-value"><input type="checkbox" checked={rules.fillEnds} onchange={(e) => set({ fillEnds: e.currentTarget.checked })} /> Normal 1 and 20 take part in the fill</label>
          <label class="filter-value"><input type="checkbox" checked={rules.repeats} onchange={(e) => set({ repeats: e.currentTarget.checked })} /> Repeats (a brewed coffee stays in play)</label>
        </fieldset>

        {#if custom}
          <button type="button" class="button button-ghost" onclick={onreset}>Reset to defaults</button>
        {:else}
        <fieldset class="profiles">
          <legend>Profiles</legend>
          <label class="field">Profile
            <select class="ctl-select" aria-label="Profile" value={selected} onchange={(e) => onpick(e.currentTarget.value)}>
              <option value="">{names.length ? 'Choose a profile' : 'No profiles yet'}</option>
              {#each names as n (n)}<option value={n}>{n}</option>{/each}
            </select>
          </label>
          <div class="actions">
            <button type="button" class="button button-success" disabled={!canSave} onclick={onsave}>Save</button>
            <button type="button" class="button button-danger" disabled={!canSave} onclick={onrevert}>Revert</button>
            <button type="button" class="button button-success" onclick={() => (step = 'naming')}>Save as…</button>
            <button type="button" class="button button-danger" disabled={!selected} onclick={() => (step = 'delete')}>Delete</button>
            <button type="button" class="button button-ghost wide" onclick={onreset}>Reset to defaults</button>
          </div>
          {#if step === 'naming'}
            <div class="actions">
              <input class="search-input name" type="text" maxlength="40" placeholder="Profile name" aria-label="Profile name" bind:value={nameInput} onkeydown={(e) => e.key === 'Enter' && submitName()} />
              <button type="button" class="button" disabled={!cleaned} onclick={submitName}>Save</button>
              <button type="button" class="button button-secondary" onclick={() => (step = 'idle')}>Cancel</button>
            </div>
          {:else if step === 'overwrite'}
            <div class="actions" role="alert">
              <span>Overwrite "{cleaned}"?</span>
              <button type="button" class="button" onclick={saveNamed}>Overwrite</button>
              <button type="button" class="button button-secondary" onclick={() => (step = 'naming')}>Back</button>
            </div>
          {:else if step === 'delete'}
            <div class="actions" role="alert">
              <span>Delete "{selected}"?</span>
              <button type="button" class="button button-danger" onclick={removeSelected}>Delete</button>
              <button type="button" class="button button-secondary" onclick={() => (step = 'idle')}>Cancel</button>
            </div>
          {/if}
        </fieldset>
        {/if}
      </fieldset>
    </section>
  </div>
{/if}

<style>
  /* Desktop: a left side bar over the page (no backdrop, the game stays usable). Phone: the shared centred modal. */
  .toggle { padding-block: 0.4rem; } /* the Game buttons' height (.tab-group button) */
  .bar { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
  .bar h3 { margin: 0; }
  @media (min-width: 641px) {
    .rules-backdrop { background: none; justify-content: flex-start; align-items: stretch; padding: 0; pointer-events: none; }
    .rules-panel { pointer-events: auto; width: min(26rem, 90vw); max-height: none; height: 100%; border-radius: 0 var(--radius) var(--radius) 0; box-shadow: var(--shadow-hover); border-right: 1px solid var(--color-border); }
  }
  fieldset.body { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: var(--space-2); }
  fieldset { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: 0; display: grid; gap: var(--space-1); min-width: 0; }
  legend { font-weight: 600; padding: 0 var(--space-2); }
  .line { display: flex; flex-wrap: wrap; gap: 0 var(--space-4); align-items: center; }
  label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: 30px; cursor: pointer; }
  .field { display: grid; gap: var(--space-1); min-height: 0; }
  .field .ctl-select { width: 100%; }
  .sub { margin-left: var(--space-5); }
  .crit { display: grid; gap: var(--space-1); }
  .crit .sub { align-items: flex-start; } /* box left, label and hint right */
  .crit .sub .sub { margin-left: var(--space-5); }
  .crit .sub label { align-items: flex-start; } /* the box stays on the first line when the hint wraps */
  .order { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-1); }
  .order li { display: flex; gap: var(--space-2); align-items: center; }
  .order span { min-width: 5rem; }
  /* equal buttons in an even grid; a prompt row (name or confirm) keeps its own flow */
  .actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); align-items: center; }
  .actions :global(.button) { margin: 0; justify-content: center; }
  .name { margin: 0; min-width: 0; grid-column: 1 / -1; }
  .actions .wide { grid-column: 1 / -1; }
  .actions > span { grid-column: 1 / -1; }
  @media (max-width: 640px) { .name { min-height: 44px; font-size: 16px; } label { min-height: 44px; } .rules-panel :global(.ctl-select) { width: 100%; } .actions :global(.button), .bar :global(.button), .order :global(.button) { min-height: 44px; } }
</style>
