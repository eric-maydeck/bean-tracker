<script lang="ts">
  // "Coffee added!" popup after an Add. Set `slug` to show it (a new slug
  // restarts it): 3s fully visible, then a 400ms fade, then gone. Pointer or
  // focus inside pauses the countdown (and cancels a fade); leaving resumes
  // it with at least 1s left.
  let { slug = $bindable(null) }: { slug?: string | null } = $props();

  let fading = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining = 0;
  let startedAt = 0;
  let paused = false;

  function run() {
    startedAt = Date.now();
    timer = setTimeout(() => {
      fading = true;
      timer = setTimeout(() => (slug = null), 400);
    }, remaining);
  }
  function pause() {
    if (paused) return;
    paused = true;
    clearTimeout(timer);
    remaining = fading ? 0 : remaining - (Date.now() - startedAt);
    fading = false;
  }
  // Only once neither the pointer nor focus is inside.
  function resume(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (!paused || el.matches(':hover') || el.contains(document.activeElement)) return;
    paused = false;
    remaining = Math.max(remaining, 1000);
    run();
  }

  $effect(() => {
    if (!slug) return;
    remaining = 3000;
    paused = fading = false;
    run();
    return () => clearTimeout(timer);
  });
</script>

{#if slug}
  {#key slug}
    <div class="added-toast" class:fading role="status" onmouseenter={pause} onmouseleave={resume} onfocusin={pause} onfocusout={resume}>
      Coffee added!
      <a class="button button-ghost" href="/coffees/{slug}" onclick={() => (slug = null)}>Open</a>
      <button class="button button-ghost" type="button" onclick={() => (slug = null)}>Close</button>
    </div>
  {/key}
{/if}

<style>
  /* The look of /coffees' .refresh-toast, bottom center, above the phone tab bar. */
  .added-toast {
    position: fixed;
    bottom: var(--space-5);
    left: 50%;
    z-index: 90;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-surface);
    box-shadow: var(--shadow-hover);
    font-weight: 600;
    font-size: 1.1rem;
    white-space: nowrap;
    animation: added-toast-in 150ms ease-out;
  }
  .added-toast.fading {
    opacity: 0;
    transition: opacity 400ms ease-in;
  }
  .added-toast .button {
    --button-color: var(--color-surface);
    --button-hover-fg: var(--color-text);
    margin: 0;
  }
  @media (max-width: 640px) {
    .added-toast {
      bottom: calc(56px + var(--space-3) + env(safe-area-inset-bottom, 0px));
    }
  }
  @keyframes added-toast-in {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .added-toast {
      animation: none;
    }
    .added-toast.fading {
      transition: none;
    }
  }
</style>
