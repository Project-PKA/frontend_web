import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

function poll(id: string, code: string, name: string, extra: object = {}) {
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
    type: 'POLL',
    status: 'PAUSED_FOR_VALIDATION',
    start_time: '2030-03-10T23:00:00.000Z',
    end_time: '2030-03-11T02:00:00.000Z',
    initial_bid: '20.00',
    min_increment: '5.00',
    max_poll_value: '800.00',
    ceiling_alert: true,
    current_bid: '820.00',
    bid_count: 2,
    leader: { id: 'u-1', name: 'Rafael M.' },
    winning_bid_id: null,
    created_at: '2030-03-01T12:00:00.000Z',
    ...extra,
  };
}

const POLLS = [
  poll('p-1', '0412', 'Charizard ex'),
  poll('p-2', '0431', 'Pikachu VMAX', {
    max_poll_value: '450.00',
    current_bid: '465.00',
    leader: { id: 'u-2', name: 'Camila T.' },
  }),
];

function bidsOf(id: string) {
  return id === 'p-1'
    ? [
        {
          id: 'b2',
          amount: '820.00',
          created_at: '2030-03-11T00:42:10.000Z',
          customer: { id: 'u-1', name: 'Rafael M.', phone_masked: '(11) *****-1020' },
        },
        {
          id: 'b1',
          amount: '800.00',
          created_at: '2030-03-11T00:41:55.000Z',
          customer: { id: 'u-5', name: 'Bruno A.', phone_masked: '(21) *****-4455' },
        },
      ]
    : [
        {
          id: 'b4',
          amount: '465.00',
          created_at: '2030-03-11T00:30:44.000Z',
          customer: { id: 'u-2', name: 'Camila T.', phone_masked: '(21) *****-4455' },
        },
      ];
}

interface Options {
  polls?: ReturnType<typeof poll>[];
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  resolveAnswer?: object;
}

interface Calls {
  decisions: { id: string; decision: string }[];
}

async function signedIn(page: Page, options: Options = {}): Promise<Calls> {
  const calls: Calls = { decisions: [] };
  let pending = [...(options.polls ?? POLLS)];

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
    route.fulfill({ status: 404, json: {} }),
  );
  await page.route(/\/v1\/cards\/card-[^/]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    const found = pending.find((item) => item.card.id === id) ?? POLLS[0]!;
    return route.fulfill({
      status: 200,
      json: {
        card: {
          id,
          short_code: found.card.short_code,
          catalog: found.card.catalog,
          language: 'EN',
          condition: 'NM',
          is_foil: false,
          photos: [],
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
    });
  });
  await page.route(/\/v1\/auctions\/[^/?]+\/resolve$/, (route) => {
    const id = route.request().url().split('/').at(-2) ?? '';
    const { decision } = route.request().postDataJSON() as { decision: string };
    calls.decisions.push({ id, decision });
    if (options.resolveAnswer) {
      return route.fulfill(options.resolveAnswer as Parameters<typeof route.fulfill>[0]);
    }
    pending = pending.filter((item) => item.id !== id);
    return route.fulfill({ status: 200, json: poll(id, '0412', 'Charizard ex') });
  });
  await page.route(/\/v1\/auctions\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    const found = pending.find((item) => item.id === id);
    if (!found) return route.fulfill({ status: 404, json: { code: 'AUCTION_NOT_FOUND' } });
    return route.fulfill({ status: 200, json: { auction: found, bids: bidsOf(id) } });
  });
  await page.route(/\/v1\/auctions(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, json: { items: pending, next_cursor: null } }),
  );
  return calls;
}

test('lists the polls that reached their ceiling, with who is ahead and the last bids', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/auctions/polls');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Polls waiting for validation' }),
  ).toBeVisible();
  await expect(page.getByText('2 pending')).toBeVisible();
  await expect(page.getByText(/reached the maximum value set/)).toBeVisible();

  const first = page.getByRole('article', { name: 'Charizard ex 001/100' });
  await expect(first.getByText('#0412')).toBeVisible();
  await expect(first.getByText('Maximum value')).toBeVisible();
  await expect(first.getByText(/R\$\s?800\.00/).first()).toBeVisible();
  await expect(first.getByText(/R\$\s?820\.00/).first()).toBeVisible();
  const winner = first.getByRole('link', { name: /Rafael M\./ });
  await expect(winner).toHaveAttribute('href', '/customers/u-1');
  await expect(winner).toContainText('(11) *****-1020');
  await expect(first.getByRole('listitem')).toHaveCount(2);
  await expect(first.getByRole('button', { name: 'Keep open' })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Approve closing' })).toBeVisible();
});

test('keeps a poll open at once and the card leaves the list', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/polls');

  await page
    .getByRole('article', { name: 'Charizard ex 001/100' })
    .getByRole('button', { name: 'Keep open' })
    .click();

  await expect(page.getByText('The auction of Charizard ex 001/100 stays open.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Charizard ex 001/100' })).toHaveCount(0);
  await expect(page.getByText('One pending')).toBeVisible();
  expect(calls.decisions).toEqual([{ id: 'p-1', decision: 'KEEP_OPEN' }]);
});

test('asks before approving the closing, naming who will be announced as the winner', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/polls');

  await page
    .getByRole('article', { name: 'Pikachu VMAX 001/100' })
    .getByRole('button', { name: 'Approve closing' })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Approve the closing?' });
  await expect(
    dialog.getByText(
      /Pikachu VMAX 001\/100 closes now and Camila T\. · \(21\) \*\*\*\*\*-4455 is announced/,
    ),
  ).toBeVisible();
  expect(calls.decisions).toEqual([]);

  await dialog.getByRole('button', { name: 'Not yet' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls.decisions).toEqual([]);
});

test('approves the closing after the person confirms', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/polls');

  await page
    .getByRole('article', { name: 'Pikachu VMAX 001/100' })
    .getByRole('button', { name: 'Approve closing' })
    .click();
  await page
    .getByRole('dialog', { name: 'Approve the closing?' })
    .getByRole('button', { name: 'Approve closing' })
    .click();

  await expect(page.getByText('Closing of Pikachu VMAX 001/100 approved.')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Pikachu VMAX 001/100' })).toHaveCount(0);
  expect(calls.decisions).toEqual([{ id: 'p-2', decision: 'APPROVE' }]);
});

test('shows the error of the API translated and keeps the confirmation open', async ({ page }) => {
  await signedIn(page, {
    resolveAnswer: {
      status: 409,
      contentType: 'application/problem+json',
      json: {
        type: 'about:blank',
        title: 'Error',
        status: 409,
        code: 'AUCTION_NOT_PAUSED',
        detail: 'mensagem em português',
      },
    },
  });
  await page.goto('/auctions/polls');
  await page
    .getByRole('article', { name: 'Charizard ex 001/100' })
    .getByRole('button', { name: 'Approve closing' })
    .click();

  await page
    .getByRole('dialog', { name: 'Approve the closing?' })
    .getByRole('button', { name: 'Approve closing' })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Approve the closing?' });
  await expect(dialog.getByRole('alert')).toContainText(
    'This auction is not waiting for approval.',
  );
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('says so when no poll is waiting', async ({ page }) => {
  await signedIn(page, { polls: [] });
  await page.goto('/auctions/polls');

  await expect(page.getByText('No poll is waiting for you')).toBeVisible();
});

test('lets the store decide from the room of the auction too', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/p-1');

  await expect(page.getByText('This poll reached its maximum value')).toBeVisible();
  await page.getByRole('button', { name: 'Keep open' }).click();

  await expect(page.getByText('The auction of Charizard ex 001/100 stays open.')).toBeVisible();
  expect(calls.decisions).toEqual([{ id: 'p-1', decision: 'KEEP_OPEN' }]);
});

test('does not open for staff without the permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/auctions/polls');

  await expect(page.getByRole('button', { name: 'Approve closing' })).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, also with the confirmation open', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/auctions/polls');
  const first = page.getByRole('article', { name: 'Charizard ex 001/100' });
  await expect(first).toBeVisible();
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);

  await first.getByRole('button', { name: 'Approve closing' }).click();
  await expect(page.getByRole('dialog', { name: 'Approve the closing?' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
