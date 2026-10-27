<script lang="ts">
  import type { FavoriteGrind, OtherBag } from '$lib/server/favoriteGrind';
  import { page } from '$app/state'; // PREVIEW-TEMP
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';

  // The Timing section's "Favorite grind": per grinder used on this bag, the setting of its highest-rated brew
  // (ties: the latest), with the rating and dripper; a grinder with brews and no ratings shows its count.
  let { items }: { items: FavoriteGrind[] } = $props();

  const pv = $derived(page.url.searchParams.get('pv') === 'b' ? 'b' : 'a'); // PREVIEW-TEMP: a = second line, b = chip

  // The other bag's tip is sticky (ui-rules 54, the Spend value map's pattern): hover opens it, the mouse can cross
  // onto it, a click or tap (Enter/Space) pins it until a click outside, Escape or its "See coffee" link.
  let tip = $state<{ o: OtherBag; el: Element; pinned: boolean; reveal?: boolean } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const keep = () => clearTimeout(timer);
  const later = () => (keep(), (timer = setTimeout(() => !tip?.pinned && (tip = null), 100)));
  const hover = (e: PointerEvent, o: OtherBag) => {
    if (e.pointerType !== 'mouse' || tip?.pinned) return;
    keep();
    tip = { o, el: e.currentTarget as Element, pinned: false };
  };
  const click = (e: MouseEvent, o: OtherBag) => {
    keep();
    tip = tip?.pinned && tip.o === o ? null : { o, el: e.currentTarget as Element, pinned: true, reveal: tip?.o !== o };
  };
  const tipOf = (o: OtherBag) => ({
    title: 'Same coffee, another bag',
    rows: [['Roasted', o.roastDate ?? '—'], ['Dripper', o.dripper ?? '—'], ['Brewed', o.date]] as [string, string][]
  });
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.fg-other, .fg-tip') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && tip?.pinned && (tip = null)} />

{#snippet other(g: FavoriteGrind, chip: boolean)}
  {#if g.other}
    {@const o = g.other}
    <button type="button" class="fg-other" class:chip aria-label="Other bag: setting {o.setting ?? 'none'}, rating {o.rating}" onpointerenter={(e) => hover(e, o)}
      onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()} onclick={(e) => click(e, o)}>{#if chip}<span class="pill">↑ {o.rating}</span>{:else}Other bag: {o.setting ?? '—'} · {o.rating}{/if}</button>
  {/if}
{/snippet}

<div class="stat fave" data-testid="favorite-grind">
  <span class="stat-label">Favorite grind</span>
  <ul class="stat-value fave-list">
    {#each items as g (g.grinder)}
      <li>
        <strong class="g">{g.grinder}</strong>
        {#if g.best}
          <span class="seg">· {g.best.setting ?? '—'}</span> <span class="seg">· {g.best.rating}{#if pv === 'b'}{' '}{@render other(g, true)}{/if}</span>{#if g.best.dripper}{' '}<span class="seg">({g.best.dripper})</span>{/if}
        {:else}
          <span class="seg">· {g.brews} {g.brews === 1 ? 'brew' : 'brews'}, no ratings</span>
        {/if}
        {#if pv === 'a'}{@render other(g, false)}{/if}
      </li>
    {/each}
  </ul>
</div>

{#if tip}
  <FloatTip anchor={tip.el} onclose={() => (tip = null)} reveal={!!tip.reveal}>
    <!-- svelte-ignore a11y_no_static_element_interactions (a mouse-only bridge from the anchor onto the tip; the link is a real link) -->
    <div class="fg-tip" onpointerenter={keep} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()}>
      <TipBody tip={tipOf(tip.o)} /><a class="tip-link" href="/coffees/{tip.o.slug}" onclick={() => (tip = null)}>See coffee</a>
    </div>
  </FloatTip>
{/if}

<style>
  .fave-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .fave-list li {
    font-weight: 400;
    overflow-wrap: anywhere;
  }
  .g {
    font-weight: 600;
  }
  /* PREVIEW-TEMP: a = a muted line under the row, b = a chip after the rating. */
  .fg-other {
    display: block;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.85em;
    color: var(--color-text-muted);
    text-align: left;
    cursor: pointer;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
  .fg-other.chip {
    display: inline-block;
    text-decoration: none;
  }
  .pill {
    display: inline-block;
    padding: 0 0.4rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    font-size: 0.75em;
    color: var(--color-accent);
    white-space: nowrap;
  }
  .fg-other:hover,
  .fg-other:focus-visible {
    color: var(--color-text);
  }
  /* Phones: a 44px tap target, its extra height pulled back with a negative margin so the rows keep their spacing. */
  @media (max-width: 640px) {
    .fg-other {
      display: flex;
      align-items: center;
      min-height: 44px;
      margin-block: -0.65rem;
    }
    /* The chip's 44px area is the transparent button around the small pill. */
    .fg-other.chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      margin: -10px -6px;
      vertical-align: middle;
    }
  }
  /* The tip is pointer-events: none (a hover tip); this fills it so the mouse can rest on it and click the link. */
  .fg-tip {
    margin: -0.5rem -0.75rem;
    padding: 0.5rem 0.75rem;
    pointer-events: auto;
    cursor: default;
  }
  .tip-link {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-accent);
  }
  .seg {
    display: inline-block;
    max-width: 100%;
  }
</style>
