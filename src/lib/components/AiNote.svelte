<script lang="ts">
  import { page } from '$app/state';
  import { currentParams } from '$lib/pageUrlState';
  import { writeUrlParams } from '$lib/urlState';
  import { aboutAiOpen } from '$lib/aboutAi';

  // Footer line + "How this site was built" dialog. `?about=ai` opens it; closing drops the param (replaceState).
  let { email }: { email: string } = $props();

  let dlg: HTMLDialogElement;
  let link: HTMLAnchorElement;

  // The link keeps the page's current params (a new tab lands on the same view with the dialog open).
  const aboutHref = (q: URLSearchParams) => {
    const p = new URLSearchParams(q);
    p.set('about', 'ai');
    return `?${p}`;
  };
  const href = $derived(aboutHref(page.url.searchParams));
  // `replaceState` leaves page.url stale, so refresh from `location` just before a click or focus.
  const syncHref = () => (link.href = aboutHref(currentParams(page.url)));

  function setParam(on: boolean) {
    const p = new URLSearchParams(currentParams(page.url));
    if (on) p.set('about', 'ai');
    else p.delete('about');
    writeUrlParams(p, false);
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
  // Follows real navigations (first load, Back/Forward onto or off ?about=ai). Our own replaceState doesn't re-run it.
  $effect(() => {
    // page.url re-runs this on each navigation; `location` is what it reads, because after a replaceState Back lands on an
    // entry whose page.url is the pre-replace one (no about).
    const want = aboutAiOpen(currentParams(page.url));
    if (want && !dlg.open) dlg.showModal();
    else if (!want && dlg.open) dlg.close();
  });
  // A backdrop click closes only when the press also began on the backdrop (not after a drag-select overshoot).
  let pressedBackdrop = false;
</script>

<div>
  <span>Built with help from Claude Code, an AI coding assistant<span class="d" aria-hidden="true">&nbsp;·</span></span>
<span class="fi lk"><a {href} bind:this={link} onclick={open} onpointerenter={syncHref} onfocus={syncHref}>How AI was used</a><span class="d keep" aria-hidden="true">&nbsp;·</span></span>
<span class="fi lk"><a href="mailto:{email}">Contact</a></span>
</div>

<dialog class="ai-dialog" aria-labelledby="ai-title" bind:this={dlg} onclose={closed} onpointerdown={(e) => (pressedBackdrop = e.target === dlg)} onclick={(e) => e.target === dlg && pressedBackdrop && dlg.close()}>
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
        <li>Drive the technical decisions, drawing on my experience as a Staff SRE, DevOps engineer, and software engineer: architecture, hosting, testing, and releases</li>
        <li>Bring nearly all of the coffee knowledge, from recipes, gear, and pour structure to extraction, rest, and water</li>
        <li>Shape every design: I review each spec and push back on layout, wording, and behavior until it's right</li>
        <li>Test every change in a live preview, on desktop and on my phone</li>
        <li>Set the engineering standards: tests at every screen size, shareable links for every view, signed commits, and staged releases</li>
        <li>Own the data: every coffee, rating, and note, plus the judgment calls on it</li>
        <li>Run the infrastructure the site lives on: hosting, domains, and backups</li>
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
  .ai-dialog {
    width: min(40rem, 100% - 2rem);
    max-height: 85dvh;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: inherit;
    font-size: 0.875rem;
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
    font-size: 1rem;
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
    font-size: 0.95rem;
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
