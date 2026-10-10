<script lang="ts">
  import { goto } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { formatGrams } from '$lib/grams';
  import {
    RANGES, RANGE_LABELS, compareOptions, insightsParams, withDefaults, type InsightsUrlState
  } from '$lib/insightsUrl';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let s = $derived(withDefaults(data.explicit));

  // The server computes every tile from the URL, so a toggle is a navigation.
  function choose(change: InsightsUrlState) {
    const next = { ...data.explicit, ...change };
    // A compare the new range doesn't offer would be dropped by the parser;
    // keep the nearest shallower one it does offer instead.
    if (change.range && next.compare) {
      const c = next.compare;
      const ns = compareOptions(change.range, data.years, data.brewYears).map((o) => o.n);
      if (!ns.includes(c)) next.compare = Math.max(0, ...ns.filter((n) => n < c)) || undefined;
    }
    const qs = insightsParams(next).toString();
    goto(qs ? `?${qs}` : location.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  }

  const ROLLING = RANGES.filter((r) => r !== 'ytd' && r !== 'all');
  const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const count = (n: number) => Math.round(n).toLocaleString('en-US');
  const mss = (sec: number) => {
    const r = Math.round(sec);
    return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
  };
  const day = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const span = (p: { start: string | null; end: string }) => (p.start ? `${day(p.start)} – ${day(p.end)}` : 'All time');

  type Key = keyof PageData['tiles'];
  // `fmt` formats a value and its change; `suffix` is a unit set small after
  // the value where the full word wouldn't fit the tile ("12 days").
  type Tile = { key: Key; label: string; fmt: (n: number) => string; suffix?: string; ratingSwitch?: boolean };
  const TOTALS: Tile[] = [
    { key: 'brews', label: 'Brews', fmt: count },
    { key: 'grams', label: 'Grams', fmt: formatGrams },
    { key: 'spend', label: 'Spend', fmt: usdCompact.format },
    { key: 'bagsFinished', label: 'Bags finished', fmt: count },
    { key: 'rated', label: 'Rated', fmt: count }
  ];
  const AVERAGES: Tile[] = [
    { key: 'avgRating', label: 'Avg rating', fmt: (n) => n.toFixed(1), ratingSwitch: true },
    { key: 'costPerBrew', label: 'Cost per brew', fmt: usd.format },
    { key: 'brewsPerDay', label: 'Brews per day', fmt: (n) => n.toFixed(1) },
    { key: 'avgDose', label: 'Avg dose', fmt: (n) => `${n.toFixed(1)}g` },
    { key: 'avgRestDays', label: 'Avg rest', fmt: (n) => `${+n.toFixed(1)}`, suffix: 'days' },
    { key: 'avgBrewTime', label: 'Avg brew time', fmt: mss }
  ];
  const valueText = (t: Tile, v: number | null) =>
    v === null ? '—' : t.key === 'avgRestDays' ? String(Math.round(v)) : t.fmt(v);

  function deltaText(d: { abs: number; pct: number }, t: Tile): string {
    if (d.abs === 0) return 'No change';
    const abs = t.fmt(Math.abs(d.abs)) + (t.suffix ? ` ${t.suffix}` : '');
    return `${d.abs > 0 ? '▲' : '▼'} ${abs} (${Math.abs(d.pct).toFixed(0)}%)`;
  }
  let periodText = $derived(
    [span(data.period), data.previousPeriod && `vs ${span(data.previousPeriod)}`, 'Mountain Time'].filter(Boolean).join(' · ')
  );
  let earlier = $derived(/^\d{4}$|^ytd$/.test(s.range) ? 'Earlier years' : 'Earlier periods');
</script>

<svelte:head>
  <title>Bean Tracker - Insights</title>
</svelte:head>

<div class="toolbar">
  <h1>Insights</h1>
  <ShareButton />
</div>

<div class="insights-controls">
  <label class="form-field">
    <span>Period</span>
    <select value={s.range} onchange={(e) => choose({ range: e.currentTarget.value })}>
      <optgroup label="Rolling">
        {#each ROLLING as r (r)}<option value={r}>{RANGE_LABELS[r]}</option>{/each}
      </optgroup>
      <optgroup label="Calendar">
        <option value="ytd">{RANGE_LABELS.ytd}</option>
        {#each [...data.years].reverse() as y (y)}<option value={String(y)}>{y}</option>{/each}
      </optgroup>
      <optgroup label="Everything">
        <option value="all">{RANGE_LABELS.all}</option>
      </optgroup>
    </select>
  </label>
  <label class="form-field">
    <span>Compare</span>
    <select
      value={String(s.compare)}
      disabled={!data.compareOptions.length}
      onchange={(e) => choose({ compare: Number(e.currentTarget.value) })}
    >
      <option value="0">Off</option>
      {#if data.compareOptions.length}
        <optgroup label={earlier}>
          {#each data.compareOptions as o (o.n)}<option value={String(o.n)}>{o.label}</option>{/each}
        </optgroup>
      {/if}
    </select>
  </label>
</div>

<p class="insights-period">{periodText}</p>

{#snippet panel(title: string, tiles: Tile[])}
  <section class="chart-panel">
    <h2>{title}</h2>
    <div class="stat-row">
      {#each tiles as t (t.key)}
        {@const d = data.deltas?.[t.key]}
        <div class="stat-item">
          {#if t.ratingSwitch}
            <div class="tab-group tab-group-compact rating-switch" role="group" aria-label="Ratings">
              <button aria-pressed={s.ratings === 'settled'} onclick={() => choose({ ratings: 'settled' })}><span>Settled</span></button>
              <button aria-pressed={s.ratings === 'all'} onclick={() => choose({ ratings: 'all' })}><span>All</span></button>
            </div>
          {/if}
          <span class="stat-value"
            >{valueText(t, data.tiles[t.key])}{#if t.suffix && data.tiles[t.key] !== null}<small>{` ${t.suffix}`}</small>{/if}</span
          >
          {#if d}<span class="stat-unit insights-delta">{deltaText(d, t)}</span>{/if}
          <div class="stat-caption">
            <span class="stat-label">{t.key === 'rated' ? `Rated · ${s.ratings}` : t.label}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{@render panel('Totals', TOTALS)}
{@render panel('Averages', AVERAGES)}

<style>
  /* Two labelled selects, left-packed. */
  .insights-controls {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .insights-controls .form-field {
    margin-bottom: 0;
  }
  .insights-controls select {
    min-height: 2.25rem;
    padding: 0 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
  }
  @media (max-width: 640px) {
    .insights-controls {
      grid-template-columns: 1fr 1fr;
    }
    .insights-controls select {
      min-height: 44px;
      font-size: 16px;
    }
  }
  /* "Previous 12 months" doesn't fit half of a 360px row. */
  @media (max-width: 420px) {
    .insights-controls {
      grid-template-columns: 1fr;
    }
  }

  /* Settled/All on the Avg rating tile, in the free band above the value.
     The pill is cqw-sized like the rest of the tile; the button around it is
     the tap target (44px on phones via app.css) and stays transparent, so on
     a small tile it reaches over the value's top edge without hiding it. */
  .rating-switch {
    position: absolute;
    top: 3cqw;
    left: 0;
    right: 0;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 0;
    z-index: 1;
  }
  .rating-switch button,
  .rating-switch button[aria-pressed='true'] {
    align-items: flex-start;
    padding: 0;
    background: none;
    border: 0;
    color: var(--color-text);
  }
  @media (max-width: 640px) {
    .rating-switch button {
      min-width: 44px;
    }
  }
  .rating-switch span {
    display: block;
    padding: 1.5cqw 4cqw;
    font-size: max(0.7rem, 6.2cqw);
    line-height: 1.2;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .rating-switch button:first-child span {
    border-radius: var(--radius) 0 0 var(--radius);
  }
  .rating-switch button:last-child span {
    border-left: 0;
    border-radius: 0 var(--radius) var(--radius) 0;
  }
  .rating-switch button[aria-pressed='true'] span {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-color: var(--color-accent);
  }
  @media (hover: hover) {
    .rating-switch button:not([aria-pressed='true']):hover {
      background: none;
    }
    .rating-switch button:not([aria-pressed='true']):hover span {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      border-color: var(--color-accent);
    }
  }
  .rating-switch button:focus-visible {
    outline: none;
  }
  .rating-switch button:focus-visible span {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .stat-value small {
    font-size: 0.4em;
    font-weight: 600;
  }
  /* .stat-unit upper-cases; "120G" misreads as a unit. */
  .insights-delta {
    text-transform: none;
  }
  .insights-period {
    color: var(--color-text-muted);
    margin: 0 0 var(--space-3);
  }
</style>
