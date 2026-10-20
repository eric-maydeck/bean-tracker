<script lang="ts">
  import LikeLine from './LikeLine.svelte';
  import { useEmptyLine } from './coffeeNote';
  import type { InsightsUrlState, InsightsView } from '$lib/insightsUrl';
  import type { LabOptions, Spot, SweetSpotsTab } from '$lib/server/insights/lab';
  import { STRENGTH, STRENGTH_TIP } from './Insights.svelte';
  import { sizedGrid } from './rows';
  import { inkOf, spotAxis } from '$lib/arrowAxis';
  import { noMatch, plural, sdBlur, sdFocus, SD_TIP, STRENGTH_LINE } from './DeltaBars.svelte';
  import SampleNote from '$lib/components/SampleNote.svelte';
  import { sampleField } from '$lib/sample';
  import LabHead from './LabHead.svelte';
  import GrinderSelect from './GrinderSelect.svelte';
  import TileCaption from './TileCaption.svelte';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import { labDelta } from '$lib/components/deltaColor';
  import TipBody, { tipText, type Tip } from '$lib/components/TipBody.svelte';
  import TextTip from '$lib/components/TextTip.svelte';
  import CoffeeName from '$lib/components/CoffeeName.svelte';

  let { t, lab, s, placeTip, choose }: {
    t: SweetSpotsTab; lab: LabOptions; s: InsightsView;
    placeTip: (e: ToggleEvent) => void; choose: (c: InsightsUrlState) => void;
  } = $props();

  // On-hand bags, plus the URL's bag when it's archived (its link still works, so the select shows it).
  let bagOptions = $derived(
    lab.bags.filter((b) => b.onHand || b.slug === s.bag).sort((a, b) => a.label.localeCompare(b.label))
  );
  function pickBag(slug: string) {
    const b = lab.bags.find((x) => x.slug === slug);
    // A bag fills the page-wide Roast level and Process (Coffees panel) from itself; Origin and Roaster stay as set.
    choose(b ? { bag: b.slug, roast: b.roast && lab.roasts.includes(b.roast) ? b.roast : undefined, process: lab.processes.includes(b.process) ? b.process : undefined } : { bag: undefined });
  }
  const emptyLine = useEmptyLine();

  // The card's number (largest): the winner, a lean, an early lead, the tied settings (or a summary of them), the one
  // setting ever used, or not enough data (tier 3).
  const value = (p: Spot) =>
    p.tie ? p.tie.head : p.might ? p.might : p.best && p.verdict !== 'none' ? p.best.label : p.tier === 3 && !p.varied ? p.usual.label : 'Not enough data';
  const leaning = (p: Spot) => !!p.best && p.verdict === 'leaning';
  const nb = (l: string) => l.replace(/(\d) /g, '$1\u00a0'); // "91 °C" never breaks before its unit
  // A tie's gap, rounded up so "within 0.2" is never short of the widest gap.
  const within = (p: Spot) => `${(Math.ceil(p.tie!.within * 10 - 1e-9) / 10).toFixed(1)}`;
  const tied = (p: Spot) => p.bands.filter((b) => p.tie!.labels.includes(b.label)).sort((a, b) => p.tie!.labels.indexOf(a.label) - p.tie!.labels.indexOf(b.label));
  // A tier-1 card's shown deltas' SEs: its line, tips and chart share one decimal count.
  const ses = (p: Spot) => p.bands.filter((b) => b.value !== null).map((b) => b.se);
  // The evidence behind it, one muted line (clamped; the card's title and popover have it in full).
  function evidence(p: Spot): string {
    if (p.tie) return `${p.tie.labels.map(nb).join(', ')}: within ${within(p)}${p.tie.proven ? '' : ' so far'} · ${plural(p.bags, 'bag')}`;
    if (p.tier === 1 && p.best) return `${labDelta(p.best.value, ses(p))} vs same bag · ${plural(p.bags, 'bag')}`;
    if (p.tier === 2 && p.best && p.next)
      return `Across ${p.group}: ${nb(p.best.label)} ${p.best.value.toFixed(1)} vs ${nb(p.next.label)} ${p.next.value.toFixed(1)} · ${plural(p.bags, 'bag')}`;
    return p.varied ? '' : `No comparison yet: always ${p.usual.label} (avg ${p.usual.mean.toFixed(1)})`;
  }
  // The card's line, short (user, 2026-10-17): its label, the numbers behind it in `tip`. A same-bag winner leads with
  // its delta (`delta`, outside the tip text so it keeps its ink). null: a plain line (evidence), nothing to tip.
  function result(p: Spot): { label: string; tip: Tip; delta?: string; result: boolean } | null {
    if (p.tie) {
      // The line below the headline: the tied settings when the headline only summarizes them, else how close they are.
      // Its tip: each tied setting's number (at most 4 rows, ui-rules 36), best first.
      const title = `${p.tie.labels.length} in the running (within ${within(p)})`, one = p.tier === 1;
      const rows: Tip['rows'] = tied(p).slice(0, 4).map((b) => [b.label, one ? labDelta(b.value!, ses(p)) : b.value!.toFixed(1)]);
      return { label: p.tie.list ? nb(p.tie.list) : `All within ${within(p)}${p.tie.proven ? '' : ' so far'}`, result: true,
        tip: { title, rows, note: `${plural(p.bags, 'bag')} behind ${nb(p.best!.label)}. ${p.tie.proven ? 'No badge: close enough that the choice hardly matters.' : 'Looks close, but too few bags to be sure.'}` } };
    }
    if (p.tier === 1 && p.best) {
      const d = labDelta(p.best.value, ses(p)), rows: Tip['rows'] = [['vs same bag', d, inkOf(d)], ['Bags', `${p.bags}`]];
      return { label: 'vs same bag', delta: d, tip: { title: p.best.label, rows }, result: true };
    }
    if (p.tier === 2 && p.best && p.next) {
      const title = `Highest across ${p.group}`;
      return { label: `${title}: ${nb(p.best.label)} (${p.best.value.toFixed(1)})`, result: true,
        // One row per compared setting, best first: its bags, then its average (4 rows at most, ui-rules 36).
        tip: { title, rows: p.bands.filter((b) => b.solid && b.value !== null).sort((a, b) => b.value! - a.value!).slice(0, 4).map((b) => [b.label, `${plural(b.bags, 'bag')} · ${b.value!.toFixed(1)}`]) } };
    }
    if (p.tier === 3 && !p.varied)
      return { label: 'No comparison yet', result: false, tip: { title: 'No comparison yet', rows: [['Always', p.usual.label], ['Avg', p.usual.mean.toFixed(1)]] } };
    return null;
  }
  // The thin standout band's line (under the solid minimum, so its bar is pale): what the chart shows, hedged.
  // One line (nowrap, ellipsis); a tightened card hides it and its value's tip has it whole.
  const thin = (p: Spot) => (p.thin ? `${nb(p.thin.label)} looks higher · ${plural(p.thin.bags, 'bag')}` : null);
  // Why a tier-3 card has no comparison: its counts against the bar (a solid setting = 3+ bags and 30+ brews).
  const NOUN: Record<string, string> = { temp: 'temps', water: 'waters', dripper: 'drippers', filter: 'filters', ratio: 'ratios', dose: 'doses', grind: 'grind settings', bloom: 'bloom times', rest: 'rest times' };
  const whyNot = (p: Spot, key: string): Tip => {
    const n = p.bands.filter((b) => b.brews).length, ok = p.bands.filter((b) => b.solid).length;
    return { title: 'Not enough data', lines: [`${ok} of ${n} ${NOUN[key]} you've brewed ${ok === 1 ? 'has' : 'have'} enough to compare (3+ bags, 30+ brews). Needs 2.`] };
  };
  const usually = (p: Spot) => (p.tier === 3 && !p.varied ? null : `Usually: ${p.usual.label}`);
  const badge = (p: Spot) => (p.verdict === 'early' || (p.tie && !p.tie.proven) ? 'early' : p.best?.strength === 'solid' || p.best?.strength === 'hint' ? p.best.strength : null);

  let sized = $derived(sizedGrid(t.cards, () => false));

  // The card's mini chart: every band of the evidence it used, zero-centred. Tier 1 bars are same-bag
  // deltas; tier 2/3 bars are bag means less their bag-weighted average, so above/below reads the same
  // way. Winner (or lean) in the accent, other solid bands neutral, small bands striped; the usual band dotted.
  // A no-match band (grind, value null) keeps its column with a dotted mark at 0, so the axis runs from the
  // lowest setting brewed to the highest (S-grind).
  function chart(p: Spot) {
    const n = p.bands.reduce((a, b) => a + (b.value === null ? 0 : b.bags), 0) || 1;
    const center = p.tier === 1 ? 0 : p.bands.reduce((a, b) => a + (b.value ?? 0) * b.bags, 0) / n;
    const ds = p.bands.map((b) => (b.value === null ? 0 : b.value - center));
    // The axis fits the solid bands when there are any: a thin band past it is clipped at the edge with a cap
    // (its value stays in the tip), so thin data shows without dominating.
    const fit = p.bands.some((b) => b.solid) ? ds.filter((_, i) => p.bands[i].solid) : ds;
    const { hi, span, shown, clip, sh } = spotAxis(ds, fit);
    const picks = p.tie ? p.tie.labels : p.best && p.verdict !== 'none' ? [p.best.label] : [];
    return {
      zero: (hi / span) * 100,
      bars: p.bands.map((b, i) => ({
        ...b, top: ((hi - Math.max(0, shown[i])) / span) * 100, h: (Math.abs(shown[i]) / span) * 100, up: ds[i] >= 0, clip: clip[i], sh: sh[i],
        pick: picks.includes(b.label), usual: b.label === p.usual.label, none: b.value === null && b.brews > 0, empty: !b.brews,
        // The chart names only its end bands, so the tip leads with the band and its value (ui-rules 36).
        tip: (!b.brews
          ? { title: b.range ?? b.label, note: 'No brews in this band.' }
          : b.value === null
          ? { title: b.range ?? b.label, rows: [['Bags', `${b.bags}`], ['Brews', `${b.brews}`]], note: noMatch('grind setting') }
          : {
              title: b.range ?? b.label, // a grind band's label is its first setting; the tip gives its range
              rows: [p.tier === 1 ? ['vs same bag', labDelta(b.value, ses(p)), inkOf(labDelta(b.value, ses(p)))] : ['Avg (bag means)', b.value.toFixed(1)], ...(b.sample.small ? [] : [['Bags', `${b.bags}`], ['Brews', `${b.brews}`]])],
              ...sampleField(b.sample, p.tier === 1),
              note: b.label === p.usual.label ? 'Your usual setting.' : undefined
            }) as Tip
      }))
    };
  }
  // Its tip (FloatTip, over the band's column): mouse hover, or a tap on touch; one open at a time.
  // A tap toggles; a mouse click on a tip its hover opened keeps it open.
  let tip = $state<{ key: string; i: number; el: Element; hover: boolean } | null>(null);
  // New data (a picker change) drops any open tip: its band index may not exist any more.
  $effect(() => {
    void t;
    tip = null;
  });
  // Show band i's tip over its column.
  function showTip(wrap: HTMLElement, key: string, i: number, hover: boolean) {
    const el = wrap.querySelectorAll('.col')[i];
    tip = el ? { key, i, el, hover } : null;
  }
  // Only a band's mark (its bar, the usual dot) or an end label (the first or last band) opens its tip, never the
  // column's empty space above or below the bar (ui-rules 50).
  function tipFrom(e: MouseEvent | PointerEvent, key: string, n: number, hover: boolean) {
    const wrap = e.currentTarget as HTMLElement, el = e.target as Element;
    const col = el.closest('.bar, .usual-dot')?.closest('.col');
    const end = el.closest('.ends span');
    const i = col ? [...wrap.querySelectorAll('.col')].indexOf(col) : end ? (end.previousElementSibling ? n - 1 : 0) : -1;
    if (i < 0) return void (tip?.key === key && (hover ? tip.hover : true) && (tip = null));
    if (!hover && tip?.key === key && tip.i === i && !tip.hover) return (tip = null);
    showTip(wrap, key, i, hover);
  }
  // Keyboard (as Heatmap's cells): focus opens the winning (else usual) band's tip, ←/→ move it, Escape
  // closes it, Enter opens the card's full text (its evidence line, even when the card hid it to fit).
  const startAt = (bars: { pick: boolean; usual: boolean }[]) => {
    const p = bars.findIndex((b) => b.pick);
    return p >= 0 ? p : Math.max(0, bars.findIndex((b) => b.usual));
  };
  function chartKey(e: KeyboardEvent, key: string, bars: { pick: boolean; usual: boolean }[]) {
    const wrap = e.currentTarget as HTMLElement, n = bars.length;
    if (e.key === 'Escape') tip = null;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // The first press with no tip open shows the start band rather than stepping past it.
      const i = tip?.key === key ? Math.min(n - 1, Math.max(0, tip.i + (e.key === 'ArrowRight' ? 1 : -1))) : startAt(bars);
      showTip(wrap, key, i, false);
    }
  }

  // A card whose text doesn't fit its row's height token tightens (ui-rules 34, as Findings cards do):
  // 1 = evidence to one line, 2 = the Usually line goes too, 3 = the chart's end labels go (its tip and aria-label
  // name every band), 4 = the evidence line goes (phone rows: the chart still shows its shape). A tightened card's
  // value opens its full text as a text tip (`tight`), so a cut or hidden line is never lost (user, 2026-10-18: no
  // card-level popover).
  // Re-runs on a width change only, so tightening can't loop.
  let tight = $state<Record<string, number>>({});
  function tighten(el: HTMLElement, _cards: unknown) {
    let w = -1;
    const run = () => {
      const next: Record<string, number> = {};
      for (const c of el.children as HTMLCollectionOf<HTMLElement>) {
        delete c.dataset.tight;
        for (let t = 1; t <= 4 && c.scrollHeight > c.clientHeight + 1; t++) c.dataset.tight = `${t}`;
        if (c.dataset.tight) next[c.id] = +c.dataset.tight;
      }
      tight = next;
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
</script>

<!-- A tap outside a chart closes its tip. -->
<svelte:document onclick={(e) => tip && !(e.target as Element).closest?.('.spot-chart') && (tip = null)} />

<div class="insights-bar spot-picker">
  <label class="form-field group-field">
    <span>Bag</span>
    <select class="ctl-select" aria-label="Bag" value={s.bag ?? ''} onchange={(e) => pickBag(e.currentTarget.value)}>
      <option value="">Any</option>
      {#each bagOptions as b (b.slug)}<option value={b.slug}>{b.label}</option>{/each}
    </select>
  </label>
  <GrinderSelect grinders={lab.grinders} grinder={s.grinder} {choose} />
</div>

{#if !t.matching.brews}
  <section class="chart-panel">
    <p class="hl-empty">{emptyLine('No rated brews in this period.')}</p>
  </section>
{:else}
  <p class="insights-period">Matching: {plural(t.matching.bags, 'bag')}, {plural(t.matching.brews, 'brew')}</p>

  <section class="chart-panel" data-section="spots-cards">
    <LabHead id="spots-cards" title="Sweet spots" {placeTip}
      help={['For each setting, the band your ratings favor for coffees like this.', 'First choice: the same bag brewed both ways.',
        "+0.4: beat the same bag's other brews by 0.4.", "Too few of those: bag averages across similar coffees, widening the group until there's enough.", STRENGTH_LINE,
        'Early: ahead or looking tied, but too few bags to call.']} />
    <div class="hl-grid finding-grid spot-grid" use:tighten={sized}>
      {#each sized as { item: c, style } (c.key)}
        {@const p = c.spot}
        {@const id = `spot-${c.key}`}
        {@const v = value(p)}
        {@const say = `${leaning(p) ? 'Leaning ' : ''}${v}`}<!-- "Leaning 20+ g": one phrase, one size (gate P4) -->
        {@const b = badge(p)}
        {@const r = result(p)}
        {@const full = v === 'Not enough data' ? whyNot(p, c.key) : { title: `${c.name}: ${leaning(p) ? 'Leaning ' : ''}${v}`, lines: [evidence(p), thin(p), usually(p)].filter((x): x is string => !!x) }}
        <div class="hl-card spot-card" {id} {style}>
          <div class="hl-top">
            {#if b}
              <button class="mode-tip-button" popovertarget="{id}-badge" aria-describedby="{id}-badge"
                ><span class="badge hl-badge" class:hint={b === 'hint'} class:early={b === 'early'}>{STRENGTH[b]}</span></button
              >
              <div class="mode-tip" id="{id}-badge" popover onbeforetoggle={placeTip}><TipBody tip={STRENGTH_TIP[b]} /></div>
            {/if}
          </div>
          <span class="hl-value" class:long={say.length > 9}>{#if tight[id] || v === 'Not enough data'}<TextTip label={say} tip={full} />{:else}{say}{/if}</span>
          {#if p.bands.length > 1}
            {@const ch = chart(p)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (focusable for its band tips; the bands are in aria-label, the card's full text in its description) -->
            <div class="spot-chart" role="img" tabindex="0" aria-label={ch.bars.map((b) => tipText(b.tip)).join('; ')} aria-describedby="{id}-full"
              onfocus={(e) => e.currentTarget.matches(':focus-visible') && showTip(e.currentTarget, c.key, startAt(ch.bars), false)}
              onblur={() => (tip = null)}
              onkeydown={(e) => chartKey(e, c.key, ch.bars)}
              onpointermove={(e) => e.pointerType === 'mouse' && tipFrom(e, c.key, ch.bars.length, true)}
              onpointerleave={(e) => e.pointerType === 'mouse' && (tip = null)}
              onclick={(e) => tipFrom(e, c.key, ch.bars.length, false)}>
              <div class="cols" style:--zero="{ch.zero}%">
                {#each ch.bars as b (b.label)}
                  <span class="col"
                    ><span class="bar" class:up={b.up} class:pick={b.pick} class:lean={b.pick && p.verdict !== 'win'} class:small-sample-mark={b.sample.small} class:clip={b.clip} class:none={b.none} class:empty={b.empty}
                      style:top="{b.top}%" style:height="{b.h}%" style:--sh="{b.sh}%"></span
                    >{#if b.usual}<span class="usual-dot"></span>{/if}</span
                  >
                {/each}
              </div>
              <div class="ends" aria-hidden="true"><span>{ch.bars[0].label}</span><span>{ch.bars.at(-1)!.label}</span></div>
              {#if tip?.key === c.key}
                {#if ch.bars[tip.i]}<FloatTip anchor={tip.el} onclose={() => (tip = null)}><TipBody tip={ch.bars[tip.i].tip} /></FloatTip>{/if}
              {/if}
            </div>
          {/if}
          <!-- The result line, one line at any width: a short phrase, its numbers in a tip on it (user, 2026-10-17), so it never wraps and squeezes the chart above. A result (a same-bag delta, a group's
               highest) is in the standout ink; a same-bag delta number keeps its green or red (T4). -->
          {#if r || evidence(p)}<span class="hl-line evidence" class:result={!!r?.result}>{#if r}{#if r.delta}<TextTip label="{r.delta} {r.label}" tip={r.tip}>{#snippet children()}<span class={inkOf(r.delta!)}>{r.delta}</span>{' '}{r.label}{/snippet}</TextTip>{:else}<TextTip label={r.label} tip={r.tip} />{/if}{:else}{evidence(p)}{/if}</span>{/if}
          {#if thin(p)}<span class="hl-line thin">{thin(p)}</span>{/if}
          {#if usually(p)}<span class="hl-line usually">{usually(p)}</span>{/if}
          <TileCaption href="#{id}" label={c.name} />
          <span id="{id}-full" hidden>{tipText(full)}</span>
        </div>
      {/each}
    </div>
  </section>

  {#if t.topBags.length}
    <section class="chart-panel" data-section="spots-top">
      <LabHead id="spots-top" title="Top bags like this" {placeTip}
        help={['The bags matching these filters with the best ratings.', "Score: each bag's average pulled toward the matching brews' average by 5 brews, so one great brew doesn't top.",
          'SD: how much its ratings vary.', '', 'Small: consistent.', 'Big: hit or miss.', 'Under each: its roaster, then usual temp · water · dripper.']} />
      <!-- Numbers in aligned columns under one header (G4): brews · SD · score; the sub line is context only. -->
      <div class="board-row top-head"><span></span><span>Bag</span><span class="num">Brews</span><span class="num"
        ><button class="mode-tip-button" popovertarget="spots-top-sd" aria-describedby="spots-top-sd" onfocus={sdFocus} onblur={sdBlur}><span class="tip-text">SD</span></button></span
      ><span class="num">Score</span></div>
      <div class="mode-tip" id="spots-top-sd" popover onbeforetoggle={placeTip}><TipBody tip={SD_TIP} /></div>
      <ol class="board-rows top-bags" style:--rows={t.topBags.length} style:--row-h="3rem">
        {#each t.topBags as r, i (i)}
          <li class="board-row" class:liked={r.like} class:small-sample={r.sample.small}>
            <span class="rank">{i + 1}</span>
            <span class="who">
              {#if r.href}<a href={r.href}><CoffeeName text={r.label} /></a>{:else}<span class="name"><CoffeeName text={r.label} /></span>{/if}

              <!-- A twin's tag ("roasted May 5") leads the sub line, so the ellipsis never hides it. -->
              <span class="who-line"><small>{[r.tag, r.sub, r.usual].filter(Boolean).join(' · ')}</small>{#if r.sample.small}<SampleNote s={r.sample} />{/if}</span>
              {#if r.like}<LikeLine like={r.like} />{/if}
            </span>
            <span class="num">{r.brews}</span>
            <span class="num">{r.sd?.toFixed(2) ?? '—'}</span>
            <span class="val">{r.score.toFixed(1)}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
{/if}

<style>
  /* The picker: Bag (and Grinder) as labeled selects on one baseline; the Coffees fields live in the bar's panel. */
  .spot-picker {
    align-items: end;
  }
  .spot-picker .form-field {
    margin-bottom: 0;
  }
  .spot-picker select {
    max-width: 16rem;
  }
  /* Phones: Bag (and Grinder) each take a full row. */
  @media (max-width: 640px) {
    .spot-picker {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }
    .spot-picker select {
      width: 100%;
      max-width: none;
    }
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
  /* A long setting (a water recipe, "Not enough data") steps down and wraps inside the card. */
  .spot-card > .hl-value {
    max-width: 100%;
    white-space: normal;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  /* A short setting ("V60") in a tightened card is a text tip: pad its tap target out to 44px wide (rule 4). */
  .spot-card > .hl-value :global(.text-tip) {
    padding-inline: 4px;
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
  /* A tipped line ("Highest across ...", a tie's list) is one line at any width: a long answer (a recipe name) ends in an ellipsis, and the tip's
     title has it whole (the card's overflow already clips the text's tap padding to the line). */
  .evidence:has(:global(.text-tip)) {
    display: block;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* A result line, and any "Not enough data" card's line, stands out from the muted lines (accent ink on the card's
     --color-bg: 5.45:1 light, 7.4:1 dark), so no card is all gray (user, 2026-10-17). */
  .evidence.result {
    color: var(--color-accent);
  }
  .zero {
    color: var(--color-text-muted);
  }
  /* On a hovered tile (accent-tinted) the shared green and red fall just under 4.5:1 at this size: a touch of ink in them. */
  .evidence :global(.ink-better) {
    color: color-mix(in srgb, var(--div-high-ink) 85%, var(--color-text));
  }
  .evidence :global(.ink-worse) {
    color: color-mix(in srgb, var(--div-low-ink) 85%, var(--color-text));
  }
  .usually,
  .thin {
    font-size: 0.75rem;
  }
  .thin {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Set from tighten(), so Svelte can't see the attribute: :global keeps the rule. */
  .spot-card:global([data-tight]) .evidence {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
  .spot-card:global(:is([data-tight='3'], [data-tight='4'])) .thin {
    display: none;
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
    background-color: color-mix(in oklab, var(--color-text-muted) 55%, transparent);
    border-radius: 0 0 3px 3px;
  }
  .bar.up {
    border-radius: 3px 3px 0 0;
  }
  /* A thin bar's hit area reaches 4px past each end, so a near-zero band is still easy to point at. */
  .bar::after {
    content: '';
    position: absolute;
    inset: -4px 0;
  }
  .bar,
  .usual-dot,
  .ends span {
    cursor: help; /* the band's tip (ui-rules 50); the column's empty space keeps the arrow */
  }
  /* No match (grind brewed there, never paired): a dotted mark on the zero line keeps the setting in range. */
  .bar.none {
    top: var(--zero) !important; /* over the inline top */
    min-height: 0;
    background: none;
    border-top: 2px dotted var(--color-text-muted);
  }
  /* No brews (a step inside the grind range): the column stays, with no mark. */
  .bar.empty {
    display: none;
  }
  /* Clipped at the axis edge (a thin band past the solid bands' range): the cut end is an arrow tip, "keeps going". */
  .bar.clip {
    border-radius: 0;
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--sh)), 50% 100%, 0 calc(100% - var(--sh)));
  }
  .bar.clip.up {
    clip-path: polygon(0 var(--sh), 50% 0, 100% var(--sh), 100% 100%, 0 100%);
    background-position: left 0 top var(--sh), 0 0; /* a small bar's fold sits below the arrow taper */
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
  .spot-chart:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: var(--radius);
  }
  .spot-card:global(:is([data-tight='3'], [data-tight='4'])) .ends,
  .spot-card:global([data-tight='4']) .evidence {
    display: none;
  }

  .top-head,
  .top-bags .board-row {
    grid-template-columns: 1.75rem minmax(0, 1fr) 2.75rem 2.75rem 3rem;
  }
  .top-head {
    height: auto;
    margin-top: calc(-1 * var(--space-2));
    padding-bottom: var(--space-1);
    border-top: 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }
  .top-bags > .board-row:first-child {
    border-top: 0;
  }
  .num,
  .top-bags .val {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .top-bags .num {
    font-size: 0.85rem;
  }
</style>
