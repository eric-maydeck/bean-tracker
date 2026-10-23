<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { fieldsFor } from '$lib/gear';
  import { backdrop } from '$lib/imageBackdrop';
  import type { Trophy } from '$lib/server/insights/trophies';

  // `mediaTarget` is the dialog's media column: the image row and (wide) Save/Cancel render there, under the photo; `preview` is
  // the previewed image, shown in the photo box.
  let { trophy, onclose, mediaTarget, preview = $bindable(null) }: {
    trophy: Trophy; onclose: () => void; mediaTarget: HTMLElement; preview?: { src: string; fill?: string } | null;
  } = $props();
  const into = (node: HTMLElement, target: HTMLElement) => { target.append(node); return { destroy: () => node.remove() }; };

  const fields = $derived(fieldsFor(trophy.kind));
  // svelte-ignore state_referenced_locally
  let values = $state<Record<string, string>>(Object.fromEntries(Object.entries(trophy.values).map(([k, v]) => [k, String(v)])));
  // svelte-ignore state_referenced_locally
  let imageUrl = $state(trophy.imageUrl ?? '');
  let error = $state('');
  let saving = $state(false);
  let previewSrc = $state<string | null>(null);
  // Backdrop per previewed URL, as CoffeeForm's preview does (POST /api/coffees/image-fill).
  let fills = $state<Record<string, string>>({});
  $effect(() => { preview = previewSrc ? { src: previewSrc, fill: fills[previewSrc] } : null; });
  async function showPreview() {
    const url = (previewSrc = imageUrl.trim() || null);
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

{#snippet actions(cls: string)}
  <div class="form-actions {cls}" data-button-row>
    <button class="button" type="submit" form="gear-form" disabled={saving}>Save</button>
    <button class="button button-secondary" type="button" disabled={saving} onclick={onclose}>Cancel</button>
  </div>
  {#if error}<p class="badge badge-urgent {cls}" role="alert">{error}</p>{/if}
{/snippet}

<form id="gear-form" class="gear-form" onsubmit={save} novalidate>
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
  <!-- Stacked phone layout: the actions go under the form (ui-rules 19). -->
  {@render actions('under-form')}
</form>

<!-- Under the photo: the image row, and on wider dialogs Save and Cancel. -->
<div class="media-edit" use:into={mediaTarget}>
  <div class="form-field">
    <label for="gear-image">Image URL</label>
    <input id="gear-image" type="url" form="gear-form" bind:value={imageUrl} placeholder="Photo of the gear" autocomplete="off" />
    <div class="inline-row-actions" data-button-row>
      <button class="button button-secondary" type="button" onclick={showPreview}>Preview</button>
      <button class="button button-ghost" type="button" onclick={() => { imageUrl = ''; previewSrc = null; }}>Discard image</button>
    </div>
  </div>
  {@render actions('under-photo')}
</div>

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
  /* Save and Cancel sit under the photo on wide dialogs, under the form on the stacked phone layout. */
  .under-form {
    display: none;
  }
  @media (max-width: 640px) {
    .under-form {
      display: flex;
    }
    .under-photo {
      display: none;
    }
  }
</style>
