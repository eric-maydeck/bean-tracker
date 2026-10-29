<script lang="ts">
  // PREVIEW-TEMP (whole file; remove at ship) variant c: one row per brew, grind on a shared axis, rating as the bar's fill and number.
  import type { BrewRow } from '$lib/server/brewNow/load';
  let { brews, grinder }: { brews: BrewRow[]; grinder: string | null } = $props(); // oldest first
  const pts = $derived(brews.filter((b) => b.grinder === grinder && b.grindNum !== null));
  const lo = $derived(Math.min(...pts.map((p) => p.grindNum!))), hi = $derived(Math.max(...pts.map((p) => p.grindNum!)));
  // Position 4%..96% of the track (a single grind sits in the middle).
  const pos = (v: number) => (hi === lo ? 50 : 4 + ((v - lo) / (hi - lo)) * 92);
  const rs = $derived(pts.flatMap((p) => p.rating ?? [])), rlo = $derived(Math.min(...rs)), rhi = $derived(Math.max(...rs));
  // Depth is scaled over this coffee's own rating range, so small differences still read.
  const fill = (r: number) => `color-mix(in srgb, var(--color-accent) ${Math.round(rhi === rlo ? 70 : 25 + (75 * (r - rlo)) / (rhi - rlo))}%, var(--color-surface))`;
  const label = (p: BrewRow) => `${p.localTime.slice(0, 10)}, grind ${p.grind}${p.rating !== null ? `, rated ${p.rating}` : ', unrated'}${p.best ? ', Best brew' : ''}`;
  const gname = (v: number) => pts.find((p) => p.grindNum === v)?.grind;
</script>

{#if pts.length >= 2}
  <figure class="gt">
    <figcaption>Grind on {grinder}, one row per brew</figcaption>
    <div class="axis"><span>{gname(lo)}</span><span>{gname(hi)}</span></div>
    <ul>
      {#each pts as p (p.id)}
        <li>
          <a href="#brew-{p.id}" aria-label={label(p)}>
            <span class="d">{p.localTime.slice(5, 10)}</span>
            <span class="track"><span class="mk" class:none={p.rating === null} style:left="{pos(p.grindNum!)}%" style:background={p.rating === null ? 'transparent' : fill(p.rating)}>{p.best ? '★' : ''}</span></span>
            <span class="r">{p.rating ?? '–'}</span>
          </a>
        </li>
      {/each}
    </ul>
    <p class="key">Position = grind, darker = higher rating (within this coffee), hollow = unrated, ★ = Best brew. Oldest first.</p>
  </figure>
{/if}

<style>
  .gt { margin: 0; }
  figcaption { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--space-2); }
  .axis { display: flex; justify-content: space-between; margin: 0 2.4rem 0 3rem; font-size: 0.7rem; color: var(--color-text-muted); }
  ul { list-style: none; margin: 0; padding: 0; max-width: 30rem; }
  a { display: grid; grid-template-columns: 2.8rem 1fr 2rem; align-items: center; gap: var(--space-2); min-height: 1.6rem; color: inherit; text-decoration: none; font-size: 0.8rem; }
  a:focus-visible { outline: 2px solid var(--color-accent); }
  .d { color: var(--color-text-muted); }
  .track { position: relative; height: 1.1rem; border-bottom: 1px solid var(--color-border); }
  .mk { position: absolute; top: 50%; width: 1.1rem; height: 1.1rem; margin: -0.55rem 0 0 -0.55rem; box-sizing: border-box; border: 1.5px solid var(--color-accent);
    border-radius: 50%; display: grid; place-items: center; font-size: 0.7rem; line-height: 1; color: var(--color-text); }
  .r { text-align: right; font-weight: 600; }
  .key { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); }
</style>
