import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { VIEWPORTS } from './tests/ui/viewports';

// Throwaway admin password "test" (same convention as the LAN test server).
const ADMIN_PASSWORD_HASH = execFileSync('node', ['scripts/hash-password.ts', 'test']).toString().trim();
const PORT = 5198;

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: '.ui-test/results',
  reporter: [['list']],
  // Vite's first-visit dependency optimizing can reload a page mid-test once.
  retries: 1,
  // Default is half the cores (9 Firefoxes on an 18-core MacBook): ~6 cores busy for 2.5 min,
  // enough to lag typing and heat the laptop. 25% (4 here): ~2.7 cores, ~4 min.
  // Override per run with --workers=N.
  workers: '25%',
  use: { baseURL: `http://localhost:${PORT}`, browserName: 'firefox', headless: true },
  webServer: {
    // Fresh seed every run; never reuse a server (it could be on a real DB).
    command: `node scripts/ui-seed.ts .ui-test/ui.db && npx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DB_PATH: '.ui-test/ui.db', ADMIN_PASSWORD_HASH, SESSION_SECRET: 'ui-test-only-session-secret' }
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    ...VIEWPORTS.map(({ name, ...use }) => ({
      name,
      testMatch: /layout\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...use, storageState: '.ui-test/admin.json' }
    })),
    // Adds coffees to the shared DB, so it waits for every layout check.
    {
      name: 'perf',
      testMatch: /perf\.spec\.ts/,
      dependencies: VIEWPORTS.map((v) => v.name),
      use: { viewport: { width: 360, height: 800 }, storageState: '.ui-test/admin.json' }
    },
    // Saves through the UI (tests/ui/save.spec.ts), so it runs after everything else.
    {
      name: 'save',
      testMatch: /save\.spec\.ts/,
      dependencies: ['perf'],
      use: { viewport: { width: 480, height: 909 }, deviceScaleFactor: 3, hasTouch: true, storageState: '.ui-test/admin.json' }
    }
  ]
});
