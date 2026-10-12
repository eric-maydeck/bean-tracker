<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { InsightsUrlState, InsightsView, Ratings } from '$lib/insightsUrl';
  import type { LabOptions, Spot, SweetSpotsTab } from '$lib/server/insights/lab';
  import { STRENGTH, STRENGTH_HELP } from './Insights.svelte';
  import { sizedGrid } from './rows';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';
  import TileCaption from './TileCaption.svelte';

  let { t, lab, s, ratingsHelp, placeTip, choose }: {
    t: SweetSpotsTab; lab: LabOptions; s: InsightsView; ratingsHelp: Record<Ratings, string>;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  // On-hand bags, plus the URL's bag when it's archived (its link still works, so the select shows it).
  let bagOptions = $derived(
    lab.bags.filter((b) => b.onHand || b.slug === s.bag).sort((a, b) => a.label.localeCompare(b.label))
  );
  function pickBag(slug: string) {
    const b = lab.bags.find((x) => x.slug === slug);
    // A bag fills Roast level and Process from itself; Origin and Roaster stay as set.
    choose(b ? { bag: b.slug, roast: b.roast && lab.roasts.includes(b.roast) ? b.roast : undefined, process: b.process } : { bag: undefined });
  }
  const any = (v: string) => v || undefined;
  let filtered = $derived(!!(s.bag || s.roast || s.process || s.origin || s.roaster));
  const defaultGrinder = $derived(lab.grinders[0]?.slug);

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)}`;
  // The card's number (largest): the winner, a lean, the one setting ever used, or no winner.
  const value = (p: Spot) =>
    p.best && p.verdict !== 'none' ? p.best.label : p.tier === 3 && !p.varied ? p.usual.label : 'No clear winner';
  const leaning = (p: Spot) => !!p.best && p.verdict === 'leaning';
  // The evidence behind it, one muted line (clamped; the card's title and popover have it in full).
  function evidence(p: Spot): string {
    const nb = (l: string) => l.replace(/(\d) /g, '$1\u00a0'); // "91 °C" never breaks before its unit
    if (p.tier === 1 && p.best) return `${signed(p.best.value)} vs same bag · ${plural(p.bags, 'bag')}`;
    if (p.tier === 2 && p.best && p.next)
      return `Across ${p.group}: ${nb(p.best.label)} ${p.best.value.toFixed(1)} vs ${nb(p.next.label)} ${p.next.value.toFixed(1)} · ${plural(p.bags, 'bag')}`;
    return p.varied ? 'Not enough brews to compare yet' : `No comparison yet: always ${p.usual.label} (avg ${p.usual.mean.toFixed(1)})`;
  }
  const usually = (p: Spot) => (p.tier === 3 && !p.varied ? null : `Usually: ${p.usual.label}`);
  const badge = (p: Spot) => (p.best?.strength === 'solid' || p.best?.strength === 'hint' ? p.best.strength : null);

  let sized = $derived(sizedGrid(t.cards, () => false));

  // The card's mini chart: every band of the evidence it used, zero-centred. Tier 1 bars are same-bag
  // deltas; tier 2/3 bars are bag means less their bag-weighted average, so above/below reads the same
  // way. Winner (or lean) in the accent, other solid bands neutral, thin bands pale; the usual band dotted.
  function chart(p: Spot) {
    const n = p.bands.reduce((a, b) => a + b.bags, 0) || 1;
    const centre = p.tier === 1 ? 0 : p.bands.reduce((a, b) => a + b.value * b.bags, 0) / n;
    const ds = p.bands.map((b) => b.value - centre);
    // The axis fits the solid bands when there are any: a thin band past it is clipped at the edge with a cap
    // (its value stays in the tip), so thin data shows without dominating.
    const fit = p.bands.some((b) => b.solid) ? ds.filter((_, i) => p.bands[i].solid) : ds;
    const hi = Math.max(0, ...fit), lo = Math.min(0, ...fit), span = hi - lo || 1;
    const shown = ds.map((d) => Math.min(hi, Math.max(lo, d)));
    const pick = p.best && p.verdict !== 'none' ? p.best.label : null;
    return {
      zero: (hi / span) * 100,
      bars: p.bands.map((b, i) => ({
        ...b, top: ((hi - Math.max(0, shown[i])) / span) * 100, h: (Math.abs(shown[i]) / span) * 100, up: ds[i] >= 0, clip: shown[i] !== ds[i],
        pick: b.label === pick, usual: b.label === p.usual.label,
        text: `${b.label}: ${p.tier === 1 ? `${signed(b.value)} vs same bag` : `${b.value.toFixed(1)} avg (bag means)`} · ${plural(b.bags, 'bag')} · ${plural(b.brews, 'brew')}${b.solid ? '' : ' · few'}${b.label === p.usual.label ? ' · usual' : ''}`
      }))
    };
  }
  // Its themed tip (the Heatmap's .cell-tip): mouse hover, or a tap on touch; one open at a time.
  // A tap toggles; a mouse click on a tip its hover opened keeps it open.
  let tip = $state<{ key: string; i: number; x: number; hover: boolean } | null>(null);
  function tipAt(e: MouseEvent | PointerEvent, key: string, n: number, hover: boolean) {
    const wrap = e.currentTarget as HTMLElement, r = wrap.getBoundingClientRect();
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)));
    if (!hover && tip?.key === key && tip.i === i && !tip.hover) return (tip = null);
    // Centred on its column, kept inside the viewport (the tip is at most 16rem wide).
    const half = Math.min(128, innerWidth / 2 - 16);
    const x = Math.min(Math.max(r.left + ((i + 0.5) / n) * r.width, half + 16), innerWidth - half - 16) - r.left;
    tip = { key, i, x, hover };
  }

  // A card whose text doesn't fit its row's height token tightens (ui-rules 34, as Findings cards do):
  // 1 = evidence to one line, 2 = the Usually line goes too (the card's title and popover keep both),
  // 3 = the chart's end labels go (its tip and aria-label name every band), 4 = the evidence line goes
  // (phone rows: the chart still shows its shape; the line stays in the title and the tap popover).
  // Re-runs on a width change only, so tightening can't loop.
  function tighten(el: HTMLElement, _cards: unknown) {
    let w = -1;
    const run = () => {
      for (const c of el.children as HTMLCollectionOf<HTMLElement>) {
        delete c.dataset.tight;
        for (let t = 1; t <= 4 && c.scrollHeight > c.clientHeight + 1; t++) c.dataset.tight = `${t}`;
      }
    };
    const ro = new ResizeObserver(([e]) => {
      if (Math.round(e.contentRect.width) === w) return;
      w = Math.round(e.contentRect.width);
      run();
    });
    ro.observe(el);
    document.fonts?.ready.then(run);
    let raf = 0;
    return { update: () => (raf = requestAnimationFrame(run)), destroy: () => (ro.disconnect(), cancelAnimationFrame(raf)) };
  }

  // Tap on a card whose evidence is clamped opens its full text (as Findings cards do); hover has the title.
  function unclamp(e: MouseEvent) {
    const c = e.currentTarget as HTMLElement;
    if ((e.target as Element).closest('a, button, .mode-tip, .spot-chart')) return;
    const ev = c.querySelector('.evidence');
    if (+(c.dataset.tight ?? 0) >= 2 || (ev && ev.scrollHeight > ev.clientHeight + 1)) document.getElementById(`${c.id}-full`)?.togglePopover();
  }
</script>

<!-- A tap outside a chart closes its tip. -->
<svelte:document onclick={(e) => tip && !(e.target as Element).closest?.('.spot-chart') && (tip = null)} />

<div class="insights-bar spot-picker" class:even={lab.grinders.length > 1}>
  <label class="form-field group-field bag-field">
    <span>Bag</span>
    <select class="ctl-select" aria-label="Bag" value={s.bag ?? ''} onchange={(e) => pickBag(e.currentTarget.value)}>
      <option value="">Any</option>
      {#each bagOptions as b (b.slug)}<option value={b.slug}>{b.label}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field">
    <span>Roast level</span>
    <select class="ctl-select" aria-label="Roast level" value={s.roast ?? ''} onchange={(e) => choose({ roast: any(e.currentTarget.value) })}>
      <option value="">Any</option>
      {#each lab.roasts as v (v)}<option value={v}>{v}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field">
    <span>Process</span>
    <select class="ctl-select" aria-label="Process" value={s.process ?? ''} onchange={(e) => choose({ process: any(e.currentTarget.value) })}>
      <option value="">Any</option>
      {#each lab.processes as v (v)}<option value={v}>{v}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field">
    <span>Origin</span>
    <select class="ctl-select" aria-label="Origin" value={s.origin ?? ''} onchange={(e) => choose({ origin: any(e.currentTarget.value) })}>
      <option value="">Any</option>
      {#each lab.origins as v (v)}<option value={v}>{v}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field">
    <span>Roaster</span>
    <select class="ctl-select" aria-label="Roaster" value={s.roaster ?? ''} onchange={(e) => choose({ roaster: any(e.currentTarget.value) })}>
      <option value="">Any</option>
      {#each lab.roasters as v (v)}<option value={v}>{v}</option>{/each}
    </select>
  </label>
  {#if lab.grinders.length > 1}
    <label class="form-field group-field">
      <span>Grinder</span>
      <select class="ctl-select" aria-label="Grinder" value={s.grinder ?? defaultGrinder}
        onchange={(e) => choose({ grinder: e.currentTarget.value === defaultGrinder ? undefined : e.currentTarget.value })}>
        {#each lab.grinders as g (g.slug)}<option value={g.slug}>{g.name}</option>{/each}
      </select>
    </label>
  {/if}
  <RatingsSwitch ratings={s.ratings} {ratingsHelp} {choose} />
  <button class="button button-ghost reset-picker" type="button" disabled={!filtered}
    onclick={() => choose({ bag: undefined, roast: undefined, process: undefined, origin: undefined, roaster: undefined })}>Reset picker</button>
</div>

{#if !t.matching.brews}
  <section class="chart-panel">
    <p class="hl-empty">{filtered ? 'No rated brews match these filters in this period.' : 'No rated brews in this period.'}</p>
  </section>
{:else}
  <p class="insights-period">Matching: {plural(t.matching.bags, 'bag')}, {plural(t.matching.brews, 'brew')}</p>

  <section class="chart-panel" data-section="spots-cards">
    <div class="spots-head">
      <HeadingAnchor id="spots-cards">Sweet spots</HeadingAnchor>
      <button class="mode-tip-button" popovertarget="spots-help" aria-label="How sweet spots work" aria-describedby="spots-help"><Icon name="question" /></button>
      <div class="mode-tip" id="spots-help" popover onbeforetoggle={placeTip}>
        For each setting, the band your ratings favour for coffees like this. First choice: the same bag brewed both ways
        (+0.4 = beat the same bag's other brews by 0.4). Not enough of those: bag averages across similar coffees, widening
        the group until there's enough. Solid = at least twice its noise; Hint = 1.5 to 2.
      </div>
    </div>
    <div class="hl-grid finding-grid spot-grid" use:tighten={sized}>
      {#each sized as { item: c, style } (c.key)}
        {@const p = c.spot}
        {@const id = `spot-${c.key}`}
        {@const v = value(p)}
        {@const b = badge(p)}
        {@const full = [`${c.name}: ${leaning(p) ? 'Leaning ' : ''}${v}`, evidence(p), usually(p)].filter(Boolean).join('\n')}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the clamped text is in the DOM for readers) -->
        <div class="hl-card spot-card" {id} {style} title={full} onclick={unclamp}>
          <div class="hl-top">
            {#if b}
              <button class="mode-tip-button" popovertarget="{id}-badge" aria-describedby="{id}-badge"
                ><span class="badge hl-badge" class:hint={b === 'hint'}>{STRENGTH[b]}</span></button
              >
              <div class="mode-tip" id="{id}-badge" popover onbeforetoggle={placeTip}>{STRENGTH_HELP[b]}</div>
            {/if}
          </div>
          <span class="hl-value" class:long={v.length > 9}>{#if leaning(p)}<small>Leaning </small>{/if}{v}</span>
          {#if p.bands.length > 1}
            {@const ch = chart(p)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (the bands are in aria-label) -->
            <div class="spot-chart" role="img" aria-label={ch.bars.map((b) => b.text).join('; ')}
              onpointermove={(e) => e.pointerType === 'mouse' && tipAt(e, c.key, ch.bars.length, true)}
              onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
              onclick={(e) => tipAt(e, c.key, ch.bars.length, false)}>
              <div class="cols" style:--zero="{ch.zero}%">
                {#each ch.bars as b (b.label)}
                  <span class="col"
                    ><span class="bar" class:up={b.up} class:pick={b.pick} class:lean={b.pick && p.verdict === 'leaning'} class:pale={!b.solid} class:clip={b.clip}
                      style:top="{b.top}%" style:height="{b.h}%"></span
                    >{#if b.usual}<span class="usual-dot"></span>{/if}</span
                  >
                {/each}
              </div>
              <div class="ends" aria-hidden="true"><span>{ch.bars[0].label}</span><span>{ch.bars.at(-1)!.label}</span></div>
              {#if tip?.key === c.key}
                <div class="cell-tip spot-tip" role="tooltip" style:left="{tip.x}px" style:top="0">{ch.bars[tip.i].text}</div>
              {/if}
            </div>
          {/if}
          <span class="hl-line evidence">{evidence(p)}</span>
          {#if usually(p)}<span class="hl-line usually">{usually(p)}</span>{/if}
          <TileCaption href="#{id}" label={c.name} />
          <div class="mode-tip" id="{id}-full" popover onbeforetoggle={placeTip}>
            {#each full.split('\n') as line, i (i)}{#if i}<br />{/if}{line}{/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  {#if t.topBags.length}
    <section class="chart-panel" data-section="spots-top">
      <HeadingAnchor id="spots-top">Top bags like this</HeadingAnchor>
      <ol class="board-rows top-bags" style:--rows={t.topBags.length} style:--row-h="3rem">
        {#each t.topBags as r, i (r.href ?? r.label)}
          <li class="board-row">
            <span class="rank">{i + 1}</span>
            <span class="who">
              {#if r.href}<a href={r.href}>{r.label}</a>{:else}<span class="name">{r.label}</span>{/if}
              <!-- A twin's tag ("roasted May 5") leads the sub line, so the ellipsis never hides it. -->
              <small>{[r.tag, r.sub, r.usual].filter(Boolean).join(' · ')}</small>
            </span>
            <span class="val">{r.score.toFixed(2)}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
{/if}

<style>
  /* The picker: one wrapping row of labelled selects, Ratings and Reset on the same baseline. */
  .spot-picker {
    align-items: end;
  }
  .spot-picker .form-field {
    margin-bottom: 0;
  }
  .spot-picker select {
    max-width: 16rem;
  }
  .spot-picker :global(.tab-group button),
  .reset-picker {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  /* Phones: two even columns; the long Bag select takes a full row (Reset too when the Grinder makes the count even). */
  @media (max-width: 640px) {
    .spot-picker {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .spot-picker select {
      width: 100%;
      max-width: none;
    }
    .bag-field,
    .even .reset-picker {
      grid-column: 1 / -1;
    }
    .spot-picker :global(.tab-group) {
      flex-wrap: nowrap;
    }
    .spot-picker :global(.tab-group button),
    .reset-picker {
      flex: 1;
      min-height: 44px;
      padding-inline: 0.4rem;
    }
  }

  .spots-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .spots-head :global(h2) {
    margin: 0;
  }

  /* Findings card language (Insights.svelte): its row's height token, badge band, value, muted lines, caption. */
  .spot-card {
    height: var(--h);
  }
  .spot-card > * {
    flex-shrink: 0;
  }
  .hl-top {
    align-self: stretch;
    display: flex;
    justify-content: flex-end;
    height: 1.3rem;
    margin: calc(-1 * var(--space-1)) 0 calc(-1 * var(--space-1));
  }
  .hl-top .mode-tip-button {
    line-height: 1;
  }
  .hl-badge.hint {
    background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
    color: var(--color-text-muted);
  }
  /* A long setting (a water recipe, "No clear winner") steps down and wraps inside the card. */
  .spot-card > .hl-value {
    max-width: 100%;
    white-space: normal;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  /* Floors keep the setting the largest text in a narrow phone card (a row of 3 at 360px). */
  .spot-card > .hl-value {
    font-size: max(1.05rem, min(2rem, 15cqw / var(--q, 2)));
  }
  .spot-card > .hl-value.long {
    font-size: max(0.95rem, min(1.6rem, 12cqw / var(--q, 2)));
  }
  .evidence {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
    line-height: 1.3;
  }
  .usually {
    font-size: 0.75rem;
  }
  /* Set from tighten(), so Svelte can't see the attribute: :global keeps the rule. */
  .spot-card:global([data-tight]) .evidence {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
  .spot-card:global(:is([data-tight='2'], [data-tight='3'], [data-tight='4'])) .usually {
    display: none;
  }

  /* The mini chart takes the card's spare height (min 1.5rem), as Findings charts do (ui-rules 34). */
  /* No explicit min-height: its content (columns ≥ 1.5rem + end labels) is the floor, so a card that can't
     hold it overflows and tighten() steps in rather than the labels overlapping the text below. */
  .spot-chart {
    position: relative;
    flex: 1 1 0;
    width: 100%;
    max-width: 16rem;
    display: flex;
    flex-direction: column;
    margin-top: var(--space-1);
    cursor: default;
  }
  .cols {
    flex: 1 1 0;
    min-height: 1.5rem;
    display: flex;
    gap: 2px;
    position: relative;
  }
  /* The zero line: recessive, behind the bars. */
  .cols::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: var(--zero);
    border-top: 1px solid var(--color-border);
  }
  .col {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
  }
  .bar {
    position: absolute;
    left: 12%;
    right: 12%;
    min-height: 2px;
    background: color-mix(in oklab, var(--color-text-muted) 55%, transparent);
    border-radius: 0 0 3px 3px;
  }
  .bar.up {
    border-radius: 3px 3px 0 0;
  }
  .bar.pale {
    background: color-mix(in oklab, var(--color-text-muted) 22%, transparent);
  }
  /* Clipped at the axis edge (a thin band past the solid bands' range): a cap marks the cut end. */
  .bar.clip {
    border-bottom: 2px solid var(--color-text-muted);
  }
  .bar.clip.up {
    border-bottom: 0;
    border-top: 2px solid var(--color-text-muted);
  }
  .bar.pick {
    background: var(--chart-color-1);
  }
  .bar.pick.lean {
    background: color-mix(in oklab, var(--chart-color-1) 60%, transparent);
  }
  /* The usual band: a small dot under its column. */
  .usual-dot {
    position: absolute;
    left: 50%;
    bottom: -5px;
    width: 4px;
    height: 4px;
    translate: -50% 0;
    border-radius: 50%;
    background: var(--color-text);
  }
  .ends {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: 6px;
    font-size: 0.65rem;
    line-height: 1.1;
    color: var(--color-text-muted);
  }
  .ends span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .spot-tip {
    white-space: normal;
    width: max-content;
    max-width: min(16rem, 100vw - 2rem);
    text-align: left;
  }
  .spot-card:global(:is([data-tight='3'], [data-tight='4'])) .ends,
  .spot-card:global([data-tight='4']) .evidence {
    display: none;
  }

  .top-bags {
    margin-top: calc(-1 * var(--space-2));
  }
</style>
