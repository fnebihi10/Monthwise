import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './pwa-e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5179', browserName: 'chromium', channel: 'msedge' },
  webServer: {
    command: 'node scripts/pwa-preview.mjs',
    url: 'http://127.0.0.1:5179/api/ledger',
    timeout: 120000,
  },
});
