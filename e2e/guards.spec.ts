import { expect, test, type Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

async function typeCode(page: Page, code: string) {
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type(code);
}

async function mockApi(page: Page, options: { loggedIn: boolean }) {
  await page.route('**/v1/auth/refresh', (route) =>
    options.loggedIn
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
  await page.route('**/v1/auth/otp/request', (route) =>
    route.fulfill({ status: 202, json: { status: 'accepted' } }),
  );
  await page.route('**/v1/auth/otp/verify', (route) =>
    route.fulfill({ status: 200, json: session }),
  );
}

async function signIn(page: Page) {
  await page.getByLabel('E-mail').fill('igor@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await typeCode(page, '123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('sends a logged out visitor to the login and back after signing in', async ({ page }) => {
  await mockApi(page, { loggedIn: false });

  await page.goto('/stores');
  await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)stores$/);

  await signIn(page);

  await expect(page).toHaveURL(/\/stores$/);
  await expect(page.getByRole('heading', { name: 'Your stores' })).toBeVisible();
});

test('opens a protected page for a person with a session', async ({ page }) => {
  await mockApi(page, { loggedIn: true });

  await page.goto('/stores');

  await expect(page.getByRole('heading', { name: 'Your stores' })).toBeVisible();
});

test('never redirects to another site after signing in', async ({ page }) => {
  await mockApi(page, { loggedIn: false });

  await page.goto('/login?redirect=https://evil.example.com/steal');
  await signIn(page);

  await expect(page).toHaveURL(/localhost:\d+\/stores$/);
});

test('shows the not found page for an address that does not exist', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
