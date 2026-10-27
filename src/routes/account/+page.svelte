<script lang="ts">
  import { enhance } from '$app/forms';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  let { data, form } = $props();

  let confirming = $state(false);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC' : 'never');
  const s = $derived(data.status);
</script>

<svelte:head>
  <title>Bean Tracker - Account</title>
</svelte:head>

<h1>Account</h1>

<section class="chart-panel">
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
  {:else if form && 'imported' in form && form.imported}
    <p class="text-muted">
      Imported {form.imported.beans} beans, {form.imported.brews} brews, {form.imported.waters} waters.
    </p>
  {/if}
  <p class="text-muted">
    In Bean Conqueror: Settings → Export, then pick Beanconqueror.zip here. Do this before or after the flow upload;
    brews and flows join up either way.
  </p>

  <h3>Flow data (automatic upload)</h3>
  <p>
    Flow data for {s.joined} of {s.brewsWithFlow} brews · last upload {when(s.lastUploadAt)}{#if s.waiting > 0}
      · {s.waiting} waiting for a Bean Conqueror import{/if}
  </p>
  <ol>
    <li>In Bean Conqueror, open Settings → Visualizer.</li>
    <li>Choose a custom server and enter the URL <code>{data.uploadUrl}</code>.</li>
    <li>Username: <code>{data.username}</code>. Password: the upload password from this page.</li>
    <li>Turn on "Upload each brewing automatically".</li>
    <li>Tap "Upload all brews" once to send your past brews.</li>
  </ol>
  <p class="text-muted">
    "Upload all" sends only brews Bean Conqueror hasn't uploaded before. If you tried another server first, those brews
    won't be sent again; edit and save a brew to resend it.
  </p>

  {#if confirming}
    <p>Replacing the upload password stops the old one from working.</p>
    <form
      method="POST"
      action="?/createUploadPassword"
      use:enhance={() => async ({ update }) => { confirming = false; await update({ reset: false }); }}
    >
      <div data-button-row>
        <button class="button" type="submit">Replace</button>
        <button class="button button-secondary" type="button" onclick={() => (confirming = false)}>Cancel</button>
      </div>
    </form>
  {:else}
    <form method="POST" action="?/createUploadPassword" use:enhance>
      {#if s.hasPassword}
        <button class="button button-secondary" type="button" onclick={() => (confirming = true)}>Replace upload password</button>
      {:else}
        <button class="button button-secondary" type="submit">Create upload password</button>
      {/if}
    </form>
  {/if}
  {#if !confirming && form && 'uploadPassword' in form && form.uploadPassword}
    <div role="status">
      <p><code>{form.uploadPassword}</code></p>
      <p class="text-muted">Copy it into Bean Conqueror now; it won't be shown again. Replacing it stops the old one from working.</p>
    </div>
  {/if}
</section>
