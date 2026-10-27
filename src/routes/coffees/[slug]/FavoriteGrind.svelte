<script lang="ts">
  import type { FavoriteGrind, OtherBag } from '$lib/server/favoriteGrind';
  import { page } from '$app/state'; // PREVIEW-TEMP
  import FloatTip from '$lib/components/FloatTip.svelte';
  import TipBody from '$lib/components/TipBody.svelte';

  // The Timing section's "Favorite grind": per grinder used on this bag, the setting of its highest-rated brew
  // (ties: the latest), with the rating and dripper; a grinder with brews and no ratings shows its count.
  let { items }: { items: FavoriteGrind[] } = $props();

  const pv = $derived(page.url.searchParams.get('pv') === 'd' ? 'd' : 'c'); // PREVIEW-TEMP: c = last inline segment, d = own line

  // Bean Conqueror's rating scale (as insights/Recent.svelte: its settings aren't in the import, so it is fixed at 10).
  const RATING_MAX = 10;
  const rate = (n: number) => `${n}/${RATING_MAX}`;
  // A method's name reads "CT62 - Cafec Abaca" (dripper - filter); shown with a dot, as the line's other separators.
  const dot = (s: string) => s.replaceAll(' - ', ' · ');

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
    rows: [['Grind setting', o.setting ?? '—'], ['Rating', rate(o.rating)], ['Roasted', o.roastDate ?? '—'], ['Dripper', o.dripper ? dot(o.dripper) : '—'], ['Brewed', o.date]] as [string, string][]
  });
</script>

<svelte:document onclick={(e) => tip?.pinned && !(e.target as Element).closest('.fg-other, .fg-tip') && (tip = null)} onkeydown={(e) => e.key === 'Escape' && tip?.pinned && (tip = null)} />

{#snippet other(g: FavoriteGrind)}
  {#if g.other}
    {@const o = g.other}
    <button type="button" class="fg-other" onpointerenter={(e) => hover(e, o)} onpointerleave={(e) => e.pointerType === 'mouse' && !tip?.pinned && later()}
      onclick={(e) => click(e, o)}>Another bag scored higher ({o.setting ?? '—'} · {rate(o.rating)})</button>
  {/if}
{/snippet}

<div class="stat fave" data-testid="favorite-grind">
  <span class="stat-label">Favorite grind setting</span>
  <ul class="stat-value fave-list">
    {#each items as g (g.grinder)}
      <li>
        <strong class="g">{g.grinder}</strong>
        {#if g.best}
          <span class="seg">· {g.best.setting ?? '—'}</span> <span class="seg">· {rate(g.best.rating)}</span>{#if g.best.dripper}{' '}<span class="seg">· {dot(g.best.dripper)}</span>{/if}
        {:else}
          <span class="seg">· {g.brews} {g.brews === 1 ? 'brew' : 'brews'}, no ratings</span>
        {/if}
        {#if g.other}{#if pv === 'c'}{' '}<span class="seg nb">· {@render other(g)}</span>{:else}<div class="own">{@render other(g)}</div>{/if}{/if}
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
  /* PREVIEW-TEMP: c = the link is the row's last inline segment, whole (never broken mid-phrase); d = on its own line. */
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
  .nb {
    white-space: nowrap;
  }
  .own {
    display: flex;
  }
  .fg-other:hover,
  .fg-other:focus-visible {
    color: var(--color-text);
  }
  /* Phones: a 44px tap target; the extra height is pulled back with a negative margin so the rows keep their height. */
  @media (max-width: 640px) {
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
  }
</style>
