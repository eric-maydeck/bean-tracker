<script lang="ts">
  import type { Timeline } from '$lib/pours';
  import { labelTip } from '$lib/components/labelTip';
  let { timeline, label, compact = false }: { timeline: Timeline; label: string; compact?: boolean } = $props();

  // Cumulative water: x = time, y = water poured so far (0 to the timeline's total grams). Each pour is a filled
  // segment rising from the level before it to the level after it; between pours the level holds flat. The SVG
  // stretches horizontally only, so strokes are non-scaling and the shapes stay crisp vertically.
  const W = 1000;
  const H = $derived(compact ? 32 : 64);
  const total = $derived(
    Math.max(timeline.totalS, ...timeline.pours.map((p) => p.startS + p.durationS), ...(timeline.windows ?? []).map((w) => w.toS), 1)
  );
  const water = $derived(Math.max(timeline.pours.reduce((s, p) => s + p.grams, 0), 1));
  const x = (s: number) => (s / total) * W;
  const edge = (px: number) => Math.min(W - 6, Math.max(6, px)); // keep a swirl at either end inside the box
  const y = (g: number) => H - 1 - (g / water) * (H - 4);
  const mmss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

  // Hover or tap on a band: how long the pour before it lasts. labelTip attaches to any element (SVG ones included).
  const uid = $props.id();
  const endsLabel = (w: NonNullable<Timeline['windows']>[number]) => {
    const upTo = w.toS > w.targetS ? `, up to ${mmss(w.toS)}` : '';
    return w.bloom ? `Bloom ${mmss(w.startS)}–${mmss(w.targetS)}${upTo}` : `Pour ${w.pour + 1} ends ${mmss(w.targetS)}${upTo}`;
  };
  const endTip = (node: SVGElement, label: string) => labelTip(node as unknown as HTMLElement, label);

  const shapes = $derived.by(() => {
    let level = 0;
    return timeline.pours.map((p, i) => {
      const x0 = x(p.startS);
      const x1 = Math.max(x0 + 4, x(p.startS + p.durationS));
      const before = level;
      level += p.grams;
      const next = timeline.pours[i + 1];
      const hold = { x0: x1, x1: next ? x(next.startS) : W, y: y(level) };
      return {
        kind: p.kind,
        points: `${x0},${H - 1} ${x0},${y(before)} ${x1},${y(level)} ${x1},${H - 1}`,
        hold: hold.x1 > hold.x0 ? hold : null
      };
    });
  });
</script>

<div class="pour-timeline" class:compact>
  <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label={label} style="height:{H}px">
    <defs>
      <pattern id="stripe-{uid}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="3" height="8" class="stripe-mark" />
      </pattern>
    </defs>
    {#each timeline.windows ?? [] as w, i (i)}
      {#if w.bloom && w.targetS > w.startS}
        <rect class="window solid" x={x(w.startS)} y="0" width={x(w.targetS) - x(w.startS)} height={H} use:endTip={endsLabel(w)} />
      {/if}
      {#if w.toS > w.targetS}
        <rect class="window stripe" x={x(w.targetS)} y="0" width={Math.min(W, x(w.toS)) - x(w.targetS)} height={H} fill="url(#stripe-{uid})" use:endTip={endsLabel(w)} />
      {/if}
      <line class="target" x1={x(w.targetS)} x2={x(w.targetS)} y1="0" y2={H} vector-effect="non-scaling-stroke" />
    {/each}
    <line class="base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} vector-effect="non-scaling-stroke" />
    {#each shapes as sh, i (i)}
      {#if sh.hold}
        <line class="hold" x1={sh.hold.x0} x2={sh.hold.x1} y1={sh.hold.y} y2={sh.hold.y} vector-effect="non-scaling-stroke" />
      {/if}
      <polygon class="seg {sh.kind}" points={sh.points} />
    {/each}
    {#each timeline.swirls as s, i (i)}
      <line class="halo" x1={edge(x(s))} x2={edge(x(s))} y1="0" y2={H} vector-effect="non-scaling-stroke" />
      <line class="swirl" x1={edge(x(s))} x2={edge(x(s))} y1="0" y2={H} vector-effect="non-scaling-stroke" />
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
  .hold {
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
  }
  /* Bloom length: a pale full-height band in the bloom's color behind the pours (solid to the target, striped up to the latest start), with a thin tick where the target ends. */
  .window.solid {
    fill: var(--series-4);
    opacity: 0.3;
  }
  /* The up-to part: the same tint as hatching, the stripe color from the bloom token so it reads in both themes. */
  .stripe-mark {
    fill: var(--series-4-ink);
    opacity: 0.4;
  }
  .target {
    stroke: var(--series-4);
    stroke-width: 2;
  }
  .seg.bloom {
    fill: var(--series-4);
  }
  .seg.fast {
    fill: var(--series-1-ink);
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
