<script lang="ts">
  import { goto } from '$app/navigation';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { formatGrams } from '$lib/grams';
  import {
    RANGES, RANGE_LABELS, customRange, insightsParams, isCustom, keepCompare, withDefaults, type InsightsUrlState
  } from '$lib/insightsUrl';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let s = $derived(withDefaults(data.explicit));

  // The Custom range dialog; its draft is `draft` below.
  let rangeDialog: HTMLDialogElement | undefined = $state();

  // The server computes every tile from the URL, so a toggle is a navigation.
  function choose(change: InsightsUrlState) {
    const next = { ...data.explicit, ...change };
    // A compare the new range doesn't offer would be dropped by the parser.
    if (change.range) next.compare = keepCompare(next.compare, data.compareMenus[change.range].flatMap((g) => g.options.map((o) => o.value)));
    const qs = insightsParams(next).toString();
    goto(qs ? `?${qs}` : location.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Custom range draft: the From/To being edited, not yet applied. Never in the URL
  // (like inline edit). null = no draft; the form then shows the applied range, if any.
  let draft = $state<{ from: string; to: string } | null>(null);
  let shown = $derived.by(() => {
    if (draft) return draft;
    if (!isCustom(s.compare)) return null;
    const [from, to] = s.compare.split('..');
    return { from, to };
  });

  // Custom range… opens a draft on the prefill; anything else drops the draft and applies.
  function pickCompare(v: string) {
    if (v === 'custom') {
      draft = { from: data.customDefault.start ?? data.today, to: data.customDefault.end };
      rangeDialog?.showModal();
      return;
    }
    draft = null;
    choose({ compare: /^\d+$/.test(v) ? Number(v) : v });
  }

  function editDraft(e: Event) {
    const f = new FormData(e.currentTarget as HTMLFormElement);
    draft = { from: String(f.get('from')), to: String(f.get('to')) };
  }

  // Apply (click, or Enter in a date input): the only way a drafted range reaches the URL.
  function applyCustom(e: SubmitEvent) {
    e.preventDefault();
    const c = shown && customRange(shown.from, shown.to, data.today);
    if (!c) return;
    draft = null;
    choose({ compare: c });
    rangeDialog?.close();
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
  // `up`: whether a rise is good or bad, for the delta's colour; unset = neutral (grey).
  type Tile = { key: Key; label: string; fmt: (n: number) => string; suffix?: string; ratingSwitch?: boolean; up?: 'good' | 'bad' };
  const TOTALS: Tile[] = [
    { key: 'brews', label: 'Brews', fmt: count, up: 'good' },
    { key: 'grams', label: 'Grams', fmt: formatGrams },
    { key: 'spend', label: 'Spend', fmt: usdCompact.format, up: 'bad' },
    { key: 'bagsFinished', label: 'Bags finished', fmt: count, up: 'good' },
    { key: 'rated', label: 'Rated', fmt: count, ratingSwitch: true, up: 'good' }
  ];
  const AVERAGES: Tile[] = [
    { key: 'avgRating', label: 'Avg rating', fmt: (n) => n.toFixed(1), ratingSwitch: true, up: 'good' },
    { key: 'costPerBrew', label: 'Cost per brew', fmt: usd.format, up: 'bad' },
    { key: 'brewsPerDay', label: 'Brews per day', fmt: (n) => n.toFixed(1), up: 'good' },
    { key: 'avgDose', label: 'Avg dose', fmt: (n) => `${n.toFixed(1)}g` },
    { key: 'avgRestDays', label: 'Avg rest', fmt: (n) => String(Math.round(n)), suffix: 'days' },
    { key: 'avgBrewTime', label: 'Avg brew time', fmt: mss }
  ];
  // One explanation per ratings mode, shared by the switches (hover title,
  // aria-describedby) and the caption's tap-to-open popover.
  let RATINGS_HELP = $derived({
    current: `Rated brews since ${day(data.settledFrom)}, once the scale settled.`,
    all: 'Every rated brew, including earlier ones.'
  });
  // A popover sits in the top layer; put it under its caption button (above
  // when there's no room below). Its CSS clamps it inside the viewport.
  // ponytail: fixed position, so it stays put if the page scrolls while open.
  function placeTip(e: ToggleEvent) {
    if (e.newState !== 'open') return;
    const tip = e.currentTarget as HTMLElement;
    const r = document.querySelector(`[popovertarget="${tip.id}"]`)!.getBoundingClientRect();
    const below = r.bottom + 96 < innerHeight;
    tip.style.setProperty('--x', `${r.left + r.width / 2}px`);
    tip.style.setProperty('--y', `${below ? r.bottom : r.top}px`);
    tip.toggleAttribute('data-above', !below);
  }
  const valueText = (t: Tile, v: number | null) => (v === null ? '—' : t.fmt(v));

  // Paced totals are fractional: a count under 10 keeps one decimal, so a small
  // change doesn't read "0". Money and grams keep their own formats.
  const paced = (t: Tile) => (data.scaled && t.fmt === count ? (n: number) => (Math.abs(n) < 10 ? n.toFixed(1) : count(n)) : t.fmt);

  function deltaText(d: { abs: number; pct: number; base: number }, t: Tile): string {
    const fmt = paced(t);
    // A change that formats as zero (float noise, or under the tile's precision) is none.
    if (fmt(Math.abs(d.abs)) === fmt(0)) return 'No change';
    const abs = fmt(Math.abs(d.abs)) + (t.suffix ? ` ${t.suffix}` : '');
    return `${d.abs > 0 ? '▲' : '▼'} ${abs} (${Math.abs(d.pct).toFixed(0)}%)`;
  }
  // Totals compared across windows of different tracked lengths: what the other window would be at this pace.
  const paceText = (d: { base: number }, t: Tile) =>
    data.scaled && data.tileKinds[t.key] === 'total' ? `vs ${paced(t)(d.base)} at that pace` : '';
  // Green when the change is the good way for this tile, red when bad; grey for neutral tiles and no change.
  function trend(d: { abs: number }, t: Tile): string {
    const fmt = paced(t);
    if (!t.up || fmt(Math.abs(d.abs)) === fmt(0)) return '';
    return (d.abs > 0) === (t.up === 'good') ? 'trend-good' : 'trend-bad';
  }
  let periodText = $derived(
    [span(data.period), data.previousPeriod && `vs ${span(data.previousPeriod)}`, 'Mountain Time'].filter(Boolean).join(' · ')
  );
</script>

<svelte:head>
  <title>Bean Tracker - Insights</title>
</svelte:head>

<div class="toolbar">
  <h1>Insights</h1>
  <ShareButton />
</div>

<div class="insights-controls" class:three={isCustom(s.compare)}>
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
      value={shown ? 'custom' : String(s.compare)}
      onchange={(e) => pickCompare(e.currentTarget.value)}
    >
      <option value="0">Off</option>
      {#each data.compareMenus[s.range] as g (g.label)}
        <optgroup label={g.label}>
          {#each g.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </optgroup>
      {/each}
      <optgroup label="Custom"><option value="custom">Custom range…</option></optgroup>
    </select>
  </label>
  {#if isCustom(s.compare)}
    <button class="button button-ghost" onclick={() => rangeDialog?.showModal()}>Dates…</button>
  {/if}
</div>
  <!-- Focus lands on the dialog, never a date input (no-autofocus rule). -->
  <!-- svelte-ignore a11y_autofocus -->
  <dialog bind:this={rangeDialog} autofocus class="range-dialog" aria-labelledby="range-title" onclose={() => (draft = null)}>
    <h2 id="range-title">Custom range</h2>
    {#if shown}
      <form class="custom-range" oninput={editDraft} onsubmit={applyCustom}>
        <label class="form-field">
          <span>From</span>
          <input type="date" name="from" value={shown.from} min={data.dataStart} max={data.today} />
        </label>
        <label class="form-field">
          <span>To</span>
          <input type="date" name="to" value={shown.to} min={data.dataStart} max={data.today} />
        </label>
        <footer>
          <button type="button" class="button button-ghost" onclick={() => rangeDialog?.close()}>Cancel</button>
          <button class="button" disabled={!customRange(shown.from, shown.to, data.today)}>Apply</button>
        </footer>
      </form>
    {/if}
  </dialog>

<p class="insights-period">{periodText}</p>

{#snippet panel(title: string, tiles: Tile[])}
  <section class="chart-panel">
    <h2>{title}</h2>
    <div class="stat-row fit n{tiles.length} {data.deltas ? 'comparing' : ''}">
      {#each tiles as t (t.key)}
        {@const d = data.deltas?.[t.key]}
        <div class="stat-item">
          {#if t.ratingSwitch}
            <div class="tab-group tab-group-compact rating-switch" role="group" aria-label="Ratings">
              {#each ['current', 'all'] as const as m (m)}
                <button
                  aria-pressed={s.ratings === m}
                  title={RATINGS_HELP[m]}
                  aria-describedby="ratings-help-{m}"
                  onclick={() => choose({ ratings: m })}><span>{m === 'all' ? 'All' : 'Current'}</span></button
                >
              {/each}
            </div>
          {/if}
          <span class="stat-value"
            >{valueText(t, data.tiles[t.key])}{#if t.suffix && data.tiles[t.key] !== null}<small>{` ${t.suffix}`}</small>{/if}</span
          >
          {#if d}
            <span class="stat-unit insights-delta {trend(d, t)}">{deltaText(d, t)}</span>
            {#if paceText(d, t)}<span class="insights-pace">{paceText(d, t)}</span>{/if}
          {/if}
          <div class="stat-caption">
            {#if t.ratingSwitch}
              <span class="stat-label mode-caption"
                >{t.label} · <button class="mode-tip-button" popovertarget="tip-{t.key}" aria-describedby="tip-{t.key}"
                  >{s.ratings === 'all' ? 'All' : 'Current'}</button
                ></span
              >
            {:else}
              <span class="stat-label">{t.label}</span>
            {/if}
          </div>
          {#if t.ratingSwitch}
            <div class="mode-tip" id="tip-{t.key}" popover onbeforetoggle={placeTip}>{RATINGS_HELP[s.ratings]}</div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{@render panel('Totals', TOTALS)}
<span id="ratings-help-current" hidden>{RATINGS_HELP.current}</span>
<span id="ratings-help-all" hidden>{RATINGS_HELP.all}</span>
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
  .insights-controls select,
  .custom-range input {
    min-height: 2.25rem;
    padding: 0 0.6rem;
    font: inherit;
    font-size: 0.85rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
  }
  .insights-controls:where(.three) {
    grid-template-columns: repeat(3, max-content);
  }
  /* Custom range form, inside the dialog. */
  .custom-range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: end;
    gap: var(--space-3);
    margin: 0;
  }
  .custom-range .form-field {
    margin-bottom: 0;
  }
  .custom-range button,
  .insights-controls > button {
    box-sizing: border-box;
    min-height: 2.25rem;
    margin: 0; /* .button's own margins would lift it off the inputs' baseline */
  }
  .range-dialog {
    width: min(22rem, 100% - 2rem);
    max-height: calc(100dvh - 1rem);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
  }
  .range-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .range-dialog h2 {
    margin: 0 0 var(--space-3);
    font-size: 1.1rem;
  }
  .range-dialog footer {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
  @media (max-width: 640px) {
    .insights-controls {
      grid-template-columns: 1fr 1fr;
    }
    .range-dialog footer button {
      flex: 1;
    }
    .custom-range button,
    .insights-controls > button {
      min-height: 44px;
    }
    /* Its own full-width row under the selects, not half a row. */
    .insights-controls > button {
      grid-column: 1 / -1;
    }
    .insights-controls select,
    .custom-range input {
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

  /* Current/All on the Avg rating tile, in the free band above the value.
     The pill is cqw-sized like the rest of the tile; the button around it is
     the tap target (44px on phones via app.css) and stays transparent, so on
     a small tile it reaches over the value's top edge without hiding it. */
  .rating-switch {
    position: absolute;
    /* Centred between the tile's top edge and the top of the value's digits
       (box top 24.09cqw + ~0.18em of blank line box above the glyphs ≈ 28.7cqw):
       half of what's left after the pill (1.2 line × font + 3cqw padding + 2px border). */
    top: calc((28.7cqw - 1.2 * max(0.7rem, 6.2cqw) - 3cqw - 2px) / 2);
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
    /* A 44px button is wider than its half of the pill: push each half
       against the seam so the pill stays joined. */
    .rating-switch button:first-child {
      justify-content: flex-end;
    }
    .rating-switch button:last-child {
      justify-content: flex-start;
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

  /* The mode word in a rating tile's caption opens its explanation: the way
     to it on touch, where the switch's hover title never shows. Dotted
     underline marks it as more info. Padding grows the tap target to 44px;
     the matching negative margin keeps the caption's layout unchanged. */
  .mode-caption {
    display: block;
    overflow: visible;
    white-space: nowrap;
  }
  .stat-caption:has(.mode-caption) {
    overflow: visible;
  }
  .mode-tip-button {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    /* Match the label's uppercase; buttons don't inherit either by default. */
    text-transform: inherit;
    letter-spacing: inherit;
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: help;
  }
  .mode-tip-button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  @media (max-width: 640px) {
    .mode-tip-button {
      min-width: 44px;
      padding: 16px 15px;
      margin: -16px -15px;
    }
  }
  .mode-tip {
    --w: min(15rem, 100vw - 2rem);
    position: fixed;
    inset: auto;
    top: var(--y);
    left: clamp(1rem, var(--x) - var(--w) / 2, 100vw - 1rem - var(--w));
    width: var(--w);
    margin: 0.25rem 0 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    line-height: 1.35;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.18);
  }
  /* Set from placeTip, so Svelte can't see it. */
  .mode-tip:global([data-above]) {
    translate: 0 calc(-100% - 0.5rem);
  }

  .stat-value small {
    font-size: 0.4em;
    font-weight: 600;
  }
  /* .stat-unit upper-cases; "120G" misreads as a unit. */
  .stat-item .insights-delta {
    text-transform: none;
  }
  .insights-delta.trend-good {
    color: var(--color-fresh);
  }
  .insights-delta.trend-bad {
    color: var(--color-urgent);
  }
  /* "vs 8.0 at that pace": its own small line right under the delta, above the
     caption (tile geometry in cqw like the rest, see app.css .stat-unit). */
  .stat-item .insights-pace {
    position: absolute;
    left: var(--space-2);
    right: var(--space-2);
    top: calc(54.02cqw + max(0.7rem, 6.88cqw) + 1cqw);
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: max(0.6rem, 5.4cqw);
    line-height: 1;
    color: var(--color-text-muted);
  }
  /* Compare on, phone tiles: the delta + pace lines don't fit above the caption at
     these sizes, so every tile grows the same 0.75rem taller (rows stay even) and the
     caption moves down by as much. */
  @media (max-width: 640px) {
    .fit.comparing {
      --grow-compare: 0.75rem;
    }
    .comparing .stat-caption {
      top: calc(73.98cqw + 0.75rem);
    }
  }
  .insights-period {
    color: var(--color-text-muted);
    margin: 0 0 var(--space-3);
  }

  /* Stat rows with no empty cells. Tiles stay square (height --h = one regular tile); a
     tile wider than that (--q per row < --c) keeps its content one-tile wide, centred,
     via padding, so cqw scaling is unchanged. Columns divide the count: 3 on phones
     (Totals 5, Averages 3-6 wider); the short last row stretches. */
  .fit {
    --gap: var(--space-3);
    --c: 3;
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    container-type: inline-size;
  }
  .fit .stat-item {
    --q: var(--c);
    --w: calc((100cqw - (var(--q) - 1) * var(--gap)) / var(--q));
    --h: calc((100cqw - (var(--c) - 1) * var(--gap)) / var(--c));
    flex: 0 0 var(--w);
    box-sizing: border-box;
    aspect-ratio: auto;
    height: calc(var(--h) + var(--grow-compare, 0px));
    padding-inline: calc((var(--w) - var(--h)) / 2);
  }
  .fit.n5 .stat-item:nth-last-child(-n + 2) {
    --q: 2;
  }
  /* Rows this narrow (360-390px phones): 3 columns leave ~88px tiles, too small for the
     Current/All switch and two-line labels. 2 columns; Totals' 5th tile takes the last row. */
  @container (max-width: 380px) {
    .fit .stat-item {
      --c: 2;
    }
    .fit.n5 .stat-item:nth-last-child(2) {
      --q: 2;
    }
    .fit.n5 .stat-item:last-child {
      --q: 1;
    }
  }
  @media (min-width: 641px) {
    .fit.n5 {
      --c: 5;
    }
    .fit.n5 .stat-item:nth-last-child(-n + 2) {
      --q: var(--c);
    }
  }
  @media (min-width: 1000px) {
    .fit.n6 {
      --c: 6;
    }
  }
</style>
