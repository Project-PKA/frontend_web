import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const OVERVIEW = {
  period: 'today',
  from: '2030-03-01',
  kpis: { revenue: '8420.00', profit: '5980.00', items_sold: 45, average_item: '187.11' },
  daily: [
    { day: '2030-03-01', revenue: '300.00', profit: '210.00' },
    { day: '2030-03-02', revenue: '450.00', profit: '300.00' },
    { day: '2030-03-03', revenue: '120.00', profit: '90.00' },
  ],
  sales_by_price: [
    { band: 'UP_TO_25', count: 14 },
    { band: '25_TO_50', count: 31 },
    { band: '50_TO_100', count: 42 },
    { band: '100_TO_200', count: 27 },
    { band: 'OVER_200', count: 4 },
  ],
  bids_by_hour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hour === 21 ? 38 : 0 })),
  by_origin: [
    { key: 'OWN', revenue: '4880.00', count: 30 },
    { key: 'CONSIGNED', revenue: '3540.00', count: 15 },
  ],
  by_language: [
    { key: 'PT', revenue: '4400.00', count: 24 },
    { key: 'EN', revenue: '2600.00', count: 14 },
    { key: 'JP', revenue: '1420.00', count: 7 },
  ],
  by_condition: [
    { key: 'NM', revenue: '5100.00', count: 28 },
    { key: 'SP', revenue: '1900.00', count: 10 },
    { key: 'XX', revenue: '1420.00', count: 7 },
  ],
};

const BUYERS = {
  items: [
    { customer: { id: 'u-1', name: 'Rafael M.' }, purchases: 6, total: '1240.00' },
    { customer: { id: 'u-2', name: 'Camila T.' }, purchases: 4, total: '905.00' },
  ],
};

const PAYOUTS = {
  items: [
    {
      consignor: { id: 'u-3', name: 'Camila T.' },
      items_sold: 3,
      gross: '1100.00',
      commission: '165.00',
      payout: '935.00',
    },
    {
      consignor: { id: 'u-4', name: 'Diego S.' },
      items_sold: 1,
      gross: '210.00',
      commission: '31.50',
      payout: '178.50',
    },
  ],
};

interface Options {
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  overview?: object;
  overviewStatus?: number;
  buyersStatus?: number;
  payoutsItems?: object[];
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
    overview: [] as string[],
    buyers: [] as URLSearchParams[],
    payouts: [] as string[],
  };
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
        role: options.role ?? 'OWNER',
        permissions: options.permissions ?? { can_view_finance: true },
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
  await page.route(/\/v1\/finance\/overview/, (route) => {
    calls.overview.push(new URL(route.request().url()).searchParams.get('period') ?? '');
    if (options.overviewStatus) return route.fulfill(problem(options.overviewStatus, 'INTERNAL'));
    return route.fulfill({ status: 200, json: options.overview ?? OVERVIEW });
  });
  await page.route(/\/v1\/finance\/top-buyers/, (route) => {
    calls.buyers.push(new URL(route.request().url()).searchParams);
    if (options.buyersStatus) return route.fulfill(problem(options.buyersStatus, 'INTERNAL'));
    return route.fulfill({ status: 200, json: BUYERS });
  });
  await page.route(/\/v1\/finance\/consignment-payouts/, (route) => {
    calls.payouts.push(new URL(route.request().url()).searchParams.get('period') ?? '');
    return route.fulfill({ status: 200, json: { items: options.payoutsItems ?? PAYOUTS.items } });
  });
  return calls;
}

test('shows the four numbers, with the payable summed from the payouts', async ({ page }) => {
  await signedIn(page);
  await page.goto('/finance');

  await expect(page.getByRole('heading', { level: 1, name: 'Finance' })).toBeVisible();
  const kpis = page.locator('.grid--kpi');
  await expect(kpis).toContainText(/R\$\s?8,420\.00/);
  await expect(kpis).toContainText('Gross revenue');
  await expect(kpis).toContainText(/R\$\s?5,980\.00/);
  await expect(kpis).toContainText(/R\$\s?1,113\.50/);
  await expect(kpis).toContainText('To pay to consignors');
  await expect(kpis).toContainText(/R\$\s?187\.11/);
});

test('draws the charts, naming each one', async ({ page }) => {
  await signedIn(page);
  await page.goto('/finance');

  for (const name of [
    'Revenue and profit per day',
    'Revenue by origin',
    'Sales by price range',
    'Bids by time of day',
    'Sales by language',
    'Sales by condition',
  ]) {
    await expect(page.getByRole('img', { name })).toBeVisible();
  }
  const origin = page.getByRole('region', { name: 'Revenue by origin' });
  await expect(origin).toContainText('Own stock');
  await expect(origin).toContainText('58%');
  await expect(origin).toContainText('Consigned');
  await expect(page.getByRole('region', { name: 'Sales by language' })).toContainText('Japanese');
  // A condition the app does not know shows as the API sent it.
  await expect(page.getByRole('region', { name: 'Sales by condition' })).toContainText('XX');
  await expect(page.getByRole('img', { name: 'Sales by price range' })).toContainText('50–100');
});

test('lists the top buyers and the payouts, linking to the customers', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/finance');

  const buyers = page.getByRole('region', { name: 'Top buyers' });
  await expect(buyers.getByRole('link', { name: 'Rafael M.' })).toHaveAttribute(
    'href',
    '/customers/u-1',
  );
  await expect(buyers).toContainText(/R\$\s?1,240\.00/);
  expect(calls.buyers[0]?.get('limit')).toBe('5');

  const table = page.getByRole('table', { name: 'Consignment payouts' });
  await expect(table.getByRole('row')).toHaveCount(3);
  const row = table.getByRole('row').filter({ hasText: 'Camila T.' });
  await expect(row).toContainText(/R\$\s?1,100\.00/);
  await expect(row).toContainText(/R\$\s?165\.00/);
  await expect(row).toContainText(/R\$\s?935\.00/);
});

test('changes the period, keeps it in the address and asks again', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/finance');
  await expect(page.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page).toHaveURL(/\/finance\?period=7$/);
  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => calls.overview.at(-1)).toBe('7');
  expect(calls.payouts.at(-1)).toBe('7');

  await page.goto('/finance?period=90');
  await expect(page.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
  expect(calls.overview.at(-1)).toBe('today');
});

test('says there is no data when the period is empty', async ({ page }) => {
  await signedIn(page, {
    payoutsItems: [],
    overview: {
      ...OVERVIEW,
      kpis: { revenue: '0.00', profit: '0.00', items_sold: 0, average_item: '0.00' },
      daily: [],
      sales_by_price: OVERVIEW.sales_by_price.map((band) => ({ ...band, count: 0 })),
      bids_by_hour: [],
      by_origin: [],
      by_language: [],
      by_condition: [],
    },
  });
  await page.goto('/finance');

  await expect(page.getByText('No data in this period.').first()).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByText('No payouts in this period.')).toBeVisible();
});

test('shows an error with a way to try again, never the detail', async ({ page }) => {
  await signedIn(page, { overviewStatus: 400 });
  await page.goto('/finance');

  await expect(page.getByText('We could not load the finance')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('keeps the rest when the top buyers fail', async ({ page }) => {
  await signedIn(page, { buyersStatus: 403 });
  await page.goto('/finance');

  await expect(page.getByRole('img', { name: 'Revenue by origin' })).toBeVisible();
});

test('does not open the finance for staff without the permission', async ({ page }) => {
  const calls = await signedIn(page, {
    role: 'STAFF',
    permissions: { can_manage_inventory: true },
  });
  await page.goto('/finance');

  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '7 days' })).toHaveCount(0);
  expect(calls.overview).toEqual([]);
  expect(calls.payouts).toEqual([]);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await page.goto('/finance');
  await expect(page.getByRole('img', { name: 'Revenue and profit per day' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
