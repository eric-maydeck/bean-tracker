<script lang="ts">
  import type { BrewRow } from '$lib/server/brewNow/load';

  // Plain dot plot of this coffee's rated brews on the chosen grinder: grind setting on x, rating on y, the Best brew a
  // star. No time encoding. Each dot links to its row in the list below.
  let { brews, grinder, summary = [] }: { brews: BrewRow[]; grinder: string | null; summary?: string[] } = $props();

  const W = 340, H = 170, L = 30, R = 16, T = 14, B = 28;
  const pts = $derived(brews.filter((b) => b.grinder === grinder && b.grindNum !== null && b.rating !== null));
  const gl = $derived(Math.min(...pts.map((p) => p.grindNum!))), gh = $derived(Math.max(...pts.map((p) => p.grindNum!)));
  const rl = $derived(Math.floor(Math.min(...pts.map((p) => p.rating!))) - 1), rh = $derived(Math.ceil(Math.max(...pts.map((p) => p.rating!))) + 1); // padded so no dot sits on an axis
  const x = (v: number) => (gh === gl ? (L + W - R) / 2 : L + 14 + ((v - gl) / (gh - gl)) * (W - L - R - 28));
  const y = (v: number) => H - B - ((v - rl) / (rh - rl)) * (H - B - T);
  const gname = (v: number) => pts.find((p) => p.grindNum === v)?.grind;
  const label = (p: BrewRow) => `${p.localTime.slice(0, 10)}, grind ${p.grind}, rated ${p.rating}${p.best ? ', Best brew' : ''}`;
  const star = (cx: number, cy: number) =>
    Array.from({ length: 10 }, (_, k) => { const a = (Math.PI * k) / 5 - Math.PI / 2, r = k % 2 ? 4.5 : 10; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(' ');
</script>

<div class="gt">
  {#if pts.length >= 2}
    <figure>
      <figcaption>Rating by grind on {grinder}</figcaption>
      <svg viewBox="0 0 {W} {H}" role="img" aria-label="Rating against grind setting for each rated brew on {grinder}">
        <line x1={L} x2={L} y1={T} y2={H - B} class="axis" />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} class="axis" />
        <text x={L - 5} y={y(rh) + 4} class="tick" text-anchor="end">{rh}</text>
        <text x={L - 5} y={y(rl) + 4} class="tick" text-anchor="end">{rl}</text>
        <text x={x(gl)} y={H - 10} class="tick" text-anchor="middle">{gname(gl)}</text>
        {#if gh !== gl}<text x={x(gh)} y={H - 10} class="tick" text-anchor="middle">{gname(gh)}</text>{/if}
        {#each pts as p (p.id)}
          <a href="#brew-{p.id}" aria-label={label(p)}>
            <circle cx={x(p.grindNum!)} cy={y(p.rating!)} r="14" class="hit" />
            {#if p.best}<polygon points={star(x(p.grindNum!), y(p.rating!))} class="best" />
            {:else}<circle cx={x(p.grindNum!)} cy={y(p.rating!)} r="5" class="dot" />{/if}
            <title>{label(p)}</title>
          </a>
        {/each}
      </svg>
      <p class="key">Each dot is a brew; the star is the Best brew.</p>
    </figure>
  {/if}
  {#if summary.length}
    <ul class="sum">{#each summary as s (s)}<li>{s}</li>{/each}</ul>
  {/if}
</div>

<style>
  .gt { display: flex; flex-direction: column; gap: var(--space-3); }
  figure { margin: 0; }
  figcaption { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--space-2); }
  svg { display: block; width: 100%; max-width: 30rem; height: auto; }
  .axis { stroke: var(--color-border); stroke-width: 1; }
  .tick { fill: var(--color-text-muted); font-size: 10px; }
  .dot { fill: var(--color-accent); fill-opacity: 0.55; stroke: var(--color-accent); stroke-width: 1.5; }
  .best { fill: var(--color-accent); stroke: var(--color-accent); }
  .hit { fill: transparent; }
  a:focus-visible .dot { stroke-width: 3; }
  .key { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); }
  .sum { margin: 0; padding-left: 1.1rem; font-size: 0.9rem; }
  .sum li { margin: var(--space-1) 0; }
</style>
