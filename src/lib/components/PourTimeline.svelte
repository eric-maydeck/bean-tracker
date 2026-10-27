<script lang="ts">
  import type { Timeline } from '$lib/pours';
  let { timeline, label, compact = false }: { timeline: Timeline; label: string; compact?: boolean } = $props();

  const W = 1000; // x units; the SVG stretches horizontally only, so bars and ticks stay crisp vertically
  const H = $derived(compact ? 32 : 64);
  const total = $derived(Math.max(timeline.totalS, ...timeline.pours.map((p) => p.startS + p.durationS), 1));
  const biggest = $derived(Math.max(...timeline.pours.map((p) => p.grams), 1));
  const x = (s: number) => (s / total) * W;
  const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
</script>

<div class="pour-timeline" class:compact>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label={label} style="height:{H}px">
    <line class="base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} vector-effect="non-scaling-stroke" />
    {#each timeline.pours as p, i (i)}
      {@const h = Math.max(3, (p.grams / biggest) * (H - 10))}
      <rect class="bar {p.kind}" x={x(p.startS)} y={H - 1 - h} width={Math.max(4, x(p.durationS))} height={h} rx="1" />
    {/each}
    {#each timeline.swirls as s, i (i)}
      <polygon class="swirl" points="{x(s) - 5},0 {x(s) + 5},0 {x(s)},8" />
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
  .base {
    stroke: var(--color-border);
    stroke-width: 1;
  }
  .bar.bloom {
    fill: var(--series-4);
  }
  .bar.fast {
    fill: var(--series-1-ink);
  }
  .bar.slow {
    fill: var(--series-6);
  }
  .swirl {
    fill: var(--color-text);
  }
  .axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
