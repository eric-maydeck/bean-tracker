<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { showToast } from '$lib/toast.svelte';
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
</script>

<svelte:head>
  <title>Bean Tracker - Account</title>
</svelte:head>

<h1>Account</h1>

<div class="acct">
<section data-row-scope class="chart-panel">
  <h2>Bean Conqueror</h2>

  <h3>Brew data (zip)</h3>
  <p class="text-muted">Last import: {when(data.lastImportedAt)}</p>
  <form method="POST" action="?/importBeanConqueror" enctype="multipart/form-data" use:enhance>
    <label>
      Bean Conqueror export (.zip)
      <!-- The server drops bodies over 20 MB (BODY_SIZE_LIMIT) with a bare error: stop them here.
           Must match MAX_UPLOAD_BYTES in src/lib/server/beanConquerorJson.ts. -->
      <input
        type="file"
        name="file"
        accept=".zip"
        required
        onchange={(e) => {
          const input = e.currentTarget;
          input.setCustomValidity(
            (input.files?.[0]?.size ?? 0) > 20 * 1024 * 1024
              ? 'Over 20 MB: upload Beanconqueror.zip (the regular export, not the one with photos)'
              : ''
          );
        }}
      />
    </label>
    <button class="button" type="submit">Import</button>
  </form>
  {#if form && 'error' in form && form.error}
    <p class="badge badge-urgent"><CoffeeName text={form.error} /></p>
  {:else if form && 'changes' in form && form.changes}
    <p class="text-muted">
      Imported: {form.changes.beans.new + form.changes.beans.updated} beans, {form.changes.brews.new + form.changes.brews.updated} brews, {form.changes.waters.new + form.changes.waters.updated} waters changed.
    </p>
  {/if}
  <p class="text-muted">
    In Bean Conqueror: Settings → Export, then pick Beanconqueror.zip here. Do this before or after the flow upload;
    brews and flows join up either way.
  </p>

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
  /* Wide screens: Bean Conqueror left (spanning), Recipes and Brew now stacked right. */
  @media (min-width: 1100px) {
    .acct { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--space-4); align-items: start; }
    .acct > :global(section:first-child) { grid-row: span 2; }
  }
  #brew-now { scroll-margin-top: var(--space-4); }
  .bn-cells { display: flex; flex-wrap: wrap; flex: 0 1 auto; gap: var(--space-1) var(--space-4); padding: var(--space-2) 0; min-width: 0; }
  .bn-cell { display: flex; flex-direction: column; min-width: 3.75rem; line-height: 1.3; }
  .bn-cell .text-muted { font-size: 0.8rem; }
  .bn-confirm { max-width: 24rem; }
</style>
