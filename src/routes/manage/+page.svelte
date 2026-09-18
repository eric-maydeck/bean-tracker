<script lang="ts">
  import { enhance } from '$app/forms';
  let { data } = $props();
</script>

<h1>Manage</h1>

<div class="table-scroll">
  <table class="data-table">
    <thead>
      <tr>
        <th>Coffee</th>
        <th>Roaster</th>
        <th>Status</th>
        <th>Urgency</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.coffees as coffee (coffee.id)}
        <tr>
          <td><a href={`/manage/coffees/${coffee.id}/edit`}>{coffee.coffee_name}</a></td>
          <td>{coffee.roaster}</td>
          <td>
            {#if coffee.status === 'open'}
              <span class="badge badge-warm">Open</span>
            {:else}
              <span class="badge badge-neutral">Backlog</span>
            {/if}
            {#if coffee.frozen_start_date && !coffee.frozen_end_date}
              <span class="badge badge-neutral">Frozen</span>
            {/if}
          </td>
          <td>{coffee.urgency_rating === 'Done' ? 'Done' : Math.round(Number(coffee.urgency_rating))}</td>
          <td>
            <div class="action-buttons">
              {#if coffee.status === 'backlog'}
                {#if coffee.frozen_start_date && !coffee.frozen_end_date}
                  <form method="POST" action="?/thaw" use:enhance>
                    <input type="hidden" name="id" value={coffee.id} />
                    <button class="button button-secondary" type="submit">Thaw</button>
                  </form>
                {:else}
                  <form method="POST" action="?/freeze" use:enhance>
                    <input type="hidden" name="id" value={coffee.id} />
                    <button class="button button-secondary" type="submit">Freeze</button>
                  </form>
                {/if}
                <form method="POST" action="?/open" use:enhance>
                  <input type="hidden" name="id" value={coffee.id} />
                  <button class="button" type="submit">Open</button>
                </form>
              {/if}
              <form method="POST" action="?/archive" use:enhance>
                <input type="hidden" name="id" value={coffee.id} />
                <button class="button button-secondary" type="submit">Archive</button>
              </form>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
