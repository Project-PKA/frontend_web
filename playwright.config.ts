import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // The CI e2e job does not build first, so the server command builds the static site.
        command: 'npm run generate && npm run preview -- --port 4173 --strictPort',
        url: baseURL,
        // The API runs on the same origin in the tests, where Playwright mocks it.
        env: { NUXT_PUBLIC_API_BASE_URL: baseURL },
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
