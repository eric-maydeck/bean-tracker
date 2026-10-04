import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Throwaway admin password "test" (same convention as the LAN test server).
const ADMIN_PASSWORD_HASH = execFileSync('node', ['scripts/hash-password.ts', 'test']).toString().trim();
const PORT = 5198;
// The widths the user's phones and desktop actually hit; 480 is where a
// real grid-collapse bug once hid (HANDOFF gotcha).
const WIDTHS = [360, 390, 480, 768, 1280];

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
    ...WIDTHS.map((width) => ({
      name: `w${width}`,
      testMatch: /\.spec\.ts/,
      dependencies: ['setup'],
      use: { viewport: { width, height: 800 }, storageState: '.ui-test/admin.json' }
    }))
  ]
});
