<script lang="ts">
  import type { SpeedPlot } from '$lib/server/insights/lab';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody, { type Tip } from '$lib/components/TipBody.svelte';
  import { labDelta } from '$lib/components/deltaColor';
  import { formatDate } from '$lib/formatDate';
  import { sampleField } from '$lib/sample';

  // Rating by grind speed: one column per speed band, a dot per brew (spread sideways by a fixed rule, so it never
  // moves between renders), a smooth line through each band's value as a rating, a dashed line for the overall average.
  // Thin bands (not solid) draw pale. Plain SVG; the table below carries the numbers. Tips (FloatTip, as ValueMap): the dot or
  // band marker nearest the pointer within NEAR px (markers win near-ties), on hover; a tap or click pins it, Escape or a
  // click elsewhere closes it; the keyboard walks the band markers with the arrows.
  let { m }: { m: SpeedPlot } = $props();

  let width = $state(0);
  const H = $derived(width && width < 520 ? 240 : 280);
  const L = 36, R = 12, T = 10, B = 40;
  const n = $derived(m.cols.length);
  const colW = $derived(Math.max(0, width - L - R) / Math.max(1, n));
  const lo = $derived(Math.max(0, Math.floor(Math.min(...m.cols.flatMap((c) => c.dots.map((d) => d.y)), ...m.cols.map((c) => c.y)) - 0.5)));
  const hi = $derived(Math.min(10, Math.ceil(Math.max(...m.cols.flatMap((c) => c.dots.map((d) => d.y)), ...m.cols.map((c) => c.y)) + 0.5)));
  const yTicks = $derived(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((v) => (hi - lo <= 6 ? true : v % 2 === 0)));
  const x = (i: number) => L + colW * (i + 0.5);
  const y = (v: number) => T + ((hi - v) / Math.max(1, hi - lo)) * (H - T - B);
  // Golden-ratio steps: an even, repeatable spread inside the column (the k-th dot of a band always lands in the same place).
  const jitter = (k: number) => (((k * 0.618034) % 1) - 0.5) * Math.min(colW * 0.7, 64);
  const short = $derived(colW < 72);
  const tick = (label: string) => (short ? label.replace(/^~| RPM$/g, '') : label);
  // Smooth through the band values: cubic segments whose control points follow the neighbours' slope, kept inside each segment's y range (no overshoot).
  const curve = $derived.by(() => {
    const p = m.cols.map((c, i) => [x(i), y(c.y)]);
    if (p.length < 2) return '';
    let d = `M${p[0][0]} ${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i], [x1, y1] = p[i + 1], k = (x1 - x0) / 3;
      const s = (j: number) => (p[j - 1] && p[j + 1] ? (p[j + 1][1] - p[j - 1][1]) / (p[j + 1][0] - p[j - 1][0]) : (y1 - y0) / (x1 - x0));
      const c = (v: number, lim0: number, lim1: number) => Math.min(Math.max(v, Math.min(lim0, lim1)), Math.max(lim0, lim1));
      d += `C${x0 + k} ${c(y0 + s(i) * k, y0, y1)} ${x1 - k} ${c(y1 - s(i + 1) * k, y0, y1)} ${x1} ${y1}`;
    }
    return d;
  });
  const NEAR = 28, MARK_BIAS = 8; // a band marker beats a dot that is no more than this much nearer
  type Hit = { i: number; k: number | null }; // k null = the band's marker
  const at = (h: Hit) => (h.k === null ? { x: x(h.i), y: y(m.cols[h.i].y) } : { x: x(h.i) + jitter(h.k), y: y(m.cols[h.i].dots[h.k].y) });
  function nearest(px: number, py: number): Hit | null {
    let best: Hit | null = null, d = NEAR;
    m.cols.forEach((c, i) => {
      const q = at({ i, k: null }), mk = Math.hypot(q.x - px, q.y - py) - MARK_BIAS;
      if (mk < d) (best = { i, k: null }, (d = mk));
      c.dots.forEach((_, k) => {
        const p = at({ i, k }), dd = Math.hypot(p.x - px, p.y - py);
        if (dd < d) (best = { i, k }, (d = dd));
      });
    });
    return best;
  }
  const tipOf = (h: Hit): Tip => {
    const c = m.cols[h.i];
    if (h.k === null)
      return { title: c.label, rows: [['Value as a rating', c.y.toFixed(2)], ['vs grinder average', labDelta(c.value, [0.01])], ['Brews', String(c.brews)], ['Bags', String(c.bags)]], ...sampleField(c.sample) };
    const d = c.dots[h.k];
    return { title: c.label, rows: [['Rating', d.y.toFixed(1)], ...(d.coffee ? [['Coffee', d.coffee] as [string, string]] : []), ['Date', formatDate(d.date)]] };
  };
  let svg: SVGSVGElement | undefined = $state(), anchor: SVGCircleElement | undefined = $state();
  let tip = $state<{ h: Hit; pinned: boolean; reveal?: boolean } | null>(null);
  const hitAt = (e: PointerEvent | MouseEvent) => {
    const r = svg!.getBoundingClientRect();
    return nearest(e.clientX - r.left, e.clientY - r.top);
  };
  const same = (a: Hit, b: Hit) => a.i === b.i && a.k === b.k;
  const hover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || tip?.pinned) return;
    const h = hitAt(e);
    tip = h ? { h, pinned: false } : null;
  };
  function click(e: MouseEvent) {
    const h = hitAt(e);
    tip = !h || (tip?.pinned && same(tip.h, h)) ? null : { h, pinned: true, reveal: !tip || !same(tip.h, h) };
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') return void (tip = null);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = Math.min(n - 1, Math.max(0, (tip?.h.i ?? (d > 0 ? -1 : n)) + d));
    tip = { h: { i, k: null }, pinned: false, reveal: true };
  }
  // The template reads `shown`, never `tip`: new data renders before the effect below clears a tip, so stale indices drop out here.
  const shown = $derived(tip && m.cols[tip.h.i] && (tip.h.k === null || m.cols[tip.h.i].dots[tip.h.k]) ? tip : null);
  // The moved data (a Period or Group-by change) invalidates an open tip.
  $effect(() => {
    void m;
    tip = null;
  });
  const desc = $derived(`Rating by grind speed: ${m.cols.map((c) => `${c.label} ${c.y.toFixed(1)}`).join(', ')}; overall average ${m.avg.toFixed(1)}`);
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.speed-chart svg.plot') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && tip?.pinned && (tip = null)} />

<div class="speed-chart" bind:clientWidth={width}>
  {#if width}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex (one tab stop; arrows walk the band markers) -->
    <svg class="plot" {width} height={H} role="group" aria-label={desc} tabindex="0" bind:this={svg}
      onpointermove={hover} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && (tip = null)} onclick={click}
      onkeydown={key} onblur={() => !tip?.pinned && (tip = null)}>
      {#each yTicks as v (v)}
        <line class="grid" x1={L} x2={width - R} y1={y(v)} y2={y(v)} />
        <text class="tick" x={L - 8} y={y(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
      {/each}
      <line class="axis" x1={L} x2={width - R} y1={H - B} y2={H - B} />
      {#each m.cols as c, i (c.label)}
        <text class="tick" x={x(i)} y={H - B + 16} text-anchor="middle">{tick(c.label)}</text>
        {#each c.dots as d, k (k)}
          <circle class="dot" class:thin={!c.solid} cx={x(i) + jitter(k)} cy={y(d.y)} r="3.5" />
        {/each}
      {/each}
      {#if short}<text class="tick" x={(L + width - R) / 2} y={H - 6} text-anchor="middle">RPM</text>{/if}
      <line class="avg" x1={L} x2={width - R} y1={y(m.avg)} y2={y(m.avg)} />
      {#if curve}<path class="trend" d={curve} />{/if}
      {#each m.cols as c, i (c.label)}
        <circle class="mark" class:thin={!c.solid} cx={x(i)} cy={y(c.y)} r="5" />
      {/each}
      {#if shown}<circle class="ring" bind:this={anchor} cx={at(shown.h).x} cy={at(shown.h).y} r={shown.h.k === null ? 8 : 6} />{/if}
    </svg>
    {#if shown && anchor}
      {#key `${shown.h.i},${shown.h.k}`}<FloatTip {anchor} reveal={!!shown.reveal} onclose={() => (tip = null)}><TipBody tip={tipOf(shown.h)} /></FloatTip>{/key}
    {/if}
  {/if}
  <ul class="legend">
    <li><svg width="12" height="12" aria-hidden="true"><circle class="dot" cx="6" cy="6" r="3.5" /></svg>Brew</li>
    <li><svg width="22" height="12" aria-hidden="true"><path class="trend" d="M1 6H21" /><circle class="mark" cx="11" cy="6" r="4" /></svg>Speed's value</li>
    <li><svg width="22" height="12" aria-hidden="true"><path class="avg" d="M1 6H21" /></svg>Average rating</li>
  </ul>
</div>

<style>
  .speed-chart {
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
  .tick {
    font-size: 0.72rem;
    fill: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .avg {
    stroke: var(--color-text-muted);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    fill: none;
  }
  .dot {
    fill: var(--chart-color-1);
    fill-opacity: 0.35;
  }
  .dot.thin {
    fill-opacity: 0.15;
  }
  .trend {
    fill: none;
    stroke: var(--chart-color-1);
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .mark {
    fill: var(--chart-color-1);
    stroke: var(--color-surface);
    stroke-width: 2;
  }
  .mark.thin {
    fill-opacity: 0.4;
    stroke: var(--chart-color-1);
    stroke-width: 1.5;
  }
  .plot {
    touch-action: manipulation;
  }
  .plot:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .ring {
    fill: none;
    stroke: var(--color-text);
    stroke-width: 1.5;
    pointer-events: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.1rem 0.9rem;
    margin: var(--space-2) 0 var(--space-3);
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
  .legend .trend {
    stroke-width: 2.5;
  }
</style>
