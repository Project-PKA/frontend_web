import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const BUYER = {
  id: 'u-1',
  name: 'Bruno A.',
  kind: 'CUSTOMER',
  phone: '5531984007731',
};

const AWAITING = () => [
  {
    customer: { id: 'u-1', name: 'Bruno A.', kind: 'CUSTOMER' },
    subtotal: '115.00',
    items: [
      {
        auction_id: 'a-1',
        amount: '95.00',
        card: { id: 'c-1', short_code: '0366', name: 'Gardevoir ex' },
        ended_at: '2030-03-04T22:00:00Z',
      },
      {
        auction_id: 'a-2',
        amount: '20.00',
        card: { id: 'c-2', short_code: '0359', name: 'Ralts Promo' },
        ended_at: '2030-03-04T22:30:00Z',
      },
    ],
  },
];

interface Row {
  id: string;
  status: 'PENDING' | 'PAID';
  customer: typeof BUYER;
  items_total: string;
  total_amount: string;
  paid_at: string | null;
  payment_claimed_at: string | null;
  has_receipt: boolean;
  created_at: string;
  items: {
    auction_id: string;
    amount: string;
    card: { id: string; short_code: string; name: string };
  }[];
}

const SETTLEMENT = (id: string, status: 'PENDING' | 'PAID', extra: Partial<Row> = {}): Row => ({
  id,
  status,
  customer: BUYER,
  items_total: '115.00',
  total_amount: '115.00',
  paid_at: status === 'PAID' ? '2030-03-06T15:00:00Z' : null,
  payment_claimed_at: null,
  has_receipt: false,
  created_at: '2030-03-05T15:00:00Z',
  items: [
    {
      auction_id: 'a-1',
      amount: '95.00',
      card: { id: 'c-1', short_code: '0366', name: 'Gardevoir ex' },
    },
  ],
  ...extra,
});

interface Options {
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  awaiting?: object[];
  createAnswer?: object;
  receipt?: boolean;
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
    created: [] as Record<string, unknown>[],
    links: [] as { id: string; body: Record<string, unknown> }[],
    paid: [] as string[],
    lists: [] as string[],
    receipts: [] as string[],
  };
  let awaiting = options.awaiting ?? AWAITING();
  let pending: Row[] = [
    SETTLEMENT('s-1', 'PENDING', {
      payment_claimed_at: '2030-03-05T18:00:00Z',
      has_receipt: options.receipt === true,
    }),
  ];
  let paid: Row[] = [SETTLEMENT('s-9', 'PAID')];

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
        permissions: options.permissions ?? { can_manage_auctions: true, can_view_finance: true },
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
  await page.route(/\/v1\/settlements\/[^/]+\/public-link$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    calls.links.push({ id, body: route.request().postDataJSON() as Record<string, unknown> });
    return route.fulfill({
      status: 201,
      json: {
        link: {
          id: 'l-1',
          kind: 'SETTLEMENT',
          settlement_id: id,
          customer_id: 'u-1',
          state: 'ACTIVE',
          expires_at: '2030-03-20T12:00:00Z',
          created_at: '2030-03-06T12:00:00Z',
        },
        token: 'tok_0123456789abcdefghij',
      },
    });
  });
  await page.route(/\/v1\/settlements\/[^/]+\/receipt$/, (route) => {
    calls.receipts.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  });
  await page.route(/\/v1\/settlements\/[^/]+\/paid$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    calls.paid.push(id);
    const found = pending.find((item) => item.id === id)!;
    pending = pending.filter((item) => item.id !== id);
    paid = [{ ...found, status: 'PAID', paid_at: '2030-03-07T12:00:00Z' }, ...paid];
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/settlements\/awaiting$/, (route) =>
    route.fulfill({ status: 200, json: { items: awaiting } }),
  );
  await page.route(/\/v1\/settlements(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.created.push(body);
      if (options.createAnswer) {
        return route.fulfill(options.createAnswer as Parameters<typeof route.fulfill>[0]);
      }
      const made = SETTLEMENT('s-new', 'PENDING');
      pending = [made, ...pending];
      awaiting = [];
      return route.fulfill({ status: 201, json: made });
    }
    const status = new URL(route.request().url()).searchParams.get('status') ?? '';
    calls.lists.push(status);
    return route.fulfill({
      status: 200,
      json: { items: status === 'PAID' ? paid : pending, next_cursor: null },
    });
  });
  return calls;
}

test('lists the buyers waiting for a settlement, with their cards and the subtotal', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/settlements');

  await expect(page.getByRole('heading', { level: 1, name: 'Settlements' })).toBeVisible();
  const table = page.getByRole('table', { name: 'To settle' });
  const row = table.getByRole('row').filter({ hasText: 'Bruno A.' });
  await expect(row).toContainText('#0366 Gardevoir ex, #0359 Ralts Promo');
  await expect(row).toContainText(/R\$\s?115\.00/);
  await expect(row.getByRole('link', { name: 'Bruno A.' })).toHaveAttribute(
    'href',
    '/customers/u-1',
  );
  await expect(page.getByText(/the platform does not handle shipping or payment/)).toBeVisible();
});

test('creates the settlement with the auctions the buyer won, and shows the link once', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/settlements');

  await page.getByRole('button', { name: 'Create the settlement of Bruno A.' }).click();

  expect(calls.created).toEqual([{ customer_id: 'u-1', auction_ids: ['a-1', 'a-2'] }]);
  await expect(page.getByText('Settlement of Bruno A. created.')).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Link for the buyer' });
  await expect(dialog).toContainText('/settlement#token=tok_0123456789abcdefghij');
  expect(await dialog.locator('.settlements__url').textContent()).not.toContain('?');
  expect(calls.links).toEqual([{ id: 's-new', body: { expires_in_days: 14 } }]);
  await expect(dialog).toContainText('shows only now and works for 14 days');
});

test('copies the link and opens WhatsApp with it, for the buyer', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signedIn(page);
  await page.goto('/settlements');

  await page.getByRole('button', { name: 'Create the settlement of Bruno A.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Link for the buyer' });
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '/settlement#token=tok_0123456789abcdefghij',
  );

  const whatsapp = dialog.getByRole('link', { name: 'Send on WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5531984007731\?text=/);
  await expect(whatsapp).toHaveAttribute('href', /settlement%23token%3Dtok_0123456789abcdefghij/);
  await expect(whatsapp).toHaveAttribute('rel', /noopener/);
});

test('shows a translated error when the settlement cannot be created, never the detail', async ({
  page,
}) => {
  await signedIn(page, { createAnswer: problem(409, 'SETTLEMENT_AUCTION_NOT_ELIGIBLE') });
  await page.goto('/settlements');

  await page.getByRole('button', { name: 'Create the settlement of Bruno A.' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'cannot be settled yet' })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('lists the open settlements, with the notice of the buyer, and makes a new link', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/settlements');

  await page.getByRole('tab', { name: 'Open' }).click();
  const table = page.getByRole('table', { name: 'Open' });
  const row = table.getByRole('row').filter({ hasText: 'Bruno A.' });
  await expect(row).toContainText('Waiting for payment');
  await expect(row).toContainText('The buyer said they paid on');
  await expect(row).toContainText('(31) 98400-7731');
  expect(calls.lists).toContain('PENDING');

  await page.getByRole('button', { name: 'Make the link of the settlement of Bruno A.' }).click();
  await expect(page.getByRole('dialog', { name: 'Link for the buyer' })).toContainText(
    '/settlement#token=',
  );
  expect(calls.links).toEqual([{ id: 's-1', body: { expires_in_days: 14 } }]);
});

test('shows the receipt the buyer sent, as an image, only to who asks for it', async ({ page }) => {
  const calls = await signedIn(page, { receipt: true });
  await page.goto('/settlements');

  await page.getByRole('tab', { name: 'Open' }).click();
  expect(calls.receipts).toEqual([]);
  await page.getByRole('button', { name: 'View the receipt sent by Bruno A.' }).click();

  const dialog = page.getByRole('dialog', { name: 'Receipt of the payment' });
  const image = dialog.getByRole('img', { name: 'Receipt of the payment sent by Bruno A.' });
  await expect(image).toBeVisible();
  expect(await image.getAttribute('src')).toMatch(/^blob:/);
  expect(calls.receipts).toEqual(['s-1']);
  await expect(dialog).toContainText('the receipt is only an image');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('has no receipt button when the buyer sent none', async ({ page }) => {
  await signedIn(page);
  await page.goto('/settlements');

  await page.getByRole('tab', { name: 'Open' }).click();
  await expect(page.getByRole('button', { name: /View the receipt/ })).toHaveCount(0);
});

test('confirms a payment only after asking, and the settlement moves to the paid ones', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/settlements');

  await page.getByRole('tab', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Confirm the payment of Bruno A.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm the payment' });
  await expect(dialog).toContainText('The cards of this settlement become sold');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(calls.paid).toEqual([]);

  await page.getByRole('button', { name: 'Confirm the payment of Bruno A.' }).click();
  await dialog.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(page.getByText('Payment confirmed.')).toBeVisible();
  expect(calls.paid).toEqual(['s-1']);

  await page.getByRole('tab', { name: 'Paid' }).click();
  await expect(page.getByRole('table', { name: 'Paid' }).getByRole('row')).toHaveCount(3);
});

test('has no payment confirmation for staff without the finance permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: { can_manage_auctions: true } });
  await page.goto('/settlements');

  await page.getByRole('tab', { name: 'Open' }).click();
  await expect(
    page.getByRole('button', { name: 'Make the link of the settlement of Bruno A.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirm the payment/ })).toHaveCount(0);
});

test('says so when nothing is waiting', async ({ page }) => {
  await signedIn(page, { awaiting: [] });
  await page.goto('/settlements');

  await expect(page.getByText('No buyer is waiting for a settlement')).toBeVisible();
});

test('does not open the settlements for staff without the auctions permission', async ({
  page,
}) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/settlements');

  await expect(page.getByRole('table')).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await page.goto('/settlements');
  await expect(page.getByRole('heading', { level: 1, name: 'Settlements' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
