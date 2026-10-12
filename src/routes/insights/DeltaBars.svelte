<script lang="ts" module>
  export const SAME_BAG_HELP =
    "Each brew's rating minus its bag's average this period, averaged per band: +0.40 means brews in this band beat the same bag's other brews by 0.40. Only bags brewed in two or more bands (2+ brews each) count. Pale: under 3 bags or 30 brews. The tip also shows the plain bag-weighted average.";
</script>

<script lang="ts">
  import { takeFocus, tipAt } from '$lib/components/Heatmap.svelte';
  import type { Strength } from '$lib/server/insights/stats';
  import { STRENGTH } from './Insights.svelte';

  type Row = { label: string; value: number | null; text: string; tip: string; pale: boolean; bold?: boolean; strength?: Strength | null };
  let { rows, ariaLabel, colors = 'polarity' }: { rows: Row[]; ariaLabel: string; colors?: 'polarity' | 'direction' } = $props();

  // Zero-centred: the axis fits the solid rows when there are any, so a pale row past it is clipped at the
  // edge with a cap (its real value stays in the text and tip); never under 0.05, so tiny deltas show a stub.
  let bars = $derived.by(() => {
    const fit = rows.some((r) => !r.pale && r.value !== null) ? rows.filter((r) => !r.pale) : rows;
    const max = Math.max(0.05, ...fit.map((r) => Math.abs(r.value ?? 0)));
    return rows.map((r) => {
      const v = r.value ?? 0;
      return { ...r, w: Math.min(1, Math.abs(v) / max) * 50, up: v >= 0, clip: Math.abs(v) > max };
    });
  });

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  // New rows (a toggle or period change) drop an open tip: its row may not exist any more.
  $effect(() => {
    void rows;
    tip = null;
  });
  const showRow = (el: Element) => {
    const b = bars[+(el as HTMLElement).dataset.i!];
    tip = b ? tipAt(wrap!, el.querySelector('.track')!, b.tip, 128) : null;
  };
  const show = (e: Event) => {
    const el = (e.target as Element).closest('.bar-row');
    if (el) showRow(el);
    else tip = null;
  };
  // ←/↑ and →/↓ step through the rows; with no tip open (after Escape) the first press reopens the current row's.
  function key(e: KeyboardEvent) {
    const from = (e.target as Element).closest<HTMLElement>('.bar-row');
    if (e.key === 'Escape') return (tip = null);
    const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!d || !from) return;
    e.preventDefault();
    if (!tip) return showRow(from);
    const all = [...wrap!.querySelectorAll<HTMLElement>('.bar-row')];
    all[Math.min(all.length - 1, Math.max(0, all.indexOf(from) + d))].focus();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div
  class="delta-bars"
  class:direction={colors === 'direction'}
  role="group"
  aria-label={ariaLabel}
  bind:this={wrap}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e)}
  onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
  onclick={show}
  onkeydown={key}
>
  {#each bars as b, i (i)}
    <div
      class="bar-row"
      class:pale={b.pale}
      role="button"
      tabindex={i ? -1 : 0}
      data-i={i}
      aria-label={b.tip.startsWith(b.label) ? b.tip : `${b.label}: ${b.tip}`}
      onfocus={(e) => (takeFocus(e), showRow(e.currentTarget))}
      onblur={() => (tip = null)}
    >
      <span class="bar-label" class:bold={b.bold}>{b.label}</span>
      <span class="track" aria-hidden="true">
        {#if b.value !== null}<span class="bar" class:up={b.up} class:clip={b.clip} style:width="{b.w}%"></span>{/if}
      </span>
      <span class="bar-value">
        {b.value === null ? 'few brews' : b.text}
        {#if b.strength === 'solid' || b.strength === 'hint'}<span class="badge hl-badge" class:hint={b.strength === 'hint'}>{STRENGTH[b.strength]}</span>{/if}
      </span>
    </div>
  {/each}
  {#if tip}
    <div class="cell-tip wide" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 48}>{tip.text}</div>
  {/if}
</div>

<style>
  .delta-bars {
    --cell-h: 2rem;
    --pos: var(--color-fresh);
    --neg: var(--color-urgent);
    position: relative;
    display: grid;
    grid-template-columns: var(--bar-label-w, fit-content(45%)) minmax(0, 1fr) var(--bar-value-w, max-content); /* a page can fix the outer columns so sibling charts' 0 lines align */
    column-gap: var(--space-2);
  }
  /* Grind drift and the like: no good side, so the diverging pair by direction (ui-rules 29). */
  .direction {
    --pos: var(--div-high);
    --neg: var(--div-low);
  }
  @media (max-width: 480px) {
    .delta-bars {
      --cell-h: 2.75rem;
    }
  }
  .bar-row {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    min-height: var(--cell-h);
    border-radius: 2px;
    cursor: pointer;
  }
  @media (hover: hover) {
    .bar-row:hover {
      background: color-mix(in oklab, var(--color-text-muted) 8%, transparent);
    }
  }
  .bar-row:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .bar-label {
    text-align: right;
    font-size: 0.8rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .bar-label.bold {
    font-weight: 700;
  }
  .track {
    position: relative;
    align-self: stretch;
  }
  /* The 0 line: recessive, behind the bar. */
  .track::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    border-left: 1px solid var(--color-border);
  }
  .bar {
    position: absolute;
    top: 50%;
    right: 50%;
    height: 0.75rem;
    min-width: 2px;
    translate: 0 -50%;
    background: var(--neg);
    border-radius: 4px 0 0 4px;
  }
  .bar.up {
    right: auto;
    left: 50%;
    background: var(--pos);
    border-radius: 0 4px 4px 0;
  }
  /* Clipped at the axis edge (a pale row past the solid rows' range): a cap marks the cut end. */
  .bar.clip {
    border-left: 2px solid var(--color-text);
  }
  .bar.up.clip {
    border-left: 0;
    border-right: 2px solid var(--color-text);
  }
  .pale .bar {
    opacity: 0.4;
  }
  .bar-value {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .pale .bar-value {
    color: var(--color-text-muted);
  }
  .hl-badge.hint {
    background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
    color: var(--color-text-muted);
  }
</style>
