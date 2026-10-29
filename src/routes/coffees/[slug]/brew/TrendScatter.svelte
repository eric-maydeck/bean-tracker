<script lang="ts">
  // PREVIEW-TEMP (whole file; remove at ship) variant b: grind (x) vs rating (y) scatter, brew order as a connector, Best as a star.
  import type { BrewRow } from '$lib/server/brewNow/load';
  let { brews, grinder }: { brews: BrewRow[]; grinder: string | null } = $props(); // oldest first
  const W = 340, H = 170, L = 30, R = 14, T = 12, B = 26;
  const all = $derived(brews.filter((b) => b.grinder === grinder && b.grindNum !== null));
  const pts = $derived(all.filter((b) => b.rating !== null));
  const gl = $derived(Math.min(...pts.map((p) => p.grindNum!))), gh = $derived(Math.max(...pts.map((p) => p.grindNum!)));
  const rl = $derived(Math.floor(Math.min(...pts.map((p) => p.rating!)))), rh = $derived(Math.max(rl + 1, Math.ceil(Math.max(...pts.map((p) => p.rating!)))));
  const x = (v: number) => (gh === gl ? (L + W - R) / 2 : L + ((v - gl) / (gh - gl)) * (W - L - R));
  const y = (v: number) => H - B - ((v - rl) / (rh - rl)) * (H - B - T);
  const gname = (v: number) => pts.find((p) => p.grindNum === v)?.grind;
  const label = (p: BrewRow) => `${p.localTime.slice(0, 10)}, grind ${p.grind}, rated ${p.rating}${p.best ? ', Best brew' : ''}`;
  const star = (cx: number, cy: number) =>
    Array.from({ length: 10 }, (_, k) => { const a = (Math.PI * k) / 5 - Math.PI / 2, r = k % 2 ? 4 : 9; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ');
</script>

{#if pts.length >= 2}
  <figure class="gt">
    <figcaption>Rating by grind on {grinder}</figcaption>
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Rating against grind setting for each brew on {grinder}">
      <line x1={L} x2={L} y1={T} y2={H - B} class="axis" />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} class="axis" />
      <text x={L - 5} y={y(rh) + 4} class="tick" text-anchor="end">{rh}</text>
      <text x={L - 5} y={y(rl) + 4} class="tick" text-anchor="end">{rl}</text>
      <text x={x(gl)} y={H - 8} class="tick" text-anchor={gh === gl ? 'middle' : 'start'}>{gname(gl)}</text>
      {#if gh !== gl}<text x={x(gh)} y={H - 8} class="tick" text-anchor="end">{gname(gh)}</text>{/if}
      <polyline points={pts.map((p) => `${x(p.grindNum!)},${y(p.rating!)}`).join(' ')} class="line" />
      {#each pts as p, i (p.id)}
        <a href="#brew-{p.id}" aria-label={label(p)}>
          <circle cx={x(p.grindNum!)} cy={y(p.rating!)} r="14" class="hit" />
          {#if p.best}<polygon points={star(x(p.grindNum!), y(p.rating!))} class="dot" />
          {:else}<circle cx={x(p.grindNum!)} cy={y(p.rating!)} r={i === pts.length - 1 ? 6 : 4.5} class="dot" class:last={i === pts.length - 1} />{/if}
          <title>{label(p)}</title>
        </a>
      {/each}
    </svg>
    <p class="key">Line follows brew order, large dot = latest, star = Best brew{all.length > pts.length ? `; ${all.length - pts.length} unrated not shown` : ''}.</p>
  </figure>
{/if}

<style>
  .gt { margin: 0; }
  figcaption { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--space-2); }
  svg { display: block; width: 100%; max-width: 30rem; height: auto; }
  .axis { stroke: var(--color-border); stroke-width: 1; }
  .line { fill: none; stroke: var(--color-border); stroke-width: 2; stroke-linejoin: round; }
  .tick { fill: var(--color-text-muted); font-size: 10px; }
  .dot { fill: var(--color-surface); stroke: var(--color-accent); stroke-width: 1.5; }
  polygon.dot, .dot.last { fill: var(--color-accent); }
  .hit { fill: transparent; }
  a:focus-visible .dot { stroke-width: 3; }
  .key { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); }
</style>
