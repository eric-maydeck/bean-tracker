<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<h1>Sign in</h1>

{#if form?.error}
  <p class="badge badge-urgent">{form.error}</p>
{/if}

<form method="POST" action="?/login" use:enhance>
  <div class="form-field">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required autofocus />
  </div>
  <div class="form-field form-field-checkbox">
    <label for="remember">
      <input id="remember" name="remember" type="checkbox" />
      Stay signed in
    </label>
  </div>
  <button class="button" type="submit">Sign in</button>
</form>
