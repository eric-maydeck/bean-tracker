import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Throwaway admin password "test" (same convention as the LAN test server).
const ADMIN_PASSWORD_HASH = execFileSync('node', ['scripts/hash-password.ts', 'test']).toString().trim();
const PORT = 5198;
// Every layout check runs at each of these: the widths the user's phones and
// desktop hit (480 is where a real grid-collapse bug once hid, HANDOFF
// gotcha), plus the user's own phone in both orientations, a standing
// requirement for all UI testing (test phone, ~412×915 CSS px at DPR 3.5).
export const VIEWPORTS = [
  ...[360, 390, 480, 768, 1280].map((width) => ({ name: `w${width}`, viewport: { width, height: 800 } })),
  { name: 'phone-portrait', viewport: { width: 412, height: 915 }, deviceScaleFactor: 3.5 },
  { name: 'phone-landscape', viewport: { width: 915, height: 412 }, deviceScaleFactor: 3.5 }
];

export default defineConfig({
  testDir: 'tests/ui',
  outputDir: '.ui-test/results',
  reporter: [['list']],
  // Vite's first-visit dependency optimizing can reload a page mid-test once.
  retries: 1,
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
    }
  ]
});
