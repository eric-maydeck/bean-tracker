<script lang="ts" module>
  import type { SpendTab } from '$lib/server/insights/spend';
  import type { JumpLink } from './JumpNav.svelte';
  // Each panel task adds its section here; tiles alone have nothing to jump between.
  export function jumpLinks(_t: SpendTab): JumpLink[] {
    return [];
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState } from '$lib/insightsUrl';

  // `choose` is for the controls later panels add.
  let { t, tiles }: { t: SpendTab; choose: (c: InsightsUrlState) => void; tiles: Snippet } = $props();

  const empty = $derived(t.tiles.bags === 0);
  const emptyLine = useEmptyLine();
</script>

{@render tiles()}

<!-- Nothing bought in the period: one short line, not blank panels (rule 28). Later panels sit in the else branch. -->
{#if empty}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No bags bought in this period.')}</p></section>
{/if}
