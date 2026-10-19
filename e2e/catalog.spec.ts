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

function entry(id: string, name: string, set: string, number: string, rarity: string | null) {
  return {
    id,
    name,
    names: {},
    number,
    set_id: null,
    set_name: set,
    image_url: `https://images.example.com/${id}/low.png`,
    image_high_url: `https://images.example.com/${id}/high.png`,
    rarity,
  };
}

const CATALOG = [
  entry('swsh4-044', 'Pikachu VMAX', 'Vivid Voltage', '044/185', 'Rare Ultra'),
  entry('sv08-057', 'Pikachu ex', 'Surging Sparks', '057/191', null),
  entry('swsh9-035', 'Piplup', 'Brilliant Stars', '035/172', 'Common'),
  entry('sv03-199', 'Charizard ex', '151', '199/165', 'Special Illustration Rare'),
];

interface Options {
  role?: 'OWNER' | 'STAFF';
  permissions?: Record<string, boolean>;
  searchStatus?: number;
  catalog?: ReturnType<typeof entry>[];
}

async function signedIn(page: Page, options: Options = {}) {
  const searches: string[] = [];
  const catalog = options.catalog ?? CATALOG;

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
        permissions: options.permissions ?? { can_manage_inventory: true },
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
  await page.route('https://images.example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
  );
  await page.route(/\/v1\/catalog\/search/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    searches.push(q);
    if (options.searchStatus) {
      return route.fulfill({
        status: options.searchStatus,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', title: 'Error', status: options.searchStatus, code: 'BAD' },
      });
    }
    const items = catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(q.toLowerCase()) ||
        item.number.includes(q) ||
        item.set_name.toLowerCase().includes(q.toLowerCase()),
    );
    return route.fulfill({ status: 200, json: { items } });
  });
  return searches;
}

const field = (page: Page) => page.getByRole('combobox', { name: 'Quick search: name or number' });

test('finds the card as you type and shows its name, set and number', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/new');

  await expect(page.getByRole('heading', { level: 1, name: 'Register card' })).toBeVisible();
  await expect(page.getByText('Type at least 2 characters.')).toBeVisible();
  await field(page).fill('pi');

  const list = page.getByRole('listbox', { name: 'Quick search: name or number' });
  await expect(list.getByRole('option')).toHaveCount(3);
  await expect(list.getByRole('option').first()).toContainText('Pikachu VMAX');
  await expect(list.getByRole('option').first()).toContainText('Vivid Voltage');
  await expect(list.getByRole('option').first()).toContainText('044/185');
  await expect(field(page)).toHaveAttribute('aria-expanded', 'true');
});

test('does not ask the catalog for less than 2 characters', async ({ page }) => {
  const searches = await signedIn(page);
  await page.clock.install();
  await page.goto('/inventory/new');

  await field(page).fill('p');
  // Longer than the pause before a search: if one were going to be sent, it would be by now.
  await page.clock.runFor(1_000);

  expect(searches).toEqual([]);
  await expect(page.getByRole('option')).toHaveCount(0);
});

test('waits for the person to stop typing: one question, not one per key', async ({ page }) => {
  const searches = await signedIn(page);
  await page.goto('/inventory/new');

  await field(page).pressSequentially('pikachu', { delay: 40 });

  await expect(page.getByRole('option')).toHaveCount(2);
  expect(searches).toEqual(['pikachu']);
});

test('picks a suggestion with the keyboard and shows its official art', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/new');
  await field(page).fill('pika');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');

  await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
  const art = page.getByRole('img', { name: 'Official art of Pikachu ex' });
  await expect(art).toBeVisible();
  await expect(art).toHaveAttribute('src', 'https://images.example.com/sv08-057/high.png');
  await expect(art).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.getByText('Surging Sparks · 057/191')).toBeVisible();
});

test('picks a suggestion with the pointer and says its rarity', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/new');
  await field(page).fill('pika');

  await page.getByRole('option', { name: /Pikachu VMAX/ }).click();

  await expect(page.getByRole('img', { name: 'Official art of Pikachu VMAX' })).toBeVisible();
  await expect(page.getByText('Rarity: Rare Ultra')).toBeVisible();
  await expect(page.getByText('Pick a card from the list.')).toHaveCount(0);
});

test('closes the list with Escape and clears the text with a second one', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/new');
  await field(page).fill('pika');
  await expect(page.getByRole('option')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(field(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(field(page)).toHaveValue('pika');

  await page.keyboard.press('Escape');
  await expect(field(page)).toHaveValue('');
});

test('says when no card matches', async ({ page }) => {
  await signedIn(page);
  await page.goto('/inventory/new');

  await field(page).fill('zzz');

  await expect(page.getByText('No card found for "zzz".')).toBeVisible();
});

test('shows an error with a way to try again when the search fails', async ({ page }) => {
  await signedIn(page, { searchStatus: 400 });
  await page.goto('/inventory/new');

  await field(page).fill('pika');

  await expect(
    page.getByRole('alert').filter({ hasText: 'We could not search the cards.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('shows no art for an address that is not https', async ({ page }) => {
  await signedIn(page, {
    catalog: [
      {
        ...entry('x-1', 'Odd Card', 'Odd Set', '001/001', null),
        image_url: 'http://images.example.com/x-1/low.png',
        image_high_url: 'javascript:alert(1)',
      },
    ],
  });
  await page.goto('/inventory/new');
  await field(page).fill('odd');

  await page.getByRole('option', { name: /Odd Card/ }).click();

  await expect(page.getByText('No art for this card')).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);
});

test('does not open for staff without the stock permission', async ({ page }) => {
  await signedIn(page, { role: 'STAFF', permissions: {} });
  await page.goto('/inventory/new');

  await expect(field(page)).toHaveCount(0);
});

test('fits a 320px screen without scrolling sideways, with the list open', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/inventory/new');
  await field(page).fill('pi');
  await expect(page.getByRole('option')).toHaveCount(3);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
