<script lang="ts">
  import { urgencyColorStyle } from '$lib/urgencyColor';

  let { data } = $props();
</script>

<h1>On Deck</h1>

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
        </a>
      {/each}
    </section>
  {/if}
</section>
