import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real stack of `shared/compose.yaml` (API, database, Mailpit, web),
 * with no mocked route. Start the stack and the seed first (see TESTING.md), then `npm run e2e:real`.
 */
export default defineConfig({
  testDir: 'e2e-real',
  // The tests share one database and consume seed data, so they run one after the other.
  fullyParallel: false,
  workers: 1,
  // The real stack is slower than the mocked one, and a dev server compiles each route on first use.
  timeout: 120_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
