import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';
import { SEEDED_E2E_ENV, warnAboutMissingE2EEnv } from './tests/e2e/support/env';

loadEnvConfig(process.cwd());
warnAboutMissingE2EEnv(SEEDED_E2E_ENV);

const defaultPort = process.env.PLAYWRIGHT_PORT || '3100';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${defaultPort}`;
const useExternalBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: useExternalBaseUrl
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${defaultPort}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
