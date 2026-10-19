import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

interface Card {
  id: string;
  short_code: string;
  name: string;
  number: string;
  set_name: string;
  language: string;
  condition: string;
  origin: 'OWN' | 'CONSIGNED';
  status: 'AVAILABLE' | 'SCHEDULED' | 'AWAITING_CONFIRMATION' | 'SOLD';
  photos: string[];
  notes: string | null;
}

function card(overrides: Partial<Card> & Pick<Card, 'id' | 'short_code' | 'name'>): Card {
  return {
    number: '001/100',
    set_name: '151',
    language: 'EN',
    condition: 'NM',
    origin: 'OWN',
    status: 'AVAILABLE',
    photos: [],
    notes: null,
    ...overrides,
  };
}

const CARDS: Card[] = [
  card({
    id: 'c-1',
    short_code: '0412',
    name: 'Charizard ex',
    number: '199/165',
    status: 'SCHEDULED',
    photos: ['11111111-1111-4111-8111-111111111111.png'],
    notes: 'Light mark on the lower edge.',
  }),
  card({
    id: 'c-2',
    short_code: '0431',
    name: 'Pikachu VMAX',
    set_name: 'Vivid Voltage',
    language: 'PT',
    condition: 'SP',
    origin: 'CONSIGNED',
    status: 'SCHEDULED',
  }),
  card({ id: 'c-3', short_code: '0440', name: 'Gengar VMAX', set_name: 'Fusion Strike' }),
  card({ id: 'c-4', short_code: '0301', name: 'Mew ex', status: 'SOLD', language: 'JP' }),
];

function toApi(item: Card) {
  return {
    id: item.id,
    short_code: item.short_code,
    catalog: {
      id: `cat-${item.id}`,
      name: item.name,
      names: {},
      number: item.number,
      set_id: null,
      set_name: item.set_name,
      image_url: null,
      image_high_url: null,
      rarity: null,
    },
    language: item.language,
    condition: item.condition,
    is_foil: false,
    photos: item.photos,
    notes: item.notes,
    origin: item.origin,
    consignor: item.origin === 'CONSIGNED' ? { id: 'u-1', name: 'Ana Souza' } : null,
    commission_pct: item.origin === 'CONSIGNED' ? '10.00' : null,
    status: item.status,
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
  };
}

interface Options {
  cards?: Card[];
  permissions?: Record<string, boolean>;
  role?: 'OWNER' | 'STAFF';
  listStatus?: number;
}

interface Mocks {
  listQueries: URLSearchParams[];
  deleted: string[];
}

async function signedIn(page: Page, options: Options = {}): Promise<Mocks> {
  const mocks: Mocks = { listQueries: [], deleted: [] };
  const cards = options.cards ?? CARDS;
  const permissions = options.permissions ?? { can_manage_inventory: true, can_delete: true };

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
        permissions,
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
    const url = new URL(route.request().url());
    mocks.listQueries.push(url.searchParams);
    if (options.listStatus) {
      return route.fulfill({
        status: options.listStatus,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Error', status: options.listStatus },
      });
    }
    const q = url.searchParams.get('q')?.toLowerCase();
    const status = url.searchParams.get('status');
    const origin = url.searchParams.get('origin');
    const matching = cards.filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q) || item.short_code.includes(q)) &&
        (!status || item.status === status) &&
        (!origin || item.origin === origin),
    );
    const cursor = url.searchParams.get('cursor');
    // Two pages when there are more than 3 cards: the first one has 3.
    const page1 = matching.slice(0, 3);
    const rest = matching.slice(3);
    return route.fulfill({
      status: 200,
      json:
        cursor === null
          ? { items: page1.map(toApi), next_cursor: rest.length > 0 ? 'page-2' : null }
          : { items: rest.map(toApi), next_cursor: null },
    });
  });
  await page.route(/\/v1\/cards\/[^/]+\/photos\/[^/]+$/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PHOTO }),
  );
  await page.route(/\/v1\/cards\/[^/]+$/, (route) => {
    const id = route.request().url().split('/').pop() ?? '';
    if (route.request().method() === 'DELETE') {
      mocks.deleted.push(id);
      return route.fulfill({ status: 204 });
    }
    const found = cards.find((item) => item.id === id);
    if (!found) {
      return route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Not found', status: 404, code: 'CARD_NOT_FOUND' },
      });
    }
    const auctions =
      found.status === 'AVAILABLE'
        ? []
        : [
            {
              id: 'a-1',
              type: 'FREE_BID',
              status: 'ACTIVE',
              start_time: '2026-10-18T12:00:00Z',
              end_time: '2026-10-19T12:00:00Z',
              initial_bid: '100.00',
              winning_amount: null,
            },
            {
              id: 'a-0',
              type: 'POLL',
              status: 'FINISHED',
              start_time: '2026-10-03T12:00:00Z',
              end_time: '2026-10-04T12:00:00Z',
              initial_bid: '50.00',
              winning_amount: '610.00',
            },
          ];
    return route.fulfill({ status: 200, json: { card: toApi(found), auctions } });
  });
  return mocks;
}

test('lists the stock with the #ID, the card, its look and its status', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory');

  await expect(page.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Cards in stock' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('link', { name: 'Charizard ex 199/165' })).toHaveAttribute(
    'href',
    '/inventory/c-1',
  );
  await expect(table.getByText('Vivid Voltage')).toBeVisible();
  await expect(table.getByText('Consigned')).toBeVisible();
  await expect(table.getByText('Scheduled in an auction').first()).toBeVisible();
  await expect(table.getByText('Available')).toBeVisible();
  await expect(table.locator('abbr[title="Slightly Played"]')).toHaveText('SP');
});

test('filters by status and keeps the filter in the address', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/inventory');

  await page.getByLabel('Status').selectOption('SOLD');

  const table = page.getByRole('table', { name: 'Cards in stock' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('Mew ex')).toBeVisible();
  await expect(page).toHaveURL(/\/inventory\?status=SOLD$/);
  expect(mocks.listQueries.at(-1)?.get('status')).toBe('SOLD');
});

test('searches by name after the person stops typing', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/inventory');

  await page.getByRole('searchbox', { name: 'Search by #ID or name' }).fill('gengar');

  const table = page.getByRole('table', { name: 'Cards in stock' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('Gengar VMAX')).toBeVisible();
  expect(mocks.listQueries.at(-1)?.get('q')).toBe('gengar');
  await expect(page).toHaveURL(/q=gengar/);
});

test('opens with the filters of the address', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory?origin=CONSIGNED');

  await expect(page.getByLabel('Origin')).toHaveValue('CONSIGNED');
  const table = page.getByRole('table', { name: 'Cards in stock' });
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table.getByText('Pikachu VMAX')).toBeVisible();
});

test('ignores values in the address that the API does not know', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/inventory?status=LOST');

  await expect(page.getByRole('table', { name: 'Cards in stock' })).toBeVisible();
  expect(mocks.listQueries[0]?.has('status')).toBe(false);
});

test('shows the empty state of a new stock, with a way to register the first card', async ({
  page,
}) => {
  await signedIn(page, { cards: [] });
  await page.goto('/inventory');

  await expect(page.getByText('Your stock is still empty')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register card' }).last()).toHaveAttribute(
    'href',
    '/inventory/new',
  );
});

test('tells when the filters match nothing and clears them', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory');

  await page.getByRole('searchbox', { name: 'Search by #ID or name' }).fill('zzz');
  await expect(page.getByText('No card matches')).toBeVisible();
  await page.getByRole('button', { name: 'Clear the filters' }).click();

  await expect(page.getByRole('table', { name: 'Cards in stock' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search by #ID or name' })).toHaveValue('');
});

test('copies the #ID and says so', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signedIn(page);
  await page.goto('/inventory');

  await page.getByRole('button', { name: 'Copy #0412' }).click();

  await expect(page.getByText('#0412 copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#0412');
});

test('shows more cards by cursor', async ({ page }) => {
  const many = [...CARDS, card({ id: 'c-5', short_code: '0500', name: 'Eevee Promo' })];
  await signedIn(page, { cards: many });
  await page.goto('/inventory');
  const table = page.getByRole('table', { name: 'Cards in stock' });
  await expect(table.getByRole('row')).toHaveCount(4);

  await page.getByRole('button', { name: 'Show more' }).click();

  await expect(table.getByRole('row')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

test('shows an error with a way to try again when the stock does not load', async ({ page }) => {
  await signedIn(page, { listStatus: 500 });
  await page.goto('/inventory');

  await expect(page.getByText('We could not load the stock')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('opens a card: its data, its real photo, its notes and its auctions', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory');

  await page.getByRole('link', { name: 'Charizard ex 199/165' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Charizard ex 199/165' })).toBeVisible();
  const data = page.getByRole('region', { name: 'Card data' });
  await expect(data.getByText('151', { exact: true })).toBeVisible();
  await expect(data.getByText('English')).toBeVisible();
  await expect(data.getByText('Near Mint')).toBeVisible();
  await expect(data.getByText('Light mark on the lower edge.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Photo 1 of Charizard ex 199/165' })).toBeVisible();

  const history = page.getByRole('table', { name: 'Auction history' });
  await expect(history.getByText('In progress')).toBeVisible();
  await expect(history.getByText('Sold', { exact: true })).toBeVisible();
  await expect(history.getByText('Free bid')).toBeVisible();
  await expect(history.getByText('Poll')).toBeVisible();
  await expect(history.getByText(/R\$\s?610\.00/)).toBeVisible();
});

test('shows the consignor and the commission of a consigned card', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/c-2');

  const data = page.getByRole('region', { name: 'Card data' });
  await expect(data.getByText('Ana Souza')).toBeVisible();
  await expect(data.getByText('10.00% commission')).toBeVisible();
});

test('says so when the card does not exist', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/nope');

  await expect(page.getByText('We could not open this card')).toBeVisible();
});

test('deletes an available card after the person confirms', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/inventory/c-3');

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete this card?' });
  await expect(
    dialog.getByText('#0440 Gengar VMAX 001/100 will be removed from your stock.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete the card' }).click();

  await expect(page.getByText('Card deleted.')).toBeVisible();
  await expect(page).toHaveURL(/\/inventory$/);
  expect(mocks.deleted).toEqual(['c-3']);
});

test('does not delete when the person cancels', async ({ page }) => {
  const mocks = await signedIn(page);
  await page.goto('/inventory/c-3');

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete this card?' })
    .getByRole('button', { name: 'Cancel' })
    .click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mocks.deleted).toEqual([]);
});

test('does not let anyone delete a card that went to an auction', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/c-1');

  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
  await expect(
    page.getByText(/Only an available card that has never been to an auction/),
  ).toBeVisible();
});

test('does not let staff without the permission delete', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: { can_manage_inventory: true } });
  await page.goto('/inventory/c-3');

  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
  await expect(page.getByText('Requires permission to delete').first()).toBeVisible();
});

test('does not open the stock for staff without the permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/inventory');

  await expect(page.getByRole('table')).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, in the list and in the card', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

  await page.goto('/inventory');
  await expect(page.getByRole('table', { name: 'Cards in stock' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.goto('/inventory/c-1');
  await expect(page.getByRole('heading', { level: 2, name: 'Charizard ex 199/165' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
