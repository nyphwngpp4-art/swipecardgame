import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5195', viewport: { width: 1440, height: 1000 },
    ...(process.env.SWIPE_SYSTEM_CHROME ? { channel: 'chrome' } : {}),
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5195', url: 'http://127.0.0.1:5195', reuseExistingServer: !process.env.CI },
});
