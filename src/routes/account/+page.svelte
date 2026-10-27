<script lang="ts">
  import { enhance } from '$app/forms';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  let { data, form } = $props();

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

<section class="chart-panel">
  <h2>Recipes</h2>
  <p>{data.recipes.saved} saved · {data.recipes.groups} found in your brews.</p>
  <p><a class="button button-secondary" href="/account/recipes">Open recipes</a></p>
</section>
