<script lang="ts">
  import type { Category, CritMode, Fill, Iteration, PickCoffee, PickRules, SortGroup, SortRule } from '#lib/pick/types.ts';
  import CritPicker from './CritPicker.svelte';

  let { rules, coffees, eligible, admin, hasSaved, open, ontoggle, onchange, onsave, onload, onreset, note, locked }: {
    rules: PickRules; coffees: PickCoffee[]; eligible: PickCoffee[]; admin: boolean; hasSaved: boolean; open: boolean;
    ontoggle: (open: boolean) => void; onchange: (next: PickRules) => void;
    onsave: () => void; onload: () => void; onreset: () => void; note: string; locked: boolean;
  } = $props();

  const CATEGORIES: [Category, string][] = [['open', 'Open'], ['backlog', 'Backlog'], ['frozen', 'Frozen']];
  const SORTS: [SortRule, string][] = [['urgency-desc', 'Urgency, high first'], ['urgency-asc', 'Urgency, low first'], ['name', 'A to Z'], ['category', 'By category']];
  const ITERATIONS: [Iteration, string][] = [['asc', 'Sequential, ascending'], ['desc', 'Sequential, descending'], ['evens', 'Evens first, then odds'], ['odds', 'Odds first, then evens'], ['random', 'Random (fixed for the day)']];
  const FILLS: [Fill, string][] = [['wrap', 'Repeat from the beginning'], ['snake', 'Snake (1 to 20 and back)'], ['shuffle', 'Shuffle everything'], ['cross', 'Cross out (roll again)']];
  const GROUP_LABEL: Record<SortGroup, string> = { open: 'Open', backlog: 'Backlog', frozen: 'Frozen', decaf: 'Decaf' };

  const set = (patch: Partial<PickRules>) => onchange({ ...rules, ...patch });
  const toggled = (list: number[], id: number, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
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

  // Escape closes the panel, unless a dialog (the rule-change confirm) is on top of it.
  const onkey = (e: KeyboardEvent) => e.key === 'Escape' && open && !document.querySelector('dialog[open]') && ontoggle(false);
</script>

{#snippet crit(label: string, which: 'critSuccess' | 'critFail', spot: string)}
  <div class="crit">
    <label><input type="checkbox" checked={on(which)} onchange={(e) => setOn(which, e.currentTarget.checked)} /> {label}</label>
    {#if on(which)}
      <div class="sub" role="radiogroup" aria-label={`${label} holds`}>
        <label><input type="radio" name={`${which}-mode`} checked={mode(which) === 'spot'} onchange={() => setMode(which, 'spot')} /> The coffee in that spot ({spot})</label>
        <label><input type="radio" name={`${which}-mode`} checked={mode(which) === 'specific'} onchange={() => setMode(which, 'specific')} /> Specific coffees</label>
        {#if which === 'critSuccess' && mode(which) === 'spot'}
          <label class="sub"><input type="checkbox" checked={rules.highestIsCrit} onchange={(e) => set({ highestIsCrit: e.currentTarget.checked })} /> Highest number is crit success <span class="text-muted">when fewer than 20 coffees</span></label>
        {/if}
        {#if mode(which) === 'specific'}
          <CritPicker label={`${label} coffees`} {coffees} selected={rules[which]} onchange={(ids) => setCrit(which, ids)} />
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

<svelte:window onkeydown={onkey} />

<button type="button" class="button button-secondary toggle" aria-expanded={open} onclick={() => ontoggle(!open)}>Rules</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled on the window) -->
  <div class="modal-backdrop rules-backdrop" onclick={(e) => e.target === e.currentTarget && window.innerWidth <= 640 && ontoggle(false)}>
    <section class="modal rules-panel" role="dialog" aria-label="Rules">
      <header class="bar">
        <h3>Rules</h3>
        <button type="button" class="button button-secondary" onclick={() => ontoggle(false)}>Close</button>
      </header>
      <fieldset class="body" disabled={locked}>
        <fieldset>
          <legend>Pool</legend>
          <div class="line">
            {#each CATEGORIES as [k, label] (k)}
              <label><input type="checkbox" checked={rules.categories.includes(k)} onchange={(e) => toggleCategory(k, e.currentTarget.checked)} /> {label}</label>
            {/each}
          </div>
          <label><input type="checkbox" checked={rules.includeDecaf} onchange={(e) => set({ includeDecaf: e.currentTarget.checked })} /> Include decaf</label>
          <label class="sub"><input type="checkbox" checked={rules.includeFrozenDecaf} disabled={!rules.includeDecaf} onchange={(e) => set({ includeFrozenDecaf: e.currentTarget.checked })} /> Include frozen decaf</label>
          <label class="field">Sort
            <select class="ctl-select" value={rules.sort} onchange={(e) => set({ sort: e.currentTarget.value as SortRule })}>
              {#each SORTS as [k, label] (k)}<option value={k}>{label}</option>{/each}
            </select>
          </label>
          {#if rules.sort === 'category'}
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
            <label><input type="radio" name="over20" checked={rules.over20 === 'first20'} onchange={() => set({ over20: 'first20' })} /> First 20</label>
            <label><input type="radio" name="over20" checked={rules.over20 === 'byHand'} onchange={() => set({ over20: 'byHand' })} /> Exclude specific coffees</label>
          </div>
          {#if rules.over20 === 'byHand'}
            <ul class="checks" aria-label="Eligible coffees">
              {#each eligible as c (c.id)}
                <li><label><input type="checkbox" checked={!rules.excluded.includes(c.id)} onchange={(e) => set({ excluded: toggled(rules.excluded, c.id, !e.currentTarget.checked) })} /> <span>{c.name}</span> <span class="text-muted">{c.roaster}</span></label></li>
              {/each}
            </ul>
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
          <label><input type="checkbox" checked={rules.fillEnds} onchange={(e) => set({ fillEnds: e.currentTarget.checked })} /> Normal 1 and 20 take part in the fill</label>
          <label><input type="checkbox" checked={rules.repeats} onchange={(e) => set({ repeats: e.currentTarget.checked })} /> Repeats (a brewed coffee stays in play)</label>
        </fieldset>

        <div class="actions">
          {#if admin}
            <button type="button" class="button button-secondary" onclick={onsave}>Save</button>
            <button type="button" class="button button-secondary" disabled={!hasSaved} onclick={onload}>Load</button>
          {/if}
          <button type="button" class="button button-secondary" onclick={onreset}>Reset to defaults</button>
        </div>
        <span class="text-muted note" role="status">{note}</span>
      </fieldset>
    </section>
  </div>
{/if}

<style>
  /* Desktop: a left side bar over the page (no backdrop, the game stays usable). Phone: the shared centred modal. */
  .bar { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); }
  .bar h3 { margin: 0; }
  @media (min-width: 641px) {
    .rules-backdrop { background: none; justify-content: flex-start; align-items: stretch; padding: 0; pointer-events: none; }
    .rules-panel { pointer-events: auto; width: min(26rem, 90vw); max-height: none; height: 100%; border-radius: 0 var(--radius) var(--radius) 0; box-shadow: var(--shadow-hover); border-right: 1px solid var(--color-border); animation: slide-in 0.2s ease-out; }
  }
  @keyframes slide-in { from { transform: translateX(-100%); } }
  @media (prefers-reduced-motion: reduce) { .rules-panel { animation: none; } }
  fieldset.body { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: var(--space-2); }
  fieldset { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-2) var(--space-3); margin: 0; display: grid; gap: var(--space-1); min-width: 0; }
  legend { font-weight: 600; padding: 0 var(--space-2); }
  .line { display: flex; flex-wrap: wrap; gap: 0 var(--space-4); align-items: center; }
  label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: 30px; }
  .field { display: grid; gap: var(--space-1); min-height: 0; }
  .sub { margin-left: var(--space-5); }
  .crit { display: grid; gap: var(--space-1); }
  .crit .sub { display: grid; gap: 0; }
  .crit .sub .sub { margin-left: var(--space-5); }
  .checks { list-style: none; margin: 0; padding: 0; max-height: 14rem; overflow: auto; }
  .checks label { align-items: baseline; }
  .order { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-1); }
  .order li { display: flex; gap: var(--space-2); align-items: center; }
  .order span { min-width: 5rem; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-1); justify-content: flex-start; }
  .note:empty { display: none; }
  @media (max-width: 640px) { label { min-height: 44px; } .rules-panel :global(.ctl-select) { width: 100%; } .actions :global(.button), .bar :global(.button), .order :global(.button) { min-height: 44px; } }
</style>
