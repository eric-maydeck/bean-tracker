<script lang="ts">
  import type { BrewRow } from '$lib/server/brewNow/load';
  import { RATING_MAX } from '$lib/rating';

  // Grind (y) over brew order (x) on the chosen grinder, one dot per brew. Dot depth = rating (one hue, light to
  // dark); unrated = hollow; Best brew = star. Each dot links to its row in the list below.
  let { brews, grinder }: { brews: BrewRow[]; grinder: string | null } = $props(); // brews: oldest first

  const W = 340, H = 150, L = 34, R = 12, T = 12, B = 22;
  const pts = $derived(brews.filter((b) => b.grinder === grinder && b.grindNum !== null));
  const lo = $derived(Math.min(...pts.map((p) => p.grindNum!))), hi = $derived(Math.max(...pts.map((p) => p.grindNum!)));
  const x = (i: number) => L + (pts.length < 2 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1));
  const y = (v: number) => (hi === lo ? (H - B + T) / 2 : H - B - ((v - lo) / (hi - lo)) * (H - B - T));
  const fill = (r: number | null) => (r === null ? 'none' : `color-mix(in srgb, var(--color-accent) ${Math.round(25 + (75 * r) / RATING_MAX)}%, var(--color-surface))`);
  const label = (p: BrewRow) => `${p.localTime.slice(0, 10)}, grind ${p.grind}${p.rating !== null ? `, rated ${p.rating}` : ', unrated'}${p.best ? ', Best brew' : ''}`;
  const star = (cx: number, cy: number) =>
    Array.from({ length: 10 }, (_, k) => { const a = (Math.PI * k) / 5 - Math.PI / 2, r = k % 2 ? 4 : 9; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ');
</script>

{#if pts.length >= 2}
  <figure class="gt">
    <figcaption>Grind on {grinder}, brew by brew</figcaption>
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Grind setting for each brew on {grinder}, oldest to newest">
      <line x1={L} x2={L} y1={T} y2={H - B} class="axis" />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} class="axis" />
      <text x={L - 5} y={y(hi) + 4} class="tick" text-anchor="end">{pts.find((p) => p.grindNum === hi)?.grind}</text>
      {#if hi !== lo}<text x={L - 5} y={y(lo) + 4} class="tick" text-anchor="end">{pts.find((p) => p.grindNum === lo)?.grind}</text>{/if}
      <text x={L} y={H - 6} class="tick">oldest</text>
      <text x={W - R} y={H - 6} class="tick" text-anchor="end">newest</text>
      <polyline points={pts.map((p, i) => `${x(i)},${y(p.grindNum!)}`).join(' ')} class="line" />
      {#each pts as p, i (p.id)}
        <a href="#brew-{p.id}" aria-label={label(p)}>
          <circle cx={x(i)} cy={y(p.grindNum!)} r="14" class="hit" />
          {#if p.best}
            <polygon points={star(x(i), y(p.grindNum!))} class="dot" style:fill={fill(p.rating) === 'none' ? 'var(--color-surface)' : fill(p.rating)} />
          {:else}
            <circle cx={x(i)} cy={y(p.grindNum!)} r="5" class="dot" style:fill={fill(p.rating)} />
          {/if}
          <title>{label(p)}</title>
        </a>
      {/each}
    </svg>
    <p class="key">Darker dot = higher rating, hollow = unrated, star = Best brew.</p>
  </figure>
{/if}

<style>
  .gt { margin: 0; }
  figcaption { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--space-2); }
  svg { display: block; width: 100%; max-width: 30rem; height: auto; }
  .axis { stroke: var(--color-border); stroke-width: 1; }
  .line { fill: none; stroke: var(--color-border); stroke-width: 2; }
  .tick { fill: var(--color-text-muted); font-size: 10px; }
  .dot { stroke: var(--color-accent); stroke-width: 1.5; }
  .hit { fill: transparent; }
  a:focus-visible .dot { stroke-width: 3; }
  .key { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); }
</style>
