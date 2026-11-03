<script lang="ts">
  import type { Viz } from '$lib/server/recaps/types';
  import CoffeeName from '$lib/components/CoffeeName.svelte';

  // The six Viz kinds as the mockup's inline SVG/HTML. Mark tips are SVG <title>s (server-built strings;
  // the site's FloatTip needs a pointer-anchored client component, which a static recap mark doesn't warrant).
  let { viz }: { viz: Viz } = $props();

  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  // SVG text can't wrap: up to two lines of n characters, broken at a space, the second cut only if it still overflows.
  const wrap = (s: string, n: number): string[] => {
    if (s.length <= n) return [s];
    const at = s.lastIndexOf(' ', n);
    return at < 1 ? [cut(s, n)] : [s.slice(0, at), cut(s.slice(at + 1), n)];
  };

  // bars
  const BW = 300, BH = 90;
  const bars = $derived.by(() => {
    if (viz.kind !== 'bars') return null;
    const n = viz.values.length, gap = n > 15 ? 3 : 6, bw = (BW - gap * (n - 1)) / n, max = Math.max(...viz.values, 1);
    return { bw, marks: viz.values.map((v, i) => {
      const bh = Math.max(2, (v / max) * (BH - 18));
      return { x: i * (bw + gap), bh, tip: viz.tips[i] ?? '' };
    }) };
  });

  // spark
  const SW = 300, SH = 70, SP = 8;
  const spark = $derived.by(() => {
    if (viz.kind !== 'spark') return null;
    const { values: v } = viz, min = Math.min(...v), max = Math.max(...v);
    return v.map((x, i): [number, number] => [SP + (i * (SW - 2 * SP)) / Math.max(1, v.length - 1), SP + 6 + (1 - (x - min) / (max - min || 1)) * (SH - 2 * SP - 6)]);
  });

  // hlist
  const hl = $derived(viz.kind === 'hlist' ? { max: Math.max(...viz.rows.map((r) => r.value), 1), cols: viz.rows[0]?.texts.length ?? 1 } : null);

  // calendar: Mon-start weeks; month labels where a month starts, at least 8 weeks apart
  const CS = 9, DAY = 864e5;
  const cal = $derived.by(() => {
    if (viz.kind !== 'calendar') return null;
    const t0 = Date.parse(viz.start + 'T00:00:00Z');
    const weeks = Math.ceil(viz.days.length / 7);
    const fmt = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const cells = viz.days.flatMap((d, i) => d === 'none' ? [] : [{ d, x: Math.floor(i / 7) * CS, y: (i % 7) * CS, tip: fmt(t0 + i * DAY) + (d === 'miss' ? ': no brew' : '') }]);
    const months: { x: number; m: string }[] = [];
    let last = -99, prev = new Date(t0).getUTCMonth();
    for (let w = 1; w < weeks; w++) {
      const dt = new Date(t0 + w * 7 * DAY), m = dt.getUTCMonth();
      if (m !== prev) { prev = m; if (w - last >= 8) { last = w; months.push({ x: w * CS, m: dt.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) }); } }
    }
    return { w: weeks * CS, cells, months };
  });

  // dots
  const dots = $derived.by(() => {
    if (viz.kind !== 'dots') return null;
    const stack = !!viz.stack, lx = stack ? 8 : 104, n = stack ? 46 : 17, thin = stack ? 0 : 20, best = Math.max(...viz.rows.map((r) => r.value));
    const lines = viz.rows.map((r) => wrap(r.label, n)), extra = lines.some((l) => l.length > 1) ? (stack ? 11 : 6) : 0;
    const rowH = (stack ? 36 : 22) + extra, top = (stack ? 26 : 12) + extra;
    const x = (v: number) => lx + ((v - viz.lo) / (viz.hi - viz.lo)) * (300 - 46 - lx);
    return { stack, lx, h: viz.rows.length * rowH + (stack ? 6 : 16), rows: viz.rows.map((r, i) => {
      const y = i * rowH + top;
      return { ...r, y, cx: x(r.value), best: r.value === best, thin: r.brews < thin, lines: lines[i], tip: `${r.label}: ${r.value.toFixed(2)} avg over ${r.brews} brews` };
    }) };
  });
</script>

{#if viz.kind === 'bars' && bars}
  <svg class="viz bars" viewBox="0 -4 {BW} {BH + 22}" role="img">
    {#each bars.marks as m, i (i)}
      <g class:hi={i === viz.hi}>
        <title>{m.tip}</title>
        <rect x={m.x} y={BH - m.bh} width={bars.bw} height={m.bh} rx={Math.min(4, bars.bw / 2)} />
        {#if i === viz.hi}<text x={m.x + bars.bw / 2} y={BH - m.bh - 5} text-anchor="middle">{viz.hiText}</text>{/if}
      </g>
    {/each}
    {#each viz.labels as l, i (i)}
      {#if l}
        <text class="ax" y={BH + 14} x={i * (bars.bw + (viz.values.length > 15 ? 3 : 6)) + (i === 0 ? 0 : i === viz.values.length - 1 ? bars.bw : bars.bw / 2)}
          text-anchor={i === 0 ? 'start' : i === viz.values.length - 1 ? 'end' : 'middle'}>{l}</text>
      {/if}
    {/each}
  </svg>
{:else if viz.kind === 'spark' && spark}
  <svg class="viz spark" viewBox="0 -12 {SW} {SH + 30}" role="img">
    <polyline points={spark.map((p) => p.join(',')).join(' ')} />
    {#each spark as [cx, cy], i (i)}
      <circle {cx} {cy} r={i === 0 || i === spark.length - 1 ? 5 : 3}><title>{viz.labels[i]}: {viz.texts[i]}</title></circle>
    {/each}
    <text x={spark[0][0]} y={spark[0][1] - 10} text-anchor="start">{viz.texts[0]}</text>
    {#if spark.length > 1}<text x={spark.at(-1)![0]} y={spark.at(-1)![1] - 10} text-anchor="end">{viz.texts.at(-1)}</text>{/if}
    <text class="ax" x={SP} y={SH + 14}>{viz.labels[0]}</text>
    {#if spark.length > 1}<text class="ax" x={SW - SP} y={SH + 14} text-anchor="end">{viz.labels.at(-1)}</text>{/if}
  </svg>
{:else if viz.kind === 'hlist' && hl}
  <ol class="viz hlist" class:multi={hl.cols > 1} style:--vcols={hl.cols}>
    {#each viz.rows as r, i (i)}
      <li class:hi={i === 0}>
        <span class="k"><CoffeeName text={r.label} /></span>
        <span class="track"><span class="fill" style:width="{(r.value / hl.max) * 100}%"></span></span>
        {#each r.texts as t, j (j)}<span class="v">{t}</span>{/each}
      </li>
    {/each}
  </ol>
{:else if viz.kind === 'split'}
  <div class="viz split">
    {#each viz.periods as p (p.name)}
      <div class="srow">
        <span class="sname">{p.name}</span>
        <div class="sbar">
          {#each p.segs as s (s.label)}
            {@const k = viz.keys.indexOf(s.label)}
            <span class="seg {k >= 0 && k < 3 ? 'abc'[k] : ''}" style:flex={s.pct}>{#if s.pct >= 26}<b>{s.label}</b>&nbsp;{/if}{#if s.pct >= 10}{s.pct}%{/if}</span>
          {/each}
        </div>
      </div>
    {/each}
    <p class="legend">
      {#each viz.keys.slice(0, 3) as k, i (k)}<span><i class="seg {'abc'[i]}"></i>{k}</span>{/each}<span><i class="seg"></i>Other</span>
    </p>
  </div>
{:else if viz.kind === 'calendar' && cal}
  <svg class="viz cal" viewBox="0 0 {cal.w} {7 * CS + 14}" role="img">
    {#each cal.cells as c, i (i)}
      <rect class={c.d === 'miss' ? 'miss' : c.d} x={c.x} y={c.y} width={CS - 2} height={CS - 2} rx="1.5"><title>{c.tip}</title></rect>
    {/each}
    {#each cal.months as m (m.x)}<text class="ax" x={m.x} y={7 * CS + 12}>{m.m}</text>{/each}
  </svg>
  <p class="legend key"><span><i class="key streak"></i>Streak</span><span><i class="key on"></i>Brewed</span><span><i class="key miss"></i>No brew</span></p>
{:else if viz.kind === 'dots' && dots}
  <svg class="viz dots" viewBox="0 0 300 {dots.h}" role="img">
    {#each dots.rows as r, i (i)}
      <g class:hi={r.best} class:thin={r.thin}>
        <title>{r.tip}</title>
        {#each r.lines as ln, k (k)}
          <text class="ax" x="0" y={(dots.stack ? r.y - 12 : r.y + 4 - (r.lines.length - 1) * 5.5) + (k - (r.lines.length - 1) * (dots.stack ? 1 : 0)) * 11}>{ln}</text>
        {/each}
        <line x1={dots.lx} x2="262" y1={r.y} y2={r.y} />
        <circle cx={r.cx} cy={r.y} r={r.best ? 7 : 5} />
        <text x="300" y={r.y + 4} text-anchor="end">{r.value.toFixed(2)}</text>
      </g>
    {/each}
  </svg>
{/if}

<style>
  .viz { display: block; width: 100%; height: auto; }
  .viz text { fill: var(--fg); font: 600 11px var(--font-sans); }
  .viz .ax { opacity: 0.75; font-weight: 500; }
  .bars rect { fill: var(--fg); opacity: 0.35; }
  .bars .hi rect { opacity: 1; }
  .spark polyline { fill: none; stroke: var(--fg); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
  .spark circle { fill: var(--fg); stroke: var(--bg); stroke-width: 2; }
  .cal rect.on { fill: var(--fg); opacity: 0.4; }
  .cal rect.streak { fill: var(--fg); }
  .cal rect.miss { fill: none; stroke: var(--fg); stroke-width: 1; opacity: 0.45; }
  .dots line { stroke: var(--fg); opacity: 0.3; stroke-width: 1; }
  .dots circle { fill: var(--fg); opacity: 0.55; }
  .dots .hi circle { opacity: 1; }
  .dots .thin circle { fill: none; stroke: var(--fg); stroke-width: 1.5; }
  /* One grid for every row, so the bars line up whatever the value text's width. */
  .hlist { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: minmax(3.5em, 8.5em) minmax(1em, 1fr) repeat(var(--vcols, 1), auto); gap: 6px 10px; align-items: center; font-size: 0.9rem; }
  .hlist li { display: contents; }
  .hlist .k { line-height: 1.2; overflow-wrap: anywhere; }
  .hlist .v { white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .hlist .track { height: 10px; }
  .hlist .fill { display: block; height: 100%; min-width: 3px; border-radius: 0 4px 4px 0; background: var(--fg); opacity: 0.35; }
  .hlist .hi .fill { opacity: 1; }
  .hlist .hi .k { font-weight: 700; }
  .split { container-type: inline-size; display: grid; gap: 10px; font-size: 0.82rem; }
  .srow { display: grid; grid-template-columns: 4.6em minmax(0, 1fr); gap: 10px; align-items: center; }
  .sbar { display: flex; gap: 2px; height: 34px; }
  .seg { min-width: 0; display: flex; align-items: center; padding: 0 6px; white-space: nowrap; overflow: hidden; background: color-mix(in srgb, var(--fg) 22%, transparent); }
  .seg:first-child { border-radius: 4px 0 0 4px; }
  .seg:last-child { border-radius: 0 4px 4px 0; }
  .seg.a { background: var(--fg); color: var(--bg); }
  .seg.b { background: var(--t-sun); color: #2b211b; }
  .seg.c { background: #92dba9; color: #2b211b; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; font-size: 0.8rem; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend.key { margin-top: 6px; }
  .legend i.key { width: 10px; height: 10px; border-radius: 2px; background: var(--fg); }
  .legend i.key.on { opacity: 0.4; }
  .legend i.key.miss { background: none; border: 1px solid var(--fg); opacity: 0.6; box-sizing: border-box; }
  .legend i.seg { width: 12px; height: 12px; padding: 0; border-radius: 3px; }
  @container (max-width: 360px) { .seg b { display: none; } }
  /* Narrow homes (tiles, 360 phones): a multi-value list puts its bar on its own line under the label and values. */
  @container (max-width: 340px) {
    .hlist.multi { grid-template-columns: 1fr repeat(var(--vcols), auto); grid-auto-flow: dense; row-gap: 2px; }
    .hlist.multi .track { grid-column: 1 / -1; height: 8px; margin-bottom: 6px; }
  }
</style>
