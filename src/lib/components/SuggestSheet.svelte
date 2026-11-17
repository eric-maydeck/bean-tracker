<script lang="ts">
  import type { Snippet } from 'svelte';

  // The results dialog shared by the Suggest-style pickers (ImageSuggest, BeanBaseSearch): a centered
  // modal on wide screens, a full-screen sheet on phones. The parent owns the content and calls
  // show()/close(); onclose fires for every close (✕, Esc, backdrop, a pick, None of these).
  let { title, matching, onclose, children, footer, showFooter = true }: {
    title: string;
    matching: string[];
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
    showFooter?: boolean;
  } = $props();

  let dialog: HTMLDialogElement;
  export const show = () => dialog.showModal();
  export const close = () => dialog.close();
</script>

<dialog
  class="suggest-dialog"
  aria-labelledby="suggest-title"
  bind:this={dialog}
  {onclose}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <div class="suggest-sheet">
    <header class="suggest-header">
      <h2 id="suggest-title">{title}</h2>
      <button type="button" class="suggest-close" aria-label="Close" onclick={() => dialog.close()}>✕</button>
    </header>
    <div class="text-muted suggest-matching">
      {#each matching as text, i (i)}<p>{text}</p>{/each}
    </div>
    <div class="suggest-body">{@render children()}</div>
    {#if footer && showFooter}
      <footer class="suggest-footer">
        <div class="suggest-actions" data-button-row>{@render footer()}</div>
      </footer>
    {/if}
  </div>
</dialog>

<style>

  :global(.fill-note) {
    margin: var(--space-1) 0 0;
    font-size: 0.85rem;
  }
  :global(.inline-row) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: stretch;
  }
  :global(.inline-row input) {
    flex: 1;
    min-width: 10rem;
  }
  :global(.inline-row .button) {
    flex-shrink: 0;
    white-space: nowrap;
  }
  /* Image Suggest's results dialog: a centered box on wide screens, a
     full-screen sheet on phones. The sheet fills the dialog (no dialog
     padding), so a click on the dialog element itself is a backdrop click.
     Header and footer stay put; the body scrolls. */
  .suggest-dialog {
    width: min(52rem, 100% - 2rem);
    max-height: 85dvh;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
  }
  .suggest-dialog[open] {
    display: flex;
  }
  /* Phone landscape (333px tall): 85dvh leaves room for barely one row. */
  @media (max-height: 500px) {
    .suggest-dialog {
      max-height: calc(100dvh - 1rem);
    }
  }
  .suggest-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .suggest-sheet {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .suggest-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }
  .suggest-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .suggest-matching {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    font-size: 1rem;
    overflow-wrap: break-word;
  }
  .suggest-matching p {
    margin: 0;
  }
  .suggest-matching p:first-child {
    font-weight: 600;
  }
  .suggest-close {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .suggest-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4) var(--space-4);
  }
  @media (max-width: 640px) {
    .suggest-dialog {
      width: 100dvw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    .suggest-sheet {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
  }
  :global(.suggest-status) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  :global(.suggest-change) {
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  /* Candidate cards: one per row on phones, two in the wider dialog. */
  :global(.suggest-list) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start; /* a text-only card beside an image card keeps its own height (no empty box) */
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  @media (min-width: 641px) {
    :global(.suggest-list) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  /* The whole card is the pick button: a large image on top, so the bag
     label is legible (user, 2026-10-06), then the text. */
  :global(.suggest-pick) {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  /* A square, full card width: the shape the saved image gets as a
     thumbnail (user, 2026-10-06; taller cards are fine). */
  :global(.suggest-image) {
    position: relative;
    flex: none;
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  :global(.suggest-image img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--radius);
  }
  /* Phone landscape (333px tall): the body shows ~150px, so a full-width
     square can't fit; cap it so a whole image fits on screen. */
  @media (max-height: 500px) {
    :global(.suggest-image) {
      width: 9rem;
      align-self: center;
    }
  }
  /* Over the image's top-left corner: opaque sunflower with dark text, so it
     reads over any image in both themes (contrast checked in test:ui). */
  :global(.suggest-image .badge) {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
    background: var(--color-sunflower);
    color: var(--color-sunflower-text);
  }
  :global(.suggest-text) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
    min-width: 0;
    font-size: 0.85rem;
  }
  :global(.suggest-title),
  :global(.suggest-excerpt) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  :global(.suggest-title) {
    font-weight: 600;
  }
  :global(.suggest-excerpt) {
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
  .suggest-footer {
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .suggest-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .suggest-actions :global(.button) {
    margin: 0;
  }
  @media (max-width: 640px) {
    .suggest-actions :global(.button) {
      flex: 1 1 auto;
      text-align: center;
    }
  }
  @media (max-width: 480px) {
    :global(.suggest-change) {
      min-width: 44px;
      min-height: 44px;
    }
  }
</style>
