<script lang="ts">
  import type { SpeedPlot } from '$lib/server/insights/lab';

  // Rating by grind speed: one column per speed band, a dot per brew (spread sideways by a fixed rule, so it never
  // moves between renders), a smooth line through each band's value as a rating, a dashed line for the overall average.
  // Thin bands (not solid) draw pale. Plain SVG; the table below carries the numbers.
  let { m }: { m: SpeedPlot } = $props();

  let width = $state(0);
  const H = $derived(width && width < 520 ? 240 : 280);
  const L = 36, R = 12, T = 10, B = 40;
  const n = $derived(m.cols.length);
  const colW = $derived(Math.max(0, width - L - R) / Math.max(1, n));
  const lo = $derived(Math.max(0, Math.floor(Math.min(...m.cols.flatMap((c) => c.ratings), ...m.cols.map((c) => c.y)) - 0.5)));
  const hi = $derived(Math.min(10, Math.ceil(Math.max(...m.cols.flatMap((c) => c.ratings), ...m.cols.map((c) => c.y)) + 0.5)));
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
  const desc = $derived(`Rating by grind speed: ${m.cols.map((c) => `${c.label} ${c.y.toFixed(1)}`).join(', ')}; overall average ${m.avg.toFixed(1)}`);
</script>

<div class="speed-chart" bind:clientWidth={width}>
  {#if width}
    <svg class="plot" {width} height={H} role="img" aria-label={desc}>
      {#each yTicks as v (v)}
        <line class="grid" x1={L} x2={width - R} y1={y(v)} y2={y(v)} />
        <text class="tick" x={L - 8} y={y(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
      {/each}
      <line class="axis" x1={L} x2={width - R} y1={H - B} y2={H - B} />
      {#each m.cols as c, i (c.label)}
        <text class="tick" x={x(i)} y={H - B + 16} text-anchor="middle">{tick(c.label)}</text>
        {#each c.ratings as r, k (k)}
          <circle class="dot" class:thin={!c.solid} cx={x(i) + jitter(k)} cy={y(r)} r="3.5" />
        {/each}
      {/each}
      {#if short}<text class="tick" x={(L + width - R) / 2} y={H - 6} text-anchor="middle">RPM</text>{/if}
      <line class="avg" x1={L} x2={width - R} y1={y(m.avg)} y2={y(m.avg)} />
      {#if curve}<path class="trend" d={curve} />{/if}
      {#each m.cols as c, i (c.label)}
        <circle class="mark" class:thin={!c.solid} cx={x(i)} cy={y(c.y)} r="5" />
      {/each}
    </svg>
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
