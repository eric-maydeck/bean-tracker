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

  // Diverging (the lab's deltas): 0 is the neutral gray --div-mid, sign picks --div-low (worse, red) /
  // --div-high (better, green) and the tone runs 30–100% by |v| over the largest |v| of `values` (a value
  // past it is capped at 100%).
  export function diverge(values: (number | null)[]) {
    const max = Math.max(...values.map((v) => Math.abs(v ?? 0))) || 1;
    return (v: number | null) => {
      if (v === null) return 'transparent';
      if (v === 0) return 'var(--div-mid)';
      return `color-mix(in oklab, var(${v < 0 ? '--div-low' : '--div-high'}) ${Math.round(30 + 70 * Math.min(1, Math.abs(v) / max))}%, var(--div-mid))`;
    };
  }

  // Tooltip position inside `wrap` for a cell: centred on it, clamped `half` px (the tip's half width,
  // 5rem for the nowrap tip, 8rem for a .wide one) from either edge; a wrap narrower than the tip (a small
  // mineral card) clamps it inside the viewport instead.
  export function tipAt(wrap: HTMLElement, el: Element, text: string, half = 80) {
    const w = wrap.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const c = b.left + b.width / 2;
    const x = w.width >= 2 * half ? Math.min(Math.max(c - w.left, half), w.width - half)
      : Math.min(Math.max(c, half + 8), document.documentElement.clientWidth - half - 8) - w.left;
    return { text, x, y: b.top - w.top };
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
  import TipBody, { type Tip } from './TipBody.svelte';

  let {
    rows,
    cols,
    cells,
    text,
    label,
    ariaLabel,
    diverging = false,
    faded,
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
    faded?: boolean[][]; // diverging: thin cells, drawn faded; the scale fits the other cells when there are any
    marked?: boolean[][]; // outlined cells (the lab's rest heatmap: each row's best)
    tip?: (r: number, c: number) => Tip; // a structured tip (ui-rules 36); else the cell's aria-label
    scale?: [string, string]; // diverging legend: the low and high ends
  } = $props();

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; r: number; c: number; x: number; y: number } | null>(null);
  let fade = $derived(faded?.flat().some(Boolean) ?? false);
  let solid = $derived(cells.flatMap((r, i) => r.filter((v, j) => v !== null && !faded?.[i]?.[j])));
  let shade = $derived(diverging ? diverge(solid.length ? solid : cells.flat()) : shader(cells.flat()));
  let blanks = $derived(cells.flat().some((v) => v === null));
  // New data drops an open tip: its cell may not exist any more.
  $effect(() => {
    void cells;
    tip = null;
  });
  const tipFor = (el: Element) => {
    const d = (el as HTMLElement).dataset;
    return { ...tipAt(wrap!, el, el.getAttribute('aria-label')!, diverging ? 128 : 80), r: +d.r!, c: +d.c! };
  };
  const show = (e: Event) => {
    const el = (e.target as Element).closest('.heat-cell');
    tip = el ? tipFor(el) : null;
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
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.heat-cell'))}
>
  <div class="scroll" onscroll={scrolled}>
    <div class="grid" style:--nc={cols.length}>
      {#each cols as c, j (j)}<span class="col-label" style:--r={1} style:--c={j + 2}>{c}</span>{/each}
      {#each rows as r, i (i)}
        <span class="row-label" style:--r={i + 2} style:--c={1}>{r}</span>
        {#each cols as _, j (j)}
          {@const v = cells[i]?.[j] ?? null}
          <div
            class="heat-cell"
            role="button"
            tabindex={i + j ? -1 : 0}
            data-r={i}
            data-c={j}
            aria-label="{label(i, j)} · {text(v, i, j)}"
            style:--r={i + 2}
            style:--c={j + 2}
            class:none={v === null}
            class:faded={!!faded?.[i]?.[j]}
            class:marked={!!marked?.[i]?.[j]}
            style:background={shade(v)}
            onfocus={(e) => (takeFocus(e), show(e))}
            onblur={() => (tip = null)}
          ></div>
        {/each}
      {/each}
    </div>
  </div>
  {#if diverging}
    <p class="div-legend">
      <span>{scale[0]}</span><span class="div-swatch" aria-hidden="true"></span><span>{scale[1]}</span>
      {#if fade}<span>· Faded: few brews</span>{/if}
      {#if marked?.flat().some(Boolean)}<span>· Outlined: best in its row</span>{/if}
      {#if blanks}<span>· Blank: no match (or no brews)</span>{/if}
    </p>
  {/if}
  {#if tip}
    <div class="cell-tip" class:wide={diverging} role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>
      {#if tipOf}<TipBody tip={tipOf(tip.r, tip.c)} />{:else}{tip.text}{/if}
    </div>
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
  .diverging .scroll {
    overflow-x: auto;
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
  .diverging .grid {
    grid-template-columns: max-content repeat(var(--nc), minmax(3.25rem, 1fr));
    grid-template-rows: auto;
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
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: center;
    padding-inline: 0.25rem;
  }
  .diverging .row-label {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--color-surface);
    text-align: left;
    white-space: nowrap;
  }
  /* Up to 2 lines, centred under their column. */
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
    cursor: pointer;
  }
  .heat-cell.faded {
    opacity: var(--faded);
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
