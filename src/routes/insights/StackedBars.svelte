<script lang="ts">
  import FloatTip from '$lib/components/FloatTip.svelte';
  import { rove, takeFocus } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import type { Multi } from '$lib/server/insights/insightGenerators';
  import { capList, inkOf, seriesColors } from './multiLine';
  import { usd } from '$lib/money';

  // Shares that sum to 100% per month (the lab's "usage over time", G6): one 100% stacked bar per month,
  // the first line at the bottom, "Other" muted; each segment is a tap/keyboard target with its own tip.
  // `m.other[i]`: what month i's "Other" holds ([name, %, $?], biggest first), listed in its tip (C4). `m.dollars[k][i]`:
  // the amount behind a share (Share of spend), shown with it: "$412.00 (18%)".
  // `colors`: a page-wide color per line (Water's recipe map); else the slots in line order.
  // `all` (Share of spend): a named segment's tip lists every named series of its month, the hovered row bold, then the rest as
  // "Other"; `isolate`: a legend click picks one series and fades the rest (a button per entry, aria-pressed).
  let { m, ariaLabel, colors: given, all = false, isolate = false }: { m: Multi & { other?: [string, number, number?][][]; dollars?: number[][] }; ariaLabel: string; colors?: string[]; all?: boolean; isolate?: boolean } = $props();
  // Ephemeral by the user's request (2026-10-26): not in the URL, not stored, gone on navigation. A deliberate exception to the
  // shareable-URL-state rule.
  let iso = $state<number | null>(null);
  $effect(() => {
    void m;
    iso = null;
  });

  let colors = $derived(given ?? seriesColors(m.lines.map((l) => l.label)));
  let n = $derived(m.x.length);
  // Month labels counted back from the last: up to 8 wide, up to 4 in a narrow container.
  let [wide, narrow] = $derived([Math.ceil(n / 8), Math.ceil(n / 4)]);
  const pct = (v: number) => (v ? `${v}%` : '<1%');
  const amount = (p: number, d?: number) => (d === undefined ? pct(p) : `${usd(d)} (${pct(p)})`);
  // A segment's tip (round 3): the month as the title, then the series and its share as one row ("V60  38%");
  // "Other" lists what it holds, up to 8 on desktop (≥ 768px) and 4 on phones, then "+N more". `max`: the
  // aria-label names every member.
  const otherRows = () => (typeof matchMedia === 'function' && matchMedia('(min-width: 768px)').matches ? 8 : 4);
  const tipOf = (k: number, i: number, max = otherRows()): Tip => {
    const { shown, more } = capList(m.lines[k].label === 'Other' ? (m.other?.[i] ?? []) : [], max);
    return { title: m.x[i], rows: [[m.lines[k].label, m.dollars ? amount(m.lines[k].values[i] ?? 0, m.dollars[k][i]) : `${m.lines[k].values[i] ?? 0}%`], ...shown.map(([name, v, d]): [string, string, string] => [name, amount(v, d), 'sub'])],
      note: more ? `+${more} more` : undefined };
  };
  // The tip shown: the segment's own, or (`all`, a named series) every named series of the month with the hovered one bold.
  const shownTip = (k: number, i: number): Tip => {
    if (!all || m.lines[k].label === 'Other') return tipOf(k, i);
    const row = (j: number): [string, string, string] => [m.lines[j].label, m.dollars ? amount(m.lines[j].values[i] ?? 0, m.dollars[j][i]) : `${m.lines[j].values[i] ?? 0}%`, j === k ? 'hl' : ''];
    // Biggest $ first, "Other" last.
    const named = m.lines.flatMap((l, j) => (l.label !== 'Other' && (l.values[i] ?? 0) > 0 ? [j] : []))
      .sort((a, b) => (m.dollars ? m.dollars[b][i] - m.dollars[a][i] : (m.lines[b].values[i] ?? 0) - (m.lines[a].values[i] ?? 0))).map(row);
    const o = m.lines.findIndex((l) => l.label === 'Other');
    return { title: m.x[i], rows: [...named, ...(o >= 0 && (m.lines[o].values[i] ?? 0) > 0 ? [[`Other`, row(o)[1], ''] as [string, string, string]] : [])] };
  };
  // The legend's order: alphabetical with Other last for Share of spend (`all`); a roaster's color stays its own (by line).
  const legendOrder = $derived(m.lines.map((_, k) => k).sort((a, b) => {
    if (!all) return a - b;
    const [x, y] = [m.lines[a].label, m.lines[b].label];
    return x === 'Other' ? 1 : y === 'Other' ? -1 : x.localeCompare(y, 'en', { sensitivity: 'base' });
  }));
  // The tab stop: the first drawn segment (a 0% share draws nothing), so the chart is always reachable.
  let stop = $derived.by(() => {
    for (let i = 0; i < n; i++) for (let k = 0; k < m.lines.length; k++) if ((m.lines[k].values[i] ?? 0) > 0) return `${i}:${k}`;
    return '';
  });

  // `hover`: opened by the mouse, so leaving closes it (a focus tip survives the page scrolling under the mouse).
  let tip = $state<{ k: number; i: number; el: Element; hover: boolean } | null>(null);
  // New data drops an open tip: its segment may not exist any more.
  $effect(() => {
    void m;
    tip = null;
  });
  const showSeg = (el: Element, hover = false) => {
    const d = (el as HTMLElement).dataset;
    tip = { el, k: +d.k!, i: +d.i!, hover };
  };
  const pick = (e: Event, hover = false) => {
    const el = (e.target as Element).closest('.seg');
    if (el) showSeg(el, hover);
    else tip = null;
  };
</script>

<div class="stacked">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="plot-row"
    role="group"
    aria-label={ariaLabel}
    onpointermove={(e) => e.pointerType === 'mouse' && pick(e, true)}
    onpointerleave={(e) => e.pointerType === 'mouse' && tip?.hover && (tip = null)}
    onclick={(e) => pick(e)}
    onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.seg'))}
  >
    <div class="y-labels" aria-hidden="true">
      {#each [100, 75, 50, 25, 0] as v (v)}<span style:top="{100 - v}%">{v}%</span>{/each}
    </div>
    <div class="plot">
      {#each m.x as x, i (i)}
        <div class="col"><div class="stack">
          {#each m.lines as l, k (k)}
            {@const v = l.values[i] ?? 0}
            {#if v > 0}
              <div class="seg" role="button" tabindex={stop === `${i}:${k}` ? 0 : -1} data-k={k} data-i={i} style:flex-grow={v} style:background={colors[k]} style:--ink={inkOf(colors[k])} class:faded={iso !== null && iso !== k}
                aria-label={tipText(tipOf(k, i, Infinity))} onfocus={(e) => (takeFocus(e), showSeg(e.currentTarget))} onblur={() => (tip = null)}></div>
            {/if}
          {/each}
        </div></div>
      {/each}
    </div>
    <div class="x-labels" aria-hidden="true">
      {#each m.x as x, i (i)}<span class:alt={(n - 1 - i) % wide > 0} class:thin={(n - 1 - i) % narrow > 0}>{x}</span>{/each}
    </div>
  </div>
  <ul class="legend" aria-hidden={isolate ? undefined : true}>
    {#each legendOrder as k (k)}
      {@const l = m.lines[k]}
      <li class:faded={iso !== null && iso !== k} class:on={iso === k}>
        {#if isolate}<button type="button" class="leg" aria-pressed={iso === k} onclick={() => (iso = iso === k ? null : k)}><span class="swatch" style:background={colors[k]} style:--ink={inkOf(colors[k])}></span>{l.label}</button>
        {:else}<span class="swatch" style:background={colors[k]} style:--ink={inkOf(colors[k])}></span>{l.label}{/if}
      </li>
    {/each}
  </ul>
  {#if tip && m.lines[tip.k]}
    <FloatTip anchor={tip.el} onclose={() => (tip = null)}><TipBody tip={shownTip(tip.k, tip.i)} /></FloatTip>
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
    height: 12rem;
    background: repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px 25%);
    border-bottom: 1px solid var(--color-border);
  }
  @media (max-width: 480px) {
    .plot {
      height: 10rem;
    }
  }
  /* The first line at the bottom. A 2px surface line tops each segment but the last, inside its own share
     (border-box), so the stack stays true to the 25% gridlines. */
  /* Each month's slot centers a bar 75% of its width (C4): a gap between bars and half a gap at the plot edges. */
  .col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    justify-content: center;
  }
  .stack {
    width: 75%;
    display: flex;
    flex-direction: column-reverse;
  }
  .seg {
    flex-basis: 0;
    box-sizing: border-box;
    cursor: help; /* a click opens only the tip (ui-rules 50) */
    box-shadow: inset 0 0 0 0.75px var(--slice-line); /* the one dark bar outline (ui-rules 42) */
  }
  .seg:not(:last-child) {
    border-top: 2px solid var(--color-surface);
  }
  .stack > .seg:last-child {
    border-radius: 3px 3px 0 0;
  }
  @media (hover: hover) {
    .seg:hover {
      filter: brightness(1.12);
    }
  }
  .seg.faded {
    opacity: 0.25;
  }
  .seg:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 1px;
  }
  .x-labels {
    grid-column: 2;
    display: flex;
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
  .legend li.faded {
    opacity: 0.45;
  }
  .legend li.on {
    font-weight: 700;
  }
  .leg {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.3rem;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  @media (max-width: 640px) {
    .leg {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
  }
  .swatch {
    flex-shrink: 0;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    box-shadow: inset 0 0 0 0.75px var(--slice-line); /* the one dark bar outline (ui-rules 42) */
  }
</style>
