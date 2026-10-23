<script lang="ts">
  // "Jump to" chips: one per section a tab renders, each a #hash link (no load; the page's scroll-padding clears the sticky bar).
  // Fewer than 3 sections: nothing to jump between. Styles: .board-jump in app.css.
  let { links, label = 'Jump to a section' }: { links: (readonly [string, string] | null | false | undefined | 0)[]; label?: string } = $props();
  const items = $derived(links.filter((l): l is readonly [string, string] => !!l));
</script>

{#if items.length >= 3}
  <nav class="board-jump" aria-label={label}>
    <span>Jump to</span>
    {#each items as [id, text] (id)}<a href="#{id}">{text}</a>{/each}
  </nav>
{/if}
