<script lang="ts">
  import { flip } from 'svelte/animate';
  import { toasts } from '#lib/toast.svelte.ts';
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

  // The stack is a manual popover (top layer) so it paints above an open modal <dialog>. A modal also makes everything outside
  // it inert, so the stack moves into the topmost modal while one is open (back to <body> otherwise) and is re-shown there.
  let stack = $state<HTMLElement>();
  function host() {
    if (!stack) return;
    const modals = document.querySelectorAll('dialog:modal');
    const to = modals.length ? modals[modals.length - 1] : document.body;
    if (stack.parentElement !== to || !stack.isConnected) to.appendChild(stack); // moving closes a popover
    if (stack.matches(':popover-open')) stack.hidePopover(); // re-show: topmost in the top layer
    if (toasts.length) stack.showPopover();
  }
  $effect(() => {
    void toasts.length;
    host();
  });
  // A dialog closing takes the stack with it (hidden): go back to <body>.
  $effect(() => {
    const back = () => host();
    document.addEventListener('close', back, true);
    return () => document.removeEventListener('close', back, true);
  });

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<!-- Newer toasts sit below older ones; when one goes, the rest slide up. -->
<div class="toast-stack" popover="manual" bind:this={stack} style:top="calc({top} + env(safe-area-inset-top, 0px))">
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
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    overflow: visible;
    color: inherit;
    inset-block-end: auto;
    inset-inline-end: auto;
    pointer-events: none; /* only the toasts themselves take clicks */
  }
  .toast-stack > :global(*) {
    pointer-events: auto;
  }
</style>
