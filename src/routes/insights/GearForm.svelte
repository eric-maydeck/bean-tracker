<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { fieldsFor } from '$lib/gear';
  import { backdrop } from '$lib/imageBackdrop';
  import type { Trophy } from '$lib/server/insights/trophies';

  let { trophy, onclose }: { trophy: Trophy; onclose: () => void } = $props();

  const fields = $derived(fieldsFor(trophy.kind));
  // svelte-ignore state_referenced_locally
  let values = $state<Record<string, string>>(Object.fromEntries(Object.entries(trophy.values).map(([k, v]) => [k, String(v)])));
  // svelte-ignore state_referenced_locally
  let imageUrl = $state(trophy.imageUrl ?? '');
  let error = $state('');
  let saving = $state(false);
  let previewSrc = $state<string | null>(null);
  let previewFailed = $state(false);
  // Backdrop per previewed URL, as CoffeeForm's preview does (POST /api/coffees/image-fill).
  let fills = $state<Record<string, string>>({});
  async function preview() {
    const url = (previewSrc = imageUrl.trim() || null);
    previewFailed = false;
    if (!url || !/^https?:\/\//i.test(url) || url in fills) return;
    const res = await fetch('/api/coffees/image-fill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url })
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (typeof data?.fill === 'string') fills[url] = data.fill;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    saving = true; error = '';
    const res = await fetch('/api/gear', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: trophy.kind, name: trophy.name, values, image_url: imageUrl })
    }).catch(() => null);
    if (res?.ok) { await invalidateAll(); onclose(); return; }
    error = (await res?.json().catch(() => null))?.error ?? "Couldn't save";
    saving = false;
  }
</script>

<form class="gear-form" onsubmit={save} novalidate>
  <div class="gear-fields">
    {#each fields as f (f.key)}
      <div class="form-field">
        <label for="gear-{f.key}">{f.label}{f.unit ? ` (${f.unit})` : f.type === 'money' ? ' ($)' : ''}</label>
        <input id="gear-{f.key}" bind:value={values[f.key]} list={f.options ? `gear-opts-${f.key}` : undefined} autocomplete="off"
          type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'url' ? 'url' : 'text'}
          step={f.type === 'money' ? '0.01' : f.type === 'number' ? 'any' : undefined}
          inputmode={f.type === 'number' || f.type === 'money' ? 'decimal' : undefined} min={f.min} max={f.max} />
        {#if f.options}<datalist id="gear-opts-{f.key}">{#each f.options as o (o)}<option value={o}></option>{/each}</datalist>{/if}
      </div>
    {/each}
  </div>
  <div class="form-field">
    <label for="gear-image">Image URL</label>
    <input id="gear-image" type="url" bind:value={imageUrl} placeholder="Photo of the gear" autocomplete="off" />
    <div class="inline-row-actions" data-button-row>
      <button class="button button-secondary" type="button" onclick={preview}>Preview</button>
      <button class="button button-ghost" type="button" onclick={() => { imageUrl = ''; previewSrc = null; }}>Discard image</button>
    </div>
    {#if previewSrc}
      {#if previewFailed}<p class="text-muted fill-note">Couldn't load image</p>
      {:else}<img class="image-preview" src={previewSrc} alt="Preview" style:background-color={backdrop(fills[previewSrc])} onerror={() => (previewFailed = true)} />{/if}
    {/if}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="form-actions" data-button-row>
    <button class="button" type="submit" disabled={saving}>Save</button>
    <button class="button button-secondary" type="button" disabled={saving} onclick={onclose}>Cancel</button>
  </div>
</form>

<style>
  .gear-fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    column-gap: var(--space-3);
  }
  .form-field {
    margin-bottom: var(--space-3);
    min-width: 0;
  }
  .inline-row-actions, .form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .form-actions .button, .inline-row-actions .button {
    margin: 0;
  }
  /* Viewport media query on purpose: the dialog is in the top layer, so its width follows the viewport, not the insights container. */
  /* Phone: the buttons grow to share each line (ui-rules 17). */
  @media (max-width: 640px) {
    .form-actions .button, .inline-row-actions .button {
      flex: 1 1 auto;
      text-align: center;
    }
  }
  .fill-note {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  .image-preview {
    display: block;
    margin-top: var(--space-2);
    width: 96px;
    height: 96px;
    object-fit: contain;
    border-radius: var(--radius);
  }
</style>
