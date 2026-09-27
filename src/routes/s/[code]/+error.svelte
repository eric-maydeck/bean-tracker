<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>{page.status === 404 ? 'This link has expired' : 'Something went wrong'}</h1>
<p>Short links stop working after a year without use.</p>
<p><a href="/coffees">Go to Coffees</a></p>
