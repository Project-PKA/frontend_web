import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const DASHBOARD = {
  kpis: {
    active_users: 48,
    stores: 31,
    pending_invitations: 5,
    new_access_requests: 3,
    pending_plan_requests: 2,
  },
  disconnected_stores: [
    { id: 's-1', name: 'Cards do Zé', city: 'Campinas', whatsapp_status: 'OFFLINE' },
    { id: 's-2', name: 'Pocket Hub', city: null, whatsapp_status: 'QR_READY' },
  ],
};

const REQUESTS = {
  items: [
    {
      id: 'a-1',
      name: 'Marina C.',
      email: 'marina@example.com',
      whatsapp: null,
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
      email: 'paulo@example.com',
      whatsapp: null,
      store_name: 'Sul TCG',
      message: null,
      status: 'PENDING',
      decided_at: null,
      converted_store_id: null,
      created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(),
    },
  ],
  next_cursor: null,
};

interface Options {
  admin?: boolean;
  dashboard?: object;
  dashboardStatus?: number;
  requests?: object;
  requestsStatus?: number;
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = { dashboard: 0, requests: [] as URLSearchParams[] };
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
  await page.route(/\/v1\/admin\/dashboard$/, (route) => {
    calls.dashboard += 1;
    if (options.dashboardStatus) {
      return route.fulfill(problem(options.dashboardStatus, 'INTERNAL'));
    }
    return route.fulfill({ status: 200, json: options.dashboard ?? DASHBOARD });
  });
  await page.route(/\/v1\/admin\/access-requests/, (route) => {
    calls.requests.push(new URL(route.request().url()).searchParams);
    if (options.requestsStatus) {
      return route.fulfill(problem(options.requestsStatus, 'INTERNAL'));
    }
    return route.fulfill({ status: 200, json: options.requests ?? REQUESTS });
  });
  return calls;
}

test('shows the numbers of the platform', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin');

  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  const kpis = page.locator('.grid--kpi');
  await expect(kpis).toContainText('48');
  await expect(kpis).toContainText('Active users');
  await expect(kpis).toContainText('31');
  await expect(kpis).toContainText('Active stores');
  await expect(kpis).toContainText('Pending invitations');
  await expect(kpis).toContainText('Access requests');
  await expect(kpis).toContainText('Plan change requests');
});

test('lists the new access requests, the oldest information last', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/admin');

  const table = page.getByRole('table', { name: 'New access requests' });
  await expect(table.getByRole('row')).toHaveCount(3);
  const first = table.getByRole('row').filter({ hasText: 'Marina C.' });
  await expect(first).toContainText('Marina Cards');
  await expect(first).toContainText(/2 hours ago/);
  expect(calls.requests[0]?.get('status')).toBe('PENDING');
  expect(calls.requests[0]?.get('limit')).toBe('5');
});

test('lists the stores with WhatsApp down, as follow-up only', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin');

  const card = page.getByRole('region', { name: 'Stores with WhatsApp disconnected' });
  const table = card.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').filter({ hasText: 'Cards do Zé' })).toContainText('Campinas');
  await expect(table.getByRole('row').filter({ hasText: 'Cards do Zé' })).toContainText(
    'WhatsApp offline',
  );
  await expect(table.getByRole('row').filter({ hasText: 'Pocket Hub' })).toContainText(
    'scan the QR code',
  );
  await expect(card).toContainText('Follow-up only');
  // The administrator does not act on a store: no buttons in the table.
  await expect(table.getByRole('button')).toHaveCount(0);
});

test('has its own menu, the /admin badge and the way back to the stores', async ({ page }) => {
  await signedIn(page);
  await page.goto('/admin');

  const nav = page.getByRole('navigation', { name: 'Administration' });
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('/admin', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Back to the stores app/ })).toHaveAttribute(
    'href',
    '/stores',
  );
  // The menu of a store is not here.
  await expect(page.getByRole('link', { name: 'Inventory' })).toHaveCount(0);
});

test('says there is nothing to follow when the lists are empty', async ({ page }) => {
  await signedIn(page, {
    dashboard: { ...DASHBOARD, disconnected_stores: [] },
    requests: { items: [], next_cursor: null },
  });
  await page.goto('/admin');

  await expect(page.getByText('No new requests.')).toBeVisible();
  await expect(page.getByText('All the stores are connected.')).toBeVisible();
});

test('shows an error with a way to try again when the dashboard fails', async ({ page }) => {
  await signedIn(page, { dashboardStatus: 400 });
  await page.goto('/admin');

  await expect(page.getByText('We could not load the dashboard')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('keeps the rest when the requests fail', async ({ page }) => {
  await signedIn(page, { requestsStatus: 400 });
  await page.goto('/admin');

  await expect(page.getByText('We could not load the requests.')).toBeVisible();
  await expect(page.locator('.grid--kpi')).toContainText('48');
});

test('does not open the admin area for someone who is not an administrator', async ({ page }) => {
  const calls = await signedIn(page, { admin: false });
  await page.goto('/admin');

  await expect(page.locator('.grid--kpi')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Administration' })).toHaveCount(0);
  expect(calls.dashboard).toBe(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await page.goto('/admin');
  await expect(page.locator('.grid--kpi')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
