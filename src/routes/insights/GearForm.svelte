<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { fieldsFor, isWebUrl } from '$lib/gear';
  import ImageSuggest from '$lib/components/ImageSuggest.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import { labelTip } from '$lib/components/labelTip';
  import { placeTip } from '$lib/components/modeTip';
  import { backdrop } from '$lib/imageBackdrop';
  import type { Snippet } from 'svelte';
  import type { Trophy } from '$lib/server/insights/trophies';

  // Replaces the dialog's article: `head` is the title, `photo` the picture (showing the previewed image, `preview`).
  let { trophy, onclose, head, photo, top, preview = $bindable(null) }: {
    trophy: Trophy; onclose: () => void; head: Snippet; photo: Snippet; top: Snippet<[Snippet]>; preview?: { src: string; fill?: string } | null;
  } = $props();

  const fields = $derived(fieldsFor(trophy.kind));
  const last = $derived(Math.ceil(fields.length / 2)); // the last field row
  // The row Preview/Discard and Save/Cancel share (the one after a full last row); Image URL is the row above.
  const act = $derived(fields.length % 2 ? last : last + 1);
  // A number input binds a number (null when emptied), a text input or select a string.
  // Money shows cents ("24.00"); the unsaved-changes check compares numbers, so 24 and "24.00" agree.
  const shown = (key: string, v: string | number) => (fields.find((f) => f.key === key)?.type === 'money' && String(v).trim() !== '' && Number.isFinite(+v) ? (+v).toFixed(2) : String(v));
  // svelte-ignore state_referenced_locally
  let values = $state<Record<string, string | number | null>>(Object.fromEntries(Object.entries(trophy.values).map(([k, v]) => [k, shown(k, v)])));
  // svelte-ignore state_referenced_locally
  let imageUrl = $state(trophy.imageUrl ?? '');
  let error = $state('');
  let notes = $state<string[]>([]); // what Fill from URL reports, in the message spot
  let filling = $state(false);
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

  // Fill from URL reads the Official website field and overwrites only the fields it finds; nothing saves.
  const site = $derived(String(values.website ?? '').trim());
  const ok = $derived(isWebUrl(site));
  async function fill() {
    filling = true; error = ''; notes = [];
    const res = await fetch('/api/gear/fill-from-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: site, kind: trophy.kind })
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    filling = false;
    if (!res?.ok || !data?.values) { error = data?.error ?? data?.message ?? "Couldn't reach the server"; return; }
    for (const [k, v] of Object.entries(data.values as Record<string, string | number>)) values[k] = shown(k, v);
    notes = data.notes ?? [];
    if (data.imageUrl) { imageUrl = data.imageUrl; showPreview(); }
  }
  // Suggest's brand · model line, else the card's name.
  const matching = () => [[values.brand, values.model].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ') || trophy.name];

  // Unsaved changes, named for the leave panel: "Burr size: 64 → 54", "Image URL changed".
  // A field value as comparable text: trimmed, a number as its own digits (so "24" and 24.00 agree), empty for null.
  const norm = (f: { type: string }, v: unknown): string => {
    const t = String(v ?? '').trim();
    return t !== '' && (f.type === 'number' || f.type === 'money') && Number.isFinite(+t) ? String(+t) : t;
  };
  function changes(): string[] { return [
    ...fields.flatMap((f) => {
      const [was, now] = [norm(f, trophy.values[f.key]), norm(f, values[f.key])];
      return was === now ? [] : [`${f.label}: ${was || 'empty'} → ${now || 'empty'}`];
    }),
    ...(values.adjustment !== 'Stepped' && norm({ type: 'number' }, trophy.values.stepSize) !== ''
      ? [`Step size: ${norm({ type: 'number' }, trophy.values.stepSize)} → empty`] : []),
    ...(imageUrl.trim() !== (trophy.imageUrl ?? '') ? ['Image URL changed'] : [])
  ]; }
  // The dialog's ✕ asks for these: the changes to leave behind, named (empty = nothing to lose).
  export { changes };

  async function save(e: SubmitEvent) {
    e.preventDefault();
    // Letters in a number input bind as empty, which Save would store as "no value": stop and name the field.
    const badField = fields.find((f) => (document.getElementById(`gear-${f.key}`) as HTMLInputElement | null)?.validity?.badInput);
    if (badField) { error = `${badField.label} must be a number`; return; }
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

<!-- One grid for photo and fields (wide dialogs): the fields run two to a row in the two right columns; the photo takes the
     left column over the rows above Image URL; Preview/Discard sit on the row before the last field row and the Image URL
     on the last, so their labels and inputs line up with those rows' fields; Save/Cancel fill the cell after the last field
     (the cell under the last field when the last row is full: its width is that field's input, as Preview/Discard span Image URL). Phones stack it all, Save/Cancel last (ui-rules 19). -->
<form class="gear-form" onsubmit={save} novalidate style="--a:{act}">
  {#snippet tools()}
    <!-- aria-disabled, not disabled, so its tip (the reason) still opens; re-keyed so labelTip re-reads the state. -->
    {#key ok}
      <button type="button" class="button button-secondary" aria-disabled={!ok || filling || saving} aria-label="Fill from URL"
        use:labelTip={ok ? 'Fill from URL' : 'Enter the Official website first'} onclick={() => ok && !filling && !saving && fill()}>Fill<span class="long"> from URL</span></button>
    {/key}
  {/snippet}
  {@render top(tools)}
  {@render head()}
  <div class="grid">
    <div class="photo">{@render photo()}</div>
    {#each fields as f, i (f.key)}
      <div class="form-field" style="--r:{Math.floor(i / 2) + 1};--c:{2 + (i % 2)}">
        <div class="label-row">
          <label for="gear-{f.key}">{f.label}{f.unit ? ` (${f.unit})` : f.type === 'money' ? ' ($)' : ''}</label>
          {#if f.help}
            <button type="button" class="mode-tip-button" popovertarget="gear-tip-{f.key}" aria-label="About {f.label}" aria-describedby="gear-tip-{f.key}"><Icon name="question" /></button>
          {/if}
        </div>
        {#if f.help}<div class="mode-tip" id="gear-tip-{f.key}" popover onbeforetoggle={placeTip}><TipBody tip={{ title: f.label, lines: f.help.split(/(?<=\.)(?<!e\.g\.) /) }} /></div>{/if}
        {#if f.type === 'select'}
          <select id="gear-{f.key}" bind:value={values[f.key]}>
            <option value="">Select one</option>
            {#each f.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        {:else}
          <input id="gear-{f.key}" bind:value={values[f.key]} list={f.options ? `gear-opts-${f.key}` : undefined} autocomplete="off"
            type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'url' ? 'url' : 'text'}
            step={f.type === 'money' ? '0.01' : f.type === 'number' ? 'any' : undefined}
            inputmode={f.type === 'number' || f.type === 'money' ? 'decimal' : undefined} min={f.min} max={f.max}
            disabled={f.key === 'stepSize' && values.adjustment !== 'Stepped'} />
        {/if}
        {#if f.options && f.type !== 'select'}<datalist id="gear-opts-{f.key}">{#each f.options as o (o)}<option value={o}></option>{/each}</datalist>{/if}
      </div>
    {/each}
    <div class="form-field image-url" style="--r:{act - 1};--c:1">
      <label for="gear-image">Image URL</label>
      <input id="gear-image" type="url" bind:value={imageUrl} placeholder="Photo of the gear" autocomplete="off" />
    </div>
    <div class="cell-buttons image-buttons" style="--r:{act};--c:1" data-button-row>
      <button class="button button-secondary" type="button" onclick={showPreview}>Preview</button>
      <ImageSuggest endpoint="/api/gear/image-suggest" label="Suggest" siteLabel="Maker website" setSiteText="set maker site" disabled={saving}
        body={() => ({ kind: trophy.kind, name: trophy.name, brand: String(values.brand ?? ''), model: String(values.model ?? ''), site: ok ? site : undefined })}
        {matching} onpick={(c) => { imageUrl = c.image; showPreview(); }} />
      <button class="button button-ghost" type="button" aria-label="Discard image" onclick={() => { imageUrl = ''; previewSrc = null; }}>Discard</button>
    </div>
    <div class="cell-buttons actions" style="--r:{act};--c:3" data-button-row data-form-actions>
      <button class="button" type="submit" disabled={saving || filling}>Save</button>
      <button class="button button-secondary" type="button" disabled={saving} onclick={onclose}>Cancel</button>
    </div>
  </div>
  {#if error}<p class="badge badge-urgent" role="alert">{error}</p>{/if}
  {#each notes as n (n)}<p class="text-muted note" role="status">{n}</p>{/each}
</form>

<style>
  .note {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  /* Phones: the top-right group is Fill, Suggest and the close button, so Fill drops "from URL" (its label and title keep it). */
  @media (max-width: 640px) {
    .long {
      display: none;
    }
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(11rem, 17.5rem) repeat(2, minmax(0, 1fr));
    gap: 0 var(--space-4);
    align-items: start;
  }
  /* Placement by row/column from the markup; the photo spans the rows above the Preview row. */
  .grid > :not(.photo) {
    grid-row: var(--r);
    grid-column: var(--c);
    min-width: 0;
  }
  .photo {
    grid-column: 1;
    grid-row: 1 / calc(var(--a) - 1);
    align-self: stretch;
    margin-bottom: 0.65rem;
  }
  .photo :global(.trophy-img) {
    height: 100%;
    min-height: 9rem;
  }
  .form-field {
    margin-bottom: 0.65rem;
  }
  /* A disabled field (Step size off a stepped grinder) looks it: dimmed label, dashed tinted input, not-allowed cursor; its "?" stays live. */
  .form-field:has(input:disabled) label {
    color: var(--color-text-muted);
    opacity: 0.6;
    cursor: not-allowed;
  }
  .form-field input:disabled {
    opacity: 0.55;
    color: var(--color-text-muted);
    border-style: dashed;
    background: color-mix(in srgb, var(--color-text-muted) 12%, var(--color-surface));
    cursor: not-allowed;
  }
  .label-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .label-row .mode-tip-button {
    line-height: 1;
  }
  .form-field label {
    line-height: 1.2;
  }
  /* A label-less cell lined up with a neighbor's input: a spacer the label's height, then the buttons fill the rest. */
  .cell-buttons {
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-2);
    align-self: stretch;
    margin-bottom: 0.65rem;
  }
  .cell-buttons::before {
    content: '\00a0';
    font-size: 0.9rem;
    line-height: 1.2;
    margin-bottom: var(--space-1);
    grid-column: 1 / -1;
  }
  .image-buttons {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cell-buttons > :global(.button) {
    margin: 0;
    padding-inline: var(--space-2);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  /* Viewport media query on purpose: the dialog is in the top layer, so its width follows the viewport, not the insights container. */
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    }
    .grid > :not(.photo) {
      grid-row: auto;
      grid-column: auto;
    }
    .photo {
      grid-column: 1 / -1;
      grid-row: auto;
    }
    .photo :global(.trophy-img) {
      height: auto;
      max-width: 9.5rem;
      aspect-ratio: 1;
    }
    .grid > .image-url, .grid > .cell-buttons {
      grid-column: 1 / -1;
    }
    .photo { order: -3; }
    .grid > .image-url { order: -2; }
    .grid > .image-buttons { order: -1; }
    .grid > .actions { order: 99; margin-top: calc(var(--space-4) - 0.65rem); /* ui-rules 22: 16px above the action row, less the field's own margin */ grid-template-columns: repeat(2, minmax(0, 1fr)); justify-content: normal; }
    .cell-buttons::before {
      display: none;
    }
    .cell-buttons > :global(.button) {
      min-height: 44px;
    }
  }
</style>
