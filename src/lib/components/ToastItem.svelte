<script lang="ts">
  // One toast. Timing matches AddedToast ("Coffee added!"): 3 s visible (5 s on touch screens), a 400 ms fade, hover or
  // focus inside pauses the countdown, and leaving resumes it with at least 2 s left. No focus move, no backdrop.
  import { dismissToast, leaving, noteLeaving, remainingAfterLeave, undoToast, type ToastItem } from '$lib/toast.svelte';

  let { t }: { t: ToastItem } = $props();

  let fading = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining = 0;
  let startedAt = 0;
  let paused = false;

  function run() {
    startedAt = Date.now();
    timer = setTimeout(() => {
      fading = true;
      noteLeaving();
      timer = setTimeout(() => dismissToast(t.id), 400);
    }, remaining);
  }
  function pause() {
    if (paused) return;
    paused = true;
    clearTimeout(timer);
    remaining = fading ? 0 : remaining - (Date.now() - startedAt);
    fading = false;
  }
  function resume(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (!paused || el.matches(':hover') || el.contains(document.activeElement)) return;
    paused = false;
    remaining = Math.max(remaining, 2000);
    run();
  }

  // When another toast starts to leave, this one keeps at least ~1.2 s, so they go one after another, not together.
  let seenLeaving = leaving.n;
  $effect(() => {
    const n = leaving.n;
    if (n === seenLeaving) return;
    seenLeaving = n;
    if (paused || fading) return;
    const left = remaining - (Date.now() - startedAt);
    const bumped = remainingAfterLeave(left);
    if (bumped === left) return;
    clearTimeout(timer);
    remaining = bumped;
    run();
  });

  $effect(() => {
    remaining = matchMedia('(hover: none)').matches ? 5000 : 3000;
    paused = fading = false;
    run();
    return () => clearTimeout(timer);
  });
</script>

<div class="toast" class:fading role="status" onmouseenter={pause} onmouseleave={resume} onfocusin={pause} onfocusout={resume}>
  <span>{t.text}</span>
  {#if t.undo}<button class="undo" type="button" onclick={() => undoToast(t)}>Undo</button>{/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    box-shadow: var(--shadow-hover);
    font-weight: 600;
    font-size: 0.9rem;
    animation: toast-in 150ms ease-out;
  }
  .toast.fading {
    opacity: 0;
    transition: opacity 400ms ease-in;
  }
  .undo {
    flex: none; /* never squeezed by a long message */
    min-height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid currentColor;
    border-radius: var(--radius);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .undo:hover,
  .undo:focus-visible {
    background: var(--color-surface);
    color: var(--color-text);
  }
  /* Phones, portrait and landscape: a 44 px tap target; negative block margins keep the toast slim. */
  @media (max-width: 640px), (max-height: 450px) {
    .undo {
      min-width: 44px;
      min-height: 44px;
      padding-inline: var(--space-3);
      white-space: nowrap;
      margin-block: calc(-1 * var(--space-2));
    }
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
