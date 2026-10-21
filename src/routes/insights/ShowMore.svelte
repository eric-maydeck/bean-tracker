<script lang="ts">
  import type { Top } from '$lib/insightsUrl';
  import { bottomInView } from '$lib/scrollToBottom';

  // Footer of a 10 → 20 → 50 list: Show less (left) steps back, Show more steps on while rows remain.
  let { count, n, set }: { count: number; n: Top | undefined; set: (v: Top | undefined) => unknown } = $props();
  const shown = $derived(Math.min(count, n ?? 10));
  const next = $derived(n === 50 ? null : n === 20 ? 50 : 20);
  let root: HTMLElement | undefined = $state();
</script>

{#if count > 10}
  <div class="top-foot" bind:this={root}>
    {#if n}<button class="button button-ghost" onclick={() => bottomInView(root, () => set(n === 50 ? 20 : undefined))}>Show less</button>{/if}
    {#if next && count > shown}<button class="button button-ghost" onclick={() => bottomInView(root, () => set(next))}>Show more</button>{/if}
  </div>
{/if}

<style>
  .top-foot {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }
  .top-foot button {
    margin: 0;
  }
  @media (max-width: 640px) {
    .top-foot button {
      min-height: 44px;
    }
  }
</style>
