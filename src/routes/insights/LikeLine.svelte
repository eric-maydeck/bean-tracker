<script lang="ts">
  import { deltaInk, signed } from '$lib/components/deltaColor';
  import TipBody from '$lib/components/TipBody.svelte';
  let { like, placeTip }: { like: { gap: number; label: string }; placeTip: (e: ToggleEvent) => void } = $props();
  const uid = $props.id();
  const id = `full-like-${uid}`; // full-…: a full-text popover (checkLayout)
  let text = $derived(`${signed(like.gap)} vs ${like.label}`);
  // A tap on a cut line opens its full text (as Sweet spots / Findings cards do); Enter opens it too. Hover has the title.
  // The line sits over the row's stretched link, so a tap on a whole line goes on to that link.
  function unclamp(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (e instanceof KeyboardEvent ? e.key === 'Enter' : el.scrollWidth > el.clientWidth + 1) document.getElementById(id)?.togglePopover();
    else if (!(e instanceof KeyboardEvent)) el.parentElement?.querySelector('a')?.click();
  }
</script>

<!-- No button role: the row (48px) is the tap target; a whole line passes the tap on to the row's link. Focusable for Enter. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<small class="like-line" title={text} data-tip={id} tabindex="0" onclick={unclamp} onkeydown={unclamp}
  ><span class={deltaInk(like.gap)}>{signed(like.gap)}</span> vs {like.label}</small
><span class="mode-tip" {id} popover onbeforetoggle={placeTip}><TipBody tip={{ title: text }} /></span>

<style>
  .like-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    position: relative; /* over a row's stretched link */
    z-index: 1;
  }
  .like-line:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
