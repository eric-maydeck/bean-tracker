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

  // A card whose text doesn't fit its row's height token tightens (ui-rules 34, as Findings cards do):
  // 1 = evidence to one line, 2 = the Usually line goes too (the card's title and popover keep both).
  // Re-runs on a width change only, so tightening can't loop.
  function tighten(el: HTMLElement, _cards: unknown) {
    let w = -1;
    const run = () => {
      for (const c of el.children as HTMLCollectionOf<HTMLElement>) {
        delete c.dataset.tight;
        for (let t = 1; t <= 2 && c.scrollHeight > c.clientHeight + 1; t++) c.dataset.tight = `${t}`;
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
    if ((e.target as Element).closest('a, button, .mode-tip')) return;
    const ev = c.querySelector('.evidence');
    if (c.dataset.tight === '2' || (ev && ev.scrollHeight > ev.clientHeight + 1)) document.getElementById(`${c.id}-full`)?.togglePopover();
  }
</script>

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
              <small>{[r.sub, r.usual].filter(Boolean).join(' · ')}</small>
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
  /* Spare height splits above the value and above the caption (its margin-top: auto): the content
     block sits mid-card like a stat tile's value, not stacked at the top. */
  .spot-card > .hl-value {
    margin-top: auto;
    max-width: 100%;
    white-space: normal;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  .hl-value.long {
    font-size: min(1.6rem, 12cqw / var(--q, 2));
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
  .spot-card:global([data-tight='2']) .usually {
    display: none;
  }

  .top-bags {
    margin-top: calc(-1 * var(--space-2));
  }
</style>
