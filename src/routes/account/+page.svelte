<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import BeanTriage from './BeanTriage.svelte';
  import { showToast } from '$lib/toast.svelte';
  import { importSummary } from '$lib/importSummary';
  import { loadChoice, serializeChoice } from '$lib/rememberedChoice';
  let { data, form } = $props();
  // A short toast when a dose/ratio add or remove saved, with Undo (the opposite action on the same value).
  const toasting = (say: (v: string) => string, reverse: string): import('@sveltejs/kit').SubmitFunction => ({ formData }) => {
    const v = String(formData.get('value') ?? '').trim();
    return async ({ result, update }) => {
      await update();
      if (result.type !== 'success') return;
      showToast(say(v), {
        undo: async () => {
          const body = new FormData();
          body.set('value', v);
          const res = await fetch(`?/${reverse}`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
          const out = (await res.json().catch(() => null)) as { type?: string } | null;
          if (out?.type !== 'success') throw new Error('Could not undo that.');
          await invalidateAll();
        }
      });
    };
  };
  const fmt = (r: number) => String(Math.round(r * 10) / 10); // 16.67 -> 16.7

  // ✕ confirms in a dialog; "Don't ask again" is remembered per browser.
  const SKIP_KEY = 'account-skip-remove-confirm';
  let pending = $state<{ form: HTMLFormElement; label: string } | null>(null);
  let dontAsk = $state(false);
  function ask(e: MouseEvent, label: string) {
    let skip = false;
    try { skip = loadChoice(localStorage.getItem(SKIP_KEY), ['skip'], Date.now(), Infinity) === 'skip'; } catch { /* storage blocked: ask */ }
    if (skip) return;
    e.preventDefault();
    pending = { form: (e.currentTarget as HTMLButtonElement).form!, label };
  }
  function confirmRemove() {
    const f = pending!.form;
    if (dontAsk) try { localStorage.setItem(SKIP_KEY, serializeChoice('skip', Date.now())); } catch { /* ignore */ }
    pending = null;
    f.requestSubmit();
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC' : 'never');
  const s = $derived(data.status);
  // Household size: a failure shows here (not as the page-level form error above the upload); a save toasts with Undo.
  let householdError = $state<string | null>(null);
  const saveHousehold: import('@sveltejs/kit').SubmitFunction = ({ formData }) => {
    const before = data.householdSize;
    const n = String(formData.get('householdSize') ?? '').trim();
    return async ({ result, update }) => {
      if (result.type === 'failure') {
        householdError = String(result.data?.error ?? 'Could not save that');
        return;
      }
      householdError = null;
      await update();
      if (result.type !== 'success') return;
      showToast(`Household size set to ${n}.`, {
        undo: async () => {
          const body = new FormData();
          body.set('householdSize', String(before));
          const res = await fetch('?/updateHouseholdSize', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
          const out = (await res.json().catch(() => null)) as { type?: string } | null;
          if (out?.type !== 'success') throw new Error('Could not undo that.');
          await invalidateAll();
        }
      });
    };
  };
  let picked = $state<string | null>(null);
  let tooBig = $state(false);
  let submitting = $state(false);
  const summary = $derived(form && 'changes' in form && form.changes ? importSummary(form.changes) : null);
</script>

<svelte:head>
  <title>Bean Tracker - Account</title>
</svelte:head>

<h1>Account</h1>

<div class="acct">
<div>
<section data-row-scope class="chart-panel">
  <h2>Bean Conqueror</h2>

  <h3>Brew data (zip)</h3>
  <p class="text-muted">Last updated: {when(data.lastImportedAt)}</p>
  <form
    class="bq-upload"
    method="POST"
    action="?/importBeanConqueror"
    enctype="multipart/form-data"
    use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        await update();
        submitting = false;
        // update() resets the form (and its file input) only on success; after an error the file is still there to retry.
        if (result.type === 'success') picked = null;
      };
    }}
  >
    <div class="bq-pick">
      <label class="button button-secondary bq-choose">
        Choose export
        <!-- The server drops bodies over 20 MB (BODY_SIZE_LIMIT) with a bare error: stop them here.
             Must match MAX_UPLOAD_BYTES in src/lib/server/beanConquerorJson.ts. -->
        <input
          class="sr-only"
          type="file"
          name="file"
          accept=".zip"
          required
          onchange={(e) => {
            const input = e.currentTarget;
            const f = input.files?.[0] ?? null;
            const big = (f?.size ?? 0) > 20 * 1024 * 1024;
            input.setCustomValidity(big ? 'Over 20 MB: upload Beanconqueror.zip (the regular export, not the one with photos)' : '');
            picked = f && !big ? f.name : null;
            tooBig = big;
          }}
        />
      </label>
      <span class="bq-file" class:text-muted={!picked}>{picked ?? 'No file chosen'}</span>
    </div>
    <button class="button bq-go" type="submit" disabled={!picked || submitting}>
      <span class:bq-hide={submitting}>Import</span>
      <span class="bq-busy" class:bq-hide={!submitting} aria-hidden={!submitting}>Importing…</span>
    </button>
  </form>
  {#if tooBig}
    <p class="badge badge-urgent">Over 20 MB: upload Beanconqueror.zip (the regular export, not the one with photos)</p>
  {/if}
  {#if form && 'error' in form && form.error}
    <p class="badge badge-urgent"><CoffeeName text={form.error} /></p>
  {:else if summary}
    <div class="bq-result" role="status">
      <ul>
        {#each summary.lines as line (line)}<li>{line}</li>{/each}
      </ul>
      <p class="bq-links">
        <a class="button button-secondary" href="/insights">See your stats</a>
        {#if form && 'changes' in form && form.changes && form.changes.untracked.total > 0}
          <a class="button button-ghost" href="#not-tracked">Review untracked beans</a>
        {/if}
      </p>
    </div>
  {/if}
  <p class="text-muted">
    In Bean Conqueror: Settings → Export, then pick Beanconqueror.zip here. Do this before or after the flow upload;
    brews and flows join up either way.
  </p>

  <BeanTriage
    unmatched={data.unmatchedBeans}
    linkable={data.linkableCoffees}
    roastLevels={data.roastLevels}
    roasters={data.roasters}
    roasterImages={data.roasterImages}
    origins={data.origins}
    processingMethods={data.processingMethods}
    restHistory={data.restHistory}
    subscriptions={data.subscriptions}
    formError={form && 'error' in form && form.error ? String(form.error) : null}
  />

  <h3>Flow data (automatic upload)</h3>
  <p>
    Flow data for {s.joined} of {s.brewsWithFlow} brews · last upload {when(s.lastUploadAt)}{#if s.waiting > 0}<br />
      {s.waiting} {s.waiting === 1 ? 'brew' : 'brews'} not on the site yet: import the Bean Conqueror .zip above to
      add {s.waiting === 1 ? 'it and its coffee' : 'them and their coffees'}{/if}
  </p>
  <ol>
    <li>In Bean Conqueror, open Settings → Visualizer.</li>
    <li>Choose a custom server and enter the URL <code>{data.uploadUrl}</code>.</li>
    <li>Username: <code>{data.username}</code>. Password: your Bean Tracker sign-in password.</li>
    <li>Turn on "Upload each brewing automatically".</li>
    <li>Tap "Upload all brews" once to send your past brews.</li>
  </ol>
  <p class="text-muted">
    "Upload all" sends only brews Bean Conqueror hasn't uploaded before. If you tried another server first, those brews
    won't be sent again; edit and save a brew to resend it.
  </p>
  <p class="text-muted">If you change your sign-in password, update it in Bean Conqueror too.</p>
</section>

<section data-row-scope class="chart-panel" id="household">
  <h2>Household</h2>
  <p class="text-muted">Per-person stats divide your totals by this number: an even split, since Bean Conqueror doesn't record who brewed.</p>
  <form class="bn-add" method="POST" action="?/updateHouseholdSize" use:enhance={saveHousehold}>
    <label for="household-size">Household size</label>
    <input id="household-size" name="householdSize" type="number" min="1" max="20" step="1" inputmode="numeric" value={data.householdSize} required />
    <button class="button button-secondary" type="submit">Save</button>
  </form>
  {#if householdError}<p class="badge badge-urgent" role="alert">{householdError}</p>{/if}
</section>

</div>
<div>
<section data-row-scope class="chart-panel">
  <h2>Recipes</h2>
  <p>{data.recipes.saved} saved · {data.recipes.groups} found in your brews.</p>
  <p><a class="button button-secondary" href="/recipes">Open recipes</a></p>
</section>

<section data-row-scope class="chart-panel" id="brew-now">
  <h2>Brew now</h2>
  <p class="text-muted">The dose and ratio choices on each coffee's Brew now page, up to 6 of each.</p>

  <h3>Doses (g)</h3>
  <ul class="bn-list">
    {#each data.doses as d (d)}
      <li>
        <form method="POST" action="?/removeDose" use:enhance={toasting((v) => `Removed ${v}g.`, 'addDose')}>
          <input type="hidden" name="value" value={d} />
          <strong class="bn-dose">{d}g</strong>
          <span class="bn-cells">
            {#each data.ratios.ratios as r (r)}
              <span class="bn-cell"><span class="text-muted">1:{fmt(r)}</span><span>{Math.round(d * r)}g</span></span>
            {/each}
          </span>
          <button class="button button-ghost button-icon" type="submit" aria-label="Remove {d}g" onclick={(e) => ask(e, `${d}g`)}><Icon name="x" /></button>
        </form>
      </li>
    {/each}
  </ul>
  <form class="bn-add" method="POST" action="?/addDose" use:enhance={toasting((v) => `Added ${v}g.`, 'removeDose')}>
    <input name="value" type="text" inputmode="decimal" aria-label="New dose in grams" placeholder="18" /><span>g</span>
    <button class="button button-secondary" type="submit">Add</button>
  </form>
  {#if form && 'listError' in form && form.list === 'doses'}<p class="badge badge-urgent" role="alert">{form.listError}</p>{/if}

  <h3>Ratios</h3>
  <ul class="bn-list">
    {#each data.ratios.ratios as r (r)}
      <li>
        <form method="POST" action="?/removeRatio" use:enhance={toasting((v) => `Removed 1:${fmt(Number(v))}.`, 'addRatio')}>
          <input type="hidden" name="value" value={r} />
          <strong class="bn-dose">1:{fmt(r)}</strong>
          <button class="button button-ghost button-icon" type="submit" aria-label="Remove 1:{fmt(r)}" onclick={(e) => ask(e, `1:${fmt(r)}`)}><Icon name="x" /></button>
        </form>
      </li>
    {/each}
  </ul>
  <form class="bn-add" method="POST" action="?/addRatio" use:enhance={toasting((v) => `Added 1:${fmt(Number(v))}.`, 'removeRatio')}>
    <span aria-hidden="true">1:</span>
    <input name="value" type="text" inputmode="decimal" aria-label="New ratio, water per 1 of coffee" placeholder="16" />
    <button class="button button-secondary" type="submit">Add</button>
  </form>
  {#if form && 'listError' in form && form.list === 'ratios'}<p class="badge badge-urgent" role="alert">{form.listError}</p>{/if}
  {#if data.ratios.derived}<p class="text-muted">From your brews: your most common ratios over the last year. Editing the list makes it yours.</p>{/if}
</section>
</div>
</div>

{#if pending}
  <div class="modal-backdrop">
    <div class="modal bn-confirm" role="dialog" aria-modal="true" aria-labelledby="bn-confirm-title">
      <h2 id="bn-confirm-title">Remove {pending.label}?</h2>
      <div class="form-field form-field-checkbox">
        <label><input type="checkbox" bind:checked={dontAsk} /> Don't ask again</label>
      </div>
      <div class="action-buttons">
        <button class="button button-danger" type="button" onclick={confirmRemove}>Remove</button>
        <button class="button button-secondary" type="button" onclick={() => (pending = null)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Wide screens: Bean Conqueror and Household left, Recipes and Brew now right. */
  @media (min-width: 1100px) {
    .acct { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--space-4); align-items: start; }
  }
  #brew-now { scroll-margin-top: var(--space-4); }
  .bn-cells { display: flex; flex-wrap: wrap; flex: 0 1 auto; gap: var(--space-1) var(--space-4); padding: var(--space-2) 0; min-width: 0; }
  .bn-cell { display: flex; flex-direction: column; min-width: 3.75rem; line-height: 1.3; }
  .bn-cell .text-muted { font-size: 0.8rem; }
  .bn-confirm { max-width: 24rem; }
  .bq-upload { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
  .bq-pick { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-3); min-width: 0; }
  .bq-choose, .bq-go { position: relative; min-height: 44px; margin: 0; display: inline-flex; align-items: center; justify-content: center; }
  .bq-choose:focus-within { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .bq-file { overflow-wrap: anywhere; min-width: 0; }
  /* Both labels share one cell, so "Importing…" never changes the button's size. */
  .bq-go { display: inline-grid; padding-inline: var(--space-5, 1.5rem); }
  .bq-go > span { grid-area: 1 / 1; }
  .bq-hide { visibility: hidden; }
  .bq-result { margin-top: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
  .bq-result ul { margin: 0; padding-left: 1.2em; }
  .bq-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-3) 0 0; }
  .bq-links .button { margin: 0; min-height: 44px; display: inline-flex; align-items: center; }
  @media (max-width: 600px) {
    .bq-upload { flex-direction: column; align-items: stretch; }
    .bq-pick { flex-direction: column; align-items: stretch; }
    .bq-file { text-align: center; }
  }
</style>
