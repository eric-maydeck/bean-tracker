<script lang="ts">
  import { tick } from 'svelte';
  import { tipAt } from '$lib/components/Heatmap.svelte';
  import type { Multi } from '$lib/server/insights/insightGenerators';
  import { lines, px, scale } from './multiLine';

  let { m, ariaLabel, format }: { m: Multi; ariaLabel: string; format: (v: number) => string } = $props();

  let ls = $derived(lines(m));
  let sc = $derived(scale(m));
  let n = $derived(m.x.length);
  // y labels at the box's 2 and 38 (of 40); the 0 label only when the range crosses 0 and it clears both.
  let ys = $derived([
    { v: sc.hi, y: 2 },
    ...(sc.zero !== null && sc.zero > 7 && sc.zero < 33 ? [{ v: 0, y: sc.zero }] : []),
    { v: sc.lo, y: 38 }
  ]);
  // Every x label when they fit (≤ 8), else first, middle and last.
  let xs = $derived(n <= 8 ? m.x.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1]);

  let wrap: HTMLDivElement | undefined = $state();
  let plot: HTMLDivElement | undefined = $state();
  let guide: HTMLDivElement | undefined = $state();
  let col = $state<number | null>(null);
  let tip = $state<{ x: number; y: number } | null>(null);
  // New data drops the column: it may not exist any more.
  $effect(() => {
    void m;
    col = null;
    tip = null;
  });
  // The tip sits over the guide line, at the plot's top edge.
  async function showCol(i: number) {
    col = Math.min(n - 1, Math.max(0, i));
    await tick();
    if (guide && wrap) tip = { ...tipAt(wrap, guide, '', 128), y: plot!.offsetTop };
  }
  const hide = () => ((col = null), (tip = null));
  const nearest = (e: PointerEvent | MouseEvent) => {
    const r = plot!.getBoundingClientRect();
    return Math.round(((e.clientX - r.left) / r.width) * (n - 1));
  };
  // ←/→ move the column; the first press with nothing open shows the current (else the latest) column.
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') return hide();
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    showCol(col === null ? n - 1 : col + d);
  }
</script>

<div class="multi-line" bind:this={wrap}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (focusable for its column tips; every line is in the legend and the tip) -->
  <div
    class="plot-row"
    role="img"
    tabindex="0"
    aria-label={ariaLabel}
    onpointermove={(e) => e.pointerType === 'mouse' && showCol(nearest(e))}
    onpointerleave={(e) => e.pointerType === 'mouse' && hide()}
    onclick={(e) => showCol(nearest(e))}
    onfocus={() => col === null && showCol(n - 1)}
    onblur={hide}
    onkeydown={key}
  >
    <div class="y-labels" aria-hidden="true">
      {#each ys as t (t.y)}<span style:top="{(t.y / 40) * 100}%">{format(t.v)}</span>{/each}
    </div>
    <div class="plot" bind:this={plot}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        {#if sc.zero !== null}<line class="zero" x1="0" x2="100" y1={sc.zero} y2={sc.zero} />{/if}
        {#each ls as l (l.label)}{#each l.runs as r, j (j)}<polyline points={r} style:stroke={l.color} />{/each}{/each}
      </svg>
      {#if col !== null}<div class="guide" bind:this={guide} style:left="{px(col, n)}%"></div>{/if}
    </div>
    <div class="x-labels" aria-hidden="true">
      {#each xs as i (i)}<span style:left="{px(i, n)}%" class:first={i === 0 && n > 1} class:last={i === n - 1 && n > 1}>{m.x[i]}</span>{/each}
    </div>
  </div>
  <ul class="legend" aria-hidden="true">
    {#each ls as l (l.label)}<li><span class="swatch" style:background={l.color}></span>{l.label}</li>{/each}
  </ul>
  {#if tip && col !== null}
    <div class="cell-tip wide" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>
      <strong>{m.x[col]}</strong>
      {#each m.lines as l, j (j)}
        {@const v = l.values[col] ?? null}
        {#if v !== null}<span class="tip-line"><span class="swatch" style:background={ls[j]?.color}></span>{l.label}: {format(v)}</span>{/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .multi-line {
    position: relative;
    width: 100%;
  }
  .plot-row {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    column-gap: var(--space-2);
    border-radius: var(--radius);
    cursor: crosshair;
  }
  .plot-row:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 4px;
  }
  .y-labels,
  .x-labels {
    position: relative;
    font-size: 0.72rem;
    line-height: 1;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* All labels share one grid cell, so the column is as wide as the widest; each sits at its value's
     height (a grid item's top % resolves against the plot-tall row). */
  .y-labels {
    display: grid;
  }
  .y-labels span {
    grid-area: 1 / 1;
    align-self: start;
    position: relative;
    translate: 0 -50%;
    text-align: right;
  }
  .plot {
    position: relative;
    height: 12rem;
  }
  @media (max-width: 480px) {
    .plot {
      height: 10rem;
    }
  }
  .plot svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  polyline {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  .zero {
    stroke: var(--color-border);
    stroke-width: 1;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
  .guide {
    position: absolute;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--color-text-muted);
    pointer-events: none;
  }
  .x-labels {
    grid-column: 2;
    height: 1rem;
    margin-top: 0.3rem;
  }
  .x-labels span {
    position: absolute;
    translate: -50% 0;
    white-space: nowrap;
  }
  .x-labels .first {
    translate: 0 0;
  }
  .x-labels .last {
    translate: -100% 0;
  }
  /* Insights' legend look: 2px line swatches, centred, wrapping. */
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.1rem 0.6rem;
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.72rem;
    line-height: 1.3;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .swatch {
    flex-shrink: 0;
    width: 0.7rem;
    height: 2px;
    border-radius: 1px;
  }
  .cell-tip strong,
  .tip-line {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
</style>
