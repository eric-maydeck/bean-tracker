<script lang="ts">
  import { toast } from '$lib/toast.svelte';

  const VISIBLE_MS = 2000;
  const FADE_MS = 400;
  let fading = $state(false);

  $effect(() => {
    void toast.n; // a new showToast restarts the countdown
    if (!toast.text) return;
    fading = false;
    const fade = setTimeout(() => (fading = true), VISIBLE_MS);
    const gone = setTimeout(() => (toast.text = null), VISIBLE_MS + FADE_MS);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  });
</script>

{#if toast.text}
  {#key toast.n}
    <div class="toast" class:fading role="status">{toast.text}</div>
  {/key}
{/if}

<style>
  /* The look of AddedToast, top center. */
  .toast {
    position: fixed;
    top: calc(var(--space-5) + env(safe-area-inset-top, 0px));
    left: 50%;
    z-index: 90;
    transform: translateX(-50%);
    max-width: calc(100vw - 2 * var(--space-4));
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    box-shadow: var(--shadow-hover);
    font-weight: 600;
    font-size: 1.05rem;
    text-align: center;
    animation: toast-in 150ms ease-out;
  }
  .toast.fading {
    opacity: 0;
    transition: opacity 400ms ease-in;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
    .toast.fading {
      transition: none;
    }
  }
</style>
