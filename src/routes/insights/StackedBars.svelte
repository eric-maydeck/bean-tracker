<script lang="ts">
  import { rove, takeFocus, tipAt } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import type { Multi } from '$lib/server/insights/insightGenerators';
  import { seriesColors } from './multiLine';

  // Shares that sum to 100% per month (the lab's "usage over time", G6): one 100% stacked bar per month,
  // the first line at the bottom, "Other" muted; each segment is a tap/keyboard target with its own tip.
  let { m, ariaLabel }: { m: Multi; ariaLabel: string } = $props();

  let colors = $derived(seriesColors(m.lines.map((l) => l.label)));
  let n = $derived(m.x.length);
  // Month labels counted back from the last: up to 8 wide, up to 4 in a narrow container.
  let [wide, narrow] = $derived([Math.ceil(n / 8), Math.ceil(n / 4)]);
  const tipOf = (k: number, i: number): Tip => ({ title: m.lines[k].label, rows: [['Month', m.x[i]], ['Share', `${m.lines[k].values[i] ?? 0}%`]] });

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ k: number; i: number; x: number; y: number } | null>(null);
  // New data drops an open tip: its segment may not exist any more.
  $effect(() => {
    void m;
    tip = null;
  });
  const showSeg = (el: Element) => {
    const d = (el as HTMLElement).dataset;
    tip = { ...tipAt(wrap!, el, '', 128), k: +d.k!, i: +d.i! };
  };
  const pick = (e: Event) => {
    const el = (e.target as Element).closest('.seg');
    if (el) showSeg(el);
    else tip = null;
  };
</script>

<div class="stacked" bind:this={wrap}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="plot-row"
    role="group"
    aria-label={ariaLabel}
    onpointermove={(e) => e.pointerType === 'mouse' && pick(e)}
    onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
    onclick={pick}
    onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.seg'))}
  >
    <div class="y-labels" aria-hidden="true">
      {#each [100, 75, 50, 25, 0] as v (v)}<span style:top="{100 - v}%">{v}%</span>{/each}
    </div>
    <div class="plot">
      {#each m.x as x, i (i)}
        <div class="col">
          {#each m.lines as l, k (k)}
            {@const v = l.values[i] ?? 0}
            {#if v > 0}
              <div class="seg" role="button" tabindex={i + k ? -1 : 0} data-k={k} data-i={i} style:flex-grow={v} style:background={colors[k]}
                aria-label={tipText(tipOf(k, i))} onfocus={(e) => (takeFocus(e), showSeg(e.currentTarget))} onblur={() => (tip = null)}></div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="x-labels" aria-hidden="true">
      {#each m.x as x, i (i)}<span class:alt={(n - 1 - i) % wide > 0} class:thin={(n - 1 - i) % narrow > 0}>{x}</span>{/each}
    </div>
  </div>
  <ul class="legend" aria-hidden="true">
    {#each m.lines as l, k (k)}<li><span class="swatch" style:background={colors[k]}></span>{l.label}</li>{/each}
  </ul>
  {#if tip && m.lines[tip.k]}
    <div class="cell-tip wide" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}><TipBody tip={tipOf(tip.k, tip.i)} /></div>
  {/if}
</div>

<style>
  .stacked {
    position: relative;
    container-type: inline-size;
  }
  .plot-row {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    column-gap: var(--space-2);
  }
  .y-labels,
  .x-labels {
    position: relative;
    font-size: 0.72rem;
    line-height: 1;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  /* All labels share one grid cell (the column is as wide as the widest); each sits at its value's height. */
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
  /* Recessive 25% gridlines behind the bars. */
  .plot {
    display: flex;
    gap: 2px;
    height: 12rem;
    background: repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px 25%);
    border-bottom: 1px solid var(--color-border);
  }
  @media (max-width: 480px) {
    .plot {
      height: 10rem;
    }
  }
  /* The first line at the bottom; a 2px surface gap between segments. */
  .col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
  }
  .seg {
    flex-basis: 0;
    min-height: 2px;
    cursor: pointer;
  }
  .col > .seg:last-child {
    border-radius: 3px 3px 0 0;
  }
  @media (hover: hover) {
    .seg:hover {
      filter: brightness(1.12);
    }
  }
  .seg:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 1px;
  }
  .x-labels {
    grid-column: 2;
    display: flex;
    gap: 2px;
    margin-top: 0.3rem;
  }
  .x-labels span {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    justify-content: center; /* a label wider than its column overflows evenly both sides */
    white-space: nowrap;
  }
  .x-labels .alt {
    visibility: hidden;
  }
  /* Narrow (phones): every other month label, counted back from the last. */
  @container (width < 560px) {
    .x-labels .thin {
      visibility: hidden;
    }
  }
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
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
  }
</style>
