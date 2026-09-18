<script lang="ts">
  /**
   * 5 bean icons, filled left-to-right in 0.5-bean steps, representing a
   * roast's degrees_of_roast (0-5, matching the "Roast level guide" sheet).
   */
  let { degrees, label }: { degrees: number; label?: string | null } = $props();

  const BEAN_PATH =
    'M8,1 C3,1 1,7 1,12 C1,17 3,23 8,23 C13,23 15,17 15,12 C15,7 13,1 8,1 Z';
  const CREASE_PATH = 'M8,3 C6,8 10,16 8,21';

  const fills = $derived(Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, degrees - i))));
</script>

<span class="roast-beans" title={label ?? undefined}>
  {#each fills as fill}
    <span class="roast-bean">
      <svg viewBox="0 0 16 24" class="roast-bean-bg" aria-hidden="true">
        <path d={BEAN_PATH} />
        <path class="roast-bean-crease" d={CREASE_PATH} />
      </svg>
      {#if fill > 0}
        <svg
          viewBox="0 0 16 24"
          class="roast-bean-fill"
          style={`clip-path: inset(0 ${(1 - fill) * 100}% 0 0);`}
          aria-hidden="true"
        >
          <path d={BEAN_PATH} />
          <path class="roast-bean-crease" d={CREASE_PATH} />
        </svg>
      {/if}
    </span>
  {/each}
</span>
