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

  let { pick, admin, game, ongame }: {
    pick: { coffees: PickCoffee[]; today: string; rulesLast: unknown; profiles: unknown; savedRules: unknown; todayState: unknown };
    admin: boolean; game: Game; ongame: (g: Game) => void;
  } = $props();

  const coffees = untrack(() => pick.coffees);
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const names = new Map(coffees.map((c) => [c.id, c.name]));

  // Admins start from the server's values; visitors' live in localStorage, so they load after mount.
  let ready = $state(untrack(() => admin));
  let rules = $state<PickRules>(untrack(() => (admin ? loadRules(true, pick.rulesLast) : DEFAULT_RULES)));
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
  let phone = $state(false);
  let shown = $state(false); // phone overlay: opens ~1.5s after a fresh result lands, never for a restored one
  let landing = $state(false); // between the landing and the overlay: the inline card waits too
  let modalEl: HTMLDivElement | undefined = $state();
  let prevFocus: HTMLElement | null = null;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CONFETTI = Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.12, dur: 1.6 + (i % 5) * 0.3, color: ['#ffe08a', '#ffd04d', '#fff6d0', '#c9952c'][i % 4] }));

  onMount(() => {
    if (!admin) {
      rules = loadRules(false, null);
      today = loadToday(false, null, pick.today);
      profiles = loadProfiles(false, null, null);
      ready = true;
    }
    const mq = matchMedia('(max-width: 640px)');
    const onMq = () => (phone = mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    const hide = () => flushToday();
    const vis = () => document.visibilityState === 'hidden' && flushToday();
    addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    return () => { mq.removeEventListener('change', onMq); clearTimeout(showTimer); removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', vis); };
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
  const overlay = $derived(phone && shown && !!result && !panelOpen);
  const inlineCard = $derived(!(phone && (landing || overlay)));
  // The highlighted row must still match the board (it is redrawn when a coffee goes out or the rules change).
  const rolledN = $derived.by(() => {
    const n = game === 'd20' ? result?.n : undefined;
    const s = n ? board[n - 1] : undefined;
    if (!n || !result || !s) return null;
    return s.kind === 'coffee' ? (result.via === 'normal' && s.coffeeId === result.coffeeId ? n : null) : s.kind === result.via ? n : null;
  });
  const dismissOverlay = () => { shown = false; };
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
    saveRules(admin, 'pick.rules.last', next).catch(() => {});
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

<svelte:window onkeydown={(e) => e.key === 'Escape' && overlay && !dlg?.open && dismissOverlay()} />

{#if ready}
  <div class="search-row">
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

  <div class="stage" class:d20={game === 'd20'}>
    <section class="game" aria-label={game === 'd20' ? 'D20' : 'Wheel'}>
      {#if game === 'wheel'}
        <div class="wheel-wrap">
          <PickWheel bind:this={wheel} {slices} {names} angle={today.wheelAngle} disabled={empty} onspin={spin} onresult={wheelResult} />
        </div>
      {:else}
        <PickD20 pose={today.d20Pose} disabled={empty} onresult={d20Result} {critFor} onstart={startD20} onfail={() => (busy = false)} />
      {/if}
      {#if empty}<p class="text-muted">No coffees in play. Change the rules or reset today.</p>{/if}
      {#if rollAgain}<p class="roll-again" role="status">That number is crossed out today. Roll again.</p>{/if}
    <div class="out-row">
      <span class="label">Out for today:</span>
      {#each outRow as c (c.id)}<span class="badge badge-neutral" tabindex="0" role="note" use:labelTip={outTip(c)}><s>{c.name}</s></span>{:else}<span class="text-muted">nothing yet</span>{/each}
      <button type="button" class="button button-secondary" disabled={today.out.length === 0 && today.brewed.length === 0} onclick={() => (today = resetDay(today))}>Reset today</button>
    </div>
    </section>

    <div class="side">
      {#if inlineCard}<div class="result card" class:empty={!(result && resultCoffee)}>
        {#if result && resultCoffee}
          <PickCard coffee={resultCoffee} {result} out={out.has(resultCoffee.id)} brewed={today.brewed.includes(resultCoffee.id)} {busy}
            onbrew={brew} ondiscard={doDiscard} onopen={openPage} />
        {:else}
          <p class="text-muted">{game === 'd20' ? 'Roll the die to pick a coffee.' : 'Spin the wheel to pick a coffee.'}</p>
        {/if}
      </div>{/if}
    </div>
  </div>
  {#if game === 'd20'}<PickBoard {board} {byId} success={successC} fail={failC} rolled={rolledN} />{/if}


  {#if overlay && result && resultCoffee}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled on the window) -->
    <div class="modal-backdrop" onclick={(e) => e.target === e.currentTarget && dismissOverlay()}>
      {#if result.via !== 'normal'}
        <div class="fx {result.via}" aria-hidden="true">
          {#if result.via === 'success'}{#each CONFETTI as c, i (i)}<i style:left="{c.left}%" style:animation-delay="{c.delay}s" style:animation-duration="{c.dur}s" style:background={c.color}></i>{/each}{/if}
        </div>
      {/if}
      <div class="modal pick-modal {result.via}" role="dialog" aria-modal="true" aria-label="Pick result" bind:this={modalEl}>
        <PickCard coffee={resultCoffee} {result} out={out.has(resultCoffee.id)} brewed={today.brewed.includes(resultCoffee.id)} {busy}
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
  .stage { margin: var(--space-3) 0; display: grid; gap: var(--space-4); align-items: start; }
  .side { display: grid; gap: var(--space-3); min-width: 0; }
  .game { min-width: 0; }
  .wheel-wrap { max-width: 400px; margin: 0 auto; }
  .result { max-width: 24rem; }
  @media (max-width: 640px) { .result.empty { display: none; } } /* no placeholder on a phone (and no flash before the script runs) */
  .pick-modal { position: relative; max-width: 28rem; }
  .pick-modal.success { box-shadow: 0 0 0 3px #ffe08a, 0 0 32px #d4a73a; }
  .pick-modal.fail { box-shadow: 0 0 0 3px #d01c1c, 0 0 32px #7a0a0a; }
  .fx { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .fx.fail { background: radial-gradient(circle, transparent 30%, rgba(90, 0, 0, 0.85) 100%); animation: fade-in 0.6s; }
  .fx.success { background: radial-gradient(circle, rgba(255, 224, 138, 0.25), transparent 70%); }
  .fx i { position: absolute; top: -12px; width: 8px; height: 8px; border-radius: 2px; animation: fall linear 1 both; }
  @keyframes fall { to { transform: translateY(105vh) rotate(540deg); opacity: 0; } }
  @keyframes fade-in { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .fx i { display: none; } .fx.fail { animation: none; } }
  /* the card sits beside the game on desktop: wheel left, or a narrower die area with the board under the card */
  @media (min-width: 641px) {
    .stage { grid-template-columns: minmax(0, 400px) minmax(0, 1fr); }
    .stage.d20 { grid-template-columns: minmax(0, 620px) minmax(0, 1fr); }
  }
  .out-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: var(--space-3) 0; }
  .out-row .label { font-weight: 600; }
  .out-row .badge { white-space: normal; max-width: 100%; overflow-wrap: anywhere; }
  .rules-dialog { max-width: min(32rem, 100% - 2rem); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: inherit; padding: var(--space-4); }
  .rules-dialog h2 { padding: 0; border: 0; margin: 0 0 var(--space-2); } /* not the section heading's divider */
  .dlg-buttons { display: grid; gap: var(--space-2); }
  .dlg-buttons :global(.button) { min-height: 44px; }
</style>
