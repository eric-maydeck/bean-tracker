<script lang="ts">
  // The overlay for adding, cloning and editing one coffee. Its sticky header keeps the title, the status actions (edit only)
  // and Save / Cancel in reach while the form scrolls. Edit: Save runs `onsave` (the page commits that one coffee); add and
  // clone: Save submits the form. Cancel and Escape ask first when something is typed or staged.
  import { onMount, type ComponentProps, type Snippet } from 'svelte';
  import CoffeeForm from '#lib/components/CoffeeForm.svelte';
  import type { CoffeeRow } from '#lib/types.ts';

  type FormProps = Pick<ComponentProps<typeof CoffeeForm>, 'roastLevels' | 'roasters' | 'roasterImages' | 'origins' | 'processingMethods' | 'restHistory' | 'subscriptions'>;

  let { mode, coffee = null, prefill = null, formProps, formError = null, saving = false, hasStaged = false, title, statusActions, onsave, oncancel, onsuccess, onstage }: {
    mode: 'add' | 'clone' | 'edit';
    coffee?: CoffeeRow | null;
    prefill?: Partial<CoffeeRow> | null;
    formProps: FormProps;
    formError?: string | null;
    saving?: boolean;
    hasStaged?: boolean; // staged status action or fields, which Cancel would drop
    title: Snippet;
    statusActions?: Snippet; // edit only
    onsave?: () => void;
    oncancel: () => void;
    onsuccess?: () => void;
    onstage?: (fields: Record<string, string>) => void;
  } = $props();

  let form: { applyPendingEdits: () => Promise<boolean>; submit: () => void; isDirty: () => boolean };
  let dlg: HTMLDivElement;

  export const applyPendingEdits = () => form.applyPendingEdits();

  function cancel() {
    if ((hasStaged || form?.isDirty()) && !confirm('You have unsaved changes. Discard them?')) return;
    oncancel();
  }

  function save() {
    if (mode === 'edit') onsave?.();
    else form.submit();
  }

  // Focus moves into the dialog (not a field: a phone keyboard would pop) and returns to the opener on close.
  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    dlg.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  });

  // Escape closes the overlay unless it is closing a native dialog (the standards check) or popover first.
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open], :popover-open')) cancel();
  }
</script>

<div class="modal-backdrop">
  <div class="modal coffee-edit-modal" role="dialog" aria-modal="true" aria-labelledby="coffee-edit-title" tabindex="-1" bind:this={dlg} {onkeydown}>
    <div class="modal-head">
      <h2 id="coffee-edit-title">{@render title()}</h2>
      <div class="modal-head-actions">
        {#if mode === 'edit' && statusActions}{@render statusActions()}{/if}
        <div class="modal-head-buttons">
          <button class="button button-success button-solid" type="button" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
          <button class="button button-secondary" type="button" disabled={saving} onclick={cancel}>Cancel</button>
        </div>
      </div>
    </div>
    <div class="modal-body">
    <CoffeeForm
      bind:this={form}
      {coffee}
      {prefill}
      cloned={mode === 'clone'}
      {...formProps}
      {formError}
      {onstage}
      {onsuccess}
      showSubmit={false}
      showClone={false}
    />
    </div>
  </div>
</div>

<style>
  /* Sticks to the top of the scrolling .modal, its background covering the modal's padding so fields scroll under it. */
  .modal-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-3) var(--space-5);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }
  .modal-head h2 {
    margin: 0;
    flex: 1 1 auto;
    min-width: 0;
  }
  .modal-head-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .modal-head-buttons {
    display: flex;
    gap: var(--space-2);
  }
  .modal-head :global(.button) {
    margin: 0;
    min-height: 44px;
  }
  .modal-head :global(.button.button-icon) {
    min-width: 44px;
  }
  .modal-head :global(.action-stack) {
    flex-direction: row;
  }
  .modal-head :global(.action-row) {
    display: contents;
  }
  /* No padding on the scroller itself: the header sticks flush to its top, the form pads itself. */
  .coffee-edit-modal {
    padding: 0;
  }
  .modal-body {
    padding: var(--space-4) var(--space-5) var(--space-5);
  }
  .coffee-edit-modal:focus {
    outline: none;
  }
</style>
