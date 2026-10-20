import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const NOW = new Date('2030-03-11T01:47:20.000Z');

function affected(id: string, code: string, name: string, endTime: string, bids: number) {
  return {
    id,
    card: {
      id: `card-${id}`,
      short_code: code,
      language: 'EN',
      condition: 'NM',
      catalog: {
        id: `cat-${id}`,
        name,
        names: {},
        number: '001/100',
        set_id: null,
        set_name: 'Evolving Skies',
        image_url: null,
        image_high_url: null,
        rarity: null,
      },
    },
    type: 'FREE_BID',
    status: 'ACTIVE',
    start_time: '2030-03-10T23:00:00.000Z',
    end_time: endTime,
    initial_bid: '20.00',
    min_increment: '5.00',
    max_poll_value: null,
    ceiling_alert: false,
    current_bid: '100.00',
    bid_count: bids,
    leader: null,
    winning_bid_id: null,
    created_at: '2030-03-01T12:00:00.000Z',
  };
}

const ITEMS = [
  affected('a-1', '0412', 'Charizard ex', '2030-03-11T02:00:00.000Z', 54),
  affected('a-2', '0431', 'Pikachu VMAX', '2030-03-11T02:28:25.000Z', 41),
  affected('a-3', '0388', 'Umbreon V', '2030-03-11T02:52:32.000Z', 33),
];

type WhatsApp = 'ONLINE' | 'OFFLINE' | 'QR_READY';

interface Options {
  whatsapp?: WhatsApp;
  items?: ReturnType<typeof affected>[];
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  extendStatus?: number;
}

interface Calls {
  extendedOne: { id: string; minutes: number }[];
  extendedAll: number[];
}

async function signedIn(page: Page, options: Options = {}): Promise<Calls> {
  const calls: Calls = { extendedOne: [], extendedAll: [] };
  const whatsapp = options.whatsapp ?? 'OFFLINE';

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
        whatsapp_status: whatsapp,
        role: options.role ?? 'OWNER',
        permissions: options.permissions ?? { can_manage_auctions: true },
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
  await page.route('**/v1/dashboard/home', (route) =>
    route.fulfill({
      status: 200,
      json: {
        setup: {
          store_created: true,
          whatsapp_connected: whatsapp === 'ONLINE',
          first_card: true,
          first_auction: true,
        },
        poll_alerts: [],
        kpis: {
          active_auctions: 3,
          scheduled_today: 0,
          bids_in_active: 128,
          pending_settlements: 0,
          cards_without_auction: 0,
        },
        cards_without_auction: [],
        quick_settlements: [],
      },
    }),
  );
  await page.route('**/v1/auctions/affected', (route) =>
    route.fulfill({
      status: 200,
      json: {
        whatsapp_status: whatsapp,
        items: whatsapp === 'ONLINE' ? [] : (options.items ?? ITEMS),
      },
    }),
  );
  await page.route(/\/v1\/auctions\/extend$/, (route) => {
    const { minutes } = route.request().postDataJSON() as { minutes: number };
    calls.extendedAll.push(minutes);
    return route.fulfill({ status: 200, json: { extended: ITEMS.map((item) => item.id) } });
  });
  await page.route(/\/v1\/auctions\/[^/?]+\/extend$/, (route) => {
    const { minutes } = route.request().postDataJSON() as { minutes: number };
    calls.extendedOne.push({ id: route.request().url().split('/').at(-2) ?? '', minutes });
    if (options.extendStatus) {
      return route.fulfill({
        status: options.extendStatus,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Error',
          status: options.extendStatus,
          code: 'AUCTION_NOT_LIVE',
          detail: 'mensagem em português',
        },
      });
    }
    return route.fulfill({ status: 200, json: { extended: ['a'] } });
  });
  return calls;
}

test('warns about the auctions that are not receiving bids, with how long each has left', async ({
  page,
}) => {
  await page.clock.install({ time: NOW });
  await signedIn(page);
  await page.goto('/whatsapp');

  await expect(page.getByRole('heading', { level: 1, name: 'WhatsApp connection' })).toBeVisible();
  const alert = page.getByRole('alert').filter({ hasText: 'WhatsApp disconnected' });
  await expect(alert).toContainText('3 running auctions are not receiving bids.');
  await expect(alert).toContainText('Reconnect so the bot goes back to recording the bids.');

  const table = page.getByRole('table', { name: 'Affected auctions' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByText('#0412')).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText(/00:12:\d\d/);
  await expect(table.getByRole('row').nth(1)).toContainText('54');
  await expect(table.getByRole('link', { name: 'Charizard ex 001/100' })).toHaveAttribute(
    'href',
    '/auctions/a-1',
  );
  await expect(
    page.getByText('Bids sent in the group during the outage may not have been recorded', {
      exact: false,
    }),
  ).toBeVisible();
});

test('says how to reconnect, and that the QR code does not show on this screen yet', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/whatsapp');

  const card = page.getByRole('region', { name: 'Read the QR code' });
  await expect(card.getByText('Disconnected')).toBeVisible();
  await expect(card.getByText("Open the store's WhatsApp.")).toBeVisible();
  await expect(card.getByText('Go to Linked devices.')).toBeVisible();
  await expect(card.getByText(/does not show on this screen yet/)).toBeVisible();
});

test('says when the connection is waiting for the QR code to be read', async ({ page }) => {
  await signedIn(page, { whatsapp: 'QR_READY' });
  await page.goto('/whatsapp');

  await expect(page.getByText('Waiting for the reading')).toBeVisible();
});

test('extends one auction by 30 minutes', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/whatsapp');

  await page
    .getByRole('table', { name: 'Affected auctions' })
    .getByRole('row')
    .nth(2)
    .getByRole('button', { name: '+30 min' })
    .click();

  await expect(page.getByText('The end was pushed 30 minutes later.')).toBeVisible();
  expect(calls.extendedOne).toEqual([{ id: 'a-2', minutes: 30 }]);
});

test('extends all the running auctions at once', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/whatsapp');

  await page.getByRole('button', { name: 'Extend all by 30 min' }).click();

  await expect(page.getByText('The end was pushed 30 minutes later.')).toBeVisible();
  expect(calls.extendedAll).toEqual([30]);
});

test('shows the error of the API translated when it cannot extend', async ({ page }) => {
  await signedIn(page, { extendStatus: 409 });
  await page.goto('/whatsapp');

  await page
    .getByRole('table', { name: 'Affected auctions' })
    .getByRole('row')
    .nth(1)
    .getByRole('button', { name: '+30 min' })
    .click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'This auction is not running.' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('says the WhatsApp is connected, with nothing affected, when it is online', async ({
  page,
}) => {
  await signedIn(page, { whatsapp: 'ONLINE' });
  await page.goto('/whatsapp');

  await expect(page.getByText('WhatsApp connected', { exact: true })).toBeVisible();
  await expect(page.getByText('No running auction is affected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extend all by 30 min' })).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: 'WhatsApp disconnected' })).toHaveCount(0);
});

test('warns on the Home when the WhatsApp is down, with the way to reconnect', async ({ page }) => {
  await signedIn(page);
  await page.goto('/home');

  const alert = page.getByRole('alert').filter({ hasText: 'WhatsApp disconnected' });
  await expect(alert).toContainText('3 running auctions are not receiving bids.');
  await expect(alert.getByRole('link', { name: 'Reconnect now' })).toHaveAttribute(
    'href',
    '/whatsapp',
  );
});

test('shows no warning on the Home while the WhatsApp is online', async ({ page }) => {
  await signedIn(page, { whatsapp: 'ONLINE' });
  await page.goto('/home');

  await expect(page.getByText('Active auctions now')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'WhatsApp disconnected' })).toHaveCount(0);
});

test('does not open for staff without the permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/whatsapp');

  await expect(page.getByRole('table')).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/whatsapp');
  await expect(page.getByRole('table', { name: 'Affected auctions' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
