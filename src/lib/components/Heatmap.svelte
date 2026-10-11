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

  // Tooltip position inside `wrap` for a cell: centred on it, clamped 5rem from either edge.
  export function tipAt(wrap: HTMLElement, el: Element, text: string) {
    const w = wrap.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const x = Math.min(Math.max(b.left + b.width / 2 - w.left, 80), w.width - 80);
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
  let {
    rows,
    cols,
    cells,
    text,
    label,
    cellHeight = '1.6rem',
    ariaLabel
  }: {
    rows: string[];
    cols: string[];
    cells: (number | null)[][];
    text: (v: number | null) => string;
    label: (r: number, c: number) => string;
    cellHeight?: string;
    ariaLabel: string;
  } = $props();

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  let shade = $derived(shader(cells.flat()));

  const show = (e: Event) => {
    const el = (e.target as Element).closest('.heat-cell');
    tip = el ? tipAt(wrap!, el, el.getAttribute('aria-label')!) : null;
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="heatmap"
  role="group"
  aria-label={ariaLabel}
  bind:this={wrap}
  style:--nr={rows.length}
  style:--nc={cols.length}
  style:--cell-h={cellHeight}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.heat-cell'))}
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
          tabindex={i + j ? -1 : 0}
          aria-label="{label(i, j)} · {text(v)}"
          style:--r={i + 2}
          style:--c={j + 2}
          class:none={v === null}
          style:background={shade(v)}
          onfocus={(e) => (takeFocus(e), show(e))}
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
</style>
