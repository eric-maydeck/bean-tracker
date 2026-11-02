<script lang="ts">
  import { usd } from '$lib/money';
  import { costAfterPlanChange, type CostMemo, type SubscriptionOption } from '$lib/planBagCost';
  import { onMount, tick } from 'svelte';
  import ImageSuggest from './ImageSuggest.svelte';
  import { enhance } from '$app/forms';
  import type { CoffeeRow } from '$lib/types';
  import { COFFEE_ORIGIN_LABELS, type CoffeeOriginField } from '$lib/types';
  import type { RoastLevelRow } from '$lib/types';
  import { clonePrefill, mergeStagedCoffee, stagedRoasterDefault, stagedRoasterWebsite } from '$lib/pendingChanges';
  import { pickCandidate, type Candidate, type SuggestResponse } from '$lib/imageSuggest';
  import { roasterDefaultFor } from '$lib/coffeeImage';
  import { backdrop } from '$lib/imageBackdrop';
  import { formatDate } from '$lib/formatDate';
  import { afterFailedFill, suggestRest, canReplaceRest, fieldsChanged, type RestHistoryRow, type RestSuggestion } from '$lib/coffeeFormFill';

  let {
    coffee = null,
    prefill = null,
    roastLevels,
    roasters = [],
    roasterImages = {},
    origins = [],
    processingMethods = [],
    restHistory = [],
    subscriptions = null,
    formError = null,
    beanConquerorId = null,
    oncancel = null,
    onsuccess = null,
    onstage = null,
    onclone = null,
    showSubmit = true,
    showClone = true
  }: {
    coffee?: CoffeeRow | null;
    prefill?: Partial<CoffeeRow> | null;
    roastLevels: RoastLevelRow[];
    roasters?: string[];
    // Roaster → default image (getRoasterImages): the "Roaster default" preview.
    roasterImages?: Record<string, string>;
    origins?: string[];
    processingMethods?: string[];
    restHistory?: RestHistoryRow[];
    // Admin edit, Add and Clone (not the list's inline edit): the plans this bag can be linked to.
    subscriptions?: SubscriptionOption[] | null;
    formError?: string | null;
    // Stats "Not yet tracked" → Create: the bean to link once the coffee exists.
    beanConquerorId?: string | null;
    oncancel?: (() => void) | null;
    onsuccess?: (() => void) | null;
    onstage?: ((fields: Record<string, string>) => void) | null;
    onclone?: ((prefill: Partial<CoffeeRow>) => void) | null;
    // Detail page's "Save changes" now stages via applyPendingEdits()
    // (requestSubmit() with no args, so no visible submit button is
    // needed) — this hides the redundant per-field Update button there.
    showSubmit?: boolean;
    // The detail page already has its own toolbar Clone button (which
    // clones the committed/staged coffee); this form's own Clone (which
    // clones whatever's currently typed, including unstaged edits) would be
    // a second, redundant Clone control there — hidden by passing false.
    showClone?: boolean;
  } = $props();

  let formEl: HTMLFormElement;
  let slugInput: HTMLInputElement;

  // Locked by default so a rename never happens by accident — the slug is
  // the coffee's URL, and every old slug it leaves behind becomes a
  // permanent redirect. Captured once (not reactive to `coffee` changing
  // later), matching "the value it had when the form rendered".
  let slugLocked = $state(true);
  const initialSlug = coffee?.slug ?? '';

  type FillVariant = { label: string; grams: number | null; costUsd: number | null; originalPrice: string | null };

  let filling = $state(false);
  let fillError = $state<string | null>(null);
  let fillNotes = $state<string[]>([]);
  let fillVariants = $state<FillVariant[]>([]);
  let selectedVariant = $state<number | null>(null);

  // Plain let: only read on the next failure, never rendered.
  let lastFilledUrl: string | null = null;
  let unsavedUrl = $state<string | null>(null);
  let previewSrc = $state<string | null>(null);
  let previewFailed = $state(false);
  // Backdrop per previewed URL (POST /api/coffees/image-fill). Keyed by URL, so
  // a reply that lands after the URL changed is stored under its own URL and
  // never shown behind another image. Non-http URLs (data:) aren't sent.
  let fills = $state<Record<string, string>>({});
  const requested = new Set<string>();
  async function loadFill(url: string) {
    if (!/^https?:\/\//i.test(url) || requested.has(url)) return;
    requested.add(url);
    const res = await fetch('/api/coffees/image-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (typeof data?.fill === 'string') fills[url] = data.fill;
  }
  // Live copies of the two fields the roaster-default button and preview read.
  let roasterValue = $state((coffee?.roaster ?? prefill?.roaster) ?? '');
  let imageValue = $state((coffee?.image_url ?? prefill?.image_url) ?? '');
  let nameValue = $state((coffee?.coffee_name ?? prefill?.coffee_name) ?? '');
  // "Set as roaster default" is a form field like any other (hidden input
  // below): staged, dirty-checked, saved and discarded with the rest. Read back
  // from a staged merge so a re-rendered form keeps the mark.
  let setRoasterDefault = $state(stagedRoasterDefault(coffee));
  const canSetDefault = $derived(roasterValue.trim() !== '' && imageValue.trim() !== '');
  const defaultPreview = $derived(imageValue.trim() ? null : roasterDefaultFor(roasterImages, roasterValue));

  // Image Suggest (shared ImageSuggest.svelte). roasterWebsite is a staged form field (hidden input).
  let roasterWebsite = $state(stagedRoasterWebsite(coffee));
  // The page the image came from (credit under the image): set by a Suggest pick or Fill from URL,
  // cleared when the image is typed over or discarded. A hidden field, staged like the rest.
  let imageSource = $state((coffee?.image_source_url ?? prefill?.image_source_url) ?? '');
  const canSuggest = $derived(roasterValue.trim() !== '' && nameValue.trim() !== '');

  // The coffee being matched, as typed at the moment Suggest is pressed.
  // Two lines: roaster · coffee name, then processing · roast date; empty parts
  // (and an empty line) are left out.
  function suggestMatching(): string[] {
    const date = fieldValue('roast_date');
    const line = (parts: string[]) => parts.map((x) => x.trim()).filter(Boolean).join(' · ');
    return [
      line([fieldValue('roaster'), fieldValue('coffee_name')]),
      line([fieldValue('processing'), date && `Roasted ${formatDate(date)}`])
    ].filter(Boolean);
  }

  function pick(c: Candidate, r: SuggestResponse) {
    // A site staged by "change" counts as stored: only "change" replaces a site.
    const p = pickCandidate(c, fieldValue('product_url'), r.storedSite ?? (roasterWebsite || null), fieldValue('roaster'));
    setField('image_url', p.image_url);
    imageSource = p.image_source_url;
    if (p.product_url) setField('product_url', p.product_url);
    // A pick never clears a site already staged (e.g. by "change").
    roasterWebsite = p.roaster_website ?? roasterWebsite;
    showPreview(p.image_url);
  }

  function syncImageFields() {
    roasterValue = fieldValue('roaster');
    imageValue = fieldValue('image_url');
    nameValue = fieldValue('coffee_name');
    // No image, no mark: retyping one must not silently re-arm it.
    if (!imageValue.trim()) setRoasterDefault = false;
  }

  let lastRest: RestSuggestion | null = null;
  let restNote = $state<string | null>(null);

  function setField(name: string, value: string | number) {
    const el = formEl.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) el.value = String(value);
    if (name === 'roaster' || name === 'image_url' || name === 'coffee_name') syncImageFields();
  }

  // Only on a user change of the select, never on load: an existing bag's cost stays put.
  // None puts back the cost from before the first plan fill (see costAfterPlanChange).
  let costMemo: CostMemo | null = null;
  function fillCostFromPlan(e: Event) {
    const plan = subscriptions?.find((p) => String(p.id) === (e.currentTarget as HTMLSelectElement).value) ?? null;
    const r = costAfterPlanChange(costMemo, fieldValue('cost'), plan);
    costMemo = r.memo;
    if (r.cost != null) setField('cost', r.cost);
  }

  // Choosing Blend fills a blank Origin with "Blend"; going back removes only that fill. A typed value always stays.
  let originAutoFilled = false;
  function typeChanged(e: Event) {
    const blend = (e.currentTarget as HTMLSelectElement).value === '1';
    if (blend && !fieldValue('origin').trim()) {
      setField('origin', 'Blend');
      originAutoFilled = true;
    } else if (!blend && originAutoFilled) {
      if (fieldValue('origin') === 'Blend') setField('origin', '');
      originAutoFilled = false;
    }
  }

  function fieldValue(name: string): string {
    const el = formEl.elements.namedItem(name);
    return el instanceof HTMLInputElement || el instanceof HTMLSelectElement ? el.value : '';
  }

  // Shared by every caller that needs the form's fields as a plain object:
  // the use:enhance handler below (staged submit), cloneCurrent, and
  // applyPendingEdits' dirty check.
  function fieldsFrom(formData: FormData): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') fields[key] = value;
    }
    return fields;
  }

  function captureFields(): Record<string, string> {
    return fieldsFrom(new FormData(formEl));
  }

  // Writes rest days only onto empty fields or the previous untouched
  // suggestion; a null suggestion clears only that previous suggestion.
  function offerRest(s: RestSuggestion | null) {
    if (!canReplaceRest(fieldValue('rest_days_low'), fieldValue('rest_days_high'), lastRest)) return;
    setField('rest_days_low', s?.low ?? '');
    setField('rest_days_high', s?.high ?? '');
    lastRest = s;
    restNote = s?.note || null;
  }

  function roastLevelChanged() {
    offerRest(suggestRest(fieldValue('roaster').trim() || null, fieldValue('roast_level') || null, restHistory));
  }

  function showPreview(src: string) {
    previewSrc = src.trim() || null;
    previewFailed = false;
    if (previewSrc) loadFill(previewSrc);
  }

  $effect(() => {
    if (defaultPreview) loadFill(defaultPreview);
  });

  // "Original" is read at failure time, so it's the coffee's current value
  // including staged edits (in Edit mode `coffee` is the staged merge).
  function fillFailed(message: string, tried: string) {
    fillError = message;
    const { revertTo, offer } = afterFailedFill(tried, lastFilledUrl, (coffee?.product_url ?? prefill?.product_url) ?? '');
    setField('product_url', revertTo);
    unsavedUrl = offer;
  }

  async function fillFromPage() {
    const url = fieldValue('product_url').trim();
    fillError = null;
    unsavedUrl = null;
    if (!url) {
      fillError = 'Paste the product page URL first';
      return;
    }
    filling = true;
    try {
      const res = await fetch('/api/coffees/fill-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.fields) {
        // SvelteKit's own errors (e.g. 401) come back as { message }.
        fillFailed(data.error ?? data.message ?? `Fill failed (HTTP ${res.status})`, url);
        return;
      }
      const { rest_days_low, rest_days_high, ...found } = data.fields;
      for (const [key, value] of Object.entries(found)) setField(key, value as string | number);
      if (rest_days_low != null && rest_days_high != null) {
        offerRest({ low: rest_days_low, high: rest_days_high, note: data.restNote ?? '' });
      } else if (found.roast_level) {
        offerRest(null);
      }
      lastFilledUrl = url;
      if (data.fields.image_url) {
        imageSource = url;
        showPreview(data.fields.image_url);
      }
      fillNotes = data.notes;
      fillVariants = data.variants;
      selectedVariant = data.selected;
    } catch {
      fillFailed("Couldn't reach the server", url);
    } finally {
      filling = false;
    }
  }

  function chooseVariant(i: number) {
    const v = fillVariants[i];
    selectedVariant = i;
    if (v.grams != null) setField('amount_g', v.grams);
    if (v.costUsd != null) setField('cost', v.costUsd);
  }

  // Clones what's currently typed (unsaved tweaks included), not the
  // saved row — captured the same way staged mode captures a submit.
  function cloneCurrent() {
    if (!coffee || !onclone) return;
    onclone(clonePrefill(mergeStagedCoffee(coffee, captureFields())));
  }

  // Staged mode's `action` attribute points at `?/save`, which no longer
  // exists as a server action now that staged editing intercepts the
  // submit client-side via use:enhance — a click in the narrow window
  // before hydration/enhance attaches would otherwise fall through to a
  // real native POST there and lose whatever was typed. Gating the submit
  // button on mount closes that window. Non-staged (create) submissions
  // deliberately skip this guard: `?/create` is a real action, so that
  // path still works with JS disabled entirely.
  let mounted = $state(false);
  // What the form held right after it rendered (or after it was last
  // staged) — applyPendingEdits' dirty check compares the live fields
  // against this rather than re-deriving it from props, so it stays
  // correct across `coffee` re-merging after a stage without needing its
  // own prop-tracking effect.
  let baselineFields: Record<string, string> | null = null;
  onMount(() => {
    mounted = true;
    baselineFields = captureFields();
  });

  // Exposed so "Save changes" (list/detail pages) can apply THIS form's
  // pending edits first, exactly as clicking "Update" would — same
  // use:enhance handler above (same stageFieldChange/onstage call via
  // fieldsFrom), not a second copy of it. Two guards before that happens:
  // - Nothing to apply: the form is untouched since it rendered/was last
  //   staged, so skip the submit entirely rather than staging a no-op
  //   "update" with unchanged values on every save.
  // - Invalid: requestSubmit() runs the browser's own constraint
  //   validation first — a blanked-out required field shows the same
  //   native validation UI a real Update click would and never fires the
  //   submit event, so onstage is never called; this returns false so the
  //   caller can stop before saving.
  export function applyPendingEdits(): boolean {
    const current = captureFields();
    if (baselineFields && !fieldsChanged(current, baselineFields)) return true;
    const ok = formEl.checkValidity();
    if (!ok) {
      formEl.reportValidity();
      return false;
    }
    // requestSubmit() synchronously runs the use:enhance handler above,
    // which updates baselineFields itself (same as a manual Update click
    // does) — nothing left to do here but report success.
    formEl.requestSubmit();
    return true;
  }
</script>

<form
  bind:this={formEl}
  method="POST"
  action={coffee ? '?/save' : '?/create'}
  use:enhance={({ formData, cancel }) => {
    if (onstage) {
      // Staged mode: capture the form's current values and hand them to
      // the parent instead of actually submitting. `cancel()` is
      // use:enhance's own supported hook for aborting a submission
      // before any request is sent — using it here (rather than a
      // separate onsubmit handler) avoids any risk of both an onsubmit
      // handler AND enhance's own fetch both firing for the same click.
      cancel();
      const fields = fieldsFrom(formData);
      baselineFields = fields;
      onstage(fields);
      return;
    }
    return async ({ result, update }) => {
      await update();
      if (result.type === 'success') {
        onsuccess?.();
      }
    };
  }}
>
  {#if formError}
    <p class="badge badge-urgent">{formError}</p>
  {/if}
  {#if beanConquerorId}
    <input type="hidden" name="beanconqueror_id" value={beanConquerorId} />
  {/if}

  <datalist id="roaster-suggestions">
    {#each roasters as name (name)}
      <option value={name}></option>
    {/each}
  </datalist>
  <datalist id="origin-suggestions">
    {#each origins as name (name)}
      <option value={name}></option>
    {/each}
  </datalist>
  <datalist id="processing-suggestions">
    {#each processingMethods as name (name)}
      <option value={name}></option>
    {/each}
  </datalist>

  {#snippet detail(name: CoffeeOriginField)}
    <div class="form-field field-{name}">
      <label for={name}>{COFFEE_ORIGIN_LABELS[name]}</label>
      <input id={name} {name} value={(coffee?.[name] ?? prefill?.[name]) ?? ''} autocomplete="off" />
    </div>
  {/snippet}

  {#snippet sizeChips()}
    <div class="form-field group-field">
      <span>Bag size</span>
      <div class="tab-group fill-sizes" role="group" aria-label="Bag size">
        {#each fillVariants as v, i (i)}
          <button type="button" aria-pressed={selectedVariant === i} onclick={() => chooseVariant(i)}>
            {v.label || (v.grams != null ? `${v.grams}g` : `Option ${i + 1}`)} · {v.costUsd != null
              ? usd(v.costUsd)
              : v.originalPrice}
          </button>
        {/each}
      </div>
    </div>
  {/snippet}

  <div class="form-grid">
  <div class="form-group">
  <div class="form-field product-url-field span-all">
    <label for="product_url">Product page URL</label>
    <div class="inline-row">
      <input
        id="product_url"
        name="product_url"
        type="url"
        placeholder="https://roaster.example/products/…"
        value={(coffee?.product_url ?? prefill?.product_url) ?? ''}
        onkeydown={(e) => {
          // Enter here means "fill", not "submit the whole form".
          if (e.key === 'Enter') {
            e.preventDefault();
            fillFromPage();
          }
        }}
      />
      <button class="button" type="button" disabled={filling} onclick={fillFromPage}>
        {filling ? 'Filling…' : 'Fill from page'}
      </button>
    </div>
    {#if fillError}
      <p class="badge badge-urgent" role="alert">{fillError}</p>
      {#if unsavedUrl}
        <div class="fill-offer">
          <p class="fill-note">
            Save <code class="fill-offer-url">{unsavedUrl}</code> as the product page anyway?
          </p>
          <div class="fill-offer-actions">
            <button
              class="button button-secondary"
              type="button"
              onclick={() => {
                setField('product_url', unsavedUrl ?? '');
                unsavedUrl = null;
              }}>Yes</button
            >
            <button class="button button-ghost" type="button" onclick={() => (unsavedUrl = null)}>No</button>
          </div>
        </div>
      {/if}
    {/if}
    {#if fillNotes.length}
      <p class="text-muted fill-note" aria-live="polite">{fillNotes.join(' · ')}</p>
    {/if}
    {#if fillVariants.length}
      {@render sizeChips()}
    {/if}
  </div>

  <div class="form-field field-roaster">
    <label for="roaster">Roaster</label>
    <input id="roaster" name="roaster" required oninput={syncImageFields} value={(coffee?.roaster ?? prefill?.roaster) ?? ''} list="roaster-suggestions" autocomplete="off" />
  </div>

  <div class="form-field field-coffee">
    <label for="coffee_name">Coffee</label>
    <input id="coffee_name" name="coffee_name" required oninput={syncImageFields} value={(coffee?.coffee_name ?? prefill?.coffee_name) ?? ''} />
  </div>

    <div class="form-field form-field-checkbox field-decaf">
      <label for="decaf">
        <input id="decaf" name="decaf" type="checkbox" checked={(coffee?.decaf ?? prefill?.decaf) === 1} />
        Decaf
      </label>
    </div>

    <div class="form-field field-image span-all">
      <!-- A one-line label so the input lines up with its row's (a 2-line label
           pushed it down); the hint moves into the placeholder. -->
      <label for="image_url">Image URL</label>
      <div class="inline-row">
        <input
          id="image_url"
          name="image_url"
          type="url"
          placeholder="Bag label or roaster logo"
          value={(coffee?.image_url ?? prefill?.image_url) ?? ''}
          oninput={() => {
            imageSource = '';
            syncImageFields();
          }}
        />
        <div class="inline-row-actions" data-button-row>
          <button class="button button-secondary" type="button" onclick={() => showPreview(fieldValue('image_url'))}>Preview</button>
          <ImageSuggest
            endpoint="/api/coffees/image-suggest"
            body={() => ({
              roaster: fieldValue('roaster'),
              name: fieldValue('coffee_name'),
              origin: fieldValue('origin'),
              roastDate: fieldValue('roast_date'),
              site: roasterWebsite || undefined
            })}
            matching={suggestMatching}
            siteLabel="Roaster website"
            disabled={!canSuggest}
            onpick={pick}
            onsite={(site) => (roasterWebsite = site)}
          />
          <button
            class="button button-danger button-ghost"
            type="button"
            onclick={() => {
              setField('image_url', '');
              imageSource = '';
              previewSrc = null;
              setRoasterDefault = false;
            }}>Discard image</button
          >
          <!-- The staged-changes UI only says "Pending: edited", so the button is the
               cue. No undo control: Discard/Cancel drops the mark with the rest. -->
          <button
            class="button button-ghost"
            type="button"
            aria-pressed={setRoasterDefault && canSetDefault}
            disabled={!canSetDefault || setRoasterDefault}
            onclick={() => (setRoasterDefault = true)}
            >{setRoasterDefault && canSetDefault ? 'Will be set as default' : 'Set as roaster default'}</button
          >
        </div>
      </div>
      {#if setRoasterDefault && canSetDefault}
        <input type="hidden" name="set_roaster_default" value="1" />
      {/if}
      <!-- Always sent: empty means cleared, so a staged merge never brings back the stored source. -->
      <input type="hidden" name="image_source_url" value={imageSource} />
      {#if roasterWebsite}
        <input type="hidden" name="roaster_website" value={roasterWebsite} />
      {/if}
      <!-- Suggest results (spec "UI"). Every button is type="button" and the
           site box has no name, so nothing in here submits or stages the form.
           A click on the dialog itself (not its sheet) is a backdrop click. -->
      {#if defaultPreview}
        <figure class="default-preview">
          <img
            class="image-preview"
            src={defaultPreview}
            alt={`${roasterValue.trim()} logo`}
            style:background-color={backdrop(fills[defaultPreview])}
          />
          <figcaption class="text-muted fill-note">Roaster default</figcaption>
        </figure>
      {:else if previewSrc}
        {#if previewFailed}
          <p class="text-muted fill-note">Couldn't load image</p>
        {:else}
          <img
            class="image-preview"
            src={previewSrc}
            alt="Preview"
            style:background-color={backdrop(fills[previewSrc])}
            onerror={() => (previewFailed = true)}
          />
        {/if}
      {/if}
    </div>
  </div>

  <fieldset class="form-group">
    <legend>Origin</legend>
  <div class="form-field field-type">
    <label for="blend">Type</label>
    <select id="blend" name="blend" onchange={typeChanged}>
      <option value="0" selected={(coffee?.blend ?? prefill?.blend) != 1}>Single origin</option>
      <option value="1" selected={(coffee?.blend ?? prefill?.blend) == 1}>Blend</option>
    </select>
  </div>
  <div class="form-field field-origin">
    <label for="origin">Origin</label>
    <input id="origin" name="origin" value={(coffee?.origin ?? prefill?.origin) ?? ''} list="origin-suggestions" autocomplete="off" />
  </div>

    {@render detail('region')}
    {@render detail('producer')}
    {@render detail('farm')}
    {@render detail('variety')}
    <div class="form-field field-processing">
      <label for="processing">Processing</label>
      <input
        id="processing"
        name="processing"
        value={(coffee?.processing ?? prefill?.processing) ?? ''}
        list="processing-suggestions"
        autocomplete="off"
      />
    </div>
    {@render detail('elevation')}
    {@render detail('harvest_time')}
    {@render detail('certification')}
  </fieldset>

  <fieldset class="form-group">
    <legend>Bag</legend>
  <div class="form-field field-roastlevel">
    <label for="roast_level">Roast level</label>
    <select id="roast_level" name="roast_level" onchange={roastLevelChanged}>
      <option value="">—</option>
      {#each roastLevels as level (level.roast_level)}
        <option value={level.roast_level} selected={(coffee?.roast_level ?? prefill?.roast_level) === level.roast_level}>
          {level.roast_level}
        </option>
      {/each}
    </select>
  </div>

  <div class="form-field field-amount">
    <label for="amount_g">Amount (g)</label>
    <input id="amount_g" name="amount_g" type="number" step="1" value={(coffee?.amount_g ?? prefill?.amount_g) ?? ''} />
  </div>

  <div class="form-field field-cost">
    <label for="cost">Cost</label>
    <input id="cost" name="cost" type="number" step="0.01" value={(coffee?.cost ?? prefill?.cost) ?? ''} />
  </div>

  {#if subscriptions}
    <div class="form-field field-subscription span-all">
      <label for="subscription_id">Subscription</label>
      <select id="subscription_id" name="subscription_id" onchange={fillCostFromPlan}>
        <option value="">None</option>
        {#each subscriptions as sub (sub.id)}
          <option value={sub.id} selected={Number(coffee?.subscription_id) === sub.id}>{sub.label}</option>
        {/each}
      </select>
    </div>
  {/if}
  </fieldset>

  <fieldset class="form-group">
    <legend>Timing</legend>
  <div class="form-field field-roastdate">
    <label for="roast_date">Roast date</label>
    <input id="roast_date" name="roast_date" type="date" value={(coffee?.roast_date ?? prefill?.roast_date) ?? ''} />
  </div>

  <div class="form-field field-rest">
    <div class="rest-days-row">
      <div class="rest-days-field">
        <label for="rest_days_low">Min rest</label>
        <input id="rest_days_low" name="rest_days_low" type="number" step="1" value={(coffee?.rest_days_low ?? prefill?.rest_days_low) ?? ''} />
      </div>
      <div class="rest-days-field">
        <label for="rest_days_high">Max rest</label>
        <input
          id="rest_days_high"
          name="rest_days_high"
          type="number"
          step="1"
          value={(coffee?.rest_days_high ?? prefill?.rest_days_high) ?? ''}
        />
      </div>
    </div>
    {#if restNote}
      <p class="text-muted fill-note">{restNote}</p>
    {/if}
  </div>

  <div class="form-field field-frozenstart">
    <label for="frozen_start_date">Frozen start date</label>
    <input
      id="frozen_start_date"
      name="frozen_start_date"
      type="date"
      value={coffee?.frozen_start_date ?? ''}
    />
  </div>

    <div class="form-field field-frozenend">
      <label for="frozen_end_date">Frozen end date</label>
      <input id="frozen_end_date" name="frozen_end_date" type="date" value={coffee?.frozen_end_date ?? ''} />
    </div>
  </fieldset>

    {#if coffee}
      <input type="hidden" name="id" value={coffee.id} />
      <div class="form-field field-slug">
        <label for="slug">URL slug</label>
        <div class="inline-row">
          <input id="slug" name="slug" required readonly={slugLocked} bind:this={slugInput} value={coffee.slug} />
          {#if slugLocked}
            <button
              class="button button-secondary"
              type="button"
              aria-label="Edit URL"
              onclick={() => {
                slugLocked = false;
                slugInput.focus();
              }}>Edit</button
            >
          {:else}
            <button
              class="button button-secondary"
              type="button"
              aria-label="Cancel URL edit"
              onclick={() => {
                setField('slug', initialSlug);
                slugLocked = true;
              }}>Cancel</button
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if showSubmit}
    <button class="button" type="submit" disabled={onstage ? !mounted : false}>{onstage ? 'Update' : 'Save'}</button>
  {/if}
  {#if oncancel}
    <button class="button button-ghost" type="button" onclick={oncancel}>Cancel</button>
  {/if}
  {#if onclone && coffee && showClone}
    <button class="button button-secondary" type="button" onclick={cloneCurrent}>Clone</button>
  {/if}
</form>

<style>
  /* The form follows the coffee page's order: a top group (like the page header), then the
     Origin, Bag and Timing groups, then the URL slug. Each group is its own grid, so a tall
     cell (a Fill's rest-days note, an image preview, a save-anyway prompt) only grows its
     own row. Base rule first, breakpoint overrides after (source-order cascade, docs/HANDOFF.md). */
  .form-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .form-group {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    display: grid;
    /* minmax(0, 1fr), not plain 1fr: an `fr` track's minimum is its content's natural
       size, so a wide select would make its own column wider than the others. */
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2) var(--space-5);
  }
  /* The Type select is as tall as the Origin input beside it (a select's own height differs). Phones
     keep the 44px touch-target minimum every select has. */
  @media (min-width: 641px) {
    .field-type select {
      height: calc(1lh + 2 * var(--space-2) + 2px);
    }
  }
  .form-group legend {
    padding: 0;
    margin-bottom: var(--space-2);
    font-weight: 600;
    grid-column: 1 / -1;
  }
  /* Beside Roaster and Coffee: sits on the inputs' row, centered on them. */
  .field-decaf {
    align-self: end;
    min-height: 2.4rem;
  }
  .span-all {
    grid-column: 1 / -1;
  }
  /* Grid items default to min-width: auto, which fights the equal-column floor above. */
  .form-field {
    min-width: 0;
  }
  /* Inline in a Coffees card, the grid follows the card's width, not the viewport's, so
     fields stay >= ~150px: two columns under 500px, one under 330px. */
  @container card (width < 500px) {
    .form-group {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container card (width < 330px) {
    .form-group {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .form-group {
      grid-template-columns: 1fr;
    }
    /* Phone: the image row's buttons take the full row and grow to share each
       line instead of a ragged 2 + 1 at content widths. Same as
       .fill-offer-actions (ui-rules 17). */
    .inline-row-actions {
      flex: 1 1 100%;
    }
    .inline-row-actions > :global(.button) {
      flex: 1 1 auto;
      text-align: center;
    }
  }
  .inline-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: stretch;
  }
  .inline-row input {
    flex: 1;
    /* A real floor (not 0) so a narrow row wraps its buttons onto their own
       line below instead of squeezing the input down toward nothing. */
    min-width: 10rem;
  }
  /* Button(s) never wrap their own label text, and never shrink below it —
     at phone width the row wraps the whole button/group below the input
     (see .inline-row-actions) rather than letting either side get squeezed. */
  .inline-row .button {
    flex-shrink: 0;
    white-space: nowrap;
  }
  /* Groups the trailing buttons (Preview, Discard image, Set as roaster
     default) into one flex item, so they wrap below the input together; at
     phone width the group then wraps inside itself rather than overflowing. */
  .inline-row-actions {
    display: flex;
    flex-wrap: wrap;
    min-width: 0;
    gap: var(--space-2);
  }
  /* The gap spaces them; app.css .button's margin would double it. */
  .inline-row-actions > :global(.button) {
    margin: 0;
  }
  .fill-note {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  .fill-sizes {
    margin-top: var(--space-2);
  }
  /* Yes/No always go on their own row below the text (all widths, not just
     phone) rather than wrapping inline with it — the text (a full product
     URL) is unbounded length, so sharing a flex row with the buttons meant
     the buttons got squeezed or pushed off narrow screens. */
  .fill-offer-actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .fill-offer-actions .button {
    flex: 1;
    margin: 0;
    text-align: center;
  }
  .fill-offer-url {
    overflow-wrap: anywhere;
  }
  .image-preview {
    display: block;
    margin-top: var(--space-2);
    width: 96px;
    height: 96px;
    object-fit: contain;
    border-radius: var(--radius);
  }
  .default-preview {
    margin: 0;
  }
  /* Low/high sit side by side within this one .form-grid cell (a fixed
     grid-column span here, to make the note below sit under both fields,
     misplaced the note under whichever two columns grid auto-placement
     happened to pack next to it — not reliably under low/high). The note
     below is rendered once for the pair, so it reads as spanning both
     instead of sitting only under (high) as it used to. */
  .rest-days-row {
    display: flex;
    gap: var(--space-2);
  }
  .rest-days-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }
  /* Locked (readonly) slug reads as disabled: same muted/gray treatment as
     the app's other muted text, and a "not-allowed" cursor. Unlocked (via
     Edit) it looks like every other input. */
  #slug:read-only {
    background: var(--color-border);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
</style>
