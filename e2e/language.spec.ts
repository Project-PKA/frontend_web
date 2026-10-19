import { expect, test, type Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const preferences = (language: 'en' | 'pt-BR') => ({
  language,
  theme: 'SYSTEM',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  notifications: { in_app: true, email: true },
});

async function mockApi(page: Page, options: { savedLanguage?: 'en' | 'pt-BR' } = {}) {
  await page.route('**/v1/auth/refresh', (route) =>
    options.savedLanguage
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
    route.fulfill({ status: 200, json: preferences(options.savedLanguage ?? 'en') }),
  );
}

test.describe('browser in Brazilian Portuguese', () => {
  test.use({ locale: 'pt-BR' });

  test('opens the app pages in Portuguese', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });
});

test.describe('browser in another language', () => {
  test.use({ locale: 'fr-FR' });

  test('opens the app pages in English', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('browser in English', () => {
  test.use({ locale: 'en-US' });

  test('switches by hand and remembers the choice after a reload', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');

    await page.getByLabel('Language').selectOption('pt-BR');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByLabel('Idioma')).toHaveValue('pt-BR');
  });

  test('uses the language saved in the profile of a person with a session', async ({ page }) => {
    await mockApi(page, { savedLanguage: 'pt-BR' });

    await page.goto('/stores');

    await expect(page.getByRole('heading', { name: 'Suas lojas' })).toBeVisible();
  });

  test('keeps the public pages in the language of their address', async ({ page }) => {
    await page.goto('/pt-BR/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
