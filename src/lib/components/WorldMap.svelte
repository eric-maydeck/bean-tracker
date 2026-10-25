<script lang="ts">
  import { WORLD, WORLD_VIEWBOX } from '$lib/worldMap';
  import { isoCode } from '$lib/countryFlags';
  import type { Rank } from '$lib/insightsUrl';
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import FloatTip from './FloatTip.svelte';
  import Icon from './Icon.svelte';
  import { MAX_ZOOM, STEP, WHOLE, clampView, panBy, visibleBox, zoomAbout, type View } from './mapZoom';
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

  // Zoom/pan (transient, never in the URL): the <g> carries `view`; `vis` is what the slice-cropped SVG shows.
  const VB = (([x, y, w, h]) => ({ x, y, w, h }))(WORLD_VIEWBOX.split(' ').map(Number));
  let cw = $state(0), ch = $state(0);
  let view = $state<View>(WHOLE);
  let vis = $derived(visibleBox(cw || 1, ch || 1, VB));
  // 1:110m for first paint; the 1:50m outlines (same keys, same coordinates) replace them on the first zoom-in.
  let world = $state.raw(WORLD);
  let sharp = false;
  // Keep the 110m paths' order: a keyed each that has to move a focused path blurs it.
  const keyOf = (c: { iso: string; name: string }) => c.iso || c.name;
  const inOrder = (next: typeof WORLD) => {
    const at = new Map(WORLD.map((c, i) => [keyOf(c), i]));
    return [...next].sort((a, b) => (at.get(keyOf(a)) ?? Infinity) - (at.get(keyOf(b)) ?? Infinity) || 0);
  };
  $effect(() => {
    const c = clampView(view, vis, VB); // the map resized: keep the world covering it
    if (c.x !== view.x || c.y !== view.y) view = c;
  });
  // The tip's point is kept in the <g>'s own units, so a zoom/pan moves it with its country.
  const toLocal = (px: number, py: number) => [(vis.x + (px * vis.w) / cw - view.x) / view.k, (vis.y + (py * vis.h) / ch - view.y) / view.k];
  const toPx = (t: { mx: number; my: number }, v = view) => [((v.x + v.k * t.mx - vis.x) * cw) / vis.w, ((v.y + v.k * t.my - vis.y) * ch) / vis.h];
  function setView(v: View) {
    if (v.k > 1 && !sharp) (sharp = true), import('$lib/worldMap50').then((m) => (world = inOrder(m.WORLD)));
    view = v;
    if (!tip) return;
    const [x, y] = toPx(tip, v);
    if (!pinned || x < 0 || y < 0 || x > cw || y > ch) close();
  }
  const zoomCentered = (f: number) => setView(zoomAbout(view, f, vis.x + vis.w / 2, vis.y + vis.h / 2, vis, VB));
  function zoomKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomCentered(STEP);
    else if (e.key === '-' || e.key === '_') zoomCentered(1 / STEP);
  }
  // One transient hint (wheel / one-finger), restarted by each new one.
  let hint = $state('');
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const showHint = (t: string) => ((hint = t), clearTimeout(hintTimer), (hintTimer = setTimeout(() => (hint = ''), 1500)));
  onDestroy(() => clearTimeout(hintTimer));
  const fadeMs = () => (matchMedia('(prefers-reduced-motion: no-preference)').matches ? 200 : 0);
  const TOUCH_HINT = 'Use two fingers to move the map';
  // client px -> viewBox units
  const toVb = (px: number, py: number) => [vis.x + (px * vis.w) / cw, vis.y + (py * vis.h) / ch];
  // Passive by default as attributes, so these two are added by hand: Ctrl/Cmd+wheel zooms (and must not zoom the
  // page); a two-finger touchmove must not scroll it.
  let svg: SVGSVGElement | undefined = $state();
  $effect(() => {
    if (!svg) return;
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return showHint(`Hold ${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} to zoom the map`);
      e.preventDefault();
      const r = wrap!.getBoundingClientRect(), [cx, cy] = toVb(e.clientX - r.left, e.clientY - r.top);
      setView(zoomAbout(view, Math.exp((-e.deltaY * (e.deltaMode === 1 ? 16 : 1)) / 300), cx, cy, vis, VB));
    };
    const tm = (e: TouchEvent) => e.touches.length >= 2 && e.preventDefault();
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('touchmove', tm, { passive: false });
    return () => (svg!.removeEventListener('wheel', wheel), svg!.removeEventListener('touchmove', tm));
  });
  // Touch: one finger scrolls the page (a hint past 10px or on cancel); two pinch and pan.
  const touches = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0 }, hinted = false;
  function touchMove(e: PointerEvent) {
    const p = touches.get(e.pointerId);
    if (!p) return;
    if (touches.size === 1) {
      if (!hinted && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) (hinted = true), showHint(TOUCH_HINT);
      (p.x = e.clientX), (p.y = e.clientY);
      return;
    }
    const [a, b] = [...touches.values()], gauge = () => [(a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y)];
    const [mx0, my0, d0] = gauge();
    Object.assign(p, { x: e.clientX, y: e.clientY });
    const [mx, my, d] = gauge(), r = wrap!.getBoundingClientRect();
    const [cx, cy] = toVb(mx - r.left, my - r.top);
    const z = d0 ? zoomAbout(view, d / d0, cx, cy, vis, VB) : view;
    setView(panBy(z, ((mx - mx0) * vis.w) / cw, ((my - my0) * vis.h) / ch, vis, VB));
  }
  function touchEnd(e: PointerEvent) {
    if (e.type === 'pointercancel' && touches.size === 1 && touches.has(e.pointerId)) showHint(TOUCH_HINT);
    touches.delete(e.pointerId);
  }
  // A mouse drag past 4px pans; the click that follows it must not pin. Touch is left to the page's scroll.
  let drag: { x: number; y: number; view: View; moved: boolean } | null = null;
  let dragged = false;
  function down(e: PointerEvent) {
    dragged = false;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 1) (start = { x: e.clientX, y: e.clientY }), (hinted = false);
      else dragged = true; // a two-finger gesture never ends in a pin
    }
    drag = e.pointerType === 'mouse' && e.button === 0 ? { x: e.clientX, y: e.clientY, view, moved: false } : null;
  }
  function move(e: PointerEvent) {
    if (e.pointerType === 'touch') return touchMove(e);
    if (!drag) return;
    const [dx, dy] = [e.clientX - drag.x, e.clientY - drag.y];
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= 4) return;
      drag.moved = dragged = true;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      if (!pinned) close();
    }
    setView(panBy(drag.view, (dx * vis.w) / cw, (dy * vis.h) / ch, vis, VB));
  }

  // The shared tip (ui-rules 36, 39: TipBody in a FloatTip, never clipped) at the pointer, or a focused country's
  // center: a 1px anchor there, as Chart.svelte's caret anchor.
  let wrap: HTMLDivElement | undefined = $state();
  let anchor: HTMLSpanElement | undefined = $state();
  let tip = $state<{ iso: string; name: string; mx: number; my: number } | null>(null);
  let [ax, ay] = $derived(tip ? toPx(tip) : [0, 0]);
  // A click or tap pins the tip open until a click or tap elsewhere (or Escape); a mouse hover shows it only while
  // over the country (user, 2026-10-18).
  let pinned = false;
  // An unpinned hover tip closes after a short delay, so the mouse can cross the gap from the country onto the tip
  // (its link is clickable); entering either cancels it (user, 2026-10-20).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const keep = () => clearTimeout(timer);
  const close = () => (keep(), (tip = null), (pinned = false));
  const later = () => ((keep(), (timer = setTimeout(close, 100))));
  onDestroy(keep);

  // A tip stays where the pointer entered its country (no re-placing on every move inside it).
  function place(el: SVGPathElement, clientX: number, clientY: number) {
    if (tip?.iso === el.dataset.iso) return;
    const r = wrap!.getBoundingClientRect();
    const [mx, my] = toLocal(clientX - r.left, clientY - r.top);
    tip = { iso: el.dataset.iso!, name: el.dataset.name!, mx, my };
  }
  // Hover (mouse) and tap (touch/click) share one handler; the sea clears the tip.
  function at(e: MouseEvent) {
    const el = e.target;
    if (el instanceof SVGPathElement) (keep(), place(el, e.clientX, e.clientY));
    else tip = null;
  }
  // Hover only: the sea and the map's edge close an unpinned tip after the bridge delay, not at once.
  function hover(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || pinned || drag?.moved) return;
    if (e.target instanceof SVGPathElement) at(e);
    else later();
  }
  // A click pins; clicking the pinned country again closes it.
  function pin(e: MouseEvent) {
    if (dragged) return;
    const same = pinned && e.target instanceof SVGPathElement && e.target.dataset.iso === tip?.iso;
    if (same) return close();
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

<!-- svelte-ignore a11y_no_static_element_interactions (+ / - zoom while focus is inside; the buttons are the pointer way) -->
<!-- The buttons' icons sit beside .world-map, not in it: `.world-map svg` is the map alone. -->
<div class="map-root" bind:this={wrap} bind:clientWidth={cw} bind:clientHeight={ch} onkeydown={zoomKey}>
<div class="world-map">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (each country is a focusable button; Escape is document-wide) -->
  <svg
    bind:this={svg}
    viewBox={WORLD_VIEWBOX}
    style:--k={view.k}
    preserveAspectRatio="xMidYMid slice"
    role="group"
    aria-label="Coffees by origin country"
    onpointerdown={down}
    onpointermove={(e) => (move(e), hover(e))}
    onpointerup={(e) => ((drag = null), touchEnd(e))}
    onpointercancel={(e) => ((drag = null), touchEnd(e))}
    onpointerleave={(e) => (touchEnd(e), e.pointerType === 'mouse' && !pinned && later())}
    onclick={pin}
  >
    <g transform="translate({view.x} {view.y}) scale({view.k})">
    {#each world as c (keyOf(c))}
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
    </g>
  </svg>
  <span class="tip-anchor" bind:this={anchor} style:left="{ax}px" style:top="{ay}px"></span>
</div>
  <div class="map-zoom" class:row={ch < 560}>
    <button type="button" class="icon-button" aria-label="Zoom in" disabled={view.k >= MAX_ZOOM} onclick={() => zoomCentered(STEP)}><Icon name="plus" /></button>
    <button type="button" class="icon-button" aria-label="Zoom out" disabled={view.k <= 1} onclick={() => zoomCentered(1 / STEP)}><Icon name="minus" /></button>
    <button type="button" class="icon-button" aria-label="Show whole world" disabled={view.k === 1 && !view.x && !view.y} onclick={() => setView(WHOLE)}><Icon name="globe" /></button>
  </div>
  {#if hint}<p class="map-hint" style:--gh={ch < 560 ? '44px' : '140px'} role="status" aria-live="polite" out:fade={{ duration: fadeMs() }}>{hint}</p>{/if}
  {#if tip && anchor}
    {#key tip.iso}{@const href = byIso.get(tip.iso)?.href}<FloatTip {anchor} onclose={close} placeKey={`${ax},${ay}`}><!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events (the tip body is a mouse-only extra: Escape closes it, the link is a real link) --><div class="tip-hover" onpointerenter={keep} onpointerleave={(e) => e.pointerType === 'mouse' && !pinned && later()} onclick={(e) => !(e.target as Element).closest('a') && close()}><TipBody tip={{ title: tip.name, rows: byIso.get(tip.iso)?.rows ?? [] }} />{#if href}<a class="tip-link" href={href}>See coffees</a>{/if}</div></FloatTip>{/key}
  {/if}
</div>

<style>
  .map-root {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .world-map {
    position: relative;
    width: 100%;
    height: 100%;
  }
  svg {
    touch-action: pan-x pan-y; /* one finger scrolls the page */
    display: block;
    width: 100%;
    height: 100%;
  }
  path {
    fill: var(--map-empty);
    stroke: var(--color-surface);
    stroke-width: calc(0.5px / var(--k, 1)); /* constant on screen at any zoom */
  }
  /* Every country opens a tip (its name; with data, its numbers too), and a click only pins it (ui-rules 50). */
  path {
    cursor: help;
  }
  path:focus-visible {
    outline: none;
    stroke: var(--color-accent);
    stroke-width: calc(2px / var(--k, 1));
  }
  /* The tip is pointer-events: none (a hover tip); this wrapper fills it (cancelling its padding) so the mouse can
     rest on it and click the link. */
  .tip-hover {
    margin: -0.5rem -0.75rem;
    padding: 0.5rem 0.75rem;
    pointer-events: auto;
    cursor: default;
  }
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
    cursor: pointer;
  }
  .map-zoom {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .map-zoom button {
    width: 44px;
    height: 44px;
  }
  .map-zoom button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  /* Three stacked 44px buttons would pass a quarter of a short map's height. */
  .map-zoom.row {
    flex-direction: row;
  }
  /* Centered in the map above the zoom group (--gh: its column or short-map row height) and its margins. */
  .map-hint {
    position: absolute;
    top: calc((100% - var(--gh) - 2 * var(--space-2)) / 2);
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: calc(100% - 2 * var(--space-2));
    margin: 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    line-height: 1.35;
    text-align: center;
    pointer-events: none;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }
  .tip-anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
</style>
