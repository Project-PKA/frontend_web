import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

type Permissions = Partial<
  Record<
    | 'can_delete'
    | 'can_view_finance'
    | 'can_manage_auctions'
    | 'can_manage_inventory'
    | 'can_manage_customers',
    boolean
  >
>;

async function signedInToAStore(
  page: Page,
  options: {
    role?: 'OWNER' | 'STAFF';
    permissions?: Permissions;
    whatsapp?: 'ONLINE' | 'OFFLINE' | 'QR_READY';
  } = {},
) {
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
        whatsapp_status: options.whatsapp ?? 'ONLINE',
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
}

const menu = (page: Page) => page.getByRole('navigation', { name: 'Main' });

test('shows the owner the whole menu, the store and the page title', async ({ page }) => {
  await signedInToAStore(page);
  await page.goto('/home');

  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(page).toHaveTitle('Home · pokemonAuction');
  await expect(menu(page).getByRole('link')).toHaveText([
    'Home',
    'Inventory',
    'Auctions',
    'Customers',
    'Team',
    'Settings',
    'Finance',
  ]);
  await expect(page.getByRole('link', { name: /Store Card Hub, Owner/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Profile of igor@example.com' })).toBeVisible();
});

test('marks the current page in the menu', async ({ page }) => {
  await signedInToAStore(page);
  await page.goto('/home');

  await expect(menu(page).getByRole('link', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(menu(page).getByRole('link', { name: 'Inventory' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('hides from staff what their permissions do not open', async ({ page }) => {
  await signedInToAStore(page, {
    role: 'STAFF',
    permissions: { can_manage_inventory: true, can_manage_auctions: true },
  });
  await page.goto('/home');

  await expect(menu(page).getByRole('link')).toHaveText(['Home', 'Inventory', 'Auctions']);
  await expect(page.getByRole('link', { name: /Store Card Hub, Staff/ })).toBeVisible();
});

test('shows whether the WhatsApp is connected', async ({ page }) => {
  await signedInToAStore(page, { whatsapp: 'OFFLINE' });
  await page.goto('/home');

  const chip = page.getByRole('status').filter({ hasText: 'WhatsApp offline' });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveClass(/status-chip--off/);
});

test('shows the error pages inside the shell for someone in a store', async ({ page }) => {
  await signedInToAStore(page);
  await page.goto('/this-page-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(menu(page)).toBeVisible();
});

test('changes the theme from the top bar', async ({ page }) => {
  await signedInToAStore(page);
  await page.goto('/home');

  await page.getByRole('button', { name: 'Dark' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('hides the menu until its button is used, and gives it the keyboard', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');
    const button = page.getByRole('button', { name: 'Open the menu' });

    await expect(menu(page)).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();

    await expect(menu(page)).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menu(page).getByRole('link', { name: 'Home' })).toBeFocused();
    // Behind the open drawer the page cannot be reached.
    await expect(page.locator('.app__main')).toHaveAttribute('inert', '');

    await page.keyboard.press('Escape');

    await expect(menu(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(page.locator('.app__main')).not.toHaveAttribute('inert', '');
  });

  test('closes the menu on a click outside it', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');
    await page.getByRole('button', { name: 'Open the menu' }).click();
    await expect(menu(page)).toBeVisible();

    await page.locator('.scrim').click({ position: { x: 370, y: 400 } });

    await expect(menu(page)).toBeHidden();
  });

  test('closes the menu when a link is used', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');
    await page.getByRole('button', { name: 'Open the menu' }).click();

    await menu(page).getByRole('link', { name: 'Inventory' }).click();

    await expect(menu(page)).toBeHidden();
  });

  test('has no horizontal scroll', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });
});

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test('keeps the menu as a narrow column whose links still have names', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');

    await expect(page.getByRole('button', { name: 'Open the menu' })).toBeHidden();
    // The text of each item is hidden, so only the icon shows...
    await expect(menu(page).getByRole('link', { name: 'Inventory' }).locator('.lb')).toBeHidden();
    // ...and the link is still found by its name.
    await expect(menu(page).getByRole('link', { name: 'Inventory' })).toBeVisible();
    expect((await menu(page).boundingBox())?.width).toBeLessThan(100);
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test('shows the full menu and no menu button', async ({ page }) => {
    await signedInToAStore(page);
    await page.goto('/home');

    await expect(page.getByRole('button', { name: 'Open the menu' })).toBeHidden();
    await expect(menu(page).getByRole('link', { name: 'Inventory' }).locator('.lb')).toBeVisible();
  });
});
