<script lang="ts">
  import { WORLD, WORLD_VIEWBOX } from '$lib/worldMap';
  import { isoCode } from '$lib/countryFlags';
  import type { Rank } from '$lib/insightsUrl';
  import FloatTip from './FloatTip.svelte';
  import TipBody, { type TipRow } from './TipBody.svelte';

  // `valueLabel`: the Rank by value's name, the tip's last row label.
  let {
    rows, rank, valueText, valueLabel
  }: { rows: { key: string; label: string; value: number; bags: number }[]; rank: Rank; valueText: (v: number) => string; valueLabel: string } =
    $props();

  // Shade by the Rank-by value: a share (value ÷ the top value) for totals and $/g, min → max
  // for ratings, so the map and the list beside it never disagree.
  let byIso = $derived.by(() => {
    const m = new Map<string, { label: string; rows: TipRow[]; text: string; tone: number }>();
    if (!rows.length) return m;
    const total = rows.reduce((s, r) => s + r.bags, 0);
    const vals = rows.map((r) => r.value);
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    for (const r of rows) {
      const iso = isoCode(r.key);
      if (!iso) continue;
      const tone = rank === 'rating' ? (hi === lo ? 1 : (r.value - lo) / (hi - lo)) : hi > 0 ? r.value / hi : 0;
      const share = `${total ? Math.round((100 * r.bags) / total) : 0}%`;
      const rows: TipRow[] = [['Coffees', `${r.bags}`], ['Share', share], [valueLabel, valueText(r.value)]];
      m.set(iso, { label: r.label, rows, text: `${r.bags} coffee${r.bags === 1 ? '' : 's'} · ${share} · ${valueText(r.value)}`, tone });
    }
    return m;
  });

  // The shared tip (ui-rules 36, 39: TipBody in a FloatTip, never clipped) at the pointer, or a focused country's
  // center: a 1px anchor there, as Chart.svelte's caret anchor.
  let wrap: HTMLDivElement | undefined = $state();
  let anchor: HTMLSpanElement | undefined = $state();
  let tip = $state<{ iso: string; name: string; x: number; y: number } | null>(null);

  // A tip stays where the pointer entered its country (no re-placing on every move inside it).
  function place(el: SVGPathElement, clientX: number, clientY: number) {
    if (tip?.iso === el.dataset.iso) return;
    const r = wrap!.getBoundingClientRect();
    tip = { iso: el.dataset.iso!, name: el.dataset.name!, x: clientX - r.left, y: clientY - r.top };
  }
  // Hover (mouse) and tap (touch/click) share one handler; the sea clears the tip.
  function at(e: MouseEvent) {
    const el = e.target;
    if (el instanceof SVGPathElement) place(el, e.clientX, e.clientY);
    else tip = null;
  }
  function focusTip(e: Event) {
    const el = e.currentTarget as SVGPathElement;
    const b = el.getBoundingClientRect();
    place(el, b.left + b.width / 2, b.top + b.height / 2);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focusTip(e);
    }
  }
</script>

<div class="world-map" bind:this={wrap}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox={WORLD_VIEWBOX}
    preserveAspectRatio="xMidYMid slice"
    role="group"
    aria-label="Coffees by origin country"
    onpointermove={(e) => e.pointerType === 'mouse' && at(e)}
    onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
    onclick={at}
    onkeydown={(e) => e.key === 'Escape' && (tip = null)}
  >
    {#each WORLD as c (c.name)}
      {@const d = byIso.get(c.iso)}
      {#if d}
        <path
          d={c.d}
          data-iso={c.iso}
          data-name={d.label}
          class="has"
          style:fill={`color-mix(in oklab, var(--map-high) ${Math.round(20 + 80 * d.tone)}%, var(--map-low))`}
          tabindex="0"
          role="button"
          aria-label="{d.label}: {d.text}"
          onkeydown={key}
          onfocus={focusTip}
          onblur={() => (tip = null)}
        />
      {:else}
        <path d={c.d} data-iso={c.iso} data-name={c.name} />
      {/if}
    {/each}
  </svg>
  <span class="tip-anchor" bind:this={anchor} style:left="{tip?.x ?? 0}px" style:top="{tip?.y ?? 0}px"></span>
  {#if tip && anchor}
    {#key tip.iso}<FloatTip {anchor} onclose={() => (tip = null)}><TipBody tip={{ title: tip.name, rows: byIso.get(tip.iso)?.rows ?? [] }} /></FloatTip>{/key}
  {/if}
</div>

<style>
  .world-map {
    position: relative;
    width: 100%;
    height: 100%;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  path {
    fill: var(--map-empty);
    stroke: var(--color-surface);
    stroke-width: 0.5;
  }
  path.has {
    cursor: pointer;
  }
  path:focus-visible {
    outline: none;
    stroke: var(--color-accent);
    stroke-width: 2;
  }
  .tip-anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
</style>
