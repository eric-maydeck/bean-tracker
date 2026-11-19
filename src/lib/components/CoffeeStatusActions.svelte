<script lang="ts">
  // The status action icons for one coffee (Open/Unopen, Freeze/Thaw, Archive, Delete/Unarchive). The parent decides what a
  // press does: /coffees Edit-all rows and the edit overlay stage it (`pressed` shows the staged one), the coffee page applies it.
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '#lib/components/Icon.svelte';
  import { labelTip } from '#lib/components/labelTip.ts';
  import type { CoffeeRow } from '#lib/types.ts';

  let { coffee, pressed, disabled = false, onaction, children }: {
    coffee: CoffeeRow;
    pressed?: string;
    disabled?: boolean;
    onaction: (action: string) => void;
    children?: Snippet; // leads the first row (the row's Edit/Cancel toggle)
  } = $props();

  function del() {
    if (pressed === 'delete' || confirm(`Delete ${coffee.coffee_name} by ${coffee.roaster}? This cannot be undone.`)) onaction('delete');
  }
</script>

{#snippet act(action: string, label: string, icon: IconName, cls = 'button-secondary')}
  <button class="button {cls} button-icon" type="button" aria-pressed={pressed === action} {disabled}
    onclick={() => onaction(action)} use:labelTip={label} aria-label={label}><Icon name={icon} /></button>
{/snippet}

<!-- Two fixed rows so the Actions column never wraps to a third row and squeezes the table. -->
<div class="action-stack">
  <div class="action-row">
    {@render children?.()}
    {#if coffee.status !== 'archive'}
      <button class="button button-danger button-icon" type="button" aria-pressed={pressed === 'delete'} {disabled}
        onclick={del} use:labelTip={'Delete'} aria-label="Delete"><Icon name="delete" /></button>
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
