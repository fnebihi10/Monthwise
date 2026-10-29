import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  use: { channel: undefined },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: undefined } },
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 13'], browserName: 'webkit', channel: undefined },
    },
  ],
});
