<script lang="ts">
  import { WORLD, WORLD_VIEWBOX } from '$lib/worldMap';
  import { isoCode } from '$lib/countryFlags';
  import type { Rank } from '$lib/insightsUrl';

  let {
    rows, rank, valueText
  }: { rows: { key: string; label: string; value: number; bags: number }[]; rank: Rank; valueText: (v: number) => string } =
    $props();

  // Shade by the Rank-by value: a share (value ÷ the top value) for totals and $/g, min → max
  // for ratings, so the map and the list beside it never disagree.
  let byIso = $derived.by(() => {
    const m = new Map<string, { label: string; text: string; tone: number }>();
    if (!rows.length) return m;
    const total = rows.reduce((s, r) => s + r.bags, 0);
    const vals = rows.map((r) => r.value);
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    for (const r of rows) {
      const iso = isoCode(r.key);
      if (!iso) continue;
      const tone = rank === 'rating' ? (hi === lo ? 1 : (r.value - lo) / (hi - lo)) : hi > 0 ? r.value / hi : 0;
      const coffees = `${r.bags} coffee${r.bags === 1 ? '' : 's'} · ${total ? Math.round((100 * r.bags) / total) : 0}%`;
      m.set(iso, { label: r.label, text: `${coffees} · ${valueText(r.value)}`, tone });
    }
    return m;
  });

  let wrap: HTMLDivElement | undefined = $state();
  let tip = $state<{ iso: string; name: string; x: number; y: number } | null>(null);

  function place(el: SVGPathElement, clientX: number, clientY: number) {
    const r = wrap!.getBoundingClientRect();
    // Keep the tip inside the map: clamp its centre 5rem from either edge.
    const x = Math.min(Math.max(clientX - r.left, 80), r.width - 80);
    tip = { iso: el.dataset.iso!, name: el.dataset.name!, x, y: clientY - r.top };
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
  {#if tip}
    {@const d = byIso.get(tip.iso)}
    <div class="map-tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px" class:below={tip.y < 64}>
      <strong>{tip.name}</strong>
      {#if d}<span>{d.text}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .world-map {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
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
  /* Themed like the insights mode tips (.mode-tip), not the browser's title tooltip. */
  .map-tip {
    position: absolute;
    translate: -50% calc(-100% - 0.5rem);
    display: grid;
    gap: 0.1rem;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    line-height: 1.3;
    white-space: nowrap;
    pointer-events: none;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }
  .map-tip.below {
    translate: -50% 0.75rem;
  }
  .map-tip span {
    color: var(--color-text-muted);
  }
</style>
