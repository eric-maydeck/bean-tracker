// Minimal config for vite-node scripts: just the $lib alias (the SvelteKit plugin in
// vite.config.ts makes vite-node fail to load the script file).
export default { resolve: { alias: { $lib: new URL('../src/lib', import.meta.url).pathname } } };
