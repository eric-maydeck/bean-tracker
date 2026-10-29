<script lang="ts">
  import { flip } from 'svelte/animate';
  import { toasts } from '$lib/toast.svelte';
  import ToastItem from './ToastItem.svelte';

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<!-- Newer toasts sit below older ones; when one goes, the rest slide up. -->
<div class="toast-stack">
  {#each toasts as t (t.id)}
    <div animate:flip={{ duration: reduced ? 0 : 200 }}><ToastItem {t} /></div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    top: calc(var(--space-5) + env(safe-area-inset-top, 0px));
    left: 50%;
    z-index: 90;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    max-width: calc(100vw - 2 * var(--space-4));
    pointer-events: none; /* only the toasts themselves take clicks */
  }
  .toast-stack > :global(*) {
    pointer-events: auto;
  }
</style>
