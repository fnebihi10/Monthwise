import { defineConfig, devices } from '@playwright/test';
import base from './playwright.pwa.config';
export default defineConfig(base, {
  use: { channel: undefined },
  projects: [
    { name: 'chromium-pwa', use: { ...devices['Desktop Chrome'], channel: undefined } },
    {
      name: 'webkit-iphone-pwa',
      use: { ...devices['iPhone 13'], browserName: 'webkit', channel: undefined },
    },
  ],
});
