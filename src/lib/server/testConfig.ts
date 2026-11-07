import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { resetSiteConfig } from './siteConfig';

// Test helper: point CONFIG_PATH at a temp config.yaml with this text ('' = empty config). Pair with
// `unstubConfig()` in afterEach (vi.unstubAllEnvs restores CONFIG_PATH).
export function stubConfig(text = '') {
  const p = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'config.yaml');
  writeFileSync(p, text);
  vi.stubEnv('CONFIG_PATH', p);
  resetSiteConfig();
}
export function unstubConfig() {
  vi.unstubAllEnvs();
  resetSiteConfig();
}
