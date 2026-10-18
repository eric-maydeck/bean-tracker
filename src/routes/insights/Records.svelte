<script lang="ts">
  import { setting } from '$lib/settingName';
  import Usd from '$lib/components/Usd.svelte';
  import { usd } from '$lib/money';
  import { useEmptyLine } from './coffeeNote';
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import { formatGrams } from '$lib/grams';
  import { clock12 } from '$lib/hours';
  import { DIAL_HELP, RATINGS_LABEL, MON, type BrewerType, type InsightsUrlState, type Ratings, type Dial, type Top } from '$lib/insightsUrl';
  import type { Fmt, Holder, RecordPick, RecordsTab, RecordTile, Section } from '$lib/server/insights/records';
  import { rowVars } from './rows';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import LikeLine from './LikeLine.svelte';
  import TileCaption from './TileCaption.svelte';

  let {
    t, ratings, dial, brewer, top, topc, perPerson, allRange, compareLabel, ratingsHelp, personHelp, placeTip, choose
  }: {
    t: RecordsTab; ratings: Ratings; dial: Dial; brewer: BrewerType | undefined; top: Top | undefined; topc: Top | undefined; perPerson: boolean;
    allRange: boolean; compareLabel: string;
    ratingsHelp: Record<Ratings, string>; personHelp: string; placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  const TITLE: Record<Section, string> = {
    taste: 'Taste', volume: 'Volume', freshness: 'Freshness & lifetime', money: 'Money', extremes: 'Brew extremes', gentle: 'Not quite your cup'
  };
  const BREWER: Record<BrewerType, string> = { pourover: 'Pour over', espresso: 'Espresso', immersion: 'Immersion', soup: 'Soup', other: 'Other' };
  // A tile's own anchor (#record-…), its caption links to it: keys like "grindFine:A4Z (Femobook)" slugged.
  const anchor = (key: string) => `record-${key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, '')}`;
  // "Oct 3, 2026"; a month holder (biggest buying month) is "Mar 2026".
  const date = (d: string) => (d.length === 7 ? `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`);
  // Day and month records are held by the date itself.
  const isDate = (h: Holder) => /^\d{4}-\d{2}(-\d{2})?$/.test(h.label);
  const name = (h: Holder) => (isDate(h) ? date(h.label) : h.label);

  const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
  const grams = (n: number) => (n < 100 && !Number.isInteger(n) ? `${+n.toFixed(1)}g` : formatGrams(n));
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
      case 'delta': return [`${p.mean! < 0 ? '−' : '+'}${Math.abs(p.mean!).toFixed(2)}`, undefined, 'Vs your average rating'];
      // An encoded setting: the text is the value.
      case 'grind': return [p.detail ?? ''];
      // Rating ÷ $/100 g isn't readable: the mean rating, "at $9.30/100 g" under it.
      case 'value': return [p.mean!.toFixed(1), undefined, `At ${usd(p.per100!)}/100\u00a0g`];
    }
  }
  const plain = (p: RecordPick, fmt: Fmt) => parts(p, fmt).filter(Boolean).join(' ');
  // The record's inputs (what its value is made of), on their own line: a derived value shows its working.
  // Roaster money records count bags bought in the period: the line says which window.
  const BOUGHT = new Set(['roasterSpend', 'roasterBags']);
  const inputs = (p: RecordPick, fmt: Fmt, key = '') =>
    parts(p, fmt)[2] ?? (fmt === 'grind' ? undefined : BOUGHT.has(key) ? `${p.detail}${allRange ? ', all time' : ' this period'}` : p.detail);
  // Badge: a snapshot ("Now"), an all-time-only record, or a period holder that is the all-time record
  // (not when the period covers all the data, where every record is).
  // The compare line names its window, as the Compare menu does ("Previous 12 months" → "Prev. 12
  // months"); a label too long for a tile line (custom dates) says "Previous period".
  let wasLabel = $derived.by(() => {
    const l = compareLabel.replace(/^Previous /, 'Prev. ');
    return l && l.length <= 16 ? l : 'Previous period';
  });
  const BADGE_HELP = {
    record: 'Holds the all-time record.',
    alltime: 'Counted over all time, whatever the Period.',
    now: 'Right now, whatever the Period.'
  };
  const badge = (r: RecordTile) => (r.scope === 'now' ? 'Now' : r.scope || (r.allTime === null && !t.coversAll) ? 'All-time' : null);

  // A cut-off line or name shows its full text on hover (mouse) or focus (keyboard, tap): one shared
  // tip, placed like placeTip's. A cut line with no link inside gets a tabindex so it can take focus.
  let fullTip = $state<HTMLElement>();
  const cut = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  function full(el: HTMLElement) {
    const show = () => {
      if (!fullTip || !cut(el)) return;
      fullTip.replaceChildren(...[...el.childNodes].map((n) => n.cloneNode(true))); // keeps a coffee name's color
      const r = el.getBoundingClientRect(), below = r.bottom + 96 < innerHeight;
      fullTip.style.setProperty('--x', `${r.left + r.width / 2}px`);
      fullTip.style.setProperty('--y', `${below ? r.bottom : r.top}px`);
      fullTip.toggleAttribute('data-above', !below);
      fullTip.showPopover();
    };
    const hide = () => fullTip?.matches(':popover-open') && fullTip.hidePopover();
    const over = (e: PointerEvent) => e.pointerType === 'mouse' && show();
    const ro = new ResizeObserver(() => {
      if (el.querySelector('a')) return;
      if (cut(el)) el.tabIndex = 0;
      else el.removeAttribute('tabindex');
    });
    ro.observe(el);
    const on: [string, EventListener][] = [['pointerenter', over as EventListener], ['pointerleave', hide], ['focusin', show], ['focusout', hide]];
    for (const [e, f] of on) el.addEventListener(e, f);
    return { destroy: () => { ro.disconnect(); hide(); for (const [e, f] of on) el.removeEventListener(e, f); } };
  }

  let sections = $derived.by(() => {
    const out = t.sections.map((s) => ({ ...s, title: TITLE[s.key] }));
    // The brewer switch lives in Brew extremes: keep the panel when a brewer has nothing here.
    if (brewer && !out.some((s) => s.key === 'extremes')) {
      const i = out.findIndex((s) => s.key === 'gentle');
      out.splice(i < 0 ? out.length : i, 0, { key: 'extremes', tiles: [], title: TITLE.extremes });
    }
    return out;
  });
  const emptyLine = useEmptyLine();
</script>

{#snippet caption(id: string, label: string, rating: boolean, every: boolean, pp: boolean, href: string)}
  <TileCaption {href} {label}
    >{#if rating}{'\u00a0· '}<button class="mode-tip-button" popovertarget="tip-{id}" aria-describedby="tip-{id}"
        ><span class="tip-text">{every && dial === 'dialed' ? 'Always all brews' : RATINGS_LABEL[ratings]}</span><Icon name="question" /></button
      >{/if}{#if pp}{'\u00a0· '}<button class="mode-tip-button" popovertarget="tip-pp-{id}" aria-describedby="tip-pp-{id}"
        ><span class="tip-text">per person</span><Icon name="question" /></button
      >{/if}</TileCaption
  >
  {#if rating}<div class="mode-tip" id="tip-{id}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: RATINGS_LABEL[ratings], lines: [ratingsHelp[ratings], every ? `${setting('Always all brews')}: this record is about dial-in.` : DIAL_HELP[dial]] }} /></div>{/if}
  {#if pp}<div class="mode-tip" id="tip-pp-{id}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Per person', lines: [personHelp] }} /></div>{/if}
{/snippet}

<!-- Holders are coffees, brews, roasters, gear or dates: `text` colors only the coffee names in them. -->
{#snippet link(h: Holder)}{#if h.href}<a href={h.href}><CoffeeName text={name(h)} /></a>{:else}<CoffeeName text={name(h)} />{/if}{/snippet}

{#snippet holderLine(q: string, p: RecordPick, fmt: Fmt)}
  <span class="hl-line" use:full>{q}: {plain(p, fmt)} · {@render link(p.holder)}</span>
{/snippet}

<!-- A list tip: one row per entry, the name cut to a line and its date muted at the right. -->
{#snippet tipList(id: string, head: string | null, rows: { name: string; side: string; href?: string }[])}
  <div class="mode-tip tip-list" id={id} popover onbeforetoggle={placeTip}>
    {#if head}<strong class="tip-title"><CoffeeName text={head} /></strong>{/if}
    <ul>{#each rows as row, i (i)}<li><span>{#if row.href}<a href={row.href}><CoffeeName text={row.name} /></a>{:else}<CoffeeName text={row.name} />{/if}</span>{#if row.side}<small>{row.side}</small>{/if}</li>{/each}</ul>
  </div>
{/snippet}

{#snippet tile(r: RecordTile, id: string, style: string)}
  {@const [v, unit] = parts(r, r.fmt)}
  {@const b = badge(r)}
  {@const why = inputs(r, r.fmt, r.key)}
  <!-- Lines come in groups (holder + its sub; inputs + date; All-time + Was), tight inside, a little
       apart between. -->
  <div class="hl-card" id={anchor(r.key)} {style}>
    <span class="hl-value">{#if r.fmt === 'money' || r.fmt === 'per100'}<Usd n={r.value} tipSuffix={r.fmt === 'per100' ? '/100\u00a0g' : ''} />{:else}{v}{/if}{#if unit}<small>{` ${unit}`}</small>{/if}</span>
    <div class="grp">
      <span class="hl-holder" use:full>{@render link(r.holder)}</span>
      {#if r.holder.sub}<span class="hl-line" use:full>{r.holder.sub}</span>{/if}
    </div>
    {#if why || !isDate(r.holder)}
      <div class="grp">
        {#if r.fmt === 'value' && r.per100 != null}<span class="hl-line" use:full>At <Usd n={r.per100} suffix={'/100\u00a0g'} /></span>
        {:else if why}<span class="hl-line" use:full><CoffeeName text={why} /></span>{/if}
        {#if !isDate(r.holder)}<span class="hl-line">{date(r.holder.date)}</span>{/if}
      </div>
    {/if}
    {#if r.ties.length}
      <button class="mode-tip-button hl-line record-ties" popovertarget="ties-{id}" aria-describedby="ties-{id}"
        ><span class="tip-text">+{r.ties.length} tied</span><Icon name="question" /></button
      >
      {@render tipList(`ties-${id}`, `Also ${plain(r, r.fmt)}:`, r.ties.map((h) => ({ name: name(h), side: isDate(h) ? '' : date(h.date), href: h.href })))}
    {/if}
    {#if r.key === 'mostTens' && t.perfectTens.length > r.ties.length + 1}
      <button class="mode-tip-button hl-line" popovertarget="tens-list" aria-describedby="tens-list"
        ><span class="tip-text">{t.perfectTens.length} coffees with a 10</span><Icon name="question" /></button
      >
      {@render tipList('tens-list', 'Perfect 10s by coffee:', t.perfectTens.map((p) => ({ name: p.holder.label, side: `${p.count}×`, href: p.holder.href })))}
    {/if}
    {#if (!b && r.allTime) || r.was}
      <div class="grp">
        {#if !b && r.allTime}{@render holderLine('All-time', r.allTime, r.fmt)}{/if}
        {#if r.was}{@render holderLine(wasLabel, r.was, r.fmt)}{/if}
      </div>
    {/if}
    {#if b}
      <div class="badge-tip">
        <button class="mode-tip-button" popovertarget="badge-{id}" aria-describedby="badge-{id}"
          ><span class="badge hl-badge">{b}</span></button
        >
        <div class="mode-tip" id="badge-{id}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: b, lines: [BADGE_HELP[r.scope ?? 'record']] }} /></div>
      </div>
    {/if}
    {@render caption(id, r.label, r.rating, r.dialIn, r.perDay && perPerson, `#${anchor(r.key)}`)}
  </div>
{/snippet}

<!-- A ranked list (top coffees, top brews): 10 → 20 → 50 and back a step at a time; Show less sits left. -->
{#snippet topList(id: string, noun: string, rows: { score: number; holder: Holder; line: string; like?: { gap: number; label: string } }[], n: Top | undefined, set: (v: Top | undefined) => void)}
  {@const shown = rows.slice(0, n ?? 10)}
  <HeadingAnchor {id} level={3} class="top-title">Top {shown.length} {noun}</HeadingAnchor>
  <ol class="top-brews" style:--n={shown.length} style:--half={Math.ceil(shown.length / 2)}>
    {#each shown as row, i (i)}
      <li>
        <span class="rank">{i + 1}</span>
        <span class="top-rating">{row.score.toFixed(1)}</span>
        <span class="who">
          {#if row.holder.href}<a href={row.holder.href} use:full><CoffeeName text={row.holder.label} /></a>{:else}<span use:full><CoffeeName text={row.holder.label} /></span>{/if}
          <small use:full><CoffeeName text={row.line} /></small>

          {#if row.like}<LikeLine like={row.like} />{/if}
        </span>
      </li>
    {/each}
  </ol>
  {#if rows.length > 10}
    {@const next = n === 50 ? null : n === 20 ? 50 : 20}
    <div class="top-foot">
      {#if n}<button class="button button-ghost" onclick={() => set(n === 50 ? 20 : undefined)}>Show less</button>{/if}
      {#if next && rows.length > shown.length}<button class="button button-ghost" onclick={() => set(next)}>Show more</button>{/if}
    </div>
  {/if}
{/snippet}

{#if !sections.length}
  <section class="chart-panel"><p class="hl-empty">{emptyLine('No brews in this period.')}</p></section>
{/if}
{#each sections as s (s.key)}
  {@const vars = rowVars(s.tiles.length)}
  <section class="chart-panel" class:gentle={s.key === 'gentle'}>
    {#if s.key === 'extremes' && t.brewerTypes.length > 1}
      <div class="chart-panel-header">
        <HeadingAnchor id="records-{s.key}">{s.title}</HeadingAnchor>
        <div class="tab-group tab-group-compact brewer-switch" role="group" aria-label="Brewer">
          {#each [undefined, ...t.brewerTypes] as b (b ?? 'all')}
            <button aria-pressed={brewer === b} onclick={() => choose({ brewer: b })}>{b ? BREWER[b] : 'All'}</button>
          {/each}
        </div>
      </div>
    {:else}
      <HeadingAnchor id="records-{s.key}">{s.title}</HeadingAnchor>
    {/if}
    {#if !s.tiles.length}
      <p class="hl-empty">{emptyLine(`No ${brewer ? `${BREWER[brewer].toLowerCase()} ` : ''}brews in this period.`)}</p>
    {:else}
      <div class="hl-grid record-grid">
        {#each s.tiles as r, i (r.key)}{@render tile(r, `${s.key}-${i}`, vars[i])}{/each}
      </div>
    {/if}
    {#if s.key === 'taste'}
      {#if t.topCoffees.length}
        {@render topList('records-top-coffees', 'coffees', t.topCoffees.map((c) => ({
          score: c.mean, holder: c.holder, like: c.like, line: [c.holder.sub, `${c.brews} rated brews`].filter(Boolean).join(' · ')
        })), topc, (v) => choose({ topc: v }))}
      {/if}
      {#if t.topBrews.length}
        {@render topList('records-top-brews', 'brews', t.topBrews.map((b) => ({
          score: b.rating, holder: b.holder, line: [date(b.holder.date), b.brewer].filter(Boolean).join(' · ')
        })), top, (v) => choose({ top: v }))}
      {/if}
    {/if}
  </section>
{/each}
<div class="mode-tip" popover="manual" bind:this={fullTip}></div>

<style>
  /* Card grid and card base: .hl-grid / .hl-card, :global in +page.svelte (Milestones shares them). */
  /* Insights tiles sit on the page color; the gentle row swaps to the panel's own surface. */
  .gentle :global(.hl-card) {
    background: var(--color-surface);
  }
  @media (hover: hover) {
    .gentle :global(.hl-card:hover) {
      background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
    }
  }
  /* A tip button's phone padding (its 44px tap target) is canceled by negative margins, so it
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
  .chart-panel-header :global(h2) {
    margin: 0;
  }
  /* Captions keep their lines (ui-rules 44): two, four on the narrowest cards (360 px), top aligned, so the first
     lines sit level across a row however many a caption wraps to. */
  :global(.record-grid .hl-caption .stat-label) {
    min-height: 2lh;
  }
  @container (max-width: 399px) {
    :global(.record-grid .hl-caption .stat-label) {
      min-height: 4lh;
    }
  }
  /* The badge sits at the foot, just above the caption, on every card. */
  /* Flex: the badge's tip button is its own row (checkLayout rule 5), apart from "+N tied". */
  .badge-tip {
    display: flex;
    justify-content: center;
    margin-top: auto;
    /* Hugs the caption: the card's 0.4rem gap is for line groups. */
    margin-bottom: -0.2rem;
    line-height: 1;
  }
  .badge-tip + :global(.hl-caption) {
    margin-top: 0;
    padding-top: var(--space-1);
  }
  .top-foot {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }
  .top-foot button {
    margin: 0;
  }
  @media (max-width: 640px) {
    .top-foot button {
      min-height: 44px;
    }
  }
  .hl-card {
    gap: 0.4rem;
    scroll-margin-top: var(--space-2);
  }
  .grp {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-width: 0;
  }
  .grp :global(.hl-line),
  .grp :global(.hl-holder) {
    line-height: 1.3;
  }
  .chart-panel :global(.top-title) {
    margin: var(--space-4) 0 var(--space-2);
    font-size: 1rem;
  }
  /* Two columns of five on wider screens, so the list doesn't run a tall single column. */
  .top-brews {
    display: grid;
    grid-auto-flow: column;
    /* Phones: one column, however many rows (top 20 runs down, not across). */
    grid-template-rows: repeat(var(--rows, var(--n)), auto);
    /* Equal columns, so Top coffees and Top brews line up. */
    grid-auto-columns: minmax(0, 1fr);
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
