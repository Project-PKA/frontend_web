import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const NOW = new Date('2030-03-11T01:47:20.000Z');
const END = '2030-03-11T02:00:00.000Z';

type Status = 'PENDING' | 'ACTIVE' | 'PAUSED_FOR_VALIDATION' | 'FINISHED' | 'CANCELLED';

function bid(id: string, amount: string, at: string, customer = 'u-2', phone = '(21) *****-4455') {
  return {
    id,
    amount,
    created_at: at,
    customer: { id: customer, name: 'Someone', phone_masked: phone },
  };
}

const BIDS = [
  bid('b3', '820.00', '2030-03-11T00:42:10.000Z', 'u-1', '(11) *****-1020'),
  bid('b2', '800.00', '2030-03-11T00:41:55.000Z'),
  bid('b1', '750.00', '2030-03-11T00:40:02.000Z', 'u-3', '(31) *****-7731'),
];

function auction(status: Status, extra: object = {}) {
  return {
    id: 'a-1',
    card: {
      id: 'card-1',
      short_code: '0412',
      language: 'EN',
      condition: 'NM',
      catalog: {
        id: 'cat-1',
        name: 'Charizard ex',
        names: {},
        number: '199/165',
        set_id: null,
        set_name: '151',
        image_url: null,
        image_high_url: null,
        rarity: null,
      },
    },
    type: 'FREE_BID',
    status,
    start_time: '2030-03-10T23:00:00.000Z',
    end_time: END,
    initial_bid: '20.00',
    min_increment: '5.00',
    max_poll_value: null,
    ceiling_alert: false,
    current_bid: '820.00',
    bid_count: 54,
    leader: null,
    winning_bid_id: null,
    created_at: '2030-03-01T12:00:00.000Z',
    ...extra,
  };
}

interface State {
  auction: ReturnType<typeof auction>;
  bids: ReturnType<typeof bid>[];
}

interface Calls {
  extended: number[];
  rooms: number;
}

async function signedIn(
  page: Page,
  state: State,
  options: {
    role?: 'OWNER' | 'STAFF';
    permissions?: Record<string, boolean>;
    extendAnswer?: object;
  } = {},
): Promise<Calls> {
  const calls: Calls = { extended: [], rooms: 0 };

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
  await page.route(/\/v1\/cards\/[^/]+\/photos\/[^/]+$/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(/\/v1\/cards\/card-1$/, (route) =>
    route.fulfill({
      status: 200,
      json: {
        card: {
          id: 'card-1',
          short_code: '0412',
          catalog: state.auction.card.catalog,
          language: 'EN',
          condition: 'NM',
          is_foil: false,
          photos: ['11111111-1111-4111-8111-111111111111.png'],
          notes: null,
          origin: 'OWN',
          consignor: null,
          commission_pct: null,
          status: 'SCHEDULED',
          created_at: '2030-03-01T12:00:00.000Z',
          updated_at: '2030-03-01T12:00:00.000Z',
        },
        auctions: [],
      },
    }),
  );
  await page.route(/\/v1\/auctions\/[^/?]+\/extend$/, (route) => {
    const body = route.request().postDataJSON() as { minutes: number };
    calls.extended.push(body.minutes);
    if (options.extendAnswer) {
      return route.fulfill(options.extendAnswer as Parameters<typeof route.fulfill>[0]);
    }
    return route.fulfill({ status: 200, json: { extended: ['a-1'] } });
  });
  await page.route(/\/v1\/auctions\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop();
    if (id !== 'a-1') {
      return route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Not found', status: 404, code: 'AUCTION_NOT_FOUND' },
      });
    }
    calls.rooms += 1;
    return route.fulfill({ status: 200, json: { auction: state.auction, bids: state.bids } });
  });
  return calls;
}

test('shows the running auction: the highest bid, how many bids and the bids as they came', async ({
  page,
}) => {
  await page.clock.install({ time: NOW });
  await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.goto('/auctions/a-1');

  await expect(page.getByRole('heading', { level: 1, name: 'Auction' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Charizard ex 199/165' })).toBeVisible();
  const card = page.getByRole('region', { name: 'Card' });
  await expect(card.getByText('In progress')).toBeVisible();
  await expect(card.getByText('Free bid')).toBeVisible();
  await expect(card.getByText(/R\$\s?820\.00/).first()).toBeVisible();
  await expect(card.getByText(/54 bids/)).toBeVisible();
  await expect(card.getByText('151 · 199/165')).toBeVisible();
  await expect(card.getByText('Own', { exact: true })).toBeVisible();

  const bids = page.getByRole('list', { name: 'Bids received from WhatsApp' });
  await expect(bids.getByRole('listitem')).toHaveCount(3);
  await expect(bids.getByRole('listitem').first()).toContainText('9:42:10 PM');
  await expect(bids.getByRole('listitem').first()).toContainText('(11) *****-1020');
  await expect(bids.getByRole('listitem').first()).toContainText('820.00');
  await expect(page.getByText('Time, phone and amount · updates automatically')).toBeVisible();
});

test('counts down to the end, second by second', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.goto('/auctions/a-1');
  await expect(page.getByRole('timer')).toHaveText(/^Ends in 00:12:\d\d$/);
  const seconds = async () => {
    const text = (await page.getByRole('timer').textContent()) ?? '';
    return Number(text.slice(-2));
  };
  const before = await seconds();

  await page.clock.runFor(10_000);

  // The clock keeps running by itself too, so it is at least 10 seconds less, not exactly.
  await expect.poll(async () => before - (await seconds())).toBeGreaterThanOrEqual(10);
});

test('asks again by itself and shows the new bid when it arrives', async ({ page }) => {
  await page.clock.install({ time: NOW });
  const state: State = { auction: auction('ACTIVE'), bids: BIDS };
  await signedIn(page, state);
  await page.goto('/auctions/a-1');
  await expect(page.getByRole('listitem')).toHaveCount(3);

  state.auction = auction('ACTIVE', { current_bid: '900.00', bid_count: 55 });
  state.bids = [bid('b4', '900.00', '2030-03-11T01:47:30.000Z', 'u-9', '(41) *****-9999'), ...BIDS];
  await page.clock.runFor(6_000);

  await expect(page.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByRole('listitem').first()).toContainText('(41) *****-9999');
  await expect(
    page
      .getByRole('region', { name: 'Card' })
      .getByText(/R\$\s?900\.00/)
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/55 bids/)).toBeVisible();
});

test('extends the end by the minutes chosen and says so', async ({ page }) => {
  await page.clock.install({ time: NOW });
  const calls = await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.goto('/auctions/a-1');

  await page.getByRole('button', { name: '+30 min' }).click();

  await expect(page.getByText('The end was pushed 30 minutes later.')).toBeVisible();
  expect(calls.extended).toEqual([30]);
});

test('shows the error of the API translated when it cannot extend', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await signedIn(
    page,
    { auction: auction('ACTIVE'), bids: BIDS },
    {
      extendAnswer: {
        status: 409,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Error',
          status: 409,
          code: 'AUCTION_NOT_LIVE',
          detail: 'mensagem em português',
        },
      },
    },
  );
  await page.goto('/auctions/a-1');

  await page.getByRole('button', { name: '+1 h' }).click();

  await expect(
    page.getByRole('alert').filter({ hasText: 'This auction is not running.' }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('shows who won, with a link to the customer, and nothing more to do', async ({ page }) => {
  await signedIn(page, {
    auction: auction('FINISHED', {
      current_bid: '340.00',
      bid_count: 12,
      leader: { id: 'u-1', name: 'Rafael M.' },
      winning_bid_id: 'b3',
    }),
    bids: BIDS,
  });
  await page.goto('/auctions/a-1');

  await expect(page.getByText('Winner:')).toBeVisible();
  const winner = page.getByRole('link', { name: /Rafael M\./ });
  await expect(winner).toHaveAttribute('href', '/customers/u-1');
  await expect(winner).toContainText('(11) *****-1020');
  await expect(page.getByText(/R\$\s?340\.00/)).toBeVisible();
  await expect(page.getByText(/12 bids/)).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+30 min' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit auction' })).toHaveCount(0);
  await expect(page.getByText('Time, phone and amount', { exact: true })).toBeVisible();
});

test('says when a finished auction had no winner', async ({ page }) => {
  await signedIn(page, {
    auction: auction('FINISHED', { current_bid: null, bid_count: 0 }),
    bids: [],
  });
  await page.goto('/auctions/a-1');

  await expect(page.getByText('No winner')).toBeVisible();
  await expect(
    page.getByText('No bids yet. They show up here as they arrive in the group.'),
  ).toBeVisible();
});

test('shows a scheduled auction with its start and a way to edit it, but nothing to extend', async ({
  page,
}) => {
  await signedIn(page, {
    auction: auction('PENDING', { current_bid: null, bid_count: 0 }),
    bids: [],
  });
  await page.goto('/auctions/a-1');

  await expect(page.getByText(/Starts 3\/10\/30, 8:00 PM/)).toBeVisible();
  await expect(page.getByText('No bids yet', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit auction' })).toHaveAttribute(
    'href',
    '/auctions/a-1/edit',
  );
  await expect(page.getByRole('button', { name: '+30 min' })).toHaveCount(0);
});

test('shows a poll that waits for validation and its ceiling', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await signedIn(page, {
    auction: auction('PAUSED_FOR_VALIDATION', {
      type: 'POLL',
      max_poll_value: '820.00',
      ceiling_alert: true,
    }),
    bids: BIDS,
  });
  await page.goto('/auctions/a-1');

  await expect(
    page.getByRole('region', { name: 'Card' }).getByText('Awaiting validation'),
  ).toBeVisible();
  await expect(page.getByText('Poll', { exact: true })).toBeVisible();
  await expect(page.getByText('Poll ceiling', { exact: true })).toBeVisible();
});

test('shows the real photo of the card', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.goto('/auctions/a-1');

  await expect(page.getByRole('img', { name: 'Real photo of Charizard ex 199/165' })).toBeVisible();
});

test('stops asking once the auction is over', async ({ page }) => {
  await page.clock.install({ time: NOW });
  const calls = await signedIn(page, { auction: auction('FINISHED', { leader: null }), bids: [] });
  await page.goto('/auctions/a-1');
  await expect(page.getByText('No winner')).toBeVisible();
  const before = calls.rooms;

  await page.clock.runFor(60_000);

  expect(calls.rooms).toBe(before);
});

test('says so when the auction does not exist', async ({ page }) => {
  await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.goto('/auctions/nope');

  await expect(page.getByText('We could not open this auction')).toBeVisible();
});

test('does not open for staff without the permission', async ({ page }) => {
  await signedIn(
    page,
    { auction: auction('ACTIVE'), bids: BIDS },
    { role: 'STAFF', permissions: {} },
  );
  await page.goto('/auctions/a-1');

  await expect(page.getByRole('heading', { level: 2, name: 'Charizard ex 199/165' })).toHaveCount(
    0,
  );
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.clock.install({ time: NOW });
  await signedIn(page, { auction: auction('ACTIVE'), bids: BIDS });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/auctions/a-1');
  await expect(page.getByRole('heading', { level: 2, name: 'Charizard ex 199/165' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
