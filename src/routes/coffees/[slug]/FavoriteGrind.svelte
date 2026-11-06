<script lang="ts">
  import { formatDate } from '$lib/formatDate';
  import type { FavoriteGrind, OtherBag } from '$lib/server/favoriteGrind';
  import { RATING_MAX } from '$lib/rating';
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';
  import TextTip from '$lib/components/TextTip.svelte';

  // The Timing section's "Favorite grind": per grinder used on this bag, the setting of its highest-rated brew
  // (ties: the latest), with the rating and dripper; a grinder with brews and no ratings shows its count.
  let { items }: { items: FavoriteGrind[] } = $props();

  const SETTING_TIP = { title: 'Grind setting', lines: ['Grind setting of the best-rated brew on this grinder'] };
  const RATING_TIP = { title: 'Rating', lines: [`Best rating on this grinder, out of ${RATING_MAX} (Bean Conqueror's scale)`] };
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
    title: 'Another bag of the same coffee',
    rows: [['Grind setting', o.setting ?? '—'], ['Rating', String(o.rating)], ['Roasted', formatDate(o.roastDate ?? '—')], ['Dripper', o.dripper ?? '—'], ...(o.filter ? [['Filter', o.filter]] : []), ['Brewed', formatDate(o.date)]] as [string, string][]
  });
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.fg-other, .fg-tip') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && tip?.pinned && (tip = null)} />

{#snippet other(g: FavoriteGrind)}
  {#if g.other}
    {@const o = g.other}
    <button type="button" class="fg-other" onpointerenter={(e) => hover(e, o)} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()}
      onclick={(e) => click(e, o)}>Higher-rated bag</button>
  {/if}
{/snippet}

<div class="stat fave" data-testid="favorite-grind">
  <span class="stat-label">Favorite grind setting</span>
  <ul class="stat-value fave-list">
    {#each items as g (g.grinder)}
      <li>
        <h3 class="g">{g.grinder}</h3>
        <div class="data">
        {#if g.best}
          <span class="seg"><TextTip label={g.best.setting ?? '—'} tip={SETTING_TIP} />&nbsp;·</span>{' '}<span class="seg"><TextTip label={String(g.best.rating)} tip={RATING_TIP} />{#if g.best.dripper || g.other}&nbsp;·{/if}</span>{#if g.best.dripper}{' '}<span class="seg">{g.best.dripper}{#if g.best.filter || g.other}&nbsp;·{/if}</span>{#if g.best.filter}{' '}<span class="seg">{g.best.filter}{#if g.other}&nbsp;·{/if}</span>{/if}{/if}
        {:else}
          <span class="seg">{g.brews} {g.brews === 1 ? 'brew' : 'brews'}, no ratings{#if g.other}&nbsp;·{/if}</span>
        {/if}
        {#if g.other}{' '}<span class="seg">{@render other(g)}</span>{/if}
        </div>
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
    gap: 0.75rem;
  }
  /* Each grinder is a group: its name as a bold sub-header, then its data line (and the other-bag link) flush under it. */
  .fave-list li {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    font-weight: 400;
    overflow-wrap: anywhere;
  }
  /* A "·" ends the segment before it (never starts a line); a wrapped data line hangs 1rem in. */
  .data {
    padding-left: 1rem;
    text-indent: -1rem;
  }
  /* The grinder's name is a sub-heading at the data line's size. */
  .g {
    margin: 0;
    font-size: inherit;
    font-weight: 700;
    font-family: var(--font-sans);
    color: var(--color-label);
  }
  /* The other-bag link: the data line's last segment, one unbreakable unit. */
  .fg-other {
    display: inline-block;
    max-width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--color-accent);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .fg-other:hover,
  .fg-other:focus-visible {
    color: var(--color-text);
  }
  /* Phones: a 44px tap target; the extra height is pulled back with a negative margin so the rows keep their height. */
  @media (max-width: 640px) {
    /* The setting and rating tips (TextTip): natural size, so spacing matches desktop; the 44px target is a centered
       pseudo-element around the text. */
    .seg :global(.text-tip) {
      position: relative;
      padding: 0;
    }
    .seg :global(.text-tip)::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 44px;
      height: 44px;
      transform: translate(-50%, -50%);
    }
    .fg-other {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      margin-block: -10px;
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
    text-indent: 0;
  }
</style>
