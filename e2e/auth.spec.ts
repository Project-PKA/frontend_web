import { expect, test, type Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function mockAuth(
  page: Page,
  routes: { refresh?: Parameters<Page['route']>[1]; verify?: Parameters<Page['route']>[1] } = {},
) {
  await page.route(
    '**/v1/auth/refresh',
    routes.refresh ?? ((route) => route.fulfill(problem(401, 'INVALID_REFRESH'))),
  );
  await page.route('**/v1/auth/otp/request', (route) =>
    route.fulfill({ status: 202, json: { status: 'accepted' } }),
  );
  await page.route(
    '**/v1/auth/otp/verify',
    routes.verify ?? ((route) => route.fulfill({ status: 200, json: session })),
  );
}

async function requestCode(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('igor@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeFocused();
}

test('signs in with the e-mail code', async ({ page }) => {
  await mockAuth(page);
  await requestCode(page);

  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/stores$/);
});

test('shows a translated message for a wrong code and not the API detail', async ({ page }) => {
  await mockAuth(page, { verify: (route) => route.fulfill(problem(401, 'INVALID_CODE')) });
  await requestCode(page);

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('The code is wrong or has expired.');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
});

test('explains when there were too many attempts', async ({ page }) => {
  await mockAuth(page);
  await page.route('**/v1/auth/otp/request', (route) =>
    route.fulfill(problem(429, 'RATE_LIMITED')),
  );
  await page.goto('/login');

  await page.getByLabel('E-mail').fill('igor@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Too many attempts. Wait a moment and try again.',
  );
});

test('validates the e-mail before calling the API', async ({ page }) => {
  let requested = false;
  await mockAuth(page);
  await page.route('**/v1/auth/otp/request', (route) => {
    requested = true;
    return route.fulfill({ status: 202, json: { status: 'accepted' } });
  });
  await page.goto('/login');

  await page.getByLabel('E-mail').fill('not-an-email');
  await page.getByRole('button', { name: 'Send code' }).click();

  await expect(page.getByText('Enter a valid e-mail address.')).toBeVisible();
  expect(requested).toBe(false);
});

test('validates the 6 digits of the code', async ({ page }) => {
  await mockAuth(page);
  await requestCode(page);

  await page.getByLabel('6-digit code').fill('12');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Enter the 6 digits of the code.')).toBeVisible();
});

test('skips the login when the refresh cookie still works', async ({ page }) => {
  await mockAuth(page, { refresh: (route) => route.fulfill({ status: 200, json: session }) });

  await page.goto('/login');

  await expect(page).toHaveURL(/\/stores$/);
});
