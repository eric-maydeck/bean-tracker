<script lang="ts" module>
  // One sequential ramp (the WorldMap's): low → high by tone over the non-null values;
  // null is the no-data colour. Shared with BrewCalendar.
  export function shader(values: (number | null)[]) {
    const vs = values.filter((v): v is number => v !== null);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    return (v: number | null) => {
      if (v === null) return 'var(--map-empty)';
      const tone = max > min ? (v - min) / (max - min) : 1;
      return `color-mix(in oklab, var(--map-high) ${Math.round(20 + 80 * tone)}%, var(--map-low))`;
    };
  }

  // Tooltip position inside `wrap` for a cell: centred on it, clamped 5rem from either edge.
  export function tipAt(wrap: HTMLElement, el: Element, text: string) {
    const w = wrap.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const x = Math.min(Math.max(b.left + b.width / 2 - w.left, 80), w.width - 80);
    return { text, x, y: b.top - w.top };
  }
</script>

<script lang="ts">
  let {
    rows,
    cols,
    cells,
    text,
    label,
    cellHeight = '1.6rem'
  }: {
    rows: string[];
    cols: string[];
    cells: (number | null)[][];
    text: (v: number | null) => string;
    label: (r: number, c: number) => string;
    cellHeight?: string;
  } = $props();

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  let shade = $derived(shader(cells.flat()));

  const show = (e: Event) => {
    const el = (e.target as Element).closest('.heat-cell');
    tip = el ? tipAt(wrap!, el, el.getAttribute('aria-label')!) : null;
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
  class="heatmap"
  bind:this={wrap}
  style:--nr={rows.length}
  style:--nc={cols.length}
  style:--cell-h={cellHeight}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => e.key === 'Escape' && (tip = null)}
>
  <div class="grid">
    {#each cols as c, j (j)}<span class="col-label" style:--r={1} style:--c={j + 2}>{c}</span>{/each}
    {#each rows as r, i (i)}
      <span class="row-label" style:--r={i + 2} style:--c={1}>{r}</span>
      {#each cols as _, j (j)}
        {@const v = cells[i]?.[j] ?? null}
        <div
          class="heat-cell"
          role="button"
          tabindex="0"
          aria-label="{label(i, j)} · {text(v)}"
          style:--r={i + 2}
          style:--c={j + 2}
          style:background={shade(v)}
          onfocus={show}
          onblur={() => (tip = null)}
        ></div>
      {/each}
    {/each}
  </div>
  {#if tip}
    <div class="cell-tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>{tip.text}</div>
  {/if}
</div>

<style>
  .heatmap {
    position: relative;
    container-type: inline-size;
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
  /* Phones: transposed, so 24 hours run down the page and cells stay tappable. */
  @container (width < 560px) {
    .grid {
      grid-template-columns: auto repeat(var(--nr), minmax(0, 1fr));
    }
    .grid > * {
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
  .heat-cell {
    border-radius: 2px;
    cursor: pointer;
  }
  .heat-cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .cell-tip {
    position: absolute;
    translate: -50% calc(-100% - 0.4rem);
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }
  .cell-tip.below {
    translate: -50% calc(var(--cell-h) + 0.4rem);
  }
</style>
