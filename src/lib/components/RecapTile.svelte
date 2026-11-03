<script lang="ts">
  import type { RecapTileData } from '$lib/server/recaps/recap';
  import CoffeeName from '$lib/components/CoffeeName.svelte';

  let { tile }: { tile: RecapTileData } = $props();
  // Dark ink on the light tones (as Slide.svelte), cream text on the rest.
  const ink = $derived(['sun', 'amber', 'cream'].includes(tile.tone) ? '#2b211b' : '#faf7f2');
</script>

<a class="recap-tile" href={tile.href} style:--bg="var(--t-{tile.tone})" style:--fg={ink}>
  <header><h2>{tile.year}</h2>{#if tile.preview}<span class="badge">Preview</span>{/if}</header>
  <ul>
    {#each tile.headlines as h (h.label)}
      <li><b class:long={h.big.length > 7}><span class="fit" style:--w={Math.max(1, ...h.big.split(/\s+/).map((w) => w.length))}><CoffeeName text={h.big} /></span></b><span>{h.label}</span></li>
    {/each}
  </ul>
  <span class="open">Open the recap <span aria-hidden="true">→</span></span>
</a>

<style>
  .recap-tile { display: flex; flex-direction: column; justify-content: space-between; gap: 18px; padding: 20px; min-height: 260px; border-radius: 16px;
    background: var(--bg); color: var(--fg); text-decoration: none; box-sizing: border-box; }
  .recap-tile:hover { filter: brightness(1.08); }
  .recap-tile:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  h2 { font-family: var(--font-display); font-size: clamp(2.4rem, 8cqi, 3.6rem); line-height: 0.9; letter-spacing: -0.035em; margin: 0; }
  .badge { border: 1.5px solid currentColor; border-radius: 999px; padding: 2px 10px; font-size: 0.8rem; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  li { display: flex; flex-direction: column; }
  b { font-family: var(--font-display); font-size: 1.9rem; line-height: 1; letter-spacing: -0.03em; container-type: inline-size; }
  /* A word never breaks mid-word: it shrinks to fit the tile instead. */
  b .fit { display: block; font-size: min(1em, calc(100cqi / (var(--w) * 0.62))); }
  b.long { font-size: 1.35rem; }
  li > span { font-size: 0.9rem; opacity: 0.9; }
  .recap-tile :global(.coffee-name) { color: inherit !important; }
  .open { min-height: 44px; display: flex; align-items: center; font-weight: 600; }
</style>
