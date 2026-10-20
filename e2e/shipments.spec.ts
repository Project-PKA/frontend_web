import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

interface Row {
  id: string;
  settlement_id: string;
  status: 'TO_SHIP' | 'SHIPPED' | 'DELIVERED';
  tracking_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  total_amount: string;
  recipient: {
    id: string;
    name: string;
    phone: string;
    address: Record<string, string | null>;
  };
}

function shipment(id: string, name: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    settlement_id: `st-${id}`,
    status: 'TO_SHIP',
    tracking_code: null,
    shipped_at: null,
    delivered_at: null,
    created_at: '2030-03-01T12:00:00.000Z',
    total_amount: '115.00',
    recipient: {
      id: `u-${id}`,
      name,
      phone: '5511988771020',
      address: { city: 'São Paulo', state: 'SP' },
    },
    ...extra,
  };
}

const QUEUE = (): Row[] => [
  shipment('s-1', 'Rafael M.'),
  shipment('s-2', 'Camila T.', {
    status: 'SHIPPED',
    tracking_code: 'BR123456789BR',
    recipient: {
      id: 'u-2',
      name: 'Camila T.',
      phone: '5521991204455',
      address: { city: 'Rio de Janeiro', state: 'RJ' },
    },
  }),
  shipment('s-3', 'Diego S.', {
    status: 'DELIVERED',
    tracking_code: 'BR987654321BR',
    recipient: { id: 'u-3', name: 'Diego S.', phone: '5585991112233', address: {} },
  }),
];

interface Options {
  rows?: Row[];
  patchStatus?: number;
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = { lists: [] as URLSearchParams[], patches: [] as { id: string; body: object }[] };
  const rows = options.rows ?? QUEUE();
  await page.addInitScript(() => localStorage.setItem('current-store', 'store-1'));
  await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, json: session }));
  await page.route('**/v1/me', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: session.user.id,
        email: session.user.email,
        name: null,
        is_platform_admin: false,
        can_create_stores: false,
        store_limit: 1,
      },
    }),
  );
  await page.route(/\/v1\/store$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'store-1',
        name: 'Card Hub',
        whatsapp_status: 'ONLINE',
        inactivity_days_limit: null,
        role: 'OWNER',
        permissions: { can_manage_auctions: true },
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
  await page.route('**/v1/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, json: { count: 0 } }),
  );
  await page.route(/\/v1\/shipments\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    const body = route.request().postDataJSON() as Partial<Row>;
    calls.patches.push({ id, body });
    if (options.patchStatus) return route.fulfill(problem(options.patchStatus, 'VALIDATION_ERROR'));
    const found = rows.find((item) => item.id === id)!;
    Object.assign(found, body);
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/shipments(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    calls.lists.push(url.searchParams);
    const status = url.searchParams.get('status');
    const items = rows.filter((item) => !status || item.status === status);
    return route.fulfill({ status: 200, json: { items, next_cursor: null } });
  });
  return calls;
}

test('lists the queue with destination, status and tracking', async ({ page }) => {
  await signedIn(page);
  await page.goto('/shipments');

  await expect(page.getByRole('heading', { level: 1, name: 'Shipments' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Shipments' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('link', { name: 'Rafael M.' })).toHaveAttribute(
    'href',
    '/customers/u-s-1',
  );
  const toShip = table.getByRole('row').filter({ hasText: 'Rafael M.' });
  await expect(toShip).toContainText('São Paulo / SP');
  await expect(toShip).toContainText('To ship');
  const shipped = table.getByRole('row').filter({ hasText: 'Camila T.' });
  await expect(shipped).toContainText('BR123456789BR');
  await expect(table.getByRole('row').filter({ hasText: 'Diego S.' })).toContainText('Delivered');
});

test('filters by status and keeps it in the address', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/shipments');

  await page.getByLabel('Status', { exact: true }).selectOption('SHIPPED');
  await expect(page).toHaveURL(/\/shipments\?status=SHIPPED$/);
  await expect(page.getByRole('table', { name: 'Shipments' }).getByRole('row')).toHaveCount(2);
  expect(calls.lists.at(-1)?.get('status')).toBe('SHIPPED');

  await page.goto('/shipments?status=LOST');
  await expect(page.getByRole('table', { name: 'Shipments' })).toBeVisible();
  expect(calls.lists.at(-1)?.get('status')).toBeNull();
});

test('marks as shipped with the tracking code typed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/shipments');

  await page.getByLabel('Tracking code for Rafael M.').fill('  BR555  ');
  await page.getByRole('button', { name: 'Mark as shipped' }).click();

  await expect.poll(() => calls.patches.length).toBe(1);
  expect(calls.patches[0]).toEqual({
    id: 's-1',
    body: { status: 'SHIPPED', tracking_code: 'BR555' },
  });
  const row = page.getByRole('row').filter({ hasText: 'Rafael M.' });
  await expect(row).toContainText('Shipped');
  await expect(row).toContainText('BR555');
});

test('marks as shipped without a code', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/shipments');

  await page.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect.poll(() => calls.patches.length).toBe(1);
  expect(calls.patches[0]?.body).toEqual({ status: 'SHIPPED' });
});

test('warns the buyer on WhatsApp and marks as delivered', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/shipments');

  const link = page.getByRole('link', { name: 'Notify customer on WhatsApp' });
  await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/5521991204455\?text=/);
  await expect(link).toHaveAttribute('href', /BR123456789BR/);
  await expect(link).toHaveAttribute('rel', /noopener/);

  await page.getByRole('button', { name: 'Mark as delivered' }).click();
  await expect.poll(() => calls.patches.length).toBe(1);
  expect(calls.patches[0]).toEqual({ id: 's-2', body: { status: 'DELIVERED' } });
  await expect(page.getByRole('row').filter({ hasText: 'Camila T.' })).toContainText('Delivered');
});

test('shows a translated error when the change fails, never the detail', async ({ page }) => {
  await signedIn(page, { patchStatus: 422 });
  await page.goto('/shipments');

  await page.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /\w/ }).first()).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('says there is nothing to ship when the queue is empty', async ({ page }) => {
  await signedIn(page, { rows: [] });
  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'No shipments here' })).toBeVisible();
});

test('fits a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await page.goto('/shipments');

  await expect(page.getByRole('button', { name: 'Mark as shipped' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
