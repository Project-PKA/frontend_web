import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface Store {
  id: string;
  name: string;
  city: string | null;
  plan: string;
  member_limit: number;
  card_limit: number | null;
  members_count: number;
  whatsapp_status: 'ONLINE' | 'OFFLINE' | 'QR_READY';
  owner: { id: string; email: string; name: string | null } | null;
  created_at: string;
}

const STORES = (): Store[] => [
  {
    id: 's-1',
    name: 'Poké Card Hub',
    city: 'São Paulo',
    plan: 'STANDARD',
    member_limit: 5,
    card_limit: null,
    members_count: 3,
    whatsapp_status: 'ONLINE',
    owner: { id: 'u-1', email: 'igor@loja.example.com', name: 'Igor' },
    created_at: '2030-02-10T12:00:00.000Z',
  },
  {
    id: 's-2',
    name: 'Cards do Zé',
    city: null,
    plan: 'NETWORK',
    member_limit: 3,
    card_limit: 500,
    members_count: 1,
    whatsapp_status: 'OFFLINE',
    owner: { id: 'u-2', email: 'ze@cards.example.com', name: null },
    created_at: '2030-02-22T12:00:00.000Z',
  },
];

const USERS = [
  {
    id: 'u-3',
    email: 'ana@example.com',
    name: 'Ana Souza',
    status: 'ACTIVE',
    can_create_stores: false,
    store_limit: 0,
    is_platform_admin: false,
    last_login_at: null,
    created_at: '2030-01-01T12:00:00Z',
    stores_count: 1,
  },
];

interface Invitation {
  id: string;
  email: string;
  kind: 'ACCOUNT' | 'OWNER' | 'STAFF';
  store: { id: string; name: string } | null;
  state: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
}

const INVITATIONS = (): Invitation[] => [
  {
    id: 'i-1',
    email: 'marina@cards.example.com',
    kind: 'OWNER',
    store: { id: 's-9', name: 'Marina Cards' },
    state: 'PENDING',
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'i-2',
    email: 'leo@loja.example.com',
    kind: 'STAFF',
    store: { id: 's-1', name: 'Poké Card Hub' },
    state: 'EXPIRED',
    expires_at: '2030-01-10T12:00:00.000Z',
    created_at: '2030-01-03T12:00:00.000Z',
  },
  {
    id: 'i-3',
    email: 'ana@example.com',
    kind: 'STAFF',
    store: { id: 's-1', name: 'Poké Card Hub' },
    state: 'ACCEPTED',
    expires_at: '2030-01-20T12:00:00.000Z',
    created_at: '2030-01-13T12:00:00.000Z',
  },
];

const REQUESTS = () => [
  {
    id: 'a-1',
    name: 'Marina C.',
    email: 'marina@cards.example.com',
    whatsapp: '5511988771020',
    store_name: 'Marina Cards',
    message: null,
    status: 'PENDING',
    decided_at: null,
    converted_store_id: null,
    created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'a-2',
    name: 'Paulo R.',
    email: 'paulo@sul.example.com',
    whatsapp: null,
    store_name: 'Sul TCG',
    message: null,
    status: 'PENDING',
    decided_at: null,
    converted_store_id: null,
    created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
  },
];

interface Options {
  createAnswer?: object;
  transferAnswer?: object;
  revokeAnswer?: object;
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
    storeLists: [] as URLSearchParams[],
    created: [] as Record<string, unknown>[],
    transfers: [] as { id: string; body: Record<string, unknown> }[],
    resent: [] as string[],
    revoked: [] as string[],
    refused: [] as string[],
    inviteLists: [] as URLSearchParams[],
  };
  const stores = STORES();
  const invitations = INVITATIONS();
  let requests = REQUESTS();

  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: true,
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
  await page.route(/\/v1\/admin\/dashboard$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        kpis: {
          active_users: 4,
          stores: 2,
          pending_invitations: 1,
          new_access_requests: requests.length,
          pending_plan_requests: 0,
        },
        disconnected_stores: [],
      },
    }),
  );
  await page.route(/\/v1\/admin\/access-requests\/[^/]+\/refuse$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    calls.refused.push(id);
    requests = requests.filter((item) => item.id !== id);
    return route.fulfill({ status: 200, json: {} });
  });
  await page.route(/\/v1\/admin\/access-requests(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, json: { items: requests, next_cursor: null } }),
  );
  await page.route(/\/v1\/admin\/invitations\/[^/]+\/resend$/, (route) => {
    calls.resent.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({ status: 200, json: {} });
  });
  await page.route(/\/v1\/admin\/invitations\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    if (options.revokeAnswer) {
      return route.fulfill(options.revokeAnswer as Parameters<typeof route.fulfill>[0]);
    }
    calls.revoked.push(id);
    const found = invitations.find((item) => item.id === id);
    if (found) found.state = 'REVOKED';
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route(/\/v1\/admin\/invitations(\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    calls.inviteLists.push(params);
    const state = params.get('status');
    const kind = params.get('kind');
    return route.fulfill({
      status: 200,
      json: {
        items: invitations.filter(
          (item) => (!state || item.state === state) && (!kind || item.kind === kind),
        ),
        next_cursor: null,
      },
    });
  });
  await page.route(/\/v1\/admin\/users(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, json: { items: USERS, next_cursor: null } }),
  );
  await page.route(/\/v1\/admin\/stores\/[^/]+\/transfer-ownership$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.transfers.push({ id, body });
    if (options.transferAnswer) {
      return route.fulfill(options.transferAnswer as Parameters<typeof route.fulfill>[0]);
    }
    const found = stores.find((item) => item.id === id)!;
    found.owner = { id: 'u-3', email: 'ana@example.com', name: 'Ana Souza' };
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/admin\/stores(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.created.push(body);
      if (options.createAnswer) {
        return route.fulfill(options.createAnswer as Parameters<typeof route.fulfill>[0]);
      }
      const made: Store = {
        id: 's-new',
        name: String(body.name),
        city: (body.city as string | undefined) ?? null,
        plan: String(body.plan ?? 'STANDARD'),
        member_limit: Number(body.member_limit ?? 5),
        card_limit: null,
        members_count: 1,
        whatsapp_status: 'OFFLINE',
        owner: null,
        created_at: '2030-03-05T12:00:00.000Z',
      };
      stores.push(made);
      return route.fulfill({
        status: 201,
        json: { store: made, owner_state: body.owner_email ? 'INVITED' : 'MEMBER' },
      });
    }
    const params = new URL(route.request().url()).searchParams;
    calls.storeLists.push(params);
    const q = params.get('q')?.toLowerCase();
    const items = stores.filter(
      (item) => !q || item.name.toLowerCase().includes(q) || (item.owner?.email ?? '').includes(q),
    );
    return route.fulfill({ status: 200, json: { items, next_cursor: null } });
  });
  return calls;
}

// ----------------------------------------------------------------- stores

test('lists the stores with owner, plan, members and WhatsApp', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/stores');

  await expect(page.getByRole('heading', { level: 1, name: 'Stores' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Stores' });
  await expect(table.getByRole('row')).toHaveCount(3);
  const hub = table.getByRole('row').filter({ hasText: 'Poké Card Hub' });
  await expect(hub).toContainText('São Paulo');
  await expect(hub).toContainText('igor@loja.example.com');
  await expect(hub).toContainText('Standard');
  await expect(hub).toContainText('3 of 5');
  await expect(hub).toContainText('WhatsApp online');
  const ze = table.getByRole('row').filter({ hasText: 'Cards do Zé' });
  await expect(ze).toContainText('NETWORK');
  await expect(ze).toContainText('WhatsApp offline');
});

test('searches the stores, keeping the search in the address', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores');

  await page.getByRole('searchbox', { name: 'Search store or owner' }).fill('zé');
  await expect.poll(() => calls.storeLists.at(-1)?.get('q')).toBe('zé');
  await expect(page).toHaveURL(/\/admin\/stores\?q=/);
  await expect(page.getByRole('table', { name: 'Stores' }).getByRole('row')).toHaveCount(2);
});

test('says so when no store matches', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/stores?q=nothing');

  await expect(page.getByRole('heading', { name: 'No store matches' })).toBeVisible();
});

test('transfers the ownership to an active account found by name or e-mail', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores');

  await page.getByRole('button', { name: 'Transfer the ownership of Cards do Zé' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer ownership' });
  await expect(dialog).toContainText('ze@cards.example.com');
  await dialog.getByRole('combobox', { name: 'New owner' }).fill('ana');
  await dialog.getByRole('option', { name: /Ana Souza/ }).click();
  await expect(dialog.getByText('New owner: ana@example.com')).toBeVisible();
  await expect(dialog).toContainText('becomes an employee of the store');
  await dialog.getByRole('button', { name: 'Transfer', exact: true }).click();

  await expect(page.getByText('ana@example.com is now the owner.')).toBeVisible();
  expect(calls.transfers).toEqual([{ id: 's-2', body: { new_owner_user_id: 'u-3' } }]);
  await expect(page.getByRole('row').filter({ hasText: 'Cards do Zé' })).toContainText(
    'ana@example.com',
  );
});

test('asks for the new owner before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores');

  await page.getByRole('button', { name: 'Transfer the ownership of Cards do Zé' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer ownership' });
  await dialog.getByRole('button', { name: 'Transfer', exact: true }).click();
  await expect(dialog.getByText('Pick the account of the new owner.')).toBeVisible();
  expect(calls.transfers).toEqual([]);
});

test('shows the error of the transfer translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { transferAnswer: problem(409, 'ADMIN_ALREADY_OWNER') });
  await page.goto('/admin/stores');

  await page.getByRole('button', { name: 'Transfer the ownership of Cards do Zé' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer ownership' });
  await dialog.getByRole('combobox', { name: 'New owner' }).fill('ana');
  await dialog.getByRole('option', { name: /Ana Souza/ }).click();
  await dialog.getByRole('button', { name: 'Transfer', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('already owns the store');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

// ------------------------------------------------------------ create store

test('creates a store and invites a new owner by e-mail', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores/new');

  await page.getByLabel('Store name').fill(' Marina Cards ');
  await page.getByLabel('City / State').fill('São Paulo / SP');
  await page.getByLabel('Plan', { exact: true }).fill('standard');
  await page.getByLabel('Member limit').fill('3');
  await page.getByLabel('E-mail').fill(' marina@cards.example.com ');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page).toHaveURL(/\/admin\/stores$/);
  await expect(
    page.getByText('Marina Cards created. Invitation sent to marina@cards.example.com.'),
  ).toBeVisible();
  expect(calls.created).toEqual([
    {
      name: 'Marina Cards',
      city: 'São Paulo / SP',
      plan: 'STANDARD',
      member_limit: 3,
      owner_email: 'marina@cards.example.com',
    },
  ]);
});

test('creates a store for an existing account', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores/new');

  await page.getByLabel('Store name').fill('Ana Cards');
  await page.getByRole('button', { name: 'Existing user' }).click();
  await page.getByRole('combobox', { name: 'Search user' }).fill('ana');
  await page.getByRole('option', { name: /Ana Souza/ }).click();
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page).toHaveURL(/\/admin\/stores$/);
  expect(calls.created).toEqual([{ name: 'Ana Cards', member_limit: 5, owner_user_id: 'u-3' }]);
  await expect(page.getByText('Ana Cards created. ana@example.com is the owner.')).toBeVisible();
});

test('checks the form before calling the API', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores/new');

  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByText('Enter the name of the store.')).toBeVisible();
  await expect(page.getByText('Enter a valid e-mail.')).toBeVisible();

  await page.getByLabel('Store name').fill('X');
  await page.getByLabel('Plan', { exact: true }).fill('9bad');
  await page.getByLabel('Member limit').fill('0');
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByText(/capital letters, digits and _/)).toBeVisible();
  await expect(page.getByText('Enter a whole number from 1 to 1000.')).toBeVisible();

  await page.getByRole('button', { name: 'Existing user' }).click();
  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByText('Pick the account of the owner.')).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('shows the error of the creation translated, never the detail', async ({ page }) => {
  await signedIn(page, { createAnswer: problem(409, 'ADMIN_EMAIL_TAKEN') });
  await page.goto('/admin/stores/new');

  await page.getByLabel('Store name').fill('Marina Cards');
  await page.getByLabel('E-mail').fill('marina@cards.example.com');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'There is already an account' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('turns an access request into a store, filling what the person already said', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/admin/stores/new?request=a-2');

  await expect(page.getByText('Creating the store of the request from Paulo R.')).toBeVisible();
  await expect(page.getByLabel('Store name')).toHaveValue('Sul TCG');
  await expect(page.getByLabel('E-mail')).toHaveValue('paulo@sul.example.com');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page).toHaveURL(/\/admin\/stores$/);
  expect(calls.created[0]).toMatchObject({
    name: 'Sul TCG',
    owner_email: 'paulo@sul.example.com',
    access_request_id: 'a-2',
  });
});

// ------------------------------------------------- invitations and requests

test('lists the invitations with type, store, dates and status', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin/invitations');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Invitations and requests' }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Invitations sent' });
  await expect(table.getByRole('row')).toHaveCount(4);
  const marina = table.getByRole('row').filter({ hasText: 'marina@cards.example.com' });
  await expect(marina).toContainText('Owner');
  await expect(marina).toContainText('Marina Cards');
  await expect(marina).toContainText(/2 hours ago/);
  await expect(marina).toContainText(/\d{1,2}\/\d{1,2}\/\d{2}/);
  await expect(marina).toContainText('Pending');
  const ana = table.getByRole('row').filter({ hasText: 'ana@example.com' });
  await expect(ana).toContainText('Accepted');
  await expect(ana.getByRole('button')).toHaveCount(0);
  await expect(table.getByRole('row').filter({ hasText: 'leo@loja' })).toContainText('Expired');
});

test('filters the invitations by status and by type', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/invitations');

  await page.getByLabel('Status', { exact: true }).selectOption('PENDING');
  await expect.poll(() => calls.inviteLists.at(-1)?.get('status')).toBe('PENDING');
  await page.getByLabel('Type', { exact: true }).selectOption('OWNER');
  await expect.poll(() => calls.inviteLists.at(-1)?.get('kind')).toBe('OWNER');
  await expect(page.getByRole('table', { name: 'Invitations sent' }).getByRole('row')).toHaveCount(
    2,
  );
});

test('sends an invitation again, and revokes one only after asking', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/invitations');

  await page
    .getByRole('button', { name: 'Resend the invitation to marina@cards.example.com' })
    .click();
  await expect(page.getByText('Invitation sent again to marina@cards.example.com.')).toBeVisible();
  expect(calls.resent).toEqual(['i-1']);

  await page
    .getByRole('button', { name: 'Revoke the invitation of marina@cards.example.com' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Revoke the invitation' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(calls.revoked).toEqual([]);

  await page
    .getByRole('button', { name: 'Revoke the invitation of marina@cards.example.com' })
    .click();
  await dialog.getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(page.getByText('Invitation revoked.')).toBeVisible();
  expect(calls.revoked).toEqual(['i-1']);
});

test('shows the error of the revocation translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { revokeAnswer: problem(409, 'ADMIN_NOT_PENDING') });
  await page.goto('/admin/invitations');

  await page
    .getByRole('button', { name: 'Revoke the invitation of marina@cards.example.com' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Revoke the invitation' });
  await dialog.getByRole('button', { name: 'Revoke', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('no longer pending');
});

test('lists the access requests, to create the store or to refuse', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin/invitations');

  await page.getByRole('tab', { name: 'Access requests' }).click();
  const table = page.getByRole('table', { name: 'Access requests' });
  await expect(table.getByRole('row')).toHaveCount(3);
  const marina = table.getByRole('row').filter({ hasText: 'Marina C.' });
  await expect(marina).toContainText('Marina Cards');
  await expect(marina).toContainText('(11) 98877-1020');
  await expect(
    marina.getByRole('link', { name: 'Create the store and invite Marina C.' }),
  ).toHaveAttribute('href', '/admin/stores/new?request=a-1');

  await page.getByRole('button', { name: 'Refuse the request of Paulo R.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Refuse the request' });
  await expect(dialog).toContainText('Nothing is sent to the person');
  await dialog.getByRole('button', { name: 'Refuse', exact: true }).click();
  await expect(page.getByText('Request refused.')).toBeVisible();
  expect(calls.refused).toEqual(['a-2']);
  await expect(page.getByRole('row').filter({ hasText: 'Paulo R.' })).toHaveCount(0);
});

test('leads from the dashboard to the stores, the requests and the store creation', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/admin');

  await expect(
    page.getByRole('link', { name: 'Create the store and invite Marina C.' }),
  ).toHaveAttribute('href', '/admin/stores/new?request=a-1');
  await expect(
    page
      .getByRole('region', { name: 'New access requests' })
      .getByRole('link', { name: 'See all' }),
  ).toHaveAttribute('href', '/admin/invitations');
  const nav = page.getByRole('navigation', { name: 'Administration' });
  for (const [name, href] of [
    ['Users', '/admin/users'],
    ['Stores', '/admin/stores'],
    ['Invitations and requests', '/admin/invitations'],
  ]) {
    await expect(nav.getByRole('link', { name })).toHaveAttribute('href', href!);
  }
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);

  for (const path of ['/admin/stores', '/admin/stores/new', '/admin/invitations']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
