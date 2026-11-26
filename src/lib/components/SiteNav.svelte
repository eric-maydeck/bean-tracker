<script lang="ts">
  import { navigating, page } from '$app/state';
  import { enhance } from '$app/forms';
  import { onMount, tick, untrack } from 'svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { MAIN_ROWS, PHONE_BAR, isCurrent, panelFor, pendingStatsTab, statsGroups, statsTabOf, statsViewHref, icon } from '#lib/nav.ts';
  import { TAB_LABEL, statsTabHref, type Tab } from '#lib/insightsUrl.ts';
  import { INSIGHTS_STORAGE_KEY, loadInsightsState, withoutDeepLinks } from '#lib/insightsMemory.ts';

  let { isAdmin, unread, theme, navPref, recapsTab, onTheme, onAlerts }: {
    isAdmin: boolean; unread: number; theme: 'light' | 'dark'; navPref: 'collapsed' | 'expanded' | null;
    recapsTab: boolean; onTheme: () => void; onAlerts: () => void;
  } = $props();

  // The collapse choice is a cookie so the server renders the right width; unset = CSS decides by width (641-1100px collapsed).
  // svelte-ignore state_referenced_locally -- the cookie's value seeds local state; toggling writes the cookie
  let pref = $state<'collapsed' | 'expanded' | null>(navPref);
  let autoCollapsed = $state(false); // the media query's answer, for the button's label and icon only
  const collapsed = $derived(pref ? pref === 'collapsed' : autoCollapsed);
  let ready = $state(false); // motion only after first paint, so landing on /stats doesn't animate

  const pathname = $derived(page.url.pathname); // a derived dedupes: query-only changes don't re-run the effect below
  const onStats = $derived(pathname === '/stats');
  let drilled = $state(panelFor(page.url.pathname) === 'stats');
  $effect(() => { drilled = panelFor(pathname) === 'stats'; });

  const shownTab = $derived(pendingStatsTab(navigating.to?.url) ?? (onStats ? statsTabOf(page.url) : null));
  const groups = $derived(statsGroups(recapsTab || shownTab === 'recaps'));
  const onLogin = $derived(pathname === '/login');
  const onAccount = $derived(isCurrent('/account', pathname));
  const viewHref = (t: Tab) => (onStats && page.data.explicit ? statsTabHref(page.data.explicit, t) : statsViewHref(t, null));
  const here = (r: { href: string }) => isCurrent(r.href, pathname);

  function viewClick(e: MouseEvent & { currentTarget: HTMLAnchorElement }, t: Tab) {
    nav();
    if (onStats) { // the page's own toggles live in the URL (shallow updates): carry them, like Previous / Next
      const p = new URLSearchParams(location.search);
      p.set('tab', t);
      p.delete('chart');
      e.currentTarget.href = `/stats?${p}`;
      return;
    }
    try { // off /stats the link restores the remembered filters; read at click time (the signInHere pattern)
      const saved = loadInsightsState(localStorage.getItem(INSIGHTS_STORAGE_KEY), Date.now());
      if (saved) e.currentTarget.href = statsViewHref(t, withoutDeepLinks(saved));
    } catch { /* storage unavailable: the plain link */ }
  }
  // Already on /stats, the bar's Stats tab stays where it is: a bare /stats would swap in the remembered state.
  function statsBarClick(e: MouseEvent & { currentTarget: HTMLAnchorElement }) {
    if (location.pathname === '/stats') e.currentTarget.href = location.pathname + location.search;
  }
  function signInHere(event: MouseEvent & { currentTarget: HTMLAnchorElement }) {
    nav();
    if (location.pathname === '/login') return;
    event.currentTarget.href = `/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`;
  }

  function setPref(v: 'collapsed' | 'expanded') {
    pref = v;
    document.cookie = `nav=${v}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  const rootOf = (el: Element) => el.closest('.nav-shell')!;
  async function drill(e: MouseEvent & { currentTarget: HTMLElement }) { // drills only, never navigates
    const root = rootOf(e.currentTarget);
    if (collapsed && root.classList.contains('site-sidebar')) setPref('expanded'); // the phone drawer never touches the cookie
    drilled = true;
    await tick();
    root.querySelector<HTMLElement>('.nav-back')?.focus({ preventScroll: true });
  }
  async function back(e: MouseEvent & { currentTarget: HTMLElement }) {
    const root = rootOf(e.currentTarget);
    drilled = false;
    await tick();
    root.querySelector<HTMLElement>('.nav-drill')?.focus({ preventScroll: true });
  }

  // Phone drawer: a modal dialog holding the same panel. Closing mirrors opening.
  let dlg: HTMLDialogElement | undefined = $state();
  let drawerMounted = $state(false);
  let drawerOpen = $state(false);
  let shown = $state(false);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function openDrawer() {
    drilled = panelFor(pathname) === 'stats';
    drawerMounted = true;
    await tick();
    dlg!.showModal();
    document.body.style.overflow = 'hidden';
    drawerOpen = true;
    requestAnimationFrame(() => (shown = true));
  }
  function closeDrawer(now = false) {
    if (!drawerOpen) return;
    drawerOpen = false;
    shown = false;
    setTimeout(() => { dlg?.close(); document.body.style.overflow = ''; }, now || reduced() ? 0 : 240);
  }
  const nav = () => closeDrawer();
  // Any page change (browser back, a redirect) closes an open drawer too.
  $effect(() => { void pathname; untrack(() => closeDrawer()); });

  onMount(() => {
    const auto = matchMedia('(min-width: 641px) and (max-width: 1100px)');
    const phone = matchMedia('(max-width: 640px), (max-height: 450px)');
    autoCollapsed = auto.matches;
    const a = () => (autoCollapsed = auto.matches);
    const p = () => { if (!phone.matches) closeDrawer(true); };
    auto.addEventListener('change', a);
    phone.addEventListener('change', p);
    requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
    return () => { auto.removeEventListener('change', a); phone.removeEventListener('change', p); document.body.style.overflow = ''; };
  });
</script>

{#snippet inner(drawer: boolean)}
  <div class="head">
    <span class="brand">Coffee Tracker</span>
    {#if drawer}
      <button class="icon-btn" type="button" onclick={() => closeDrawer()} aria-label="Close menu"><Icon name="x" /></button>
    {:else}
      <button class="icon-btn" type="button" onclick={() => setPref(collapsed ? 'expanded' : 'collapsed')}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <span class="caret-l"><Icon name="caret-left" /></span><span class="caret-r"><Icon name="caret-right" /></span>
      </button>
    {/if}
  </div>

  <div class="clip">
    <div class="track" class:drilled class:anim={ready}>
      <div class="nav-panel panel-main" data-panel="main" role="group" aria-label="Main menu">
        {#each MAIN_ROWS as row (row.href)}
          {@const on = here(row)}
          {#if row.children}
            <button type="button" class="nav-row nav-drill" class:contains-current={on} data-tip={row.label}
              aria-expanded={drilled && (drawer || !collapsed)} onclick={drill}>
              <Icon name={icon(row, on)} /><span class="lbl">{row.label}</span><span class="chev"><Icon name="caret-right" /></span>
            </button>
          {:else}
            <a class="nav-row" class:on href={row.href} data-tip={row.label} aria-current={on ? 'page' : undefined} onclick={nav}>
              <Icon name={icon(row, on)} /><span class="lbl">{row.label}</span>
            </a>
          {/if}
        {/each}
      </div>

      <div class="nav-panel panel-stats" data-panel="stats" role="group" aria-label="Stats views" inert={!drilled}>
        <button class="nav-row nav-back" type="button" onclick={back}><Icon name="caret-left" /><span class="lbl">Main menu</span></button>
        {#each groups as g (g.label)}
          <div class="group">{g.label}</div>
          {#each g.tabs as t (t)}
            <a class="nav-row sub" class:on={shownTab === t} href={viewHref(t)} aria-current={shownTab === t ? 'page' : undefined}
              data-sveltekit-replacestate={onStats ? '' : undefined} data-sveltekit-reset={onStats ? 'false' : undefined}
              onclick={(e) => viewClick(e, t)}><span class="lbl">{TAB_LABEL[t]}</span></a>
          {/each}
        {/each}
      </div>
    </div>
  </div>

  <div class="nav-foot">
    {#if isAdmin}
      <a class="nav-row" class:on={onAccount} href="/account" data-tip="Account" aria-current={onAccount ? 'page' : undefined} onclick={nav}>
        <Icon name={onAccount ? 'user-circle-fill' : 'user-circle'} /><span class="lbl">Account</span>
      </a>
      <form method="POST" action="/login?/logout" use:enhance onsubmit={nav}>
        <button class="nav-row" type="submit" data-tip="Sign out"><Icon name="sign-out" /><span class="lbl">Sign out</span></button>
      </form>
      <button class="nav-row" type="button" data-tip="Alerts" onclick={() => { closeDrawer(true); setTimeout(onAlerts); }}
        aria-label={`Alerts${unread > 0 ? ` (${unread} unread)` : ''}`}>
        <span class="bellwrap"><Icon name="bell" />{#if unread > 0}<span class="unread">{unread}</span>{/if}</span><span class="lbl">Alerts</span>
      </button>
    {:else}
      <a class="nav-row" class:on={onLogin} href="/login" data-tip="Sign in" aria-current={onLogin ? 'page' : undefined} onclick={signInHere}><Icon name="sign-in" /><span class="lbl">Sign in</span></a>
    {/if}
    <button class="nav-row" type="button" onclick={onTheme} data-tip={theme === 'light' ? 'Dark mode' : 'Light mode'}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} /><span class="lbl">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
    </button>
  </div>
{/snippet}

<nav class="site-sidebar nav-shell" aria-label="Site menu" data-collapsed={pref === 'collapsed' ? '' : undefined}
  data-expanded={pref === 'expanded' ? '' : undefined} class:ready>
  {@render inner(false)}
</nav>

<nav class="phone-bar" aria-label="Primary">
  {#each PHONE_BAR as href (href)}
    {@const row = MAIN_ROWS.find((r) => r.href === href)!}
    {@const on = here(row)}
    <a {href} class:on aria-current={on ? 'page' : undefined} onclick={href === '/stats' ? statsBarClick : undefined}><Icon name={icon(row, on)} /><span>{row.label}</span></a>
  {/each}
  {#if isAdmin}
    <a href="/account" class:on={onAccount} aria-current={onAccount ? 'page' : undefined}>
      <Icon name={onAccount ? 'user-circle-fill' : 'user-circle'} /><span>Account</span>
    </a>
  {:else}
    <a href="/login" class:on={onLogin} aria-current={onLogin ? 'page' : undefined} onclick={signInHere}><Icon name="sign-in" /><span>Sign in</span></a>
  {/if}
  <button class="phone-menu" class:on={drawerOpen} type="button" aria-haspopup="dialog" aria-expanded={drawerOpen} onclick={openDrawer}>
    <Icon name="list" /><span>Menu</span>
  </button>
</nav>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="nav-drawer" class:shown bind:this={dlg} aria-label="Menu"
  oncancel={(e) => { e.preventDefault(); closeDrawer(); }} onclick={(e) => e.target === dlg && closeDrawer()}>
  {#if drawerMounted}
    <nav class="nav-shell drawer-panel" aria-label="Site menu" class:ready>{@render inner(true)}</nav>
  {/if}
</dialog>

<style>
  .nav-shell {
    --row-h: 40px; --ico: 20px; --r: 8px;
    --hover: color-mix(in srgb, var(--color-text) 7%, transparent);
    --ring: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);
    --lbl-w: auto; --lbl-flex: 1; --row-gap: 12px; --row-jc: flex-start; --row-pad: 12px; --hide: inline-flex;
    --drill-x: -50%; --main-vis: hidden; --stats-vis: visible;
    display: flex; flex-direction: column; box-sizing: border-box; font-size: 0.875rem;
    background: color-mix(in srgb, var(--color-accent) 6%, var(--color-bg)); border-right: 1px solid var(--color-border);
  }
  .site-sidebar { --nav-w: 248px; z-index: 45; position: sticky; top: 0; height: 100dvh; width: var(--nav-w); flex: none; }
  .site-sidebar.ready { transition: width 0.24s cubic-bezier(0.2, 0, 0, 1); }
  /* Collapsed: a cookie says so, or no cookie and a mid-width window (641-1100px). The main icons only.
     Keep in sync: the two blocks below set the same properties (CSS can't share one block between an attribute and a media query). */
  .site-sidebar[data-collapsed] {
    --nav-w: 64px; --lbl-w: 0px; --lbl-flex: 0 0 0; --row-gap: 0px; --row-jc: center; --row-pad: 0px; --hide: none;
    --drill-x: 0%; --main-vis: visible; --stats-vis: hidden; --clip: visible; --panel-oy: visible; --tip: block; --caret-l: none; --caret-r: inline-flex;
  }
  @media (min-width: 641px) and (max-width: 1100px) {
    .site-sidebar:not([data-expanded]) {
      --nav-w: 64px; --lbl-w: 0px; --lbl-flex: 0 0 0; --row-gap: 0px; --row-jc: center; --row-pad: 0px; --hide: none;
      --drill-x: 0%; --main-vis: visible; --stats-vis: hidden; --clip: visible; --panel-oy: visible; --tip: block; --caret-l: none; --caret-r: inline-flex;
    }
  }

  /* A short window can't fit the whole strip without scrolling: no tooltips there, the lists scroll. */
  @media (max-height: 559px) { .site-sidebar { --clip: clip !important; --panel-oy: auto !important; --tip: none !important; } }
  /* Collapsed icons name themselves on hover and focus (a title tip is not allowed: ui-rules). */
  .nav-row[data-tip]::after, .icon-btn[data-tip]::after {
    content: attr(data-tip); display: none; position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%); z-index: 70;
    padding: 4px 10px; border: 1px solid var(--color-border); border-radius: var(--r); background: var(--color-surface); color: var(--color-text);
    box-shadow: var(--shadow-hover); font-size: 0.8rem; font-weight: 500; white-space: nowrap; pointer-events: none;
  }
  .icon-btn { position: relative; }
  .caret-l { display: var(--caret-l, inline-flex); }
  .caret-r { display: var(--caret-r, none); }
  @media (hover: hover) { .nav-row[data-tip]:hover::after, .icon-btn[data-tip]:hover::after { display: var(--tip, none); } }
  .nav-row[data-tip]:focus-visible::after, .icon-btn[data-tip]:focus-visible::after { display: var(--tip, none); }

  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 12px 8px 16px; min-height: 44px; box-sizing: border-box; }
  .site-sidebar[data-collapsed] .head { justify-content: center; padding: 12px 0 8px; }
  .brand { display: var(--hide); font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; color: var(--color-label); }
  .icon-btn {
    display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: none;
    border: 0; border-radius: var(--r); background: none; color: var(--color-text-muted); cursor: pointer;
  }
  .icon-btn :global(.icon), .nav-row :global(.icon) { width: var(--ico); height: var(--ico); flex: none; }
  .icon-btn:hover { background: var(--hover); color: var(--color-text); }
  .icon-btn:focus-visible, .nav-row:focus-visible { outline: none; box-shadow: var(--ring); }

  /* clip, not hidden: focus() must never scroll the sliding track. */
  .clip { flex: 1; min-height: 0; overflow: var(--clip, clip); position: relative; }
  /* Absolute so the panels get a definite height and scroll on their own above the footer. */
  .track { display: flex; position: absolute; top: 0; bottom: 0; left: 0; width: 200%; pointer-events: none; } /* collapsed, the clip is off and the 200% track overhangs the page: only the panels take clicks */
  .track.anim { transition: transform 0.24s cubic-bezier(0.2, 0, 0, 1); }
  .track.drilled { transform: translateX(var(--drill-x)); }
  .nav-panel { pointer-events: auto; width: 50%; flex: none; box-sizing: border-box; padding: 4px 8px; overflow-y: var(--panel-oy, auto); display: flex; flex-direction: column; gap: 2px; }
  .anim .nav-panel { transition: visibility 0.24s; }
  .panel-stats { visibility: hidden; }
  .drilled .panel-main { visibility: var(--main-vis); }
  .drilled .panel-stats { visibility: var(--stats-vis); }
  .nav-foot { padding: 8px; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: 2px; }
  .nav-foot form { display: contents; }

  .nav-row {
    position: relative; display: flex; align-items: center; justify-content: var(--row-jc); gap: var(--row-gap); box-sizing: border-box; width: 100%;
    min-height: var(--row-h); padding: 0 var(--row-pad); border: 0; border-radius: var(--r); background: none;
    color: var(--color-text-muted); font: inherit; font-weight: 500; text-decoration: none; text-align: left; cursor: pointer;
  }
  .lbl { flex: var(--lbl-flex); width: var(--lbl-w); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chev { display: var(--hide); opacity: 0.6; }
  .chev :global(.icon) { width: 16px; height: 16px; }
  @media (hover: hover) { .nav-row:hover { background: var(--hover); color: var(--color-text); } }
  .nav-row.on { background: color-mix(in srgb, var(--color-accent) 9%, transparent); color: var(--color-accent); font-weight: 600; }
  .nav-row.on::before { content: ''; position: absolute; left: -8px; top: 6px; bottom: 6px; width: 3px; border-radius: 0 3px 3px 0; background: var(--color-accent); }
  .contains-current { color: var(--color-accent); font-weight: 600; } /* the Stats row while on a Stats page */
  .nav-back { color: var(--color-text); font-weight: 600; margin-bottom: 4px; }
  .group { padding: 16px 12px 4px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; font-variant: small-caps; color: var(--color-text-muted); }
  .sub { padding-left: 16px; }
  .bellwrap { position: relative; display: inline-flex; }
  .unread {
    position: absolute; top: -6px; right: -8px; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 8px;
    background: var(--color-urgent); color: #fff; font-size: 0.65rem; font-weight: 700; line-height: 16px; text-align: center;
  }

  /* ---------- phone: bottom bar + the same panel as a drawer ---------- */
  .phone-bar, .nav-drawer { display: none; }
  @media (max-width: 640px), (max-height: 450px) {
    .site-sidebar { display: none; }
    .nav-row { min-height: 44px; }
    .icon-btn { width: 44px; height: 44px; }
    .phone-bar {
      display: flex; position: fixed; z-index: 40; left: 0; right: 0; bottom: 0; box-sizing: border-box;
      background: var(--color-surface); border-top: 1px solid var(--color-border); padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .phone-bar > * {
      flex: 1 1 0; min-width: 0; height: 60px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      position: relative; border: 0; background: none; color: var(--color-text-muted); font: inherit; font-size: 0.7rem; font-weight: 500;
      text-decoration: none; cursor: pointer; padding: 6px 2px 10px;
    }
    .phone-bar :global(.icon) { width: 24px; height: 24px; }
    .phone-bar > .on { color: var(--color-accent); font-weight: 600; }
    .phone-bar > .on::after { content: ''; position: absolute; bottom: 5px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--color-accent); }
    .phone-bar > :focus-visible { outline: none; box-shadow: inset var(--ring); border-radius: 12px; }

    .nav-drawer {
      position: fixed; inset: 0; width: 100%; max-width: none; height: 100%; max-height: none; margin: 0; padding: 0; border: 0;
      background: none; color: inherit; overflow: hidden;
    }
    .nav-drawer[open] { display: block; }
    .nav-drawer::backdrop { background: rgba(0, 0, 0, 0.5); opacity: 0; transition: opacity 0.24s cubic-bezier(0.2, 0, 0, 1); }
    .nav-drawer.shown::backdrop { opacity: 1; }
    .drawer-panel {
      position: absolute; top: 0; bottom: 0; left: 0; width: min(86vw, 320px); padding-bottom: env(safe-area-inset-bottom, 0px);
      transform: translateX(-100%); transition: transform 0.24s cubic-bezier(0.2, 0, 0, 1);
    }
    .shown .drawer-panel { transform: none; }
    .drawer-panel .nav-row.on::before { left: -8px; }
  }
  @media (max-height: 450px) { /* landscape phone: slimmer bar */
    .phone-bar > * { height: 44px; flex-direction: row; gap: 6px; padding: 4px 2px; }
    .phone-bar :global(.icon) { width: 20px; height: 20px; }
    .phone-bar > .on::after { display: none; }
    .phone-bar > .on { box-shadow: inset 0 -2px var(--color-accent); }
  }
  @media (prefers-reduced-motion: reduce) {
    .site-sidebar.ready, .track.anim, .anim .nav-panel, .drawer-panel, .nav-drawer::backdrop { transition: none; }
  }
</style>
