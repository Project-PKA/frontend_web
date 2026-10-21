import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const session = {
  access_token: 'access-token-for-tests',
  token_type: 'Bearer',
  expires_in: 900,
  user: { id: '7d1f6c39-7f43-4a1e-9f3a-2f1a1f5b7a10', email: 'igor@example.com', name: null },
};

const GROUP = 'https://chat.whatsapp.com/AbCdEfGhIj12';

interface Template {
  key: string;
  placeholders: string[];
  default_body: string;
  custom_body: string | null;
}

const TEMPLATES = (): Template[] => [
  {
    key: 'card_opened',
    placeholders: ['card', 'short_code'],
    default_body: 'Card {card} (#{short_code})',
    custom_body: null,
  },
  {
    key: 'bid_too_low',
    placeholders: ['min_amount'],
    default_body: 'Bid too low. The minimum is {min_amount}.',
    custom_body: 'Too low! Minimum: {min_amount}',
  },
  { key: 'not_started', placeholders: [], default_body: 'Not started yet.', custom_body: null },
];

interface Options {
  role?: 'OWNER' | 'STAFF';
  withGroup?: boolean;
  showcase?: boolean;
  pix?: string | null;
  status?: 'ONLINE' | 'OFFLINE' | 'QR_READY';
  patchAnswer?: object;
  putAnswer?: object;
}

/** The text field of a message (its buttons carry the name in their labels too). */
const message = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });

function problem(status: number, code: string) {
  return {
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', title: 'Error', status, code, detail: 'mensagem em português' },
  };
}

async function signedIn(page: Page, options: Options = {}) {
  const calls = {
    patches: [] as Record<string, unknown>[],
    puts: [] as { key: string; body: string }[],
    deletes: [] as string[],
  };
  const store = {
    id: 'store-1',
    name: 'Card Hub',
    whatsapp_status: options.status ?? 'ONLINE',
    inactivity_days_limit: null as number | null,
    pix_key: options.pix ?? null,
    showcase_enabled: options.showcase ?? false,
    whatsapp_invite_url: options.withGroup ? GROUP : null,
    role: options.role ?? 'OWNER',
    permissions: {},
  };
  const templates = TEMPLATES();

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
  await page.route(/\/v1\/store$/, (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.patches.push(body);
      if (options.patchAnswer) {
        return route.fulfill(options.patchAnswer as Parameters<typeof route.fulfill>[0]);
      }
      const changes = { ...body };
      delete changes.acknowledge_public_group_link;
      Object.assign(store, changes);
    }
    return route.fulfill({ status: 200, json: store });
  });
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
  await page.route(/\/v1\/store\/message-templates\/[^/?]+$/, (route) => {
    const key = route.request().url().split('/').pop() ?? '';
    const found = templates.find((item) => item.key === key)!;
    if (route.request().method() === 'PUT') {
      const { body } = route.request().postDataJSON() as { body: string };
      calls.puts.push({ key, body });
      if (options.putAnswer) {
        return route.fulfill(options.putAnswer as Parameters<typeof route.fulfill>[0]);
      }
      found.custom_body = body;
    } else {
      calls.deletes.push(key);
      found.custom_body = null;
    }
    return route.fulfill({ status: 200, json: found });
  });
  await page.route(/\/v1\/store\/message-templates$/, (route) =>
    route.fulfill({ status: 200, json: { items: templates } }),
  );
  return calls;
}

test('shows the connection, the group, the PIX key, the showcase and the messages', async ({
  page,
}) => {
  await signedIn(page, { withGroup: true, pix: 'loja-pix-key' });
  await page.goto('/settings');

  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const whatsapp = page.getByRole('region', { name: 'WhatsApp connection' });
  await expect(whatsapp).toContainText('WhatsApp online');
  await expect(whatsapp).toContainText('QR code, is not available in the app yet');
  await expect(whatsapp.getByRole('link', { name: 'Steps to reconnect' })).toHaveAttribute(
    'href',
    '/whatsapp',
  );
  await expect(page.getByLabel('Invitation link of the group')).toHaveValue(GROUP);
  await expect(page.getByLabel('PIX key of the store')).toHaveValue('loja-pix-key');
  await expect(page.getByRole('switch', { name: /Show this store's auctions/ })).not.toBeChecked();
  await expect(message(page, 'Card post')).toHaveValue('Card {card} (#{short_code})');
  await expect(message(page, 'Bid below the minimum')).toHaveValue(
    'Too low! Minimum: {min_amount}',
  );
});

test('shows the connection as a problem when WhatsApp is not online', async ({ page }) => {
  await signedIn(page, { status: 'OFFLINE' });
  await page.goto('/settings');

  await expect(page.getByRole('region', { name: 'WhatsApp connection' })).toContainText(
    'WhatsApp offline',
  );
});

test('saves the group link, checks it first, and clears it with an empty field', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/settings');

  const field = page.getByLabel('Invitation link of the group');
  await field.fill('https://example.com/not-a-group');
  await page
    .getByRole('region', { name: 'Monitored group' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(page.getByText(/Enter the invitation link of a WhatsApp group/)).toBeVisible();
  expect(calls.patches).toEqual([]);

  await field.fill(` ${GROUP} `);
  await page
    .getByRole('region', { name: 'Monitored group' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(page.getByText('Group link saved.')).toBeVisible();
  expect(calls.patches).toEqual([{ whatsapp_invite_url: GROUP }]);

  await field.fill('');
  await page
    .getByRole('region', { name: 'Monitored group' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect.poll(() => calls.patches.length).toBe(2);
  expect(calls.patches[1]).toEqual({ whatsapp_invite_url: null });
});

test('saves the PIX key, and removes it with an empty field', async ({ page }) => {
  const calls = await signedIn(page, { pix: 'old-key' });
  await page.goto('/settings');

  const field = page.getByLabel('PIX key of the store');
  await field.fill('  new-key ');
  await page.getByRole('region', { name: 'PIX key' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('PIX key saved.')).toBeVisible();
  expect(calls.patches).toEqual([{ pix_key: 'new-key' }]);

  await field.fill('');
  await page.getByRole('region', { name: 'PIX key' }).getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => calls.patches.length).toBe(2);
  expect(calls.patches[1]).toEqual({ pix_key: null });
});

test('keeps the showcase off until the group link is saved', async ({ page }) => {
  await signedIn(page);
  await page.goto('/settings');

  await expect(page.getByRole('switch', { name: /Show this store's auctions/ })).toBeDisabled();
  await expect(
    page.getByText('Save the invitation link of the group to turn the showcase on.'),
  ).toBeVisible();
});

test('turns the showcase on only after the person knows the link becomes public', async ({
  page,
}) => {
  const calls = await signedIn(page, { withGroup: true });
  await page.goto('/settings');

  await page.locator('label.switch').filter({ hasText: "Show this store's auctions" }).click();
  const dialog = page.getByRole('dialog', { name: 'Turn the showcase on' });
  await expect(dialog).toContainText('will be shown to anyone who opens the showcase');
  const turnOn = dialog.getByRole('button', { name: 'Turn on' });
  await expect(turnOn).toBeDisabled();

  await dialog
    .locator('label.switch')
    .filter({ hasText: 'I know the group link becomes public' })
    .click();
  await expect(turnOn).toBeEnabled();
  await turnOn.click();

  await expect(page.getByText('Showcase turned on.')).toBeVisible();
  expect(calls.patches).toEqual([{ showcase_enabled: true, acknowledge_public_group_link: true }]);
  await expect(page.getByRole('switch', { name: /Show this store's auctions/ })).toBeChecked();
});

test('does not turn the showcase on when the person cancels', async ({ page }) => {
  const calls = await signedIn(page, { withGroup: true });
  await page.goto('/settings');

  await page.locator('label.switch').filter({ hasText: "Show this store's auctions" }).click();
  await page
    .getByRole('dialog', { name: 'Turn the showcase on' })
    .getByRole('button', { name: 'Cancel' })
    .click();

  expect(calls.patches).toEqual([]);
  await expect(page.getByRole('switch', { name: /Show this store's auctions/ })).not.toBeChecked();
});

test('turns the showcase off right away', async ({ page }) => {
  const calls = await signedIn(page, { withGroup: true, showcase: true });
  await page.goto('/settings');

  await page.locator('label.switch').filter({ hasText: "Show this store's auctions" }).click();
  await expect(page.getByText('Showcase turned off.')).toBeVisible();
  expect(calls.patches).toEqual([{ showcase_enabled: false }]);
});

test('shows the error of the showcase translated, inside the dialog', async ({ page }) => {
  await signedIn(page, { withGroup: true, patchAnswer: problem(422, 'SHOWCASE_ACK_REQUIRED') });
  await page.goto('/settings');

  await page.locator('label.switch').filter({ hasText: "Show this store's auctions" }).click();
  const dialog = page.getByRole('dialog', { name: 'Turn the showcase on' });
  await dialog
    .locator('label.switch')
    .filter({ hasText: 'I know the group link becomes public' })
    .click();
  const turnOn = dialog.getByRole('button', { name: 'Turn on' });
  await expect(turnOn).toBeEnabled();
  await turnOn.click();

  await expect(dialog.getByRole('alert')).toContainText('Confirm that you know the group link');
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('saves the text of a message only when it changed, and restores the default', async ({
  page,
}) => {
  const calls = await signedIn(page);
  await page.goto('/settings');

  const save = page.getByRole('button', { name: 'Save the text of: Card post' });
  await expect(save).toBeDisabled();
  const restore = page.getByRole('button', { name: 'Restore the default text of: Card post' });
  await expect(restore).toBeDisabled();

  await message(page, 'Card post').fill('New {card}!');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Message saved.')).toBeVisible();
  expect(calls.puts).toEqual([{ key: 'card_opened', body: 'New {card}!' }]);

  await expect(restore).toBeEnabled();
  await restore.click();
  await expect(page.getByText('Default message restored.')).toBeVisible();
  expect(calls.deletes).toEqual(['card_opened']);
  await expect(message(page, 'Card post')).toHaveValue('Card {card} (#{short_code})');
});

test('lists the placeholders of each message and refuses an unknown one', async ({ page }) => {
  const calls = await signedIn(page);
  await page.goto('/settings');

  const field = message(page, 'Bid below the minimum');
  await expect(page.getByText('{min_amount}', { exact: true }).first()).toBeVisible();
  await field.fill('Minimum is {min_amount} and {nope}');
  await page.getByRole('button', { name: 'Save the text of: Bid below the minimum' }).click();

  await expect(page.getByText('This message does not accept: {nope}.')).toBeVisible();
  expect(calls.puts).toEqual([]);
});

test('shows the error of a message translated, never the detail', async ({ page }) => {
  await signedIn(page, { putAnswer: problem(422, 'MESSAGE_TEMPLATE_PLACEHOLDER_UNKNOWN') });
  await page.goto('/settings');

  await message(page, 'Card post').fill('Changed {card}');
  await page.getByRole('button', { name: 'Save the text of: Card post' }).click();

  await expect(page.getByText(/uses a placeholder that does not exist/)).toBeVisible();
  await expect(page.getByText('mensagem em português')).toHaveCount(0);
});

test('does not open the settings for staff', async ({ page }) => {
  const calls = await signedIn(page, { role: 'STAFF' });
  await page.goto('/settings');

  await expect(page.getByLabel('PIX key of the store')).toHaveCount(0);
  expect(calls.patches).toEqual([]);
});

test('fits a 320px screen without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signedIn(page, { withGroup: true });
  await page.goto('/settings');
  await expect(page.getByLabel('PIX key of the store')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
