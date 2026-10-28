<script lang="ts">
  import WholeNote from './WholeNote.svelte';
  import { labelTip } from '$lib/components/labelTip';
  import { setting, plainText } from '$lib/settingName';
  import Usd from '$lib/components/Usd.svelte';
  import { usd } from '$lib/money';
  import TextTip from '$lib/components/TextTip.svelte';
  import { afterNavigate, beforeNavigate, goto, replaceState } from '$app/navigation';
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { INSIGHTS_STORAGE_KEY, loadInsightsState, serializeInsightsState, withoutDeepLinks } from '$lib/insightsMemory';
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { placeTip } from '$lib/components/modeTip';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import { formatGrams } from '$lib/grams';
  import { plural } from '$lib/linkPreview';
  import { hour12 } from '$lib/hours';
  import {
    PEOPLE, RANGES, RANGE_LABELS, withPageWide, customRange, peopleHelp, insightsParams, isCustom, keepCompare, resetInsights, withDefaults, TAB_GROUPS, LAB_TABS, WEEKDAYS, periodLabel as periodName, compareLabel as compareName, windowLabel, type Tab, type InsightsUrlState, DIAL_HELP, DIAL_LABEL, RATINGS_LABEL, coffeeNote, ratingsMenuOn, hiddenNote, phoneWords, type Caffeine, BREW_FILTER_KEYS, BREW_FILTERS_ON, brewSelectsOn, BREW_FILTER_LABEL, brewFilterText, type BrewFilterKey
  } from '$lib/insightsUrl';
  import { provideCoffeeNote } from './coffeeNote';
  import { provideChartLink, insightsPreview } from './chartLink';
  import PreviewMeta from '$lib/components/PreviewMeta.svelte';
  import { page } from '$app/state';
  import { ownerName } from '$lib/linkPreview';
  import HeadingAnchor from './HeadingAnchor.svelte';
  import GrinderSelect from './GrinderSelect.svelte';
  import KindsBar from './KindsBar.svelte';
  import RatingsSwitch from './RatingsSwitch.svelte';
  import { packSpans } from './rows';
  import Leaderboards, { jumpLinks as boardsLinks } from './Leaderboards.svelte';
  import Habits, { jumpLinks as habitsLinks } from './Habits.svelte';
  import Consumption, { jumpLinks as consumptionLinks } from './Consumption.svelte';
  import Records, { jumpLinks as recordsLinks } from './Records.svelte';
  import Milestones from './Milestones.svelte';
  import Insights, { jumpLinks as insightsLinks } from './Insights.svelte';
  import SweetSpots from './SweetSpots.svelte';
  import Brewing, { jumpLinks as brewingLinks } from './Brewing.svelte';
  import Pours, { jumpLinks as poursLinks } from './Pours.svelte';
  import Water, { jumpLinks as waterLinks } from './Water.svelte';
  import Gear, { jumpLinks as gearLinks } from './Gear.svelte';
  import Spend, { jumpLinks as spendLinks } from './Spend.svelte';
  import OnHand, { jumpLinks as onHandLinks } from './OnHand.svelte';
  import RunwayChart from './RunwayChart.svelte';
  import CapItem from '$lib/components/CapItem.svelte';
  import type { Snippet } from 'svelte';
  import Recent from './Recent.svelte';
  import CollapsibleBar from '$lib/components/CollapsibleBar.svelte';
  import JumpNav, { type JumpLink } from './JumpNav.svelte';
  import type { Delta } from '$lib/server/insights/overview';
  import type { PageData } from './$types';
  import { toParams, type StatusTab } from '$lib/coffeeViewState';

  let { data }: { data: PageData } = $props();
  // Show all and the Over time / expand switches change nothing the server computes, so they are applied here and written
  // to the URL with replaceState: no refetch, no re-render of the other tiles. `local` holds them until the next real
  // navigation, whose data already includes them (afterNavigate clears it). Everything below reads `explicit`.
  const LOCAL_KEYS = ['open', 'views', 'card', 'chart', 'retired', 'gear', 'spendView', 'spendSeries', 'rcSort', 'rcDir', 'rcTop', 'waitBy', 'recipeBy', 'pourThin', 'recipeVs'] as const;
  let local = $state<Pick<InsightsUrlState, (typeof LOCAL_KEYS)[number]> | null>(null);
  const explicit = $derived(local ? { ...data.explicit, ...local } : data.explicit);
  let s = $derived(withDefaults(explicit));
  provideCoffeeNote(() => coffeeNote(s));
  provideChartLink({
    href: (id) => `?${insightsParams({ ...explicit, chart: id })}#${id}`,
    go: (id) => void choose({ chart: id }).then(() => document.getElementById(id)?.scrollIntoView())
  });

  // The Coffees panel (spec Part 3): the page-wide filter; each set field is a chip under the bar.
  let coffeesDialog: HTMLDialogElement | undefined = $state();
  // The small label above the Filters button, like the bar's other controls (the user's pick; one place to change).
  const FILTERS_LABEL = 'Show';
  const COFFEE_FIELDS = $derived([
    ['roast', 'Roast level', data.coffeeOptions.roasts], ['process', 'Process', data.coffeeOptions.processes],
    ['origin', 'Origin', data.coffeeOptions.origins], ['roaster', 'Roaster', data.coffeeOptions.roasters]
  ] as const);
  // Caffeine's chip shows only when explicit (absent = Caffeinated, the default).
  const CAFFEINE_CHIP: Record<Caffeine, string> = { decaf: 'Decaf', all: 'Caf + decaf' };
  let coffeeChips = $derived([
    ...COFFEE_FIELDS.flatMap(([k]) => (s[k] ? [[k, s[k]!] as const] : [])),
    ...(s.caffeine ? [['caffeine', CAFFEINE_CHIP[s.caffeine]] as const] : [])
  ]);

  // Brew filters: one select each, on the tabs that use them (BREW_FILTERS_ON); a chip for every one set, any tab.
  const BREW_OPTIONS = $derived({
    dripper: data.brewOptions.drippers, filter: data.brewOptions.filters, water: data.brewOptions.waters,
    brewDose: data.brewOptions.doses, brewTemp: data.brewOptions.temps
  });
  const brewSelects = $derived(brewSelectsOn(s.tab).filter((k) => BREW_OPTIONS[k].length));
  const brewChips = $derived(BREW_FILTER_KEYS.filter((k) => s[k]));
  // Gear's Grinder pick (a slug, not a BrewFilterKey: Brewing's own grinder select shares the param) lives in this dialog too.
  const gearGrinder = $derived(s.tab === 'gear' && s.grinder ? (data.lab?.grinders.find((g) => g.slug === s.grinder)?.name ?? s.grinder) : undefined);
  const badgeCount = $derived(coffeeChips.length + brewChips.filter((k) => brewSelectsOn(s.tab).includes(k)).length + (gearGrinder ? 1 : 0));
  const brewOff = Object.fromEntries(BREW_FILTER_KEYS.map((k) => [k, undefined]));

  // The Custom range dialog; its draft is `draft` below.
  let rangeDialog: HTMLDialogElement | undefined = $state();

  let barHeight = $state(0);

  // The server computes every tile from the URL, so a toggle is a navigation.
  function choose(change: InsightsUrlState) {
    // Keep the scroll position through the swap: the content can collapse while the new data loads.
    const y = scrollY;
    const keep = () => { if (!change.tab && !change.chart) scrollTo(0, y); };
    const next = { ...explicit, ...change };
    // Any change that does not itself set chart (filters, rank, views, tab, Reset) drops it; a heading click sets it again.
    if (!('chart' in change)) next.chart = undefined;
    // The hash follows chart: a new chart's id, none when a tab switch or the dropped chart's own id (a reload would scroll back to it).
    const hash = change.chart ? `#${change.chart}` : change.tab || (!('chart' in change) && location.hash === `#${explicit.chart}`) ? '' : location.hash;
    // Only open / views / card / chart / retired / gear, and every Over time board already has its series: nothing to fetch.
    if (Object.keys(change).every((k) => (LOCAL_KEYS as readonly string[]).includes(k)) && Object.keys(next.views ?? {}).every((b) => data.boardSeries?.[b])) {
      local = Object.fromEntries(LOCAL_KEYS.map((k) => [k, next[k]]));
      const qs = insightsParams(next).toString();
      replaceState(`${qs ? `?${qs}` : location.pathname}${hash}`, {});
      remember(qs);
      return Promise.resolve();
    }
    // A compare the new range doesn't offer would be dropped by the parser.
    // A new custom Period has no menu yet: keep what could apply and let the parser drop what doesn't fit.
    const menu = change.range ? data.compareMenus[change.range] : undefined;
    if (change.range) next.compare = keepCompare(next.compare, menu ? menu.flatMap((g) => g.options.map((o) => o.value)) : ['1', 'before']);
    // A by the new range doesn't offer is dropped, like the compare.
    if (menu && next.by && !data.byMenus[change.range!].includes(next.by)) next.by = undefined;
    const qs = insightsParams(next).toString();
    return goto(`${qs ? `?${qs}` : location.pathname}${hash}`, { replaceState: true, noScroll: true, keepFocus: true }).then(keep);
  }

  // Remembered view state (spec Part 3): a fresh entry to a bare /insights restores the saved query into the URL
  // (Share keeps working). Any in-page navigation saves its own state, and a bare one removes it (bare is the
  // state), so a link with params wins and becomes the remembered state.
  function remember(qs: string) {
    qs = withoutDeepLinks(qs);
    try {
      if (qs) localStorage.setItem(INSIGHTS_STORAGE_KEY, serializeInsightsState(qs, Date.now()));
      else localStorage.removeItem(INSIGHTS_STORAGE_KEY);
    } catch {
      // localStorage unavailable (private window): the page works, it just isn't remembered.
    }
  }
  // A tab keeps the scroll you left it at. Tab links keep the scroll (noscroll), so a shorter tab in between clamped it and
  // coming back landed higher ("scrolled up a little"); every tab switch, link or choose(), routes through here.
  const tabOf = (u: URL | undefined) => u?.searchParams.get('tab') ?? 'overview';
  const scrollOf = new Map<string, number>();
  beforeNavigate(({ from, to }) => {
    if (from && to && from.url.pathname === to.url.pathname && tabOf(from.url) !== tabOf(to.url)) scrollOf.set(tabOf(from.url), scrollY);
  });
  afterNavigate(({ from, to, type }) => {
    // (a back/forward step: SvelteKit restores the scroll itself)
    const back = type !== 'popstate' && from && to && from.url.pathname === to.url.pathname && tabOf(from.url) !== tabOf(to.url) ? scrollOf.get(tabOf(to.url)) : undefined;
    if (back !== undefined) void tick().then(() => scrollTo(0, back));
    local = null;
    const qs = insightsParams(data.explicit).toString();
    try {
      if (!qs && !location.search && (!from || from.url.pathname !== location.pathname)) {
        const saved = loadInsightsState(localStorage.getItem(INSIGHTS_STORAGE_KEY), Date.now());
        if (saved) return void goto(`?${saved}${location.hash}`, { replaceState: true, noScroll: true, keepFocus: true });
      }
    } catch {
      // localStorage unavailable (private window): the page works, it just isn't remembered.
    }
    remember(qs);
  });

  // Reset: a hard reset of the filters (spec Part 3): every param but a non-default tab; the remembered state is
  // cleared, then afterNavigate saves the tab-only query (or nothing, on Overview).
  function reset() {
    draft = null;
    try { localStorage.removeItem(INSIGHTS_STORAGE_KEY); } catch { /* nothing remembered to clear */ }
    const qs = insightsParams(resetInsights(explicit)).toString();
    goto(`${qs ? `?${qs}` : location.pathname}${location.hash}`, { replaceState: true, noScroll: true, keepFocus: true });
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

  const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', leaderboards: 'Leaderboards', habits: 'Habits', consumption: 'Consumption', records: 'Records', milestones: 'Milestones', insights: 'Insights', onhand: 'On hand', spend: 'Spend', sweetspots: 'Sweet spots', brewing: 'Brewing', pours: 'Pours', water: 'Water', gear: 'Gear' };
  // A rail link: the same URL choose({ tab }) builds (filters kept, old #anchor dropped).
  function tabHref(tab: Tab) {
    const qs = insightsParams({ ...explicit, tab }).toString();
    return qs ? `?${qs}` : '/insights';
  }
  const ROLLING = RANGES.filter((r) => r !== 'ytd' && r !== 'all');
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

  // Finding, leaderboard and Right now links keep the page's Period, Ratings, Caffeine and Coffees filter.
  const link = (href: string) => withPageWide(href, explicit, data.coffeeFilters);
  // Right now tiles: a link to the /coffees list the number counts.
  const SEE: Partial<Record<string, { status: StatusTab[]; label: string }>> = {
    openedG: { status: ['open'], label: 'See coffees' }, opened: { status: ['open'], label: 'See coffees' },
    unopenedG: { status: ['backlog'], label: 'See coffees' }, unopened: { status: ['backlog'], label: 'See coffees' },
    onHandG: { status: ['backlog', 'open'], label: 'See coffees' }, onHand: { status: ['backlog', 'open'], label: 'See coffees' },
    finishedG: { status: ['archive'], label: 'See all finished coffees' }, finished: { status: ['archive'], label: 'See all finished coffees' }
  };
  type Key = string; // tile keys span four data shapes
  type D = Delta;
  // `fmt` formats a value and its change; `suffix` is a unit set small after
  // the value where the full word wouldn't fit the tile ("12 days").
  // `up`: whether a rise is good or bad, for the delta's color; unset = by direction (up green).
  // `sub`: a line under the value where there's no delta (Time to clear's date).
  type Tile = {
    key: Key; label: string; fmt: (n: number) => string; suffix?: string; ratingSwitch?: boolean;
    up?: 'good' | 'bad'; split?: true; sub?: () => string | null; keepSub?: true;
    was?: () => string | null; // a neutral line in the delta slot ("was Thu")
    stack?: () => { head: string; tail: string; said: string } | null; // two-line "vs Oct 4:" / "3 brews · 48g" there
    from?: () => string | null; // a ratio tile's previous count ("31 days"): the delta reads "from 31 days (100%)"
    help?: string; // an explanation in a caption ? popover
    row?: string; // tiles sharing a row name sit in their own labelled row (the runway's two paces)
  };
  // A stat tile's own anchor, its caption links to it: avgRating on Overview → #overview-avg-rating.
  const panelId = (title: string) => `${s.tab}-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const tileId = (key: string) => `${s.tab}-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
  const shortDay = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const TOTALS: Tile[] = [
    { key: 'brews', split: true, label: 'Brews', fmt: count, up: 'good' },
    { key: 'grams', split: true, label: 'Grams', fmt: formatGrams },
    { key: 'spend', split: true, label: 'Spend', fmt: usd, up: 'bad' },
    { key: 'bagsFinished', split: true, label: 'Bags finished', fmt: count, up: 'good' },
    { key: 'rated', split: true, label: 'Rated', fmt: count, ratingSwitch: true, up: 'good' }
  ];
  const AVERAGES: Tile[] = [
    { key: 'avgRating', label: 'Avg rating', fmt: (n) => n.toFixed(1), ratingSwitch: true, up: 'good' },
    { key: 'costPerBrew', label: 'Cost per brew', fmt: usd, up: 'bad' },
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
  let SPEND = $derived<Tile[]>([
    { key: 'spent', split: true, label: 'Spent', fmt: usd, up: 'bad',
      help: 'Counted by roast date: bags bought in the Period, at their listed price; subscription bags at plan price ÷ bags.' },
    { key: 'bags', label: 'Bags bought', fmt: count },
    { key: 'avgPpg', label: 'Avg $/g', fmt: (n) => `${usd(n)}/g`, up: 'bad', keepSub: true,
      sub: () => { const f = data.spend?.free ?? 0; return f ? `${f} free bag${f === 1 ? '' : 's'} not in $/g` : null; } },
    { key: 'avgBagCost', label: 'Avg bag cost', fmt: usd, up: 'bad' },
    { key: 'avgBagSize', label: 'Avg bag size', fmt: formatGrams },
    { key: 'newRoasters', label: 'New roasters', fmt: count, up: 'good' },
    { key: 'subShare', label: 'Subscription share', fmt: pct },
    { key: 'plansPerMonth', split: true, label: 'Plans per month', fmt: usd, sub: () => 'this month' }
  ]);
  // On hand: grams and dollars divide per person, bag counts never do (bags are shared in the household).
  let ONHAND = $derived<Tile[]>([
    { key: 'bagsWaiting', label: 'Bags waiting', fmt: count },
    { key: 'gramsWaiting', split: true, label: 'Grams waiting', fmt: formatGrams },
    { key: 'tiedUp', split: true, label: '$ tied up', fmt: usd },
    { key: 'avgAge', label: 'Avg age', fmt: count, suffix: 'days', help: 'Counted by roast date, minus days in the freezer.' },
    // The count is the household's bags (never divided); only the grams under it divide, and its line says so.
    { key: 'frozenBags', label: 'In the freezer', fmt: count, sub: () => (data.onHand ? `${formatGrams(data.onHand.tiles.frozenGrams)}${perPersonOn ? ' per person' : ''}` : null) },
    { key: 'avgBagCost', label: 'Avg bag cost', fmt: usd }
  ]);
  // Runway: the days left at the Period's pace and at the all-time pace (one tile when the Period is all time).
  // "last 12 months pace"; a custom window's dates stay as they are.
  const paceName = $derived(s.range === 'all' || /^[A-Z][a-z]{2} \d/.test(periodLabel) ? periodLabel : periodLabel.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()));
  // Per pace: days left, the run-out date (the value is the days; its format is the date) and the daily grams.
  const outDate = (n: number) => shortDay(new Date(Date.parse(`${data.today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10));
  const paceTiles = (k: 'pace' | 'all', name: string): Tile[] => [
    { key: `${k}Days`, row: name, split: true, label: 'Days left', fmt: count, suffix: 'days' },
    { key: `${k}Out`, row: name, split: true, label: 'Runs out', fmt: outDate },
    { key: `${k}PerDay`, row: name, split: true, label: 'A day', fmt: formatGrams }
  ];
  let RUNWAY = $derived<Tile[]>([...(s.range === 'all' ? [] : paceTiles('pace', `At your ${paceName} pace`)), ...paceTiles('all', 'At your all-time pace')]);
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
          const avg = s.agg !== 'total';
          const per = s.agg === 'brewday' ? '/brew day' : '/day';
          // Per-day rates of bags are small fractions: two decimals.
          const f = g ? formatGrams : avg ? (n: number) => n.toFixed(2) : count;
          return [
            { key: 'brewed', label: g ? 'Brewed' + (avg ? per : '') : avg ? 'Finished' + per : 'Bags finished', fmt: f, split: true },
            { key: 'bought', label: g ? 'Bought' + (avg ? per : '') : avg ? 'Bought' + per : 'Bags bought', fmt: f, split: true },
            { key: 'net', label: avg ? 'Net' + per : 'Net change', fmt: signed(f), split: true },
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
    current: `${setting('Calibrated ratings')} leaves out ratings before ${new Date(`${data.settledFrom}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, while the rating scale was still settling.`,
    all: 'Every rated brew, including earlier ones.'
  });
  // People switch help (ui-rules 27): hover title + aria-describedby; the caption suffix's popover.
  const labTab = $derived((LAB_TABS as readonly string[]).includes(s.tab));
  let ratingsMenu = $derived(ratingsMenuOn(s));
  // Tabs where it applies to some modes only keep it in the bar, greyed out with the reason, so switching modes never
  // resizes the bar and moves the page (user, 2026-10-23).
  const MENU_OFF: Partial<Record<Tab, string>> = {
    consumption: 'Applies when the Measure is Rating', habits: 'Applies when the Measure is Rating',
    leaderboards: 'Applies when ranking by Rating or vs like coffees'
  };
  let menuOff = $derived(ratingsMenu ? undefined : MENU_OFF[s.tab]);
  // The tab's own controls row: Leaderboards, Habits, Consumption, Milestones, Sweet spots, and Brewing with 2+ grinders.
  let tabBarOn = $derived(
    !!(data.boards || (s.tab === 'habits' && data.habits) || (s.tab === 'consumption' && data.consumptionTab) || (s.tab === 'milestones' && data.milestones) ||
      (s.tab === 'sweetspots' && data.sweetSpots) || (s.tab === 'brewing' && data.brewing && (data.lab?.grinders.length ?? 0) > 1))
  );
  // Phones (≤480): the narrow Period and Compare selects read "Last 12 mo." instead of clipping "Last 12 months".
  // The data-short attribute lets app.html's first-paint script show the short text before hydration.
  const phone = new MediaQuery('max-width: 480px');
  const phoneText = (long: string) => (phone.current ? phoneWords(long) : long);
  // The bar's phone grid (gate r2 A3): 3 cells per row up to 480px, 2 up to 640px; packSpans widens controls so every
  // row is full. The menu takes two cells at 3 per row (its label is long); People always two; Dates… a cell, or a row at 2.
  // Compare shows on every tab but the lab and On hand (a snapshot of the shelf has nothing to compare).
  const noCompare = $derived(labTab || s.tab === 'onhand');
  const peopleOn = $derived(data.householdSize > 1 && s.tab !== 'milestones' && !labTab);
  const barCells = (cols: 2 | 3) => packSpans([
    ['view', 1], ['period', 1], ...(isCustom(s.range) ? [['range-dates', 4 - cols]] : []),
    ...(noCompare ? [] : [['compare', 1], ...(isCustom(s.compare) ? [['compare-dates', 4 - cols]] : [])]),
    ...(ratingsMenu || menuOff ? [['menu', cols - 1]] : []), ['filters', 1], ...(peopleOn ? [['people', 2]] : [])
  ] as [string, number][], cols);
  let span2 = $derived(barCells(2));
  let span3 = $derived(barCells(3));
  const cell = (k: string) => `--s2:${span2[k]};--s3:${span3[k]}`;
  let PEOPLE_HELP = $derived(peopleHelp(data.householdSize));
  let perPersonOn = $derived(s.people === 'person');
  // The brew filters in play on this tab: panels of whole-bag figures say they don't apply (wholeNote).
  const wholeKeys = $derived(Object.keys(data.brewFilters) as BrewFilterKey[]);
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
  // direction go by direction (up green, down red); no change stays gray.
  function trend(d: { abs: number }, t: Tile): string {
    const fmt = paced(t);
    if (fmt(Math.abs(d.abs)) === fmt(0)) return '';
    return (d.abs > 0) === (t.up !== 'bad') ? 'trend-good' : 'trend-bad';
  }
  let periodText = $derived(
    [span(data.period), data.previousPeriod && `vs ${span(data.previousPeriod)}`, 'Mountain Time'].filter(Boolean).join(' · ')
  );
  // The Jump to chips: each tab's own jumpLinks, in the tab's own branch order (the overview is the fallthrough).
  const jump = $derived.by((): JumpLink[] => {
    if (data.boards) return boardsLinks(data.boards, data.boardsCut, s.rank);
    if (s.tab === 'habits' && data.habits) return habitsLinks(data.habits);
    if (s.tab === 'consumption' && data.consumptionTab) return consumptionLinks(data.consumptionTab, s.trend);
    if (s.tab === 'sweetspots' && data.sweetSpots && data.lab) return [];
    if (s.tab === 'records' && data.records) return recordsLinks(data.records, s.brewer);
    if (s.tab === 'milestones' && data.milestones) return [];
    if (s.tab === 'insights' && data.insights) return insightsLinks(data.insights);
    if (s.tab === 'brewing' && data.brewing && data.lab) return brewingLinks(data.brewing);
    if (s.tab === 'pours') return poursLinks(data.pours);
    if (s.tab === 'water' && data.water) return waterLinks(data.water);
    if (s.tab === 'gear' && data.gear) return gearLinks(data.gear, data.trophies);
    if (s.tab === 'onhand' && data.onHand) return onHandLinks(data.onHand);
    if (s.tab === 'spend' && data.spend) return spendLinks(data.spend);
    return [['overview-totals', 'Totals'], ['overview-averages', 'Averages'], ['overview-consumption', 'Consumption'], ['overview-right-now', 'Right now'], data.recent && ['overview-recent', 'Recent']];
  });
</script>


<svelte:head>
  <title>Bean Tracker - Insights</title>
</svelte:head>
<PreviewMeta
  preview={insightsPreview({
    tab: s.tab, owner: ownerName(page.url.host), tabLabel: TAB_LABEL[s.tab], period: periodLabel, brews: data.tiles.brews, avgRating: data.tiles.avgRating,
    filters: [...coffeeChips.map(([, v]) => v), ...brewChips.map((k) => brewFilterText(k, s[k]!))],
    chart: s.chart, rank: s.rank, perPerson: perPersonOn, boards: data.boards, records: data.records,
    line: data.onHand ? `${plural(data.onHand.tiles.bagsWaiting, 'bag')} waiting · ${formatGrams(data.onHand.tiles.gramsWaiting)} · ${usd(data.onHand.tiles.tiedUp)} tied up` : !data.spend ? undefined : `Spent ${usd(data.spend.tiles.spent)} · ${plural(data.spend.tiles.bags, 'bag')}${data.spend.tiles.avgPpg === null ? '' : ` · ${usd(data.spend.tiles.avgPpg)}/g avg`}`
  })}
/>

<!-- Wide screens: a side rail of every view beside the whole page (the View dropdown stays). The links
     navigate like choose({ tab }): replace the entry, keep the scroll and focus. -->
<div class="rail-layout">
<nav class="insights-rail" aria-label="Insights sections">
  {#each TAB_GROUPS as g (g.label)}
    <div class="rail-group" role="group" aria-labelledby="rail-{g.label}">
      <span class="rail-caption" id="rail-{g.label}">{g.label}</span>
      {#each g.tabs as t (t)}
        <a
          href={tabHref(t)}
          aria-current={s.tab === t ? 'page' : undefined}
          data-sveltekit-replacestate
          data-sveltekit-noscroll
          data-sveltekit-keepfocus>{TAB_LABEL[t]}</a
        >
      {/each}
    </div>
  {/each}
</nav>
<div class="rail-main">
<CollapsibleBar desktopPinned={barHeight}>
{#snippet children()}
<div class="toolbar">
  <h1>Insights</h1>
  <button class="button button-secondary reset" type="button" onclick={reset}>Reset</button>
  <ShareButton />
</div>

<div class="insights-controls filter-bar" bind:offsetHeight={barHeight}>
  <label class="form-field group-field" style={cell('view')}>
    <span>View</span>
    <select class="ctl-select" aria-label="View" value={s.tab} onchange={(e) => choose({ tab: e.currentTarget.value as Tab })}>
      {#each TAB_GROUPS as g (g.label)}
        <optgroup label={g.label}>{#each g.tabs as t (t)}<option value={t}>{TAB_LABEL[t]}</option>{/each}</optgroup>
      {/each}
    </select>
  </label>
  <label class="form-field group-field" style={cell('period')}>
    <span>Period</span>
    <select class="ctl-select" aria-label="Period" value={custom('range') ? 'custom' : s.range} onchange={(e) => pickRange(e.currentTarget.value)}>
      <optgroup label="Rolling">
        {#each ROLLING as r (r)}<option value={r} data-short={phoneWords(RANGE_LABELS[r])}>{phoneText(RANGE_LABELS[r])}</option>{/each}
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
    <button class="button button-ghost" style={cell('range-dates')} aria-label="Period dates" onclick={() => openDates('range')}>Dates…</button>
  {/if}
  {#if !noCompare}
  <label class="form-field group-field" style={cell('compare')}>
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
          {#each g.options as o (o.value)}<option value={o.value} data-short={phoneWords(o.label)}>{phoneText(o.label)}</option>{/each}
        </optgroup>
      {/each}
      <optgroup label="Custom"><option value="custom">Custom range…</option></optgroup>
    </select>
  </label>
  {#if isCustom(s.compare)}
    <button class="button button-ghost" style={cell('compare-dates')} aria-label="Compare dates" onclick={() => openDates('compare')}>Dates…</button>
  {/if}
  {/if}
  <!-- Ratings and Brews, one menu for the tabs where they change most of the page (ui-rules 26/30), in the modes where they apply. -->
  {#if ratingsMenu || menuOff}
    <div style={cell('menu')}><RatingsSwitch menu off={menuOff} ratings={s.ratings} dial={s.dial} ratingsHelp={RATINGS_HELP} {choose} /></div>
  {/if}
  <div class="form-field group-field filters-field" style={cell('filters')}>
    <span>{FILTERS_LABEL}</span>
    <button class="button button-secondary filters-button" type="button" aria-haspopup="dialog"
      onclick={() => coffeesDialog?.showModal()}
      >Filters{#if badgeCount}<span class="badge">{badgeCount}</span>{/if}</button
    >
  </div>
  <!-- Milestones and the lab tabs are household-level: no People switch there. -->
  {#if peopleOn}
    <div class="form-field group-field people-field" style={cell('people')}>
      <span>People</span>
      <div class="tab-group people-switch" role="group" aria-label="People">
        {#each PEOPLE as m (m)}
          <button
            aria-pressed={s.people === m}
            use:labelTip={{ title: m === 'person' ? 'Per person' : 'Household', lines: [PEOPLE_HELP[m]] }}
            aria-describedby="people-help-{m}"
            onclick={() => choose({ people: m })}>{m === 'person' ? 'Per person' : 'Household'}</button
          >
        {/each}
      </div>
    </div>
  {/if}
  <!-- The active tab's own controls, a row of the bar so they float with it; rendered here (not by the tab) so they are in the server HTML. -->
  {#if tabBarOn}
    <div class="tab-controls">
      {#if s.tab === 'milestones'}<KindsBar kinds={s.kinds} {choose} />
      {:else if s.tab === 'brewing'}<div class="insights-bar"><GrinderSelect grinders={data.lab!.grinders} grinder={s.grinder} {choose} /></div>
      {:else}{@render tab('bar')}{/if}
    </div>
  {/if}
  <!-- The chips: the bar's last row (they stay in view while scrolling), one line that scrolls sideways, Clear all at its end. Sweet spots' Bag set Roast and Process, so dropping either (or Clear all) drops the Bag too. -->
  {#if coffeeChips.length || brewChips.length || gearGrinder}
    <div class="filter-chips coffee-chips">
      {#each coffeeChips as [key, value] (key)}
        <span class="filter-chip"
          ><button type="button" class="filter-chip-label" use:labelTip={'Edit in Filters'} onclick={() => coffeesDialog?.showModal()}>{value}</button
          ><button type="button" class="filter-chip-remove" use:labelTip={'Remove filter'}
            aria-label="Remove filter: {value}" onclick={() => choose({ [key]: undefined, ...(key === 'roast' || key === 'process' ? { bag: undefined } : {}) })}>✕</button
          ></span
        >
      {/each}
      {#each brewChips as k (k)}
        {@const off = !brewSelectsOn(s.tab).includes(k)}
        {@const value = brewFilterText(k, s[k]!)}
        <span class="filter-chip" class:muted={off}
          ><button type="button" class="filter-chip-label" use:labelTip={off ? 'Not used on this tab' : 'Edit in Filters'} onclick={() => !off && coffeesDialog?.showModal()}>{value}</button
          ><button type="button" class="filter-chip-remove" use:labelTip={'Remove filter'}
            aria-label="Remove filter: {value}" onclick={() => choose({ [k]: undefined })}>✕</button
          ></span
        >
      {/each}
      {#if gearGrinder}
        <span class="filter-chip"
          ><button type="button" class="filter-chip-label" use:labelTip={'Edit in Filters'} onclick={() => coffeesDialog?.showModal()}>{gearGrinder}</button
          ><button type="button" class="filter-chip-remove" use:labelTip={'Remove filter'}
            aria-label="Remove filter: {gearGrinder}" onclick={() => choose({ grinder: undefined })}>✕</button
          ></span
        >
      {/if}
      <button type="button" class="filter-clear-all"
        onclick={() => choose({ ...brewOff, ...(s.tab === 'gear' ? { grinder: undefined } : {}), roast: undefined, process: undefined, origin: undefined, roaster: undefined, caffeine: undefined, bag: undefined })}>Clear all</button>
    </div>
  {/if}
</div>
{#if data.roastMix}
  {@const [first, ...rest] = data.roastMix}
  <p class="chart-note roast-nudge">{first.roast} averages {first.mean.toFixed(1)}{#each rest as r (r.roast)}, {r.roast.toLowerCase()} {r.mean.toFixed(1)}{/each}:
    <button type="button" class="filter-clear-all" onclick={() => coffeesDialog?.showModal()}>filter by roast</button></p>
{/if}
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
  <!-- Focus lands on the dialog, never a select (no keyboard pop). -->
  <!-- svelte-ignore a11y_autofocus -->
  <dialog bind:this={coffeesDialog} autofocus class="range-dialog coffees-dialog" aria-labelledby="coffees-title">
    <h2 id="coffees-title">Filters</h2>
    <div class="coffees-fields">
      {#each COFFEE_FIELDS as [key, label, values] (key)}
        <label class="form-field">
          <span>{label}</span>
          <select class="ctl-select" aria-label={label} value={s[key] ?? ''}
            onchange={(e) => choose({ [key]: e.currentTarget.value || undefined })}>
            <option value="">Any</option>
            {#each values as v (v)}<option value={v}>{v}</option>{/each}
          </select>
        </label>
      {/each}
      <label class="form-field">
        <span>Caffeine</span>
        <select class="ctl-select" aria-label="Caffeine" value={s.caffeine ?? ''}
          onchange={(e) => choose({ caffeine: (e.currentTarget.value || undefined) as Caffeine | undefined })}>
          <option value="">Caffeinated</option>
          <option value="decaf">Decaf</option>
          <option value="all">All</option>
        </select>
      </label>
      {#each brewSelects as key (key)}
        <label class="form-field">
          <span>{BREW_FILTER_LABEL[key]}</span>
          <select class="ctl-select" aria-label={BREW_FILTER_LABEL[key]} value={s[key] ?? ''}
            onchange={(e) => choose({ [key]: e.currentTarget.value || undefined })}>
            <option value="">Any</option>
            {#each BREW_OPTIONS[key] as v (v)}<option value={v}>{brewFilterText(key, v)}</option>{/each}
          </select>
        </label>
      {/each}
      {#if s.tab === 'gear' && (data.lab?.grinders.length ?? 0) > 1}
        <label class="form-field">
          <span>Grinder</span>
          <select class="ctl-select" aria-label="Grinder" value={s.grinder ?? ''}
            onchange={(e) => choose({ grinder: e.currentTarget.value || undefined })}>
            <option value="">Any</option>
            {#each data.lab!.grinders as g (g.slug)}<option value={g.slug}>{g.name}</option>{/each}
          </select>
        </label>
      {/if}
    </div>
    <footer><button type="button" class="button" onclick={() => coffeesDialog?.close()}>Done</button></footer>
  </dialog>

<div class="period-row">
  <p class="insights-period">{periodText}</p>
<!-- See all (gate 3): what the Score/Ratings/Brews settings hide on this tab; once everything shows, the way back.
       It shares the period line's row (right-aligned), so it appearing moves nothing below; on a phone it wraps under it only when it does not fit. -->
  {#if data.hidden}
    {#if s.avg === 'raw' && s.ratings === 'all' && s.dial === 'all'}
      <p class="chart-note see-all">Showing everything<span class="wide-only">, including low-confidence rows</span>.
        <button type="button" class="filter-clear-all" onclick={() => choose({ avg: undefined, ratings: undefined, dial: undefined })}>Back to defaults</button></p>
    {:else if hiddenNote(data.hidden)}
      {@const note = hiddenNote(data.hidden)!}
      <p class="chart-note see-all"><span class="wide-only">{note.lead}</span><span class="phone-only">{note.short}</span> <TextTip label="hidden by your settings" tip={note.tip}>hidden<span class="wide-only">{' '}by your settings</span></TextTip>.
        <button type="button" class="filter-clear-all" onclick={() => choose({ avg: 'raw', ratings: 'all', dial: 'all' })}>See all</button></p>
    {/if}
  {/if}
</div>
<JumpNav links={jump} label={s.tab === 'leaderboards' ? 'Jump to a board' : undefined} />
{/snippet}
{#snippet summary()}{TAB_LABEL[s.tab]}{' · '}{periodText}{#if badgeCount}{' · '}{badgeCount} {badgeCount === 1 ? 'filter' : 'filters'}{/if}{/snippet}
</CollapsibleBar>
<span id="ratings-help-current" hidden>{plainText(RATINGS_HELP.current)}</span>
<span id="ratings-help-all" hidden>{RATINGS_HELP.all}</span>
<span id="dial-help-dialed" hidden>{DIAL_HELP.dialed}</span>
<span id="dial-help-all" hidden>{DIAL_HELP.all}</span>
<span id="people-help-household" hidden>{PEOPLE_HELP.household}</span>
<span id="people-help-person" hidden>{PEOPLE_HELP.person}</span>

{#snippet panel(title: string, tiles: Tile[], values: object, deltas: object | null, whole?: string[], after?: Snippet)}
  <section class="chart-panel">
    {#if tiles.some((t) => t.ratingSwitch)}
      <div class="chart-panel-header">
        <HeadingAnchor id={panelId(title)}>{title}</HeadingAnchor>
        <RatingsSwitch ratings={s.ratings} dial={s.dial} ratingsHelp={RATINGS_HELP} {choose} />
      </div>
    {:else}
      <HeadingAnchor id={panelId(title)}>{title}</HeadingAnchor>
    {/if}
    {#each tiles.some((x) => x.row) ? [...new Set(tiles.map((x) => x.row))].map((r) => ({ row: r, tiles: tiles.filter((x) => x.row === r) })) : [{ row: undefined, tiles }] as g (g.row ?? '')}
    {#if g.row}<h3 class="row-label">{g.row}</h3>{/if}
    <div class="stat-row fit n{g.tiles.length} {deltas ? 'comparing' : ''}" class:right-now={title === 'Right now'} class:spending={title === 'Spending'} class:runway-row={!!g.row}>
      {#each g.tiles as t (t.key)}
        {@const v = (values as Record<string, number | null>)[t.key] ?? null}
        {@const d = (deltas as Record<string, D> | null)?.[t.key]}
        {@const pp = t.split && perPersonOn}
        <div class="stat-item" id={tileId(t.key)} class:stack={t.stack?.() && t.sub?.()}>
          <span class="stat-value" style:--len={valueText(t, v).length}
            >{#if t.fmt === usd && v !== null}<Usd n={v} />{:else}{valueText(t, v)}{/if}{#if t.suffix && v !== null}<small>{` ${t.suffix}`}</small>{/if}</span
          >
          {#if d}
            <!-- The visible line is for eyes; the sentence (with the %) is for screen readers and the hover tip. -->
            <span class="stat-unit insights-delta {trend(d, t)}" class:ratio={(t.from || t.fmt === usd || title === 'Spending') && !d.paced} use:labelTip={deltaText(d, t) === 'No change' ? undefined : deltaTitle(d, t)}
              ><span aria-hidden="true">{deltaText(d, t)}</span><span class="sr-only">{deltaTitle(d, t)}</span></span
            >
            {#if paceText(d, t)}<span class="insights-pace">{paceText(d, t)}</span>{/if}
          {:else if t.was?.()}
            <span class="stat-unit insights-delta">{t.was()}</span>
          {/if}
          {#if !d && t.stack?.()}
            {@const st = t.stack()!}
            <span class="insights-pace compare" use:labelTip={st.said}
              ><span aria-hidden="true"><span class="part">{st.head}</span>{' '}<span class="part">{st.tail}</span></span><span class="sr-only">{st.said}</span></span
            >
          {/if}
          <!-- Under a delta (or a "was" line), a kept sub takes the pace line's slot (no keepSub tile is paced). -->
          {#if t.sub?.() && (!d || t.keepSub)}
            <span class={d || t.was?.() ? 'insights-pace' : 'stat-unit'}>{t.sub?.()}</span>
          {/if}
          <div class="stat-caption">
            <span class="stat-label" class:mode-caption={t.ratingSwitch} class:wrap={pp || t.ratingSwitch} class:has-cap={pp || t.ratingSwitch}
              ><a class="caption-link" href="#{tileId(t.key)}">{t.label}</a>{#if t.help}{' '}<button class="mode-tip-button" popovertarget="tip-help-{t.key}" aria-describedby="tip-help-{t.key}" aria-label="About {t.label}"><Icon name="question" /></button
                >{/if}{#if pp || t.ratingSwitch}{' '}<span class="cap-block"><span class="cap-list">{#if t.ratingSwitch}<CapItem><button class="mode-tip-button" popovertarget="tip-{t.key}" aria-describedby="tip-{t.key}"
                  ><span class="tip-text">{RATINGS_LABEL[s.ratings]}</span>{#if s.dial !== 'all'}<Icon name="question" />{/if}</button
                ></CapItem>{#if s.dial === 'all'}<CapItem><button class="mode-tip-button" popovertarget="tip-{t.key}" aria-describedby="tip-{t.key}"
                  ><span class="tip-text">{DIAL_LABEL.all}</span><Icon name="question" /></button
                ></CapItem>{/if}{/if}{#if pp}<CapItem><button class="mode-tip-button" popovertarget="tip-pp-{t.key}" aria-describedby="tip-pp-{t.key}"
                  ><span class="tip-text">per person</span><Icon name="question" /></button
                ></CapItem>{/if}</span></span>{/if}</span
            >{#if SEE[t.key]}<a class="tile-link" href={link(`/coffees?${toParams({ status: SEE[t.key]!.status, filters: [] })}`)}>{SEE[t.key]!.label}</a>{/if}
          </div>
          {#if t.ratingSwitch}
            <div class="mode-tip" id="tip-{t.key}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: RATINGS_LABEL[s.ratings], lines: [RATINGS_HELP[s.ratings], DIAL_HELP[s.dial]] }} /></div>
          {/if}
          {#if t.help}
            <div class="mode-tip" id="tip-help-{t.key}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: t.label, lines: [t.help] }} /></div>
          {/if}
          {#if pp}
            <div class="mode-tip" id="tip-pp-{t.key}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: 'Per person', lines: [PEOPLE_HELP.person] }} /></div>
          {/if}
        </div>
      {/each}
    </div>
    {/each}
    {#if whole && wholeKeys.length}<WholeNote keys={wholeKeys} items={whole} />{/if}
    {@render after?.()}
  </section>
{/snippet}

<!-- The Jump to chips for this chain are the `jump` derived in the script (same branch order); keep them in step. -->
{#snippet tab(part?: 'bar')}
{#if data.boards}
  <Leaderboards
    {part}
    boards={data.boards}
    cut={data.boardsCut}
    rank={s.rank}
    avg={explicit.avg}
    open={s.open ?? []}
    views={s.views}
    series={data.boardSeries}
    comparing={!!data.previousPeriod}
    perPerson={perPersonOn}
    {wholeKeys}
    {placeTip}
    {choose}
    {link}
  />
{:else if s.tab === 'habits' && data.habits}
  <Habits {part} h={data.habits} measure={s.measure} agg={s.agg} comparing={!!data.previousPeriod} {periodLabel} {compareLabel} {choose}>
    {#snippet tiles()}{@render panel('Habits', HABITS, data.habits!.tiles, data.habits!.deltas)}{/snippet}
  </Habits>
{:else if s.tab === 'consumption' && data.consumptionTab}
  <Consumption {part} {wholeKeys} t={data.consumptionTab} {periodLabel} {compareLabel} {compareDates} unit={s.unit} trend={s.trend} agg={s.agg} offered={data.byMenus[s.range]} {choose} {placeTip}>
    {#snippet tiles()}{@render panel('Consumption', FLOW, consumptionValues, data.consumptionTab!.deltas, ['Bought', 'Net', 'On hand', 'Days to clear', ...(s.unit === 'bags' ? ['Bags finished'] : [])])}{/snippet}
  </Consumption>
{:else if s.tab === 'sweetspots' && data.sweetSpots && data.lab}
  <SweetSpots {part} t={data.sweetSpots} lab={data.lab} {s} {placeTip} {choose} />
{/if}
{/snippet}

{#if data.boards || (s.tab === 'habits' && data.habits) || (s.tab === 'consumption' && data.consumptionTab) || (s.tab === 'sweetspots' && data.sweetSpots && data.lab)}
  {@render tab()}
{:else if s.tab === 'records' && data.records}
  <Records
    t={data.records}
    ratings={s.ratings}
    dial={s.dial}
    brewer={s.brewer}
    top={s.top}
    topc={s.topc}
    perPerson={perPersonOn}
    {wholeKeys}
    allRange={!data.period.start}
    {compareLabel}
    ratingsHelp={RATINGS_HELP}
    personHelp={PEOPLE_HELP.person}
    {placeTip}
    {choose}
  />
{:else if s.tab === 'milestones' && data.milestones}
  <Milestones m={data.milestones} />
{:else if s.tab === 'insights' && data.insights}
  <Insights
    t={data.insights}
    theme={s.theme}
    inputs={{ drinkers: s.drinkers, gpp: s.gpp, inflow: s.inflow, bpd: s.bpd, dose: s.dose }}
    today={data.today}
    explicit={explicit}
    {wholeKeys}
    {placeTip}
    {choose}
    {link}
  />
{:else if s.tab === 'brewing' && data.brewing && data.lab}
  <Brewing t={data.brewing} lab={data.lab} {s} {placeTip} {choose} />
{:else if s.tab === 'pours'}
  <Pours t={data.pours} {s} {explicit} {placeTip} {choose} />
{:else if s.tab === 'water' && data.water}
  <Water t={data.water} {s} {placeTip} {choose} />
{:else if s.tab === 'gear' && data.gear}
  <Gear t={data.gear} trophies={data.trophies} {s} {placeTip} {choose} />
{:else if s.tab === 'onhand' && data.onHand}
  {#snippet runwayChart()}
    <RunwayChart t={data.onHand!} today={data.today} paces={[...(s.range === 'all' ? [] : [{ name: paceName, days: data.onHand!.runway.days }]), { name: 'all-time pace', days: data.onHand!.runwayAll.days }]} />
    <p class="chart-note">{#if perPersonOn}Per person divides the pace, so the same shelf lasts longer. {/if}<a href={link('/insights?tab=insights&chart=insights-what-if#insights-what-if')}>Plan it: What if</a></p>
  {/snippet}
  {#snippet runwayPanel()}{@render panel('Runway at your pace', RUNWAY, { paceDays: data.onHand!.runway.days, paceOut: data.onHand!.runway.days, pacePerDay: data.onHand!.runway.perDay, allDays: data.onHand!.runwayAll.days, allOut: data.onHand!.runwayAll.days, allPerDay: data.onHand!.runwayAll.perDay }, null, undefined, runwayChart)}{/snippet}
  <OnHand t={data.onHand} {link} runway={runwayPanel} {placeTip} unit={s.unit} waitBy={s.waitBy} {choose}>
    {#snippet tiles()}{@render panel('On the shelf', ONHAND, data.onHand!.tiles, null)}{/snippet}
  </OnHand>
{:else if s.tab === 'spend' && data.spend}
  <Spend t={data.spend} {choose} {placeTip} spendView={s.spendView} spendSeries={s.spendSeries} rcSort={s.rcSort} rcDir={s.rcDir} rcTop={s.rcTop} {compareLabel} {compareDates} {link}>
    {#snippet tiles()}{@render panel('Spending', SPEND, data.spend!.tiles, data.spend!.deltas)}{/snippet}
  </Spend>
{:else}
  {@render panel('Totals', TOTALS, data.tiles, data.deltas, ['Spend', 'Bags finished'])}
  {@render panel('Averages', AVERAGES, data.tiles, data.deltas)}
  {@render panel('Consumption', CONSUMPTION, data.consumption, data.consumptionDeltas, ['Time to clear'])}
  {@render panel('Right now', RIGHT_NOW, data.rightNow, data.rightNowDeltas, [])}
  {#if data.recent}<Recent {...data.recent} {wholeKeys} n={s.recent} nc={s.recentc} {choose} />{/if}
{/if}
</div>
</div>

<style>
  /* Desktop side rail (docs/backlog/insights-side-bar.md), from 1000px wide and 500px tall (never a
     phone: landscape is 333px tall). The container grows by rail + gap (10rem + 1rem = 176px), so the
     content column at viewport W is today's column at W - 176px, and from 1416px (= --container-max
     1240px + 176px) the full 1208px. The content's width breakpoints are container queries on
     `insights` (viewport width - 2rem main padding), so it lays out exactly as the page did at W - 176. */
  .rail-main {
    container: insights / inline-size;
  }
  .insights-rail {
    display: none;
  }
  @media (min-width: 1000px) and (min-height: 500px) {
    :global(main.container:has(> .rail-layout)) {
      --rail-w: 10rem;
      --rail-gap: 1rem;
      max-width: calc(var(--container-max) + var(--rail-w) + var(--rail-gap));
    }
    :global(body:has(main.container > .rail-layout)) {
      --nav-max: calc(var(--container-max) + 10rem + 1rem);
    }
    .rail-layout {
      display: grid;
      grid-template-columns: var(--rail-w) minmax(0, 1fr);
      gap: var(--rail-gap);
      align-items: start;
    }
    .insights-rail {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      position: sticky;
      top: 0;
      max-height: 100vh;
      overflow-y: auto;
      padding-block: var(--space-2);
      font-size: 0.95rem;
    }
    .rail-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .rail-caption {
      padding: 0 var(--space-3) var(--space-1);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .insights-rail a {
      display: flex;
      align-items: center;
      min-height: 2.25rem;
      padding: 0 var(--space-3);
      border-left: 3px solid transparent;
      border-radius: 0 var(--radius) var(--radius) 0;
      color: var(--color-text);
      text-decoration: none;
      white-space: nowrap;
    }
    .insights-rail a[aria-current='page'] {
      border-left-color: var(--color-accent);
      background: color-mix(in oklab, var(--color-accent) 14%, transparent);
      color: var(--color-accent);
      font-weight: 600;
    }
    .insights-rail a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: -2px;
    }
    /* A touch screen this wide (a tablet): 44px targets (ui-rules 4). */
    @media (pointer: coarse) {
      .insights-rail a {
        min-height: 44px;
      }
    }
    @media (hover: hover) {
      .insights-rail a:not([aria-current='page']):hover {
        background: color-mix(in oklab, var(--color-accent) 7%, transparent);
      }
    }
    /* Milestones: the rail takes the left edge, so the timeline ruler moves to the right of the feed. */
    .rail-layout :global(.timeline:not(.no-ruler)) {
      grid-template-columns: minmax(0, 1fr) 6.5rem;
    }
    .rail-layout :global(.timeline > .ruler) {
      grid-column: 2;
      grid-row: 1;
    }
  }
  /* Phones: the bar scrolls with the page (CollapsibleBar pins a short row instead). */
  @media (max-width: 640px), (max-height: 450px) {
    .insights-controls.filter-bar {
      position: static;
    }
  }
  /* Labeled controls, left-packed, one column each on wider screens. */
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
  /* The active tab's own controls: a row of the sticky bar (rendered from the tab, see tabBar.ts). */
  .tab-controls {
    flex: 1 1 100%;
    min-width: 0;
  }
  .people-switch button {
    min-height: 2.25rem;
    margin: 0;
    font-size: 0.85rem;
  }
  /* Phone landscape: tighter buttons so View, Period, Compare, both switches and People share one row. */
  @media (max-height: 450px) {
    .insights-controls {
      gap: var(--space-2);
    }
    .people-switch button {
      padding-inline: 0.5rem;
    }
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
  /* The Filters button: exactly the selects' height beside it, so its "Show" label sits level with theirs
     (a taller button lifts its label: the bar aligns controls at the end); 44px on phones. */
  .filters-button {
    box-sizing: border-box;
    height: 2.25rem;
    padding-block: 0;
    margin: 0;
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .filters-button {
      width: 100%;
      height: auto;
      min-height: 44px;
    }
  }
  /* Phone landscape: tighter, so the bar stays one row (ui-rules 30). */
  @media (max-height: 450px) {
    .filters-button {
      padding-inline: 0.6rem;
      font-size: 0.85rem;
    }
  }
  /* The Filters button's count: a small pill in the button's own hue. */
  .filters-button .badge {
    margin-left: var(--space-2);
    padding: 0 0.45rem;
    background: color-mix(in oklab, currentColor 18%, transparent);
  }
  /* The chips: the sticky bar's last row, one line everywhere; more chips scroll sideways (touch or trackpad),
     with no scrollbar showing. Clear all is the row's last item. */
  .insights-controls > .coffee-chips {
    grid-column: 1 / -1;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .coffee-chips::-webkit-scrollbar {
    display: none;
  }
  .coffee-chips > * {
    flex-shrink: 0;
  }
  /* A brew filter set but not used on this tab: the chip stays, muted. */
  .coffee-chips :global(.filter-chip.muted) {
    border-color: var(--color-border);
    color: var(--color-text-muted);
  }
  /* The row scrolls, so a long name shows in full (no ellipsis, ui-rules 3). */
  .coffee-chips :global(.filter-chip),
  .coffee-chips :global(.filter-chip-label) {
    max-width: none;
  }
  .roast-nudge,
  .see-all {
    margin: 0 0 var(--space-3);
  }
  /* A 44px tap target that doesn't open a gap in the line: padding out, margin back in. */
  .roast-nudge .filter-clear-all,
  .see-all .filter-clear-all {
    min-height: 0;
    min-width: 44px;
    padding: 0.75rem 0;
    margin: -0.75rem 0;
  }
  .coffees-dialog {
    width: min(34rem, 100% - 2rem);
  }
  .coffees-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .coffees-fields .form-field {
    margin-bottom: 0;
  }
  /* Phone landscape (333px tall): the fields in five columns so the panel fits without scrolling. */
  @media (max-height: 450px) {
    .coffees-dialog {
      width: min(56rem, 100% - 2rem);
    }
    .coffees-fields {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
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
    /* Each control's span comes from packSpans (--s2 / --s3 on it), so every row is full. */
    .insights-controls > * {
      grid-column: span var(--s2, 1);
      min-width: 0;
    }
    .insights-controls > .tab-controls {
      grid-column: 1 / -1;
    }
    .people-switch button {
      flex: 1;
      min-height: 44px;
    }
    /* Row gaps by what you see: a labeled row's gap runs to the label's ink (~3px under its box), the chips
       row has no label, so it sits 2px lower to match (checked in test:ui). */
    .insights-controls > .coffee-chips {
      margin-top: 2px;
    }
    .range-dialog footer button {
      flex: 1;
    }
    .custom-range button,
    .insights-controls > button {
      min-height: 44px;
    }
  }
  /* Phones: three controls per row, smaller type and padding (taps stay 44px), so the bar stays short. */
  @media (max-width: 480px) {
    .insights-controls {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .insights-controls > * {
      grid-column: span var(--s3, 1);
    }
    .insights-controls > .tab-controls {
      grid-column: 1 / -1;
    }
    .insights-controls :global(.form-field > span) {
      font-size: 0.75rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .insights-controls .ctl-select {
      width: 100%;
      padding-inline: 0.35rem;
      font-size: 14px;
    }
    .insights-controls :global(.menu-button),
    .insights-controls > button,
    .filters-button,
    .people-switch button {
      padding-inline: 0.35rem;
      font-size: 0.8rem;
    }
  }

  /* The mode word in a rating tile's caption opens its explanation: the way
     to it on touch, where the switch's hover title never shows. Dotted
     underline marks it as more info. Padding grows the tap target to 44px;
     the matching negative margin keeps the caption's layout unchanged. */
  /* It wraps within the tile (ui-rules 44): the first line stays at the caption's fixed top, the rest flow down. */
  .mode-caption {
    display: block;
    overflow: visible;
    white-space: normal;
    line-height: 1.1;
  }
  /* Every caption with a tip button lets the button's 44px tap area overflow. */
  .stat-caption:has(.mode-tip-button) {
    overflow: visible;
  }
  /* A small section label under a panel title: muted, semibold, 0.85rem (the app has no smaller heading class). */
  .row-label {
    margin: var(--space-3) 0 var(--space-2);
    font-family: var(--font-sans);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .row-label:first-of-type {
    margin-top: 0;
  }
  .stat-label.wrap {
    white-space: normal; /* a caption block's items wrap (ui-rules 55) */
  }
  /* Records and Milestones card grids (ui-rules 33): each card's row length comes from rows.ts
     (--q4 / --q3 / --q2), picked here by the grid's width, so every row runs edge to edge. Findings
     cards also get their row's height token the same way (--h, rows.ts sizedGrid). */
  :global(.hl-grid) {
    --gap: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    container-type: inline-size;
  }
  :global(.hl-grid > .hl-card) {
    --q: var(--q2);
    --h: var(--h2);
    flex: 1 0 calc((100% - (var(--q) - 1) * var(--gap)) / var(--q) - 0.5px);
  }
  @container (min-width: 520px) {
    :global(.hl-grid > .hl-card) {
      --q: var(--q3);
      --h: var(--h3);
    }
  }
  @container (min-width: 900px) {
    :global(.hl-grid > .hl-card) {
      --q: var(--q4);
      --h: var(--h4);
    }
  }
  @container (min-width: 1150px) {
    :global(.hl-grid > .hl-card) {
      --q: var(--q5, var(--q4));
      --h: var(--h5, var(--h4));
    }
  }
  /* Findings card height tokens (ui-rules 34; rows.ts sizedGrid picks one per row, --h above by width),
     measured from the 2026-10-12 layout the user picked. Shared by Insights' Findings and Sweet spots. */
  :global(.finding-grid) {
    --fs-s4: 10rem; /* 160px: rows of 4, numbers (1280 wide) */
    --fs-l4: 16.5rem; /* 264px: rows of 4, charts / versus */
    --fs-3: 15.75rem; /* 252px: every row of 3 */
    --fs-s2: 12rem; /* 192px: 2-up phone rows (480×909), numbers */
    --fs-l2: 18.5rem; /* 296px: 2-up phone rows (and a lone full-width last card), charts / versus */
  }
  /* Paired lab cards (fitPairs.ts, ui-rules 37): the card is a column, its .fit-body takes the card's spare
     height (scrolling inside when the pair height is under its natural height) and the chart inside fills it:
     bar and heatmap rows stretch, keeping their marks' thickness. */
  :global(.fit-body) {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  :global(.fit-body > *) {
    flex: 1 0 auto;
  }
  /* A column of stacked cards (fitPairs): its cards keep their natural height unless fitPairs grows them
     (in proportion) or lets the tallest shrink and scroll inside its .fit-body. */
  :global(.fit-col) {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  :global(.fit-col > *) {
    flex: 0 0 auto;
  }
  :global(.fit-body > .hl-empty) {
    flex: none;
    margin-block: auto;
  }
  :global(.fit-body > .delta-bars) {
    --bar-rows: minmax(0, 1fr);
  }
  :global(.fit-body > .heatmap) {
    display: flex;
    flex-direction: column;
  }
  :global(.fit-body > .heatmap > .scroll, .fit-body > .heatmap > .frame) {
    flex: 1 1 auto;
    display: grid;
  }
  :global(.fit-body > .heatmap .grid) {
    grid-auto-rows: minmax(var(--cell-h), 1fr);
  }
  /* Leaderboard rows, shared with the lab tabs (Sweet spots' top bags). Set --rows and --row-h on the list
     or an ancestor. Scoped under .board-row: Records and Milestones have their own .rank / .who. */
  :global(.board-rows) {
    min-height: calc(var(--rows) * var(--row-h));
    margin: 0;
    padding: 0;
    list-style: none;
  }
  :global(.board-row) {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-2);
    position: relative;
    height: var(--row-h);
    border-top: 1px solid var(--color-border);
  }
  :global(:root) {
    --row-h-like: 3.75rem; /* a row with a vs-like line */
  }
  :global(.board-row.liked) {
    height: var(--row-h-like);
  }
  :global(.board-row:first-child) {
    border-top: 0;
  }
  :global(.board-row .rank) {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  :global(.board-row .who) {
    display: grid;
    min-width: 0;
    line-height: 1.2;
  }
  :global(.board-row .who a),
  :global(.board-row .who .name),
  :global(.board-row .who small) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Stretched link: the whole 48px row is the tap target. The link stays static so its
     overflow:hidden doesn't clip the overlay; the row is the containing block. */
  :global(.board-row .who a::after) {
    content: '';
    position: absolute;
    inset: 0;
  }
  :global(.board-row .who a:focus-visible) {
    outline: none;
  }
  :global(.board-row .who a:focus-visible::after) {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  :global(.board-row .who small) {
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  /* The sub line with a small-sample note after it: the text ellipsizes, the note stays whole. */
  :global(.board-row .who .who-line) {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    min-width: 0;
  }
  :global(.board-row .val) {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  /* Value bar behind a row (--share of the row's width: Leaderboards, Overview's Recent), inset inside
     the row so it never crosses the row borders; z-index -1 inside the row's own stacking context keeps
     text on top. On hover it deepens, with the tiles' timing (.hl-card); reduced motion is global. */
  :global(.board-row.bar) {
    isolation: isolate;
  }
  /* A signed value (rank=like) grows from the middle (--left, the bar's start) in its delta color (--bar-color). */
  :global(.board-row.bar::before) {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 3px auto 3px calc(var(--left, 0) * 100%);
    width: calc(var(--share) * 100%);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--bar-color, var(--map-high)) var(--bar-alpha), transparent);
    transition: background-color 150ms ease;
  }
  :global(.board-row.bar .who > *),
  :global(.board-row.bar .who .who-line > *) {
    transition: color 150ms ease;
  }
  /* A hovered bar deepens (--bar-hover-alpha) and its row's text turns ink: the accent link and muted
     subtext over a deeper accent bar fall under 4.5:1. */
  @media (hover: hover) {
    :global(.board-row.bar:hover::before) {
      background: color-mix(in oklab, var(--color-accent) var(--bar-hover-alpha), transparent);
    }
    :global(.board-row.bar:hover .who > *),
    :global(.board-row.bar:hover .who .who-line > *) {
      color: var(--color-text);
    }
  }
  /* The stat tile's language in flow layout: value largest, muted context, caption at the foot.
     Cards in a row share its height, so captions line up. */
  :global(.hl-card) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    min-width: 0;
    box-sizing: border-box;
    padding: var(--space-3) var(--space-2);
    text-align: center;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    transition: background-color 150ms ease, border-color 150ms ease;
  }
  /* Sized by the card's share of the grid (its container): 2-up phone cards fit "11:42 PM", and a
     phone row of 3 (rows.ts) shrinks to fit. */
  :global(.hl-value) {
    margin-top: var(--space-1);
    font-size: min(2rem, 15cqw / var(--q, 2));
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  :global(.hl-value small) {
    font-size: 0.45em;
    font-weight: 600;
  }
  :global(.hl-holder),
  :global(.hl-line) {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Names get two lines before the ellipsis: one line cut most coffees mid-name. */
  :global(.hl-holder) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
    font-weight: 600;
  }
  :global(.hl-line) {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }
  :global(.hl-badge) {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    color: var(--color-accent);
    font-size: 0.72rem;
  }
  /* A Possible badge: the same pill in its own slate teal (Insights, Sweet spots and the lab charts and boards). */
  :global(.hl-badge.hint) {
    background: color-mix(in srgb, var(--color-possible) 14%, transparent);
    color: var(--color-possible);
  }
  /* An Early badge: the same pill, muted (a lead with no test behind it). */
  :global(.hl-badge.early) {
    background: color-mix(in srgb, var(--color-text-muted) 14%, transparent);
    color: var(--color-text-muted);
  }
  /* Flex: its tip buttons form their own row (checkLayout rule 5), apart from the card's. */
  :global(.hl-caption) {
    display: flex;
    justify-content: center;
    margin-top: auto;
    padding-top: var(--space-2);
    max-width: 100%;
  }
  :global(.hl-caption .stat-label) {
    display: block;
    overflow: visible;
  }
  /* Phone cards: a caption with its mode word often wraps; every caption keeps two lines, top
     aligned, so wrapped and one-line captions in a row start level. */
  @container (max-width: 519px) {
    :global(.hl-caption .stat-label) {
      min-height: 2lh;
    }
  }
  :global(.hl-empty) {
    margin: 0;
    padding: var(--space-4) 0;
    text-align: center;
    color: var(--color-text-muted);
  }

  /* Reset sits beside Share, not mid-row (the toolbar spaces its children apart). */
  .reset {
    margin-left: auto;
  }
  /* A long value ("$999.50", "12.3 kg") shrinks to fit its tile; 6 characters or fewer keep the
     shared size (app.css). */
  .stat-item .stat-value {
    font-size: min(25.81cqw, calc(160cqw / var(--len, 1))); /* same top as its row (the value-offset check) */
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
     (the pace slot below it, free because ratio tiles are never paced), at the usual size. Money tiles' "▼ $88.00
     from $110.00" (2 decimals) wraps the same way when unpaced. */
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
    /* One line when it fits, else "vs Oct 4:" over the tail. The box spans the 2-line height with the text
       at its top, hugging the sub; the caption sits below the box either way. */
    height: calc(2.2 * max(0.6rem, 5.4cqw) + 1cqw + var(--grow-compare, 0px));
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    line-height: 1.1;
  }
  .compare .part {
    display: inline-block;
  }
  /* A row with a stacked tile puts every caption where the stack's goes, so the first lines stay level (ui-rules 44). */
  .stat-row:has(.stack) .stat-caption,
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
  :global(.insights-period) {
    color: var(--color-text-muted);
    margin: 0;
  }
  .period-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0 var(--space-3);
    margin: 0 0 var(--space-3);
  }
  /* The note reads in the period line's own type (not the small chart-note's). */
  .period-row .see-all {
    margin: 0 0 0 auto;
    text-align: right;
    font: inherit;
    color: var(--color-text-muted);
  }
  .period-row .see-all .filter-clear-all {
    font-size: inherit;
  }
  .period-row .see-all .phone-only {
    display: none;
  }
  /* Phones: the note shares the period line when it fits, else wraps to its own line (no held empty line). */
  @media (max-width: 767px) {
    .period-row {
      /* The note's tip is a 44px tap target (inline padding): this clears it from the period line above, whose taps it would cover. */
      row-gap: 16px;
    }
    .period-row .see-all {
      margin-left: 0;
      text-align: left;
      /* Its own line in both states: sharing the period's line fits one text and not the other, which moved the page when toggled. */
      flex-basis: 100%;
    }
    /* Short enough to share the period line, and to keep the See all one's height when toggled. */
    .period-row .see-all .wide-only {
      display: none;
    }
    .period-row .see-all .phone-only {
      display: inline;
    }
  }

  /* Stat rows with no empty cells. Tiles stay square (height --h = one regular tile); a
     tile wider than that (--q per row < --c) keeps its content one-tile wide, centered,
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
  /* Insights tiles sit on the page color inside their surface panels (user, 2026-10-12); /stats
     keeps app.css's surface tiles. The hover tint mixes from the same base. */
  .stat-item {
    background: var(--color-bg);
    scroll-margin-top: var(--space-2);
  }
  /* Records and Milestones cards (.hl-card) share the stat tiles' hover tint (app.css's tint, from the
     page-colour base; mouse only); the gentle row's surface version is in Records.svelte. */
  @media (hover: hover) {
    .stat-item:hover,
    :global(.hl-card:hover) {
      background: color-mix(in srgb, var(--color-accent) 8%, var(--color-bg));
      border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border));
    }
  }
  /* A caption may wrap to a third line ("Avg rating · Calibrated ratings, All brews" in a 3-up tile): every overview tile
     is one line taller (ui-rules 44), the first line stays at its fixed top and the rest flow down. */
  .fit {
    --grow-caption: 1rem;
  }
  /* Right now: one more caption line for the See coffees link (ui-rules 44). */
  .fit.right-now {
    --grow-caption: 2.2rem;
  }
  .tile-link {
    font-size: max(0.6rem, 5.4cqw);
    line-height: 1.1;
    text-align: center;
    color: var(--color-accent);
  }
  .fit .stat-item {
    --q: var(--c);
    --w: calc((100cqw - (var(--q) - 1) * var(--gap)) / var(--q));
    --h: calc((100cqw - (var(--c) - 1) * var(--gap)) / var(--c));
    /* Basis 0.5px under the exact share, grown back to fill: at a fractional row width (Windows at 150%
       scaling) each tile rounds up to the layout grid, and six exact shares overflowed into a 5+1 row. */
    flex: 1 0 calc(var(--w) - 0.5px);
    box-sizing: border-box;
    aspect-ratio: auto;
    height: calc(var(--h) + var(--grow-compare, 0px) + var(--grow-caption));
    padding-inline: calc((var(--w) - var(--h)) / 2);
    /* Not inline-size: when the row's container query changes only this padding (same outer width,
       e.g. the full-row last tile at 360px), Firefox keeps the content's cqw from the first layout. */
    container-type: size;
  }
  .fit.n5 .stat-item:nth-last-child(-n + 2) {
    --q: 2;
  }
  .fit.n4 .stat-item:last-child {
    --q: 1;
  }
  /* Rows this narrow (360-390px phones): 3 columns leave ~88px tiles, too small for the
     Ratings/Brews switch and two-line labels. 2 columns; Totals' 5th tile takes the last row. */
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
    /* The runway's rows of three stay three across (2 columns would leave the third alone on a full-width row, its caption past the bottom). */
    .fit.runway-row {
      --c: 3;
    }
    .fit.runway-row .stat-item {
      --q: 3;
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
  /* viewport 1000px (no rail; the rail narrows it) */
  @container insights (min-width: 968px) {
    .fit.n6 {
      --c: 6;
    }
    /* The runway's rows of three stretch to thirds but keep a sixth's height (content centered, like n4 and n5). */
    .fit.runway-row {
      --c: 6;
    }
    .fit.runway-row .stat-item {
      --q: 3;
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
    /* Spending: 3 across like Consumption's tiles (2 across made 229px squares on a phone); the last two share a row. */
    .fit.n8.spending .stat-item {
      --c: 3;
    }
    .fit.n8.spending .stat-item:nth-last-child(-n + 2) {
      --q: 2;
    }
  }
  @container (max-width: 380px) {
    .fit.n8.spending .stat-item {
      --c: 2;
      --q: 2;
    }
  }
  /* "9 free bags not in $/g" is wider than a 3-up phone tile: wrap it, never cut it off with an ellipsis. */
  .fit.spending .stat-item .stat-unit:not(.insights-delta) {
    white-space: normal;
    line-height: 1.1;
    overflow: visible;
    text-overflow: clip;
  }
  /* A change line's tip explains a value, so it keeps the arrow (ui-rules 50; labelTip sets help inline). */
  .stat-item :global(.insights-delta),
  .stat-item :global(.insights-pace.compare) {
    cursor: default !important;
  }
  /* A money value is an underlined tip trigger: keep its dotted line below the digits at the tile's big font. */
  .stat-value :global(.text-tip) {
    text-underline-offset: 0.12em;
  }
</style>
