<script lang="ts" module>
  import type { BandStat } from '$lib/server/insights/lab';
  import { SAMPLE_HELP, sampleField } from '$lib/sample';
  import type { Tip } from '$lib/components/TipBody.svelte';
  // The lab's number formats: a true minus, and a value that rounds to 0 reads "0.00" (never "−0.00" or "+0.00").
  export const signed = (x: number) => (Math.abs(x) < 0.005 ? '0.00' : (x > 0 ? '+' : '−') + Math.abs(x).toFixed(2));
  export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  // Help popovers are one idea per line (ui-rules 36, T1); a section's help builds on these.
  export const SAME_BAG_HELP = [
    "vs bag: each brew's rating minus its bag's average this period, averaged over the row's brews.",
    'Only bags brewed 2+ ways (2+ brews each) count.',
    SAMPLE_HELP
  ];
  export const STRENGTH_LINE = 'Likely / Possible: the gap is 2×+ / 1.5–2× normal brew-to-brew noise.';
  // The SD help, wherever SD shows (T2).
  export const SD_TIP: Tip = { title: 'SD · standard deviation', lines: ['How much ratings vary from brew to brew.', '', 'Small: consistent.', 'Big: hit or miss.'] };
  // Keyboard focus (not a mouse click, which toggles) opens an SD tip; blur closes it.
  export const sdFocus = (e: FocusEvent) => { const b = e.currentTarget as HTMLButtonElement; if (b.matches(':focus-visible')) (b.popoverTargetElement as HTMLElement | null)?.showPopover(); };
  export const sdBlur = (e: FocusEvent) => ((e.currentTarget as HTMLButtonElement).popoverTargetElement as HTMLElement | null)?.hidePopover();
  // A band, recipe or piece of gear with no same-bag partner (W1): shown as "no match".
  export const noMatch = (what: string) => `Never brewed on the same bag as another ${what}, so there's nothing to compare.`;
  // A same-bag delta chart's rows (Brewing's variables and dial-in, Water's GH); `bold` marks notable labels.
  // The tip (ui-rules 36) adds what the bar doesn't show: the counts behind it, the plain average, a small sample.
  export const bandRows = (bands: BandStat[], bold: (label: string) => boolean = () => false, what = 'band') => bands.map((b) => ({
    label: b.label, value: b.delta, text: !b.plainBrews ? 'no brews' : b.delta === null ? 'no match' : signed(b.delta), small: b.sample.small, strength: b.strength,
    bold: bold(b.label),
    // A grind band's label is its first setting: the tip's title is its range ("0.9.0 – 0.9.9").
    tip: (!b.plainBrews
      ? { title: b.range ?? b.label, note: 'No brews in this band.' }
      : b.delta === null
      ? { title: b.range ?? b.label, rows: [['Brews', `${b.plainBrews}`], ['Bags', `${b.plainBags}`], ['Avg rating', b.adjusted.toFixed(2)]], note: noMatch(what) }
      : { title: b.range ?? b.label, rows: [...(b.sample.small ? [] : [['Same-bag brews', `${b.brews}`], ['Bags', `${b.bags}`]]), ['Avg rating', b.adjusted.toFixed(2)]], ...sampleField(b.sample, true) }) as Tip
  }));
</script>

<script lang="ts">
  import { deltaColor, deltaInk } from '$lib/components/deltaColor';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import { takeFocus } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText } from '$lib/components/TipBody.svelte';
  import type { Strength } from '$lib/server/insights/stats';
  import { STRENGTH } from './Insights.svelte';

  type Row = { label: string; value: number | null; text: string; tip: Tip; small: boolean; bold?: boolean; strength?: Strength | null };
  let { rows, ariaLabel, colors = 'polarity' }: { rows: Row[]; ariaLabel: string; colors?: 'polarity' | 'direction' } = $props();

  // Zero-centred: the axis fits the solid rows when there are any, so a muted row past it is clipped at the
  // edge with a cap (its real value stays in the text and tip); never under 0.05, so tiny deltas show a stub.
  let bars = $derived.by(() => {
    const fit = rows.some((r) => !r.small && r.value !== null) ? rows.filter((r) => !r.small) : rows;
    const max = Math.max(0.05, ...fit.map((r) => Math.abs(r.value ?? 0)));
    return rows.map((r) => {
      const v = r.value ?? 0;
      return { ...r, w: Math.min(1, Math.abs(v) / max) * 50, up: v >= 0, clip: Math.abs(v) > max };
    });
  });

  let wrap: HTMLDivElement | undefined = $state();
  // The open tip: its row's track (the anchor) and index; `hover`: opened by the mouse, so leaving closes it.
  let tip = $state<{ i: number; el: Element; hover: boolean } | null>(null);
  // New rows (a toggle or period change) drop an open tip: its row may not exist any more.
  $effect(() => {
    void rows;
    tip = null;
  });
  const showRow = (el: Element, hover = false) => {
    const i = +(el as HTMLElement).dataset.i!;
    tip = bars[i] ? { i, el: el.querySelector('.track')!, hover } : null;
  };
  const show = (e: Event, hover = false) => {
    const el = (e.target as Element).closest('.bar-row');
    if (el) showRow(el, hover);
    else tip = null;
  };
  // ←/↑ and →/↓ step through the rows; with no tip open (after Escape) the first press reopens the current row's.
  function key(e: KeyboardEvent) {
    const from = (e.target as Element).closest<HTMLElement>('.bar-row');
    if (e.key === 'Escape') return (tip = null);
    if ((e.key === 'Enter' || e.key === ' ') && from) return e.preventDefault(), showRow(from); // as a click does
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
  style:--n={rows.length}
  onpointermove={(e) => e.pointerType === 'mouse' && show(e, true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && tip?.hover && (tip = null)}
  onclick={(e) => show(e)}
  onkeydown={key}
>
  {#each bars as b, i (i)}
    <div
      class="bar-row"
      class:small={b.small}
      role="button"
      tabindex={i ? -1 : 0}
      data-i={i}
      aria-label="{b.label}: {b.text} · {tipText({ ...b.tip, title: '' })}"
      onfocus={(e) => (takeFocus(e), showRow(e.currentTarget))}
      onblur={() => (tip = null)}
    >
      <span class="bar-label" class:bold={b.bold}>{b.label}</span>
      <span class="track" aria-hidden="true">
        {#if b.value !== null}<span class="bar" class:up={b.up} class:clip={b.clip} class:small-sample-mark={b.small} style:width="{b.w}%"
          style:background-color={colors === 'direction' ? null : deltaColor(b.value)}></span>{/if}
      </span>
      <span class="bar-value {colors === 'direction' ? '' : deltaInk(b.value)}">
        {b.text}
        {#if b.strength === 'solid' || b.strength === 'hint'}<span class="badge hl-badge" class:hint={b.strength === 'hint'}>{STRENGTH[b.strength]}</span>{/if}
      </span>
    </div>
  {/each}
  {#if tip && bars[tip.i]}
    <FloatTip anchor={tip.el}><TipBody tip={bars[tip.i].tip} /></FloatTip>
  {/if}
</div>

<style>
  .delta-bars {
    --cell-h: 2rem;
    /* Stretched rows (fitPairs' --grow) scale the chart up, not apart (C3): bars thicken toward ~60% of the
       row (at most 32px), type grows up to 1.2×. Unstretched (no --grow) the bar is 0.75rem. */
    --bar-h: clamp(0.75rem, calc(0.6 * var(--cell-h) * var(--grow, 0)), 32px);
    --type: calc(0.8rem * min(var(--grow, 1), 1.2));
    position: relative;
    display: grid;
    grid-template-columns: var(--bar-label-w, fit-content(45%)) minmax(0, 1fr) var(--bar-value-w, max-content); /* a page can fix the outer columns so sibling charts' 0 lines align */
    column-gap: var(--space-2);
    grid-auto-rows: var(--bar-rows, auto); /* a page can stretch the rows to fill a taller box */
  }
  /* Bars color by size on the lab's fixed scale (deltaColor, C1), inline; grind drift and the like have no good
     side, so one neutral ink and the side of zero shows the direction (ui-rules 29). */
  .direction .bar {
    background-color: var(--color-text-muted);
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
    font-size: var(--type);
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
    height: var(--bar-h);
    min-width: 2px;
    translate: 0 -50%;
    border-radius: 4px 0 0 4px;
  }
  .bar.up {
    right: auto;
    left: 50%;
    border-radius: 0 4px 4px 0;
  }
  /* Clipped at the axis edge (a muted row past the full rows' range): the cut end is an arrow tip, "keeps going". */
  .bar.clip {
    border-radius: 0;
    clip-path: polygon(9px -40%, 100% -40%, 100% 140%, 9px 140%, 0 50%);
  }
  .bar.up.clip {
    clip-path: polygon(0 -40%, calc(100% - 9px) -40%, 100% 50%, calc(100% - 9px) 140%, 0 140%);
    background-position: right 9px top 0, 0 0; /* a small bar's fold sits before the arrow taper */
  }
  .bar-value {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--type);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .small .bar-value {
    color: var(--color-text-muted);
  }
  /* A delta's color (T4) holds on small rows too; the stripes carry the sample cue. */
  .small .bar-value:global(.ink-better) {
    color: var(--div-high-ink);
  }
  .small .bar-value:global(.ink-worse) {
    color: var(--div-low-ink);
  }
</style>
