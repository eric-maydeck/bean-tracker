<script lang="ts">
  import type { BrewRow } from '$lib/server/brewNow/load';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';

  // Plain dot plot of this coffee's rated brews on the chosen grinder: grind setting on x, rating on y. The Best brew is
  // a crowned amber dot. Hovering, focusing or tapping a dot opens the site's tip (FloatTip + TipBody); clicking
  // one flashes its row in the list (scrolling only when that row is off screen). No time encoding.
  let { brews, grinder, summary = [] }: { brews: BrewRow[]; grinder: string | null; summary?: string[] } = $props();

  const W = 340, H = 170, L = 30, R = 16, T = 14, B = 28;
  const pts = $derived(brews.filter((b) => b.grinder === grinder && b.grindNum !== null && b.rating !== null));
  const gl = $derived(Math.min(...pts.map((p) => p.grindNum!))), gh = $derived(Math.max(...pts.map((p) => p.grindNum!)));
  const rl = $derived(Math.floor(Math.min(...pts.map((p) => p.rating!))) - 1), rh = $derived(Math.ceil(Math.max(...pts.map((p) => p.rating!))) + 1); // padded so no dot sits on an axis
  const x = (v: number) => (gh === gl ? (L + W - R) / 2 : L + 14 + ((v - gl) / (gh - gl)) * (W - L - R - 28));
  const y = (v: number) => H - B - ((v - rl) / (rh - rl)) * (H - B - T);
  const gname = (v: number) => pts.find((p) => p.grindNum === v)?.grind;
  const label = (p: BrewRow) => `${p.localTime.slice(0, 10)}, grind ${p.grind}, rated ${p.rating}${p.best ? ', Best brew' : ''}`;
  const crown = (cx: number, cy: number) => `${cx - 5},${cy - 6} ${cx - 5},${cy - 12} ${cx - 2.5},${cy - 9} ${cx},${cy - 13} ${cx + 2.5},${cy - 9} ${cx + 5},${cy - 12} ${cx + 5},${cy - 6}`;
  const tipOf = (p: BrewRow) => ({
    title: p.localTime.slice(0, 10),
    rows: [['Grind', p.grind ?? '–'], ['Rating', String(p.rating)], ...(p.tempC ? [['Temp', `${p.tempC}°C`]] : []),
      ...([p.dripper, p.filter].filter(Boolean).length ? [['Dripper', [p.dripper, p.filter].filter(Boolean).join(' · ')]] : [])] as [string, string][],
    ...(p.best ? { note: 'Best brew' } : {})
  });

  let tip = $state<{ p: BrewRow; el: Element; pinned: boolean } | null>(null);
  function flash(e: MouseEvent, p: BrewRow) {
    e.preventDefault();
    tip = { p, el: e.currentTarget as Element, pinned: true };
    const row = document.getElementById(`brew-${p.id}`);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' }); // a row already in view doesn't move
    row.classList.remove('brew-flash');
    void row.offsetWidth; // restart the animation
    row.classList.add('brew-flash');
  }
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.gt-dot, .gt-tip') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && (tip = null)} />

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
          <a class="gt-dot" href="#brew-{p.id}" aria-label={label(p)} onclick={(e) => flash(e, p)}
            onpointerenter={(e) => e.pointerType === 'mouse' && !tip?.pinned && (tip = { p, el: e.currentTarget as Element, pinned: false })}
            onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && (tip = null)}
            onfocus={(e) => e.currentTarget.matches(':focus-visible') && (tip = { p, el: e.currentTarget as Element, pinned: false })}
            onblur={() => !tip?.pinned && (tip = null)}>
            <circle cx={x(p.grindNum!)} cy={y(p.rating!)} r="14" class="hit" />
            {#if p.best}<polygon points={crown(x(p.grindNum!), y(p.rating!))} class="crown" />{/if}
            <circle cx={x(p.grindNum!)} cy={y(p.rating!)} r={p.best ? 4 : 3} class="dot" class:bestdot={p.best} />
          </a>
        {/each}
      </svg>
      <p class="key">Each dot is a brew.{#if pts.some((p) => p.best)} <svg class="legend" viewBox="0 0 18 18" aria-hidden="true"><polygon points={crown(9, 13)} class="crown" /><circle cx="9" cy="13" r="3.5" class="dot bestdot" /></svg> Best brew{/if}</p>
    </figure>
  {/if}
  {#if summary.length}
    <ul class="sum">{#each summary as s, i (i)}<li>{s}</li>{/each}</ul>
  {/if}
</div>

{#if tip}
  <FloatTip anchor={tip.el} reveal={tip.pinned} onclose={() => (tip = null)}>
    <div class="gt-tip"><TipBody tip={tipOf(tip.p)} /></div>
  </FloatTip>
{/if}

<style>
  .gt { display: flex; flex-direction: column; gap: var(--space-3); }
  figure { margin: 0; }
  figcaption { font-weight: 600; font-size: 0.9rem; margin-bottom: var(--space-2); }
  svg { display: block; width: 100%; max-width: 30rem; height: auto; }
  .axis { stroke: var(--color-border); stroke-width: 1; }
  .tick { fill: var(--color-text-muted); font-size: 10px; }
  .dot { fill: var(--color-accent); fill-opacity: 0.6; stroke: var(--color-accent); stroke-width: 1.2; }
  .bestdot { fill: var(--color-warm); stroke: var(--color-warm); fill-opacity: 1; }
  .crown { fill: var(--color-warm); }
  .hit { fill: transparent; }
  .gt-dot { cursor: pointer; }
  .gt-dot:focus-visible .dot { stroke-width: 3; }
  .key { margin: var(--space-2) 0 0; font-size: 0.8rem; color: var(--color-text-muted); }
  .key .legend { display: inline-block; width: 1.1em; height: 1.1em; vertical-align: -0.2em; }
  .sum { margin: 0; padding-left: 1.1rem; font-size: 0.9rem; }
  .sum li { margin: var(--space-1) 0; }
  :global(.brew-flash) { animation: brew-flash 1.6s ease-out; }
  @keyframes brew-flash { 0%, 40% { outline: 2px solid var(--color-accent); outline-offset: 2px; background: color-mix(in srgb, var(--color-accent) 14%, transparent); } 100% { outline: 2px solid transparent; outline-offset: 2px; background: transparent; } }
</style>
