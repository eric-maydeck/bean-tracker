<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { inFormOrder, resolve, saveBlock, type Decision, type StdRow } from '$lib/standardsDialog';

  // Confirmation before saving / filling a coffee: lists the fields that would change (Now vs Proposed). #76
  let { rows, onsave, oncancel, roasterLink }: {
    rows: StdRow[];
    onsave: (values: Record<string, string>, decisions: Record<string, Decision>) => void;
    oncancel: () => void;
    roasterLink: (name: string) => string;
  } = $props();

  let dlg: HTMLDialogElement;
  let decisions = $state<Record<string, Decision>>({});
  const block = $derived(saveBlock(rows, decisions));
  const sorted = $derived(inFormOrder(rows));
  const locked = (r: StdRow) => r.kind === 'locked' || r.kind === 'forced';

  onMount(() => dlg.showModal());

  const setAll = (d: Decision) => {
    for (const r of rows) if (r.kind === 'choice') decisions[r.field] = d;
  };
  const save = () => {
    if (!block) onsave(resolve(rows, decisions), { ...decisions });
  };
  // Esc, backdrop and Cancel all end here; only a press that began on the backdrop closes it.
  let pressedBackdrop = false;
</script>

<dialog class="sd-dialog" aria-labelledby="sd-title" bind:this={dlg} onclose={oncancel} onpointerdown={(e) => (pressedBackdrop = e.target === dlg)} onclick={(e) => e.target === dlg && pressedBackdrop && dlg.close()}>
  <div class="sd-sheet">
    <header class="sd-header">
      <h2 id="sd-title">Review changes</h2>
      <div class="sd-bulk">
        <button type="button" class="button button-secondary" onclick={() => setAll('approve')}>Approve all</button>
        <button type="button" class="button button-secondary" onclick={() => setAll('reject')}>Reject all</button>
      </div>
    </header>
    <div class="sd-body">
    <div class="sd-colhead" aria-hidden="true"><span></span><span>Now</span><span>Proposed</span><span></span></div>
    <ul class="sd-list">
      {#each sorted as r (r.field)}
        <li class="sd-row">
          <span class="sd-label">{r.label}{#if locked(r)} <span class="sd-lock" role="img" aria-label="Locked: standard format"><Icon name="lock" /></span>{/if}</span>
          {#if r.kind === 'blocked'}
            <span class="sd-bad sd-wide">{r.label} "{r.now}" can't be converted: Cancel and fix it in the form</span>
          {:else}
            <span class="sd-now"><span class="sd-tag">Now</span> {r.now || '—'}</span>
            <span class="sd-prop" class:sd-empty={r.proposed == null}><span class="sd-tag">Proposed</span> {r.proposed ?? ''}</span>
            <span class="sd-choice">
              {#if r.kind === 'choice'}
                <span class="sd-pair" role="group" aria-label={r.label}>
                  <button type="button" class="button button-secondary" aria-pressed={decisions[r.field] === 'approve'} onclick={() => (decisions[r.field] = 'approve')}>Approve</button>
                  <button type="button" class="button button-secondary" aria-pressed={decisions[r.field] === 'reject'} onclick={() => (decisions[r.field] = 'reject')}>Reject</button>
                </span>
              {:else if r.kind === 'missing'}
                <button type="button" class="button button-secondary" aria-pressed={decisions[r.field] === 'leave'} onclick={() => (decisions[r.field] = 'leave')}>Leave blank</button>
              {:else if r.kind === 'unconverted'}
                <span class="sd-note">can't convert, saved as typed</span>
              {:else if r.kind === 'forced'}
                <span class="sd-note">can't convert, replaced</span>
              {/if}
            </span>
            {#if r.kind === 'choice' && r.field === 'roaster' && r.roasterCount}
              <!-- Space is reserved while undecided/approved so rejecting doesn't shift the rows below. -->
              <span class="sd-bad sd-wide sd-warn" class:sd-hide={decisions[r.field] !== 'reject'}>{r.roasterCount} {r.roasterCount === 1 ? 'coffee' : 'coffees'} already saved as "{r.proposed}" <a href={roasterLink(r.proposed ?? '')} target="_blank" rel="noopener">See coffees</a></span>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
    </div>
    <footer class="sd-footer">
      <button type="button" class="button button-ghost" onclick={() => dlg.close()}>Cancel</button>
      <button type="button" class="button" aria-disabled={block ? 'true' : undefined} aria-describedby={block ? 'sd-block' : undefined} title={block ?? undefined} onclick={save}>Save</button>
      {#if block}<span id="sd-block" class="sd-sr">{block}</span>{/if}
    </footer>
  </div>
</dialog>

<style>
  .sd-dialog {
    width: min(44rem, 100% - 2rem);
    max-height: 85dvh;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    font-size: 0.875rem;
  }
  .sd-dialog[open] {
    display: flex;
  }
  .sd-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .sd-sheet {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .sd-header,
  .sd-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
  }
  .sd-header {
    border-bottom: 1px solid var(--color-border);
  }
  .sd-footer {
    justify-content: flex-end;
    border-top: 1px solid var(--color-border);
  }
  .sd-header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .sd-bulk {
    display: flex;
    gap: var(--space-2);
  }
  .sd-dialog .button {
    margin: 0;
    min-height: 44px;
    white-space: nowrap;
  }
  .sd-body {
    --sd-cols: 7rem minmax(0, 1fr) minmax(0, 1fr) 12.5rem;
    flex: 1;
    min-height: 0;
    padding: 0 var(--space-4) var(--space-2);
    overflow-y: auto;
  }
  .sd-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Same columns as every row, so Now / Proposed line up (the phone shows inline tags instead). */
  .sd-colhead {
    position: sticky;
    top: 0;
    display: grid;
    grid-template-columns: var(--sd-cols);
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .sd-row {
    display: grid;
    grid-template-columns: var(--sd-cols);
    align-items: center;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
    overflow-wrap: anywhere;
  }
  .sd-label {
    font-weight: 600;
  }
  .sd-lock {
    display: inline-block;
    vertical-align: middle;
    margin-inline-start: var(--space-1);
    color: var(--color-text);
  }
  .sd-lock :global(.icon) {
    width: 1.1em;
    height: 1.1em;
    display: block;
  }
  .sd-tag {
    display: none;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .sd-pair {
    display: flex;
    gap: var(--space-1);
  }
  .sd-dialog .button[aria-pressed='true'] {
    background: var(--color-accent);
    color: var(--color-surface);
  }
  .sd-dialog .button[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .sd-wide {
    grid-column: 1 / -1;
  }
  .sd-bad {
    color: var(--color-urgent);
  }
  /* The roaster warning keeps its space while hidden (no shift), but it is one small line. */
  .sd-warn {
    margin-top: calc(-1 * var(--space-1));
    font-size: 0.8125rem;
    line-height: 1.3;
  }
  .sd-hide {
    visibility: hidden;
  }
  .sd-empty {
    visibility: hidden;
  }
  .sd-note {
    font-style: italic;
  }
  .sd-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (max-width: 640px) {
    .sd-dialog {
      width: 100dvw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    .sd-sheet {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
    .sd-colhead {
      display: none;
    }
    .sd-row {
      grid-template-columns: 1fr;
    }
    .sd-empty {
      display: none;
    }
    .sd-tag {
      display: inline;
    }
    .sd-header .button,
    .sd-pair .button {
      flex: 1;
    }
    .sd-pair {
      width: 100%;
    }
  }
</style>
