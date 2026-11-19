<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { buildPool, critPool } from '#lib/pick/pool.ts';
  import { boardMatches, fillBoard } from '#lib/pick/board.ts';
  import { DEFAULT_RULES, rulesDiffer } from '#lib/pick/rules.ts';
  import { discard, markBrewed, resetDay } from '#lib/pick/today.ts';
  import { sliceAt, wheelSlices } from '#lib/pick/wheel.ts';
  import type { Game, PickCoffee, PickResult, PickRules, PickToday, Slot, WheelSlice } from '#lib/pick/types.ts';
  import PickBoard from './PickBoard.svelte';
  import PickCard from './PickCard.svelte';
  import PickD20 from './PickD20.svelte';
  import PickRulesPanel from './PickRules.svelte';
  import PickWheel from './PickWheel.svelte';
  import { fetchSaved, flushToday, loadRules, loadToday, saveRules, saveToday } from './store';

  let { pick, admin, game, ongame }: {
    pick: { coffees: PickCoffee[]; today: string; rulesLast: unknown; hasSaved: boolean; todayState: unknown };
    admin: boolean; game: Game; ongame: (g: Game) => void;
  } = $props();

  const coffees = untrack(() => pick.coffees);
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const names = new Map(coffees.map((c) => [c.id, c.name]));

  // Admins start from the server's values; visitors' live in localStorage, so they load after mount.
  let ready = $state(untrack(() => admin));
  let rules = $state<PickRules>(untrack(() => (admin ? loadRules(true, pick.rulesLast) : DEFAULT_RULES)));
  let today = $state<PickToday>(untrack(() => loadToday(admin, admin ? pick.todayState : null, pick.today)));
  let hasSaved = $state(untrack(() => pick.hasSaved));
  let busy = $state(false);
  let rollAgain = $state(false);
  let announce = $state('');
  let note = $state('');
  let pendingRules = $state<PickRules | null>(null);
  let wheel = $state<PickWheel>();
  let dlg: HTMLDialogElement;
  let chosen = false; // A or B picked; otherwise a closed dialog is a cancel
  let rev = $state(0); // bumped on cancel so the panel re-reads `rules`
  let restored = false;

  onMount(() => {
    if (!admin) {
      rules = loadRules(false, null);
      today = loadToday(false, null, pick.today);
      ready = true;
    }
    const hide = () => flushToday();
    const vis = () => document.visibilityState === 'hidden' && flushToday();
    addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    return () => { removeEventListener('pagehide', hide); document.removeEventListener('visibilitychange', vis); };
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

  $effect(() => {
    if (!ready) return;
    saveToday(admin, $state.snapshot(today));
  });

  const out = $derived(new Set(today.out));
  const pool = $derived(buildPool(coffees, rules, out));
  const successC = $derived(critPool(coffees, rules.critSuccess, out));
  const failC = $derived(critPool(coffees, rules.critFail, out));
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
  const TAU = Math.PI * 2;
  const critFor = (n: number) => {
    const k = board[n - 1]?.kind;
    return k === 'success' || k === 'fail' ? k : null;
  };
  const rolledN = $derived(game === 'd20' ? (result?.n ?? null) : null);

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
  const close = () => (today.result = null);

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
    if (!chosen) { rev++; note = ''; } // Cancel or Escape: the controls go back to the unchanged rules
  }
  async function save() {
    try {
      await saveRules(admin, 'pick.rules.saved', rules);
      hasSaved = true;
      note = 'Saved.';
    } catch {
      note = "Couldn't save.";
    }
  }
  async function load() {
    try {
      const r = await fetchSaved();
      note = r ? 'Loaded.' : 'Nothing saved yet.';
      if (r) edit(r);
    } catch {
      note = "Couldn't load.";
    }
  }
</script>

{#if ready}
  <div class="form-field group-field">
    <span>Game</span>
    <div class="tab-group" role="group" aria-label="Game">
      <button type="button" aria-pressed={game === 'wheel'} onclick={() => setGame('wheel')}>Wheel</button>
      <button type="button" aria-pressed={game === 'd20'} onclick={() => setGame('d20')}>D20</button>
    </div>
  </div>

  {#key rev}
  <PickRulesPanel {rules} {coffees} {eligible} {admin} {hasSaved} open={today.panelOpen} {note} locked={busy}
    ontoggle={(o) => (today.panelOpen = o)} onchange={edit} onsave={save} onload={load} onreset={() => edit(DEFAULT_RULES)} />
  {/key}

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
    </section>

    <div class="side">
      <div class="result card">
        {#if result && resultCoffee}
          <PickCard coffee={resultCoffee} {result} out={out.has(resultCoffee.id)} brewed={today.brewed.includes(resultCoffee.id)} {busy}
            onbrew={brew} ondiscard={doDiscard} onopen={openPage} onclose={close} />
        {:else}
          <p class="text-muted">{game === 'd20' ? 'Roll the die to pick a coffee.' : 'Spin the wheel to pick a coffee.'}</p>
        {/if}
      </div>
      {#if game === 'd20'}<PickBoard {board} {byId} success={successC} fail={failC} rolled={rolledN} />{/if}
    </div>
  </div>

  <div class="out-row">
    <span class="label">Out for today:</span>
    {#each outRow as c (c.id)}<span class="badge badge-neutral"><s>{c.name}</s></span>{:else}<span class="text-muted">nothing yet</span>{/each}
    <button type="button" class="button button-secondary" disabled={today.out.length === 0 && today.brewed.length === 0} onclick={() => (today = resetDay(today))}>Reset today</button>
  </div>

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
  .wheel-wrap { max-width: 560px; margin: 0 auto; }
  .result { min-height: 7.5rem; }
  /* the card sits beside the game on desktop: wheel left, or a narrower die area with the board under the card */
  @media (min-width: 641px) {
    .stage { grid-template-columns: minmax(0, 560px) minmax(0, 1fr); }
    .stage.d20 { grid-template-columns: minmax(0, 620px) minmax(0, 1fr); }
  }
  .out-row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: var(--space-3) 0; }
  .out-row .label { font-weight: 600; }
  .rules-dialog { max-width: min(32rem, 100% - 2rem); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); color: inherit; padding: var(--space-4); }
  .dlg-buttons { display: grid; gap: var(--space-2); }
  .dlg-buttons :global(.button) { min-height: 44px; }
</style>
