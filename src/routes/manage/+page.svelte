<script lang="ts">
  import { enhance } from '$app/forms';
  let { data } = $props();
  const topUrgency = $derived(data.coffees.slice(0, 10));
</script>

<h1>Dashboard</h1>

{#if data.suggestedNext}
  <section class="card">
    <h2>Suggested next</h2>
    <p><strong>{data.suggestedNext.coffee_name}</strong> — {data.suggestedNext.roaster}</p>
    <p class="text-muted">Urgency: {Math.round(Number(data.suggestedNext.urgency_rating))}</p>
  </section>
{:else}
  <p class="text-muted">No active coffees. Add one to get started.</p>
{/if}

<section>
  <h2>Top urgency</h2>
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th>Coffee</th>
          <th>Roaster</th>
          <th>Urgency</th>
          <th>Drink before</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each topUrgency as coffee (coffee.id)}
          <tr>
            <td><a href={`/manage/coffees/${coffee.id}/edit`}>{coffee.coffee_name}</a></td>
            <td>{coffee.roaster}</td>
            <td>{Math.round(Number(coffee.urgency_rating))}</td>
            <td>{coffee.drink_before ?? '—'}</td>
            <td>
              <form method="POST" action="?/markDrank" use:enhance>
                <input type="hidden" name="id" value={coffee.id} />
                <button class="button" type="submit">Mark as drank</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

