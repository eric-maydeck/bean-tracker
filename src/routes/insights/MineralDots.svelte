<script lang="ts">
  import { rove, takeFocus, tipAt } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import type { MineralPoint } from '$lib/server/insights/lab';

  // A mineral vs rating dot chart (W4): x = the amount on a real numeric axis, y = the adjusted mean rating,
  // one dot per amount, area ∝ brews, hollow under 3 bags or 30 brews; the dashed line is the average.
  // Dots are tap/keyboard targets with tips (arrows move between them), as DeltaBars rows are.
  let { points, unit, overall, ariaLabel }: { points: MineralPoint[]; unit: string; overall: number; ariaLabel: string } = $props();

  const pad = (lo: number, hi: number, f: number) => (hi > lo ? [lo - (hi - lo) * f, hi + (hi - lo) * f] : [lo - 1, hi + 1]);
  const fmt = (v: number) => `${+v.toFixed(2)}`;
  let plot = $derived.by(() => {
    const xs = points.map((p) => p.value), ys = [...points.map((p) => p.mean), overall];
    const [x0, x1] = pad(Math.min(...xs), Math.max(...xs), 0.06), [y0, y1] = pad(Math.min(...ys), Math.max(...ys), 0.12);
    const big = Math.max(...points.map((p) => p.brews), 1);
    return {
      lo: Math.min(...xs), hi: Math.max(...xs), ylo: y0, yhi: y1, avg: ((y1 - overall) / (y1 - y0)) * 100,
      dots: points.map((p) => ({
        ...p, x: ((p.value - x0) / (x1 - x0)) * 100, y: ((y1 - p.mean) / (y1 - y0)) * 100,
        d: 2 * Math.sqrt(16 + 80 * (p.brews / big)) // diameter px: area ∝ brews over a visible floor
      }))
    };
  });
  const tipOf = (p: MineralPoint): Tip => ({
    title: `${fmt(p.value)}${unit ? ` ${unit}` : ''}`,
    rows: [['Avg rating', p.mean.toFixed(2)], ['Brews', `${p.brews}`], ['Bags', `${p.bags}`], ...(p.solid ? [] : [['Strength', 'Few brews'] as [string, string]])]
  });

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ i: number; x: number; y: number } | null>(null);
  $effect(() => {
    void points;
    tip = null;
  });
  const showDot = (el: Element) => (tip = { ...tipAt(wrap!, el, '', 128), i: +(el as HTMLElement).dataset.i! });
  const pick = (e: Event) => {
    const el = (e.target as Element).closest('.dot');
    if (el) showDot(el);
    else tip = null;
  };
</script>

<div class="dots-chart" bind:this={wrap}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div class="frame" role="group" aria-label={ariaLabel}
    onpointermove={(e) => e.pointerType === 'mouse' && pick(e)}
    onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
    onclick={pick}
    onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.dot'))}>
    <div class="y-axis" aria-hidden="true"><span>{plot.yhi.toFixed(1)}</span><span class="axis-name">rating</span><span>{plot.ylo.toFixed(1)}</span></div>
    <div class="plot">
      <span class="avg" style:top="{plot.avg}%" aria-hidden="true"></span>
      {#each plot.dots as p, i (p.value)}
        <span class="dot" class:hollow={!p.solid} role="button" tabindex={i ? -1 : 0} data-i={i} aria-label={tipText(tipOf(p))}
          style:left="{p.x}%" style:top="{p.y}%" style:--d="{p.d}px"
          onfocus={(e) => (takeFocus(e), showDot(e.currentTarget))} onblur={() => (tip = null)}></span>
      {/each}
    </div>
    <div class="x-axis" aria-hidden="true"><span>{fmt(plot.lo)}</span><span class="axis-name">{unit || 'ratio'}</span><span>{fmt(plot.hi)}</span></div>
  </div>
  {#if tip && plot.dots[tip.i]}
    <div class="cell-tip wide" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}><TipBody tip={tipOf(plot.dots[tip.i])} /></div>
  {/if}
</div>

<style>
  .dots-chart {
    position: relative;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    --cell-h: 1rem;
  }
  .frame {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-rows: minmax(7rem, 1fr) auto;
    column-gap: var(--space-2);
  }
  .y-axis,
  .x-axis {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    line-height: 1;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* The end labels sit level with the plot's inset top and bottom. */
  .y-axis {
    flex-direction: column;
    align-items: flex-end;
    padding-block: calc(0.6rem - 0.35em);
  }
  .x-axis {
    grid-column: 2;
    margin-top: 0.3rem;
  }
  .axis-name {
    font-style: italic;
  }
  /* Dots stay inside the box: an inset of the largest radius keeps the centres off its edges. */
  .plot {
    position: relative;
    margin: 0.6rem;
  }
  .plot::before {
    content: '';
    position: absolute;
    inset: -0.6rem;
    border-left: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    pointer-events: none;
  }
  .avg {
    position: absolute;
    left: -0.6rem;
    right: -0.6rem;
    border-top: 1px dashed var(--color-text-muted);
    opacity: 0.6;
  }
  .dot {
    position: absolute;
    width: var(--d);
    height: var(--d);
    translate: -50% -50%;
    border-radius: 50%;
    background: color-mix(in oklab, var(--chart-color-1) 75%, transparent);
    border: 2px solid var(--chart-color-1);
    box-shadow: 0 0 0 1.5px var(--color-bg);
    cursor: pointer;
  }
  .dot.hollow {
    background: transparent;
    opacity: 0.7;
  }
  /* A bigger hit area than the mark. */
  .dot::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
  }
  .dot:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 2px;
  }
</style>
