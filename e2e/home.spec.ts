import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const SETUP_DONE = {
  store_created: true,
  whatsapp_connected: true,
  first_card: true,
  first_auction: true,
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function home(overrides: Record<string, unknown> = {}) {
  return {
    setup: SETUP_DONE,
    poll_alerts: [],
    kpis: {
      active_auctions: 6,
      scheduled_today: 4,
      bids_in_active: 128,
      pending_settlements: 2,
      cards_without_auction: 3,
    },
    cards_without_auction: [
      { id: 'c-1', short_code: '0471', name: 'Pikachu VMAX' },
      { id: 'c-2', short_code: '0440', name: 'Gengar VMAX' },
    ],
    quick_settlements: [
      {
        id: 's-1',
        customer: { id: 'u-1', name: 'Rafael M.' },
        total_amount: '340.00',
        items: 2,
        created_at: minutesAgo(12),
      },
      {
        id: 's-2',
        customer: { id: 'u-2', name: 'Camila T.' },
        total_amount: '60.50',
        items: 1,
        created_at: minutesAgo(180),
      },
    ],
    ...overrides,
  };
}

async function signedIn(
  page: Page,
  options: {
    role?: 'OWNER' | 'STAFF';
    permissions?: Record<string, boolean>;
    answer?: () => object;
    status?: number;
  } = {},
) {
  const requests = { count: 0 };
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
  await page.route('**/v1/store', (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: 'store-1',
        name: 'Card Hub',
        whatsapp_status: 'ONLINE',
        role: options.role ?? 'OWNER',
        permissions: options.permissions ?? {},
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
  await page.route('**/v1/dashboard/home', (route) => {
    requests.count += 1;
    if (options.status) {
      return route.fulfill({
        status: options.status,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Error', status: options.status },
      });
    }
    return route.fulfill({ status: 200, json: options.answer ? options.answer() : home() });
  });
  return requests;
}

test('shows the live indicators and the two queues', async ({ page }) => {
  await signedIn(page);
  await page.goto('/home');

  const kpis = page.getByRole('group', { name: 'Live indicators' });
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(kpis.getByText('Active auctions now')).toBeVisible();
  await expect(kpis).toContainText('128');
  await expect(kpis).toContainText('Bids in active auctions');
  await expect(kpis.getByRole('link', { name: 'Open the monitor' })).toBeVisible();

  const cards = page.getByRole('table', { name: 'Cards without a scheduled auction' });
  await expect(cards.getByText('#0471')).toBeVisible();
  await expect(cards.getByText('Gengar VMAX')).toBeVisible();

  const queue = page.getByRole('table', { name: 'Quick settlements queue' });
  await expect(queue.getByText('Rafael M.')).toBeVisible();
  await expect(queue.getByText('12 minutes ago')).toBeVisible();
  await expect(queue.getByText('3 hours ago')).toBeVisible();
  await expect(queue.getByText('2 items')).toBeVisible();
  await expect(queue.getByText('1 item', { exact: true })).toBeVisible();
});

test('shows the amounts formatted from the decimal strings the API sent', async ({ page }) => {
  await signedIn(page);
  await page.goto('/home');

  const queue = page.getByRole('table', { name: 'Quick settlements queue' });
  await expect(queue.getByText(/R\$\s?340\.00/)).toBeVisible();
  await expect(queue.getByText(/R\$\s?60\.50/)).toBeVisible();
});

test('warns about the poll auctions waiting for validation', async ({ page }) => {
  const alert = (n: number) => ({
    auction_id: `a-${n}`,
    card: { id: `c-${n}`, short_code: `04${n}1`, name: n === 1 ? 'Charizard ex' : 'Pikachu VMAX' },
    ceiling: '300.00',
    current_bid: '250.00',
    provisional_winner: null,
  });
  await signedIn(page, { answer: () => home({ poll_alerts: [alert(1), alert(2)] }) });
  await page.goto('/home');

  const warning = page.getByRole('alert').filter({ hasText: 'poll auctions are waiting' });
  await expect(warning).toContainText('2 poll auctions are waiting for validation');
  await expect(warning).toContainText('#0411 Charizard ex · #0421 Pikachu VMAX');
  await expect(
    warning.getByRole('link', { name: 'Review and approve the closing' }),
  ).toHaveAttribute('href', '/auctions/polls');
});

test('guides a new store through the four steps', async ({ page }) => {
  await signedIn(page, {
    answer: () =>
      home({
        setup: {
          store_created: true,
          whatsapp_connected: false,
          first_card: false,
          first_auction: false,
        },
        kpis: {
          active_auctions: 0,
          scheduled_today: 0,
          bids_in_active: 0,
          pending_settlements: 0,
          cards_without_auction: 0,
        },
        cards_without_auction: [],
        quick_settlements: [],
      }),
  });
  await page.goto('/home');

  await expect(page.getByText("Welcome, let's get your store ready")).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Welcome/ })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  await expect(page.getByText('1 of 4 done').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Connect' })).toHaveAttribute('href', '/settings');
  await expect(page.getByRole('link', { name: 'Register' })).toHaveAttribute(
    'href',
    '/inventory/new',
  );
  await expect(page.getByRole('button', { name: 'Schedule' })).toBeDisabled();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('hides the checklist when the store is ready', async ({ page }) => {
  await signedIn(page);
  await page.goto('/home');

  await expect(page.getByText('Active auctions now')).toBeVisible();
  await expect(page.getByText("Welcome, let's get your store ready")).toHaveCount(0);
});

test('does not send staff to pages they cannot open', async ({ page }) => {
  await signedIn(page, {
    role: 'STAFF',
    permissions: {},
    answer: () => home({ setup: { ...SETUP_DONE, whatsapp_connected: false } }),
  });
  await page.goto('/home');

  await expect(page.getByText("Welcome, let's get your store ready")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Connect' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open the monitor' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Close the settlement' })).toHaveCount(0);
});

test('updates only the pieces of the home, by themselves, with one request per round', async ({
  page,
}) => {
  let active = 6;
  const requests = await signedIn(page, {
    answer: () => home({ kpis: { ...home().kpis, active_auctions: active } }),
  });
  await page.clock.install();
  await page.goto('/home');
  const kpis = page.getByRole('group', { name: 'Live indicators' });
  await expect(kpis).toContainText('6');
  // A mark on the page and on a piece whose data will not change: a refresh of the whole
  // screen would remove them, a refresh of the pieces does not.
  await page.evaluate(() => {
    document.querySelector('h1')?.setAttribute('data-mark', 'kept');
    document.querySelector('#no-auction')?.setAttribute('data-mark', 'kept');
  });
  const before = requests.count;

  active = 7;
  await page.clock.runFor(16_000);

  await expect(kpis).toContainText('7');
  // Five pieces, one request: they share the same question.
  expect(requests.count).toBe(before + 1);
  await expect(page.locator('h1')).toHaveAttribute('data-mark', 'kept');
  await expect(page.locator('#no-auction')).toHaveAttribute('data-mark', 'kept');
});

test('shows an error with a way to try again when the home does not load', async ({ page }) => {
  await signedIn(page, { status: 500 });
  await page.goto('/home');

  // A server error is asked for again twice, with a wait in between, before the error shows.
  await expect(page.getByText('We could not load the home')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/home');
  await expect(page.getByText('Active auctions now')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
