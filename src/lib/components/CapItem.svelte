<script lang="ts">
  import type { Snippet } from 'svelte';

  // One item of a tile caption's subtext ("Calibrated ratings · All brews · per person"; ui-rules 55). Items flow inline after the
  // title (none forces its own line), each moves to the next line whole, and the " · " before it hangs out of the flow: it is
  // hidden when the item starts a line, so no line starts or ends with a delimiter. `data-start` is set from the layout.
  let { children }: { children: Snippet } = $props();

  function startsLine(node: HTMLElement) {
    const run = () => {
      // Everything before this item in its parent (the title, the earlier items): does the item sit below its last line?
      const gap = node.previousElementSibling?.classList.contains('cap-gap') ? node.previousElementSibling : node;
      const before = document.createRange();
      before.setStart(node.parentElement!, 0);
      before.setEndBefore(gap);
      const rects = before.getClientRects();
      const above = rects.length ? rects[rects.length - 1] : null;
      node.toggleAttribute('data-start', !!above && node.getBoundingClientRect().top >= above.bottom - 2);
    };
    const ro = new ResizeObserver(run);
    for (const el of [node.parentElement, node.closest('.stat-item'), document.documentElement]) if (el) ro.observe(el);
    run();
    requestAnimationFrame(() => requestAnimationFrame(run)); // after container-query sizing and webfonts settle
    void document.fonts?.ready.then(run);
    return { destroy: () => ro.disconnect() };
  }
</script>

<span class="cap-gap">{' '}</span><span class="cap-item" use:startsLine>{@render children()}</span>
