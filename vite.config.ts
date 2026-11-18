import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter(),
      // '*' turns off the built-in form-origin check; src/lib/server/csrf.ts re-implements
      // it in the hook with one exempt path (the Basic-auth visualizer upload).
      csrf: { trustedOrigins: ['*'] }
    })
  ],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
    // Default is cores - 1 threads; half is as fast for this suite and leaves the machine usable.
    maxWorkers: '50%'
  }
});
