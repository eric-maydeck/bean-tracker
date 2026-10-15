<script lang="ts">
  import { deltaColor } from '$lib/components/deltaColor';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import { rove, takeFocus } from '$lib/components/Heatmap.svelte';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import type { MineralMap } from '$lib/server/insights/lab';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { sampleField } from '$lib/sample';
  import { noMatch, signed } from './DeltaBars.svelte';
  import { STRENGTH } from './Insights.svelte';

  // Recipe mineral map (round 2, W-map): a row per recipe (Ratings by recipe order), its same-bag delta on the
  // lab's fixed green/gray/red scale, then each mineral's amount shaded within its column (one neutral hue:
  // light = little, dark = most, 0 = blank). Thin rows: minerals faded, the delta chip striped (T3). A row's
  // name text (not its cell's empty space) is its tip target (brews, bags, strength); ↑/↓ move between rows.
  // The vs usual chip is sized to its value. Scrolls inside its card with the name column pinned.
  let { map }: { map: MineralMap } = $props();

  let shades = $derived(map.cols.map((_, j) => {
    const vs = map.rows.map((r) => r.values[j]).filter((v): v is number => v !== null);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    return (v: number | null) =>
      v === null || v === 0 ? 'transparent' : `color-mix(in oklab, var(--map-high) ${Math.round(8 + 37 * (hi > lo ? (v - lo) / (hi - lo) : 1))}%, transparent)`;
  }));
  const fmt = (v: number | null, unit: string) => (v === null ? '—' : unit ? `${+v.toFixed(1)}` : v.toFixed(2));
  const tipOf = (r: MineralMap['rows'][number]): Tip => ({
    title: r.label,
    rows: [...(r.sample.small ? [] : [['Brews', `${r.brews}`], ['Bags', `${r.bags}`]]),
      ['Strength', r.strength === 'solid' || r.strength === 'hint' ? STRENGTH[r.strength] : '—']] as [string, string][],
    ...sampleField(r.sample, r.delta !== null),
    note: r.delta === null ? noMatch('recipe') : undefined
  });

  let tip = $state<{ i: number; el: Element; hover: boolean } | null>(null);
  $effect(() => {
    void map;
    tip = null;
  });
  const show = (e: Event, hover = false) => {
    const el = (e.target as Element).closest<HTMLElement>('.map-name');
    tip = el ? { i: +el.dataset.i!, el, hover } : hover ? tip : null;
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<div class="table-scroll map-scroll" role="group" aria-label="Recipe mineral map"
  onpointermove={(e) => e.pointerType === 'mouse' && show(e, true)}
  onpointerleave={(e) => e.pointerType === 'mouse' && tip?.hover && (tip = null)}
  onclick={(e) => show(e)}
  onkeydown={(e) => (e.key === 'Escape' ? (tip = null) : rove(e, '.map-name'))}>
  <table class="mineral-map">
    <thead>
      <tr>
        <th scope="col" class="name-col">Recipe</th>
        <th scope="col">vs usual</th>
        {#each map.cols as c (c.key)}<th scope="col">{c.name}{#if c.unit}<small>{c.unit}</small>{/if}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each map.rows as r, i (i)}
        <tr class:small-sample={r.sample.small}>
          <th scope="row" class="name-col"><span class="map-name" role="button" tabindex={i ? -1 : 0} data-i={i} aria-label={tipText(tipOf(r))}
            onfocus={(e) => (takeFocus(e), show(e))} onblur={() => (tip = null)}>{r.label}</span>{#if r.sample.small}<span class="map-note"><SampleNote s={r.sample} paired={r.delta !== null} /></span>{/if}</th>
          <!-- The chip's fill carries the color (T3 scale, mixed so ink text keeps 4.5:1 in both themes). -->
          <td class="delta">{#if r.delta === null}<span class="none" title="No match">—</span><span class="sr-only">no match</span>{:else}<span class="delta-chip" class:small-sample-mark={r.sample.small}
            style:background-color={`color-mix(in oklab, ${deltaColor(r.delta)} 65%, transparent)`}>{signed(r.delta)}</span>{/if}</td>
          {#each map.cols as c, j (c.key)}<td style:background={shades[j](r.values[j])}>{fmt(r.values[j], c.unit)}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if tip && map.rows[tip.i]}
    <FloatTip anchor={tip.el}><TipBody tip={tipOf(map.rows[tip.i])} /></FloatTip>
  {/if}
</div>

<style>
  .mineral-map {
    width: 100%;
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 0.35rem 0.5rem;
    border-radius: 2px;
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
    vertical-align: bottom;
  }
  thead small {
    display: block;
    font-weight: 400;
  }
  /* The recipe column stays in view (opaque, edge-to-edge) while the minerals scroll behind it. */
  .name-col {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 8rem;
    max-width: 14rem;
    text-align: left;
    white-space: normal;
    background: var(--color-surface);
    box-shadow: 2px 0 0 var(--color-surface); /* covers the cell gap, so no cell shows beside or under the name */
  }
  .map-name {
    font-weight: 500;
    cursor: pointer;
    border-radius: 2px;
  }
  /* The Low confidence chip sits under a small row's name (the column is 8-14rem wide). */
  .map-note {
    display: block;
    margin-top: 0.15rem;
  }
  .map-name:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  /* As narrow as its chip: the column hugs the value, never stretching the color far left. */
  .delta {
    width: 1%;
    font-weight: 600;
  }
  /* No match: a chip-sized muted dash (the row's tip says why), so the column always hugs a chip. */
  .none {
    color: var(--color-text-muted);
    font-weight: 400;
  }
  .delta-chip {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }
  .small-sample .delta {
    color: var(--color-text); /* the chip keeps its ink on its tint (ui-rules 29) */
  }
  @media (max-width: 640px) {
    tbody th,
    tbody td {
      height: 44px;
    }
    /* The name is the tap target: at least 44×44 (ui-rules 4), hugging the text otherwise. */
    .map-name {
      display: inline-flex;
      align-items: center;
      min-width: 44px;
      min-height: 44px;
    }
    tbody th {
      padding-block: 0;
    }
  }
</style>
