// Empty config for vite-node scripts: it keeps vite-node from loading vite.config.ts (the SvelteKit
// plugin makes it fail to load the script file). Imports resolve through package.json "imports" (#lib/*).
export default {};
