<script lang="ts">
  // The status action icons for one coffee (Open/Unopen, Freeze/Thaw, Archive, Delete/Unarchive). The parent decides what a
  // press does: /coffees Edit-all rows and the edit overlay stage it (`pressed` shows the staged one), the coffee page applies it.
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '#lib/components/Icon.svelte';
  import { labelTip } from '#lib/components/labelTip.ts';
  import type { CoffeeRow } from '#lib/types.ts';

  let { coffee, pressed, disabled = false, stable = false, onaction, children }: {
    coffee: CoffeeRow;
    pressed?: string;
    disabled?: boolean;
    // The coffee page and edit overlay: always the same four slots (Delete, Open, Freeze, Archive), a toggle swaps in place and an
    // action that does not apply is disabled, so no press adds, removes or moves a button. The list rows stay compact.
    stable?: boolean;
    onaction: (action: string) => void;
    children?: Snippet; // leads the first row (the row's Edit/Cancel toggle)
  } = $props();

  function ask() {
    if (pressed === 'delete' || confirm(`Delete ${coffee.coffee_name} by ${coffee.roaster}? This cannot be undone.`)) onaction('delete');
  }
</script>

{#snippet act(action: string, label: string, icon: IconName, cls = 'button-secondary', why = '')}
  <button class="button {cls} button-icon" type="button" aria-pressed={pressed === action} disabled={disabled || !!why}
    onclick={() => onaction(action)} use:labelTip={why ? `${label} (${why})` : label} aria-label={label}><Icon name={icon} /></button>
{/snippet}

{#snippet del()}
  <button class="button button-danger button-icon" type="button" aria-pressed={pressed === 'delete'} {disabled}
    onclick={ask} use:labelTip={'Delete'} aria-label="Delete"><Icon name="delete" /></button>
{/snippet}

{#if stable}
  {@const backlog = coffee.status === 'backlog'}
  <div class="action-stack">
    <div class="action-row">
      {@render del()}
      {#if coffee.status === 'open'}
        {@render act('unopen', 'Unopen', 'unopen')}
      {:else}
        {@render act('open', 'Open', 'open', '', backlog ? '' : 'not for archived coffees')}
      {/if}
      {#if backlog && coffee.frozen_start_date && !coffee.frozen_end_date}
        {@render act('thaw', 'Thaw', 'thaw')}
      {:else}
        {@render act('freeze', 'Freeze', 'freeze', 'button-secondary', backlog ? '' : 'only for unopened coffees')}
      {/if}
      {#if coffee.status === 'archive'}
        {@render act('unarchive', 'Unarchive', 'restore')}
      {:else}
        {@render act('archive', 'Archive', 'archive')}
      {/if}
    </div>
  </div>
{:else}
<!-- Two fixed rows so the Actions column never wraps to a third row and squeezes the table. -->
<div class="action-stack">
  <div class="action-row">
    {@render children?.()}
    {#if coffee.status !== 'archive'}
      {@render del()}
    {:else}
      {@render act('unarchive', 'Unarchive', 'restore')}
    {/if}
  </div>
  {#if coffee.status !== 'archive'}
    <div class="action-row">
      {#if coffee.status === 'backlog'}
        {@render act('open', 'Open', 'open', '')}
        {#if coffee.frozen_start_date && !coffee.frozen_end_date}
          {@render act('thaw', 'Thaw', 'thaw')}
        {:else}
          {@render act('freeze', 'Freeze', 'freeze')}
        {/if}
      {:else if coffee.status === 'open'}
        {@render act('unopen', 'Unopen', 'unopen')}
      {/if}
      {@render act('archive', 'Archive', 'archive')}
    </div>
  {/if}
</div>
{/if}
