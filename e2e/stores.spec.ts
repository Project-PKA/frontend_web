import { expect, test, type Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const stores = [
  { id: 'store-1', name: 'Poké Card Hub', role: 'OWNER', whatsapp_status: 'ONLINE' },
  { id: 'store-2', name: 'Cards and Co', role: 'STAFF', whatsapp_status: 'OFFLINE' },
];

async function signedIn(
  page: Page,
  options: {
    items?: typeof stores;
    canCreate?: boolean;
    limit?: number;
    onCreate?: Parameters<Page['route']>[1];
  } = {},
) {
  const items = options.items ?? stores;
  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me/stores', (route) => route.fulfill({ status: 200, json: { items } }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: false,
        can_create_stores: options.canCreate ?? false,
        store_limit: options.limit ?? 1,
      },
    }),
  );
  await page.route('**/v1/store', (route) => {
    const id = route.request().headers()['x-store-id'] ?? 'store-1';
    const store = items.find((item) => item.id === id) ?? items[0]!;
    return route.fulfill({
      status: 200,
      json: { ...store, permissions: {} },
    });
  });
  await page.route('**/v1/me/preferences', (route) =>
    route.fulfill({
      status: 200,
      json: {
        language: 'en',
        theme: 'SYSTEM',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        notifications: { in_app: true, email: true },
      },
    }),
  );
  await page.route(
    '**/v1/stores',
    options.onCreate ??
      ((route) =>
        route.fulfill({
          status: 201,
          json: {
            id: 'store-9',
            name: 'Brand New Store',
            whatsapp_status: 'OFFLINE',
            inactivity_days_limit: null,
            role: 'OWNER',
          },
        })),
  );
}

const card = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(name) });

test('shows each store as a card with the role and the WhatsApp state', async ({ page }) => {
  await signedIn(page);
  await page.goto('/stores');

  await expect(page.getByRole('heading', { level: 1, name: 'Choose a store' })).toBeVisible();
  const hub = card(page, 'Poké Card Hub');
  await expect(hub).toContainText('Owner');
  await expect(hub).toContainText('WhatsApp online');
  const other = card(page, 'Cards and Co');
  await expect(other).toContainText('Staff');
  await expect(other).toContainText('WhatsApp offline');
});

test('chooses a store with the keyboard and lands in its home', async ({ page }) => {
  await signedIn(page);
  await page.goto('/stores');

  await card(page, 'Poké Card Hub').focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Store Poké Card Hub, Owner/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('current-store'))).toBe('store-1');
});

test('brings a card that is not in the middle to the middle before choosing it', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/stores');
  await expect(card(page, 'Poké Card Hub')).toHaveClass(/is-sel/);

  // A real pointer click where the card is, without scrolling it into view first.
  const box = (await card(page, 'Cards and Co').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page).toHaveURL(/\/stores$/);
  await expect(card(page, 'Cards and Co')).toHaveClass(/is-sel/);
  expect(await page.evaluate(() => localStorage.getItem('current-store'))).toBeNull();

  await card(page, 'Cards and Co').click();
  await expect(page).toHaveURL(/\/home$/);
  expect(await page.evaluate(() => localStorage.getItem('current-store'))).toBe('store-2');
});

test('moves between the cards with the buttons', async ({ page }) => {
  await signedIn(page);
  await page.goto('/stores');
  const previous = page.getByRole('button', { name: 'Previous store' });
  const next = page.getByRole('button', { name: 'Next store' });
  await expect(previous).toBeDisabled();

  await next.click();

  await expect(card(page, 'Cards and Co')).toHaveClass(/is-sel/);
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
});

test('offers to create a store only to someone allowed to, under the limit', async ({ page }) => {
  await signedIn(page, { canCreate: true, limit: 2 });
  await page.goto('/stores');

  await expect(card(page, 'Create new store')).toBeVisible();
});

test('does not offer to create a store without the permission', async ({ page }) => {
  await signedIn(page, { canCreate: false });
  await page.goto('/stores');

  await expect(card(page, 'Poké Card Hub')).toBeVisible();
  await expect(card(page, 'Create new store')).toHaveCount(0);
});

test('does not offer to create a store at the limit', async ({ page }) => {
  await signedIn(page, { canCreate: true, limit: 1 });
  await page.goto('/stores');

  await expect(card(page, 'Poké Card Hub')).toBeVisible();
  await expect(card(page, 'Create new store')).toHaveCount(0);
});

test('explains that stores are joined by invitation when there is none', async ({ page }) => {
  await signedIn(page, { items: [] });
  await page.goto('/stores');

  await expect(page.getByRole('heading', { name: 'You are not in any store yet' })).toBeVisible();
});

test('signs out from the header', async ({ page }) => {
  await signedIn(page);
  await page.goto('/stores');
  await page.route('**/v1/auth/logout', (route) => route.fulfill({ status: 204 }));

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/login/);
});

test('creates a store and goes to it', async ({ page }) => {
  await signedIn(page, { canCreate: true, limit: 2 });
  await page.goto('/stores');

  await card(page, 'Create new store').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Create new store' })).toBeVisible();

  await page.getByLabel('Store name').fill('Brand New Store');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('status').getByText('Store Brand New Store created.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('current-store'))).toBe('store-9');
});

test('asks for the name of the store', async ({ page }) => {
  await signedIn(page, { canCreate: true, limit: 2 });
  await page.goto('/stores/new');

  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page.getByText('This field is required.')).toBeVisible();
});

test('shows why a store could not be created, in the right language', async ({ page }) => {
  await signedIn(page, {
    canCreate: true,
    limit: 2,
    onCreate: (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          code: 'STORE_LIMIT_REACHED',
          detail: 'mensagem em português',
        },
      }),
  });
  await page.goto('/stores/new');

  await page.getByLabel('Store name').fill('One More');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'You reached the limit of stores you can own.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/stores\/new$/);
});

test('keeps a person who may not create stores on the page, with the reason, and does not send them away', async ({
  page,
}) => {
  await signedIn(page, {
    canCreate: true,
    onCreate: (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'CANNOT_CREATE_STORES',
        },
      }),
  });
  await page.goto('/stores/new');
  await page.getByLabel('Store name').fill('Nope');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'Your account is not allowed to create stores.' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/stores\/new$/);
});

test('tells someone without the permission that the administrator allows it', async ({ page }) => {
  await signedIn(page, { canCreate: false });
  await page.goto('/stores/new');

  await expect(page.getByRole('heading', { name: 'You cannot create stores' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create store' })).toHaveCount(0);
});
