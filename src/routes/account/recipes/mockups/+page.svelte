<script lang="ts">
  import PourTimeline from '$lib/components/PourTimeline.svelte';
  import type { Timeline } from '$lib/pours';
  let { data } = $props();

  const W = 1000;
  const LANE = { bloom: 0, fast: 1, slow: 2 } as const;
  const x = (t: Timeline, s: number) => (s / Math.max(t.totalS, 1)) * W;
</script>

<svelte:head><title>Bean Tracker - Timeline mockups</title></svelte:head>
<h1>Timeline mockups</h1>
<p class="text-muted">A: bar height by grams, swirl marker (shipped). B: equal-height lanes by speed, swirl tick. C: grams bars with a full-height swirl line.</p>

{#each data.items as it, i (i)}
  <section class="chart-panel">
    <h2>{it.name}</h2>
    <h3>A: height by grams, marker</h3>
    <PourTimeline timeline={it.timeline} label={it.name} />
    <h3>B: lanes by speed, tick</h3>
    <svg viewBox="0 0 {W} 48" preserveAspectRatio="none" role="img" aria-label={it.name} style="width:100%;height:48px;display:block">
      {#each it.timeline.pours as p, j (j)}
        <rect x={x(it.timeline, p.startS)} y={LANE[p.kind] * 16 + 2} width={Math.max(4, x(it.timeline, p.durationS))} height="12" rx="1"
          fill={p.kind === 'bloom' ? 'var(--series-4)' : p.kind === 'fast' ? 'var(--series-1-ink)' : 'var(--series-6)'} />
      {/each}
      {#each it.timeline.swirls as s, j (j)}
        <line x1={x(it.timeline, s)} x2={x(it.timeline, s)} y1="0" y2="48" stroke="var(--color-text)" stroke-width="2" vector-effect="non-scaling-stroke" />
      {/each}
    </svg>
    <h3>C: height by grams, swirl line</h3>
    <svg viewBox="0 0 {W} 64" preserveAspectRatio="none" role="img" aria-label={it.name} style="width:100%;height:64px;display:block">
      {#each it.timeline.pours as p, j (j)}
        {@const h = Math.max(3, (p.grams / Math.max(...it.timeline.pours.map((q) => q.grams), 1)) * 54)}
        <rect x={x(it.timeline, p.startS)} y={63 - h} width={Math.max(4, x(it.timeline, p.durationS))} height={h} rx="1"
          fill={p.kind === 'bloom' ? 'var(--series-4)' : p.kind === 'fast' ? 'var(--series-1-ink)' : 'var(--series-6)'} />
      {/each}
      {#each it.timeline.swirls as s, j (j)}
        <line x1={x(it.timeline, s)} x2={x(it.timeline, s)} y1="0" y2="64" stroke="var(--color-text)" stroke-width="2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
      {/each}
    </svg>
  </section>
{/each}
