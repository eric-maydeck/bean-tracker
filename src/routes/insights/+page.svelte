<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { formatGrams } from '$lib/grams';
  import { hour12 } from '$lib/hours';
  import {
    PEOPLE, RANGES, RANGE_LABELS, customRange, peopleHelp, insightsParams, isCustom, keepCompare, resetInsights, withDefaults, TABS, WEEKDAYS, periodLabel as periodName, compareLabel as compareName, windowLabel, type Tab, type InsightsUrlState
  } from '$lib/insightsUrl';
  import Leaderboards from './Leaderboards.svelte';
  import Habits from './Habits.svelte';
  import Consumption from './Consumption.svelte';
  import type { Delta } from '$lib/server/insights/overview';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let s = $derived(withDefaults(data.explicit));

  // The Custom range dialog; its draft is `draft` below.
  let rangeDialog: HTMLDialogElement | undefined = $state();

  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.scrollPaddingTop = `${barHeight}px`;
    return () => document.documentElement.style.removeProperty('scroll-padding-top');
  });

  // The server computes every tile from the URL, so a toggle is a navigation.
  function choose(change: InsightsUrlState) {
    const next = { ...data.explicit, ...change };
    // A compare the new range doesn't offer would be dropped by the parser.
    // A new custom Period has no menu yet: keep what could apply and let the parser drop what doesn't fit.
    const menu = change.range ? data.compareMenus[change.range] : undefined;
    if (change.range) next.compare = keepCompare(next.compare, menu ? menu.flatMap((g) => g.options.map((o) => o.value)) : ['1', 'before']);
    // A by the new range doesn't offer is dropped, like the compare.
    if (menu && next.by && !data.byMenus[change.range!].includes(next.by)) next.by = undefined;
    const qs = insightsParams(next).toString();
    goto(qs ? `?${qs}` : location.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Click-for-explanation triggers also open on mouse hover (mouse only: touch and keyboard keep
  // click/Enter). The hover opens it, so a mouse click must not toggle it shut again.
  const tipOf = (e: Event) => {
    const b = (e.target as Element | null)?.closest?.('.mode-tip-button');
    // A popover trigger names its tip with popovertarget; a dialog trigger (Score) with data-tip.
    return b && matchMedia('(hover: hover)').matches ? document.getElementById(b.getAttribute('popovertarget') ?? b.getAttribute('data-tip') ?? '') : null;
  };
  // The tip a hover opened: a click on its button must leave it open, not toggle it shut.
  let hoverTip: HTMLElement | null = null;
  function tipOver(e: PointerEvent) {
    const tip = e.pointerType === 'mouse' && tipOf(e);
    if (!tip || tip.matches(':popover-open')) return;
    tip.showPopover();
    hoverTip = tip;
  }
  function tipOut(e: PointerEvent) {
    const tip = e.pointerType === 'mouse' && tipOf(e);
    const to = e.relatedTarget as Element | null;
    if (tip && !(to && (e.target as Element).closest('.mode-tip-button')!.contains(to))) {
      tip.hidePopover();
      hoverTip = null;
    }
  }
  function tipClick(e: MouseEvent) {
    const tip = tipOf(e);
    if (!tip) return;
    // A dialog trigger opens its dialog: the hover tip steps aside. A popover trigger keeps the tip
    // the hover opened (unless Escape or a click elsewhere already closed it: then the click reopens it).
    if ((e.target as Element).closest('[data-tip]')) tip.hidePopover();
    else if (tip === hoverTip && tip.matches(':popover-open')) e.preventDefault();
  }

  // Reset: every toggle and dropdown back to default (bare URL), keeping only a non-default tab.
  function reset() {
    draft = null;
    const qs = insightsParams(resetInsights(data.explicit)).toString();
    goto(qs ? `?${qs}` : location.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Custom range draft: the From/To being edited, not yet applied. Never in the URL
  // (like inline edit). null = no draft; the form then shows the applied range, if any.
  // One dialog serves both controls: `target` is the one that opened it.
  let draft = $state<{ from: string; to: string } | null>(null);
  let target = $state<'range' | 'compare'>('compare');
  let shown = $derived.by(() => {
    if (draft) return draft;
    const v = target === 'range' ? s.range : s.compare;
    if (!isCustom(v)) return null;
    const [from, to] = v.split('..');
    return { from, to };
  });
  const custom = (t: 'range' | 'compare') => ((!!draft && target === t) || isCustom(t === 'range' ? s.range : s.compare));
  function openDates(t: 'range' | 'compare') {
    target = t;
    rangeDialog?.showModal();
  }
  function pickRange(v: string) {
    if (v === 'custom') {
      target = 'range';
      draft = { from: data.periodDefault.start, to: data.periodDefault.end };
      rangeDialog?.showModal();
      return;
    }
    draft = null;
    choose({ range: v });
  }

  // Custom range… opens a draft on the prefill; anything else drops the draft and applies.
  function pickCompare(v: string) {
    if (v === 'custom') {
      target = 'compare';
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
    choose(target === 'range' ? { range: c } : { compare: c });
    rangeDialog?.close();
  }

  const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', leaderboards: 'Leaderboards', habits: 'Habits', consumption: 'Consumption' };
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
  // Chart legends name the series for the Period / Compare dropdown labels.
  let periodLabel = $derived(periodName(s.range, data.period, data.today));
  let compareLabel = $derived(
    compareName(s.compare, data.compareMenus[s.range].flatMap((g) => g.options), data.previousPeriod, data.today)
  );
  // The compare window's dates for a tooltip, unless its label already is the dates (custom).
  let compareDates = $derived(data.previousPeriod && !isCustom(s.compare) ? windowLabel(data.previousPeriod, data.today) : '');
  const span = (p: { start: string | null; end: string }) => (p.start ? `${day(p.start)} – ${day(p.end)}` : 'All time');

  type Key = string; // tile keys span four data shapes
  type D = Delta;
  // `fmt` formats a value and its change; `suffix` is a unit set small after
  // the value where the full word wouldn't fit the tile ("12 days").
  // `up`: whether a rise is good or bad, for the delta's colour; unset = by direction (up green).
  // `sub`: a line under the value where there's no delta (Time to clear's date).
  type Tile = {
    key: Key; label: string; fmt: (n: number) => string; suffix?: string; ratingSwitch?: boolean;
    up?: 'good' | 'bad'; split?: true; sub?: () => string | null; keepSub?: true;
    was?: () => string | null; // a neutral line in the delta slot ("was Thu")
    stack?: () => { head: string; tail: string; said: string } | null; // two-line "vs Oct 4:" / "3 brews · 48g" there
    from?: () => string | null; // a ratio tile's previous count ("31 days"): the delta reads "from 31 days (100%)"
  };
  const shortDay = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const TOTALS: Tile[] = [
    { key: 'brews', split: true, label: 'Brews', fmt: count, up: 'good' },
    { key: 'grams', split: true, label: 'Grams', fmt: formatGrams },
    { key: 'spend', split: true, label: 'Spend', fmt: usdCompact.format, up: 'bad' },
    { key: 'bagsFinished', split: true, label: 'Bags finished', fmt: count, up: 'good' },
    { key: 'rated', split: true, label: 'Rated', fmt: count, ratingSwitch: true, up: 'good' }
  ];
  const AVERAGES: Tile[] = [
    { key: 'avgRating', label: 'Avg rating', fmt: (n) => n.toFixed(1), ratingSwitch: true, up: 'good' },
    { key: 'costPerBrew', label: 'Cost per brew', fmt: usd.format, up: 'bad' },
    { key: 'brewsPerDay', split: true, label: 'Brews per day', fmt: (n) => n.toFixed(1), up: 'good' },
    { key: 'avgDose', label: 'Avg dose', fmt: (n) => `${n.toFixed(1)}g` },
    { key: 'avgRestDays', label: 'Avg rest', fmt: (n) => String(Math.round(n)), suffix: 'days' },
    { key: 'avgBrewTime', label: 'Avg brew time', fmt: mss }
  ];
  const CONSUMPTION: Tile[] = [
    { key: 'perDay', label: 'Per day', fmt: formatGrams, split: true },
    { key: 'perWeek', label: 'Per week', fmt: formatGrams, split: true },
    { key: 'perMonth', label: 'Per month', fmt: formatGrams, split: true },
    {
      key: 'daysToClear', label: 'Time to clear', fmt: (n) => n.toLocaleString('en-US'), suffix: 'days', split: true,
      sub: () => (data.consumption.clearBy ? `by ${shortDay(data.consumption.clearBy)}` : null)
    }
  ];
  const RIGHT_NOW: Tile[] = [
    { key: 'openedG', label: 'Opened (left)', fmt: formatGrams },
    { key: 'unopenedG', label: 'Unopened', fmt: formatGrams },
    { key: 'onHandG', label: 'On hand', fmt: formatGrams },
    { key: 'finishedG', label: 'Finished', fmt: formatGrams, split: true },
    { key: 'opened', label: 'Bags opened', fmt: count },
    { key: 'unopened', label: 'Bags unopened', fmt: count },
    { key: 'onHand', label: 'Bags on hand', fmt: count },
    { key: 'finished', label: 'Bags finished', fmt: count, split: true, up: 'good' }
  ];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  let HABITS = $derived<Tile[]>(
    data.habits
      ? [
          { key: 'activeDays', label: 'Active days', fmt: pct, up: 'good',
            // Under a compare the delta's second line (the pace slot) says the previous count; the "N of M days" sub waits for no compare.
            from: () => (data.habits!.prevActive ? `${data.habits!.prevActive.brewDays} day${data.habits!.prevActive.brewDays === 1 ? '' : 's'}` : null),
            sub: () => `${data.habits!.tiles.brewDays} of ${data.habits!.tiles.trackedDays} days` },
          { key: 'currentStreak', label: data.habits.streakAtEnd ? 'Streak at period end' : 'Current streak', fmt: count, suffix: 'days' },
          {
            key: 'longestStreak', label: 'Longest streak', fmt: count, suffix: 'days', up: 'good', keepSub: true,
            sub: () => (data.habits!.longestFrom ? `${shortDay(data.habits!.longestFrom)} – ${shortDay(data.habits!.longestTo!)}` : null)
          },
          { key: 'brewsPerBrewDay', label: 'Per brew day', fmt: (n) => n.toFixed(1), split: true },
          { key: 'peakHour', label: 'Peak hour', fmt: hour12, sub: () => (data.habits!.prevPeak?.hour != null ? `was ${hour12(data.habits!.prevPeak.hour)}` : null) },
          {
            key: 'busiestWeekday', label: 'Busiest weekday', fmt: (n) => WEEKDAYS[n],
            // Comparing puts "was Thu" on the delta line; this stays the same short form.
            was: () => (data.habits!.prevPeak?.weekday != null ? `was ${WEEKDAYS[data.habits!.prevPeak.weekday]}` : null),
            keepSub: true,
            sub: () => {
              const h = data.habits!;
              if (h.busiestAvg === null || h.tiles.busiestWeekday === null) return null;
              const a = h.busiestAvg;
              return s.measure === 'grams' ? `${formatGrams(a)} avg`
                : s.measure === 'rating' ? `${a.toFixed(1)} avg rating`
                : `${Number.isInteger(a) ? a : a.toFixed(1)} brews avg`;
            }
          }
        ]
      : []
  );
  // Busiest day: the tile's value is the date as epoch days; the year shows when it isn't this year.
  const busyDate = (d: string) => (d.slice(0, 4) === data.today.slice(0, 4) ? shortDay(d) : day(d));
  const busyDay = (n: number) => busyDate(new Date(n * 864e5).toISOString().slice(0, 10));
  const brewsText = (n: number) => `${n} brew${n === 1 ? '' : 's'}`;
  const signed = (f: (n: number) => string) => (n: number) => (n < 0 ? '−' : '') + f(Math.abs(n));
  let consumptionValues = $derived({
    ...data.consumptionTab?.tiles,
    busiest: data.consumptionTab?.busiest ? Date.parse(data.consumptionTab.busiest.date) / 864e5 : null
  });
  let FLOW = $derived<Tile[]>(
    data.consumptionTab
      ? (() => {
          const g = s.unit === 'grams';
          const avg = s.agg === 'average';
          // Per-day rates of bags are small fractions: two decimals.
          const f = g ? formatGrams : avg ? (n: number) => n.toFixed(2) : count;
          return [
            { key: 'brewed', label: g ? 'Brewed' + (avg ? '/day' : '') : avg ? 'Finished/day' : 'Bags finished', fmt: f, split: true },
            { key: 'bought', label: g ? 'Bought' + (avg ? '/day' : '') : avg ? 'Bought/day' : 'Bags bought', fmt: f, split: true },
            { key: 'net', label: avg ? 'Net/day' : 'Net change', fmt: signed(f), split: true },
            avg
              ? {
                  key: 'busiest', label: 'Busiest day', fmt: (n: number) => busyDay(n),
                  // Comparing puts "vs Oct 4:" over "3 brews · 48g" in the delta slot; this period's stay beneath.
                  stack: () => {
                    const p = data.consumptionTab!.prevBusiest;
                    return p
                      ? { head: `vs ${busyDate(p.date)}:`, tail: `${brewsText(p.brews)} · ${formatGrams(p.grams)}`,
                          said: `Busiest day in the comparison period: ${busyDate(p.date)}, ${brewsText(p.brews)}, ${formatGrams(p.grams)}` }
                      : null;
                  },
                  keepSub: true,
                  sub: () => {
                    const b = data.consumptionTab!.busiest;
                    return b ? `${brewsText(b.brews)} · ${formatGrams(b.grams)}` : null;
                  }
                }
              : { key: 'avg', label: `Avg per ${data.consumptionTab!.by}`, fmt: g ? formatGrams : (n: number) => n.toFixed(1), split: true },
            { key: 'onHand', label: g ? 'On hand' : 'Bags on hand', fmt: g ? formatGrams : count },
            {
              key: 'daysToClear', label: 'Days to clear', fmt: count, suffix: 'days', split: true,
              sub: () => (data.consumptionTab!.clearBy ? `by ${shortDay(data.consumptionTab!.clearBy)}` : null)
            }
          ];
        })()
      : []
  );
  // One explanation per ratings mode, shared by the switches (hover title,
  // aria-describedby) and the caption's tap-to-open popover.
  let RATINGS_HELP = $derived({
    current: `Rated brews since ${day(data.settledFrom)}, once the scale settled.`,
    all: 'Every rated brew, including earlier ones.'
  });
  // People switch help (ui-rules 27): hover title + aria-describedby; the caption suffix's popover.
  let PEOPLE_HELP = $derived(peopleHelp(data.householdSize));
  let perPersonOn = $derived(s.people === 'person');
  // A popover sits in the top layer; put it under its caption button (above
  // when there's no room below). Its CSS clamps it inside the viewport.
  // ponytail: fixed position, so it stays put if the page scrolls while open.
  function placeTip(e: ToggleEvent) {
    if (e.newState !== 'open') return;
    const tip = e.currentTarget as HTMLElement;
    const r = document.querySelector(`[popovertarget="${tip.id}"], [data-tip="${tip.id}"]`)!.getBoundingClientRect();
    const below = r.bottom + 96 < innerHeight;
    tip.style.setProperty('--x', `${r.left + r.width / 2}px`);
    tip.style.setProperty('--y', `${below ? r.bottom : r.top}px`);
    tip.toggleAttribute('data-above', !below);
  }

  // Paced or per-person totals are fractional: a count under 10 keeps one decimal, so a small
  // value doesn't read "0" or round 6.5 to "7". Money and grams keep their own formats.
  const paced = (t: Tile) =>
    (data.scaled || perPersonOn) && t.split && t.fmt === count ? (n: number) => (Math.abs(n) < 10 ? n.toFixed(1) : count(n)) : t.fmt;
  const valueText = (t: Tile, v: number | null) => (v === null ? '—' : (perPersonOn ? paced(t) : t.fmt)(v));

  // The previous value as the line says it: "112g", or for a ratio of a count "31 days (100%)".
  const was = (d: NonNullable<D>, t: Tile) => (t.from?.() ? `${t.from()} (${paced(t)(d.base)})` : paced(t)(d.base));
  // Unscaled: "▼ 19g from 112g". A pace-scaled base isn't the other window's own value, so those
  // keep the change and its %, with "vs X at that pace" on the pace line.
  function deltaText(d: NonNullable<D>, t: Tile): string {
    const fmt = paced(t);
    // A change that formats as zero (float noise, or under the tile's precision) is none.
    if (fmt(Math.abs(d.abs)) === fmt(0)) return 'No change';
    const arrow = d.abs > 0 ? '▲' : '▼';
    // The tile's unit suffix ("days") stays out of the line: it's on the value above and in the title.
    return d.paced ? `${arrow} ${fmt(Math.abs(d.abs))} (${Math.abs(d.pct).toFixed(0)}%)` : `${arrow} ${fmt(Math.abs(d.abs))} from ${was(d, t)}`;
  }
  // Full sentence for the title and screen readers (the % lives here for unscaled tiles).
  function deltaTitle(d: NonNullable<D>, t: Tile): string {
    const fmt = paced(t);
    if (fmt(Math.abs(d.abs)) === fmt(0)) return 'No change';
    const unit = t.suffix ? ` ${fmt(d.base) === '1' ? t.suffix.replace(/s$/, '') : t.suffix}` : '';
    const dir = `${d.abs > 0 ? 'Up' : 'Down'} ${Math.abs(d.pct).toFixed(0)}%`;
    // A ratio tile's visible line is the change in points: "Down 3 points from 100% (31 days)".
    if (t.from?.() && !d.paced) {
      const pts = Math.round(Math.abs(d.abs) * 100);
      return `${d.abs > 0 ? 'Up' : 'Down'} ${pts} point${pts === 1 ? '' : 's'} from ${paced(t)(d.base)} (${t.from()}) (${compareLabel})`;
    }
    return d.paced ? `${dir} vs ${fmt(d.base)}${unit} at that pace` : `${dir} from ${t.from?.() ? was(d, t) : fmt(d.base) + unit} (${compareLabel})`;
  }
  const paceText = (d: NonNullable<D>, t: Tile) => (d.paced ? `vs ${paced(t)(d.base)} at that pace` : '');
  // Green when the change is the good way for this tile, red when bad; tiles with no good
  // direction go by direction (up green, down red); no change stays grey.
  function trend(d: { abs: number }, t: Tile): string {
    const fmt = paced(t);
    if (fmt(Math.abs(d.abs)) === fmt(0)) return '';
    return (d.abs > 0) === (t.up !== 'bad') ? 'trend-good' : 'trend-bad';
  }
  let periodText = $derived(
    [span(data.period), data.previousPeriod && `vs ${span(data.previousPeriod)}`, 'Mountain Time'].filter(Boolean).join(' · ')
  );
</script>

<svelte:document onpointerover={tipOver} onpointerout={tipOut} onclickcapture={tipClick} />

<svelte:head>
  <title>Bean Tracker - Insights</title>
</svelte:head>

<div class="toolbar">
  <h1>Insights</h1>
  <button class="button button-secondary reset" type="button" onclick={reset}>Reset</button>
  <ShareButton />
</div>

<div class="insights-controls filter-bar" bind:offsetHeight={barHeight}>
  <label class="form-field group-field">
    <span>View</span>
    <select class="ctl-select" aria-label="View" value={s.tab} onchange={(e) => choose({ tab: e.currentTarget.value as Tab })}>
      {#each TABS as t (t)}<option value={t}>{TAB_LABEL[t]}</option>{/each}
    </select>
  </label>
  <label class="form-field group-field">
    <span>Period</span>
    <select class="ctl-select" aria-label="Period" value={custom('range') ? 'custom' : s.range} onchange={(e) => pickRange(e.currentTarget.value)}>
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
      <optgroup label="Custom"><option value="custom">{isCustom(s.range) ? span(data.period) : 'Custom range…'}</option></optgroup>
    </select>
  </label>
  {#if isCustom(s.range)}
    <button class="button button-ghost" aria-label="Period dates" onclick={() => openDates('range')}>Dates…</button>
  {/if}
  <label class="form-field group-field">
    <span>Compare</span>
    <select
      class="ctl-select"
      aria-label="Compare"
      value={custom('compare') ? 'custom' : String(s.compare)}
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
    <button class="button button-ghost" aria-label="Compare dates" onclick={() => openDates('compare')}>Dates…</button>
  {/if}
  {#if data.householdSize > 1}
    <div class="form-field group-field people-field">
      <span>People</span>
      <div class="tab-group people-switch" role="group" aria-label="People">
        {#each PEOPLE as m (m)}
          <button
            aria-pressed={s.people === m}
            title={PEOPLE_HELP[m]}
            aria-describedby="people-help-{m}"
            onclick={() => choose({ people: m })}>{m === 'person' ? 'Per person' : 'Household'}</button
          >
        {/each}
      </div>
    </div>
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
          <input class="ctl-select" type="date" name="from" value={shown.from} min={data.dataStart} max={data.today} />
        </label>
        <label class="form-field">
          <span>To</span>
          <input class="ctl-select" type="date" name="to" value={shown.to} min={data.dataStart} max={data.today} />
        </label>
        <footer>
          <button type="button" class="button button-ghost" onclick={() => rangeDialog?.close()}>Cancel</button>
          <button class="button" disabled={!customRange(shown.from, shown.to, data.today)}>Apply</button>
        </footer>
      </form>
    {/if}
  </dialog>

<p class="insights-period">{periodText}</p>
<span id="ratings-help-current" hidden>{RATINGS_HELP.current}</span>
<span id="ratings-help-all" hidden>{RATINGS_HELP.all}</span>
<span id="people-help-household" hidden>{PEOPLE_HELP.household}</span>
<span id="people-help-person" hidden>{PEOPLE_HELP.person}</span>

{#snippet panel(title: string, tiles: Tile[], values: object, deltas: object | null, hero = false)}
  <section class="chart-panel">
    <h2>{title}</h2>
    <div class="stat-row fit n{tiles.length} {deltas ? 'comparing' : ''}">
      {#each tiles as t (t.key)}
        {@const v = (values as Record<string, number | null>)[t.key] ?? null}
        {@const d = (deltas as Record<string, D> | null)?.[t.key]}
        {@const pp = t.split && perPersonOn}
        <div class="stat-item" class:stat-item-accent={hero} class:stack={t.stack?.() && t.sub?.()}>
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
            >{valueText(t, v)}{#if t.suffix && v !== null}<small>{` ${t.suffix}`}</small>{/if}</span
          >
          {#if d}
            <!-- The visible line is for eyes; the sentence (with the %) is for screen readers and hover. -->
            <span class="stat-unit insights-delta {trend(d, t)}" class:ratio={t.from && !d.paced} title={deltaTitle(d, t)}
              ><span aria-hidden="true">{deltaText(d, t)}</span><span class="sr-only">{deltaTitle(d, t)}</span></span
            >
            {#if paceText(d, t)}<span class="insights-pace">{paceText(d, t)}</span>{/if}
          {:else if t.was?.()}
            <span class="stat-unit insights-delta">{t.was()}</span>
          {/if}
          {#if !d && t.stack?.()}
            {@const st = t.stack()!}
            <span class="insights-pace compare" title={st.said}
              ><span aria-hidden="true"><span class="part">{st.head}</span>{' '}<span class="part">{st.tail}</span></span><span class="sr-only">{st.said}</span></span
            >
          {/if}
          <!-- Under a delta (or a "was" line), a kept sub takes the pace line's slot (no keepSub tile is paced). -->
          {#if t.sub?.() && (!d || t.keepSub)}
            <span class={d || t.was?.() ? 'insights-pace' : 'stat-unit'}>{t.sub?.()}</span>
          {/if}
          <div class="stat-caption">
            <span class="stat-label" class:mode-caption={t.ratingSwitch} class:wrap={pp}
              >{t.label}{#if t.ratingSwitch}{' · '}<button class="mode-tip-button" popovertarget="tip-{t.key}" aria-describedby="tip-{t.key}"
                  ><span class="tip-text">{s.ratings === 'all' ? 'All' : 'Current'}</span><Icon name="question" /></button
                >{/if}{#if pp}{' · '}<button class="mode-tip-button" popovertarget="tip-pp-{t.key}" aria-describedby="tip-pp-{t.key}"
                  ><span class="tip-text">per person</span><Icon name="question" /></button
                >{/if}</span
            >
          </div>
          {#if t.ratingSwitch}
            <div class="mode-tip" id="tip-{t.key}" popover onbeforetoggle={placeTip}>{RATINGS_HELP[s.ratings]}</div>
          {/if}
          {#if pp}
            <div class="mode-tip" id="tip-pp-{t.key}" popover onbeforetoggle={placeTip}>{PEOPLE_HELP.person}</div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{/snippet}

{#if data.boards}
  <Leaderboards
    boards={data.boards}
    rank={s.rank}
    ratings={s.ratings}
    avg={s.avg}
    open={s.open}
    comparing={!!data.previousPeriod}
    perPerson={perPersonOn}
    ratingsHelp={RATINGS_HELP}
    {placeTip}
    {choose}
  />
{:else if s.tab === 'habits' && data.habits}
  <Habits h={data.habits} measure={s.measure} ratings={s.ratings} agg={s.agg} comparing={!!data.previousPeriod} {periodLabel} {compareLabel} ratingsHelp={RATINGS_HELP} {choose}>
    {#snippet tiles()}{@render panel('Habits', HABITS, data.habits!.tiles, data.habits!.deltas)}{/snippet}
  </Habits>
{:else if s.tab === 'consumption' && data.consumptionTab}
  <Consumption t={data.consumptionTab} {periodLabel} {compareLabel} {compareDates} unit={s.unit} agg={s.agg} offered={data.byMenus[s.range]} {choose}>
    {#snippet tiles()}{@render panel('Consumption', FLOW, consumptionValues, data.consumptionTab!.deltas)}{/snippet}
  </Consumption>
{:else}
  {@render panel('Totals', TOTALS, data.tiles, data.deltas, true)}
  {@render panel('Averages', AVERAGES, data.tiles, data.deltas)}
  {@render panel('Consumption', CONSUMPTION, data.consumption, data.consumptionDeltas)}
  {@render panel('Right now', RIGHT_NOW, data.rightNow, data.rightNowDeltas)}
{/if}

<style>
  /* Labelled controls, left-packed, one column each on wider screens. */
  .insights-controls {
    display: flex;
    flex-wrap: wrap; /* View + Period + Compare + Dates… + People outgrow 768px */
    align-items: end;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .insights-controls .form-field {
    margin-bottom: 0;
  }
  .people-switch button {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
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
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .people-switch button {
      flex: 1;
      min-height: 44px;
    }
    .range-dialog footer button {
      flex: 1;
    }
    .custom-range button,
    .insights-controls > button {
      min-height: 44px;
    }
    /* Its own full-width row under the selects, not half a row. */
    .insights-controls > button,
    .people-field {
      grid-column: 1 / -1;
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
  /* Every caption with a tip button lets the button's 44px tap area overflow. */
  .stat-caption:has(.mode-tip-button) {
    overflow: visible;
  }
  /* A split tile's caption gets a per-person part (the rating tiles a third part); let it wrap to a second line. */
  .stat-label.wrap.mode-caption {
    letter-spacing: 0; /* Rated · Current ⓘ · per person ⓘ must stay on one line in a 3-up tile */
  }
  .stat-label.wrap {
    white-space: normal;
    line-height: 1.1; /* two lines end flush with the tile; keep them inside */
  }
  :global(.mode-tip-button) {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    /* Match the label's uppercase; buttons don't inherit either by default. */
    text-transform: inherit;
    letter-spacing: inherit;
    cursor: help;
  }
  /* Click-for-explanation triggers: dotted underline on the text, a circled ? after it. */
  :global(.mode-tip-button .tip-text) {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
  }
  :global(.mode-tip-button .icon) {
    width: 0.85em;
    height: 0.85em;
    margin-inline-start: 0.15em;
    vertical-align: -0.1em;
  }
  :global(.mode-tip-button:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  @media (max-width: 640px) {
    :global(.mode-tip-button) {
      min-width: 44px;
      padding: 16px 15px;
      margin: -16px -15px;
    }
  }
  :global(.mode-tip) {
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
  :global(.mode-tip[data-above]) {
    translate: 0 calc(-100% - 0.5rem);
  }

  /* Reset sits beside Share, not mid-row (the toolbar spaces its children apart). */
  .reset {
    margin-left: auto;
  }
  .stat-value small {
    font-size: 0.4em;
    font-weight: 600;
  }
  /* .stat-unit upper-cases; "120G" misreads as a unit. */
  .stat-item .insights-delta {
    text-transform: none;
  }
  /* "▼ 14% from 7 days (100%)" is longer than a phone tile is wide: it wraps to a second line
     (the pace slot below it, free because ratio tiles are never paced), at the usual size. */
  .stat-item .insights-delta.ratio {
    white-space: normal;
    line-height: 1.1;
    overflow: visible;
    text-overflow: clip;
  }
  /* Busiest day, comparing: this period's "N brews · Xg" (the normal sub size) sits under the value;
     the comparison's "vs Oct 4:" / "8 brews · 144g" is the small muted line below it (breaks after the colon). */
  .stat-item .insights-pace.compare {
    top: calc(54.02cqw + max(0.7rem, 6.88cqw) + 1cqw);
    /* One line when it fits, else "vs Oct 4:" over the tail. The box spans the 2-line height and centres
       the text, so the caption below never leaves a gap whichever it is. */
    height: calc(2.2 * max(0.6rem, 5.4cqw) + 1cqw + var(--grow-compare, 0px));
    display: flex;
    flex-direction: column;
    justify-content: center;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    line-height: 1.1;
  }
  .compare .part {
    display: inline-block;
  }
  .stat-item.stack .stat-caption {
    top: calc(54.02cqw + max(0.7rem, 6.88cqw) + 2cqw + 2.2 * max(0.6rem, 5.4cqw) + var(--grow-compare, 0px));
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
     (Totals 5, Averages 3-6 wider; Consumption 4: same columns as Totals); the short last row stretches. */
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
  .fit.n4 .stat-item:last-child {
    --q: 1;
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
    .fit.n4 .stat-item:last-child {
      --q: var(--c);
    }
  }
  @media (min-width: 641px) {
    .fit.n4,
    .fit.n5 {
      --c: 5;
    }
    .fit.n4 .stat-item,
    .fit.n4 .stat-item:last-child {
      --q: 4;
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
  /* Right now: two rows of four; two columns below 520px (4 columns leave two-line captions spilling at ~100px tiles). */
  .fit.n8 {
    --c: 4;
  }
  @container (max-width: 520px) {
    .fit.n8 .stat-item {
      --c: 2;
    }
  }
</style>
