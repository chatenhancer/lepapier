import { defineConfig, devices } from '@playwright/test';

const port = process.env.LEPAPIER_PROD_E2E_PORT || '4174';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  outputDir: 'test-results/production',
  projects: [
    {
      name: 'production-chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/production' }]] : 'list',
  testDir: './tests/e2e-production',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run test:e2e:prod:server',
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL
  },
  workers: 1
});
