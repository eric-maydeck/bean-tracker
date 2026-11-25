<script lang="ts">
  import { navigating } from '$app/state';
  import { untrack } from 'svelte';

  // A thin bar for a navigation that is still waiting after 150ms (fast switches never show it); it fills on arrival.
  let phase = $state<'idle' | 'run' | 'done'>('idle');
  $effect(() => {
    if (navigating.to) {
      const t = setTimeout(() => (phase = 'run'), 150);
      return () => clearTimeout(t);
    }
    if (untrack(() => phase) === 'run') {
      phase = 'done';
      const t = setTimeout(() => (phase = 'idle'), 300);
      return () => clearTimeout(t);
    }
  });
</script>

{#if phase !== 'idle'}<div class="nav-progress" data-phase={phase} aria-hidden="true"></div>{/if}

<style>
  .nav-progress {
    position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 1000; pointer-events: none;
    background: var(--color-accent); transform-origin: left; transform: scaleX(0.1);
    animation: grow 8s cubic-bezier(0.1, 0.6, 0.2, 1) forwards;
  }
  .nav-progress[data-phase='done'] { animation: none; transform: scaleX(1); opacity: 0; transition: transform 0.15s, opacity 0.3s; }
  @keyframes grow { to { transform: scaleX(0.9); } }
  @media (prefers-reduced-motion: reduce) {
    .nav-progress { animation: none; transform: scaleX(1); }
    .nav-progress[data-phase='done'] { transition: none; }
  }
</style>
