import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface User {
  id: string;
  email: string;
  name: string | null;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  can_create_stores: boolean;
  store_limit: number;
  is_platform_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  stores_count: number;
}

function user(id: string, email: string, extra: Partial<User> = {}): User {
  return {
    id,
    email,
    name: null,
    status: 'ACTIVE',
    can_create_stores: false,
    store_limit: 0,
    is_platform_admin: false,
    last_login_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    created_at: '2030-03-01T12:00:00.000Z',
    stores_count: 1,
    ...extra,
  };
}

const USERS = (): User[] => [
  user('u-1', 'igor@example.com', {
    name: 'Igor Costa',
    can_create_stores: true,
    store_limit: 3,
    is_platform_admin: true,
    stores_count: 2,
  }),
  user('u-2', 'ana@example.com', { name: 'Ana Souza' }),
  user('u-3', 'marina@example.com', {
    name: 'Marina C.',
    status: 'INVITED',
    last_login_at: null,
    stores_count: 0,
  }),
  user('u-4', 'leo@example.com', { name: 'Leo P.', status: 'SUSPENDED' }),
];

interface Options {
  admin?: boolean;
  users?: User[];
  createAnswer?: object;
  permissionsAnswer?: object;
  suspendAnswer?: object;
  invitations?: { id: string; email: string }[];
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = {
    lists: [] as URLSearchParams[],
    created: [] as Record<string, unknown>[],
    patched: [] as { id: string; body: Record<string, unknown> }[],
    suspended: [] as string[],
    reactivated: [] as string[],
    resent: [] as string[],
  };
  const users = options.users ?? USERS();

  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: options.admin ?? true,
        can_create_stores: false,
        store_limit: 1,
      },
    }),
  );
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
  await page.route(/\/v1\/admin\/invitations\/[^/]+\/resend$/, (route) => {
    calls.resent.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({ status: 200, json: { id: 'i-1', expires_at: '2030-03-16T12:00:00Z' } });
  });
  await page.route(/\/v1\/admin\/invitations(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        items: (options.invitations ?? [{ id: 'i-9', email: 'marina@example.com' }]).map(
          (item) => ({
            ...item,
            kind: 'ACCOUNT',
            store: null,
            state: 'PENDING',
            expires_at: '2030-03-16T12:00:00Z',
            created_at: '2030-03-09T12:00:00Z',
          }),
        ),
        next_cursor: null,
      },
    }),
  );
  await page.route(/\/v1\/admin\/users\/[^/]+\/permissions$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.patched.push({ id, body });
    if (options.permissionsAnswer) {
      return route.fulfill(options.permissionsAnswer as Parameters<typeof route.fulfill>[0]);
    }
    const found = users.find((item) => item.id === id)!;
    Object.assign(found, body);
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/admin\/users\/[^/]+\/(suspend|reactivate)$/, (route) => {
    const parts = route.request().url().split('/');
    const id = parts.at(-2) ?? '';
    const action = parts.at(-1);
    if (options.suspendAnswer) {
      return route.fulfill(options.suspendAnswer as Parameters<typeof route.fulfill>[0]);
    }
    const found = users.find((item) => item.id === id)!;
    if (action === 'suspend') {
      calls.suspended.push(id);
      found.status = 'SUSPENDED';
    } else {
      calls.reactivated.push(id);
      found.status = 'ACTIVE';
    }
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/admin\/users\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    const found = users.find((item) => item.id === id);
    if (!found) return route.fulfill(problem(404, 'ADMIN_NOT_FOUND'));
    return route.fulfill({
      status: 200,
      json: {
        ...found,
        stores: found.stores_count
          ? [{ id: 's-1', name: 'Card Hub', role: found.is_platform_admin ? 'OWNER' : 'STAFF' }]
          : [],
      },
    });
  });
  await page.route(/\/v1\/admin\/users(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.created.push(body);
      if (options.createAnswer) {
        return route.fulfill(options.createAnswer as Parameters<typeof route.fulfill>[0]);
      }
      const made = user('u-new', String(body.email), {
        name: (body.name as string | undefined) ?? null,
        status: 'INVITED',
        can_create_stores: body.can_create_stores === true,
        store_limit: Number(body.store_limit ?? 0),
        last_login_at: null,
        stores_count: 0,
      });
      users.push(made);
      return route.fulfill({ status: 201, json: made });
    }
    const params = new URL(route.request().url()).searchParams;
    calls.lists.push(params);
    const q = params.get('q')?.toLowerCase();
    const status = params.get('status');
    const create = params.get('can_create_stores');
    const items = users.filter(
      (item) =>
        (!q || item.email.includes(q) || (item.name ?? '').toLowerCase().includes(q)) &&
        (!status || item.status === status) &&
        (create === null || item.can_create_stores === (create === 'true')),
    );
    return route.fulfill({ status: 200, json: { items, next_cursor: null } });
  });
  return calls;
}

// ---------------------------------------------------------------- the list

test('lists the users with stores, permission, status and last access', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users');

  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Users' });
  await expect(table.getByRole('row')).toHaveCount(5);
  const igor = table.getByRole('row').filter({ hasText: 'Igor Costa' });
  await expect(igor).toContainText('Platform admin');
  await expect(igor).toContainText('Yes · up to 3');
  const ana = table.getByRole('row').filter({ hasText: 'Ana Souza' });
  await expect(ana).toContainText('No');
  await expect(ana).toContainText('Active');
  await expect(ana).toContainText(/2 hours ago/);
  const marina = table.getByRole('row').filter({ hasText: 'Marina C.' });
  await expect(marina).toContainText('Pending invitation');
  await expect(marina).toContainText('never');
  await expect(table.getByRole('row').filter({ hasText: 'Leo P.' })).toContainText('Suspended');
  await expect(table.getByRole('link', { name: 'Ana Souza', exact: true })).toHaveAttribute(
    'href',
    '/admin/users/u-2',
  );
});

test('filters by status and by who can create stores, keeping it in the address', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users');

  await page.getByLabel('Status', { exact: true }).selectOption('SUSPENDED');
  await expect(page).toHaveURL(/\/admin\/users\?status=SUSPENDED$/);
  await expect(page.getByRole('table', { name: 'Users' }).getByRole('row')).toHaveCount(2);
  expect(calls.lists.at(-1)?.get('status')).toBe('SUSPENDED');

  await page.getByLabel('Status', { exact: true }).selectOption('');
  await page.getByLabel('Can create stores').selectOption('yes');
  await expect(page).toHaveURL(/\/admin\/users\?create=yes$/);
  await expect(page.getByRole('table', { name: 'Users' }).getByRole('row')).toHaveCount(2);
  expect(calls.lists.at(-1)?.get('can_create_stores')).toBe('true');
});

test('searches after the person stops typing', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users');

  await page.getByRole('searchbox', { name: 'Search by name or e-mail' }).fill('ana');
  await expect.poll(() => calls.lists.at(-1)?.get('q')).toBe('ana');
  await expect(page.getByRole('table', { name: 'Users' }).getByRole('row')).toHaveCount(2);
});

test('says when nothing matches and clears the filters', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users?status=INVITED&create=yes');

  await expect(page.getByRole('heading', { name: 'No user matches' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear the filters' }).click();
  await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
});

test('ignores a filter the API does not know', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users?status=GONE');

  await expect(page.getByRole('table', { name: 'Users' })).toBeVisible();
  expect(calls.lists.at(-1)?.get('status')).toBeNull();
});

// ------------------------------------------------------------ registering

test('registers a user, who gets an invitation by e-mail', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Register user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register user' });
  await dialog.getByLabel('Name').fill('Carla M.');
  await dialog.getByLabel('E-mail').fill(' carla@example.com ');
  await dialog.locator('label.switch').filter({ hasText: 'Can create new stores' }).click();
  await dialog.getByLabel('Limit of own stores').fill('2');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();

  await expect(page.getByText('Invitation sent to carla@example.com.')).toBeVisible();
  expect(calls.created).toEqual([
    { email: 'carla@example.com', name: 'Carla M.', can_create_stores: true, store_limit: 2 },
  ]);
  await expect(page.getByRole('row').filter({ hasText: 'carla@example.com' })).toContainText(
    'Pending invitation',
  );
});

test('does not send the name when it is empty', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Register user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register user' });
  await dialog.getByLabel('E-mail').fill('x@example.com');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();

  await expect.poll(() => calls.created.length).toBe(1);
  expect(calls.created[0]).toEqual({
    email: 'x@example.com',
    can_create_stores: false,
    store_limit: 0,
  });
});

test('checks the e-mail and the limit before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Register user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register user' });
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Enter the e-mail.')).toBeVisible();

  await dialog.getByLabel('E-mail').fill('not-an-email');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Enter a valid e-mail.')).toBeVisible();

  await dialog.getByLabel('E-mail').fill('ok@example.com');
  await dialog.getByLabel('Limit of own stores').fill('-3');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Enter a whole number from 0 to 100.')).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('shows the error of the registration translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { createAnswer: problem(409, 'ADMIN_EMAIL_TAKEN') });
  await page.goto('/admin/users');

  await page.getByRole('button', { name: 'Register user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Register user' });
  await dialog.getByLabel('E-mail').fill('ana@example.com');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();

  await expect(dialog.getByRole('alert')).toContainText('There is already an account');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

// ----------------------------------------------------------------- detail

test('shows the data, the permissions and the stores of a user, read only', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users/u-2');

  await expect(page.getByRole('heading', { level: 2, name: 'Ana Souza' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeDisabled();
  await expect(page.getByLabel('E-mail')).toHaveValue('ana@example.com');
  await expect(page.getByLabel('Name')).toBeDisabled();
  const stores = page.getByRole('table', { name: 'Linked stores' });
  await expect(stores).toContainText('Card Hub');
  await expect(stores).toContainText('Employee');
  await expect(page.getByText('Read only')).toBeVisible();
  await expect(stores.getByRole('button')).toHaveCount(0);
});

test('changes the permissions, sending only what changed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users/u-2');

  await page.locator('label.switch').filter({ hasText: 'Can create new stores' }).click();
  await page.getByLabel('Limit of own stores').fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Permissions saved.')).toBeVisible();
  expect(calls.patched).toEqual([{ id: 'u-2', body: { can_create_stores: true, store_limit: 2 } }]);

  await page.getByLabel('Limit of own stores').fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(() => calls.patched.length).toBe(2);
  expect(calls.patched[1]).toEqual({ id: 'u-2', body: { store_limit: 3 } });
});

test('says so and sends nothing when nothing changed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users/u-2');

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Nothing was changed.')).toBeVisible();
  expect(calls.patched).toEqual([]);
});

test('checks the limit and shows the error of the API translated', async ({ page }) => {
  await signedIn(page, { permissionsAnswer: problem(422, 'ADMIN_LIMIT_BELOW_USAGE') });
  await page.goto('/admin/users/u-2');

  await page.getByLabel('Limit of own stores').fill('200');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Enter a whole number from 0 to 100.')).toBeVisible();

  await page.getByLabel('Limit of own stores').fill('1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'cannot be lower' })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('leaves a platform administrator read only', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users/u-1');

  await expect(page.getByText('cannot be changed here')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Suspend access' })).toHaveCount(0);
});

test('suspends the access only after asking, and lets the person back in', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users/u-2');

  await page.getByRole('button', { name: 'Suspend access' }).click();
  const dialog = page.getByRole('dialog', { name: 'Suspend access' });
  await expect(dialog).toContainText('will not be able to sign in to any store');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(calls.suspended).toEqual([]);

  await page.getByRole('button', { name: 'Suspend access' }).click();
  await dialog.getByRole('button', { name: 'Suspend', exact: true }).click();
  await expect(page.getByText('Access suspended.')).toBeVisible();
  expect(calls.suspended).toEqual(['u-2']);
  await expect(page.getByText('Suspended', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reactivate access' }).click();
  await page
    .getByRole('dialog', { name: 'Reactivate access' })
    .getByRole('button', { name: 'Reactivate', exact: true })
    .click();
  await expect(page.getByText('Access reactivated.')).toBeVisible();
  expect(calls.reactivated).toEqual(['u-2']);
});

test('sends the invitation again to a user who has not accepted it', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/users/u-3');

  await page.getByRole('button', { name: 'Resend invitation' }).click();
  await expect(page.getByText('Invitation sent again to marina@example.com.')).toBeVisible();
  expect(calls.resent).toEqual(['i-9']);
});

test('says when no pending invitation is found for the e-mail', async ({ page }) => {
  const calls = await signedIn(page, { invitations: [] });
  await page.goto('/admin/users/u-3');

  await page.getByRole('button', { name: 'Resend invitation' }).click();
  await expect(page.getByText('We found no pending invitation for this e-mail.')).toBeVisible();
  expect(calls.resent).toEqual([]);
});

test('has no resend for a user who is already active', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users/u-2');

  await expect(page.getByRole('button', { name: 'Resend invitation' })).toHaveCount(0);
});

test('says so when the user does not exist', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users/missing');

  await expect(page.getByText('We could not load the user')).toBeVisible();
  await expect(page.getByText('We could not find this record.')).toBeVisible();
});

// -------------------------------------------------------------- the rest

test('has the users in the menu of the admin area', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/users');

  const nav = page.getByRole('navigation', { name: 'Administration' });
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('does not open the users for someone who is not an administrator', async ({ page }) => {
  const calls = await signedIn(page, { admin: false });
  await page.goto('/admin/users');

  await expect(page.getByRole('table')).toHaveCount(0);
  expect(calls.lists).toEqual([]);
});

test('fits a 320px screen without scrolling sideways, in the list and in the detail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);

  for (const path of ['/admin/users', '/admin/users/u-2']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
