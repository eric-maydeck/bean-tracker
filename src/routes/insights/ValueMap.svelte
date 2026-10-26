<script lang="ts">
  import FloatTip from '$lib/components/FloatTip.svelte';
  import { rove, takeFocus } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { CHIP_EXAMPLE, SAMPLE_HELP, sampleField } from '$lib/sample';
  import { usd, usdPrecise } from '$lib/money';
  import type { ValueMap, ValuePoint } from '$lib/server/insights/spend';

  // Price vs rating, one dot per coffee (a diamond when any of its bags came from a subscription), the dashed lines
  // the medians. The x axis stops at `m.cap` (the cut coffees are listed in the heading's See all). One tab stop,
  // arrows move by position. Hover shows the tip; a click, tap, Enter or Space pins it, and its "Open coffee" link goes
  // to the coffee. A click elsewhere or Escape closes it (ui-rules 49).
  let { m, link }: { m: ValueMap; link: (href: string) => string } = $props();

  let width = $state(0);
  const H = $derived(width && width < 520 ? 260 : 300);
  const L = 48, R = 12, T = 10, B = 40;
  const shown = $derived(m.points.filter((p) => m.cap === null || p.ppg <= m.cap).sort((a, b) => a.ppg - b.ppg));
  const xMax = $derived((m.cap ?? 0.1) * 1.04);
  const floor = $derived(Math.max(0, Math.floor(Math.min(...m.points.map((p) => p.rating)) - 0.5)));
  // ponytail: ticks at 1-2-5 steps of a cent, so labels stay whole cents ("$0.10/g").
  const step = $derived([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5].find((s) => Math.floor(xMax / s + 1e-9) + 1 <= 5) ?? 5);
  const xTicks = $derived(Array.from({ length: Math.floor(xMax / step + 1e-9) + 1 }, (_, i) => +(i * step).toFixed(2)));
  const yTicks = $derived(Array.from({ length: 10 - floor + 1 }, (_, i) => floor + i).filter((v) => (10 - floor <= 6 ? true : v % 2 === 0)));
  const x = (v: number) => L + (v / xMax) * Math.max(0, width - L - R);
  const y = (v: number) => T + ((10 - v) / (10 - floor)) * (H - T - B);
  const perG = (v: number) => `${usd(v)}/g`;

  const tipOf = (p: ValuePoint): Tip => ({
    title: p.name,
    rows: [['Roaster', p.roaster], ['$/g', usdPrecise(p.ppg) ? `${usd(p.ppg)}/g (${usdPrecise(p.ppg)})` : perG(p.ppg)], ['Rating', p.rating.toFixed(2)], ['Brews', String(p.brews)]],
    ...sampleField(p.sample)
  });

  // `reveal`: the page may scroll to show a tip opened by a click, tap or key; a hover tip that a click pins stays put.
  let tip = $state<{ p: ValuePoint; el: Element; pinned: boolean; reveal?: boolean } | null>(null);
  $effect(() => {
    void m;
    tip = null;
  });
  // A hover tip closes after a short delay, so the mouse can cross the gap from the dot onto the tip (its link is
  // clickable); entering either cancels it (as the origin map).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const keep = () => clearTimeout(timer);
  const later = () => (keep(), (timer = setTimeout(() => !tip?.pinned && (tip = null), 100)));
  const at = (e: Event) => {
    const el = (e.target as Element).closest<SVGGElement>('.pt');
    return el ? { el, p: shown[+el.dataset.i!] } : null;
  };
  const href = (p: ValuePoint) => (p.slug ? link(`/coffees/${p.slug}`) : null);
  function hover(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || tip?.pinned) return;
    const t = at(e);
    if (t) (keep(), (tip = { ...t, pinned: false }));
    else later();
  }
  function click(e: MouseEvent) {
    const t = at(e);
    if (!t) return void (tip = null);
    keep();
    tip = tip?.pinned && tip.p === t.p ? null : { ...t, pinned: true, reveal: tip?.p !== t.p };
  }
  const focusTip = (e: FocusEvent) => (takeFocus(e), (tip = { ...at(e)!, pinned: false }));
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.vm-plot, .vm-tip') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && tip?.pinned && (tip = null)} />

<div class="value-map" bind:clientWidth={width}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="vm-plot" style:height="{H}px" role="group" aria-label="Value map: price per gram against rating, one point per coffee"
    onpointermove={hover} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()} onclick={click}
    onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.pt'))}>
    {#if width}
      <svg class="plot" {width} height={H}>
        {#each yTicks as v (v)}
          <line class="grid" x1={L} x2={width - R} y1={y(v)} y2={y(v)} />
          <text class="tick" x={L - 8} y={y(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
        {/each}
        {#each xTicks as v (v)}
          <text class="tick" x={x(v)} y={H - B + 16} text-anchor="middle">{perG(v)}</text>
        {/each}
        <line class="axis" x1={L} x2={width - R} y1={H - B} y2={H - B} />
        <text class="axis-title" x={(L + width - R) / 2} y={H - 6} text-anchor="middle">Price per gram</text>
        <text class="axis-title" transform="translate(12 {(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Rating</text>
        {#if m.medianPpg !== null && m.medianRating !== null}
          {#if m.cap === null || m.medianPpg <= m.cap}<line class="median" x1={x(m.medianPpg)} x2={x(m.medianPpg)} y1={T} y2={H - B} />{/if}
          <line class="median" x1={L} x2={width - R} y1={y(m.medianRating)} y2={y(m.medianRating)} />
        {/if}
        <text class="quad" x={L + 8} y={T + 14}>Great value</text>
        {#each shown as p, i (p.key)}
          {@const cx = x(p.ppg)}
          {@const cy = y(p.rating)}
          <g class="pt" class:small-sample={p.sample.small} class:sub={p.sub} role="button" tabindex={i ? -1 : 0} data-i={i} aria-label={tipText(tipOf(p))}
            onfocus={focusTip} onblur={() => !tip?.pinned && (tip = null)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), (tip = { ...at(e)!, pinned: true, reveal: true }))}>
            <circle class="hit" {cx} {cy} r="14" />
            {#if p.sub}<path class="mark" d="M{cx} {cy - 7}L{cx + 7} {cy}L{cx} {cy + 7}L{cx - 7} {cy}Z" />{:else}<circle class="mark" {cx} {cy} r="5" />{/if}
          </g>
        {/each}
      </svg>
    {/if}
  </div>
  <ul class="legend">
    <li><svg width="12" height="12" aria-hidden="true"><path class="mark" d="M6 0L12 6L6 12L0 6Z" /></svg>Subscription</li>
    <li><svg width="12" height="12" aria-hidden="true"><circle class="mark" cx="6" cy="6" r="5" /></svg>One-off</li>
    <li class="chip-note"><span class="sample-chip"><Icon name="warning" />{CHIP_EXAMPLE}</span> {SAMPLE_HELP.slice(CHIP_EXAMPLE.length + 2)}</li>
  </ul>
  {#if tip}
    <FloatTip anchor={tip.el} onclose={() => (tip = null)} reveal={!!tip.reveal}>
      <!-- svelte-ignore a11y_no_static_element_interactions (a mouse-only bridge from the dot onto the tip; the link is a real link) -->
      <div class="vm-tip" onpointerenter={keep} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()}><TipBody tip={tipOf(tip.p)} />{#if href(tip.p)}<a class="tip-link" href={href(tip.p)}>Open coffee</a>{/if}</div>
    </FloatTip>
  {/if}
</div>

<style>
  .value-map {
    position: relative;
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .grid {
    stroke: var(--color-border);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--color-text-muted);
  }
  .tick,
  .axis-title {
    font-size: 0.72rem;
    fill: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .median {
    stroke: var(--color-text-muted);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .quad {
    font-size: 0.75rem;
    font-weight: 600;
    fill: var(--color-text-muted);
  }
  .mark {
    fill: var(--chart-color-1);
    stroke: var(--color-surface); /* a 2px surface ring where dots overlap */
    stroke-width: 2;
  }
  .pt {
    cursor: pointer;
  }
  .pt.small-sample .mark {
    fill-opacity: 0.4;
    stroke: var(--chart-color-1);
    stroke-width: 1.5;
  }
  .hit {
    fill: transparent;
  }
  .pt:focus-visible {
    outline: none;
  }
  .pt:focus-visible .mark {
    stroke: var(--color-text);
    stroke-width: 2.5;
  }
  @media (hover: hover) {
    .pt:hover .mark {
      stroke: var(--color-text);
    }
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.1rem 0.9rem;
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.72rem;
    line-height: 1.3;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .legend .mark {
    stroke: none;
  }
  .chip-note {
    flex-basis: 100%;
    justify-content: center;
    text-align: center;
    color: var(--color-text-muted);
  }
  /* The tip is pointer-events: none (a hover tip); this wrapper fills it (cancelling its padding) so the mouse can
     rest on it and click the link (as the origin map). */
  .vm-tip {
    margin: -0.5rem -0.75rem;
    padding: 0.5rem 0.75rem;
    pointer-events: auto;
    cursor: default;
  }
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
  }
</style>
