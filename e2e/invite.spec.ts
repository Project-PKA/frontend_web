import { expect, test, type Page } from '@playwright/test';

const token = 'invite-token-for-tests-0123456789abcdef';

const staffInvite = {
  email: 'ana@example.com',
  store_name: 'Poké Card Hub',
  role: 'STAFF',
  permissions: {
    can_manage_inventory: true,
    can_manage_auctions: true,
    can_manage_customers: true,
    can_view_finance: false,
    can_delete: false,
  },
  expires_at: '2026-12-31T15:00:00Z',
};

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function mockApi(
  page: Page,
  options: {
    preview?: Parameters<Page['route']>[1];
    accept?: Parameters<Page['route']>[1];
    otp?: Parameters<Page['route']>[1];
  } = {},
) {
  await page.route('**/v1/auth/refresh', (route) => route.fulfill(problem(401, 'INVALID_REFRESH')));
  await page.route(
    '**/v1/auth/invitations/preview',
    options.preview ?? ((route) => route.fulfill({ status: 200, json: staffInvite })),
  );
  await page.route(
    '**/v1/auth/invitations/accept',
    options.accept ?? ((route) => route.fulfill({ status: 200, json: { status: 'accepted' } })),
  );
  await page.route(
    '**/v1/auth/otp/request',
    options.otp ?? ((route) => route.fulfill({ status: 202, json: { status: 'accepted' } })),
  );
}

test('shows who was invited, to which store, as what, and the permissions', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/invite#token=${token}`);

  await expect(page.getByRole('heading', { level: 1, name: 'You were invited' })).toBeVisible();
  await expect(
    page.getByText('ana@example.com was invited to join the store Poké Card Hub as Staff.'),
  ).toBeVisible();
  const granted = page.locator('.perm', { hasText: 'Manage inventory' });
  await expect(granted).toContainText('Yes');
  await expect(page.locator('.perm', { hasText: 'View the finance dashboard' })).toContainText(
    'No',
  );
  await expect(page.locator('.perm', { hasText: 'Delete records' })).toContainText('No');
  await expect(page.getByText(/This invitation is valid until/)).toBeVisible();
});

test('says an owner has full access instead of listing permissions', async ({ page }) => {
  await mockApi(page, {
    preview: (route) =>
      route.fulfill({ status: 200, json: { ...staffInvite, role: 'OWNER', permissions: {} } }),
  });
  await page.goto(`/invite#token=${token}`);

  await expect(page.getByText('As the store owner you have full access to it.')).toBeVisible();
  await expect(page.locator('.perm')).toHaveCount(0);
});

test('invites to the platform when there is no store', async ({ page }) => {
  await mockApi(page, {
    preview: (route) =>
      route.fulfill({
        status: 200,
        json: { ...staffInvite, store_name: null, role: null, permissions: null },
      }),
  });
  await page.goto(`/invite#token=${token}`);

  await expect(page.getByText('ana@example.com was invited to pokemonAuction.')).toBeVisible();
  await expect(page.locator('.perm')).toHaveCount(0);
});

test('sends the token in the body of the request and never in the URL', async ({ page }) => {
  const seen: { url: string; body: string | null }[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/v1/auth/')) {
      seen.push({ url: request.url(), body: request.postData() });
    }
  });
  await mockApi(page);

  await page.goto(`/invite#token=${token}`);
  await expect(page.getByRole('heading', { name: 'You were invited' })).toBeVisible();

  const preview = seen.find((request) => request.url.includes('/invitations/preview'));
  expect(preview?.body).toContain(token);
  expect(seen.every((request) => !request.url.includes(token))).toBe(true);
});

test('shows one generic message for an invalid, expired or revoked invitation', async ({
  page,
}) => {
  await mockApi(page, { preview: (route) => route.fulfill(problem(404, 'INVITATION_INVALID')) });
  await page.goto(`/invite#token=${token}`);

  await expect(
    page.getByRole('heading', { name: 'This invitation is not available' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('shows the same message when the link has no token', async ({ page }) => {
  let asked = false;
  await mockApi(page, {
    preview: (route) => {
      asked = true;
      return route.fulfill(problem(404, 'INVITATION_INVALID'));
    },
  });
  await page.goto('/invite');

  await expect(
    page.getByRole('heading', { name: 'This invitation is not available' }),
  ).toBeVisible();
  expect(asked).toBe(false);
});

test('offers to try again when the invitation could not be checked', async ({ page }) => {
  let calls = 0;
  await mockApi(page, {
    preview: (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill(problem(503, 'DATABASE_UNAVAILABLE'))
        : route.fulfill({ status: 200, json: staffInvite });
    },
  });
  await page.goto(`/invite#token=${token}`);

  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(page.getByRole('heading', { name: 'You were invited' })).toBeVisible();
});

test('accepts the invitation, asks for the code and lands on the code step of the login', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(`/invite#token=${token}`);

  await page.getByRole('button', { name: 'Accept invitation and sign in' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible();
  await expect(page.getByText('Sent to ana@example.com.')).toBeVisible();
  await expect(page.getByLabel('Digit 1 of 6')).toBeFocused();
  // The e-mail did not travel in the address.
  expect(page.url()).not.toContain('ana');
});

test('lands on the e-mail step, filled in, when the code could not be asked for', async ({
  page,
}) => {
  await mockApi(page, { otp: (route) => route.fulfill(problem(429, 'RATE_LIMITED')) });
  await page.goto(`/invite#token=${token}`);

  await page.getByRole('button', { name: 'Accept invitation and sign in' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('E-mail')).toHaveValue('ana@example.com');
});

test('explains why an invitation could not be accepted', async ({ page }) => {
  await mockApi(page, { accept: (route) => route.fulfill(problem(422, 'INVITATION_NOT_ALLOWED')) });
  await page.goto(`/invite#token=${token}`);

  await page.getByRole('button', { name: 'Accept invitation and sign in' }).click();

  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'This invitation cannot be accepted with this account.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/invite#/);
});

test('can be declined, which leaves the page', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/invite#token=${token}`);

  await page.getByRole('link', { name: 'Decline invitation' }).click();

  await expect(page).toHaveURL(/\/$/);
});

test('keeps the token when the old /convite link is used', async ({ page }) => {
  await mockApi(page);
  await page.goto(`/convite#token=${token}`);

  await expect(page).toHaveURL(new RegExp(`/invite#token=${token}$`));
  await expect(page.getByRole('heading', { name: 'You were invited' })).toBeVisible();
});

test('is in Portuguese for a browser in Portuguese', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pt-BR' });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`/invite#token=${token}`);

  await expect(page.getByRole('heading', { name: 'Você foi convidado(a)' })).toBeVisible();
  await expect(page.locator('.perm', { hasText: 'Gerenciar estoque' })).toContainText('Sim');
  await context.close();
});
