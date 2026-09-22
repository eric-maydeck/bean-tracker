<script lang="ts">
  import { enhance } from '$app/forms';
  import type { CoffeeRow } from '$lib/types';
  import type { RoastLevelRow } from '$lib/types';

  let {
    coffee = null,
    prefill = null,
    roastLevels,
    roasters = [],
    origins = [],
    processingMethods = [],
    formError = null,
    oncancel = null,
    onsuccess = null,
    onstage = null
  }: {
    coffee?: CoffeeRow | null;
    prefill?: Partial<CoffeeRow> | null;
    roastLevels: RoastLevelRow[];
    roasters?: string[];
    origins?: string[];
    processingMethods?: string[];
    formError?: string | null;
    oncancel?: (() => void) | null;
    onsuccess?: (() => void) | null;
    onstage?: ((fields: Record<string, string>) => void) | null;
  } = $props();
</script>

<form
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
      const fields: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') fields[key] = value;
      }
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

  <div class="form-grid">
  <div class="form-field">
    <label for="roaster">Roaster</label>
    <input id="roaster" name="roaster" required value={(coffee?.roaster ?? prefill?.roaster) ?? ''} list="roaster-suggestions" autocomplete="off" />
  </div>

  <div class="form-field">
    <label for="coffee_name">Coffee</label>
    <input id="coffee_name" name="coffee_name" required value={(coffee?.coffee_name ?? prefill?.coffee_name) ?? ''} />
  </div>

  <div class="form-field">
    <label for="origin">Origin</label>
    <input id="origin" name="origin" value={(coffee?.origin ?? prefill?.origin) ?? ''} list="origin-suggestions" autocomplete="off" />
  </div>

  <div class="form-field">
    <label for="roast_level">Roast level</label>
    <select id="roast_level" name="roast_level">
      <option value="">—</option>
      {#each roastLevels as level (level.roast_level)}
        <option value={level.roast_level} selected={(coffee?.roast_level ?? prefill?.roast_level) === level.roast_level}>
          {level.roast_level}
        </option>
      {/each}
    </select>
  </div>

  <div class="form-field">
    <label for="processing">Processing</label>
    <input
      id="processing"
      name="processing"
      value={(coffee?.processing ?? prefill?.processing) ?? ''}
      list="processing-suggestions"
      autocomplete="off"
    />
  </div>

  <div class="form-field">
    <label for="amount_g">Amount (g)</label>
    <input id="amount_g" name="amount_g" type="number" step="1" value={(coffee?.amount_g ?? prefill?.amount_g) ?? ''} />
  </div>

  <div class="form-field">
    <label for="cost">Cost</label>
    <input id="cost" name="cost" type="number" step="0.01" value={(coffee?.cost ?? prefill?.cost) ?? ''} />
  </div>

  <div class="form-field">
    <label for="roast_date">Roast date</label>
    <input id="roast_date" name="roast_date" type="date" value={(coffee?.roast_date ?? prefill?.roast_date) ?? ''} />
  </div>

  <div class="form-field">
    <label for="frozen_start_date">Frozen start date</label>
    <input
      id="frozen_start_date"
      name="frozen_start_date"
      type="date"
      value={coffee?.frozen_start_date ?? ''}
    />
  </div>

  <div class="form-field">
    <label for="frozen_end_date">Frozen end date</label>
    <input id="frozen_end_date" name="frozen_end_date" type="date" value={coffee?.frozen_end_date ?? ''} />
  </div>

  <div class="form-field">
    <label for="rest_days_low">Recommended rest days (low)</label>
    <input id="rest_days_low" name="rest_days_low" type="number" step="1" value={coffee?.rest_days_low ?? ''} />
  </div>

  <div class="form-field">
    <label for="rest_days_high">Recommended rest days (high)</label>
    <input
      id="rest_days_high"
      name="rest_days_high"
      type="number"
      step="1"
      value={coffee?.rest_days_high ?? ''}
    />
  </div>

  <div class="form-field">
    <label for="image_url">Image URL (label or roaster logo)</label>
    <input id="image_url" name="image_url" type="url" value={coffee?.image_url ?? ''} />
  </div>

  <div class="form-field form-field-checkbox">
    <label for="decaf">
      <input id="decaf" name="decaf" type="checkbox" checked={(coffee?.decaf ?? prefill?.decaf) === 1} />
      Decaf
    </label>
  </div>

  {#if coffee}
    <input type="hidden" name="id" value={coffee.id} />
    <div class="form-field">
      <label for="slug">URL slug</label>
      <input id="slug" name="slug" required value={coffee.slug} />
    </div>
  {/if}
  </div>

  <button class="button" type="submit">{onstage ? 'Update' : 'Save'}</button>
  {#if oncancel}
    <button class="button button-secondary" type="button" onclick={oncancel}>Cancel</button>
  {/if}
</form>
