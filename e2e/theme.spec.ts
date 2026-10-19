import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

async function mockApi(page: Page, options: { savedTheme?: 'LIGHT' | 'DARK' | 'SYSTEM' } = {}) {
  await page.route('**/v1/auth/refresh', (route) =>
    options.savedTheme
      ? route.fulfill({ status: 200, json: session })
      : route.fulfill({
          status: 401,
          contentType: 'application/problem+json',
          json: {
            type: 'about:blank',
            title: 'Unauthorized',
            status: 401,
            code: 'INVALID_REFRESH',
          },
        }),
  );
  await page.route('**/v1/me/preferences', (route) =>
    route.fulfill({
      status: 200,
      json: {
        language: 'en',
        theme: options.savedTheme ?? 'SYSTEM',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        notifications: { in_app: true, email: true },
      },
    }),
  );
}

const root = (page: Page) => page.locator('html');

test.use({ colorScheme: 'light' });

test('follows the system theme until a choice is made', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await expect(root(page)).not.toHaveAttribute('data-theme', /.+/);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 244, 250)');
});

test('applies the dark theme by hand and remembers it after a reload', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();

  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
});

test('goes back to the system theme', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Dark' }).click();

  await page.getByRole('button', { name: 'System' }).click();

  await expect(root(page)).not.toHaveAttribute('data-theme', /.+/);
});

test('uses the theme saved in the profile of a person with a session', async ({ page }) => {
  await mockApi(page, { savedTheme: 'DARK' });

  await page.goto('/stores');

  await expect(page.getByRole('heading', { name: 'Your stores' })).toBeVisible();
  await expect(root(page)).toHaveAttribute('data-theme', 'dark');
});

test('keeps the language attribute on the error page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(root(page)).toHaveAttribute('lang', 'en');
});
