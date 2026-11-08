import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { setPriority } from 'node:os';
import { profileFor, shotsOn } from './scripts/uiProfile.ts';
import { PART, TWO_VIEWPORTS, VIEWPORTS } from './tests/ui/viewports';

// Run profile (UI_PROFILE=performance|balanced|background, default balanced): workers + priority.
// Workers and Firefox inherit the runner's priority. --workers=N on the CLI still wins.
const profile = profileFor(process.env.UI_PROFILE);
// UI_SHOTS=all|off (specs read it) and UI_VIEWPORTS (tests/ui/viewports.ts): bad values fail here.
shotsOn(process.env.UI_SHOTS);
if (profile.nice) setPriority(profile.nice);
if (profile.background) execFileSync('taskpolicy', ['-b', '-p', String(process.pid)]);

// Throwaway admin password "test" (same convention as the LAN test server).
const ADMIN_PASSWORD_HASH = execFileSync('node', ['scripts/hash-password.ts', 'test']).toString().trim();
const PORT = 5198;

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: '.ui-test/results',
  reporter: [['list']],
  // Vite's first-visit dependency optimizing can reload a page mid-test once.
  retries: 1,
  // Not the default half-the-cores (9 Firefoxes lag the laptop); see scripts/uiProfile.ts.
  workers: profile.workers,
  // E-core-only runs: SvelteKit goto's URL update can land ~8s after the click.
  expect: { timeout: profile.background ? 15_000 : 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`, browserName: 'firefox', headless: true,
    screenshot: { mode: 'only-on-failure', fullPage: true }
  },
  webServer: {
    // Fresh seed every run; never reuse a server (it could be on a real DB).
    // UI_BUILD=prod: a production build (adapter-node assumes https without ORIGIN, failing CSRF).
    command: `npx vite-node --config scripts/vite-node.config.mjs scripts/ui-seed.ts .ui-test/ui.db && ${
      process.env.UI_BUILD === 'prod'
        ? `npx vite build && PORT=${PORT} ORIGIN=http://localhost:${PORT} node build`
        : `npx vite dev --port ${PORT} --strictPort`
    }`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CONFIG_PATH: 'tests/ui/fixtures/config.yaml', DB_PATH: '.ui-test/ui.db', ADMIN_PASSWORD_HASH, SESSION_SECRET: 'ui-test-only-session-secret' }
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    ...VIEWPORTS.map(({ name, ...use }) => ({
      name,
      testMatch: /layout\.spec\.ts/,
      dependencies: ['setup'],
      // States never save, so tests within a viewport can spread across workers.
      fullyParallel: true,
      // Width-independent behavior states run at two viewports only (not generated elsewhere).
      ...(TWO_VIEWPORTS.includes(name) ? {} : { grepInvert: /@two\b/ }),
      use: { ...use, storageState: '.ui-test/admin.json' }
    })),
    // Adds coffees to the shared DB, so it waits for every layout check. (UI_PART > 1 runs layout states only.)
    ...(PART > 1 ? [] : [{
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
    }])
  ]
});
