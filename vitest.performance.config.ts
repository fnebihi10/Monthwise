import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['performance/**/*.perf.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    maxWorkers: 1,
  },
});
