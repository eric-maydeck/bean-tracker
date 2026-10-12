<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { formatGrams } from '$lib/grams';
  import { clock12 } from '$lib/hours';
  import { MON, type BrewerType, type InsightsUrlState, type Ratings } from '$lib/insightsUrl';
  import type { Fmt, Holder, RecordPick, RecordsTab, RecordTile, Section } from '$lib/server/insights/records';
  import { rowVars } from './rows';

  let {
    t, ratings, brewer, perPerson, allRange, ratingsHelp, personHelp, placeTip, choose
  }: {
    t: RecordsTab; ratings: Ratings; brewer: BrewerType | undefined; perPerson: boolean; allRange: boolean;
    ratingsHelp: Record<Ratings, string>; personHelp: string; placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  const TITLE: Record<Section, string> = {
    taste: 'Taste', volume: 'Volume', freshness: 'Freshness & lifetime', money: 'Money', extremes: 'Brew extremes', gentle: 'Not quite your cup'
  };
  const BREWER: Record<BrewerType, string> = { pourover: 'Pour over', espresso: 'Espresso', immersion: 'Immersion', soup: 'Soup', other: 'Other' };
  // "Oct 3, 2026"; a month holder (biggest buying month) is "Mar 2026".
  const date = (d: string) => (d.length === 7 ? `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`);
  // Day and month records are held by the date itself.
  const isDate = (h: Holder) => /^\d{4}-\d{2}(-\d{2})?$/.test(h.label);
  const name = (h: Holder) => (isDate(h) ? date(h.label) : h.label);

  const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
  const grams = (n: number) => (n < 100 && !Number.isInteger(n) ? `${+n.toFixed(1)}g` : formatGrams(n));
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const mss = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
  // [value, small unit after it, the context line when the format moves the detail into the value].
  function parts(p: RecordPick, fmt: Fmt): [string, string?, string?] {
    const n = p.value;
    switch (fmt) {
      case 'rating': return [n.toFixed(1)];
      case 'count': return [num(n)];
      case 'grams': case 'ml': return [grams(n)];
      case 'days': return [num(n), n === 1 ? 'day' : 'days'];
      case 'gpd': return [num(n), 'g/day'];
      case 'money': return [usd(n)];
      case 'per100': return [usd(n), '/ 100\u00a0g'];
      case 'clock': { const [hm, ap] = clock12(n).split(' '); return [hm, ap]; }
      case 'seconds': return [mss(n)];
      case 'ratio': return [`1:${n.toFixed(1)}`];
      case 'sd': return [`±${n.toFixed(2)}`];
      // Ranked by the adjusted delta (value), shown as the raw one (mean).
      case 'delta': return [`${p.mean! < 0 ? '−' : '+'}${Math.abs(p.mean!).toFixed(2)}`, undefined, 'vs your average'];
      // An encoded setting: the text is the value.
      case 'grind': return [p.detail ?? ''];
      // Rating ÷ $/100 g isn't readable: the mean rating, "at $9.30/100 g" under it.
      case 'value': return [p.mean!.toFixed(1), undefined, `at ${usd(p.per100!)}/100\u00a0g`];
    }
  }
  const plain = (p: RecordPick, fmt: Fmt) => parts(p, fmt).filter(Boolean).join(' ');
  const context = (p: RecordPick, fmt: Fmt) =>
    [parts(p, fmt)[2] ?? (fmt === 'grind' ? null : p.detail), isDate(p.holder) ? null : date(p.holder.date)].filter(Boolean).join(' · ');
  // Badge: a snapshot ("Now"), an all-time-only record, or a period holder that is the all-time record
  // (not on All time, where every record is).
  const badge = (r: RecordTile) => (r.scope === 'now' ? 'Now' : r.scope || (r.allTime === null && !allRange) ? 'All-time' : null);

  let sections = $derived.by(() => {
    const out = t.sections.map((s) => ({ ...s, title: TITLE[s.key] }));
    // The brewer switch lives in Brew extremes: keep the panel when a brewer has nothing here.
    if (brewer && !out.some((s) => s.key === 'extremes')) {
      const i = out.findIndex((s) => s.key === 'gentle');
      out.splice(i < 0 ? out.length : i, 0, { key: 'extremes', tiles: [], title: TITLE.extremes });
    }
    return out;
  });
</script>

{#snippet ratingSwitch()}
  <div class="tab-group hl-switch" role="group" aria-label="Ratings">
    {#each ['current', 'all'] as const as m (m)}
      <button aria-pressed={ratings === m} title={ratingsHelp[m]} aria-describedby="ratings-help-{m}" onclick={() => choose({ ratings: m })}
        ><span>{m === 'all' ? 'All' : 'Current'}</span></button
      >
    {/each}
  </div>
{/snippet}

{#snippet caption(id: string, label: string, rating: boolean, pp: boolean)}
  <div class="hl-caption">
    <span class="stat-label"
      >{label}{#if rating}{'\u00a0· '}<button class="mode-tip-button" popovertarget="tip-{id}" aria-describedby="tip-{id}"
          ><span class="tip-text">{ratings === 'all' ? 'All' : 'Current'}</span><Icon name="question" /></button
        >{/if}{#if pp}{'\u00a0· '}<button class="mode-tip-button" popovertarget="tip-pp-{id}" aria-describedby="tip-pp-{id}"
          ><span class="tip-text">per person</span><Icon name="question" /></button
        >{/if}</span
    >
  </div>
  {#if rating}<div class="mode-tip" id="tip-{id}" popover onbeforetoggle={placeTip}>{ratingsHelp[ratings]}</div>{/if}
  {#if pp}<div class="mode-tip" id="tip-pp-{id}" popover onbeforetoggle={placeTip}>{personHelp}</div>{/if}
{/snippet}

{#snippet tile(r: RecordTile, id: string, style: string)}
  {@const [v, unit] = parts(r, r.fmt)}
  {@const b = badge(r)}
  <div class="hl-card" {style}>
    <div class="hl-top">{#if r.rating}{@render ratingSwitch()}{/if}</div>
    <span class="hl-value">{v}{#if unit}<small>{` ${unit}`}</small>{/if}</span>
    <span class="hl-holder">{#if r.holder.href}<a href={r.holder.href}>{name(r.holder)}</a>{:else}{name(r.holder)}{/if}</span>
    {#if r.holder.sub}<span class="hl-line">{r.holder.sub}</span>{/if}
    {#if context(r, r.fmt)}<span class="hl-line">{context(r, r.fmt)}</span>{/if}
    {#if r.ties.length}
      <button class="mode-tip-button hl-line record-ties" popovertarget="ties-{id}" aria-describedby="ties-{id}"
        ><span class="tip-text">+{r.ties.length} tied</span><Icon name="question" /></button
      >
      <div class="mode-tip" id="ties-{id}" popover onbeforetoggle={placeTip}>
        <p>Also {plain(r, r.fmt)}:</p>
        <ul>{#each r.ties as h, i (i)}<li>{name(h)}{isDate(h) ? '' : ` · ${date(h.date)}`}</li>{/each}</ul>
      </div>
    {/if}
    {#if b}
      <span class="badge hl-badge">{b}</span>
    {:else if r.allTime}
      <span class="hl-line">All-time: {plain(r.allTime, r.fmt)} · {name(r.allTime.holder)}</span>
    {/if}
    {#if r.was}<span class="hl-line">was: {plain(r.was, r.fmt)} · {name(r.was.holder)}</span>{/if}
    {@render caption(id, r.label, r.rating, r.perDay && perPerson)}
  </div>
{/snippet}

{#if !sections.length}
  <section class="chart-panel"><p class="hl-empty">No brews in this period.</p></section>
{/if}
{#each sections as s (s.key)}
  {@const tens = s.key === 'taste' && t.perfectTens.length ? 1 : 0}
  {@const vars = rowVars(s.tiles.length + tens)}
  <section class="chart-panel" class:gentle={s.key === 'gentle'}>
    {#if s.key === 'extremes' && t.brewerTypes.length > 1}
      <div class="chart-panel-header">
        <h2>{s.title}</h2>
        <div class="tab-group tab-group-compact brewer-switch" role="group" aria-label="Brewer">
          {#each [undefined, ...t.brewerTypes] as b (b ?? 'all')}
            <button aria-pressed={brewer === b} onclick={() => choose({ brewer: b })}>{b ? BREWER[b] : 'All'}</button>
          {/each}
        </div>
      </div>
    {:else}
      <h2>{s.title}</h2>
    {/if}
    {#if !s.tiles.length}
      <p class="hl-empty">No {brewer ? `${BREWER[brewer].toLowerCase()} ` : ''}brews in this period.</p>
    {:else}
      <div class="hl-grid record-grid">
        {#each s.tiles as r, i (r.key)}{@render tile(r, `${s.key}-${i}`, vars[i])}{/each}
        {#if tens}
          {@const last = t.perfectTens[t.perfectTens.length - 1]}
          <div class="hl-card" style={vars[vars.length - 1]}>
            <div class="hl-top">{@render ratingSwitch()}</div>
            <span class="hl-value">{t.perfectTens.length}</span>
            <span class="hl-holder">{#if last.holder.href}<a href={last.holder.href}>{last.holder.label}</a>{:else}{last.holder.label}{/if}</span>
            <span class="hl-line">{[last.brewer, `latest ${date(last.holder.date)}`].filter(Boolean).join(' · ')}</span>
            {#if t.perfectTens.length > 1}
              <button class="mode-tip-button hl-line" popovertarget="tens-list" aria-describedby="tens-list"
                ><span class="tip-text">{t.perfectTens.length} brews</span><Icon name="question" /></button
              >
              <div class="mode-tip" id="tens-list" popover onbeforetoggle={placeTip}>
                <ul>{#each t.perfectTens as p, i (i)}<li>{p.holder.label} · {date(p.holder.date)}</li>{/each}</ul>
              </div>
            {/if}
            {@render caption('tens', 'Perfect 10s', true, false)}
          </div>
        {/if}
      </div>
    {/if}
    {#if s.key === 'taste' && t.topBrews.length}
      <h3 class="top-title">Top {t.topBrews.length} brews</h3>
      <ol class="top-brews" style:--half={Math.ceil(t.topBrews.length / 2)}>
        {#each t.topBrews as b, i (i)}
          <li>
            <span class="rank">{i + 1}</span>
            <span class="top-rating">{b.rating.toFixed(1)}</span>
            <span class="who">
              {#if b.holder.href}<a href={b.holder.href}>{b.holder.label}</a>{:else}<span>{b.holder.label}</span>{/if}
              <small>{[date(b.holder.date), b.brewer].filter(Boolean).join(' · ')}</small>
            </span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/each}

<style>
  /* Card grid and card base: .hl-grid / .hl-card, :global in +page.svelte (Milestones shares them). */
  .gentle :global(.hl-card) {
    background: var(--color-bg);
  }
  /* A tip button's phone padding (its 44px tap target) is cancelled by negative margins, so it
     needs no room in the card: 100% would squeeze its text out of a narrow card. */
  button.hl-line {
    max-width: none;
  }
  .brewer-switch button {
    margin: 0;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .brewer-switch button {
      min-width: 44px;
    }
  }
  .chart-panel-header h2 {
    margin: 0;
  }
  .mode-tip p,
  .mode-tip ul {
    margin: 0;
  }
  .mode-tip ul {
    padding-left: 1.1rem;
  }
  .top-title {
    margin: var(--space-4) 0 var(--space-2);
    font-size: 1rem;
  }
  /* Two columns of five on wider screens, so the list doesn't run a tall single column. */
  .top-brews {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(var(--rows, 10), auto);
    column-gap: var(--space-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  @media (min-width: 641px) {
    .top-brews {
      --rows: var(--half);
    }
  }
  .top-brews li {
    display: grid;
    grid-template-columns: 1.5rem 2.75rem minmax(0, 1fr);
    align-items: center;
    gap: var(--space-2);
    min-height: 3rem;
    border-top: 1px solid var(--color-border);
  }
  .rank {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .top-rating {
    font-size: 1.35rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .who {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }
  .who > a,
  .who > span,
  .who small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who small {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
</style>
