<script lang="ts" module>
  import type { IconName } from '$lib/components/Icon.svelte';
  import type { Kind } from '$lib/insightsUrl';
  export const LABEL: Record<Kind, string> = { counts: 'Counts', firsts: 'Firsts', bests: 'Bests', streaks: 'Streaks', gear: 'Gear', anniversaries: 'Anniversaries' };
  export const ICON: Record<Kind, IconName> = { counts: 'hash', firsts: 'sparkle', bests: 'trophy', streaks: 'fire', gear: 'gear', anniversaries: 'cake' };
</script>

<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { KINDS, type InsightsUrlState } from '$lib/insightsUrl';

  // Milestones' Kinds chips, rendered inside the sticky bar (+page.svelte).
  let { kinds, choose }: { kinds: Kind[] | undefined; choose: (c: InsightsUrlState) => void } = $props();

  // Chips: none pressed = every kind (no param).
  function toggle(k: Kind) {
    const on = kinds ?? [];
    const next = KINDS.filter((x) => (x === k ? !on.includes(x) : on.includes(x)));
    choose({ kinds: next.length ? next : undefined });
  }

</script>

<div class="kinds-bar">
  <div class="tab-group kind-chips" role="group" aria-label="Kinds" data-button-row>
    {#each KINDS as k (k)}
      <button aria-pressed={!!kinds?.includes(k)} onclick={() => toggle(k)} style:--kind="var(--kind-{k})"
        ><Icon name={ICON[k]} />{LABEL[k]}</button
      >
    {/each}
  </div>
</div>

<style>
  /* Phones: this row has no label, so it sits 3px lower to keep the bar's row gaps equal by ink (insights-bar-gaps). */
  @media (max-width: 640px) {
    .kinds-bar {
      margin-top: 3px;
    }
  }
  .kind-chips button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    padding: 0.3rem 0.75rem;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .kind-chips :global(.icon) {
    width: 1rem;
    height: 1rem;
  }
  .kind-chips button:not([aria-pressed='true']) :global(.icon) {
    color: var(--kind);
  }
  /* Phones: the six chips as a 2×3 grid of equal buttons (feedback M6). */
  @media (max-width: 640px) {
    .kind-chips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .kind-chips button {
      justify-content: center;
      padding-inline: var(--space-1);
    }
  }
</style>
