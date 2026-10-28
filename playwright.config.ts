import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    browserName: 'chromium',
    channel: 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev.mjs --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178/api/ledger',
    reuseExistingServer: false,
    timeout: 120000,
    env: { MONTHWISE_STATE_DIR: '.wrangler/e2e', MONTHWISE_API_PORT: '8790' },
  },
});
