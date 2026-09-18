<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { urgencyColorStyle } from '$lib/urgencyColor';

  let { data } = $props();

  async function refresh() {
    await invalidateAll();
  }
</script>

<h1>On Deck</h1>

<div class="search-row">
  <button class="button button-secondary" type="button" onclick={refresh}>Refresh</button>
</div>

<section>
  <h2>Currently open</h2>
  {#if data.open.length === 0}
    <p class="text-muted">Nothing open right now.</p>
  {:else}
    <section class="grid">
      {#each data.open as coffee (coffee.id)}
        <a class="card" href={`/coffees/${coffee.slug}`}>
          {#if coffee.image_url}
            <img src={coffee.image_url} alt="" class="card-thumb" />
          {/if}
          <h2>{coffee.coffee_name}</h2>
          <p class="text-muted">{coffee.roaster}</p>
          <p class="text-muted">
            Urgency: <span style={urgencyColorStyle(coffee.urgency_rating)}
              >{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</span
            >
          </p>
          {#if coffee.processing}
            <p class="text-muted">{coffee.processing}</p>
          {/if}
          {#if coffee.roast_date}
            <p class="text-muted">
              Roasted {coffee.roast_date}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </p>
          {/if}
          {#if coffee.drink_before}
            <p class="text-muted">Drink before {coffee.drink_before}</p>
          {/if}
        </a>
      {/each}
    </section>
  {/if}
</section>

<section class="detail-section">
  <h2>Next up from backlog</h2>
  {#if data.nextUp.length === 0}
    <p class="text-muted">Backlog is empty.</p>
  {:else}
    <section class="grid">
      {#each data.nextUp as coffee (coffee.id)}
        <a class="card" href={`/coffees/${coffee.slug}`}>
          {#if coffee.image_url}
            <img src={coffee.image_url} alt="" class="card-thumb" />
          {/if}
          <h2>{coffee.coffee_name}</h2>
          <p class="text-muted">{coffee.roaster}</p>
          <p class="text-muted">
            Urgency: <span style={urgencyColorStyle(coffee.urgency_rating)}
              >{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</span
            >
          </p>
          {#if coffee.processing}
            <p class="text-muted">{coffee.processing}</p>
          {/if}
          {#if coffee.roast_date}
            <p class="text-muted">
              Roasted {coffee.roast_date}
              {coffee.days_since_roast != null ? ` (${coffee.days_since_roast}d ago)` : ''}
            </p>
          {/if}
        </a>
      {/each}
    </section>
  {/if}
</section>
