<script lang="ts">
  import type { Timeline } from '#lib/pours.ts';
  import { pourShapes } from '#lib/pourShapes.ts';
  import { followTip } from '#lib/components/labelTip.ts';
  let { timeline, label, compact = false }: { timeline: Timeline; label: string; compact?: boolean } = $props();

  // Cumulative water: x = time, y = water poured so far (0 to the timeline's total grams). Each pour is a filled
  // segment rising from the level before it to the level after it; between pours the level holds flat. The SVG
  // stretches horizontally only, so strokes are non-scaling and the shapes stay crisp vertically.
  const W = 1000;
  const H = $derived(compact ? 32 : 64);
  const geo = $derived(pourShapes(timeline, W, H));
  const total = $derived(geo.total);
  const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

  // Hover or tap on a band, a pour or a swirl: its name and times (the band shares its bloom's text). labelTip attaches to any element, SVG ones included.
  const endTip = (node: SVGElement, label: string) => followTip(node as unknown as HTMLElement, label);

</script>

<div class="pour-timeline" class:compact>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label={label} style="height:{H}px">
    {#each geo.windows as w, i (i)}
      <rect class="window b{Math.min(w.bloom, 2)}" x={w.x0} y="0" width={w.x1 - w.x0} height={H} use:endTip={timeline.labels?.[w.pour] ?? ''} />
    {/each}
    <line class="base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} vector-effect="non-scaling-stroke" />
    {#each geo.shapes as sh, i (i)}
      {#if sh.hold}
        <line class="hold" x1={sh.hold.x0} x2={sh.hold.x1} y1={sh.hold.y} y2={sh.hold.y} vector-effect="non-scaling-stroke" />
      {/if}
      <polygon class="seg {sh.kind}" points={sh.points} use:endTip={timeline.labels?.[i] ?? ''} />
    {/each}
    {#each geo.swirls as sx, i (i)}
      <line class="halo" x1={sx} x2={sx} y1="0" y2={H} vector-effect="non-scaling-stroke" use:endTip={timeline.swirlLabels?.[i] ?? ''} />
      <line class="swirl" x1={sx} x2={sx} y1="0" y2={H} vector-effect="non-scaling-stroke" use:endTip={timeline.swirlLabels?.[i] ?? ''} />
    {/each}
  </svg>
  {#if !compact}
    <div class="axis"><span>0:00</span><span>{mmss(total)}</span></div>
  {/if}
</div>

<style>
  .pour-timeline svg {
    display: block;
    width: 100%;
    overflow: visible;
  }
  /* Marks with no tooltip of their own let the band's (or a pour's) show through. */
  .base,
  .hold {
    pointer-events: none;
  }
  .base {
    stroke: var(--color-border);
    stroke-width: 1;
  }
  .hold {
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
  }
  /* Each timed bloom: a pale full-height band behind the pours, one tint per bloom (tokens no pour fill or line uses). */
  .window { opacity: var(--band-opacity); }
  .window.b0 { fill: var(--band-0); }
  .window.b1 { fill: var(--band-1); }
  .window.b2 { fill: var(--band-2); }
  .seg.bloom {
    fill: var(--fill-bloom);
  }
  .seg.fast {
    fill: var(--fill-fast);
  }
  .seg.medium {
    fill: var(--series-5);
  }
  .seg.slow {
    fill: var(--series-6);
  }
  /* Drawn over the fills: a surface-colored halo under a heavy dashed line, so it reads on any segment in both themes. */
  .halo {
    stroke: var(--color-surface);
    stroke-width: 6;
  }
  .swirl {
    stroke: var(--color-text);
    stroke-width: 3;
    stroke-dasharray: 5 3;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
