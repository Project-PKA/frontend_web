import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const CONSIGNOR = {
  id: 'u-1',
  phone: '5511988771020',
  name: 'Rafael M.',
  email: null,
  cpf_masked: '***.***.***-12',
  kind: 'CUSTOMER',
  is_blacklisted: false,
  blacklist_reason: null,
  last_interaction_at: null,
  address: {},
  created_at: '2030-03-01T12:00:00.000Z',
};

const FIRST_PAGE = {
  items: [
    {
      id: 'c-1',
      short_code: '0412',
      name: 'Charizard ex',
      card_status: 'SOLD',
      commission_pct: '15.00',
      sale_amount: '820.00',
      commission_amount: '123.00',
      net_amount: '697.00',
    },
    {
      id: 'c-2',
      short_code: '0377',
      name: 'Lugia V',
      card_status: 'AVAILABLE',
      commission_pct: '15.00',
      sale_amount: null,
      commission_amount: null,
      net_amount: null,
    },
  ],
  next_cursor: 'page-2',
  totals: { in_stock: 1, pending_net: '0.00', sold_net: '697.00', commission: '123.00' },
};

const SECOND_PAGE = {
  items: [
    {
      id: 'c-3',
      short_code: '0301',
      name: 'Mew ex',
      card_status: 'AVAILABLE',
      commission_pct: '10.00',
      sale_amount: null,
      commission_amount: null,
      net_amount: null,
    },
  ],
  next_cursor: null,
  totals: FIRST_PAGE.totals,
};

interface Options {
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  cpf?: string | null;
  linkStatus?: number;
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = { cursors: [] as (string | null)[], links: [] as string[] };
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
        permissions: options.permissions ?? {
          can_manage_customers: true,
          can_view_finance: true,
        },
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
  await page.route(/\/v1\/customers\/[^/]+\/(settlements|bids)/, (route) =>
    route.fulfill({ status: 200, json: { items: [], next_cursor: null } }),
  );
  await page.route(/\/v1\/customers\/[^/]+\/consignments/, (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    calls.cursors.push(cursor);
    return route.fulfill({ status: 200, json: cursor ? SECOND_PAGE : FIRST_PAGE });
  });
  await page.route(/\/v1\/customers\/[^/]+\/consignor-link$/, (route) => {
    calls.links.push(route.request().url().split('/').at(-2) ?? '');
    if (options.linkStatus)
      return route.fulfill(problem(options.linkStatus, 'CONSIGNOR_CPF_REQUIRED'));
    return route.fulfill({
      status: 201,
      json: {
        link: {
          id: 'l-1',
          kind: 'CONSIGNOR',
          settlement_id: null,
          customer_id: 'u-1',
          state: 'ACTIVE',
          expires_at: '2030-11-18T12:00:00Z',
          created_at: '2030-10-19T12:00:00Z',
        },
        token: 'tok_abc123',
      },
    });
  });
  await page.route(/\/v1\/customers\/[^/?]+$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        ...CONSIGNOR,
        cpf_masked: options.cpf === undefined ? CONSIGNOR.cpf_masked : options.cpf,
      },
    }),
  );
  return calls;
}

async function openWallet(page: Page) {
  await page.goto('/customers/u-1');
  await page.getByRole('tab', { name: 'Consignment wallet' }).click();
}

test('shows the totals and the cards, with the commission taken off the sale', async ({ page }) => {
  await signedIn(page);
  await openWallet(page);

  const totals = page.locator('.wallet__totals');
  await expect(totals).toContainText('In stock');
  await expect(totals).toContainText(/R\$\s?697\.00/);
  await expect(totals).toContainText(/R\$\s?123\.00/);

  const table = page.getByRole('table', { name: 'Consignment wallet' });
  const sold = table.getByRole('row').filter({ hasText: 'Charizard ex' });
  await expect(sold).toContainText(/R\$\s?820\.00/);
  await expect(sold).toContainText(/− R\$\s?123\.00/);
  await expect(sold).toContainText(/R\$\s?697\.00/);
  const unsold = table.getByRole('row').filter({ hasText: 'Lugia V' });
  await expect(unsold).toContainText('—');
});

test('loads the next page with the cursor', async ({ page }) => {
  const calls = await signedIn(page);
  await openWallet(page);

  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Mew ex' })).toBeVisible();
  expect(calls.cursors).toEqual([null, 'page-2']);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

test('makes the consignor link once, with the token only in the fragment', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const calls = await signedIn(page);
  await openWallet(page);

  await page.getByRole('button', { name: 'Create the link' }).click();
  const link = page.locator('.consignor-link__url');
  await expect(link).toContainText('/consignor#token=tok_abc123');
  expect(await link.textContent()).not.toContain('?');
  expect(calls.links).toEqual(['u-1']);

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied.')).toBeVisible();

  const whatsapp = page.getByRole('link', { name: 'Send on WhatsApp' });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/5511988771020\?text=/);
  await expect(whatsapp).toHaveAttribute('rel', /noopener/);
  await expect(page.getByRole('link', { name: 'View as consignor' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await expect(page.getByRole('button', { name: 'Create a new link' })).toBeVisible();
});

test('does not offer the link without the CPF registered', async ({ page }) => {
  await signedIn(page, { cpf: null });
  await openWallet(page);

  await expect(page.getByRole('button', { name: 'Create the link' })).toBeDisabled();
  await expect(page.getByText(/needs the consignor's CPF registered/)).toBeVisible();
});

test('translates the error of the link by its code', async ({ page }) => {
  await signedIn(page, { linkStatus: 422 });
  await openWallet(page);

  await page.getByRole('button', { name: 'Create the link' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /needs a CPF/ })).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('has no wallet tab without the finance permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: { can_manage_customers: true } });
  await page.goto('/customers/u-1');

  await expect(page.getByRole('tab', { name: 'Bids history' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Consignment wallet' })).toHaveCount(0);
});

test('fits a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page);
  await openWallet(page);

  await expect(page.locator('.wallet__totals')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
