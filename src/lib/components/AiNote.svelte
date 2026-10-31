<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import { aboutAiOpen } from '$lib/aboutAi';

  // Footer line + "How this site was built" dialog. `?about=ai` opens it; closing drops the param (replaceState).
  let { email }: { email: string } = $props();

  let dlg: HTMLDialogElement;
  let link: HTMLAnchorElement;

  function setParam(on: boolean) {
    const p = new URLSearchParams(currentParams(page.url));
    if (on) p.set('about', 'ai');
    else p.delete('about');
    writeUrlParams(p);
  }
  function open(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return; // new tab/window: follow the href
    e.preventDefault();
    if (!dlg.open) dlg.showModal();
    setParam(true);
  }
  // Esc, X, Close and backdrop all end up here.
  function closed() {
    setParam(false);
    link.focus();
  }
  onMount(() => {
    if (aboutAiOpen(currentParams(page.url))) dlg.showModal();
  });
</script>

<p class="ai-note">
  Built with help from Claude Code, an AI coding assistant.
  <span class="ai-links"><a href="?about=ai" bind:this={link} onclick={open}>How AI was used</a> · <a href="mailto:{email}">Contact</a></span>
</p>

<dialog class="ai-dialog" aria-labelledby="ai-title" bind:this={dlg} onclose={closed} onclick={(e) => e.target === dlg && dlg.close()}>
  <div class="ai-sheet">
    <header class="ai-header">
      <h2 id="ai-title">How this site was built</h2>
      <button type="button" class="ai-x" aria-label="Close" onclick={() => dlg.close()}>✕</button>
    </header>
    <div class="ai-body">
      <p>I built Bean Tracker with Claude Code, Anthropic's AI coding assistant. Here's who does what.</p>
      <h3>What I do</h3>
      <ul>
        <li>Set the direction: which features get built, and in what order</li>
        <li>Bring nearly all of the coffee knowledge, from recipes, gear, and pour structure to extraction, rest, and water</li>
        <li>Shape every design: I review each spec and push back on layout, wording, and behavior until it's right</li>
        <li>Test every change in a live preview, on desktop and on my phone</li>
        <li>Set the engineering standards: tests at every screen size, shareable links for every view, signed commits, and staged releases</li>
        <li>Own the data: every coffee, rating, and note, plus the judgment calls on it</li>
        <li>Run the server the site lives on, the domains, and the backups</li>
        <li>Act as project manager and technical lead, and decide what gets published, including this note</li>
      </ul>
      <h3>What Claude Code does</h3>
      <ul>
        <li>Writes nearly all of the code and automated tests, following my direction</li>
        <li>Drafts the designs, specs, plans, and docs for me to review</li>
        <li>Researches options and explains the tradeoffs so I can decide</li>
        <li>Analyzes my brewing data to suggest values, which I confirm or change</li>
        <li>Releases and deploys changes once I give the go-ahead</li>
        <li>Often runs several AI agents at once: one builds while another reviews</li>
      </ul>
      <p>Nothing ships without my sign-off. I review every change in a live preview, and automated tests plus a separate AI code review check the code itself.</p>
      <h3>Questions or concerns?</h3>
      <p>If you have a question, spot a mistake, or want something removed (for instance, a photo of your coffee's label), email me at <a href="mailto:{email}">{email}</a>.</p>
    </div>
    <footer class="ai-footer">
      <button type="button" class="button button-secondary" onclick={() => dlg.close()}>Close</button>
    </footer>
  </div>
</dialog>

<style>
  .ai-note {
    margin: var(--space-2) 0 0;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .ai-links {
    white-space: nowrap;
  }
  .ai-dialog {
    width: min(40rem, 100% - 2rem);
    max-height: 85dvh;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    font-size: 1rem;
  }
  .ai-dialog[open] {
    display: flex;
  }
  @media (max-height: 500px) {
    .ai-dialog {
      max-height: calc(100dvh - 1rem);
    }
  }
  .ai-dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .ai-sheet {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }
  .ai-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .ai-x {
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
  .ai-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-4);
    overflow-wrap: break-word;
  }
  .ai-body h3 {
    margin: var(--space-4) 0 var(--space-1);
    font-size: 1rem;
  }
  .ai-body p {
    margin: var(--space-2) 0;
  }
  .ai-body ul {
    margin: 0;
    padding-left: 1.2rem;
  }
  .ai-footer {
    display: flex;
    justify-content: center;
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .ai-footer .button {
    margin: 0;
  }
  @media (max-width: 640px) {
    .ai-dialog {
      width: 100dvw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    .ai-sheet {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
  }
</style>
