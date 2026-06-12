import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    acceptDownloads: true,
    baseURL: 'http://127.0.0.1:4173',
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173'
  }
});
