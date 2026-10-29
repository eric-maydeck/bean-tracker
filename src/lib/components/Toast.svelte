<script lang="ts">
  import { flip } from 'svelte/animate';
  import { toasts } from '$lib/toast.svelte';
  import { tick } from 'svelte';
  import ToastItem from './ToastItem.svelte';

  // A small margin from the top; under a stuck bar (the Coffees controls, Insights' filter bar) when one is there.
  let top = $state('var(--space-2)');
  $effect(() => {
    if (!toasts.length) return;
    void tick().then(() => {
      const bar = document.querySelector('.filter-bar, .cbar');
      const r = bar?.getBoundingClientRect();
      top = r && r.top <= 1 && r.bottom > 0 ? `${Math.round(r.bottom) + 8}px` : 'var(--space-2)';
    });
  });

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<!-- Newer toasts sit below older ones; when one goes, the rest slide up. -->
<div class="toast-stack" style:top="calc({top} + env(safe-area-inset-top, 0px))">
  {#each toasts as t (t.id)}
    <div animate:flip={{ duration: reduced ? 0 : 200 }}><ToastItem {t} /></div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    top: calc(var(--space-2) + env(safe-area-inset-top, 0px));
    left: 50%;
    z-index: 90;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* the stack is centered; every toast starts at its left edge */
    gap: var(--space-2);
    max-width: calc(100vw - 2 * var(--space-4));
    pointer-events: none; /* only the toasts themselves take clicks */
  }
  .toast-stack > :global(*) {
    pointer-events: auto;
  }
</style>
