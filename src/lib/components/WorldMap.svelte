<script lang="ts">
  import { WORLD, WORLD_VIEWBOX } from '$lib/worldMap';
  import { isoCode } from '$lib/countryFlags';
  import type { Rank } from '$lib/insightsUrl';
  import FloatTip from './FloatTip.svelte';
  import TipBody, { type TipRow } from './TipBody.svelte';

  // `valueLabel`: the Rank by value's name, the tip's last row label.
  let {
    rows, rank, valueText, valueLabel
  }: { rows: { key: string; label: string; value: number; bags: number; href?: string }[]; rank: Rank; valueText: (v: number) => string; valueLabel: string } =
    $props();

  // Shade by the Rank-by value: a share (value ÷ the top value) for totals and $/g, min → max
  // for ratings, so the map and the list beside it never disagree.
  let byIso = $derived.by(() => {
    const m = new Map<string, { label: string; rows: TipRow[]; text: string; tone: number; href?: string }>();
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
      m.set(iso, { label: r.label, rows, text: `${r.bags} coffee${r.bags === 1 ? '' : 's'} · ${share} · ${valueText(r.value)}`, tone, href: r.href });
    }
    return m;
  });

  // The shared tip (ui-rules 36, 39: TipBody in a FloatTip, never clipped) at the pointer, or a focused country's
  // center: a 1px anchor there, as Chart.svelte's caret anchor.
  let wrap: HTMLDivElement | undefined = $state();
  let anchor: HTMLSpanElement | undefined = $state();
  let tip = $state<{ iso: string; name: string; x: number; y: number } | null>(null);
  // A click or tap pins the tip open until a click or tap elsewhere (or Escape); a mouse hover shows it only while
  // over the country (user, 2026-10-18).
  let pinned = false;
  const close = () => ((tip = null), (pinned = false));

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
  function pin(e: MouseEvent) {
    at(e);
    pinned = !!tip;
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

<!-- A click or tap outside the map, or Escape, closes a pinned tip. -->
<svelte:document onclick={(e) => tip && !wrap?.contains(e.target as Node) && close()} onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="world-map" bind:this={wrap}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (each country is a focusable button; Escape is document-wide) -->
  <svg
    viewBox={WORLD_VIEWBOX}
    preserveAspectRatio="xMidYMid slice"
    role="group"
    aria-label="Coffees by origin country"
    onpointermove={(e) => e.pointerType === 'mouse' && !pinned && at(e)}
    onpointerleave={(e) => e.pointerType === 'mouse' && !pinned && (tip = null)}
    onclick={pin}
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
          onblur={(e) => !wrap?.contains(e.relatedTarget as Node) && !pinned && close()}
        />
      {:else}
        <path d={c.d} data-iso={c.iso} data-name={c.name} />
      {/if}
    {/each}
  </svg>
  <span class="tip-anchor" bind:this={anchor} style:left="{tip?.x ?? 0}px" style:top="{tip?.y ?? 0}px"></span>
  {#if tip && anchor}
    {#key tip.iso}{@const href = byIso.get(tip.iso)?.href}<FloatTip {anchor} onclose={close}><TipBody tip={{ title: tip.name, rows: byIso.get(tip.iso)?.rows ?? [] }} />{#if href}<a class="tip-link" href={href}>See coffees</a>{/if}</FloatTip>{/key}
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
  /* Every country opens a tip (its name; with data, its numbers too), and a click only pins it (ui-rules 50). */
  path {
    cursor: help;
  }
  path:focus-visible {
    outline: none;
    stroke: var(--color-accent);
    stroke-width: 2;
  }
  /* The tip is pointer-events: none (a hover tip); its link takes clicks once the tip is pinned. */
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
    pointer-events: auto;
    cursor: pointer;
  }
  .tip-anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
</style>
