import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

type Status = 'PENDING' | 'ACTIVE' | 'PAUSED_FOR_VALIDATION' | 'FINISHED' | 'CANCELLED';

function auction(id: string, code: string, name: string, status: Status, extra: object = {}) {
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
    status,
    start_time: '2030-03-10T23:00:00.000Z',
    end_time: '2030-03-11T02:00:00.000Z',
    initial_bid: '20.00',
    min_increment: '5.00',
    max_poll_value: null,
    ceiling_alert: false,
    current_bid: null,
    bid_count: 0,
    leader: null,
    winning_bid_id: null,
    created_at: '2030-03-01T12:00:00.000Z',
    ...extra,
  };
}

const AUCTIONS: Record<Status, ReturnType<typeof auction>[]> = {
  ACTIVE: [
    auction('a-1', '0412', 'Charizard ex', 'ACTIVE', { current_bid: '820.00', bid_count: 54 }),
    auction('a-2', '0431', 'Pikachu VMAX', 'ACTIVE', {
      type: 'POLL',
      max_poll_value: '500.00',
      current_bid: '465.00',
      bid_count: 41,
    }),
  ],
  PAUSED_FOR_VALIDATION: [
    auction('a-9', '0500', 'Mewtwo V', 'PAUSED_FOR_VALIDATION', {
      type: 'POLL',
      max_poll_value: '300.00',
      current_bid: '300.00',
      bid_count: 12,
      ceiling_alert: true,
    }),
  ],
  PENDING: [auction('a-3', '0452', 'Umbreon V Alt Art', 'PENDING')],
  FINISHED: [
    auction('a-4', '0377', 'Lugia V Alt Art', 'FINISHED', {
      current_bid: '340.00',
      bid_count: 9,
      leader: { id: 'u-1', name: 'Rafael M.' },
      winning_bid_id: 'b-1',
    }),
    auction('a-5', '0366', 'Gardevoir ex', 'FINISHED'),
  ],
  CANCELLED: [auction('a-6', '0301', 'Mew ex', 'CANCELLED')],
};

interface Options {
  permissions?: Record<string, boolean>;
  role?: 'OWNER' | 'STAFF';
  auctions?: Partial<Record<Status, ReturnType<typeof auction>[]>>;
  createAnswer?: object;
  updateAnswer?: object;
}

interface Calls {
  created: Record<string, unknown>[];
  updated: { id: string; body: Record<string, unknown> }[];
  cancelled: string[];
}

async function signedIn(page: Page, options: Options = {}): Promise<Calls> {
  const calls: Calls = { created: [], updated: [], cancelled: [] };
  const data = { ...AUCTIONS, ...options.auctions };

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
  await page.route(/\/v1\/cards(\?.*)?$/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')?.toLowerCase() ?? '';
    const cards = [
      { id: 'card-new', short_code: 'A9', name: 'Gengar VMAX', condition: 'NM' },
      { id: 'card-new-2', short_code: 'A10', name: 'Gengar V', condition: 'SP' },
    ].filter((card) => card.name.toLowerCase().includes(q) || card.short_code.toLowerCase() === q);
    return route.fulfill({
      status: 200,
      json: {
        items: cards.map((card) => ({
          id: card.id,
          short_code: card.short_code,
          catalog: {
            id: `cat-${card.id}`,
            name: card.name,
            names: {},
            number: '001/100',
            set_id: null,
            set_name: 'Fusion Strike',
            image_url: null,
            image_high_url: null,
            rarity: null,
          },
          language: 'EN',
          condition: card.condition,
          is_foil: false,
          photos: [],
          notes: null,
          origin: 'OWN',
          consignor: null,
          commission_pct: null,
          status: 'AVAILABLE',
          created_at: '2030-03-01T12:00:00.000Z',
          updated_at: '2030-03-01T12:00:00.000Z',
        })),
        next_cursor: null,
      },
    });
  });
  await page.route(/\/v1\/auctions\/[^/?]+\/cancel$/, (route) => {
    calls.cancelled.push(route.request().url().split('/').at(-2) ?? '');
    return route.fulfill({
      status: 200,
      json: auction('a-3', '0452', 'Umbreon V Alt Art', 'CANCELLED'),
    });
  });
  await page.route(/\/v1\/auctions\/[^/?]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    if (route.request().method() === 'PATCH') {
      calls.updated.push({ id, body: route.request().postDataJSON() as Record<string, unknown> });
      return route.fulfill(
        (options.updateAnswer as Parameters<typeof route.fulfill>[0]) ?? {
          status: 200,
          json: auction(id, '0452', 'Umbreon V Alt Art', 'PENDING'),
        },
      );
    }
    const found = Object.values(data)
      .flat()
      .find((item) => item.id === id);
    if (!found) {
      return route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Not found', status: 404, code: 'AUCTION_NOT_FOUND' },
      });
    }
    return route.fulfill({ status: 200, json: { auction: found, bids: [] } });
  });
  await page.route(/\/v1\/auctions(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      calls.created.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill(
        (options.createAnswer as Parameters<typeof route.fulfill>[0]) ?? {
          status: 201,
          json: auction('a-new', 'A9', 'Gengar VMAX', 'PENDING'),
        },
      );
    }
    const status = new URL(route.request().url()).searchParams.get('status') as Status;
    return route.fulfill({ status: 200, json: { items: data[status] ?? [], next_cursor: null } });
  });
  return calls;
}

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'New auction' });

async function openNew(page: Page) {
  await page.goto('/auctions');
  await page.getByRole('button', { name: 'New auction' }).click();
  await expect(dialog(page)).toBeVisible();
}

async function pickCard(page: Page) {
  await dialog(page).getByRole('combobox', { name: 'Available card in stock' }).fill('gengar');
  await page.getByRole('option', { name: /Gengar VMAX/ }).click();
}

test('lists the auctions in progress, the ones waiting for validation first', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions');

  await expect(page.getByRole('heading', { level: 1, name: 'Auctions' })).toBeVisible();
  const table = page.getByRole('table', { name: 'In progress' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('row').nth(1)).toContainText('Mewtwo V');
  await expect(table.getByRole('row').nth(1)).toContainText('Awaiting validation');
  await expect(table.getByRole('link', { name: 'Charizard ex 001/100' })).toHaveAttribute(
    'href',
    '/auctions/a-1',
  );
  await expect(table.getByText('#0412')).toBeVisible();
  await expect(table.getByText(/R\$\s?820\.00/)).toBeVisible();
  await expect(table.getByText('54')).toBeVisible();
  await expect(table.getByText('Poll').first()).toBeVisible();
});

test('lists the scheduled auctions with their dates and a way to edit', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions');

  await page.getByRole('tab', { name: 'Scheduled' }).click();

  const table = page.getByRole('table', { name: 'Scheduled' });
  await expect(table.getByText('Umbreon V Alt Art 001/100')).toBeVisible();
  await expect(table.getByText(/3\/10\/30, 8:00 PM/)).toBeVisible();
  await expect(table.getByRole('link', { name: 'Edit' })).toHaveAttribute(
    'href',
    '/auctions/a-3/edit',
  );
});

test('lists the finished auctions with what was raised and the winner', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions');

  await page.getByRole('tab', { name: 'Finished' }).click();

  const table = page.getByRole('table', { name: 'Finished' });
  await expect(table.getByText('Rafael M.')).toBeVisible();
  await expect(table.getByText(/R\$\s?340\.00/)).toBeVisible();
  await expect(table.getByText('No winner')).toBeVisible();
});

test('lists the cancelled auctions', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions');

  await page.getByRole('tab', { name: 'Cancelled' }).click();

  await expect(
    page.getByRole('table', { name: 'Cancelled' }).getByText('Mew ex 001/100'),
  ).toBeVisible();
});

test('says so when a tab has no auction', async ({ page }) => {
  await signedIn(page, { auctions: { PENDING: [] } });
  await page.goto('/auctions');

  await page.getByRole('tab', { name: 'Scheduled' }).click();

  await expect(page.getByText('No scheduled auction')).toBeVisible();
});

test('schedules an auction: the dates are read in the zone of the profile', async ({ page }) => {
  const calls = await signedIn(page);
  await openNew(page);
  await expect(dialog(page).getByRole('button', { name: 'Schedule auction' })).toBeVisible();

  await pickCard(page);
  await dialog(page)
    .getByLabel(/^Start/)
    .fill('2030-03-10T20:00');
  await dialog(page).getByLabel('End').fill('2030-03-10T23:00');
  await dialog(page).getByLabel('Opening bid (R$)').fill('25,50');
  await dialog(page).getByRole('button', { name: 'Schedule auction' }).click();

  await expect(page.getByText('Auction of Gengar VMAX 001/100 scheduled.')).toBeVisible();
  await expect(dialog(page)).toBeHidden();
  expect(calls.created).toEqual([
    {
      card_id: 'card-new',
      type: 'FREE_BID',
      start_time: '2030-03-10T23:00:00.000Z',
      end_time: '2030-03-11T02:00:00.000Z',
      initial_bid: '25.50',
      min_increment: '5',
    },
  ]);
});

test('launches an auction now: it has no start, only an end', async ({ page }) => {
  const calls = await signedIn(page);
  await openNew(page);
  await pickCard(page);

  await dialog(page).getByRole('button', { name: 'Launch now' }).click();
  await expect(dialog(page).getByLabel(/^Start/)).toHaveCount(0);
  await dialog(page).getByLabel('End').fill('2030-03-10T23:00');
  await dialog(page).getByRole('button', { name: 'Launch auction' }).click();

  await expect(page.getByText('Auction of Gengar VMAX 001/100 launched.')).toBeVisible();
  expect(calls.created[0]).not.toHaveProperty('start_time');
  expect(calls.created[0]).toMatchObject({ end_time: '2030-03-11T02:00:00.000Z' });
});

test('a poll has a ceiling, sent as the text typed', async ({ page }) => {
  const calls = await signedIn(page);
  await openNew(page);
  await pickCard(page);
  await dialog(page)
    .getByLabel(/^Start/)
    .fill('2030-03-10T20:00');
  await dialog(page).getByLabel('End').fill('2030-03-10T23:00');

  await dialog(page).getByRole('button', { name: 'Poll' }).click();
  await expect(dialog(page).getByLabel('Poll ceiling (R$)')).toHaveValue('500');
  await dialog(page).getByRole('button', { name: 'Schedule auction' }).click();

  await expect(page.getByText('Auction of Gengar VMAX 001/100 scheduled.')).toBeVisible();
  expect(calls.created[0]).toMatchObject({ type: 'POLL', max_poll_value: '500' });
});

test('asks for the card and the dates and checks the values before calling the API', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await openNew(page);

  await dialog(page).getByRole('button', { name: 'Schedule auction' }).click();

  await expect(dialog(page).getByText('This field is required.').first()).toBeVisible();
  await pickCard(page);
  await dialog(page)
    .getByLabel(/^Start/)
    .fill('2030-03-10T20:00');
  await dialog(page).getByLabel('End').fill('2030-03-10T19:00');
  await dialog(page).getByRole('button', { name: 'Poll' }).click();
  await dialog(page).getByLabel('Poll ceiling (R$)').fill('10');
  await dialog(page).getByRole('button', { name: 'Schedule auction' }).click();

  await expect(dialog(page).getByText('The end must be after the start.')).toBeVisible();
  await expect(dialog(page).getByText('The ceiling must be above the opening bid.')).toBeVisible();
  expect(calls.created).toEqual([]);
});

test('does not accept an end in the past', async ({ page }) => {
  await signedIn(page);
  await openNew(page);
  await pickCard(page);

  await dialog(page).getByRole('button', { name: 'Launch now' }).click();
  await dialog(page).getByLabel('End').fill('2020-01-01T10:00');
  await dialog(page).getByRole('button', { name: 'Launch auction' }).click();

  await expect(dialog(page).getByText('The end must be in the future.')).toBeVisible();
});

test('shows the error of the API translated and keeps the form', async ({ page }) => {
  await signedIn(page, { createAnswer: problem(409, 'AUCTION_CARD_NOT_AVAILABLE') });
  await openNew(page);
  await pickCard(page);
  await dialog(page)
    .getByLabel(/^Start/)
    .fill('2030-03-10T20:00');
  await dialog(page).getByLabel('End').fill('2030-03-10T23:00');

  await dialog(page).getByRole('button', { name: 'Schedule auction' }).click();

  await expect(
    dialog(page)
      .getByRole('alert')
      .filter({ hasText: /available/i }),
  ).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByLabel('End')).toHaveValue('2030-03-10T23:00');
});

test('opens the form from the address the Home links to', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions/new');

  await expect(page).toHaveURL(/\/auctions\?new=1$/);
  await expect(dialog(page)).toBeVisible();
});

test('edits a scheduled auction: shows the dates in the zone of the profile and sends only what changed', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/a-3/edit');

  await expect(page.getByRole('heading', { level: 2, name: 'Edit auction' })).toBeVisible();
  await expect(page.getByLabel(/^Start/)).toHaveValue('2030-03-10T20:00');
  await expect(page.getByLabel('End')).toHaveValue('2030-03-10T23:00');
  await expect(page.getByLabel('Opening bid (R$)')).toHaveValue('20.00');

  await page.getByLabel('End').fill('2030-03-11T00:00');
  await page.getByLabel('Minimum increment (R$)').fill('10');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Auction saved.')).toBeVisible();
  await expect(page).toHaveURL(/\/auctions$/);
  expect(calls.updated).toEqual([
    { id: 'a-3', body: { end_time: '2030-03-11T03:00:00.000Z', min_increment: '10' } },
  ]);
});

test('says so and sends nothing when nothing changed', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/a-3/edit');
  await expect(page.getByLabel(/^Start/)).toHaveValue('2030-03-10T20:00');

  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Nothing was changed.')).toBeVisible();
  expect(calls.updated).toEqual([]);
});

test('lets only the end change in an auction that is already running', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/a-1/edit');

  await expect(
    page.getByText('This auction is already running: only its end can be changed.'),
  ).toBeVisible();
  await expect(page.getByLabel('Opening bid (R$)')).toBeDisabled();
  await expect(page.getByLabel(/^Start/)).toBeDisabled();
  await expect(page.getByLabel('End')).toBeEnabled();
  await page.getByLabel('End').fill('2030-03-11T01:00');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Auction saved.')).toBeVisible();
  expect(calls.updated).toEqual([{ id: 'a-1', body: { end_time: '2030-03-11T04:00:00.000Z' } }]);
});

test('shows a finished auction without a way to change it', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions/a-4/edit');

  await expect(page.getByText('This auction is over: it can no longer be changed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel auction' })).toHaveCount(0);
  await expect(page.getByLabel('End')).toBeDisabled();
});

test('cancels an auction after the person confirms', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/a-3/edit');

  await page.getByRole('button', { name: 'Cancel auction' }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancel this auction?' });
  await expect(
    confirm.getByText(/will be cancelled and the card goes back to the stock/),
  ).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel the auction' }).click();

  await expect(page.getByText('Auction cancelled.')).toBeVisible();
  await expect(page).toHaveURL(/\/auctions$/);
  expect(calls.cancelled).toEqual(['a-3']);
});

test('keeps the auction when the person does not confirm', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/auctions/a-3/edit');

  await page.getByRole('button', { name: 'Cancel auction' }).click();
  await page
    .getByRole('dialog', { name: 'Cancel this auction?' })
    .getByRole('button', { name: 'Keep the auction' })
    .click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls.cancelled).toEqual([]);
});

test('says so when the auction does not exist', async ({ page }) => {
  await signedIn(page);
  await page.goto('/auctions/nope/edit');

  await expect(page.getByText('We could not open this auction')).toBeVisible();
});

test('does not open the auctions for staff without the permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/auctions');

  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New auction' })).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, in the list, the form and the edit page', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

  await page.goto('/auctions');
  await expect(page.getByRole('table', { name: 'In progress' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'New auction' }).click();
  await expect(dialog(page)).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto('/auctions/a-3/edit');
  await expect(page.getByRole('heading', { level: 2, name: 'Edit auction' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
