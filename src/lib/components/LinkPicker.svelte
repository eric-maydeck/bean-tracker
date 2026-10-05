<!-- The Stats "Link" picker: a button that opens an in-flow panel with a search
  box and a grouped listbox. Posts the chosen id as a hidden coffeeId. Opening
  focuses the list, never the search box (a phone keyboard would pop up). -->
<script lang="ts">
  import { tick } from 'svelte';
  import { filterLinkGroups, type LinkPickerGroup } from '$lib/linkPicker';

  let {
    groups,
    label,
    value = $bindable()
  }: { groups: LinkPickerGroup[]; label: string; value?: number | null } = $props();

  // Top match preselected; without one nothing is, and the form's Link stays disabled.
  // svelte-ignore state_referenced_locally (once, on mount, is the point)
  if (value == null && groups[0]?.top) value = groups[0].options[0].id;

  const uid = $props.id();
  const optId = (id: number) => `${uid}-o${id}`;
  const all = $derived(groups.flatMap((g) => g.options));
  const selected = $derived(all.find((o) => o.id === value));

  let open = $state(false);
  let query = $state('');
  let activeId = $state<number | undefined>();
  const filtered = $derived(filterLinkGroups(groups, query));
  const flat = $derived(filtered.flatMap((g) => g.options));

  let root: HTMLDivElement;
  let button: HTMLButtonElement;
  let list = $state<HTMLDivElement>();

  async function show() {
    open = true;
    query = '';
    activeId = selected?.id ?? flat[0]?.id;
    await tick();
    list?.focus({ preventScroll: true });
    const el = activeId == null ? null : document.getElementById(optId(activeId));
    if (el && list) list.scrollTop = Math.max(0, el.offsetTop - list.clientHeight / 2);
  }

  function close(refocus: boolean) {
    open = false;
    if (refocus) button.focus();
  }

  function choose(id: number | undefined) {
    if (id == null) return;
    value = id;
    close(true);
  }

  function move(id: number | undefined) {
    if (id == null) return;
    activeId = id;
    document.getElementById(optId(id))?.scrollIntoView({ block: 'nearest' });
  }

  function onListKey(e: KeyboardEvent) {
    const i = flat.findIndex((o) => o.id === activeId);
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(flat[Math.min(i + 1, flat.length - 1)]?.id),
      ArrowUp: () => move(flat[Math.max(i - 1, 0)]?.id),
      Home: () => move(flat[0]?.id),
      End: () => move(flat[flat.length - 1]?.id),
      Enter: () => choose(activeId),
      ' ': () => choose(activeId),
      Escape: () => close(true)
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    keys[e.key]();
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault(); // Enter would submit the form
      list?.focus({ preventScroll: true });
    }
  }

  function onSearchInput() {
    if (!flat.some((o) => o.id === activeId)) activeId = flat[0]?.id;
  }

  // One delegated handler for every option.
  function onListClick(e: MouseEvent) {
    const el = (e.target as Element).closest<HTMLElement>('[role="option"]');
    if (el) choose(Number(el.dataset.id));
  }
</script>

<svelte:window
  onpointerdown={(e) => {
    if (open && !root.contains(e.target as Node)) close(false);
  }}
/>

<div
  class="lp"
  bind:this={root}
  onfocusout={(e) => {
    // Tabbing out closes; a null relatedTarget (e.g. Safari button clicks) doesn't.
    if (open && e.relatedTarget && !root.contains(e.relatedTarget as Node)) close(false);
  }}
>
  <input type="hidden" name="coffeeId" value={value ?? ''} />
  <button
    bind:this={button}
    class="lp-btn"
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={`${label}: ${selected ? selected.label : 'none chosen'}`}
    onclick={() => (open ? close(true) : show())}
  >
    {#if selected}
      <span class="lp-text">
        {#if selected.roaster}<span class="lp-r">{selected.roaster}</span>{/if}
        <span class="lp-n">{selected.name}</span>
        <span class="lp-m">{selected.meta}</span>
      </span>
    {:else}
      <span class="lp-text">Choose a coffee…</span>
    {/if}
    <span aria-hidden="true">▾</span>
  </button>
  {#if open}
    <div class="lp-panel">
      <input
        class="lp-search"
        type="search"
        placeholder="Search coffees…"
        aria-label="Search coffees"
        aria-controls={`${uid}-list`}
        autocomplete="off"
        bind:value={query}
        oninput={onSearchInput}
        onkeydown={onSearchKey}
      />
      <!-- svelte-ignore a11y_click_events_have_key_events (onListKey handles keys) -->
      <div
        bind:this={list}
        class="lp-list"
        id={`${uid}-list`}
        role="listbox"
        tabindex="-1"
        aria-label={label}
        aria-activedescendant={activeId == null ? undefined : optId(activeId)}
        onkeydown={onListKey}
        onclick={onListClick}
      >
        {#each filtered as g (g.label)}
          {@const gid = `${uid}-g${g.label.replace(/\W/g, '')}`}
          <div role="group" aria-labelledby={gid}>
            <div class="lp-gh" id={gid}>{g.label}</div>
            {#each g.options as o (o.id)}
              <div
                class="lp-opt"
                class:active={o.id === activeId}
                id={optId(o.id)}
                role="option"
                aria-selected={o.id === value}
                data-id={o.id}
              >
                {#if o.roaster}<span class="lp-r">{o.roaster}</span>{/if}
                <span class="lp-n">{o.name}</span>
                <span class="lp-m">{o.meta}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="lp-empty">No matches</p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .lp {
    min-width: 0;
  }
  .lp-btn {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 16px;
    text-align: left;
    cursor: pointer;
  }
  .lp-text {
    display: grid;
    min-width: 0;
  }
  /* The meta line may wrap: for twins its end ("bag N") is what tells them apart. */
  .lp-btn .lp-r,
  .lp-btn .lp-n {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lp-r,
  .lp-m {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  .lp-n {
    font-weight: 600;
  }
  .lp-panel {
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    margin-top: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    overflow: hidden;
  }
  .lp-search {
    flex: none;
    margin: 8px;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: 16px; /* no iOS/Android focus zoom */
  }
  .lp-list {
    position: relative; /* offsetParent for the open-time scroll */
    overflow-y: auto;
    overscroll-behavior: contain;
    contain: content;
    border-top: 1px solid var(--color-border);
  }
  .lp-list:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .lp-gh {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 6px 12px;
    background: var(--color-bg);
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .lp-opt {
    display: grid;
    min-height: 44px;
    padding: 8px 12px 8px 9px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    scroll-margin-top: 28px; /* clear the sticky group header */
  }
  .lp-opt[aria-selected='true'] {
    border-left-color: var(--color-accent);
  }
  .lp-opt.active {
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
  }
  @media (hover: hover) {
    .lp-opt:hover {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
    }
  }
  .lp-empty {
    margin: 0;
    padding: 12px;
    color: var(--color-text-muted);
  }
</style>
