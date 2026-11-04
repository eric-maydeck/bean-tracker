<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import CoffeeName from '$lib/components/CoffeeName.svelte';
  import CoffeeForm from '$lib/components/CoffeeForm.svelte';
  import LinkPicker from '$lib/components/LinkPicker.svelte';
  import { linkPickerGroups, cap, type LinkableCoffee } from '$lib/linkPicker';
  import type { UnmatchedBean } from '$lib/server/beanconqueror';
  import type { CoffeeRow } from '$lib/types';
  import type { ComponentProps } from 'svelte';

  type FormProps = ComponentProps<typeof CoffeeForm>;
  let { unmatched, linkable, roastLevels, roasters, roasterImages, origins, processingMethods, restHistory, subscriptions, formError = null }: {
    unmatched: { beans: UnmatchedBean[]; total: number };
    linkable: LinkableCoffee[];
    roastLevels: FormProps['roastLevels'];
    roasters: FormProps['roasters'];
    roasterImages: FormProps['roasterImages'];
    origins: FormProps['origins'];
    processingMethods: FormProps['processingMethods'];
    restHistory: FormProps['restHistory'];
    subscriptions: FormProps['subscriptions'];
    formError?: string | null;
  } = $props();

  let createBean = $state<UnmatchedBean | null>(null);
  // Which row has its Link picker open. Inline action state, like the Create modal: never in the URL.
  let linkingId = $state<string | null>(null);
  let linkCoffeeId = $state<number | null>(null);

  function prefillFor(bean: UnmatchedBean): Partial<CoffeeRow> {
    return {
      roaster: bean.roaster ?? '',
      coffee_name: bean.name,
      origin: bean.origin,
      processing: bean.processing,
      amount_g: bean.weightG,
      cost: bean.cost,
      roast_date: bean.roastDate,
      decaf: bean.decaffeinated ? 1 : 0,
      // A new coffee is a blend only when BQ says so; a missing mix stays single origin.
      blend: bean.blend === 'Blend' ? 1 : 0
    };
  }

  async function closeCreate() {
    createBean = null;
    await invalidateAll();
  }
  const facts = (b: UnmatchedBean) => [b.roaster ?? 'Unknown roaster', b.origin, b.processing, b.roastDate].filter(Boolean).join(' · ');
</script>

{#if unmatched.total > 0}
  <h3 id="not-tracked">Not yet tracked ({unmatched.total})</h3>
  <p class="text-muted">Beans in Bean Conqueror with no coffee here yet. Create one, or link it to a coffee you already have.</p>
  {#if unmatched.beans.length < unmatched.total}<p class="text-muted">Showing top {unmatched.beans.length} of {unmatched.total}.</p>{/if}
  <ul class="triage">
    {#each unmatched.beans as bean (bean.id)}
      <li class="triage-row">
        <div class="triage-title">
          <strong><CoffeeName name={bean.name} /></strong>
          {#if bean.decaffeinated}<span class="badge badge-decaf">Decaf</span>{/if}
        </div>
        <div class="text-muted">{facts(bean)}</div>
        {#if bean.likelyMatch}
          <p class="text-muted">
            Possibly already tracked as <a href={`/coffees/${bean.likelyMatch.slug}`}><CoffeeName name={bean.likelyMatch.coffeeName} /></a>
            ({bean.likelyMatch.roastDate ? `Roasted ${bean.likelyMatch.roastDate}` : 'No roast date'} · {cap(bean.likelyMatch.status)})
          </p>
        {/if}
        {#if linkingId === bean.id}
          {@const groups = linkPickerGroups({ roaster: bean.roaster, likelyMatchId: bean.likelyMatch?.id ?? null }, linkable)}
          <form
            class="link-picker"
            method="POST"
            action="?/linkBeanConqueror"
            use:enhance={() => async ({ result, update }) => {
              await update();
              if (result.type === 'success') linkingId = null;
            }}
          >
            <input type="hidden" name="beanId" value={bean.id} />
            <LinkPicker {groups} label={`Coffee to link ${bean.name} to`} bind:value={linkCoffeeId} />
            <div class="action-buttons candidate-actions link-picker-actions">
              <button class="button" type="submit" disabled={linkCoffeeId == null}>Link</button>
              <button class="button button-secondary" type="button" onclick={() => (linkingId = null)}>Cancel</button>
            </div>
          </form>
        {:else}
          <div class="action-buttons candidate-actions">
            <button class="button button-secondary" type="button" onclick={() => (createBean = bean)}>Create</button>
            <button class="button button-secondary" type="button" onclick={() => { linkingId = bean.id; linkCoffeeId = null; }}>Link</button>
            <form method="POST" action="?/dismissBeanConqueror" use:enhance>
              <input type="hidden" name="id" value={bean.id} />
              <button class="button button-danger" type="submit">Dismiss</button>
            </form>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if createBean}
  <div class="modal-backdrop">
    <div class="modal">
      <h2>Create coffee from <CoffeeName name={createBean.name} /></h2>
      <CoffeeForm
        prefill={prefillFor(createBean)}
        {roastLevels}
        {roasters}
        {roasterImages}
        {origins}
        {processingMethods}
        {restHistory}
        {subscriptions}
        {formError}
        beanConquerorId={createBean.id}
        oncancel={() => (createBean = null)}
        onsuccess={closeCreate}
      />
    </div>
  </div>
{/if}

<style>
  .triage { list-style: none; padding: 0; margin: 0 0 var(--space-3); }
  .triage-row { padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border); }
  .triage-row:last-child { border-bottom: 0; }
  .triage-row > :global(*) { margin-block: 0 var(--space-2); }
  .triage-row > :global(.candidate-actions), .triage-row > :global(.link-picker) { margin-top: var(--space-4); }
  .triage-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-2); overflow-wrap: anywhere; }
  .triage-row > .text-muted { overflow-wrap: anywhere; }
</style>
