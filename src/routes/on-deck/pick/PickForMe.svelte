<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { labelTip } from '#lib/components/labelTip.ts';
  import { originWithFlag } from '#lib/countryFlags.ts';
  import { showToast } from '#lib/toast.svelte.ts';
  import { buildPool, resolveCrits } from '#lib/pick/pool.ts';
  import { boardMatches, fillBoard } from '#lib/pick/board.ts';
  import { DEFAULT_RULES, rulesDiffer } from '#lib/pick/rules.ts';
  import { cleanName, type Profiles } from '#lib/pick/profiles.ts';
  import { discard, markBrewed, resetDay } from '#lib/pick/today.ts';
  import { sliceAt, wheelSlices } from '#lib/pick/wheel.ts';
  import type { Game, PickCoffee, PickResult, PickRules, PickToday, Slot, WheelSlice } from '#lib/pick/types.ts';
  import PickBoard from './PickBoard.svelte';
  import PickCard from './PickCard.svelte';
  import PickD20 from './PickD20.svelte';
  import PickRulesPanel from './PickRules.svelte';
  import PickWheel from './PickWheel.svelte';
  import { flushToday, loadProfiles, loadRules, loadToday, saveProfiles, saveRules, saveToday } from './store';

  type Shared = { name: string; rules: PickRules } | { name: string; missing: true } | { defaults: true } | null;
  // `shared`: a share link's rules (a saved profile, or the defaults) or a profile that was not found; `onunshare` drops them from the URL.
  // `shareRules`: what the page's Share button adds for the rules in play.
  let { pick, admin, game, ongame, shared, onunshare, shareRules = $bindable() }: {
    pick: { coffees: PickCoffee[]; today: string; rulesLast: unknown; profiles: unknown; savedRules: unknown; todayState: unknown };
    admin: boolean; game: Game; ongame: (g: Game) => void; shared: Shared; onunshare: () => void; shareRules?: { profile?: string; defaultRules?: boolean };
  } = $props();
  const sharedRules = $derived(shared && 'rules' in shared ? shared.rules : shared && 'defaults' in shared ? DEFAULT_RULES : null);
  // While shared rules are in play nothing is saved over the visitor's (or admin's) own rules; today's state still saves.
  const ownRules = () => loadRules(admin, admin ? pick.rulesLast : null);

  const coffees = untrack(() => pick.coffees);
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const names = new Map(coffees.map((c) => [c.id, c.name]));

  // Admins start from the server's values; visitors' live in localStorage, so they load after mount.
  let ready = $state(untrack(() => admin));
  let rules = $state<PickRules>(untrack(() => sharedRules ?? (admin ? loadRules(true, pick.rulesLast) : DEFAULT_RULES)));
  let today = $state<PickToday>(untrack(() => loadToday(admin, admin ? pick.todayState : null, pick.today)));
  let profiles = $state<Profiles>(untrack(() => (admin ? loadProfiles(true, pick.profiles, pick.savedRules) : {})));
  let selected = $state(''); // the profile the rules came from (a base: further edits do not change it until Save)
  let selBefore = '';
  let busy = $state(false);
  let rollAgain = $state(false);
  let panelOpen = $state(false); // never saved or restored: the panel starts closed
  let announce = $state('');
  let pendingRules = $state<PickRules | null>(null);
  let wheel = $state<PickWheel>();
  let dlg: HTMLDialogElement;
  let chosen = false; // A or B picked; otherwise a closed dialog is a cancel
  let rev = $state(0); // bumped on cancel so the panel re-reads `rules`
  let restored = false;
  let shown = $state(false); // result overlay (every width): opens ~1.5s after a fresh result lands, never for a restored one
  let landing = $state(false); // between the landing and the overlay: the inline card waits too
  let modalEl: HTMLDivElement | undefined = $state();
  let prevFocus: HTMLElement | null = null;
  // The wheel is as big as leaves Out for today on screen below it (never over 460px or under 320px): measured from the stage's top.
  let vh = $state(900);
  let stageEl: HTMLElement | undefined = $state();
  let outEl: HTMLElement | undefined = $state();
  let stageTop = $state(0);
  let outH = $state(0);
  let narrow = $state(false); // stacked (the card between the game and Out for today): no height budget for the wheel
  let measured = $state(false); // until measured the CSS estimate below sizes the wheel (no visible jump)
  const wheelMax = $derived(narrow ? 460 : Math.round(Math.max(320, Math.min(460, vh - stageTop - outH - 4))));
  const measure = () => {
    if (!stageEl || !outEl) return;
    vh = innerHeight; narrow = stageEl.parentElement!.clientWidth < 1226; /* the stacked layout (see the container query below) */ stageTop = stageEl.getBoundingClientRect().top + scrollY;
    outH = outEl.offsetHeight + (parseFloat(getComputedStyle(stageEl).rowGap) || 0); measured = true;
  };
  $effect(() => { game; ready; tick().then(measure); });
  // Anything above the stage changing height (the header, wrapping controls, a late font) or the out row wrapping re-measures.
  $effect(() => {
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    if (outEl) ro.observe(outEl);
    return () => ro.disconnect();
  });
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CONFETTI = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.12, dur: 1.6 + (i % 5) * 0.3, color: ['#ffe08a', '#ffd04d', '#fff6d0', '#c9952c'][i % 4] }));

  onMount(() => {
    if (!admin) {
      rules = untrack(() => sharedRules) ?? loadRules(false, null);
      today = loadToday(false, null, pick.today);
      profiles = loadProfiles(false, null, null);
      ready = true;
    }
    const hide = () => flushToday();
    const vis = () => document.visibilityState === 'hidden' && flushToday();
    addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(showTimer); removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', vis); };
  });

  // Coming back: the URL's game wins; with none, today's last game returns. After that the URL drives `today.game`.
  $effect(() => {
    if (!ready) return;
    const g = game;
    untrack(() => {
      if (!restored) {
        restored = true;
        if (g === 'wheel' && today.game === 'd20') return void tick().then(() => ongame('d20'));
      }
      if (today.game !== g) today.game = g;
    });
  });
  onDestroy(flushToday);

  // Use my rules (the shared ones dropped from the URL): back to the saved own rules.
  let wasShared = untrack(() => !!sharedRules);
  $effect(() => {
    const now = !!sharedRules;
    if (!ready || now === wasShared) return;
    wasShared = now;
    untrack(() => { rules = ownRules(); selected = ''; rev++; today = { ...today, board: null }; });
  });
  // Share carries the loaded profile (its saved version), else the default rules; visitors have no saved profiles of the owner's.
  $effect(() => {
    shareRules = !ready ? undefined : shared && 'rules' in shared ? { profile: shared.name } : shared && 'defaults' in shared ? { defaultRules: true } : admin && selected && profiles[selected] ? { profile: selected } : { defaultRules: true };
  });

  // Save only real changes (not the state just loaded).
  let saved = '';
  $effect(() => {
    if (!ready) return;
    const snap = $state.snapshot(today);
    const json = JSON.stringify({ ...snap, board: null }); // the board snapshot alone is not a change worth a write
    if (saved === '') return void (saved = json);
    if (json !== saved) { saved = json; saveToday(admin, snap); }
  });

  const out = $derived(new Set(today.out));
  const pool = $derived(resolveCrits(coffees, rules, out));
  const successC = $derived(pool.success);
  const failC = $derived(pool.fail);
  const slices = $derived(wheelSlices(pool.pool, successC.length > 0, failC.length > 0));
  const empty = $derived(slices.length === 0);
  const eligible = $derived.by(() => {
    const all = buildPool(coffees, { ...rules, over20: 'first20' }, out);
    return [...all.pool, ...all.sittingOut];
  });
  const computeBoard = (): Slot[] => fillBoard(pool.pool, rules, successC.length > 0, failC.length > 0, `${today.date}:${today.out.join(',')}`);
  // A stored board holds only while it still matches a fresh deal (a coffee archived or opened mid-day invalidates it).
  const fresh = $derived(computeBoard());
  const board = $derived(today.board && boardMatches(today.board, fresh) ? today.board : fresh);
  // Snapshot the board so Shuffle and Random look the same after leaving and coming back.
  $effect(() => {
    if (ready && board !== untrack(() => today.board)) today.board = board;
  });

  const result = $derived(today.result);
  const resultCoffee = $derived(result ? byId.get(result.coffeeId) : undefined);
  const outRow = $derived(today.out.flatMap((id) => byId.get(id) ?? []));
  // The out-for-today badge's tip: who it is, a detail line as on the /coffees card, and why it is out.
  const outTip = (c: PickCoffee) => ({
    title: c.name,
    lines: [c.roaster, [c.origin ? originWithFlag(c.origin) : null, c.processing].filter(Boolean).join(' · '), today.brewed.includes(c.id) ? 'Brewed today' : 'Discarded today'].filter(Boolean)
  });
  // Save is for a loaded profile whose rules have changed since.
  const canSave = $derived(!!selected && !!profiles[selected] && rulesDiffer(profiles[selected], rules));
  const TAU = Math.PI * 2;
  const critFor = (n: number) => {
    const k = board[n - 1]?.kind;
    return k === 'success' || k === 'fail' ? k : null;
  };
  // Not while the Rules modal is open: one Escape then closes only the top layer.
  const overlay = $derived(shown && !!result && !panelOpen);
  const inlineCard = $derived(!(landing || overlay)); // the card waits for the pop-up and returns when it closes
  // The highlighted row must still match the board (it is redrawn when a coffee goes out or the rules change).
  const rolledN = $derived.by(() => {
    const n = game === 'd20' ? result?.n : undefined;
    const s = n ? board[n - 1] : undefined;
    if (!n || !result || !s) return null;
    return s.kind === 'coffee' ? (result.via === 'normal' && s.coffeeId === result.coffeeId ? n : null) : s.kind === result.via ? n : null;
  });
  const dismissOverlay = () => { shown = false; };
  // Escape closes the pop-up; Tab and Shift+Tab stay inside it while it is open (aria-modal).
  function onKey(e: KeyboardEvent) {
    if (!overlay || dlg?.open) return;
    if (e.key === 'Escape') return dismissOverlay();
    if (e.key !== 'Tab' || !modalEl) return;
    const els = [...modalEl.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const [first, last] = [els[0], els[els.length - 1]];
    if (!first || !last) { e.preventDefault(); modalEl.focus(); return; } // every button disabled (busy): focus stays on the dialog itself
    if (!modalEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  // Focus: the overlay's Close button on open, the control that was focused before on close.
  let overlayWas = false;
  $effect(() => {
    if (overlay) {
      overlayWas = true;
      prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      tick().then(() => modalEl?.querySelector<HTMLButtonElement>('[data-close]')?.focus());
    } else if (overlayWas) {
      overlayWas = false;
      if (prevFocus?.isConnected) prevFocus.focus();
    }
  });

  const any = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
  // Clearing first makes a repeated message ("Roll again" twice) announce again.
  async function say(text: string) {
    announce = '';
    await tick();
    announce = text;
  }
  function land(r: PickResult) {
    busy = false;
    today.result = r;
    shown = false;
    landing = true;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => { landing = false; shown = true; }, reduced() ? 0 : 1500);
    say(`Picked ${byId.get(r.coffeeId)?.name ?? ''}`);
  }
  function again() {
    busy = false;
    rollAgain = true;
    say('Roll again');
  }

  function spin() {
    if (busy || empty || !wheel) return;
    rollAgain = false;
    busy = true;
    shown = false;
    landing = false;
    clearTimeout(showTimer);
    wheel.spinTo(sliceAt(slices, Math.random() * TAU));
  }
  function wheelResult(s: WheelSlice, angle: number) {
    today.wheelAngle = angle;
    if (s.kind === 'coffee') return land({ coffeeId: s.coffeeId!, via: 'normal' });
    const c = any(s.kind === 'success' ? successC : failC);
    if (c) land({ coffeeId: c.id, via: s.kind });
    else busy = false;
  }
  function d20Result(n: number, pose: PickToday['d20Pose']) {
    today.d20Pose = pose;
    const s = board[n - 1];
    const c = s?.kind === 'coffee' ? byId.get(s.coffeeId) : s?.kind === 'success' ? any(successC) : s?.kind === 'fail' ? any(failC) : undefined;
    if (!c || !s) return again();
    land({ coffeeId: c.id, via: s.kind === 'coffee' ? 'normal' : (s.kind as 'success' | 'fail'), n });
  }
  function startD20() {
    rollAgain = false;
    busy = true;
    shown = false;
    landing = false;
    clearTimeout(showTimer);
  }

  function setGame(g: Game) {
    if (g === game) return;
    busy = false;
    rollAgain = false;
    today.game = g;
    ongame(g);
  }

  function brew() {
    if (!resultCoffee) return;
    today = markBrewed(today, resultCoffee.id, rules);
    saveToday(admin, $state.snapshot(today));
    flushToday();
    goto(`/coffees/${resultCoffee.slug}/brew`);
  }
  const doDiscard = () => resultCoffee && (today = discard(today, resultCoffee.id));
  const openPage = () => resultCoffee && goto(`/coffees/${resultCoffee.slug}`);

  function apply(next: PickRules, reset: boolean) {
    rules = next;
    today = reset ? resetDay(today) : { ...today, board: null };
    if (!sharedRules) saveRules(admin, 'pick.rules.last', next).catch(() => {});
  }
  function edit(next: PickRules) {
    if (!rulesDiffer(rules, next)) return;
    if (today.out.length === 0) return apply(next, false);
    pendingRules = next;
    chosen = false;
    dlg.showModal();
  }
  function choose(reset: boolean) {
    const next = pendingRules;
    chosen = true;
    dlg.close();
    if (next) apply(next, reset);
  }
  function onDialogClose() {
    pendingRules = null;
    if (!chosen) { rev++; selected = selBefore; } // Cancel or Escape: the controls go back to the unchanged rules
  }
  function pickProfile(name: string) {
    if (!name) { selected = ''; return; } // the placeholder: no profile, Save off
    if (!profiles[name]) return;
    selBefore = selected;
    selected = name;
    edit(profiles[name]);
  }
  // Write the whole map; the local copy changes only when the save went through.
  async function storeProfiles(next: Profiles, msg: string, sel = selected): Promise<boolean> {
    try {
      await saveProfiles(admin, next);
      profiles = next;
      selected = sel;
      showToast(msg);
      return true;
    } catch {
      showToast("Couldn't save.");
      return false;
    }
  }
  // Back to the selected profile's saved rules (re-picking it fires no change event).
  function revertProfile() {
    if (!selected || !profiles[selected]) return;
    selBefore = selected;
    edit(profiles[selected]);
  }
  function resetRules() {
    selBefore = selected;
    selected = '';
    edit(DEFAULT_RULES);
  }
  const saveProfile = () => selected ? storeProfiles({ ...profiles, [selected]: $state.snapshot(rules) }, `Saved "${selected}".`) : Promise.resolve(false);
  function saveProfileAs(raw: string): Promise<boolean> {
    const n = cleanName(raw);
    return n ? storeProfiles({ ...profiles, [n]: $state.snapshot(rules) }, `Saved "${n}".`, n) : Promise.resolve(false);
  }
  function deleteProfile(): Promise<boolean> {
    const { [selected]: gone, ...rest } = profiles;
    return gone ? storeProfiles(rest, `Deleted "${selected}".`, '') : Promise.resolve(false);
  }
</script>

<svelte:window onresize={measure} onkeydown={onKey} />

{#if ready}
  <div class="search-row game-row">
    <div class="form-field group-field">
      <span>Game</span>
      <div class="tab-group" role="group" aria-label="Game">
        <button type="button" aria-pressed={game === 'wheel'} onclick={() => setGame('wheel')}>Wheel</button>
        <button type="button" aria-pressed={game === 'd20'} onclick={() => setGame('d20')}>D20</button>
      </div>
    </div>
    {#key rev}
    <PickRulesPanel {rules} {coffees} {eligible} names={Object.keys(profiles).sort((a, b) => a.localeCompare(b))} {selected} {canSave} open={panelOpen} locked={busy}
      ontoggle={(o) => (panelOpen = o)} onchange={edit} onpick={pickProfile} onsave={saveProfile} onsaveas={saveProfileAs} ondelete={deleteProfile} onreset={resetRules} onrevert={revertProfile} />
    {/key}
  </div>
  {#if shared}
    <p class="shared-note" role="status">
      <span>{#if 'missing' in shared}That rules profile wasn't found.{:else if 'defaults' in shared}Playing with the default rules.{:else}Playing with the “{shared.name}” rules.{/if}</span>
      <button type="button" class="button button-secondary" onclick={onunshare}>{'missing' in shared ? 'Dismiss' : 'Use my rules'}</button>
    </p>
  {/if}

  <div class="stage-box"><div class="stage" class:d20={game === 'd20'} bind:this={stageEl}>
    <section class="game" aria-label={game === 'd20' ? 'D20' : 'Wheel'}>
      {#if game === 'wheel'}
        <div class="wheel-wrap" style:--wheel-max={measured ? `${wheelMax}px` : undefined}>
          <PickWheel bind:this={wheel} {slices} {names} angle={today.wheelAngle} disabled={empty} onspin={spin} onresult={wheelResult} />
        </div>
      {:else}
        <PickD20 pose={today.d20Pose} disabled={empty} onresult={d20Result} {critFor} onstart={startD20} onfail={() => (busy = false)} />
      {/if}
      {#if empty}<p class="text-muted">No coffees in play. Change the rules or reset today.</p>{/if}
      {#if rollAgain}<p class="roll-again" role="status">That number is crossed out today. Roll again.</p>{/if}
    </section>

    <div class="side">
      {#if inlineCard}
        {#if result && resultCoffee}<h3 class="last">{game === 'd20' ? 'Your last roll' : 'Your last spin'}</h3>{/if}
        <div class="result card" class:empty={!(result && resultCoffee)}>
        {#if result && resultCoffee}
          <PickCard wide coffee={resultCoffee} {result} out={out.has(resultCoffee.id)} brewed={today.brewed.includes(resultCoffee.id)} {busy}
            onbrew={brew} ondiscard={doDiscard} onopen={openPage} />
        {:else}
          <p class="text-muted">{game === 'd20' ? 'Roll the die to pick a coffee.' : 'Spin the wheel to pick a coffee.'}</p>
        {/if}
        </div>
      {/if}
    </div>

    <!-- after the card in the DOM and on screen when stacked; beside, the grid puts it directly below the game -->
    <div class="out-row" bind:this={outEl}>
      <span class="label">Out for today:</span>
      {#each outRow as c (c.id)}<span class="badge badge-neutral" tabindex="0" role="note" use:labelTip={outTip(c)}><s>{c.name}</s></span>{:else}<span class="text-muted">nothing yet</span>{/each}
      <button type="button" class="button button-secondary" disabled={today.out.length === 0 && today.brewed.length === 0} onclick={() => (today = resetDay(today))}>Reset today</button>
    </div>
  </div></div>
  {#if game === 'd20'}<PickBoard {board} {byId} success={successC} fail={failC} rolled={rolledN} />{/if}


  {#if overlay && result && resultCoffee}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled on the window) -->
    <div class="modal-backdrop" onclick={(e) => e.target === e.currentTarget && dismissOverlay()}>
      {#if result.via !== 'normal'}
        <div class="fx {result.via}" aria-hidden="true">
          {#if result.via === 'success'}{#each CONFETTI as c, i (i)}<i style:left="{c.left}%" style:animation-delay="{c.delay}s" style:animation-duration="{c.dur}s" style:background={c.color}></i>{/each}{/if}
        </div>
      {/if}
      <div class="modal pick-modal {result.via}" class:horizontal={!narrow} role="dialog" aria-modal="true" aria-label="Pick result" tabindex="-1" bind:this={modalEl}>
        {#if game === 'd20' && result.n}
          <p class="rolled {result.via}" aria-live="polite">You rolled<b>{result.n}</b>{#if result.via !== 'normal'}<span class="crit-word">{result.via === 'success' ? 'Crit success' : 'Crit fail'}</span>{/if}</p>
        {/if}
        <PickCard wide={!narrow} coffee={resultCoffee} {result} out={out.has(resultCoffee.id)} brewed={today.brewed.includes(resultCoffee.id)} {busy}
          onbrew={brew} ondiscard={doDiscard} onopen={openPage} onclose={dismissOverlay} />
      </div>
    </div>
  {/if}

  <div class="sr-only" aria-live="polite">{announce}</div>

  <dialog class="rules-dialog" aria-labelledby="pick-dlg-title" bind:this={dlg} onclose={onDialogClose}>
    <h2 id="pick-dlg-title">Change the rules</h2>
    <p>Something is already out for today.</p>
    <div class="dlg-buttons">
      <button type="button" class="button" onclick={() => choose(true)}>Reset today and use the new rules</button>
      <button type="button" class="button button-secondary" onclick={() => choose(false)}>Keep today's out list with the new rules</button>
      <button type="button" class="button button-secondary" onclick={() => dlg.close()}>Cancel</button>
    </div>
  </dialog>
{/if}

<style>
  /* one column in DOM and visual order: the game, the card, then Out for today, all left-aligned; the card is as tall as
     the D20 tray (--pick-h: PickD20's 360px stage) */
  .stage { --pick-h: 360px; margin: 0; max-width: 674px; display: grid; gap: 1.25rem var(--space-6); align-items: start; }
  .game { min-width: 0; max-width: 620px; display: flex; flex-direction: column; }
  .out-row { max-width: 620px; }
  .side { position: relative; display: flex; flex-direction: column; min-width: 0; }
  .last { margin: 0 0 var(--space-2); font-size: 1rem; } /* stacked: in the flow above the card */
  .wheel-wrap { width: 100%; --wheel-size: var(--wheel-max, clamp(320px, 100vh - 400px, 460px)); } /* ponytail: the CSS estimate (stage top about 310px + the out row) until measured */
  .result { display: flex; align-self: start; width: 100%; max-width: 674px; } /* .card sizes by its container, so the width is explicit */
  @media (max-width: 720px) { .result { max-width: 480px; } } /* the vertical card: the /coffees card's width on a phone (its thumbnail the full content width) */
  .result:hover { box-shadow: var(--shadow); transform: none; } /* not clickable: no .card hover lift */
  @media (max-width: 640px) { .result.empty { display: none; } } /* no placeholder on a phone (and no flash before the script runs) */
  /* the result pop-up (every width) hugs its card: little padding around it */
  .pick-modal { position: relative; width: auto; max-width: 100%; padding: var(--space-3); }
  .pick-modal :global(.pick-card) { margin: 0 auto; }
  /* where the inline card is horizontal (beside layout, see `narrow`) the pop-up shows that card too: a `card` container for its own query, wide enough for the 4 buttons */
  .pick-modal.horizontal { container: card / inline-size; width: 760px; max-width: calc(100vw - 2 * var(--space-4)); }
  .rolled { margin: 0 0 var(--space-2); text-align: center; font-family: var(--font-display); font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
  .rolled b { display: block; font-size: 3.5rem; line-height: 1; letter-spacing: 0; color: var(--color-accent); }
  /* a crit: a dark panel (the same dark in both themes, like the D20 tray, so the colours keep their contrast) with its glow; a normal roll stays plain */
  .crit-word { display: block; margin-top: var(--space-1); font-size: 0.85rem; }
  .rolled.success, .rolled.fail { position: relative; overflow: hidden; padding: var(--space-3) var(--space-2); border-radius: var(--radius); }
  .rolled.success { color: #ffe08a; background: radial-gradient(ellipse 70% 80% at 50% 62%, rgba(255, 208, 77, 0.55), transparent 70%), #2a1d05; box-shadow: 0 0 22px rgba(255, 208, 77, 0.45); }
  .rolled.success b { color: transparent; background: linear-gradient(100deg, #b8860b 0%, #ffe08a 35%, #fff6d0 50%, #ffd04d 65%, #b8860b 100%) 40% 0 / 250% 100%; -webkit-background-clip: text; background-clip: text; filter: drop-shadow(0 0 8px rgba(255, 208, 77, 0.7)); animation: shimmer 2.4s linear infinite; }
  @media (forced-colors: active) { .rolled.success b { color: CanvasText; background: none; filter: none; } .rolled.fail b { color: CanvasText; text-shadow: none; } } /* the gold is a background clip: system colours instead */
  .rolled.success::before, .rolled.success::after { content: '\2726'; content: '\2726' / ''; position: absolute; color: #fff6d0; text-shadow: 0 0 6px #ffd04d; animation: twinkle 1.6s ease-in-out infinite; }
  .rolled.success::before { top: 22%; left: 20%; font-size: 1.1rem; }
  .rolled.success::after { bottom: 12%; right: 18%; font-size: 0.8rem; animation-delay: 0.8s; }
  .rolled.fail { color: #f3b4b4; background: radial-gradient(ellipse 70% 80% at 50% 62%, rgba(208, 28, 28, 0.5), transparent 70%), #150303; box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.85), 0 0 18px rgba(122, 10, 10, 0.6); animation: shake 0.5s 1; }
  .rolled.fail b { color: #ff5a4a; text-shadow: 0 0 14px rgba(208, 28, 28, 0.9); animation: ember 3s ease-in-out infinite; }
  @keyframes shimmer { to { background-position: -160% 0; } }
  @keyframes twinkle { 0%, 100% { opacity: 0.15; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.15); } }
  @keyframes ember { 50% { text-shadow: 0 0 26px rgba(208, 28, 28, 1); opacity: 0.82; } }
  @keyframes shake { 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
  @media (prefers-reduced-motion: reduce) { .rolled, .rolled b, .rolled::before, .rolled::after { animation: none !important; } .rolled.success::before, .rolled.success::after { opacity: 1; } }
  .pick-modal.success { box-shadow: 0 0 0 3px #ffe08a, 0 0 32px #d4a73a; }
  .pick-modal.fail { box-shadow: 0 0 0 3px #d01c1c, 0 0 32px #7a0a0a; }
  .fx { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .fx.fail { background: radial-gradient(circle, transparent 30%, rgba(90, 0, 0, 0.85) 100%); animation: fade-in 0.6s; }
  .fx.success { background: radial-gradient(circle, rgba(255, 224, 138, 0.25), transparent 70%); }
  .fx i { position: absolute; top: -12px; width: 8px; height: 8px; border-radius: 2px; animation: fall linear 1 both; }
  @keyframes fall { to { transform: translateY(105vh) rotate(540deg); opacity: 0; } }
  @keyframes fade-in { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .fx i { display: none; } .fx.fail { animation: none; } }
  /* the same layout for both games: the card beside the game (with a real gutter) only where it gets the room for its horizontal form next
     to the 620px game; narrower, it goes under the game (PickCard's own container query picks the horizontal or vertical form) */
  .stage-box { container-type: inline-size; margin-bottom: var(--space-3); }
  @container (min-width: 1226px) { /* 520 game + 32 gutter + 674 (the card: 640px of content, padding and border): beside always means horizontal; the game column takes up to 620. 1280 less a 15px scrollbar still gets it */
    .stage { max-width: none; grid-template-columns: minmax(520px, 620px) minmax(674px, 1fr); }
    .game, .out-row { grid-column: 1; }
    .game { grid-row: 1; }
    .out-row { grid-row: 2; }
    .side { grid-column: 2; grid-row: 1 / span 2; }
    .last { position: absolute; bottom: 100%; margin: 0 0 var(--space-2); } /* beside: in the space above the card (level with the Game row), the card stays level with the game */
    .result { max-width: none; }
  }
  .out-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: 0; }
  .out-row .button { margin: 0; padding: 0.35rem 0.5rem; min-height: 36px; font-size: 0.85rem; }
  @media (max-width: 640px) { .out-row .button { min-height: 44px; } }
  .out-row .label { font-weight: 600; }
  .out-row .badge { white-space: normal; max-width: 100%; overflow-wrap: anywhere; }
  /* compact: the Game label beside its buttons, tight gaps, so Out for today stays on screen */
  .game-row .group-field { flex-direction: row; align-items: center; gap: var(--space-2); }
  .game-row { margin-bottom: var(--space-2); }
  /* the callout look (a tinted panel); the button sits right of the text and wraps below it on a narrow screen */
  .shared-note { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); margin: 0 0 var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-warm); border-radius: var(--radius); background: color-mix(in srgb, var(--color-warm) 12%, transparent); max-width: 620px; }
  .shared-note .button { margin: 0; padding: 0.35rem 0.75rem; min-height: 36px; }
  @media (max-width: 640px) { .shared-note .button { min-height: 44px; } }
  .rules-dialog { max-width: min(32rem, 100% - 2rem); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: inherit; padding: var(--space-4); }
  .rules-dialog h2 { padding: 0; border: 0; margin: 0 0 var(--space-2); } /* not the section heading's divider */
  .dlg-buttons { display: grid; gap: var(--space-2); }
  .dlg-buttons :global(.button) { min-height: 44px; }
</style>
