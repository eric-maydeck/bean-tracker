import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // '*' turns off the built-in form-origin check; src/lib/server/csrf.ts re-implements
    // it in the hook with one exempt path (the Basic-auth visualizer upload).
    csrf: { trustedOrigins: ['*'] }
  }
};
