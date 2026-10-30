<script lang="ts" module>
  // One sequential ramp (the WorldMap's), shared with BrewCalendar: 0 is --map-low, the
  // rest run 20–100% toward --map-high by tone over the non-zero values; null (no data)
  // is unfilled (the .none outline), so it never reads as a value.
  export function shader(values: (number | null)[]) {
    const vs = values.filter((v): v is number => !!v);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    return (v: number | null) => {
      if (v === null) return 'transparent';
      if (v === 0) return 'var(--map-low)';
      const tone = max > min ? (v - min) / (max - min) : 1;
      return `color-mix(in oklab, var(--map-high) ${Math.round(20 + 80 * tone)}%, var(--map-low))`;
    };
  }

  // Roving tabindex: the focused cell is the grid's one tab stop.
  export function takeFocus(e: FocusEvent) {
    const el = e.currentTarget as HTMLElement;
    for (const o of el.closest('[role="group"]')!.querySelectorAll<HTMLElement>('[tabindex="0"]')) o.tabIndex = -1;
    el.tabIndex = 0;
  }
  // Arrow keys move focus to the nearest cell on screen in that direction, so the same code
  // works for a transposed heatmap and a wrapped calendar.
  const DIR: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  export function rove(e: KeyboardEvent, sel: string) {
    const d = DIR[e.key];
    const from = (e.target as Element).closest(sel);
    if (!d || !from) return;
    e.preventDefault();
    const a = from.getBoundingClientRect();
    let best: HTMLElement | undefined;
    let score = Infinity;
    for (const el of (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(sel)) {
      const b = el.getBoundingClientRect();
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      const along = dx * d[0] + dy * d[1];
      const s = along + 4 * Math.abs(dx * d[1] + dy * d[0]);
      if (along > 1 && s < score) [best, score] = [el, s];
    }
    best?.focus();
  }
</script>

<script lang="ts">
  import { deltaColor } from './deltaColor';
  import FloatTip from './FloatTip.svelte';
  import TipBody, { type Tip } from './TipBody.svelte';

  let {
    rows,
    cols,
    cells,
    text,
    label,
    ariaLabel,
    diverging = false,
    small,
    marked,
    tip: tipOf,
    scale = ["Below the bag's average", 'Above']
  }: {
    rows: string[];
    cols: string[];
    cells: (number | null)[][];
    text: (v: number | null, r: number, c: number) => string; // r, c: a caller can word a blank cell by why it's blank
    label: (r: number, c: number) => string;
    ariaLabel: string;
    diverging?: boolean;
    small?: boolean[][]; // small-sample cells (sample.ts): stripes over their color
    marked?: boolean[][]; // outlined cells (the lab's rest heatmap: each row's best)
    tip?: (r: number, c: number) => Tip; // a structured tip (ui-rules 36); else the cell's label as the title, its text under it
    scale?: [string, string]; // diverging legend: the low and high ends
  } = $props();

  let wrap: HTMLDivElement | undefined = $state();
  // The open tip: its cell (the anchor) and indexes; `hover`: opened by the mouse, so leaving closes it.
  let tip = $state<{ el: Element; r: number; c: number; hover: boolean } | null>(null);
  // Diverging: one fixed scale for every lab chart (deltaColor, C1); else the sequential ramp over the values.
  let shade = $derived(diverging ? deltaColor : shader(cells.flat()));
  let blanks = $derived(cells.flat().some((v) => v === null));
  // New data drops an open tip: its cell may not exist any more.
  $effect(() => {
    void cells;
    tip = null;
  });
  const tipFor = (el: Element, hover = false) => {
    const d = (el as HTMLElement).dataset;
    return { el, r: +d.r!, c: +d.c!, hover };
  };
  const show = (e: Event, hover = false) => {
    const el = (e.target as Element).closest('.heat-cell');
    tip = el ? tipFor(el, hover) : null;
  };
  // Scrolling moves the cells under the tip: follow the focused cell (arrow keys scroll it into view), else close.
  const scrolled = () => {
    const a = document.activeElement;
    tip = a?.matches('.heat-cell') && wrap!.contains(a) ? tipFor(a) : null;
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="heatmap"
  class:diverging
  role="group"
  aria-label={ariaLabel}
  bind:this={wrap}
  style:--nr={rows.length}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e, true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && tip?.hover && (tip = null)}
  onclick={(e) => show(e)}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.heat-cell'))}
>
  {#snippet cell(i: number, j: number, c0: number)}
    {@const v = cells[i]?.[j] ?? null}
    <div
      class="heat-cell"
      role="button"
      tabindex={i + j ? -1 : 0}
      data-r={i}
      data-c={j}
      aria-label="{label(i, j)} · {text(v, i, j)}"
      style:--r={i + 2}
      style:--c={j + c0}
      class:none={v === null}
      class:small-sample-mark={!!small?.[i]?.[j]}
      class:marked={!!marked?.[i]?.[j]}
      style:background-color={shade(v)}
      onfocus={(e) => (takeFocus(e), show(e))}
      onblur={() => (tip = null)}
    ></div>
  {/snippet}
  {#if diverging}
    <!-- Axis labels sit outside the data area (ui-rules 43): the row labels are their own column, only the plot
         (column labels + cells, a subgrid of the frame's rows) scrolls sideways and clips at its left edge. -->
    <div class="frame">
      <div class="grid" style:--nc={cols.length} style:--nr={rows.length}>
        {#each rows as r, i (i)}<span class="row-label" style:--r={i + 2}>{r}</span>{/each}
        <div class="scroll" onscroll={scrolled}>
          {#each cols as c, j (j)}<span class="col-label" style:--r={1} style:--c={j + 1}>{c}</span>{/each}
          {#each rows as _, i (i)}{#each cols as __, j (j)}{@render cell(i, j, 1)}{/each}{/each}
        </div>
      </div>
    </div>
  {:else}
    <div class="scroll" onscroll={scrolled}>
      <div class="grid" style:--nc={cols.length}>
        {#each cols as c, j (j)}<span class="col-label" style:--r={1} style:--c={j + 2}>{c}</span>{/each}
        {#each rows as r, i (i)}
          <span class="row-label" style:--r={i + 2} style:--c={1}>{r}</span>
          {#each cols as _, j (j)}{@render cell(i, j, 2)}{/each}
        {/each}
      </div>
    </div>
  {/if}
  {#if diverging}
    <p class="div-legend">
      <span>{scale[0]}</span><span class="div-swatch" aria-hidden="true"></span><span>{scale[1]}</span>
      {#if marked?.flat().some(Boolean)}<span>· Outlined: best in its row</span>{/if}
      {#if blanks}<span>· Blank: no match (or no brews)</span>{/if}
    </p>
  {/if}
  {#if tip}
    <FloatTip follow anchor={tip.el} onclose={() => (tip = null)}>
      <TipBody tip={tipOf ? tipOf(tip.r, tip.c) : { title: label(tip.r, tip.c), lines: [text(cells[tip.r]?.[tip.c] ?? null, tip.r, tip.c)] }} />
    </FloatTip>
  {/if}
</div>

<style>
  .heatmap {
    --cell-h: 1.6rem;
    position: relative;
    container-type: inline-size;
  }
  /* Diverging: a table that scrolls sideways on phones (the page never does), row labels pinned. */
  .diverging {
    --cell-h: 2rem;
  }
  @media (max-width: 480px) {
    .diverging {
      --cell-h: 2.75rem;
    }
  }
  /* Desktop: weekdays as rows, hours as columns. */
  .grid {
    display: grid;
    grid-template-columns: auto repeat(var(--nc), minmax(0, 1fr));
    grid-auto-rows: var(--cell-h);
    gap: 2px;
  }
  .grid > * {
    grid-row: var(--r);
    grid-column: var(--c);
  }
  /* Diverging: row labels in their own column; the plot beside it is a subgrid of the rows and scrolls sideways
     on phones (the page never does), clipped at its left edge so no cell slides under a label. */
  .diverging .grid {
    grid-template-columns: max-content minmax(0, 1fr);
    grid-template-rows: auto;
  }
  .diverging .grid > .scroll {
    grid-column: 2;
    grid-row: 1 / span calc(var(--nr) + 1);
    display: grid;
    grid-template-rows: subgrid;
    grid-template-columns: repeat(var(--nc), minmax(3.25rem, 1fr));
    column-gap: 2px;
    overflow-x: auto;
  }
  .diverging .grid > .scroll > * {
    grid-row: var(--r);
    grid-column: var(--c);
  }
  /* Phones: transposed, so 24 hours run down the page and cells stay tappable. */
  @container (width < 560px) {
    .heatmap:not(.diverging) .grid {
      grid-template-columns: auto repeat(var(--nr), minmax(0, 1fr));
    }
    .heatmap:not(.diverging) .grid > * {
      grid-row: var(--c);
      grid-column: var(--r);
    }
  }
  .col-label,
  .row-label {
    align-self: center;
    font-size: calc(0.75rem * min(var(--grow, 1), 1.2)); /* a stretched lab pair (fitPairs' --grow) scales type up (C3) */
    color: var(--color-text-muted);
    text-align: center;
    padding-inline: 0.25rem;
  }
  .diverging .row-label {
    grid-column: 1;
    grid-row: var(--r);
    text-align: left;
    white-space: nowrap;
  }
  /* Up to 2 lines, centered under their column. */
  .diverging .col-label {
    align-self: end;
    line-height: 1.2;
    text-wrap: balance;
  }
  .div-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    margin: var(--space-2) 0 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  .div-swatch {
    width: 6rem;
    height: 0.6rem;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--div-low), var(--div-mid), var(--div-high));
    border: 1px solid var(--color-border);
  }
  .heat-cell {
    border-radius: 2px;
  }
  .heat-cell.marked {
    outline: 2px solid var(--color-text);
    outline-offset: -2px;
  }
  .heat-cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
