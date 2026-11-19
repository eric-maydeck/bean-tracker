<script lang="ts">
  import type { Category, Fill, Iteration, PickCoffee, PickRules, SortGroup, SortRule } from '#lib/pick/types.ts';

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
  // A coffee sits in at most one crit: ticking it in one list unticks it in the other.
  const setCrit = (which: 'critSuccess' | 'critFail', id: number, on: boolean) => {
    const other = which === 'critSuccess' ? 'critFail' : 'critSuccess';
    set({ [which]: toggled(rules[which], id, on), [other]: rules[other].filter((x) => x !== id) });
  };
  const byName = (a: PickCoffee, b: PickCoffee) => a.name.localeCompare(b.name);
  const sorted = $derived([...coffees].sort(byName));
</script>

{#snippet critList(which: 'critSuccess' | 'critFail', label: string)}
  <details class="crit">
    <summary>{label} ({rules[which].length})</summary>
    <ul class="checks">
      {#each sorted as c (c.id)}
        <li><label><input type="checkbox" checked={rules[which].includes(c.id)} onchange={(e) => setCrit(which, c.id, e.currentTarget.checked)} /> {c.name}</label></li>
      {/each}
    </ul>
  </details>
{/snippet}

<section class="rules" aria-label="Rules">
  <button type="button" class="button button-secondary toggle" aria-expanded={open} onclick={() => ontoggle(!open)}>Rules</button>
  {#if open}
    <fieldset class="body" disabled={locked}>
      <fieldset>
        <legend>Pool</legend>
        <div class="line">
          {#each CATEGORIES as [k, label] (k)}
            <label><input type="checkbox" checked={rules.categories.includes(k)} onchange={(e) => toggleCategory(k, e.currentTarget.checked)} /> {label}</label>
          {/each}
        </div>
        <div class="line">
          <label><input type="checkbox" checked={rules.includeDecaf} onchange={(e) => set({ includeDecaf: e.currentTarget.checked })} /> Include decaf</label>
          <label class="sub"><input type="checkbox" checked={rules.includeFrozenDecaf} disabled={!rules.includeDecaf} onchange={(e) => set({ includeFrozenDecaf: e.currentTarget.checked })} /> Include frozen decaf</label>
        </div>
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
          <label><input type="radio" name="over20" checked={rules.over20 === 'byHand'} onchange={() => set({ over20: 'byHand' })} /> Exclude by hand</label>
        </div>
        {#if rules.over20 === 'byHand'}
          <ul class="checks" aria-label="Eligible coffees">
            {#each eligible as c (c.id)}
              <li><label><input type="checkbox" checked={!rules.excluded.includes(c.id)} onchange={(e) => set({ excluded: toggled(rules.excluded, c.id, !e.currentTarget.checked) })} /> {c.name}</label></li>
            {/each}
          </ul>
        {/if}
      </fieldset>

      <fieldset>
        <legend>Crits</legend>
        {@render critList('critSuccess', 'Critical success (gold, 20)')}
        {@render critList('critFail', 'Critical fail (black, 1)')}
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
        <div class="line">
          <label><input type="checkbox" checked={rules.fillEnds} onchange={(e) => set({ fillEnds: e.currentTarget.checked })} /> Normal 1 and 20 take part in the fill</label>
          <label><input type="checkbox" checked={rules.repeats} onchange={(e) => set({ repeats: e.currentTarget.checked })} /> Repeats (a brewed coffee stays in play)</label>
        </div>
      </fieldset>

      <div class="line actions">
        {#if admin}
          <button type="button" class="button button-secondary" onclick={onsave}>Save</button>
          <button type="button" class="button button-secondary" disabled={!hasSaved} onclick={onload}>Load</button>
        {/if}
        <button type="button" class="button button-secondary" onclick={onreset}>Reset to defaults</button>
        <span class="text-muted note" role="status">{note}</span>
      </div>
    </fieldset>
  {/if}
</section>

<style>
  .rules { margin: var(--space-3) 0; }
  fieldset.body { border: 0; padding: 0; margin: var(--space-3) 0 0; min-width: 0; }
  .body { margin-top: var(--space-3); display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); align-items: start; }
  .body .actions { grid-column: 1 / -1; }
  fieldset { border: 1px solid var(--color-border); border-radius: var(--radius); padding: var(--space-3); margin: 0; display: grid; gap: var(--space-2); min-width: 0; }
  legend { font-weight: 600; padding: 0 var(--space-2); }
  .line { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; }
  label { display: inline-flex; gap: var(--space-2); align-items: center; min-height: 44px; }
  .field { display: grid; gap: var(--space-1); min-height: 0; }
  .checks { list-style: none; margin: 0; padding: 0; max-height: 14rem; overflow: auto; }
  .checks label { min-height: 36px; }
  .order { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-1); }
  .order li { display: flex; gap: var(--space-2); align-items: center; }
  .order span { min-width: 5rem; }
  .sub { margin-left: var(--space-5); }
  summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .note { min-width: 0; }
  @media (max-width: 640px) { .rules :global(.ctl-select) { width: 100%; } }
</style>
